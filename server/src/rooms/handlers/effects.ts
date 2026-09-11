import { FlowEffect } from "../../gameFlow.js";
import { PlayerRole } from "../../TriviaTypes.js";
import * as chaserSelection from "./chaserSelection.js";
import { CHASER_CHARACTERS, CHASER_REVEAL, CHASER_SELECTION, LINEUP } from "../../gameConfig.js";

export function applyEffects(effects: FlowEffect[], room: any, context: any): void {
    for (const effect of effects) {
      switch (effect.type) {
        case "startChaserSelection": {
          const mode = room.state.chaserSelectionMode;
          const duration =
            room.chaserSelectionDurationMs ??
            (mode === "vote" ? CHASER_SELECTION.voteDurationMs : CHASER_SELECTION.randomDurationMs);
          console.log(
            `Chaser selection in ${mode} mode — ${duration}ms to decide`
          );
          room.activeTimer = room.scheduleTimer(duration, () => {
            if (mode === "vote") {
              room.dispatch({
                type: "chaserSelectionComplete",
                chaserSeatId: chaserSelection.tallyChaserVotes(room)
              });
            } else {
              room.dispatch({
                type: "chaserSelectionComplete",
                chaserSeatId: chaserSelection.pickRandomChaser(room)
              });
            }
          });
          break;
        }

        case "assignChaser": {
          room.state.chaserSeatId = effect.seatId;
          const player = room.state.players.get(effect.seatId);
          if (player) {
            player.role = PlayerRole.Chaser;
          }
          const chaserPosition = room.state.contestantsOrder.indexOf(effect.seatId);
          if (chaserPosition >= 0) {
            room.state.contestantsOrder.splice(chaserPosition, 1);
          }
          console.log(`${effect.seatId} is the Chaser`);
          break;
        }

        case "startChaserReveal": {
          const duration = room.chaserRevealDurationMs ?? CHASER_REVEAL.durationMs;
          console.log(`Chaser reveal — wheel plays for ${duration}ms`);
          room.activeTimer = room.scheduleTimer(duration, () => {
            room.dispatch({ type: "chaserRevealComplete" });
          });
          break;
        }

        case "startRolesReveal": {
          console.log("Roles reveal — waiting for all players to confirm before the cash builder");
          break;
        }

        case "startLineup": {
          const duration = room.lineupDurationMs ?? LINEUP.durationMs;
          console.log(`Contestant lineup — showing the turn order for ${duration}ms`);
          room.activeTimer = room.scheduleTimer(duration, () => {
            room.dispatch({ type: "lineupComplete" });
          });
          break;
        }

        case "startReadyCooldown": {
          room.state.activeContestantSeatId = effect.seatId;
          room.state.activeRound = effect.round;
          console.log(
            `Get ready — cash builder for ${effect.seatId} starts in ${room.revealReadyCooldownMs}ms`
          );
          room.broadcast("getReady", { cooldownMs: room.revealReadyCooldownMs });
          room.activeTimer = room.scheduleTimer(room.revealReadyCooldownMs, () => {
            room.dispatch({ type: "readyCooldownDone" });
          });
          break;
        }

        case "startCashBuilder": {
          room.state.activeContestantSeatId = effect.seatId;
          room.state.activeRound = effect.round;
          room.questionManager.initContestant(effect.seatId);
          const firstQuestion = room.questionManager.drawNext(room.questionBank, effect.seatId);
          if (firstQuestion) {
            room.broadcastQuestion(
              effect.round,
              effect.seatId,
              "open",
              firstQuestion.id,
              firstQuestion.question,
              firstQuestion.category
            );
          } else {
            room.broadcast("question", null);
          }
          console.log(
            `Cash builder for ${effect.seatId} (round ${effect.round}, ${room.cashBuilderDurationMs}ms)`
          );
          room.activeTimer = room.scheduleTimer(room.cashBuilderDurationMs, () => {
            room.dispatch({ type: "cashBuilderTimeout" });
          });
          break;
        }

        case "startOffer": {
          room.questionManager.clearContestant(effect.seatId);
          const player = room.state.players.get(effect.seatId);
          const take = player?.cashBuilderMoney ?? 0;
          room.currentOffer = {
            low: Math.floor(take / 2),
            middle: take,
            high: take * 2
          };
          room.currentOfferAmount = room.currentOffer.middle;
          console.log(
            `Offer for ${effect.seatId}: low ${room.currentOffer.low} / ` +
            `middle ${room.currentOffer.middle} / high ${room.currentOffer.high}`
          );
          const chaser = room.state.players.get(room.state.chaserSeatId);
          const chaserCharId = chaser?.chaserCharacterId ?? "";
          const chaserChar = CHASER_CHARACTERS.find((c) => c.id === chaserCharId);
          room.broadcast("offer", {
            seatId: effect.seatId,
            offers: room.currentOffer,
            chaserCharacterId: chaserCharId,
            chaserCharacterName: chaserChar?.name ?? "",
            chaserCharacterAbility: chaserChar?.ability ?? ""
          });
          break;
        }

        case "startChase": {
          console.log(
            `Chase: ${effect.seatId} starts at space ${effect.contestantStartSpace}, ` +
            `chaser at ${effect.chaserStartSpace}`
          );
          break;
        }

        case "eliminateContestant": {
          const player = room.state.players.get(effect.seatId);
          if (player) {
            player.isEliminated = true;
          }
          console.log(`${effect.seatId} was caught — out of the game`);
          break;
        }

        case "addToTeamPot": {
          const player = room.state.players.get(effect.seatId);
          if (player) {
            player.madeItBack = true;
          }
          room.state.teamPot += effect.amount;
          console.log(`${effect.seatId} made it back — ${effect.amount} added to the team pot`);
          break;
        }

        case "startFinalTeam": {
          const survivors = [...room.state.contestantsOrder].filter(
            (seatId) => room.state.players.get(seatId)?.madeItBack === true
          ).length;
          room.state.teamScore = survivors;
          console.log(`Final round: team starts at ${survivors} points (${room.teamFinalDurationMs}ms)`);
          room.activeTimer = room.scheduleTimer(room.teamFinalDurationMs, () => {
            room.dispatch({ type: "finalTeamTimeout" });
          });
          break;
        }

        case "startFinalChaser": {
          console.log(`Final round: chaser goes (${room.chaserFinalDurationMs}ms)`);
          room.activeTimer = room.scheduleTimer(room.chaserFinalDurationMs, () => {
            room.dispatch({ type: "finalChaserTimeout" });
          });
          break;
        }

        case "endGame": {
          console.log(`Game over — ${effect.winner} wins!`);
          room.broadcast("endGame", { winner: effect.winner });
          break;
        }
      }
    }
  }