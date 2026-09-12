import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { CHASER_POT } from "../src/gameConfig.js";
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

describe("chaserPot lifecycle", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("starts at the fixed initial value and does not grow just from reaching the offer", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.Offer);

    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial, "no growth until a chase resolves");
  });

  it("grows by perRound and debits the escape payout, floored at 0", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const bySession = new Map<string, typeof alice>(
      [alice, bob].map((client) => [seatIdOf(room, client), client])
    );

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.Offer);

    const contestant = bySession.get(room.state.activeContestantSeatId);
    contestant.send("offerChoice", { offer: "high" });
    await waitForPhase(room, GamePhase.Chase);
    const offerAmount = (room as any).currentOfferAmount;

    contestant.send("chaseResult", { escaped: true });
    await waitForPhase(room, GamePhase.TeamFinal);

    const expected = Math.max(0, CHASER_POT.initial + CHASER_POT.perRound - offerAmount);
    assert.strictEqual(room.state.chaserPot, expected);
  });

  it("grows by perRound and debits nothing when the contestant is caught", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const bySession = new Map<string, typeof alice>(
      [alice, bob].map((client) => [seatIdOf(room, client), client])
    );

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.Offer);

    const contestant = bySession.get(room.state.activeContestantSeatId);
    contestant.send("offerChoice", { offer: "high" });
    await waitForPhase(room, GamePhase.Chase);

    contestant.send("chaseResult", { escaped: false });
    await waitForPhase(room, GamePhase.TeamFinal);

    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial + CHASER_POT.perRound);
  });

  it("clamps at 0 when an offer exceeds the remaining pot", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const bySession = new Map<string, typeof alice>(
      [alice, bob].map((client) => [seatIdOf(room, client), client])
    );

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.Offer);

    const contestant = bySession.get(room.state.activeContestantSeatId);
    contestant.send("offerChoice", { offer: "high" });
    await waitForPhase(room, GamePhase.Chase);

    (room as any).currentOfferAmount = CHASER_POT.initial + CHASER_POT.perRound + 1_000_000;

    contestant.send("chaseResult", { escaped: true });
    await waitForPhase(room, GamePhase.TeamFinal);

    assert.strictEqual(room.state.chaserPot, 0, "pot never drops below 0");
  });
});
