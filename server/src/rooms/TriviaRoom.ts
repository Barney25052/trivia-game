import { Room, Client, CloseCode } from "colyseus";
import { GamePlayer, GameState } from "./schema/GameState.js";
import { GamePhase } from "../TriviaTypes.js";
import {
  transition,
  FlowEffect,
  FlowEvent,
  GameFlowContext,
  OfferTier,
} from "../gameFlow.js";
import { scheduleTimer, TimerHandle } from "../timer.js";
import { QuestionManager } from "../questions/questionManager.js";
import { FinalRoundQuestions } from "../questions/finalRound.js";
import { loadBank, BankQuestion } from "../questions/bank.js";
import { createOpenTdbQuestionSource, McQuestion, McQuestionSource } from "../questions/opentdb.js";
import { createMcBackupQuestionSource } from "../questions/mcBackup.js";
import { pickChaseOptions } from "../questions/chaseOptions.js";
import { randomCharacter } from "../character.js";
import {
  BOARD,
  CASH_BUILDER,
  CHASE_QUESTION,
  CHASER_CHARACTER_REVEAL,
  CHASER_REVEAL,
  FINAL_ROUND,
  LINEUP,
  MC_SOURCE,
  PLAYER_NAME,
  RATE_LIMIT,
  REVEAL_READY,
  ROOM_SETTINGS,
} from "../gameConfig.js";
import {
  startGame,
  setChaserMode,
  chaserVote,
  revealReady,
  setChaserLowOffer,
  setChaserHighOffer,
  offerChoice,
  submitChaseAnswer,
  buzzIn,
  submitFinalAnswer,
  submitFinalChaserAnswer,
  submitFinalStealAnswer,
  submitAnswer,
  sendChaserQuip,
  setCharacter,
} from "./handlers/messageHandlers.js";
import { applyEffects } from "./handlers/effects.js";
import { clampRoomOptions } from "./handlers/clampOptions.js";

const OFFER_TIERS: OfferTier[] = ["low", "middle", "high"];

interface OfferAmounts {
  low: number | null;
  middle: number;
  high: number | null;
}

/** The chase question currently in play, held server-side only. `correctIndex`
 * indexes into the narrowed options shown to clients and is never broadcast
 * until the question resolves. */
interface ActiveChaseQuestion {
  id: string;
  correctIndex: number;
  optionCount: number;
}

type ChaseRole = "contestant" | "chaser";

export class TriviaRoom extends Room {
  maxClients = ROOM_SETTINGS.max_clients;
  state = new GameState();
  /** Translation layer: Colyseus sessionId (per-connection, ephemeral) → seatId. */
  sessionIdToSeatId = new Map<string, string>();
  private seatCounter = 0;

  cashBuilderDurationMs: number = CASH_BUILDER.durationMs;
  wrongAnswerRevealMs: number = CASH_BUILDER.wrongAnswerRevealMs;
  chaserSelectionDurationMs: number | null = null;
  chaserRevealDurationMs: number = CHASER_REVEAL.durationMs;
  chaserCharacterRevealDurationMs: number = CHASER_CHARACTER_REVEAL.durationMs;
  revealReadyCooldownMs: number = REVEAL_READY.cooldownMs;
  lineupDurationMs: number = LINEUP.durationMs;
  teamFinalDurationMs: number = FINAL_ROUND.teamDurationMs;
  chaserFinalDurationMs: number = FINAL_ROUND.chaserDurationMs;
  finalWrongAnswerRevealMs: number = FINAL_ROUND.wrongAnswerRevealMs;
  stealWindowMs: number = FINAL_ROUND.stealWindowMs;
  stealResolveHoldMs: number = FINAL_ROUND.stealResolveHoldMs;
  rateLimitMaxMessages: number = RATE_LIMIT.maxMessages;
  rateLimitWindowMs: number = RATE_LIMIT.windowMs;
  chaseAnswerWindowMs: number = CHASE_QUESTION.answerWindowMs;

