import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { ROOM_CODE } from "../src/gameConfig.js";
import { generateRoomCode } from "../src/roomCode.js";
import { cleanup, getTestServer } from "./testServer.js";

const CODE_PATTERN = new RegExp(`^[${ROOM_CODE.alphabet}]{${ROOM_CODE.length}}$`);

/** A `random` that walks through the given values in order, repeating the
 * last one once they run out. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("room codes", () => {
  it("generates ROOM_CODE.length letters from ROOM_CODE.alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      assert.match(generateRoomCode(() => false), CODE_PATTERN);
    }
  });

  it("never uses I or O, which read as 1 and 0", () => {
    assert.ok(!ROOM_CODE.alphabet.includes("I"));
    assert.ok(!ROOM_CODE.alphabet.includes("O"));
  });

  it("skips a code that is already live", () => {
    const first = "A".repeat(ROOM_CODE.length);
    // First draw is all index 0 ("AAAA", taken), then all index 1 ("BBBB").
    const random = sequence(...Array(ROOM_CODE.length).fill(0), ...Array(ROOM_CODE.length).fill(1 / ROOM_CODE.alphabet.length));
    const code = generateRoomCode((candidate) => candidate === first, random);
    assert.strictEqual(code, "B".repeat(ROOM_CODE.length));
  });

  it("grows a letter instead of spinning forever when every attempt collides", () => {
    const code = generateRoomCode((candidate) => candidate.length === ROOM_CODE.length, () => 0);
    assert.strictEqual(code.length, ROOM_CODE.length + 1);
  });

  describe("on real rooms", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
      colyseus = await getTestServer();
      await cleanup();
    });

    it("gives each new room a short code, unique among live rooms", async () => {
      const rooms = [];
      for (let i = 0; i < 10; i += 1) {
        rooms.push(await colyseus.createRoom<GameState>("trivia", {}));
      }
      const codes = rooms.map((room) => room.roomId);
      for (const code of codes) {
        assert.match(code, CODE_PATTERN);
      }
      assert.strictEqual(new Set(codes).size, codes.length);
    });

    it("lets a client join by the short code", async () => {
      const room = await colyseus.createRoom<GameState>("trivia", {});
      const client = await colyseus.sdk.joinById(room.roomId, { playerName: "Megan" });
      assert.strictEqual(client.roomId, room.roomId);
      await client.leave();
    });
  });
});
