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
import { nextExpression, Expression } from "../reactions.js";
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
  REACTION,
  REVEAL_READY,
  ROOM_SETTINGS,
  TEAM_FINAL_INTRO,
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
  useChaserAbility,
} from "./handlers/messageHandlers.js";
import { applyEffects } from "./handlers/effects.js";
import { clampRoomOptions } from "./handlers/clampOptions.js";

const OFFER_TIERS: OfferTier[] = ["low", "middle", "high"];

/** Live `TriviaRoom` count for this process (ticket 132): incremented once a
 * new room clears the `ROOM_SETTINGS.maxConcurrentRooms` cap check in
 * `onCreate`, decremented in `onDispose`. This is a single-process app (PM2
 * `exec_mode: fork`, per `ecosystem.config.cjs`), so a module-scoped counter
 * is a correct server-wide cap — no cross-process coordination to build. */
let liveRoomCount = 0;

interface OfferAmounts {
  low: number | null;
  middle: number;
  high: number | null;
}

/** The chase question currently in play, held server-side only. `correctIndex`
 * indexes into `options` and is never broadcast until the question resolves.
 * `prompt`/`options` are kept here (not just the id) so 50/50 can narrow
 * `options` in place and re-broadcast, and Jumble can re-send the same
 * prompt/options to the contestant with an added display-order hint (ticket
 * 141) — both without a second question draw. */
interface ActiveChaseQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

type ChaseRole = "contestant" | "chaser";

export class TriviaRoom extends Room {
  maxClients = ROOM_SETTINGS.max_clients;
  state = new GameState();
  /** Translation layer: Colyseus sessionId (per-connection, ephemeral) → seatId. */
  sessionIdToSeatId = new Map<string, string>();
  private seatCounter = 0;
  /** Per-seat consecutive-wrong-answer count feeding the reaction escalation
   * (ticket 103) — cleared on leave (like sessionIdToSeatId) and on every
   * phase/round transition (see `dispatch`), so a streak never survives past
   * the round it was built in. */
  wrongStreakBySeat = new Map<string, number>();

  cashBuilderDurationMs: number = CASH_BUILDER.durationMs;
  wrongAnswerRevealMs: number = CASH_BUILDER.wrongAnswerRevealMs;
  chaserSelectionDurationMs: number | null = null;
  chaserRevealDurationMs: number = CHASER_REVEAL.durationMs;
  chaserCharacterRevealDurationMs: number = CHASER_CHARACTER_REVEAL.durationMs;
  revealReadyCooldownMs: number = REVEAL_READY.cooldownMs;
  lineupDurationMs: number = LINEUP.durationMs;
  teamFinalIntroDurationMs: number = TEAM_FINAL_INTRO.durationMs;
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
    // Abuse cap (ticket 132, AGENTS.md "cap active rooms and connections"):
    // reject room creation once the server-wide live-room count is at the
    // configured cap. Colyseus turns an onCreate throw into a client-facing
    // join/create error rather than a silent hang.
    if (liveRoomCount >= ROOM_SETTINGS.maxConcurrentRooms) {
      console.log(
        `Rejected room creation: at capacity (${liveRoomCount}/${ROOM_SETTINGS.maxConcurrentRooms} live rooms)`
      );
      throw new Error("Server is at capacity — please try again shortly.");
    }
    liveRoomCount += 1;

    clampRoomOptions(this, options);
    // Mirror the real (possibly clamped/overridden) cash-builder duration into
    // synced state (ticket 112, fixing bug-015) so CashBuilderScreen.vue can
    // derive its "Time left" display from the server-authoritative value
    // instead of a hardcoded guess.
    this.state.cashBuilderDurationMs = this.cashBuilderDurationMs;
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

  /** Jumble (ticket 141): re-sends the current chase question to just the
   * active contestant's own client with an added `displayOrder` permutation
   * — the Chaser and any spectators already have the question from the
   * original `broadcastQuestion` call (no `displayOrder`, natural order) and
   * get nothing further here. Scoring never reads `displayOrder`:
   * `resolveChaseQuestion` always checks the real submitted index against
   * `correctIndex`; this is purely a display-order hint for the contestant's
   * own client to consume (ticket 146). */
  private sendJumbledQuestionToContestant(displayOrder: number[]) {
    const question = this.currentChaseQuestion;
    if (!question) {
      return;
    }
    const contestantSeatId = this.state.activeContestantSeatId;
    for (const client of this.clients) {
      if (this.seatIdForClient(client) === contestantSeatId) {
        client.send("question", {
          round: this.state.activeRound,
          targetSeatId: contestantSeatId,
          kind: "mc",
          prompt: question.prompt,
          options: question.options,
          questionId: question.id,
          displayOrder,
        });
        return;
      }
    }
  }

