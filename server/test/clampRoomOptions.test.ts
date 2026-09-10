import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { TriviaRoom } from "../src/rooms/TriviaRoom.js";
import { CASH_BUILDER, CHASER_SELECTION, FINAL_ROUND, REVEAL_READY } from "../src/gameConfig.js";
import { cleanup, getTestServer } from "./testServer.js";

describe("clampRoomOptions", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  const createRoom = async (options: any): Promise<TriviaRoom> => {
    const room = await colyseus.createRoom<GameState>("trivia", options);
    await room.waitForNextPatch();
    return room as unknown as TriviaRoom;
  };

  it("clamps out-of-bounds duration overrides to the gameConfig bounds", async () => {
    const room = await createRoom({
      cashBuilderDurationMs: 0,
      chaserSelectionDurationMs: 1e15,
      revealReadyCooldownMs: -5,
      teamFinalDurationMs: -5,
      chaserFinalDurationMs: 9e15
    });

    assert.strictEqual(room.cashBuilderDurationMs, CASH_BUILDER.minMs);
    assert.strictEqual(room.chaserSelectionDurationMs, CHASER_SELECTION.maxMs);
    assert.strictEqual(room.revealReadyCooldownMs, REVEAL_READY.minMs);
    assert.strictEqual(room.teamFinalDurationMs, FINAL_ROUND.minMs);
    assert.strictEqual(room.chaserFinalDurationMs, FINAL_ROUND.maxMs);
  });

  it("passes in-bounds duration overrides through unchanged", async () => {
    const room = await createRoom({
      cashBuilderDurationMs: 200,
      chaserSelectionDurationMs: 500,
      revealReadyCooldownMs: 300,
      teamFinalDurationMs: 1_000,
      chaserFinalDurationMs: 2_000
    });

    assert.strictEqual(room.cashBuilderDurationMs, 200);
    assert.strictEqual(room.chaserSelectionDurationMs, 500);
    assert.strictEqual(room.revealReadyCooldownMs, 300);
    assert.strictEqual(room.teamFinalDurationMs, 1_000);
    assert.strictEqual(room.chaserFinalDurationMs, 2_000);
  });

  it("keeps the defaults for absent or non-number overrides", async () => {
    const room = await createRoom({
      cashBuilderDurationMs: "fast"
    });

    assert.strictEqual(room.cashBuilderDurationMs, CASH_BUILDER.durationMs);
    assert.strictEqual(room.chaserSelectionDurationMs, null);
    assert.strictEqual(room.revealReadyCooldownMs, REVEAL_READY.cooldownMs);
    assert.strictEqual(room.teamFinalDurationMs, FINAL_ROUND.teamDurationMs);
    assert.strictEqual(room.chaserFinalDurationMs, FINAL_ROUND.chaserDurationMs);
  });
});