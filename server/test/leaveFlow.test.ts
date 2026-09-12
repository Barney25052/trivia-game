import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

/** A stub `McQuestionSource` mirroring chaseFlow.test.ts — every question
 * carries one fixed correct answer at a known text. */
function stubChaseSource() {
    let counter = 0;
    return {
        async getQuestions(amount: number) {
            const out = [];
            for (let i = 0; i < amount; i += 1) {
                counter += 1;
                out.push({
                    id: `stub-chase-${counter}`,
                    question: `Stub chase question ${counter}?`,
                    category: "Stub",
                    options: ["Correct Answer", "Wrong A", "Wrong B", "Wrong C"],
                    correctIndex: 0
                });
            }
            return out;
        }
    };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPhase = async (
    room: { state: { currentPhase: GamePhase } },
    phase: GamePhase,
    timeoutMs = 2000
): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (room.state.currentPhase === phase) {
            return;
        }
        await sleep(20);
    }
    assert.fail(`timed out waiting for phase ${phase}; got ${room.state.currentPhase}`);
};

const waitForActive = async (
    room: any,
    seatId: string,
    timeoutMs = 2000
): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (room.state.activeContestantSeatId === seatId) {
            return;
        }
        await sleep(20);
    }
    assert.fail(
        `timed out waiting for active ${seatId}; active is ${room.state.activeContestantSeatId}`
    );
};

/**
 * Deterministic room: Carol (first joiner = host) is voted in as the Chaser during
 * a vote-mode selection, so the contestantsOrder is [Alice, Bob] and Alice is the
 * first active contestant. Returns the room sitting in RolesReveal.
 */
async function createForfeitRoom(
    colyseus: ColyseusTestServer<typeof appConfig>
): Promise<{ room: any; alice: any; bob: any; carol: any }> {
    const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 200,
        chaserSelectionDurationMs: 10000,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalDurationMs: 80
    });
    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    carol.send("setChaserMode", { mode: "vote" });
    await sleep(30);
    carol.send("startGame");
    await sleep(50);
    alice.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await sleep(30);
    bob.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await sleep(30);
    carol.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await waitForPhase(room, GamePhase.RolesReveal);

    assert.strictEqual(room.state.players.get(seatIdOf(room, carol)).isHost, true);
    assert.strictEqual(room.state.chaserSeatId, seatIdOf(room, carol));
    assert.deepStrictEqual(
        [...room.state.contestantsOrder],
        [seatIdOf(room, alice), seatIdOf(room, bob)]
    );
    return { room, alice, bob, carol };
}

