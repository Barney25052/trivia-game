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
import { loadBank, BankQuestion } from "../questions/bank.js";
import { createOpenTdbQuestionSource, McQuestionSource } from "../questions/opentdb.js";
import { pickChaseOptions } from "../questions/chaseOptions.js";
import {
  BOARD,
  CASH_BUILDER,
  CHASE_QUESTION,
  CHASER_CHARACTER_REVEAL,
  CHASER_REVEAL,
  FINAL_ROUND,
  LINEUP,
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
  finalChaserScore,
  submitAnswer,
  sendChaserQuip,
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
  rateLimitMaxMessages: number = RATE_LIMIT.maxMessages;
  rateLimitWindowMs: number = RATE_LIMIT.windowMs;
  chaseAnswerWindowMs: number = CHASE_QUESTION.answerWindowMs;

  activeTimer: TimerHandle | null = null;
  currentOffer: OfferAmounts | null = null;
  currentOfferAmount = 0;
  questionManager = new QuestionManager();
  questionBank: BankQuestion[] = [];
  mcQuestionSource: McQuestionSource = createOpenTdbQuestionSource();
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

  private clearChaseAnswerTimer() {
    if (this.chaseAnswerTimer !== null) {
      this.chaseAnswerTimer.cancel();
      this.chaseAnswerTimer = null;
    }
    this.currentChaseQuestion = null;
    this.chaseAnswers = {};
  }

  /** Draws the next MC question for the chase and broadcasts it — the option
   * list shown to clients is narrowed to `CHASE_QUESTION.optionCount` options,
   * and `correctIndex` is held only in `currentChaseQuestion`, never sent. */
  private async startNextChaseQuestion(): Promise<void> {
    this.currentChaseQuestion = null;
    this.chaseAnswers = {};

    let drawn;
    try {
      drawn = await this.mcQuestionSource.getQuestions(1);
    } catch (error) {
      console.error("Failed to draw a chase question:", error);
      this.broadcast("question", null);
      return;
    }
    const question = drawn[0];
    if (!question) {
      console.error("Chase question source returned no questions");
      this.broadcast("question", null);
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
    finalChaserScore: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      finalChaserScore(client, message, this);
    },
    submitAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitAnswer(client, message, this);
    },
    sendChaserQuip: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      sendChaserQuip(client, message, this);
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

    const phase = this.state.currentPhase;
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