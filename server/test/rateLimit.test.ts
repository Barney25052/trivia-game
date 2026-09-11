import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { RATE_LIMIT } from "../src/gameConfig.js";
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

describe("rate limiting", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("exceeding the rate limit rejects subsequent messages and returns an error", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      rateLimitMaxMessages: 2,
      rateLimitWindowMs: 60_000
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    await sleep(50);

    let errorReceived: any = null;
    alice.onMessage("error", (message: any) => (errorReceived = message));

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(30);
    assert.strictEqual(room.state.chaserSelectionMode, "vote", "first message is processed");
    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
    assert.strictEqual(room.state.chaserSelectionMode, "random", "second message is processed");

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(50);

    assert.ok(errorReceived, "the rate-limited message returns an error to the client");
    assert.strictEqual(errorReceived.code, "RATE_LIMITED");
    assert.strictEqual(
      room.state.chaserSelectionMode,
      "random",
      "the rejected message is never processed"
    );
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby, "the room is unaffected by the flood");
  });

  it("rate limiting is per client: one client hitting the cap does not block the other", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 8000,
      chaserSelectionDurationMs: 50,
      chaserRevealDurationMs: 50,
      revealReadyCooldownMs: 2000,
      rateLimitMaxMessages: 2,
      rateLimitWindowMs: 60_000
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("setChaserMode", { mode: "random" });
    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);

    bob.send("revealReady", { characterId: "bezos" });
    await sleep(50);

    assert.strictEqual(
      room.state.players.get(seatIdOf(room, bob)).revealReady,
      true,
      "bob is not blocked by alice hitting the cap"
    );
  });

  it("messages within the window recover after the window elapses", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      rateLimitMaxMessages: 2,
      rateLimitWindowMs: 200
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    await sleep(50);

    alice.send("setChaserMode", { mode: "vote" });
    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);

    let errorReceived: any = null;
    alice.onMessage("error", (message: any) => (errorReceived = message));
    alice.send("setChaserMode", { mode: "vote" });
    await sleep(30);
    assert.ok(errorReceived, "a message within the window is rate limited");

    await sleep(250);
    errorReceived = null;
    alice.send("setChaserMode", { mode: "vote" });
    await sleep(30);

    assert.strictEqual(errorReceived, null, "a message after the window is processed");
    assert.strictEqual(room.state.chaserSelectionMode, "vote");
  });

  it("rate limit state is cleaned up when a client leaves", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    await sleep(50);

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(30);
    assert.strictEqual(
      (room as any).messageTimes.has(alice.sessionId),
      true,
      "the tracker records the client while connected"
    );

    alice.leave();
    await sleep(100);
    assert.strictEqual(
      (room as any).messageTimes.has(alice.sessionId),
      false,
      "the tracker entry is removed on leave"
    );
  });

  it("room-option rate limit values are clamped to gameConfig bounds", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      rateLimitMaxMessages: 9999,
      rateLimitWindowMs: 1
    });
    await sleep(30);

    assert.strictEqual(room.rateLimitMaxMessages, RATE_LIMIT.maxMaxMessages);
    assert.strictEqual(room.rateLimitWindowMs, RATE_LIMIT.minWindowMs);
  });
});