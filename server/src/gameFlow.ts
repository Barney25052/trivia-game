import { BOARD } from "./gameConfig.js";
import { GamePhase } from "./TriviaTypes.js";

export type OfferTier = "low" | "middle" | "high";

export type FlowEvent =
    | { type: "startGame" }
    | { type: "chaserSelectionComplete"; chaserSeatId: string }
    | { type: "chaserRevealComplete" }
    | { type: "revealAllReady" }
    | { type: "lineupComplete" }
    | { type: "readyCooldownDone" }
    | { type: "cashBuilderTimeout" }
    | { type: "chaserOffersSet"; low: number; high: number }
    | { type: "contestantChoice"; offer: OfferTier }
    | { type: "chaseEscape" }
    | { type: "chaseCaught" }
    | { type: "contestantForfeit" }
    | { type: "finalTeamTimeout" }
    | { type: "finalChaserReachedScore" }
    | { type: "finalChaserTimeout" };

/**
 * Transition context, modeled on GameState's fields (ticket 006) so the room
 * can call into gameFlow with no translation layer.
 */
export interface GameFlowContext {
    currentPhase: GamePhase;
    contestantsOrder: string[];
    activeContestantSeatId: string;
    activeRound: number;
    currentOfferAmount: number;
    chaserSelectionMode: string;
}

/**
 * Side-effects the room must apply when a transition is taken. gameFlow stays
 * pure: it only describes what must happen; the room decides how to apply it.
 */
export type FlowEffect =
    | { type: "startChaserSelection" }
    | { type: "assignChaser"; seatId: string }
    | { type: "startChaserReveal" }
    | { type: "startRolesReveal" }
    | { type: "startLineup" }
    | { type: "startReadyCooldown"; seatId: string; round: number }
    | { type: "startCashBuilder"; seatId: string; round: number }
    | { type: "startOffer"; seatId: string }
    | { type: "chaserOffersSet"; seatId: string; low: number; high: number }
    | { type: "startChase"; seatId: string; contestantStartSpace: number; chaserStartSpace: number }
    | { type: "eliminateContestant"; seatId: string }
    | { type: "addToTeamPot"; seatId: string; amount: number }
    | { type: "startFinalTeam" }
    | { type: "startFinalChaser" }
    | { type: "endGame"; winner: "chaser" | "team" };

export interface GameFlowResult {
    nextPhase: GamePhase;
    effects: FlowEffect[];
}

function contestantStartSpace(tier: OfferTier): number {
    switch (tier) {
        case "low": return BOARD.startLow;
        case "middle": return BOARD.startMiddle;
        case "high": return BOARD.startHigh;
    }
}

function ensurePhase(event: FlowEvent, context: GameFlowContext, expected: GamePhase): void {
    if (context.currentPhase !== expected) {
        throw new Error(
            `gameFlow: ${event.type} is not valid in phase ${context.currentPhase} (expected ${expected})`
        );
    }
}

function nextContestant(context: GameFlowContext, seatId: string): string | undefined {
    const index = context.contestantsOrder.indexOf(seatId);
    if (index < 0 || index === context.contestantsOrder.length - 1) {
        return undefined;
    }
    return context.contestantsOrder[index + 1];
}

