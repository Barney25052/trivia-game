import { GamePhase, PlayerRole } from "../../TriviaTypes.js";
import { Room, Client } from "colyseus";
import { GameState } from "../schema/GameState.js";
import { FlowEffect, GameFlowContext, GameFlowResult } from "../../gameFlow.js";
import { CASH_BUILDER, CHASER_SELECTION, FINAL_ROUND, REVEAL_READY } from "../../gameConfig.js";
import { OfferTier } from "../../gameFlow.js";
import { TriviaRoom } from "../TriviaRoom.js";

export const applyEffects = (effects: FlowEffect[], room: TriviaRoom, context: GameFlowContext): GameFlowResult => {
    for (const effect of effects) {
        switch (effect.type) {
            case "startChaserSelection": {
                const mode = room.state.chaserSelectionMode ?? "random";
                const duration =
                    room.chaserSelectionDurationMs ??
                    (mode === "vote" ? CHASER_SELECTION.voteDurationMs : CHASER_SELECTION.randomDurationMs);
                room.activeTimer = room.scheduleTimer(duration, () => {
                    if (mode === "vote") {
                        room.dispatch({
                            type: "chaserSelectionComplete",
                            chaserSessionId: room.tallyChaserVotes()
                        });
                    } else {
                        room.dispatch({
                            type: "chaserSelectionComplete",
                            chaserSessionId: room.pickRandomChaser()
                        });
                    }
                });
                break;
            }

            case "assignChaser": {
                room.state.chaserSessionId = effect.sessionId;
                const player = room.state.players.get(effect.sessionId);
                if (player) {
                    player.role = PlayerRole.Chaser;
                }
                const chaserPosition = room.state.contestantsOrder.indexOf(effect.sessionId);
                if (chaserPosition >= 0) {
                    room.state.contestantsOrder.splice(chaserPosition, 1);
                }
                break;
            }

            case "startRolesReveal": {
                console.log("Roles reveal — waiting for all players to confirm before the cash builder");
                break;
            }

            case "startReadyCooldown": {
                room.state.activeContestantSessionId = effect.sessionId;
                room.state.activeRound = effect.round;
                console.log(
                    `Get ready — cash builder for ${effect.sessionId} starts in ${room.revealReadyCooldownMs}ms`
                );
                room.broadcast("getReady", { cooldownMs: room.revealReadyCooldownMs });
                room.activeTimer = room.scheduleTimer(room.revealReadyCooldownMs, () => {
                    room.dispatch({ type: "readyCooldownDone" });
                });
                break;
            }

            case "startCashBuilder": {
                room.state.activeContestantSessionId = effect.sessionId;
                room.state.activeRound = effect.round;
                console.log(
                    `Cash builder for ${effect.sessionId} (round ${effect.round}, ${room.cashBuilderDurationMs}ms)`
                );
                room.activeTimer = room.scheduleTimer(room.cashBuilderDurationMs, () => {
                    room.dispatch({ type: "cashBuilderTimeout" });
                });
                break;
            }

            case "startOffer": {
                const player = room.state.players.get(effect.sessionId);
                const take = player?.cashBuilderMoney ?? 0;
                room.currentOffer = {
                    low: Math.floor(take / 2),
                    middle: take,
                    high: take * 2
                };
                room.currentOfferAmount = room.currentOffer.middle;
                console.log(
                    `Offer for ${effect.sessionId}: low ${room.currentOffer.low} / middle ${room.currentOffer.middle} / high ${room.currentOffer.high}`
                );
                room.broadcast("offer", {
                    sessionId: effect.sessionId,
                    offers: room.currentOffer
                });
                break;
            }

            case "startChase": {
                console.log(
                    `Chase: ${effect.sessionId} starts at space ${effect.contestantStartSpace}, chaser at ${effect.chaserStartSpace}`
                );
                break;
            }

            case "eliminateContestant": {
                const player = room.state.players.get(effect.sessionId);
                if (player) {
                    player.isEliminated = true;
                }
                console.log(`${effect.sessionId} was caught — out of the game`);
                break;
            }

            case "addToTeamPot": {
                const player = room.state.players.get(effect.sessionId);
                if (player) {
                    player.madeItBack = true;
                }
                room.state.teamPot += effect.amount;
                console.log(`${effect.sessionId} made it back — ${effect.amount} added to the team pot`);
                break;
            }

            case "startFinalTeam": {
                const survivors = [...room.state.contestantsOrder].filter(
                    (sessionId) => room.state.players.get(sessionId)?.madeItBack === true
                ).length;
                room.state.teamScore = survivors;
                console.log(`Final round: team starts at ${survivors} points (${FINAL_ROUND.teamDurationMs}ms)`);
                room.activeTimer = room.scheduleTimer(FINAL_ROUND.teamDurationMs, () => {
                    room.dispatch({ type: "finalTeamTimeout" });
                });
                break;
            }

            case "startFinalChaser": {
                console.log(`Final round: chaser goes (${FINAL_ROUND.chaserDurationMs}ms)`);
                room.activeTimer = room.scheduleTimer(FINAL_ROUND.chaserDurationMs, () => {
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
    return {
        nextPhase: room.state.currentPhase,
        effects: []
    };
};