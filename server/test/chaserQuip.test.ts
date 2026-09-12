import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { CHASER_QUIP } from "../src/gameConfig.js";
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

describe("chaser quips", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  /** Runs random chaser selection and returns { chaserClient, otherClient }. */
  async function pickChaser(
    room: any,
    alice: { sessionId: string; send: (t: string, m?: any) => void },
    bob: { sessionId: string; send: (t: string, m?: any) => void }
  ) {
    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    const chaserSeatId = room.state.chaserSeatId;
    const chaserClient = seatIdOf(room, alice) === chaserSeatId ? alice : bob;
    const otherClient = chaserClient === alice ? bob : alice;
    return { chaserClient, otherClient };
  }

  it("a valid quip from the Chaser broadcasts chaserQuip to all clients", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const { chaserClient, otherClient } = await pickChaser(room, alice, bob);

    const chaserQuipOnChaser = chaserClient.waitForMessage("chaserQuip");
    const chaserQuipOnOther = otherClient.waitForMessage("chaserQuip");
    chaserClient.send("sendChaserQuip", { text: "  Not so fast!  " });

    const [onChaser, onOther] = await Promise.all([chaserQuipOnChaser, chaserQuipOnOther]);
    assert.strictEqual(onChaser.text, "Not so fast!", "quip text is trimmed");
    assert.strictEqual(onOther.text, "Not so fast!");
    assert.strictEqual(typeof onOther.at, "number");
  });

  it("the Chaser can quip outside the Offer phase — no phase guard", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 5000,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const { chaserClient, otherClient } = await pickChaser(room, alice, bob);

    // Still in RolesReveal.
    const quipInRolesReveal = otherClient.waitForMessage("chaserQuip");
    chaserClient.send("sendChaserQuip", { text: "Warming up in RolesReveal" });
    await quipInRolesReveal;

    chaserClient.send("revealReady", { characterId: "bezos" });
    otherClient.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);

    const quipInCashBuilder = otherClient.waitForMessage("chaserQuip");
    chaserClient.send("sendChaserQuip", { text: "Still watching in CashBuilder" });
    const result = await quipInCashBuilder;
    assert.strictEqual(result.text, "Still watching in CashBuilder");
    assert.strictEqual(room.state.currentPhase, GamePhase.CashBuilder);
  });

  it("a non-Chaser sending a quip is rejected and not broadcast", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const { otherClient } = await pickChaser(room, alice, bob);

    let quipReceived: any = null;
    otherClient.onMessage("chaserQuip", (message: any) => (quipReceived = message));
    otherClient.send("sendChaserQuip", { text: "I am not the Chaser" });
    await sleep(50);

    assert.strictEqual(quipReceived, null, "a non-Chaser's quip is never broadcast");
  });

  it("the Chaser sending an empty or oversized quip is rejected", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const { chaserClient } = await pickChaser(room, alice, bob);

    let quipReceived: any = null;
    chaserClient.onMessage("chaserQuip", (message: any) => (quipReceived = message));

    chaserClient.send("sendChaserQuip", { text: "   " });
    await sleep(30);
    assert.strictEqual(quipReceived, null, "a whitespace-only quip is rejected");

    chaserClient.send("sendChaserQuip", { text: 12345 });
    await sleep(30);
    assert.strictEqual(quipReceived, null, "a non-string quip is rejected");

    chaserClient.send("sendChaserQuip", { text: "x".repeat(CHASER_QUIP.maxLength + 1) });
    await sleep(30);
    assert.strictEqual(quipReceived, null, "an over-length quip is rejected");

    chaserClient.send("sendChaserQuip", { text: "x".repeat(CHASER_QUIP.maxLength) });
    await sleep(30);
    assert.ok(quipReceived, "a max-length quip is accepted");
  });

  it("spamming quips triggers the shared per-player rate limiter", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      rateLimitMaxMessages: 2,
      rateLimitWindowMs: 60_000
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const { chaserClient } = await pickChaser(room, alice, bob);

    let errorReceived: any = null;
    chaserClient.onMessage("error", (message: any) => (errorReceived = message));

    let quipCount = 0;
    chaserClient.onMessage("chaserQuip", () => quipCount++);

    for (let i = 0; i < 5; i++) {
      chaserClient.send("sendChaserQuip", { text: `quip ${i}` });
    }
    await sleep(80);

    assert.ok(errorReceived, "spamming quips triggers rate limiting");
    assert.strictEqual(errorReceived?.code, "RATE_LIMITED");
    assert.ok(quipCount < 5, "not every spammed quip is broadcast");
  });
});
