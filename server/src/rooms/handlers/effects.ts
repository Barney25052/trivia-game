import { FlowEffect } from "../../gameFlow.js";
import { PlayerRole } from "../../TriviaTypes.js";
import { pickOfferQuip } from "../../offerQuips.js";
import * as chaserSelection from "./chaserSelection.js";
import {
  CHASER_CHARACTERS,
  CHASER_CHARACTER_REVEAL,
  CHASER_POT,
  CHASER_REVEAL,
  CHASER_SELECTION,
  LINEUP,
} from "../../gameConfig.js";

export function applyEffects(effects: FlowEffect[], room: any, context: any): void {
    for (const effect of effects) {
      switch (effect.type) {
        case "startChaserSelection": {
          // Only reached in vote mode — random mode resolves the Chaser directly
          // in gameFlow's startGame and skips this hold entirely (ticket 054).
          const duration = room.chaserSelectionDurationMs ?? CHASER_SELECTION.voteDurationMs;
          console.log(`Chaser selection in vote mode — ${duration}ms to decide`);
          room.activeTimer = room.scheduleTimer(duration, () => {
            room.dispatch({
              type: "chaserSelectionComplete",
              chaserSeatId: chaserSelection.tallyChaserVotes(room)
            });
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

        case "startChaserCharacterReveal": {
          const duration = room.chaserCharacterRevealDurationMs ?? CHASER_CHARACTER_REVEAL.durationMs;
          const chaser = room.state.players.get(room.state.chaserSeatId);
          const chaserCharId = chaser?.chaserCharacterId ?? "";
          const chaserChar = CHASER_CHARACTERS.find((c) => c.id === chaserCharId);
          console.log(`Chaser character reveal — ${chaserChar?.name ?? chaserCharId} (${duration}ms)`);
          room.broadcast("chaserCharacterReveal", {
            chaserCharacterId: chaserCharId,
            chaserCharacterName: chaserChar?.name ?? ""
          });
          room.activeTimer = room.scheduleTimer(duration, () => {
            room.dispatch({ type: "chaserCharacterRevealComplete" });
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
              firstQuestion.question
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
          // A $0 middle has no legal low offer (ticket 058) — skip the low-offer
          // step by pre-filling it with $0 instead of waiting on the Chaser.
          room.currentOffer = {
            low: take === 0 ? 0 : null,
            middle: take,
            high: null
          };
          room.currentOfferAmount = take;
          const waitingFor = take === 0 ? "high" : "low/high";
          console.log(`Offer for ${effect.seatId}: middle ${take} — waiting for the Chaser to set ${waitingFor}`);
          const chaser = room.state.players.get(room.state.chaserSeatId);
          const chaserCharId = chaser?.chaserCharacterId ?? "";
          const chaserChar = CHASER_CHARACTERS.find((c) => c.id === chaserCharId);
          room.broadcast("offerStart", {
            seatId: effect.seatId,
            middle: take,
            low: room.currentOffer.low,
            chaserCharacterId: chaserCharId,
            chaserCharacterName: chaserChar?.name ?? "",
            chaserCharacterAbility: chaserChar?.ability ?? "",
            quip: pickOfferQuip("start")
          });
          break;
        }

        case "chaserOffersSet": {
          room.currentOffer.low = effect.low;
          room.currentOffer.high = effect.high;
          console.log(
            `Chaser set offers for ${effect.seatId}: low ${effect.low} / ` +
            `middle ${room.currentOffer.middle} / high ${effect.high}`
          );
          const chaser = room.state.players.get(room.state.chaserSeatId);
          const chaserCharId = chaser?.chaserCharacterId ?? "";
          const chaserChar = CHASER_CHARACTERS.find((c) => c.id === chaserCharId);
          room.broadcast("offer", {
            seatId: effect.seatId,
            offers: room.currentOffer,
            chaserCharacterId: chaserCharId,
            chaserCharacterName: chaserChar?.name ?? "",
            chaserCharacterAbility: chaserChar?.ability ?? "",
            quip: pickOfferQuip("high")
          });
          break;
        }

        case "startChase": {
          const contestant = room.state.players.get(effect.seatId);
          if (contestant) {
            contestant.boardPos = effect.contestantStartSpace;
          }
          const chaser = room.state.players.get(room.state.chaserSeatId);
          if (chaser) {
            chaser.boardPos = effect.chaserStartSpace;
          }
          console.log(
            `Chase: ${effect.seatId} starts at space ${effect.contestantStartSpace}, ` +
            `chaser at ${effect.chaserStartSpace}`
          );
          room.startNextChaseQuestion().catch((error: unknown) => {
            console.error("Failed to start the chase question:", error);
          });
          break;
        }

        case "eliminateContestant": {
          const player = room.state.players.get(effect.seatId);
          if (player) {
            player.isEliminated = true;
          }
          room.state.chaserPot += CHASER_POT.perRound;
          console.log(`${effect.seatId} was caught — out of the game`);
          break;
        }

        case "addToTeamPot": {
          const player = room.state.players.get(effect.seatId);
          if (player) {
            player.madeItBack = true;
          }
          room.state.teamPot += effect.amount;
          room.state.chaserPot += CHASER_POT.perRound;
          room.state.chaserPot = Math.max(0, room.state.chaserPot - effect.amount);
          console.log(`${effect.seatId} made it back — ${effect.amount} added to the team pot`);
          break;
        }

        case "startFinalTeam": {
          const survivors = [...room.state.contestantsOrder].filter(
            (seatId) => room.state.players.get(seatId)?.madeItBack === true
          ).length;
          room.state.teamScore = survivors;
          console.log(`Final round: team starts at ${survivors} points (${room.teamFinalDurationMs}ms)`);
          const firstTeamQuestion = room.finalRoundQuestions.drawNext(room.questionBank, "team");
          room.sendFinalQuestion("team", firstTeamQuestion);
          room.activeTimer = room.scheduleTimer(room.teamFinalDurationMs, () => {
            room.dispatch({ type: "finalTeamTimeout" });
          });
          break;
        }

        case "startFinalChaser": {
          console.log(`Final round: chaser goes (${room.chaserFinalDurationMs}ms)`);
          const firstChaserQuestion = room.finalRoundQuestions.drawNext(room.questionBank, "chaser");
          room.sendFinalQuestion("chaser", firstChaserQuestion);
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