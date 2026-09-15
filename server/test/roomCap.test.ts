import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { ROOM_SETTINGS } from "../src/gameConfig.js";
import { cleanup, getTestServer } from "./testServer.js";

describe("concurrent room cap (ticket 132)", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("rejects a new room past ROOM_SETTINGS.maxConcurrentRooms, then accepts again once one disposes", async () => {
    const rooms = [];
    for (let i = 0; i < ROOM_SETTINGS.maxConcurrentRooms; i += 1) {
      rooms.push(await colyseus.createRoom<GameState>("trivia", {}));
    }
    assert.strictEqual(rooms.length, ROOM_SETTINGS.maxConcurrentRooms);

    await assert.rejects(
      colyseus.createRoom<GameState>("trivia", {}),
      (err: any) => {
        assert.match(String(err.message), /capacity/i);
        return true;
      }
    );

    await rooms[0].disconnect();

    const room = await colyseus.createRoom<GameState>("trivia", {});
    assert.ok(room.roomId, "a new room is accepted again once a live room disposes");
  });
});