export function transition(event: FlowEvent, context: GameFlowContext): GameFlowResult {
    switch (event.type) {
        case "startGame": {
            ensurePhase(event, context, GamePhase.Lobby);
            if (context.contestantsOrder.length === 0) {
                throw new Error("gameFlow: startGame requires at least one contestant");
            }
            if (context.chaserSelectionMode === "random") {
                // Random mode takes no player input, so there is nothing to show on a
                // ChaserSelection hold — pick the chaser now and go straight to the
                // wheel (the wheel IS the reveal; see ticket 054).
                const chaserSeatId =
                    context.contestantsOrder[Math.floor(Math.random() * context.contestantsOrder.length)];
                const remaining = context.contestantsOrder.find((seatId) => seatId !== chaserSeatId);
                if (remaining === undefined) {
                    throw new Error("gameFlow: startGame requires at least one contestant besides the Chaser");
                }
                return {
                    nextPhase: GamePhase.ChaserReveal,
                    effects: [
                        { type: "assignChaser", seatId: chaserSeatId },
                        { type: "startChaserReveal" }
                    ]
                };
            }
            return {
                nextPhase: GamePhase.ChaserSelection,
                effects: [{ type: "startChaserSelection" }]
            };
        }

        case "chaserSelectionComplete": {
            // Only reached by vote mode (random mode resolves in startGame above).
            // A vote already tells everyone who the Chaser is, so skip the wheel
            // and go straight to the roles reveal (ticket 054).
            ensurePhase(event, context, GamePhase.ChaserSelection);
            const first = context.contestantsOrder.find(
                (seatId) => seatId !== event.chaserSeatId
            );
            if (first === undefined) {
                throw new Error("gameFlow: chaserSelectionComplete requires at least one contestant");
            }
            return {
                nextPhase: GamePhase.RolesReveal,
                effects: [
                    { type: "assignChaser", seatId: event.chaserSeatId },
                    { type: "startRolesReveal" }
                ]
            };
        }

        case "chaserRevealComplete": {
            ensurePhase(event, context, GamePhase.ChaserReveal);
            return {
                nextPhase: GamePhase.RolesReveal,
                effects: [{ type: "startRolesReveal" }]
            };
        }

        case "revealAllReady": {
            ensurePhase(event, context, GamePhase.RolesReveal);
            const first = context.contestantsOrder[0];
            if (first === undefined) {
                throw new Error("gameFlow: revealAllReady requires at least one contestant");
            }
            return {
                nextPhase: GamePhase.Lineup,
                effects: [{ type: "startLineup" }]
            };
        }

        case "lineupComplete": {
            ensurePhase(event, context, GamePhase.Lineup);
            const first = context.contestantsOrder[0];
            if (first === undefined) {
                throw new Error("gameFlow: lineupComplete requires at least one contestant");
            }
            return {
                nextPhase: GamePhase.CashBuilder,
                effects: [{ type: "startReadyCooldown", seatId: first, round: context.activeRound + 1 }]
            };
        }

        case "readyCooldownDone": {
            ensurePhase(event, context, GamePhase.CashBuilder);
            return {
                nextPhase: GamePhase.CashBuilder,
                effects: [{ type: "startCashBuilder", seatId: context.activeContestantSeatId, round: context.activeRound }]
            };
        }

        case "cashBuilderTimeout": {
            ensurePhase(event, context, GamePhase.CashBuilder);
            return {
                nextPhase: GamePhase.Offer,
                effects: [{ type: "startOffer", seatId: context.activeContestantSeatId }]
            };
        }

        case "chaserOffersSet": {
            ensurePhase(event, context, GamePhase.Offer);
            return {
                nextPhase: GamePhase.Offer,
                effects: [{
                    type: "chaserOffersSet",
                    seatId: context.activeContestantSeatId,
                    low: event.low,
                    high: event.high
                }]
            };
        }

        case "contestantChoice": {
            ensurePhase(event, context, GamePhase.Offer);
            return {
                nextPhase: GamePhase.Chase,
                effects: [{
                    type: "startChase",
                    seatId: context.activeContestantSeatId,
                    contestantStartSpace: contestantStartSpace(event.offer),
                    chaserStartSpace: BOARD.chaserStartOffboard
                }]
            };
        }

        case "chaseEscape":
        case "chaseCaught": {
            ensurePhase(event, context, GamePhase.Chase);
            const seatId = context.activeContestantSeatId;
            const effects: FlowEffect[] = [];
            if (event.type === "chaseEscape") {
                effects.push({ type: "addToTeamPot", seatId, amount: context.currentOfferAmount });
            } else {
                effects.push({ type: "eliminateContestant", seatId });
            }

            const next = nextContestant(context, seatId);
            if (next !== undefined) {
                effects.push({ type: "startCashBuilder", seatId: next, round: context.activeRound + 1 });
                return { nextPhase: GamePhase.CashBuilder, effects };
            }

            effects.push({ type: "startFinalTeam" });
            return { nextPhase: GamePhase.TeamFinal, effects };
        }

        /**
         * The active contestant's connection dropped mid-round (reload = forfeit
         * the seat, per AGENTS.md). Treat it as caught: eliminate the seat,
         * pay nothing, and move to the next contestant — or the team final if
         * this was the last one.
         */
        case "contestantForfeit": {
            if (
                context.currentPhase !== GamePhase.CashBuilder &&
                context.currentPhase !== GamePhase.Offer &&
                context.currentPhase !== GamePhase.Chase
            ) {
                throw new Error(
                    `gameFlow: contestantForfeit is not valid in phase ${context.currentPhase}` +
                    " (expected cashBuilder, offer, or chase)"
                );
            }
            const seatId = context.activeContestantSeatId;
            const effects: FlowEffect[] = [{ type: "eliminateContestant", seatId }];
            const next = nextContestant(context, seatId);
            if (next !== undefined) {
                effects.push({ type: "startCashBuilder", seatId: next, round: context.activeRound + 1 });
                return { nextPhase: GamePhase.CashBuilder, effects };
            }
            effects.push({ type: "startFinalTeam" });
            return { nextPhase: GamePhase.TeamFinal, effects };
        }

        case "finalTeamTimeout": {
            ensurePhase(event, context, GamePhase.TeamFinal);
            return {
                nextPhase: GamePhase.ChaserFinal,
                effects: [{ type: "startFinalChaser" }]
            };
        }

        case "finalChaserReachedScore": {
            ensurePhase(event, context, GamePhase.ChaserFinal);
            return {
                nextPhase: GamePhase.GameEnd,
                effects: [{ type: "endGame", winner: "chaser" }]
            };
        }

        case "finalChaserTimeout": {
            ensurePhase(event, context, GamePhase.ChaserFinal);
            return {
                nextPhase: GamePhase.GameEnd,
                effects: [{ type: "endGame", winner: "team" }]
            };
        }
    }
}