  /** Per-question buzz lock for the team final (ticket 078): the seatId that
   * won the right to answer the current team question, cleared once the
   * stream advances to a fresh question. */
  currentFinalTeamBuzzer: string | null = null;
  /** True once the current team question's answer has been submitted — guards
   * against a second submission for the same question while its reveal hold
   * is still pending. */
  finalTeamQuestionResolved = false;
  /** True once the Chaser has answered the current Chaser-final question — the
   * Chaser answers directly (no buzz), one submission per question. */
  finalChaserQuestionResolved = false;
  /** True while the team's steal window is open after a Chaser miss (ticket
   * 079) — the first `submitFinalStealAnswer` closes it. */
  finalStealActive = false;
  finalStealTimer: TimerHandle | null = null;
  /** Outcome-beat hold after a steal resolves or expires unclaimed (ticket
   * 095): the `stealResolveHoldMs` window between resolution and the Chaser's
   * next question, cancelled by any dispatch via `clearFinalStealTimer`. */
  finalStealHoldTimer: TimerHandle | null = null;

  /** Resumable Chaser-final clock (ticket 094). `chaserFinalRemainingMs` holds
   * either the full budget while the countdown runs or the frozen remainder
   * while a steal window is open; `chaserFinalClockRunning` tells a pause
   * whether there is actually anything to freeze. */
  chaserFinalRemainingMs: number = 0;
  chaserFinalClockRunning = false;
  private chaserFinalClockStartedAt = 0;

  activeTimer: TimerHandle | null = null;
  currentOffer: OfferAmounts | null = null;
  currentOfferAmount = 0;
  questionManager = new QuestionManager();
  finalRoundQuestions = new FinalRoundQuestions();
  questionBank: BankQuestion[] = [];
  mcQuestionSource: McQuestionSource = createOpenTdbQuestionSource();
  /** Local fallback pool (ticket 090), drawn only once the live source's
   * bounded retries (ticket 074) are exhausted — a network blip must never
   * strand a Chase. */
  mcBackupSource: McQuestionSource = createMcBackupQuestionSource();
  currentChaseQuestion: ActiveChaseQuestion | null = null;
  chaseAnswers: Partial<Record<ChaseRole, number>> = {};
  chaseAnswerTimer: TimerHandle | null = null;
  private messageTimes: Map<string, number[]> = new Map();

  onCreate (options: any) {
    clampRoomOptions(this, options);
    this.questionBank = loadBank();
  }

  private clearTimer() {
    if (this.activeTimer !== null) {
      this.activeTimer.cancel();
      this.activeTimer = null;
    }
  }

  private setPhase(phase: GamePhase) {
    if (this.state.currentPhase !== phase) {
      this.state.currentPhase = phase;
      console.log("Phase ->", phase);
    }
    this.broadcast("phase", { phase });
  }

  private generateSeatId(): string {
    this.seatCounter += 1;
    return `seat-${this.seatCounter}`;
  }

  /** Resolve the seat id for a connected client (undefined if not seated). */
  seatIdForClient(client: Client): string | undefined {
    return this.sessionIdToSeatId.get(client.sessionId);
  }

  /** Resolve the seat id for a raw Colyseus sessionId (test/debug helper). */
  seatIdForSessionId(sessionId: string): string | undefined {
    return this.sessionIdToSeatId.get(sessionId);
  }

  private flowContext(): GameFlowContext {
    return {
      currentPhase: this.state.currentPhase,
      contestantsOrder: [...this.state.contestantsOrder],
      activeContestantSeatId: this.state.activeContestantSeatId,
      activeRound: this.state.activeRound,
      currentOfferAmount: this.currentOfferAmount,
      chaserSelectionMode: this.state.chaserSelectionMode,
    };
  }

  private broadcastQuestion(round: number, targetSeatId: string, kind: "open" | "mc", questionId: number | string, prompt: string, options?: string[]) {
    const payload: { round: number; targetSeatId: string; kind: "open" | "mc"; prompt: string; options?: string[]; questionId: number | string } = {
      round,
      targetSeatId,
      kind,
      prompt,
      options,
      questionId,
    };
    this.broadcast("question", payload);
  }

