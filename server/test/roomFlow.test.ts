import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase, PlayerRole } from "../src/TriviaTypes.js";
import { cleanup, getTestServer } from "./testServer.js";

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

describe("roomFlow", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("host starts in random mode -> ChaserSelection resolves by picking a player, and the short cash-builder timer fires -> Offer", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
    assert.strictEqual(room.state.players.size, 2);
    assert.strictEqual(room.state.players.get(alice.sessionId).isHost, true);
    assert.strictEqual(room.state.players.get(bob.sessionId).isHost, false);
    assert.deepStrictEqual(
      [...room.state.contestantsOrder],
      [alice.sessionId, bob.sessionId]
    );

    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));
    const offerMessage = alice.waitForMessage("offer");

    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
    alice.send("startGame");

    // The offer only arrives after selection + the cash-builder timer both resolve.
    const offer = await offerMessage;
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);
    assert.strictEqual(room.state.activeRound, 1);
    const chaser = room.state.chaserSessionId;
    assert.ok(
      chaser === alice.sessionId || chaser === bob.sessionId,
      "random mode picks one of the players as chaser"
    );
    assert.strictEqual(room.state.players.get(chaser).role, PlayerRole.Chaser);
    assert.ok(
      ![...room.state.contestantsOrder].includes(chaser),
      "chaser is removed from contestantsOrder"
    );
    const contender = alice.sessionId === chaser ? bob.sessionId : alice.sessionId;
    assert.deepStrictEqual([...room.state.contestantsOrder], [contender]);
    assert.strictEqual(room.state.activeContestantSessionId, contender);
    assert.strictEqual(offer.sessionId, contender);
    assert.ok(
      "low" in offer.offers && "middle" in offer.offers && "high" in offer.offers,
      "offer message should carry low/middle/high amounts"
    );
    assert.ok(phases.includes(GamePhase.ChaserSelection), "should have broadcast chaserSelection phase");
    assert.ok(phases.includes(GamePhase.CashBuilder), "should have broadcast cashBuilder phase");
    assert.ok(phases.includes(GamePhase.Offer), "should have broadcast offer phase");
  });

  it("walks the full flow end-to-end via the stub handlers", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      teamFinalDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    await sleep(100);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    const bySession = new Map<string, typeof alice>(
      [alice, bob, carol].map((client) => [client.sessionId, client])
    );
    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));
    const endGameMessage = alice.waitForMessage("endGame");

    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
    alice.send("startGame");
    await waitForPhase(room, GamePhase.Offer);

    // First contestant: cashBuilder -> offer -> chase (escapes; her round's offer is $0)
    const first = bySession.get(room.state.activeContestantSessionId);
    first.send("offerChoice", { offer: "high" });
    await waitForPhase(room, GamePhase.Chase);

    first.send("chaseResult", { escaped: true });
    await waitForPhase(room, GamePhase.CashBuilder);
    const second = bySession.get(room.state.activeContestantSessionId);
    assert.ok(second && second.sessionId !== first.sessionId, "second contestant is not the chaser");
    assert.strictEqual(room.state.activeRound, 2);
    assert.strictEqual(room.state.players.get(first.sessionId).madeItBack, true);

    // Second contestant: cashBuilder -> offer -> chase (gets caught)
    await waitForPhase(room, GamePhase.Offer);

    second.send("offerChoice", { offer: "middle" });
    await waitForPhase(room, GamePhase.Chase);

    second.send("chaseResult", { escaped: false });
    await waitForPhase(room, GamePhase.TeamFinal);
    assert.strictEqual(room.state.players.get(second.sessionId).isEliminated, true);
    assert.strictEqual(room.state.teamScore, 1, "only the first contestant survived, so the team starts at 1");

    // Team final timer -> chaser final
    await waitForPhase(room, GamePhase.ChaserFinal);

    // Stub handler: chaser reaches the team score -> game end
    alice.send("finalChaserScore");
    const endGame = await endGameMessage;
    assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
    assert.strictEqual(endGame.winner, "chaser");

    assert.ok(phases.includes(GamePhase.ChaserSelection), "should have broadcast chaserSelection phase");
    assert.ok(phases.includes(GamePhase.Chase), "should have broadcast chase phase");
    assert.ok(phases.includes(GamePhase.TeamFinal), "should have broadcast finalTeam phase");
    assert.ok(phases.includes(GamePhase.GameEnd), "should have broadcast gameend phase");
  });

  it("vote mode: majority vote becomes the chaser once everyone has voted", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 500
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    await sleep(100);

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(20);
    alice.send("startGame");
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.ChaserSelection);

    alice.send("chaserVote", { targetSessionId: bob.sessionId });
    await sleep(30);
    bob.send("chaserVote", { targetSessionId: bob.sessionId });
    await sleep(30);
    carol.send("chaserVote", { targetSessionId: alice.sessionId });
    await sleep(100);

    assert.strictEqual(room.state.currentPhase, GamePhase.CashBuilder);
    assert.strictEqual(room.state.chaserSessionId, bob.sessionId);
    assert.strictEqual(room.state.players.get(bob.sessionId).role, PlayerRole.Chaser);
    assert.deepStrictEqual([...room.state.contestantsOrder], [alice.sessionId, carol.sessionId]);
  });

  it("vote mode: a tie between voters resolves to one of the tied players", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 500
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(20);
    alice.send("startGame");
    await sleep(50);

    alice.send("chaserVote", { targetSessionId: alice.sessionId });
    await sleep(30);
    bob.send("chaserVote", { targetSessionId: bob.sessionId });
    await sleep(100);

    assert.strictEqual(room.state.currentPhase, GamePhase.CashBuilder);
    assert.ok(
      room.state.chaserSessionId === alice.sessionId || room.state.chaserSessionId === bob.sessionId,
      "a tie resolves to one of the tied players"
    );
    assert.strictEqual(room.state.players.get(room.state.chaserSessionId).role, PlayerRole.Chaser);
    assert.strictEqual(room.state.contestantsOrder.length, 1);
    assert.ok(![...room.state.contestantsOrder].includes(room.state.chaserSessionId));
  });

  it("non-host cannot set the chaser mode", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    bob.send("setChaserMode", { mode: "vote" });
    await sleep(50);

    assert.strictEqual(room.state.chaserSelectionMode, "");
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
  });

  it("a player can only vote once for the chaser", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 500
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(20);
    alice.send("startGame");
    await sleep(50);

    alice.send("chaserVote", { targetSessionId: bob.sessionId });
    await sleep(30);
    alice.send("chaserVote", { targetSessionId: alice.sessionId });
    await sleep(50);

    assert.strictEqual(room.state.players.get(alice.sessionId).chaserVote, bob.sessionId);
    assert.strictEqual(room.state.currentPhase, GamePhase.ChaserSelection);
  });

  it("only the host can start the game", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    bob.send("startGame");
    await sleep(50);

    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
    assert.deepStrictEqual([...room.state.contestantsOrder], [alice.sessionId, bob.sessionId]);
  });
});