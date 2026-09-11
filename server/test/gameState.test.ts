import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase, PlayerRole } from "../src/TriviaTypes.js";
import { CHASER_POT, CHASER_SELECTION } from "../src/gameConfig.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

describe("GameState", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("room boots with GameState defaults", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    await room.waitForNextPatch();

    assert.ok(room.state instanceof GameState);
    assert.strictEqual(room.state.players.size, 0);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
    assert.strictEqual(room.state.chaserSeatId, "");
    assert.strictEqual(room.state.chaserSelectionMode, CHASER_SELECTION.defaultMode);
    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial);
    assert.strictEqual(room.state.teamPot, 0);
    assert.strictEqual(room.state.activeContestantSeatId, "");
    assert.strictEqual(room.state.activeRound, 0);
    assert.strictEqual(room.state.teamScore, 0);
    assert.strictEqual(room.state.contestantsOrder.length, 0);
  });

  it("a player joining via onJoin becomes a host contestant", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const client = await colyseus.connectTo(room, { playerName: "Alice" });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.players.size, 1);
    const seatId = seatIdOf(room, client);
    const player = room.state.players.get(seatId);
    assert.ok(player, "player should be registered under their seat id");
    assert.strictEqual(player.name, "Alice");
    assert.strictEqual(player.seatId, seatId);
    assert.strictEqual(player.role, PlayerRole.Contestant);
    assert.strictEqual(player.isHost, true);
    assert.strictEqual(player.isEliminated, false);
    assert.strictEqual(player.madeItBack, false);
    assert.strictEqual(player.cashBuilderMoney, 0);
    assert.strictEqual(player.boardPos, 0);
    assert.strictEqual(player.score, 0);
    assert.strictEqual(player.chaserVote, "");
    assert.deepStrictEqual([...room.state.contestantsOrder], [seatId]);
  });

  it("a second player joins as a non-host contestant", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const first = await colyseus.connectTo(room, { playerName: "Alice" });
    const second = await colyseus.connectTo(room, { playerName: "Bob" });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.players.size, 2);
    assert.strictEqual(room.state.players.get(seatIdOf(room, first)).isHost, true);
    assert.strictEqual(room.state.players.get(seatIdOf(room, second)).isHost, false);
    assert.strictEqual(room.state.players.get(seatIdOf(room, second)).role, PlayerRole.Contestant);
    assert.deepStrictEqual(
        [...room.state.contestantsOrder],
        [seatIdOf(room, first), seatIdOf(room, second)]
    );
  });
});