  /** Delivers a final-round question to exactly one side's clients — never a
   * room broadcast (ticket 077): the Chaser must never receive a team prompt,
   * or vice versa. `question` is null when that side's bank is exhausted. */
  private sendFinalQuestion(side: "team" | "chaser", question: BankQuestion | null) {
    const payload = {
      side,
      questionId: question?.id ?? null,
      prompt: question?.question ?? null,
    };
    for (const client of this.clients) {
      const seatId = this.seatIdForClient(client);
      if (!seatId) {
        continue;
      }
      const isChaser = seatId === this.state.chaserSeatId;
      if ((side === "chaser") === isChaser) {
        client.send("finalQuestion", payload);
      }
    }
  }

  private clearChaseAnswerTimer() {
    if (this.chaseAnswerTimer !== null) {
      this.chaseAnswerTimer.cancel();
      this.chaseAnswerTimer = null;
    }
    this.currentChaseQuestion = null;
    this.chaseAnswers = {};
  }

  private clearFinalStealTimer() {
    if (this.finalStealTimer !== null) {
      this.finalStealTimer.cancel();
      this.finalStealTimer = null;
    }
    if (this.finalStealHoldTimer !== null) {
      this.finalStealHoldTimer.cancel();
      this.finalStealHoldTimer = null;
    }
    this.finalStealActive = false;
  }

  /** Starts the Chaser-final countdown for the full budget (ticket 094). The
   * clock is resumable: a Chaser miss pauses it (`pauseChaserFinalClock`) and
   * the frozen remainder resumes on steal resolution or expiry. */
  startChaserFinalClock() {
    this.chaserFinalRemainingMs = this.chaserFinalDurationMs;
    this.runChaserFinalCountdown();
  }

  /** Freezes the Chaser-final countdown at the current remaining time (ticket
   * 094) — called when a Chaser miss opens the steal window so the 2-minute
   * clock does not burn while the team pushes back. */
  pauseChaserFinalClock() {
    if (!this.chaserFinalClockRunning) {
      return;
    }
    this.chaserFinalRemainingMs -= Date.now() - this.chaserFinalClockStartedAt;
    this.chaserFinalClockRunning = false;
    if (this.activeTimer !== null) {
      this.activeTimer.cancel();
      this.activeTimer = null;
    }
    console.log(`Chaser final clock paused — ${this.chaserFinalRemainingMs}ms remain`);
  }

  /** Resumes the frozen Chaser-final countdown for the remaining time (ticket
   * 094) — called when the steal resolves or expires unclaimed. A remainder
   * already at or below 0 dispatches `finalChaserTimeout` (the team wins) right
   * away instead of scheduling another tick of non-existent time. */
  resumeChaserFinalClock() {
    if (this.chaserFinalClockRunning || this.state.currentPhase !== GamePhase.ChaserFinal) {
      return;
    }
    if (this.chaserFinalRemainingMs <= 0) {
      console.log("Chaser final clock already exhausted on resume — the team wins");
      this.dispatch({ type: "finalChaserTimeout" });
      return;
    }
    this.runChaserFinalCountdown();
  }

  private runChaserFinalCountdown() {
    this.chaserFinalClockStartedAt = Date.now();
    this.chaserFinalClockRunning = true;
    this.activeTimer = this.scheduleTimer(this.chaserFinalRemainingMs, () => {
      this.chaserFinalClockRunning = false;
      this.chaserFinalRemainingMs = 0;
      this.activeTimer = null;
      this.dispatch({ type: "finalChaserTimeout" });
    });
  }

  /** Draws the next team-final question (or null on exhaustion) and reopens
   * the buzz for it (ticket 078). */
  advanceFinalTeamQuestion() {
    const next = this.finalRoundQuestions.drawNext(this.questionBank, "team");
    this.sendFinalQuestion("team", next);
    this.currentFinalTeamBuzzer = null;
    this.finalTeamQuestionResolved = false;
  }

  /** Draws the next Chaser-final question (or null on exhaustion) (ticket 079). */
  advanceFinalChaserQuestion() {
    const next = this.finalRoundQuestions.drawNext(this.questionBank, "chaser");
    this.sendFinalQuestion("chaser", next);
    this.finalChaserQuestionResolved = false;
  }

