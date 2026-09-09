import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase, PlayerRole } from "../src/TriviaTypes.js";
import { CHASER_POT } from "../src/gameConfig.js";

describe("GameState", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => { await colyseus.shutdown(); });
  beforeEach(async () => { await colyseus.cleanup(); });

  it("room boots with GameState defaults", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    await room.waitForNextPatch();

    assert.ok(room.state instanceof GameState);
    assert.strictEqual(room.state.players.size, 0);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
    assert.strictEqual(room.state.chaserSessionId, "");
    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial);
    assert.strictEqual(room.state.teamPot, 0);
    assert.strictEqual(room.state.activeContestantSessionId, "");
    assert.strictEqual(room.state.activeRound, 0);
    assert.strictEqual(room.state.teamScore, 0);
    assert.strictEqual(room.state.contestantsOrder.length, 0);
  });

  it("a player joining via onJoin becomes a host contestant", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const client = await colyseus.connectTo(room, { playerName: "Alice" });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.players.size, 1);
    const player = room.state.players.get(client.sessionId);
    assert.ok(player, "player should be registered under their sessionId");
    assert.strictEqual(player.name, "Alice");
    assert.strictEqual(player.sessionId, client.sessionId);
    assert.strictEqual(player.role, PlayerRole.Contestant);
    assert.strictEqual(player.isHost, true);
    assert.strictEqual(player.isEliminated, false);
    assert.strictEqual(player.madeItBack, false);
    assert.strictEqual(player.cashBuilderMoney, 0);
    assert.strictEqual(player.boardPos, 0);
    assert.strictEqual(player.score, 0);
    assert.deepStrictEqual([...room.state.contestantsOrder], [client.sessionId]);
  });

  it("a second player joins as a non-host contestant", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const first = await colyseus.connectTo(room, { playerName: "Alice" });
    const second = await colyseus.connectTo(room, { playerName: "Bob" });
    await room.waitForNextPatch();

    assert.strictEqual(room.state.players.size, 2);
    assert.strictEqual(room.state.players.get(first.sessionId).isHost, true);
    assert.strictEqual(room.state.players.get(second.sessionId).isHost, false);
    assert.strictEqual(room.state.players.get(second.sessionId).role, PlayerRole.Contestant);
    assert.deepStrictEqual([...room.state.contestantsOrder], [first.sessionId, second.sessionId]);
  });
});