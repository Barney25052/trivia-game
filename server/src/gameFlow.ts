import { BOARD } from "./gameConfig.js";
import { GamePhase } from "./TriviaTypes.js";

export type OfferTier = "low" | "middle" | "high";

export type FlowEvent =
    | { type: "startGame" }
    | { type: "cashBuilderTimeout" }
    | { type: "contestantChoice"; offer: OfferTier }
    | { type: "chaseEscape" }
    | { type: "chaseCaught" }
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
    activeContestantSessionId: string;
    activeRound: number;
    currentOfferAmount: number;
}

/**
 * Side-effects the room must apply when a transition is taken. gameFlow stays
 * pure: it only describes what must happen; the room decides how to apply it.
 */
export type FlowEffect =
    | { type: "startCashBuilder"; sessionId: string; round: number }
    | { type: "startOffer"; sessionId: string }
    | { type: "startChase"; sessionId: string; contestantStartSpace: number; chaserStartSpace: number }
    | { type: "eliminateContestant"; sessionId: string }
    | { type: "addToTeamPot"; sessionId: string; amount: number }
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

function nextContestant(context: GameFlowContext, sessionId: string): string | undefined {
    const index = context.contestantsOrder.indexOf(sessionId);
    if (index < 0 || index === context.contestantsOrder.length - 1) {
        return undefined;
    }
    return context.contestantsOrder[index + 1];
}

export function transition(event: FlowEvent, context: GameFlowContext): GameFlowResult {
    switch (event.type) {
        case "startGame": {
            ensurePhase(event, context, GamePhase.Lobby);
            const first = context.contestantsOrder[0];
            if (first === undefined) {
                throw new Error("gameFlow: startGame requires at least one contestant");
            }
            return {
                nextPhase: GamePhase.CashBuilder,
                effects: [{ type: "startCashBuilder", sessionId: first, round: 1 }]
            };
        }

        case "cashBuilderTimeout": {
            ensurePhase(event, context, GamePhase.CashBuilder);
            return {
                nextPhase: GamePhase.Offer,
                effects: [{ type: "startOffer", sessionId: context.activeContestantSessionId }]
            };
        }

        case "contestantChoice": {
            ensurePhase(event, context, GamePhase.Offer);
            return {
                nextPhase: GamePhase.Chase,
                effects: [{
                    type: "startChase",
                    sessionId: context.activeContestantSessionId,
                    contestantStartSpace: contestantStartSpace(event.offer),
                    chaserStartSpace: BOARD.chaserStartOffboard
                }]
            };
        }

        case "chaseEscape":
        case "chaseCaught": {
            ensurePhase(event, context, GamePhase.Chase);
            const sessionId = context.activeContestantSessionId;
            const effects: FlowEffect[] = [];
            if (event.type === "chaseEscape") {
                effects.push({ type: "addToTeamPot", sessionId, amount: context.currentOfferAmount });
            } else {
                effects.push({ type: "eliminateContestant", sessionId });
            }

            const next = nextContestant(context, sessionId);
            if (next !== undefined) {
                effects.push({ type: "startCashBuilder", sessionId: next, round: context.activeRound + 1 });
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