  /** Holds the outcome beat after a steal resolves or expires unclaimed
   * (ticket 095): the frozen Chaser-final clock (094) stays paused through the
   * `stealResolveHoldMs` window so the winning answer + resolved outcome have
   * air time without burning the Chaser's budget, then the remainder resumes
   * and the Chaser stream advances. Safe to call while a steal window is open
   * (idempotent — it closes the window and re-arms the hold) or after one has
   * just expired. */
  finishFinalSteal() {
    this.clearFinalStealTimer();
    this.finalStealHoldTimer = this.scheduleTimer(this.stealResolveHoldMs, () => {
      this.finalStealHoldTimer = null;
      if (this.state.currentPhase !== GamePhase.ChaserFinal) {
        return;
      }
      this.resumeChaserFinalClock();
      if (this.state.currentPhase === GamePhase.ChaserFinal) {
        this.advanceFinalChaserQuestion();
      }
    });
  }

  /** Draws the next MC question for the chase and broadcasts it — the option
   * list shown to clients is narrowed to `CHASE_QUESTION.optionCount` options,
   * and `correctIndex` is held only in `currentChaseQuestion`, never sent. */
  /** Bounded recovery around a single chase question draw (ticket 074): the
   * live source (OpenTDB) already retries at the fetch level, but a whole
   * draw can still throw or come back empty (network blip, rate limit). Retry
   * a small bounded number of times, then fall back to the local MC backup
   * pool (ticket 090) — only returning null if that pool is itself exhausted. */
  private async drawChaseQuestion(): Promise<McQuestion | null> {
    for (let attempt = 0; attempt <= MC_SOURCE.retries; attempt += 1) {
      try {
        const drawn = await this.mcQuestionSource.getQuestions(1);
        if (drawn[0]) {
          return drawn[0];
        }
      } catch (error) {
        console.error(`Chase question draw attempt ${attempt + 1} failed:`, error);
      }
      if (attempt < MC_SOURCE.retries) {
        await new Promise((resolve) => setTimeout(resolve, MC_SOURCE.retryDelayMs));
      }
    }

    console.warn("Chase question source exhausted its retries — falling back to the local MC backup pool");
    try {
      const backupDrawn = await this.mcBackupSource.getQuestions(1);
      if (backupDrawn[0]) {
        return backupDrawn[0];
      }
    } catch (error) {
      console.error("MC backup pool draw failed:", error);
    }
    return null;
  }

  private async startNextChaseQuestion(): Promise<void> {
    this.currentChaseQuestion = null;
    this.chaseAnswers = {};

    const question = await this.drawChaseQuestion();
    if (!question) {
      // Both the live source and the local backup are exhausted — this is
      // the last resort so the room never hangs. Resolve the round as caught
      // rather than leave it unanswerable forever (ticket 074).
      console.error("Chase question source and the MC backup pool are both exhausted — resolving the round as caught");
      this.dispatch({ type: "contestantForfeit" });
      return;
    }

    const { options, correctIndex } = pickChaseOptions(question, CHASE_QUESTION.optionCount);
    this.currentChaseQuestion = { id: question.id, correctIndex, optionCount: options.length };

    this.broadcastQuestion(
      this.state.activeRound,
      this.state.activeContestantSeatId,
      "mc",
      question.id,
      question.question,
      options
    );
  }

  /** Resolves the current chase question once both sides have answered, or the
   * lockout window closes — moves board positions and dispatches
   * chaseEscape/chaseCaught when a side reaches the terminal space. */
  private resolveChaseQuestion() {
    if (this.state.currentPhase !== GamePhase.Chase) {
      return;
    }
    const question = this.currentChaseQuestion;
    if (!question) {
      return;
    }
    if (this.chaseAnswerTimer !== null) {
      this.chaseAnswerTimer.cancel();
      this.chaseAnswerTimer = null;
    }
    const answers = this.chaseAnswers;
    this.currentChaseQuestion = null;
    this.chaseAnswers = {};

    const contestantSeatId = this.state.activeContestantSeatId;
    const chaserSeatId = this.state.chaserSeatId;
    const contestant = this.state.players.get(contestantSeatId);
    const chaser = this.state.players.get(chaserSeatId);
    const contestantCorrect = answers.contestant === question.correctIndex;
    const chaserCorrect = answers.chaser === question.correctIndex;

    if (contestant && contestantCorrect) {
      contestant.boardPos = Math.max(BOARD.escapeSpace, contestant.boardPos - 1);
    }
    if (chaser && chaserCorrect) {
      chaser.boardPos = chaser.boardPos === BOARD.chaserStartOffboard
        ? BOARD.chaserFirstCorrectSpace
        : Math.max(BOARD.escapeSpace, chaser.boardPos - 1);
    }

    this.broadcast("chaseQuestionResult", {
      questionId: question.id,
      correctIndex: question.correctIndex,
      contestantCorrect,
      chaserCorrect,
      contestantBoardPos: contestant?.boardPos ?? null,
      chaserBoardPos: chaser?.boardPos ?? null,
    });

    if (contestant && contestant.boardPos <= BOARD.escapeSpace) {
      this.dispatch({ type: "chaseEscape" });
      return;
    }
    if (contestant && chaser && chaser.boardPos <= contestant.boardPos) {
      this.dispatch({ type: "chaseCaught" });
      return;
    }

    this.startNextChaseQuestion().catch((error) => {
      console.error("Failed to draw the next chase question:", error);
    });
  }

