import assert from "assert";
import { transition, GameFlowContext, FlowEvent } from "../src/gameFlow.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { BOARD } from "../src/gameConfig.js";

function context(overrides: Partial<GameFlowContext> = {}): GameFlowContext {
    return {
        currentPhase: GamePhase.Lobby,
        contestantsOrder: ["alice", "bob", "carol"],
        activeContestantSessionId: "alice",
        activeRound: 1,
        currentOfferAmount: 2000,
        ...overrides
    };
}

describe("gameFlow transition", () => {
    describe("startGame", () => {
        it("lobby + startGame -> cashBuilder for the first contestant at round 1", () => {
            const result = transition({ type: "startGame" }, context());
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "startCashBuilder", sessionId: "alice", round: 1 }
            ]);
        });

        it("throws if no contestants are in the room", () => {
            const ctx = context({ contestantsOrder: [] });
            assert.throws(() => transition({ type: "startGame" }, ctx), /at least one contestant/);
        });

        it("throws if not in lobby", () => {
            const ctx = context({ currentPhase: GamePhase.Offer });
            assert.throws(() => transition({ type: "startGame" }, ctx), /startGame is not valid in phase offer/);
        });
    });

    describe("cashBuilderTimeout", () => {
        it("cashBuilder + timeout -> offer for the active contestant", () => {
            const ctx = context({ currentPhase: GamePhase.CashBuilder, activeContestantSessionId: "bob" });
            const result = transition({ type: "cashBuilderTimeout" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.Offer);
            assert.deepStrictEqual(result.effects, [{ type: "startOffer", sessionId: "bob" }]);
        });

        it("throws if not in cashBuilder", () => {
            assert.throws(
                () => transition({ type: "cashBuilderTimeout" }, context()),
                /cashBuilderTimeout is not valid in phase lobby/
            );
        });
    });

    describe("contestantChoice", () => {
        it("low offer starts the contestant on BOARD.startLow", () => {
            const result = transition(
                { type: "contestantChoice", offer: "low" },
                context({ currentPhase: GamePhase.Offer })
            );
            assert.strictEqual(result.nextPhase, GamePhase.Chase);
            assert.deepStrictEqual(result.effects, [{
                type: "startChase",
                sessionId: "alice",
                contestantStartSpace: BOARD.startLow,
                chaserStartSpace: BOARD.chaserStartOffboard
            }]);
        });

        it("middle offer starts the contestant on BOARD.startMiddle", () => {
            const result = transition(
                { type: "contestantChoice", offer: "middle" },
                context({ currentPhase: GamePhase.Offer })
            );
            assert.strictEqual(result.effects[0].contestantStartSpace, BOARD.startMiddle);
        });

        it("high offer starts the contestant on BOARD.startHigh", () => {
            const result = transition(
                { type: "contestantChoice", offer: "high" },
                context({ currentPhase: GamePhase.Offer })
            );
            assert.strictEqual(result.effects[0].contestantStartSpace, BOARD.startHigh);
        });

        it("throws if not in offer", () => {
            assert.throws(
                () => transition({ type: "contestantChoice", offer: "high" }, context({ currentPhase: GamePhase.Chase })),
                /contestantChoice is not valid in phase chase/
            );
        });
    });

    describe("chase escape", () => {
        it("escape with contestants left -> next contestant's cashBuilder, adds offer to team pot", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSessionId: "alice", activeRound: 1, currentOfferAmount: 3000 });
            const result = transition({ type: "chaseEscape" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "addToTeamPot", sessionId: "alice", amount: 3000 },
                { type: "startCashBuilder", sessionId: "bob", round: 2 }
            ]);
        });

        it("escape by the last contestant -> finalTeam", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSessionId: "carol", activeRound: 3, currentOfferAmount: 5000 });
            const result = transition({ type: "chaseEscape" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.TeamFinal);
            assert.deepStrictEqual(result.effects, [
                { type: "addToTeamPot", sessionId: "carol", amount: 5000 },
                { type: "startFinalTeam" }
            ]);
        });
    });

    describe("chase caught", () => {
        it("caught with contestants left -> next contestant's cashBuilder, contestant eliminated", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSessionId: "bob", activeRound: 2 });
            const result = transition({ type: "chaseCaught" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", sessionId: "bob" },
                { type: "startCashBuilder", sessionId: "carol", round: 3 }
            ]);
        });

        it("caught by the last contestant -> finalTeam, contestant eliminated", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSessionId: "carol", activeRound: 3 });
            const result = transition({ type: "chaseCaught" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.TeamFinal);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", sessionId: "carol" },
                { type: "startFinalTeam" }
            ]);
        });

        it("throws if not in chase", () => {
            assert.throws(
                () => transition({ type: "chaseCaught" }, context({ currentPhase: GamePhase.CashBuilder })),
                /chaseCaught is not valid in phase cashBuilder/
            );
        });
    });

    describe("final round", () => {
        it("finalTeam + timeout -> finalChaser", () => {
            const ctx = context({ currentPhase: GamePhase.TeamFinal });
            const result = transition({ type: "finalTeamTimeout" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.ChaserFinal);
            assert.deepStrictEqual(result.effects, [{ type: "startFinalChaser" }]);
        });

        it("finalChaser + reachedScore -> gameEnd, chaser wins", () => {
            const ctx = context({ currentPhase: GamePhase.ChaserFinal });
            const result = transition({ type: "finalChaserReachedScore" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.GameEnd);
            assert.deepStrictEqual(result.effects, [{ type: "endGame", winner: "chaser" }]);
        });

        it("finalChaser + timeout -> gameEnd, team wins", () => {
            const ctx = context({ currentPhase: GamePhase.ChaserFinal });
            const result = transition({ type: "finalChaserTimeout" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.GameEnd);
            assert.deepStrictEqual(result.effects, [{ type: "endGame", winner: "team" }]);
        });

        it("throws on final round events outside their phases", () => {
            assert.throws(
                () => transition({ type: "finalTeamTimeout" }, context({ currentPhase: GamePhase.ChaserFinal })),
                /finalTeamTimeout is not valid in phase finalChaser/
            );
            assert.throws(
                () => transition({ type: "finalChaserReachedScore" }, context({ currentPhase: GamePhase.TeamFinal })),
                /finalChaserReachedScore is not valid in phase finalTeam/
            );
            assert.throws(
                () => transition({ type: "finalChaserTimeout" }, context({ currentPhase: GamePhase.TeamFinal })),
                /finalChaserTimeout is not valid in phase finalTeam/
            );
        });
    });

    describe("full multi-contestant game", () => {
        it("walks three contestants through cashBuilder/offer/chase into the team final and both end states", () => {
            const events: FlowEvent[] = [
                { type: "startGame" },
                { type: "cashBuilderTimeout" },
                { type: "contestantChoice", offer: "high" },
                { type: "chaseEscape" },           // alice makes it back
                { type: "cashBuilderTimeout" },
                { type: "contestantChoice", offer: "middle" },
                { type: "chaseCaught" },           // bob is out
                { type: "cashBuilderTimeout" },
                { type: "contestantChoice", offer: "low" },
                { type: "chaseEscape" }            // carol makes it back -> finalTeam
            ];

            let ctx: GameFlowContext = context();
            const phases: GamePhase[] = [];

            for (const event of events) {
                const result = transition(event, ctx);
                phases.push(result.nextPhase);

                const start = result.effects.find((effect) => effect.type === "startCashBuilder");
                ctx = start
                    ? { ...ctx, currentPhase: result.nextPhase, activeContestantSessionId: start.sessionId, activeRound: start.round }
                    : { ...ctx, currentPhase: result.nextPhase };
            }

            assert.deepStrictEqual(phases, [
                GamePhase.CashBuilder,
                GamePhase.Offer,
                GamePhase.Chase,
                GamePhase.CashBuilder,
                GamePhase.Offer,
                GamePhase.Chase,
                GamePhase.CashBuilder,
                GamePhase.Offer,
                GamePhase.Chase,
                GamePhase.TeamFinal
            ]);
            assert.strictEqual(ctx.activeContestantSessionId, "carol");
            assert.strictEqual(ctx.activeRound, 3);
        });

        it("reaches both end states from the final", () => {
            const inTeamFinal: GameFlowContext = context({ currentPhase: GamePhase.TeamFinal });
            const chaser = transition({ type: "finalTeamTimeout" }, inTeamFinal);
            assert.strictEqual(chaser.nextPhase, GamePhase.ChaserFinal);

            const chaserWins = transition(
                { type: "finalChaserReachedScore" },
                { ...inTeamFinal, currentPhase: GamePhase.ChaserFinal }
            );
            assert.strictEqual(chaserWins.nextPhase, GamePhase.GameEnd);
            assert.deepStrictEqual(chaserWins.effects, [{ type: "endGame", winner: "chaser" }]);

            const teamWins = transition(
                { type: "finalChaserTimeout" },
                { ...inTeamFinal, currentPhase: GamePhase.ChaserFinal }
            );
            assert.strictEqual(teamWins.nextPhase, GamePhase.GameEnd);
            assert.deepStrictEqual(teamWins.effects, [{ type: "endGame", winner: "team" }]);
        });
    });
});