  /** Broadcasts the public `reaction` cue for a seat's answer outcome (ticket
   * 103): a correct answer always resets that seat's wrong streak and
   * smiles; a wrong answer grows the streak and only turns teary once it
   * reaches `REACTION.wrongStreakTear` — one wrong answer just frowns. Never
   * call this with anything beyond correct/wrong — the cue must never leak
   * the correct answer or index (AGENTS.md "never broadcast before reveal"). */
  private broadcastAnswerReaction(seatId: string, correct: boolean) {
    const priorStreak = this.wrongStreakBySeat.get(seatId) ?? 0;
    const streak = correct ? 0 : priorStreak + 1;
    this.wrongStreakBySeat.set(seatId, streak);
    const expression: Expression = nextExpression("neutral", correct, streak);
    this.broadcast("reaction", { seatId, expression });
  }

  /** Same cue, tuned for the Chase (ticket 103 judgment call): every wrong
   * answer here is immediately dangerous — the Chaser is actively closing
   * the gap on that very question — so there's no intermediate "frown"
   * stage the way the cash builder builds one over several questions; a miss
   * jumps straight to the streak's tear threshold. */
  private broadcastChaseReaction(seatId: string, correct: boolean) {
    const streak = correct ? 0 : REACTION.wrongStreakTear;
    this.wrongStreakBySeat.set(seatId, streak);
    const expression: Expression = nextExpression("neutral", correct, streak);
    this.broadcast("reaction", { seatId, expression });
  }

  /** The final round only reacts to success (ticket 103 scope) — a wrong
   * final/steal answer already gets the full-screen red flash from ticket
   * 100, so no frown/teary face is layered on top of it here. */
  private broadcastSuccessReaction(seatId: string) {
    const expression: Expression = nextExpression("neutral", true, 0);
    this.broadcast("reaction", { seatId, expression });
  }