  private isHost (client: Client): boolean {
    const seatId = this.seatIdForClient(client);
    return this.state.players.get(seatId ?? "")?.isHost === true;
  }

  public dispatch(event: FlowEvent) {
    try {
      const context = this.flowContext();
      const result = transition(event, context);
      this.clearTimer();
      this.clearChaseAnswerTimer();
      this.clearFinalStealTimer();
      applyEffects(result.effects, this, context);
      this.setPhase(result.nextPhase);
    } catch (error) {
      console.error(`Rejected flow event '${event.type}':`, (error as Error).message);
    }
  }

  public scheduleTimer(delayMs: number, onFire: () => void) {
    return scheduleTimer(this, delayMs, onFire)
  }

  private checkRateLimit(client: Client): boolean {
    const now = Date.now();
    const cutoff = now - this.rateLimitWindowMs;
    const timestamps = this.messageTimes.get(client.sessionId) ?? [];
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length >= this.rateLimitMaxMessages) {
      this.messageTimes.set(client.sessionId, timestamps);
      client.send("error", { code: "RATE_LIMITED", message: "Too many messages" });
      console.log(
        `${client.sessionId} rate limited: ${timestamps.length} messages within ${this.rateLimitWindowMs}ms`
      );
      return false;
    }
    timestamps.push(now);
    this.messageTimes.set(client.sessionId, timestamps);
    return true;
  }

  messages: Record<string, (client: Client, message: any) => void> = {
    startGame: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      startGame(client, message, this);
    },
    setChaserMode: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      setChaserMode(client, message, this);
    },
    chaserVote: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      chaserVote(client, message, this);
    },
    revealReady: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      revealReady(client, message, this);
    },
    setChaserLowOffer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      setChaserLowOffer(client, message, this);
    },
    setChaserHighOffer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      setChaserHighOffer(client, message, this);
    },
    offerChoice: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      offerChoice(client, message, this);
    },
    submitChaseAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitChaseAnswer(client, message, this);
    },
    buzzIn: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      buzzIn(client, message, this);
    },
    submitFinalAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitFinalAnswer(client, message, this);
    },
    submitFinalChaserAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitFinalChaserAnswer(client, message, this);
    },
    submitFinalStealAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitFinalStealAnswer(client, message, this);
    },
    submitAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitAnswer(client, message, this);
    },
    sendChaserQuip: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      sendChaserQuip(client, message, this);
    },
    setCharacter: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      setCharacter(client, message, this);
    },
    whoami: (client: Client) => {
      if (!this.checkRateLimit(client)) return;
      const seatId = this.seatIdForClient(client);
      if (!seatId) {
        console.log(client.sessionId, "Whoami for an unseated client — ignored");
        return;
      }
      client.send("seatId", { seatId });
    },
  };

  onJoin (client: Client, options: any) {
    const name = typeof options?.playerName === "string" ? options.playerName.trim() : "";
    if (name.length === 0 || name.length > PLAYER_NAME.maxLength) {
      console.log(
        `Rejected join: invalid playerName (length ${name.length}) for room ${this.roomId}`
      );
      throw new Error(
        `Invalid playerName: must be 1-${PLAYER_NAME.maxLength} characters after trimming`
      );
    }
    const seatId = this.generateSeatId();
    const newPlayer = new GamePlayer();
    newPlayer.name = name;
    newPlayer.seatId = seatId;
    newPlayer.character = randomCharacter();
    if (this.state.players.size === 0) {
      newPlayer.isHost = true;
    }
    this.state.players.set(seatId, newPlayer);
    this.sessionIdToSeatId.set(client.sessionId, seatId);
    this.state.contestantsOrder.push(seatId);
    console.log(`Client joined room ${this.roomId} as seat ${seatId}`);
  }

  private allPlayersReady(): boolean {
    const players = [...this.state.players.values()];
    return players.length > 0 && players.every((player) => player.revealReady);
  }

  onLeave (client: Client, code: CloseCode) {
    this.messageTimes.delete(client.sessionId);
    const seatId = this.seatIdForClient(client);
    const player = seatId ? this.state.players.get(seatId) : undefined;
    if (player?.isHost) {
      console.log("Host left the room — disconnecting", this.roomId);
      this.disconnect(6767);
      return;
    }

    if (seatId && seatId === this.state.chaserSeatId && this.state.chaserSeatId !== "") {
      // The Chaser dropped mid-game after a chaser was already assigned: the
      // room can never advance without them (offers, chase answers) — the
      // conservative default is game over, team wins (ticket 075, bug-010).
      console.log(`Chaser ${seatId} left mid-game — the team wins by default`);
      this.dispatch({ type: "chaserForfeit" });
      if (seatId) {
        this.state.players.delete(seatId);
        this.sessionIdToSeatId.delete(client.sessionId);
        const contestantIndex = this.state.contestantsOrder.indexOf(seatId);
        if (contestantIndex >= 0) {
          this.state.contestantsOrder.splice(contestantIndex, 1);
        }
        this.questionManager.clearContestant(seatId);
      }
      return;
    }

    const phase = this.state.currentPhase;
    if (
      phase === GamePhase.TeamFinal &&
      seatId &&
      this.currentFinalTeamBuzzer === seatId &&
      !this.finalTeamQuestionResolved
    ) {
      // The buzzed-in contestant left before submitting: release the lock so
      // any other non-Chaser can buzz in on the same question (ticket 078).
      console.log(`Buzzed contestant ${seatId} left before answering — releasing the buzz`);
      this.currentFinalTeamBuzzer = null;
    }

    if (
      seatId &&
      this.state.activeContestantSeatId === seatId &&
      (phase === GamePhase.CashBuilder || phase === GamePhase.Offer || phase === GamePhase.Chase)
    ) {
      // The active contestant reloaded/left mid-round: forfeit the seat as caught
      // (no pot paid) so the game moves on. Route through gameFlow, not here.
      console.log(
        `Active contestant ${seatId} left mid-${phase} — forfeiting the round as caught`
      );
      this.dispatch({ type: "contestantForfeit" });
    }

    if (seatId) {
      this.state.players.delete(seatId);
      this.sessionIdToSeatId.delete(client.sessionId);
      const contestantIndex = this.state.contestantsOrder.indexOf(seatId);
      if (contestantIndex >= 0) {
        this.state.contestantsOrder.splice(contestantIndex, 1);
      }
      this.questionManager.clearContestant(seatId);
    }

    // The roles-reveal gate must not wait forever on a departed seat: if everyone
    // still connected has revealed, advance (mirrors the revealReady handler).
    if (this.state.currentPhase === GamePhase.RolesReveal && this.allPlayersReady()) {
      console.log("All remaining players are ready — advancing past the roles reveal");
      this.dispatch({ type: "revealAllReady" });
    }

    // If every remaining contestant leaves during the Lineup hold (ticket 049's
    // turn-order screen), there's nobody left to run a cash builder for: resolve
    // to GameEnd instead of letting the pending lineup timer throw and leave the
    // room stuck in Lineup (bug-004, ticket 061).
    if (
      this.state.currentPhase === GamePhase.Lineup &&
      this.state.contestantsOrder.length === 0
    ) {
      console.log("Last contestant left during the Lineup — no team left, ending the game");
      this.dispatch({ type: "lineupAbandoned" });
    }

    console.log(`Client left room ${this.roomId} (seat ${seatId ?? "unseated"})`);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}