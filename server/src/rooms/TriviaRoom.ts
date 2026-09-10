import { Room, Client, CloseCode } from "colyseus";
import { GamePlayer, GameState } from "./schema/GameState.js";
import { GamePhase, PlayerRole } from "../TriviaTypes.js";
import {
  transition,
  FlowEffect,
  FlowEvent,
  GameFlowContext,
  OfferTier,
} from "../gameFlow.js";
import { scheduleTimer, TimerHandle } from "../timer.js";
import { CASH_BUILDER, CHASER_SELECTION, FINAL_ROUND, PLAYER_NAME } from "../gameConfig.js";

const OFFER_TIERS: OfferTier[] = ["low", "middle", "high"];

interface OfferAmounts {
  low: number;
  middle: number;
  high: number;
}

export class TriviaRoom extends Room {
  maxClients = 4;
  state = new GameState();

  cashBuilderDurationMs: number = CASH_BUILDER.durationMs;
  chaserSelectionDurationMs: number = CHASER_SELECTION.durationMs;
  teamFinalDurationMs: number = FINAL_ROUND.teamDurationMs;
  chaserFinalDurationMs: number = FINAL_ROUND.chaserDurationMs;

  activeTimer: TimerHandle | null = null;
  currentOffer: OfferAmounts | null = null;
  currentOfferAmount = 0;

