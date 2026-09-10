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
import { CASH_BUILDER, FINAL_ROUND } from "../gameConfig.js";

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
  teamFinalDurationMs: number = FINAL_ROUND.teamDurationMs;
  chaserFinalDurationMs: number = FINAL_ROUND.chaserDurationMs;

  activeTimer: TimerHandle | null = null;
  currentOffer: OfferAmounts | null = null;
  currentOfferAmount = 0;

  onCreate (options: any) {
    if (typeof options?.cashBuilderDurationMs === "number") {
      this.cashBuilderDurationMs = options.cashBuilderDurationMs;
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
      if (this.state.currentPhase !== GamePhase.Lobby) {
        console.log(client.sessionId, "Can not start the game outside Lobby!");
        return;
      }
      console.log(client.sessionId, "Starting game!");
      this.dispatch({ type: "startGame" });
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
    var newPlayer = new GamePlayer();
    newPlayer.name = options.playerName;
    newPlayer.sessionId = client.sessionId;
    newPlayer.role = PlayerRole.Contestant;
    if(this.state.players.size == 0) {
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