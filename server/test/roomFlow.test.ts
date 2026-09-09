import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { cleanup, getTestServer } from "./testServer.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("roomFlow", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("joins two clients, startGame -> CashBuilder, and the short cash-builder timer fires -> Offer", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80
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

    alice.send("startGame");
    await sleep(40);

    assert.strictEqual(room.state.currentPhase, GamePhase.CashBuilder);
    assert.strictEqual(room.state.activeContestantSessionId, alice.sessionId);
    assert.strictEqual(room.state.activeRound, 1);

    const offer = await offerMessage;
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);
    assert.strictEqual(offer.sessionId, alice.sessionId);
    assert.ok(
      "low" in offer.offers && "middle" in offer.offers && "high" in offer.offers,
      "offer message should carry low/middle/high amounts"
    );
    assert.ok(phases.includes(GamePhase.CashBuilder), "should have broadcast cashBuilder phase");
    assert.ok(phases.includes(GamePhase.Offer), "should have broadcast offer phase");
  });

  it("walks the full flow end-to-end via the stub handlers", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      teamFinalDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));
    const endGameMessage = alice.waitForMessage("endGame");

    // Alice: cashBuilder -> offer -> chase (escapes; her round's offer is $0)
    alice.send("startGame");
    await sleep(150);
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);

    alice.send("offerChoice", { offer: "high" });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Chase);

    alice.send("chaseResult", { escaped: true });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.CashBuilder);
    assert.strictEqual(room.state.activeContestantSessionId, bob.sessionId);
    assert.strictEqual(room.state.activeRound, 2);
    assert.strictEqual(room.state.players.get(alice.sessionId).madeItBack, true);

    // Bob: cashBuilder -> offer -> chase (gets caught)
    await sleep(150);
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);

    bob.send("offerChoice", { offer: "middle" });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Chase);

    bob.send("chaseResult", { escaped: false });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.TeamFinal);
    assert.strictEqual(room.state.players.get(bob.sessionId).isEliminated, true);
    assert.strictEqual(room.state.teamScore, 1, "only Alice survived, so the team starts at 1");

    // Team final timer -> chaser final
    await sleep(150);
    assert.strictEqual(room.state.currentPhase, GamePhase.ChaserFinal);

    // Stub handler: chaser reaches the team score -> game end
    alice.send("finalChaserScore");
    const endGame = await endGameMessage;
    assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
    assert.strictEqual(endGame.winner, "chaser");

    assert.ok(phases.includes(GamePhase.Chase), "should have broadcast chase phase");
    assert.ok(phases.includes(GamePhase.TeamFinal), "should have broadcast finalTeam phase");
    assert.ok(phases.includes(GamePhase.GameEnd), "should have broadcast gameend phase");
  });
});