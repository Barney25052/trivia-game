import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

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
        revealReadyCooldownMs: 80,
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
        const offerPromise = bob.waitForMessage("offer");
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

        const offerPromise = bob.waitForMessage("offer");
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

        const offerPromise = alice.waitForMessage("offer");
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
});