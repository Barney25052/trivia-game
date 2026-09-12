import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { isValidCharacter } from "../src/character.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("character handler", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("joining assigns a valid default character", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        await room.waitForNextPatch();

        const player = room.state.players.get(seatIdOf(room, alice));
        assert.ok(player, "player should be registered");
        assert.strictEqual(isValidCharacter(player.character), true);
    });

    it("setCharacter updates the caller's own schema on a valid code", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        await room.waitForNextPatch();

        alice.send("setCharacter", { character: "42107" });
        await sleep(50);

        assert.strictEqual(room.state.players.get(seatIdOf(room, alice)).character, "42107");
    });

    it("setCharacter rejects a malformed or out-of-range code", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        await room.waitForNextPatch();
        const before = room.state.players.get(seatIdOf(room, alice)).character;

        for (const bad of ["50000", "abcde", "1234", "", null]) {
            alice.send("setCharacter", { character: bad });
            await sleep(30);
            assert.strictEqual(
                room.state.players.get(seatIdOf(room, alice)).character,
                before,
                `expected ${JSON.stringify(bad)} to be rejected`
            );
        }
    });

    it("setCharacter is self-only — it never touches another seat's character", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {});
        const alice = await colyseus.connectTo(room, { playerName: "Alice" });
        const bob = await colyseus.connectTo(room, { playerName: "Bob" });
        await room.waitForNextPatch();
        const bobBefore = room.state.players.get(seatIdOf(room, bob)).character;

        alice.send("setCharacter", { character: "11111" });
        await sleep(50);

        assert.strictEqual(room.state.players.get(seatIdOf(room, alice)).character, "11111");
        assert.strictEqual(room.state.players.get(seatIdOf(room, bob)).character, bobBefore);
    });
});
