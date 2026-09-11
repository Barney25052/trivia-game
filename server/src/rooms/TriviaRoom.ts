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
import {
  CASH_BUILDER,
  CHASER_REVEAL,
  FINAL_ROUND,
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
  offerChoice,
  chaseResult,
  finalChaserScore,
  submitAnswer,
} from "./handlers/messageHandlers.js";
import { applyEffects } from "./handlers/effects.js";
import { clampRoomOptions } from "./handlers/clampOptions.js";

const OFFER_TIERS: OfferTier[] = ["low", "middle", "high"];

interface OfferAmounts {
  low: number;
  middle: number;
  high: number;
}

export class TriviaRoom extends Room {
  maxClients = ROOM_SETTINGS.max_clients;
  state = new GameState();
  seatIdToSessionId = new Map<string, string>();

  cashBuilderDurationMs: number = CASH_BUILDER.durationMs;
  chaserSelectionDurationMs: number | null = null;
  chaserRevealDurationMs: number = CHASER_REVEAL.durationMs;
  revealReadyCooldownMs: number = REVEAL_READY.cooldownMs;
  teamFinalDurationMs: number = FINAL_ROUND.teamDurationMs;
  chaserFinalDurationMs: number = FINAL_ROUND.chaserDurationMs;
  rateLimitMaxMessages: number = RATE_LIMIT.maxMessages;
  rateLimitWindowMs: number = RATE_LIMIT.windowMs;

  activeTimer: TimerHandle | null = null;
  currentOffer: OfferAmounts | null = null;
  currentOfferAmount = 0;
  questionManager = new QuestionManager();
  questionBank: BankQuestion[] = [];
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

  private flowContext(): GameFlowContext {
    return {
      currentPhase: this.state.currentPhase,
      contestantsOrder: [...this.state.contestantsOrder],
      activeContestantSessionId: this.state.activeContestantSessionId,
      activeRound: this.state.activeRound,
      currentOfferAmount: this.currentOfferAmount,
    };
  }

  private broadcastQuestion(round: number, targetSessionId: string, kind: "open" | "mc", questionId: number, prompt: string, category: string, options?: string[]) {
    const payload: { round: number; targetSessionId: string; kind: "open" | "mc"; prompt: string; category: string; options?: string[]; questionId: number } = {
      round,
      targetSessionId,
      kind,
      prompt,
      category,
      options,
      questionId,
    };
    this.broadcast("question", payload);
  }

  private isHost (client: Client): boolean {
    return this.state.players.get(client.sessionId)?.isHost === true;
  }

  public dispatch(event: FlowEvent) {
    try {
      const context = this.flowContext();
      const result = transition(event, context);
      this.clearTimer();
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
    offerChoice: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      offerChoice(client, message, this);
    },
    chaseResult: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      chaseResult(client, message, this);
    },
    finalChaserScore: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      finalChaserScore(client, message, this);
    },
    submitAnswer: (client: Client, message: any) => {
      if (!this.checkRateLimit(client)) return;
      submitAnswer(client, message, this);
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
    const newPlayer = new GamePlayer();
    newPlayer.name = name;
    newPlayer.sessionId = client.sessionId;
    newPlayer.seatId = client.sessionId.slice(0, 8);
    if (this.state.players.size === 0) {
      newPlayer.isHost = true;
    }
    this.state.players.set(client.sessionId, newPlayer);
    this.seatIdToSessionId.set(newPlayer.seatId, client.sessionId);
    this.state.contestantsOrder.push(client.sessionId);
    console.log("Client joined room", this.roomId);
  }

  private allPlayersReady(): boolean {
    const players = [...this.state.players.values()];
    return players.length > 0 && players.every((player) => player.revealReady);
  }

  onLeave (client: Client, code: CloseCode) {
    this.messageTimes.delete(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player?.isHost) {
      console.log("Host left the room — disconnecting", this.roomId);
      this.disconnect(6767);
      return;
    }

    const phase = this.state.currentPhase;
    if (
      this.state.activeContestantSessionId === client.sessionId &&
      (phase === GamePhase.CashBuilder || phase === GamePhase.Offer || phase === GamePhase.Chase)
    ) {
      // The active contestant reloaded/left mid-round: forfeit the seat as caught
      // (no pot paid) so the game moves on. Route through gameFlow, not here.
      console.log(
        `Active contestant ${client.sessionId} left mid-${phase} — forfeiting the round as caught`
      );
      this.dispatch({ type: "contestantForfeit" });
    }

    this.state.players.delete(client.sessionId);
    if (player) {
      this.seatIdToSessionId.delete(player.seatId);
    }
    const contestantIndex = this.state.contestantsOrder.indexOf(client.sessionId);
    if (contestantIndex >= 0) {
      this.state.contestantsOrder.splice(contestantIndex, 1);
    }
    this.questionManager.clearContestant(client.sessionId);

    // The roles-reveal gate must not wait forever on a departed seat: if everyone
    // still connected has revealed, advance (mirrors the revealReady handler).
    if (this.state.currentPhase === GamePhase.RolesReveal && this.allPlayersReady()) {
      console.log("All remaining players are ready — advancing past the roles reveal");
      this.dispatch({ type: "revealAllReady" });
    }

    console.log("Client left room", this.roomId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}