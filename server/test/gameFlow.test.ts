import assert from "assert";
import { transition, GameFlowContext, FlowEvent } from "../src/gameFlow.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { BOARD } from "../src/gameConfig.js";

function context(overrides: Partial<GameFlowContext> = {}): GameFlowContext {
    return {
        currentPhase: GamePhase.Lobby,
        contestantsOrder: ["alice", "bob", "carol"],
        activeContestantSeatId: "alice",
        activeRound: 1,
        currentOfferAmount: 2000,
        chaserSelectionMode: "vote",
        ...overrides
    };
}

describe("gameFlow transition", () => {
    describe("startGame", () => {
        it("lobby + startGame -> chaserSelection", () => {
            const result = transition({ type: "startGame" }, context());
            assert.strictEqual(result.nextPhase, GamePhase.ChaserSelection);
            assert.deepStrictEqual(result.effects, [{ type: "startChaserSelection" }]);
        });

        it("throws if no contestants are in the room", () => {
            const ctx = context({ contestantsOrder: [] });
            assert.throws(() => transition({ type: "startGame" }, ctx), /at least one contestant/);
        });

        it("throws if not in lobby", () => {
            const ctx = context({ currentPhase: GamePhase.Offer });
            assert.throws(() => transition({ type: "startGame" }, ctx), /startGame is not valid in phase offer/);
        });

        it("random mode -> chaserReveal directly, chaser already assigned (ticket 054: no ChaserSelection hold)", () => {
            const ctx = context({ chaserSelectionMode: "random" });
            const result = transition({ type: "startGame" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.ChaserReveal);
            assert.strictEqual(result.effects.length, 2);
            assert.strictEqual(result.effects[1].type, "startChaserReveal");
            const assign = result.effects[0];
            assert.strictEqual(assign.type, "assignChaser");
            assert.ok(
                ctx.contestantsOrder.includes((assign as { seatId: string }).seatId),
                "the randomly-picked chaser is one of the contestants"
            );
        });

        it("random mode throws if fewer than two contestants are in the room", () => {
            const ctx = context({ chaserSelectionMode: "random", contestantsOrder: ["alice"] });
            assert.throws(
                () => transition({ type: "startGame" }, ctx),
                /at least one contestant besides the Chaser/
            );
        });
    });

    describe("chaserSelectionComplete", () => {
        it("chaserSelection + complete -> rolesReveal directly (vote mode skips the wheel, ticket 054), chaser assigned first", () => {
            const ctx = context({ currentPhase: GamePhase.ChaserSelection });
            const result = transition(
                { type: "chaserSelectionComplete", chaserSeatId: "carol" },
                ctx
            );
            assert.strictEqual(result.nextPhase, GamePhase.RolesReveal);
            assert.deepStrictEqual(result.effects, [
                { type: "assignChaser", seatId: "carol" },
                { type: "startRolesReveal" }
            ]);
            assert.ok(
                !result.effects.some((effect) => effect.type === "startCashBuilder"),
                "no cash-builder timer is scheduled during the roles reveal"
            );
        });

        it("skips a chaser at the front of contestantsOrder when picking the first contestant", () => {
            const ctx = context({ currentPhase: GamePhase.ChaserSelection });
            const result = transition(
                { type: "chaserSelectionComplete", chaserSeatId: "alice" },
                ctx
            );
            assert.deepStrictEqual(result.effects, [
                { type: "assignChaser", seatId: "alice" },
                { type: "startRolesReveal" }
            ]);
        });

        it("throws if no contestants remain after removing the chaser", () => {
            const ctx = context({ currentPhase: GamePhase.ChaserSelection, contestantsOrder: ["alice"] });
            assert.throws(
                () => transition({ type: "chaserSelectionComplete", chaserSeatId: "alice" }, ctx),
                /at least one contestant/
            );
        });

        it("throws if not in chaserSelection", () => {
            assert.throws(
                () => transition({ type: "chaserSelectionComplete", chaserSeatId: "alice" }, context()),
                /chaserSelectionComplete is not valid in phase lobby/
            );
        });
    });

    describe("chaserRevealComplete", () => {
        it("chaserReveal + complete -> rolesReveal for the reveal screen", () => {
            const ctx = context({ currentPhase: GamePhase.ChaserReveal });
            const result = transition({ type: "chaserRevealComplete" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.RolesReveal);
            assert.deepStrictEqual(result.effects, [{ type: "startRolesReveal" }]);
        });

        it("throws if not in chaserReveal", () => {
            assert.throws(
                () => transition({ type: "chaserRevealComplete" }, context()),
                /chaserRevealComplete is not valid in phase lobby/
            );
        });
    });

    describe("revealAllReady", () => {
        it("rolesReveal + all ready -> lineup, showing the turn order before the cash builder", () => {
            const ctx = context({ currentPhase: GamePhase.RolesReveal, activeRound: 0 });
            const result = transition({ type: "revealAllReady" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.Lineup);
            assert.deepStrictEqual(result.effects, [{ type: "startLineup" }]);
        });

        it("throws if there are no contestants", () => {
            const ctx = context({ currentPhase: GamePhase.RolesReveal, contestantsOrder: [] });
            assert.throws(
                () => transition({ type: "revealAllReady" }, ctx),
                /at least one contestant/
            );
        });

        it("throws if not in rolesReveal", () => {
            assert.throws(
                () => transition({ type: "revealAllReady" }, context()),
                /revealAllReady is not valid in phase lobby/
            );
        });
    });

    describe("lineupComplete", () => {
        it("lineup + complete -> cashBuilder, starting the ready cooldown for the first contestant", () => {
            const ctx = context({ currentPhase: GamePhase.Lineup, activeRound: 0 });
            const result = transition({ type: "lineupComplete" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "startReadyCooldown", seatId: "alice", round: 1 }
            ]);
        });

        it("throws if there are no contestants", () => {
            const ctx = context({ currentPhase: GamePhase.Lineup, contestantsOrder: [] });
            assert.throws(
                () => transition({ type: "lineupComplete" }, ctx),
                /at least one contestant/
            );
        });

        it("throws if not in lineup", () => {
            assert.throws(
                () => transition({ type: "lineupComplete" }, context()),
                /lineupComplete is not valid in phase lobby/
            );
        });
    });

    describe("readyCooldownDone", () => {
        it("cashBuilder + cooldown done -> cashBuilder, starting the cash builder for the active contestant", () => {
            const ctx = context({
                currentPhase: GamePhase.CashBuilder,
                activeContestantSeatId: "bob",
                activeRound: 1
            });
            const result = transition({ type: "readyCooldownDone" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "startCashBuilder", seatId: "bob", round: 1 }
            ]);
        });

        it("throws if not in cashBuilder", () => {
            assert.throws(
                () => transition({ type: "readyCooldownDone" }, context()),
                /readyCooldownDone is not valid in phase lobby/
            );
        });
    });

    describe("cashBuilderTimeout", () => {
        it("round 1: cashBuilder + timeout -> chaserCharacterReveal (the one-time reveal), not straight to offer", () => {
            const ctx = context({
                currentPhase: GamePhase.CashBuilder,
                activeContestantSeatId: "bob",
                activeRound: 1
            });
            const result = transition({ type: "cashBuilderTimeout" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.ChaserCharacterReveal);
            assert.deepStrictEqual(result.effects, [{ type: "startChaserCharacterReveal" }]);
        });

        it("round 2+: cashBuilder + timeout -> offer directly, no reveal replay", () => {
            const ctx = context({
                currentPhase: GamePhase.CashBuilder,
                activeContestantSeatId: "bob",
                activeRound: 2
            });
            const result = transition({ type: "cashBuilderTimeout" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.Offer);
            assert.deepStrictEqual(result.effects, [{ type: "startOffer", seatId: "bob" }]);
        });

        it("throws if not in cashBuilder", () => {
            assert.throws(
                () => transition({ type: "cashBuilderTimeout" }, context()),
                /cashBuilderTimeout is not valid in phase lobby/
            );
        });
    });

    describe("chaserCharacterRevealComplete", () => {
        it("chaserCharacterReveal + complete -> offer for the active contestant", () => {
            const ctx = context({
                currentPhase: GamePhase.ChaserCharacterReveal,
                activeContestantSeatId: "bob"
            });
            const result = transition({ type: "chaserCharacterRevealComplete" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.Offer);
            assert.deepStrictEqual(result.effects, [{ type: "startOffer", seatId: "bob" }]);
        });

        it("throws if not in chaserCharacterReveal", () => {
            assert.throws(
                () => transition({ type: "chaserCharacterRevealComplete" }, context()),
                /chaserCharacterRevealComplete is not valid in phase lobby/
            );
        });
    });

    describe("chaserOffersSet", () => {
        it("offer + chaserOffersSet -> stays in Offer, effect carries the accepted amounts", () => {
            const result = transition(
                { type: "chaserOffersSet", low: 0, high: 4000 },
                context({ currentPhase: GamePhase.Offer, activeContestantSeatId: "bob" })
            );
            assert.strictEqual(result.nextPhase, GamePhase.Offer);
            assert.deepStrictEqual(result.effects, [{
                type: "chaserOffersSet",
                seatId: "bob",
                low: 0,
                high: 4000
            }]);
        });

        it("throws if not in offer", () => {
            assert.throws(
                () => transition({ type: "chaserOffersSet", low: 0, high: 4000 }, context({ currentPhase: GamePhase.Chase })),
                /chaserOffersSet is not valid in phase chase/
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
                seatId: "alice",
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
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSeatId: "alice", activeRound: 1, currentOfferAmount: 3000 });
            const result = transition({ type: "chaseEscape" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "addToTeamPot", seatId: "alice", amount: 3000 },
                { type: "startCashBuilder", seatId: "bob", round: 2 }
            ]);
        });

        it("escape by the last contestant -> finalTeam", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSeatId: "carol", activeRound: 3, currentOfferAmount: 5000 });
            const result = transition({ type: "chaseEscape" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.TeamFinal);
            assert.deepStrictEqual(result.effects, [
                { type: "addToTeamPot", seatId: "carol", amount: 5000 },
                { type: "startFinalTeam" }
            ]);
        });
    });

    describe("chase caught", () => {
        it("caught with contestants left -> next contestant's cashBuilder, contestant eliminated", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSeatId: "bob", activeRound: 2 });
            const result = transition({ type: "chaseCaught" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", seatId: "bob" },
                { type: "startCashBuilder", seatId: "carol", round: 3 }
            ]);
        });

        it("caught by the last contestant -> finalTeam, contestant eliminated", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSeatId: "carol", activeRound: 3 });
            const result = transition({ type: "chaseCaught" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.TeamFinal);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", seatId: "carol" },
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

    describe("contestantForfeit", () => {
        it("forfeit during cashBuilder eliminates and moves to the next contestant's cashBuilder", () => {
            const ctx = context({ currentPhase: GamePhase.CashBuilder, activeContestantSeatId: "bob", activeRound: 2 });
            const result = transition({ type: "contestantForfeit" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", seatId: "bob" },
                { type: "startCashBuilder", seatId: "carol", round: 3 }
            ]);
        });

        it("forfeit during offer behaves the same as during chase: contestant eliminated, next contestant's cashBuilder", () => {
            const ctx = context({ currentPhase: GamePhase.Offer, activeContestantSeatId: "bob", activeRound: 2 });
            const result = transition({ type: "contestantForfeit" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.CashBuilder);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", seatId: "bob" },
                { type: "startCashBuilder", seatId: "carol", round: 3 }
            ]);
        });

        it("forfeit during chase behaves identically to chaseCaught (no pot paid)", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, activeContestantSeatId: "bob", activeRound: 2, currentOfferAmount: 5000 });
            const result = transition({ type: "contestantForfeit" }, ctx);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", seatId: "bob" },
                { type: "startCashBuilder", seatId: "carol", round: 3 }
            ]);
        });

        it("forfeit by the last contestant -> finalTeam", () => {
            const ctx = context({ currentPhase: GamePhase.Chase, contestantsOrder: ["carol"], activeContestantSeatId: "carol", activeRound: 3 });
            const result = transition({ type: "contestantForfeit" }, ctx);
            assert.strictEqual(result.nextPhase, GamePhase.TeamFinal);
            assert.deepStrictEqual(result.effects, [
                { type: "eliminateContestant", seatId: "carol" },
                { type: "startFinalTeam" }
            ]);
        });

        it("forfeit never includes addToTeamPot: no offer is paid", () => {
            const ctx = context({ currentPhase: GamePhase.Offer, activeContestantSeatId: "alice", activeRound: 1, currentOfferAmount: 10000 });
            const result = transition({ type: "contestantForfeit" }, ctx);
            assert.ok(
                !result.effects.some((e) => e.type === "addToTeamPot"),
                "forfeit must never pay the contestant's offer into the team pot"
            );
        });

        it("throws if not in cashBuilder, offer, or chase", () => {
            assert.throws(
                () => transition({ type: "contestantForfeit" }, context({ currentPhase: GamePhase.Lobby })),
                /contestantForfeit is not valid in phase lobby/
            );
            assert.throws(
                () => transition({ type: "contestantForfeit" }, context({ currentPhase: GamePhase.TeamFinal })),
                /contestantForfeit is not valid in phase finalTeam/
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
        it("walks three players through selection/reveal/cashBuilder/offer/chase into the team final and both end states", () => {
            const events: FlowEvent[] = [
                { type: "startGame" },
                { type: "chaserSelectionComplete", chaserSeatId: "bob" },
                { type: "revealAllReady" },
                { type: "lineupComplete" },
                { type: "readyCooldownDone" },
                { type: "cashBuilderTimeout" },       // round 1 -> chaserCharacterReveal (one-time)
                { type: "chaserCharacterRevealComplete" },
                { type: "contestantChoice", offer: "high" },
                { type: "chaseEscape" },           // alice makes it back
                { type: "cashBuilderTimeout" },
                { type: "contestantChoice", offer: "low" },
                { type: "chaseEscape" }            // carol makes it back -> finalTeam
            ];

            let ctx: GameFlowContext = context({ activeRound: 0 });
            const phases: GamePhase[] = [];

            for (const event of events) {
                const result = transition(event, ctx);
                phases.push(result.nextPhase);

                for (const effect of result.effects) {
                    if (effect.type === "assignChaser") {
                        ctx = {
                            ...ctx,
                            contestantsOrder: ctx.contestantsOrder.filter(
                                (seatId) => seatId !== effect.seatId
                            )
                        };
                    }
                    if (effect.type === "startReadyCooldown" || effect.type === "startCashBuilder") {
                        ctx = {
                            ...ctx,
                            activeContestantSeatId: effect.seatId,
                            activeRound: effect.round
                        };
                    }
                }
                ctx = { ...ctx, currentPhase: result.nextPhase };
            }

            assert.deepStrictEqual(phases, [
                GamePhase.ChaserSelection,
                GamePhase.RolesReveal,
                GamePhase.Lineup,       // the turn-order interstitial
                GamePhase.CashBuilder,   // ready cooldown, then...
                GamePhase.CashBuilder,    // ...the cash builder runs
                GamePhase.ChaserCharacterReveal, // round 1 only, before the first offer
                GamePhase.Offer,
                GamePhase.Chase,
                GamePhase.CashBuilder,
                GamePhase.Offer,          // round 2 -> straight to offer, no reveal replay
                GamePhase.Chase,
                GamePhase.TeamFinal
            ]);
            assert.strictEqual(ctx.activeContestantSeatId, "carol");
            assert.strictEqual(ctx.activeRound, 2);
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