describe("leaveFlow (integration)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("active contestant leaves during cashBuilder: round forfeited as caught, next contestant's round runs, no timers for the departed seat", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);

        const aliceSeat = seatIdOf(room, alice);
        alice.send("revealReady");
        bob.send("revealReady");
        carol.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.CashBuilder);
        await waitForActive(room, seatIdOf(room, alice));
        assert.strictEqual(room.state.activeRound, 1);

        alice.leave();
        await waitForActive(room, seatIdOf(room, bob));
        assert.strictEqual(
            room.state.activeRound,
            2,
            "forfeit advances to the next contestant's round"
        );
        assert.strictEqual(
            room.state.players.get(aliceSeat),
            undefined,
            "the departed seat is removed from the players map"
        );
        assert.strictEqual(
            room.state.teamPot,
            0,
            "a forfeit pays no offer into the team pot"
        );

        // Nothing keeps firing for the departed seat: Bob's own round still
        // completes and reaches the offer.
        const offerPromise = bob.waitForMessage("offerStart");
        await waitForPhase(room, GamePhase.Offer);
        const offer = await offerPromise;
        assert.strictEqual(offer.seatId, seatIdOf(room, bob));
    });

    it("active contestant leaves during offer: same forfeit, next contestant's offer still comes", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);

        const aliceSeat = seatIdOf(room, alice);
        alice.send("revealReady");
        bob.send("revealReady");
        carol.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.Offer);
        await waitForActive(room, seatIdOf(room, alice));

        alice.leave();
        await waitForActive(room, seatIdOf(room, bob));
        assert.strictEqual(room.state.activeRound, 2);
        assert.strictEqual(room.state.players.get(aliceSeat), undefined);
        assert.strictEqual(room.state.teamPot, 0, "a forfeited offer pays nothing");

        const offerPromise = bob.waitForMessage("offerStart");
        await waitForPhase(room, GamePhase.Offer);
        const offer = await offerPromise;
        assert.strictEqual(offer.seatId, seatIdOf(room, bob));
    });

    it("questionManager and messageTimes hold no state for the departed seat", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);

        const aliceSeat = seatIdOf(room, alice);
        alice.send("revealReady");
        bob.send("revealReady");
        carol.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.CashBuilder);
        await waitForActive(room, seatIdOf(room, alice));

        alice.leave();
        await waitForActive(room, seatIdOf(room, bob));

        assert.strictEqual(
            room.questionManager.getCurrentQuestion(aliceSeat),
            undefined,
            "no current question is retained for the departed seat"
        );
        assert.strictEqual(
            (room.questionManager as any).usedIds.has(aliceSeat),
            false,
            "the departed seat's draw history is discarded"
        );
        assert.strictEqual(
            (room as any).messageTimes.has(alice.sessionId),
            false,
            "the rate-limit tracker entry is removed on leave"
        );
    });

    it("a non-active contestant leaving mid-round does not disturb the active contestant", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);

        const bobSeat = seatIdOf(room, bob);
        alice.send("revealReady");
        bob.send("revealReady");
        carol.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.CashBuilder);
        await waitForActive(room, seatIdOf(room, alice));

        const offerPromise = alice.waitForMessage("offerStart");
        bob.leave();
        await sleep(100);

        assert.strictEqual(
            room.state.activeContestantSeatId,
            seatIdOf(room, alice),
            "leaving a waiting contestant must not change the active contestant"
        );
        assert.strictEqual(
            room.state.players.get(bobSeat),
            undefined,
            "the departed waiting contestant is removed"
        );
        assert.strictEqual(room.state.contestantsOrder.length, 1);

        // Alice's round is unaffected and still completes.
        await waitForPhase(room, GamePhase.Offer);
        const offer = await offerPromise;
        assert.strictEqual(offer.seatId, seatIdOf(room, alice));
    });

    it("roles reveal recovers when the last unready player leaves: remaining ready players advance", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);

        alice.send("revealReady");
        carol.send("revealReady", { characterId: "bezos" });
        bob.leave();
        await waitForPhase(room, GamePhase.CashBuilder);

        assert.strictEqual(
            room.state.activeContestantSeatId,
            seatIdOf(room, alice),
            "the ready gate must not wait forever on a departed seat"
        );
        assert.strictEqual(room.state.activeRound, 1);
    });

    it("roles reveal does not advance while a remaining player is still unready", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);

        const bobSeat = seatIdOf(room, bob);
        alice.send("revealReady");
        bob.leave();
        await sleep(100);

        assert.strictEqual(
            room.state.currentPhase,
            GamePhase.RolesReveal,
            "a leave must not skip past players who are still unready"
        );
        assert.strictEqual(room.state.players.get(bobSeat), undefined);

        carol.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.CashBuilder);
        assert.strictEqual(room.state.activeContestantSeatId, seatIdOf(room, alice));
    });

    it("vote-mode chaser selection still resolves when a voter leaves before casting a vote", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 200,
            chaserSelectionDurationMs: 300,
            chaserRevealDurationMs: 80
        });
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        const carol = await colyseus.connectTo(room, { playerName: "Carol" });
        await sleep(100);

        const carolSeat = seatIdOf(room, carol);
        const aliceSeat = seatIdOf(room, alice);
        alice.send("setChaserMode", { mode: "vote" });
        await sleep(30);
        alice.send("startGame");
        await waitForPhase(room, GamePhase.ChaserSelection);

        alice.send("chaserVote", { targetSeatId: seatIdOf(room, bob) });
        await sleep(30);
        bob.send("chaserVote", { targetSeatId: aliceSeat });
        carol.leave();
        await sleep(100);

        assert.ok(
            ![...room.state.players.keys()].includes(carolSeat),
            "the departed voter is removed before the selection resolves"
        );
        await waitForPhase(room, GamePhase.RolesReveal);
        assert.ok(
            room.state.chaserSeatId === aliceSeat || room.state.chaserSeatId === seatIdOf(room, bob),
            "the chaser resolves among the remaining players once the selection timer fires"
        );
    });

    it("active contestant leaves during Chase: forfeited as caught, next contestant's round runs, no timers for the departed seat (ticket 076)", async () => {
        const { room, alice, bob, carol } = await createForfeitRoom(colyseus);
        room.mcQuestionSource = stubChaseSource();

        const aliceSeat = seatIdOf(room, alice);
        alice.send("revealReady");
        bob.send("revealReady");
        carol.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.Offer);
        await waitForActive(room, seatIdOf(room, alice));

        carol.send("setChaserLowOffer", { amount: 0 });
        await sleep(30);
        carol.send("setChaserHighOffer", { amount: 2000 });
        await sleep(30);

        const questionMessage = alice.waitForMessage("question");
        alice.send("offerChoice", { offer: "high" });
        await questionMessage;
        await waitForPhase(room, GamePhase.Chase);

        alice.leave();
        await waitForActive(room, seatIdOf(room, bob));
        assert.strictEqual(
            room.state.activeRound,
            2,
            "forfeit advances to the next contestant's round"
        );
        assert.strictEqual(
            room.state.players.get(aliceSeat),
            undefined,
            "the departed seat is removed from the players map"
        );
        assert.strictEqual(
            room.state.chaserPot > 0,
            true,
            "a caught contestant grows the chaser pot"
        );
        assert.strictEqual(
            room.questionManager.getCurrentQuestion(aliceSeat),
            undefined,
            "no current question is retained for the departed seat"
        );

        // Bob's own round still completes and reaches the offer — nothing keeps
        // firing for the departed seat.
        const offerPromise = bob.waitForMessage("offerStart");
        await waitForPhase(room, GamePhase.Offer);
        const offer = await offerPromise;
        assert.strictEqual(offer.seatId, seatIdOf(room, bob));
    });

    /**
     * A non-host Chaser: Dave joins first (host) and stays a contestant; Alice
     * is voted in as the Chaser. This isolates the chaser-forfeit path (ticket
     * 075) from the pre-existing host-leave-disconnects path (they're the same
     * player in createForfeitRoom above).
     */
    async function createNonHostChaserRoom(
        colyseus: ColyseusTestServer<typeof appConfig>
    ): Promise<{ room: any; dave: any; alice: any; bob: any }> {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 200,
            chaserSelectionDurationMs: 10000,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80,
            teamFinalDurationMs: 200
        });
        const dave = await colyseus.connectTo(room, { playerName: "Dave" });
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);

        dave.send("setChaserMode", { mode: "vote" });
        await sleep(30);
        dave.send("startGame");
        await sleep(50);
        const aliceSeat = seatIdOf(room, alice);
        dave.send("chaserVote", { targetSeatId: aliceSeat });
        await sleep(30);
        alice.send("chaserVote", { targetSeatId: aliceSeat });
        await sleep(30);
        bob.send("chaserVote", { targetSeatId: aliceSeat });
        await waitForPhase(room, GamePhase.RolesReveal);

        assert.strictEqual(room.state.players.get(seatIdOf(room, dave)).isHost, true);
        assert.strictEqual(room.state.chaserSeatId, aliceSeat);
        assert.deepStrictEqual(
            [...room.state.contestantsOrder],
            [seatIdOf(room, dave), seatIdOf(room, bob)]
        );
        return { room, dave, alice, bob };
    }

    it("the Chaser leaving during Chase resolves to gameEnd with the team winning by default (ticket 075, bug-010)", async () => {
        const { room, dave, alice, bob } = await createNonHostChaserRoom(colyseus);
        room.mcQuestionSource = stubChaseSource();

        dave.send("revealReady");
        bob.send("revealReady");
        alice.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.Offer);
        await waitForActive(room, seatIdOf(room, dave));

        alice.send("setChaserLowOffer", { amount: 0 });
        await sleep(30);
        alice.send("setChaserHighOffer", { amount: 2000 });
        await sleep(30);

        const questionMessage = dave.waitForMessage("question");
        dave.send("offerChoice", { offer: "high" });
        await questionMessage;
        await waitForPhase(room, GamePhase.Chase);

        const aliceSeat = seatIdOf(room, alice);
        const endGameMessage = dave.waitForMessage("endGame");
        alice.leave();
        const endGame = await endGameMessage;

        assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd, "the room must not stall waiting for the departed Chaser");
        assert.strictEqual(endGame.winner, "team", "the team wins by default when the Chaser disconnects mid-game");
        assert.strictEqual(room.state.players.get(aliceSeat), undefined);
    });

    it("the Chaser leaving during TeamFinal resolves to gameEnd with the team winning by default (ticket 075, bug-010)", async () => {
        const { room, dave, alice, bob } = await createNonHostChaserRoom(colyseus);
        room.mcQuestionSource = stubChaseSource();

        dave.send("revealReady");
        bob.send("revealReady");
        alice.send("revealReady", { characterId: "bezos" });
        await waitForPhase(room, GamePhase.Offer);
        await waitForActive(room, seatIdOf(room, dave));

        alice.send("setChaserLowOffer", { amount: 2000 });
        await sleep(30);
        alice.send("setChaserHighOffer", { amount: 4000 });
        await sleep(30);

        const escapeQuestionMessage = dave.waitForMessage("question");
        dave.send("offerChoice", { offer: "low" });
        const escapeQuestion = await escapeQuestionMessage;

        // Play Dave straight to escape as the first contestant so the round
        // continues to Bob's cash builder, then repeat to reach TeamFinal.
        let question = escapeQuestion;
        for (let round = 0; round < 6 && room.state.currentPhase === GamePhase.Chase; round += 1) {
            const correctIndex = question.options.indexOf("Correct Answer");
            const nextQuestionOrPhase = Promise.race([
                dave.waitForMessage("question").then((q: any) => ({ q })),
                (async () => {
                    while (room.state.currentPhase === GamePhase.Chase) {
                        await sleep(10);
                    }
                    return { q: null };
                })()
            ]);
            dave.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
            alice.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: (correctIndex + 1) % question.options.length });
            const { q } = await nextQuestionOrPhase;
            question = q;
        }

        // Bob still needs to run his own round to reach TeamFinal.
        await waitForActive(room, seatIdOf(room, bob));
        room.state.players.get(seatIdOf(room, bob)).cashBuilderMoney = 0;
        await waitForPhase(room, GamePhase.Offer);
        alice.send("setChaserLowOffer", { amount: 0 });
        await sleep(30);
        alice.send("setChaserHighOffer", { amount: 1000 });
        await sleep(30);
        const bobQuestionMessage = bob.waitForMessage("question");
        bob.send("offerChoice", { offer: "middle" });
        let bobQuestion = await bobQuestionMessage;
        for (let round = 0; round < 6 && room.state.currentPhase === GamePhase.Chase; round += 1) {
            const nextQuestionOrPhase = Promise.race([
                bob.waitForMessage("question").then((q: any) => ({ q })),
                (async () => {
                    while (room.state.currentPhase === GamePhase.Chase) {
                        await sleep(10);
                    }
                    return { q: null };
                })()
            ]);
            const bobCorrectIndex = bobQuestion.options.indexOf("Correct Answer");
            bob.send("submitChaseAnswer", { questionId: bobQuestion.questionId, answerIndex: bobCorrectIndex });
            alice.send("submitChaseAnswer", { questionId: bobQuestion.questionId, answerIndex: (bobCorrectIndex + 1) % bobQuestion.options.length });
            const { q } = await nextQuestionOrPhase;
            bobQuestion = q;
        }
        await waitForPhase(room, GamePhase.TeamFinal);

        const aliceSeat = seatIdOf(room, alice);
        const endGameMessage = dave.waitForMessage("endGame");
        alice.leave();
        const endGame = await endGameMessage;

        assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
        assert.strictEqual(endGame.winner, "team");
        assert.strictEqual(room.state.players.get(aliceSeat), undefined);
    });

    it("a host-Chaser leaving still disconnects the room (close 6767), unchanged from before ticket 075", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 10000,
            chaserSelectionDurationMs: 10000,
            chaserRevealDurationMs: 80,
            revealReadyCooldownMs: 80
        });
        const carol = await colyseus.connectTo(room, { playerName: "Carol" });
        const alice = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);

        carol.send("setChaserMode", { mode: "vote" });
        await sleep(30);
        carol.send("startGame");
        await sleep(50);
        carol.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
        await sleep(30);
        alice.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
        await waitForPhase(room, GamePhase.RolesReveal);
        assert.strictEqual(room.state.chaserSeatId, seatIdOf(room, carol));

        carol.leave();
        await sleep(150);
        assert.strictEqual(room.state.currentPhase, GamePhase.RolesReveal, "a disconnecting room does not advance the flow");
    });

    it("last contestant leaves during lineup: away from Lineup and into GameEnd instead of stalling (bug-004, ticket 061)", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 200,
            chaserSelectionDurationMs: 10000,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 400,
            teamFinalDurationMs: 80
        });
        const carol = await colyseus.connectTo(room, { playerName: "Carol" });
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        await sleep(100);

        // Deterministic setup: vote the host (Carol) in as the Chaser, leaving
        // Alice as the lone contestant in the turn order.
        carol.send("setChaserMode", { mode: "vote" });
        await sleep(30);
        carol.send("startGame");
        await sleep(50);
        carol.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
        await sleep(30);
        alice.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
        await waitForPhase(room, GamePhase.RolesReveal);
        assert.strictEqual(room.state.chaserSeatId, seatIdOf(room, carol));
        assert.deepStrictEqual([...room.state.contestantsOrder], [seatIdOf(room, alice)]);

        const aliceSeat = seatIdOf(room, alice);
        const endGameMessage = carol.waitForMessage("endGame");
        carol.send("revealReady", { characterId: "bezos" });
        alice.send("revealReady");
        await waitForPhase(room, GamePhase.Lineup);
        assert.strictEqual(room.state.contestantsOrder.length, 1);

        // The lone contestant forfeits during the hold...
        alice.leave();

        // ...and the room resolves forward instead of stalling in Lineup forever.
        const endGame = await endGameMessage;
        assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
        assert.strictEqual(endGame.winner, "chaser", "an abandoned team means the Chaser wins");
        assert.strictEqual(room.state.players.get(aliceSeat), undefined);
        assert.strictEqual(room.state.contestantsOrder.length, 0);

        // The pending lineup timer is cancelled — the room must not drift back or
        // throw once the would-be lineup duration expires.
        await sleep(room.lineupDurationMs + 150);
        assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
    });
});