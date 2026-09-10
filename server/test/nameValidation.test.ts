import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { cleanup, getTestServer } from "./testServer.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("nameValidation", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  const invalidNames: Array<[string, string]> = [
    ["an empty name", ""],
    ["a whitespace-only name", "   "],
    ["a name longer than 24 chars", "x".repeat(25)]
  ];

  for (const [label, playerName] of invalidNames) {
    it(`rejects a join with ${label}`, async () => {
      const room = await colyseus.createRoom<GameState>("trivia", {});
      await assert.rejects(async () => {
        await colyseus.connectTo(room, { playerName });
      });
      await sleep(50);
      assert.strictEqual(room.state.players.size, 0);
      assert.deepStrictEqual([...room.state.contestantsOrder], []);
    });
  }

  it("rejects a join with a non-string playerName", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    await assert.rejects(async () => {
      await colyseus.connectTo(room, { playerName: 12345 });
    });
    await sleep(50);
    assert.strictEqual(room.state.players.size, 0);
    assert.deepStrictEqual([...room.state.contestantsOrder], []);
  });

  it("trims leading/trailing whitespace and stores the trimmed name", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const client = await colyseus.connectTo(room, { playerName: "  Alice  " });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.players.size, 1);
    const player = room.state.players.get(client.sessionId);
    assert.ok(player, "player should be registered under their sessionId");
    assert.strictEqual(player.name, "Alice");
    assert.strictEqual(player.isHost, true);
    assert.deepStrictEqual([...room.state.contestantsOrder], [client.sessionId]);
  });

  it("a name of exactly 24 characters is accepted", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const client = await colyseus.connectTo(room, { playerName: "x".repeat(24) });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.players.size, 1);
    assert.strictEqual(room.state.players.get(client.sessionId).name, "x".repeat(24));
  });
});