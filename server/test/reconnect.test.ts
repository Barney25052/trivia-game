import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { ROOM_SETTINGS } from "../src/gameConfig.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (check: () => boolean, what: string, timeoutMs = 3000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (check()) {
            return;
        }
        await sleep(20);
    }
    assert.fail(`timed out waiting for ${what}`);
};

/** Drops a test client's connection the way a network blip does — a close
 * that isn't a consented leave — with the SDK's own auto-reconnect switched
 * off, so each test decides when (or whether) the client comes back. */
async function dropConnection(client: any): Promise<string> {
    const token = client.reconnectionToken;
    client.reconnection.enabled = false;
    client.leave(false);
    await sleep(100);
    return token;
}

describe("dropped players keep their seat (ticket 171)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("a lobby player who drops keeps their seat, marked not connected, and comes back on it", async () => {
        const room: any = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);
        const bobSeat = seatIdOf(room, bob);

        const token = await dropConnection(bob);
        assert.strictEqual(room.state.players.size, 2, "the seat is held, not removed");
        assert.strictEqual(room.state.players.get(bobSeat).connected, false);
        assert.deepStrictEqual([...room.state.contestantsOrder], [seatIdOf(room, alice), bobSeat]);

        const bobAgain = await colyseus.sdk.reconnect(token);
        await sleep(100);
        assert.strictEqual(seatIdOf(room, bobAgain), bobSeat, "the same seat, not a new one");
        assert.strictEqual(room.state.players.get(bobSeat).connected, true);
        assert.strictEqual(room.state.players.get(bobSeat).name, "Bob");
    });

    it("a dropped host doesn't close the room, and is still the host when they're back", async () => {
        const room: any = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);
        const aliceSeat = seatIdOf(room, alice);
        let bobLeftWith: number | null = null;
        bob.onLeave((code: number) => { bobLeftWith = code; });

        const token = await dropConnection(alice);
        assert.strictEqual(bobLeftWith, null, "nobody else is disconnected");
        assert.strictEqual(room.state.players.get(aliceSeat).isHost, true);

        const aliceAgain = await colyseus.sdk.reconnect(token);
        await sleep(100);
        aliceAgain.send("startGame");
        await waitFor(() => room.state.currentPhase !== GamePhase.Lobby, "the host to start the game");
    });

    it("a seat nobody reclaims in time goes through the usual leave cleanup", async () => {
        const room: any = await colyseus.createRoom<GameState>("trivia", {});
        room.lobbyReconnectGraceSeconds = 0.2;
        await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);
        const bobSeat = seatIdOf(room, bob);

        await dropConnection(bob);
        assert.ok(room.state.players.has(bobSeat), "held at first");
        await waitFor(() => !room.state.players.has(bobSeat), "the expired seat to be removed");
        assert.ok(!room.state.contestantsOrder.includes(bobSeat));
        assert.strictEqual(room.seatIdForSessionId(bob.sessionId), undefined);
    });

    it("the host can't start the game while a player is reconnecting", async () => {
        const room: any = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);

        const token = await dropConnection(bob);
        alice.send("startGame");
        await sleep(150);
        assert.strictEqual(room.state.currentPhase, GamePhase.Lobby, "start waits for the dropped player");

        await colyseus.sdk.reconnect(token);
        await sleep(100);
        alice.send("startGame");
        await waitFor(() => room.state.currentPhase !== GamePhase.Lobby, "the game to start once they're back");
    });

    it("an active contestant who reconnects mid Cash Builder gets the live question again", async () => {
        const room: any = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 8000,
            chaserRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80
        });
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);
        alice.send("startGame");
        await waitFor(() => room.state.currentPhase === GamePhase.RolesReveal, "the roles reveal");
        alice.send("revealReady", { characterId: "maggie" });
        bob.send("revealReady", { characterId: "maggie" });
        await waitFor(
            () => room.state.currentPhase === GamePhase.CashBuilder
                && room.questionManager.getCurrentQuestion(room.state.activeContestantSeatId) !== undefined,
            "the first Cash Builder question"
        );

        const activeSeat = room.state.activeContestantSeatId;
        const active = seatIdOf(room, alice) === activeSeat ? alice : bob;
        const live = room.questionManager.getCurrentQuestion(activeSeat);

        const token = await dropConnection(active);
        assert.strictEqual(room.state.currentPhase, GamePhase.CashBuilder, "the round isn't forfeited by a drop");
        const back: any = await colyseus.sdk.reconnect(token);
        const question = await back.waitForMessage("question");
        assert.strictEqual(question.questionId, live.id);
        assert.strictEqual(question.targetSeatId, activeSeat);
        assert.ok(!("answer" in question), "the re-sent question never carries the answer");
    });

    it("the host leaving on purpose still ends the room for everyone, with its own close code", async () => {
        const room: any = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await sleep(100);

        const bobLeft = new Promise<number>((resolve) => bob.onLeave((code: number) => resolve(code)));
        alice.leave();
        assert.strictEqual(await bobLeft, ROOM_SETTINGS.hostLeftCloseCode);
        assert.notStrictEqual(ROOM_SETTINGS.hostLeftCloseCode, 4001, "4001 is Colyseus's SERVER_SHUTDOWN");
    });
});