  onCreate (options: any) {
    if (typeof options?.cashBuilderDurationMs === "number") {
      this.cashBuilderDurationMs = options.cashBuilderDurationMs;
    }
    if (typeof options?.chaserSelectionDurationMs === "number") {
      this.chaserSelectionDurationMs = options.chaserSelectionDurationMs;
    }
    if (typeof options?.teamFinalDurationMs === "number") {
      this.teamFinalDurationMs = options.teamFinalDurationMs;
    }
    if (typeof options?.chaserFinalDurationMs === "number") {
      this.chaserFinalDurationMs = options.chaserFinalDurationMs;
    }
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

  private isHost (client: Client): boolean {
    return this.state.players.get(client.sessionId)?.isHost === true;
  }

  private pickRandomChaser(): string {
    const sessionIds = [...this.state.players.keys()];
    return sessionIds[Math.floor(Math.random() * sessionIds.length)];
  }

  private allPlayersVoted(): boolean {
    if (this.state.players.size === 0) {
      return false;
    }
    for (const player of this.state.players.values()) {
      if (player.chaserVote === "") {
        return false;
      }
    }
    return true;
  }

  private tallyChaserVotes(): string {
    const votes = new Map<string, number>();
    for (const player of this.state.players.values()) {
      if (player.chaserVote !== "") {
        votes.set(player.chaserVote, (votes.get(player.chaserVote) ?? 0) + 1);
      }
    }
    const counted = [...votes.entries()];
    if (counted.length === 0) {
      return this.pickRandomChaser();
    }
    const most = Math.max(...counted.map(([, count]) => count));
    const leaders = counted.filter(([, count]) => count === most).map(([sessionId]) => sessionId);
    return leaders[Math.floor(Math.random() * leaders.length)];
  }

  private dispatch(event: FlowEvent) {
    try {
      const result = transition(event, this.flowContext());
      this.clearTimer();
      this.applyEffects(result.effects);
      this.setPhase(result.nextPhase);
    } catch (error) {
      console.error(`Rejected flow event '${event.type}':`, (error as Error).message);
    }
  }

  private applyEffects(effects: FlowEffect[]) {
    for (const effect of effects) {
      switch (effect.type) {
        case "startChaserSelection": {
          const mode = this.state.chaserSelectionMode || CHASER_SELECTION.defaultMode;
          console.log(
            `Chaser selection in ${mode} mode — ${this.chaserSelectionDurationMs}ms to decide`
          );
          this.activeTimer = scheduleTimer(this, this.chaserSelectionDurationMs, () => {
            if (mode === "vote") {
              this.dispatch({
                type: "chaserSelectionComplete",
                chaserSessionId: this.tallyChaserVotes()
              });
            } else {
              this.dispatch({
                type: "chaserSelectionComplete",
                chaserSessionId: this.pickRandomChaser()
              });
            }
          });
          break;
        }

        case "assignChaser": {
          this.state.chaserSessionId = effect.sessionId;
          const player = this.state.players.get(effect.sessionId);
          if (player) {
            player.role = PlayerRole.Chaser;
          }
          const chaserPosition = this.state.contestantsOrder.indexOf(effect.sessionId);
          if (chaserPosition >= 0) {
            this.state.contestantsOrder.splice(chaserPosition, 1);
          }
          console.log(`${effect.sessionId} is the Chaser`);
          break;
        }

        case "startCashBuilder": {
          this.state.activeContestantSessionId = effect.sessionId;
          this.state.activeRound = effect.round;
          console.log(
            `Cash builder for ${effect.sessionId} (round ${effect.round}, ${this.cashBuilderDurationMs}ms)`
          );
          this.activeTimer = scheduleTimer(this, this.cashBuilderDurationMs, () => {
            this.dispatch({ type: "cashBuilderTimeout" });
          });
          break;
        }

        case "startOffer": {
          const player = this.state.players.get(effect.sessionId);
          const take = player?.cashBuilderMoney ?? 0;
          this.currentOffer = {
            middle: take,
            low: Math.floor(take / 2),
            high: take * 2
          };
          this.currentOfferAmount = this.currentOffer.middle;
          console.log(
            `Offer for ${effect.sessionId}: low ${this.currentOffer.low} / ` +
            `middle ${this.currentOffer.middle} / high ${this.currentOffer.high}`
          );
          this.broadcast("offer", {
            sessionId: effect.sessionId,
            offers: this.currentOffer
          });
          break;
        }

        case "startChase": {
          console.log(
            `Chase: ${effect.sessionId} starts at space ${effect.contestantStartSpace}, ` +
            `chaser at ${effect.chaserStartSpace}`
          );
          break;
        }

        case "eliminateContestant": {
          const player = this.state.players.get(effect.sessionId);
          if (player) {
            player.isEliminated = true;
          }
          console.log(`${effect.sessionId} was caught — out of the game`);
          break;
        }

        case "addToTeamPot": {
          const player = this.state.players.get(effect.sessionId);
          if (player) {
            player.madeItBack = true;
          }
          this.state.teamPot += effect.amount;
          console.log(`${effect.sessionId} made it back — ${effect.amount} added to the team pot`);
          break;
        }

        case "startFinalTeam": {
          const survivors = [...this.state.contestantsOrder].filter(
            (sessionId) => this.state.players.get(sessionId)?.madeItBack === true
          ).length;
          this.state.teamScore = survivors;
          console.log(`Final round: team starts at ${survivors} points (${this.teamFinalDurationMs}ms)`);
          this.activeTimer = scheduleTimer(this, this.teamFinalDurationMs, () => {
            this.dispatch({ type: "finalTeamTimeout" });
          });
          break;
        }

        case "startFinalChaser": {
          console.log(`Final round: chaser goes (${this.chaserFinalDurationMs}ms)`);
          this.activeTimer = scheduleTimer(this, this.chaserFinalDurationMs, () => {
            this.dispatch({ type: "finalChaserTimeout" });
          });
          break;
        }

        case "endGame": {
          console.log(`Game over — ${effect.winner} wins!`);
          this.broadcast("endGame", { winner: effect.winner });
          break;
        }
      }
    }
  }

  messages = {
    startGame: (client: Client, message: any) => {
      if (!this.isHost(client)) {
        console.log(client.sessionId, "Can not start the game — only the host can!");
        return;
      }
      if (this.state.currentPhase !== GamePhase.Lobby) {
        console.log(client.sessionId, "Can not start the game outside Lobby!");
        return;
      }
      console.log(client.sessionId, "Starting game!");
      this.dispatch({ type: "startGame" });
    },

    setChaserMode: (client: Client, message: any) => {
      if (!this.isHost(client)) {
        console.log(client.sessionId, "Can not set the chaser mode — only the host can!");
        return;
      }
      if (this.state.currentPhase !== GamePhase.Lobby) {
        console.log(client.sessionId, "Can not set the chaser mode outside Lobby!");
        return;
      }
      const mode = message?.mode;
      if (mode !== "random" && mode !== "vote") {
        console.log(client.sessionId, "Ignoring invalid chaser mode:", mode);
        return;
      }
      this.state.chaserSelectionMode = mode;
      console.log(client.sessionId, "Set chaser mode to", mode);
    },

    chaserVote: (client: Client, message: any) => {
      if (this.state.currentPhase !== GamePhase.ChaserSelection) {
        console.log(client.sessionId, "Can not vote outside ChaserSelection!");
        return;
      }
      const voter = this.state.players.get(client.sessionId);
      if (!voter) {
        return;
      }
      if (voter.chaserVote !== "") {
        console.log(client.sessionId, "Already voted for the chaser!");
        return;
      }
      const target = message?.targetSessionId;
      if (typeof target !== "string" || !this.state.players.has(target)) {
        console.log(client.sessionId, "Ignoring vote for unknown player:", target);
        return;
      }
      voter.chaserVote = target;
      if (this.state.chaserSelectionMode === "vote" && this.allPlayersVoted()) {
        this.dispatch({
          type: "chaserSelectionComplete",
          chaserSessionId: this.tallyChaserVotes()
        });
      }
    },

    offerChoice: (client: Client, message: any) => {
      const offer = message?.offer as OfferTier;
      if (!OFFER_TIERS.includes(offer)) {
        console.log(client.sessionId, "Ignoring invalid offer choice:", message?.offer);
        return;
      }
      if (this.currentOffer) {
        this.currentOfferAmount = this.currentOffer[offer];
      }
      this.dispatch({ type: "contestantChoice", offer });
    },

    chaseResult: (client: Client, message: any) => {
      if (message?.escaped === true) {
        this.dispatch({ type: "chaseEscape" });
      } else {
        this.dispatch({ type: "chaseCaught" });
      }
    },

    finalChaserScore: (client: Client, message: any) => {
      this.dispatch({ type: "finalChaserReachedScore" });
    }
  }

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
    newPlayer.role = PlayerRole.Contestant;
    if (this.state.players.size === 0) {
      newPlayer.isHost = true;
    }
    this.state.players.set(client.sessionId, newPlayer);
    this.state.contestantsOrder.push(client.sessionId);
    console.log("Client joined room", this.roomId);
    console.log(options)
  }

  onLeave (client: Client, code: CloseCode) {
    const player = this.state.players.get(client.sessionId);
    if(player?.isHost) {
      this.disconnect(6767)
    }
    this.state.players.delete(client.sessionId);
    const contestantIndex = this.state.contestantsOrder.indexOf(client.sessionId);
    if(contestantIndex >= 0) {
      this.state.contestantsOrder.splice(contestantIndex, 1);
    }
    console.log("Client left room", this.roomId)
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}