  /** Delivers a final-round question. The team side stays one-sided (ticket
   * 077): the Chaser must never get an advance look at the team's prompt. The
   * Chaser side is a whole-room send (ticket 117's "Watching" state) — only
   * the Chaser's typed guess has to stay hidden (AGENTS.md "never broadcast
   * before reveal" covers answers/correctness, not the prompt itself), so the
   * team can now watch the same question the Chaser is working on instead of
   * staring at a blank state. `question` is null when that side's bank is
   * exhausted. */
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
      if (side === "chaser" || !isChaser) {
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
    // Double Time (ticket 140) is armed for exactly one chase question —
    // never let it survive past the question it was armed for.
    this.state.doubleTimeArmed = false;
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
    this.syncChaserFinalClockState();
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
      this.syncChaserFinalClockState();
      this.dispatch({ type: "finalChaserTimeout" });
      return;
    }
    this.runChaserFinalCountdown();
  }

  /** Big Stan's Time Bonus passive (ticket 142): extends the *running*
   * Chaser-final clock by `bonusMs` without letting the timer already
   * scheduled against the old total still fire. Reuses the exact elapsed-time
   * bookkeeping `pauseChaserFinalClock` uses (remaining -= time since the
   * countdown last (re)started), adds the bonus, then re-arms the countdown
   * against the new total via the same `runChaserFinalCountdown` seam
   * `resumeChaserFinalClock` uses — this immediately syncs the extended time
   * through `syncChaserFinalClockState`. A no-op while the clock isn't
   * running (e.g. mid-steal) — nothing live to extend. */
  extendChaserFinalClock(bonusMs: number) {
    if (!this.chaserFinalClockRunning) {
      return;
    }
    this.chaserFinalRemainingMs -= Date.now() - this.chaserFinalClockStartedAt;
    this.chaserFinalRemainingMs += bonusMs;
    if (this.activeTimer !== null) {
      this.activeTimer.cancel();
      this.activeTimer = null;
    }
    this.runChaserFinalCountdown();
    console.log(`Time Bonus — chaser final clock extended by ${bonusMs}ms, ${this.chaserFinalRemainingMs}ms remain`);
  }

  private runChaserFinalCountdown() {
    this.chaserFinalClockStartedAt = Date.now();
    this.chaserFinalClockRunning = true;
    this.syncChaserFinalClockState();
    this.activeTimer = this.scheduleTimer(this.chaserFinalRemainingMs, () => {
      this.chaserFinalClockRunning = false;
      this.chaserFinalRemainingMs = 0;
      this.activeTimer = null;
      this.syncChaserFinalClockState();
      this.dispatch({ type: "finalChaserTimeout" });
    });
  }

  /** Mirrors the room-private clock fields above into the synced `GameState`
   * (ticket 105) so every client renders the real running/paused status and
   * true remaining time instead of an independent local guess (bug-013) —
   * `chaserFinalRemainingMs`/`chaserFinalClockRunning` above stay the
   * authoritative, unsynced source of truth the room's own logic reads;
   * this just publishes a snapshot whenever they change. */
  private syncChaserFinalClockState() {
    this.state.chaserFinalClockRunning = this.chaserFinalClockRunning;
    this.state.chaserFinalRemainingMs = Math.max(0, this.chaserFinalRemainingMs);
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
    // Double Time (ticket 140) is armed for exactly one chase question —
    // never let it survive into the next one.
    this.state.doubleTimeArmed = false;

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
    this.currentChaseQuestion = { id: question.id, prompt: question.question, options, correctIndex };

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
    // Double Time (ticket 140/141) is armed for exactly one chase question —
    // capture it before clearing so the board math below can still branch on
    // it, then clear it either way: a correct answer, a wrong one, and the
    // lockout window simply expiring with the Chaser never answering (which
    // reads as "wrong" below) all consume the arm.
    const doubleTimeArmed = this.state.doubleTimeArmed;
    this.state.doubleTimeArmed = false;

    const contestantSeatId = this.state.activeContestantSeatId;
    const chaserSeatId = this.state.chaserSeatId;
    const contestant = this.state.players.get(contestantSeatId);
    const chaser = this.state.players.get(chaserSeatId);
    const contestantCorrect = answers.contestant === question.correctIndex;
    const chaserCorrect = answers.chaser === question.correctIndex;

    if (contestant && contestantCorrect) {
      contestant.boardPos = Math.max(BOARD.escapeSpace, contestant.boardPos - 1);
    }
    if (chaser) {
      const chaserOffboard = chaser.boardPos === BOARD.chaserStartOffboard;
      if (chaserCorrect) {
        // Double Time (ticket 141): armed and correct moves an extra space,
        // whether that first move is on from off-board or already on-board.
        chaser.boardPos = doubleTimeArmed
          ? (chaserOffboard ? BOARD.chaserFirstCorrectSpace - 1 : Math.max(BOARD.escapeSpace, chaser.boardPos - 2))
          : (chaserOffboard ? BOARD.chaserFirstCorrectSpace : Math.max(BOARD.escapeSpace, chaser.boardPos - 1));
      } else if (doubleTimeArmed && !chaserOffboard) {
        // Double Time (ticket 141): armed and wrong retreats the Chaser one
        // space while already on-board, capped so it never falls fully back
        // off-board. An armed miss still off-board has nothing to retreat
        // from, so it's left as an ordinary miss (no extra penalty).
        chaser.boardPos = Math.min(BOARD.chaserFirstCorrectSpace, chaser.boardPos + 1);
      }
    }

    this.broadcast("chaseQuestionResult", {
      questionId: question.id,
      correctIndex: question.correctIndex,
      contestantCorrect,
      chaserCorrect,
      contestantBoardPos: contestant?.boardPos ?? null,
      chaserBoardPos: chaser?.boardPos ?? null,
      // Lets the client tell a Double-Time-affected move apart from a normal
      // one (ticket 141/146) — always present, true only when this question
      // was resolved while armed.
      doubleTimeArmed,
    });

    if (contestant) {
      // Contestants only — the Chaser's portrait stays static (ticket 103),
      // so no reaction is broadcast for chaserSeatId here.
      this.broadcastChaseReaction(contestantSeatId, contestantCorrect);
    }

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
      // Every dispatch is a phase/round transition (ticket 103): a wrong
      // streak built up in one round/phase must never leak into the next.
      this.wrongStreakBySeat.clear();
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
    useChaserAbility: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      useChaserAbility(client, message, this);
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
      // 4001 is inside the WebSocket spec's private-use close-code range
      // (RFC 6455: 4000-4999) — the old 6767 exceeded it and made `ws`
      // throw on every real host disconnect (bug-014, ticket 104).
      this.disconnect(4001);
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
        this.wrongStreakBySeat.delete(seatId);
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
      this.wrongStreakBySeat.delete(seatId);
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
    liveRoomCount -= 1;
    console.log("room", this.roomId, "disposing...");
  }
}