import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPhase(room: { state: { currentPhase: GamePhase } }, phase: GamePhase): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (room.state.currentPhase === phase) return;
    await sleep(20);
  }
  assert.fail(`timed out waiting for phase ${phase}; got ${room.state.currentPhase}`);
}

// Ticket 164 (bug-023): once the game leaves the Lobby, new joins are refused.
describe("late joins (ticket 164)", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("accepts joins while the room is still in the Lobby", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    await colyseus.connectTo(room, { playerName: "Alice" });
    await colyseus.connectTo(room, { playerName: "Bob" });
    await room.waitForNextPatch();
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
    assert.strictEqual(room.state.players.size, 2);
  });

  it("refuses a join after the game has started, leaving seats and order alone", async () => {
    // Short reveal timings: RolesReveal is a hold, so the order is stable there.
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80
    });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await room.waitForNextPatch();

    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    const orderBefore = [...room.state.contestantsOrder];

    await assert.rejects(
      colyseus.connectTo(room, { playerName: "Carol" }),
      (err: any) => {
        assert.match(String(err?.message), /already started/);
        return true;
      }
    );
    await sleep(50);

    assert.strictEqual(room.state.players.size, 2);
    assert.deepStrictEqual([...room.state.contestantsOrder], orderBefore);
    assert.ok(room.state.players.get(seatIdOf(room, alice)));
    assert.ok(room.state.players.get(seatIdOf(room, bob)));
  });
});
