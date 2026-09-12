import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase, PlayerRole } from "../src/TriviaTypes.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Drives the two-step Chaser offer-setting flow with valid, in-bounds amounts. */
async function setChaserOffers(
  chaserClient: { send: (type: string, message?: any) => void },
  low: number,
  high: number
): Promise<void> {
  chaserClient.send("setChaserLowOffer", { amount: low });
  await sleep(30);
  chaserClient.send("setChaserHighOffer", { amount: high });
  await sleep(30);
}

/** A stub `McQuestionSource` for chase tests — every question carries one
 * fixed correct answer ("Correct Answer") at a known text, so a test can find
 * its index in whatever shuffled `options` the room broadcasts without ever
 * needing the server's secret `correctIndex`. */
function stubChaseSource() {
  let counter = 0;
  return {
    async getQuestions(amount: number) {
      const out = [];
      for (let i = 0; i < amount; i += 1) {
        counter += 1;
        out.push({
          id: `stub-chase-${counter}`,
          question: `Stub chase question ${counter}?`,
          category: "Stub",
          options: ["Correct Answer", "Wrong A", "Wrong B", "Wrong C"],
          correctIndex: 0
        });
      }
      return out;
    }
  };
}

/**
 * Registers an auto-answer handler that answers every chase question for
 * both sides, always giving the contestant's side `contestantCorrect` and
 * the chaser's side the opposite. Must be called *before* whatever triggers
 * entry into the Chase phase (the first "mc" question can be broadcast
 * before the test's own `waitForPhase(Chase)` poll notices, so registering
 * late misses it — same delivery-vs-state race as bug-003/bug-009). Requires
 * `room.mcQuestionSource` to already be `stubChaseSource()`.
 */
function armChaseAutoAnswer(
  contestantClient: { send: (type: string, message?: any) => void; onMessage: (type: string, cb: (message: any) => void) => void },
  chaserClient: { send: (type: string, message?: any) => void },
  contestantCorrect: boolean
): void {
  contestantClient.onMessage("question", (message: any) => {
    if (!message || message.kind !== "mc") {
      return;
    }
    const correctIndex = message.options.indexOf("Correct Answer");
    const wrongIndex = (correctIndex + 1) % message.options.length;
    contestantClient.send("submitChaseAnswer", {
      questionId: message.questionId,
      answerIndex: contestantCorrect ? correctIndex : wrongIndex
    });
    chaserClient.send("submitChaseAnswer", {
      questionId: message.questionId,
      answerIndex: contestantCorrect ? wrongIndex : correctIndex
    });
  });
}

/** Waits for the chase (armed via `armChaseAutoAnswer`) to resolve — i.e. the
 * phase to leave Chase for an escape or a catch. */
const waitForChaseResolved = async (
  room: { state: { currentPhase: GamePhase } },
  timeoutMs = 5000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (room.state.currentPhase !== GamePhase.Chase) {
      return;
    }
    await sleep(20);
  }
  assert.fail(`timed out waiting for the chase to resolve; still ${room.state.currentPhase}`);
};

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

/**
 * Resolve once the client's `phase` onMessage handler has actually received
 * `phase`. `waitForPhase` polls server-side state, which advances the instant
 * the room transitions, but the `phase` broadcast message is delivered to
 * clients asynchronously — an immediate `phases.includes` assert can race that
 * delivery (bug-003, ticket 060). Polling the client's own `phases` array
 * closes the gap; a timeout here fails the test just like the old assert.
 */
const waitForPhaseBroadcast = async (
  phases: string[],
  phase: GamePhase,
  what: string,
  timeoutMs = 2000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (phases.includes(phase)) {
      return;
    }
    await sleep(20);
  }
  assert.fail(`timed out waiting for ${what}; phase broadcasts seen: ${JSON.stringify(phases)}`);
};

describe("roomFlow", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("roles reveal gates the cash builder: selection lands in RolesReveal with no timer, a lone ready does not advance, and getReady precedes the cash-builder timer", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 250,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 80,
      revealReadyCooldownMs: 100,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
    assert.strictEqual(room.state.players.size, 2);
    assert.strictEqual(room.state.players.get(seatIdOf(room, alice)).isHost, true);
    assert.strictEqual(room.state.players.get(seatIdOf(room, bob)).isHost, false);
    assert.deepStrictEqual(
      [...room.state.contestantsOrder],
      [seatIdOf(room, alice), seatIdOf(room, bob)]
    );

    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));
    const getReadyMessage = alice.waitForMessage("getReady");
    const offerStartMessage = alice.waitForMessage("offerStart");

    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
    alice.send("startGame");

    await waitForPhase(room, GamePhase.RolesReveal);
    const chaser = room.state.chaserSeatId;
    assert.ok(
      chaser === seatIdOf(room, alice) || chaser === seatIdOf(room, bob),
      "random mode picks one of the players as chaser"
    );
    assert.strictEqual(room.state.players.get(chaser).role, PlayerRole.Chaser);
    assert.ok(
      ![...room.state.contestantsOrder].includes(chaser),
      "chaser is removed from contestantsOrder"
    );
    const contender =
      seatIdOf(room, alice) === chaser ? seatIdOf(room, bob) : seatIdOf(room, alice);
    assert.deepStrictEqual([...room.state.contestantsOrder], [contender]);

    // The reveal is a hold: no cash-builder timer is scheduled while in RolesReveal.
    await sleep(200);
    assert.strictEqual(room.state.currentPhase, GamePhase.RolesReveal);
    assert.strictEqual(room.state.activeContestantSeatId, "");

    // A lone revealReady from one player does not advance the room.
    alice.send("revealReady", { characterId: "bezos" });
    await sleep(100);
    assert.strictEqual(room.state.currentPhase, GamePhase.RolesReveal);
    assert.strictEqual(room.state.players.get(seatIdOf(room, alice)).revealReady, true);
    assert.strictEqual(room.state.players.get(seatIdOf(room, bob)).revealReady, false);

    // Everyone ready -> getReady broadcast -> cooldown -> cash builder -> offer.
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);
    const getReady = await getReadyMessage;
    assert.strictEqual(getReady.cooldownMs, 100);
    room.state.players.get(contender).cashBuilderMoney = 1000;

    const offerStart = await offerStartMessage;
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);
    assert.strictEqual(room.state.activeRound, 1);
    assert.strictEqual(room.state.activeContestantSeatId, contender);
    assert.strictEqual(offerStart.seatId, contender);
    assert.strictEqual(offerStart.middle, 1000, "middle reflects the cash-builder total");

    const chaserClient = chaser === seatIdOf(room, alice) ? alice : bob;
    const offerMessage = alice.waitForMessage("offer");
    chaserClient.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    chaserClient.send("setChaserHighOffer", { amount: 2000 });
    const offer = await offerMessage;
    assert.ok(
      "low" in offer.offers && "middle" in offer.offers && "high" in offer.offers,
      "offer message should carry low/middle/high amounts"
    );
    assert.strictEqual(offer.offers.low, 0);
    assert.strictEqual(offer.offers.middle, 1000);
    assert.strictEqual(offer.offers.high, 2000);
    const chaserCharId = room.state.players.get(room.state.chaserSeatId).chaserCharacterId;
    assert.ok(
      ["bezos", "big stan", "nami"].includes(chaserCharId),
      "the chaser picks a roster character during roles reveal"
    );
    assert.strictEqual(offer.chaserCharacterId, chaserCharId);
    assert.ok(
      typeof offer.chaserCharacterName === "string" && offer.chaserCharacterName.length > 0,
      "offer message should carry the chaser character name"
    );
    assert.strictEqual(offer.chaserCharacterAbility, "", "placeholder abilities are empty for now");
    await waitForPhaseBroadcast(phases, GamePhase.RolesReveal, "rolesReveal phase broadcast to reach alice");
    await waitForPhaseBroadcast(phases, GamePhase.CashBuilder, "cashBuilder phase broadcast to reach alice");
    await waitForPhaseBroadcast(phases, GamePhase.Offer, "offer phase broadcast to reach alice");
  });

  it("chaser reveal is its own phase: the wheel holds in ChaserReveal with the chaser already assigned, then advances to RolesReveal", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 200
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));

    alice.send("startGame");
    await waitForPhase(room, GamePhase.ChaserReveal);

    const chaser = room.state.chaserSeatId;
    assert.ok(
      chaser === seatIdOf(room, alice) || chaser === seatIdOf(room, bob),
      "random mode picks one of the players as chaser before the reveal"
    );
    assert.strictEqual(room.state.players.get(chaser).role, PlayerRole.Chaser);

    // The wheel is a hold: it stays in ChaserReveal until the wheel timer fires.
    await sleep(100);
    assert.strictEqual(room.state.currentPhase, GamePhase.ChaserReveal);

    await waitForPhase(room, GamePhase.RolesReveal);
    await waitForPhaseBroadcast(phases, GamePhase.ChaserReveal, "chaserReveal phase broadcast to reach alice");
    await waitForPhaseBroadcast(phases, GamePhase.RolesReveal, "rolesReveal phase broadcast to reach alice");
  });

  it("chaser character reveal is a one-time phase after the first contestant's cash builder: broadcasts the chosen character, holds, then advances to Offer; later rounds skip it (ticket 059)", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 200,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });
    room.mcQuestionSource = stubChaseSource();

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    await sleep(100);

    const bySession = new Map<string, typeof alice>(
      [alice, bob, carol].map((client) => [seatIdOf(room, client), client])
    );

    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));
    const revealMessage = alice.waitForMessage("chaserCharacterReveal");

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "bezos" });
    carol.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);

    const chaserClient = bySession.get(room.state.chaserSeatId);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;

    // Round 1: cashBuilder timeout -> the one-time character reveal, not straight to Offer.
    await waitForPhase(room, GamePhase.ChaserCharacterReveal);
    assert.strictEqual(room.state.activeRound, 1);

    const reveal = await revealMessage;
    assert.strictEqual(reveal.chaserCharacterId, "bezos");
    assert.strictEqual(reveal.chaserCharacterName, "Bezos");

    // The reveal is a hold: it stays put until its own timer fires.
    await sleep(120);
    assert.strictEqual(room.state.currentPhase, GamePhase.ChaserCharacterReveal);

    await waitForPhase(room, GamePhase.Offer);

    const first = bySession.get(room.state.activeContestantSeatId);
    await setChaserOffers(chaserClient, 0, 2000);
    armChaseAutoAnswer(first, chaserClient, true);
    first.send("offerChoice", { offer: "middle" });
    await waitForChaseResolved(room);

    // Round 2: cashBuilder timeout skips straight to Offer — no reveal replay.
    await waitForPhase(room, GamePhase.CashBuilder);
    assert.strictEqual(room.state.activeRound, 2);
    await waitForPhase(room, GamePhase.Offer);

    assert.strictEqual(
      phases.filter((phase) => phase === GamePhase.ChaserCharacterReveal).length,
      1,
      "the character reveal is broadcast exactly once for the whole game"
    );
  });

  it("lineup is its own hold phase: after all-ready it shows the turn order, then the timer auto-advances to the cash builder", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 200
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.Lineup);

    // The lineup is a hold: no contestant is active and it lingers until the timer fires.
    assert.strictEqual(room.state.activeContestantSeatId, "");
    await sleep(80);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lineup);

    await waitForPhase(room, GamePhase.CashBuilder);
    await waitForPhaseBroadcast(phases, GamePhase.Lineup, "lineup phase broadcast to reach alice");
    assert.strictEqual(room.state.activeRound, 1);
    assert.ok(room.state.activeContestantSeatId, "first contestant is active once the cash builder starts");
  });

  it("default chaser mode is random: a game started without setChaserMode runs random picks", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    assert.strictEqual(room.state.chaserSelectionMode, "random");
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);

    assert.strictEqual(room.state.chaserSelectionMode, "random");
    assert.ok(
      room.state.chaserSeatId === seatIdOf(room, alice) ||
        room.state.chaserSeatId === seatIdOf(room, bob),
      "default random mode picks one of the players as chaser"
    );
    assert.strictEqual(room.state.players.get(room.state.chaserSeatId).role, PlayerRole.Chaser);

    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);
    assert.strictEqual(
      room.state.activeContestantSeatId,
      room.state.chaserSeatId === seatIdOf(room, alice) ? seatIdOf(room, bob) : seatIdOf(room, alice)
    );
    assert.strictEqual(room.state.activeRound, 1);
  });

  it("walks the full flow end-to-end via the stub handlers", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80,
      teamFinalDurationMs: 80
    });
    room.mcQuestionSource = stubChaseSource();

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    await sleep(100);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    const bySession = new Map<string, typeof alice>(
      [alice, bob, carol].map((client) => [seatIdOf(room, client), client])
    );
    const phases: string[] = [];
    alice.onMessage("phase", (message: any) => phases.push(message.phase));
    const endGameMessage = alice.waitForMessage("endGame");

    alice.send("setChaserMode", { mode: "random" });
    await sleep(30);
alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "bezos" });
    carol.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);

    const chaserClient = bySession.get(room.state.chaserSeatId);
    assert.ok(chaserClient, "the chaser is one of the joined clients");

    // First contestant: cashBuilder -> offer -> chase (escapes; her round's offer is $2000)
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);
    await setChaserOffers(chaserClient, 0, 2000);

    const first = bySession.get(room.state.activeContestantSeatId);
    armChaseAutoAnswer(first, chaserClient, true);
    first.send("offerChoice", { offer: "high" });
    await waitForChaseResolved(room);
    await waitForPhase(room, GamePhase.CashBuilder);
    const second = bySession.get(room.state.activeContestantSeatId);
    assert.ok(second && second !== first, "second contestant is not the chaser");
    assert.strictEqual(room.state.activeRound, 2);
    assert.strictEqual(room.state.players.get(seatIdOf(room, first)).madeItBack, true);

    // Second contestant: cashBuilder -> offer -> chase (gets caught)
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);
    await setChaserOffers(chaserClient, 0, 2000);

    armChaseAutoAnswer(second, chaserClient, false);
    second.send("offerChoice", { offer: "middle" });
    await waitForChaseResolved(room);
    await waitForPhase(room, GamePhase.TeamFinal);
    assert.strictEqual(room.state.players.get(seatIdOf(room, second)).isEliminated, true);
    assert.strictEqual(room.state.teamScore, 1, "only the first contestant survived, so the team starts at 1");

    // Team final timer -> chaser final
    await waitForPhase(room, GamePhase.ChaserFinal);

    // The Chaser answers the final question correctly, reaching the team's
    // score (1) -> game end (ticket 079).
    const chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
    assert.ok(chaserQuestion, "the chaser final should have a live question");
    chaserClient.send("submitFinalChaserAnswer", {
      questionId: chaserQuestion.id,
      answer: chaserQuestion.answer
    });
    const endGame = await endGameMessage;
    assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
    assert.strictEqual(endGame.winner, "chaser");

    await waitForPhaseBroadcast(phases, GamePhase.ChaserReveal, "chaserReveal phase broadcast to reach alice");
    await waitForPhaseBroadcast(phases, GamePhase.Chase, "chase phase broadcast to reach alice");
    await waitForPhaseBroadcast(phases, GamePhase.TeamFinal, "finalTeam phase broadcast to reach alice");
    await waitForPhaseBroadcast(phases, GamePhase.GameEnd, "gameEnd phase broadcast to reach alice");
  });

  it("offerChoice is guarded: rejected in the lobby and by a non-active player; the active contestant's choice still transitions", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });
    room.mcQuestionSource = stubChaseSource();
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("offerChoice", { offer: "high" });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const chaser = room.state.chaserSeatId;
    const active = room.state.activeContestantSeatId;
    assert.ok(chaser === seatIdOf(room, alice) || chaser === seatIdOf(room, bob), "chaser is one of the players");
    assert.notStrictEqual(chaser, active, "the chaser is never the active contestant");
    const chaserClient = chaser === seatIdOf(room, alice) ? alice : bob;
    const activeClient = active === seatIdOf(room, alice) ? alice : bob;

    // offerChoice is rejected before the Chaser has set low/high, even for the active contestant.
    activeClient.send("offerChoice", { offer: "high" });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);

    await setChaserOffers(chaserClient, 0, 2000);

    chaserClient.send("offerChoice", { offer: "high" });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Offer);

    activeClient.send("offerChoice", { offer: "high" });
    await waitForPhase(room, GamePhase.Chase);
  });

  it("submitChaseAnswer is guarded: rejected outside Chase and from a bystander; the contestant and chaser can each answer", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });
    room.mcQuestionSource = stubChaseSource();
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    await sleep(100);

    alice.send("submitChaseAnswer", { questionId: "whatever", answerIndex: 0 });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    carol.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const bySession = new Map<string, typeof alice>(
      [alice, bob, carol].map((client) => [seatIdOf(room, client), client])
    );
    const chaserClient = bySession.get(room.state.chaserSeatId)!;
    const activeSeatId = room.state.activeContestantSeatId;
    const activeClient = bySession.get(activeSeatId)!;
    const bystander = [alice, bob, carol].find(
      (client) => client !== chaserClient && client !== activeClient
    )!;

    await setChaserOffers(chaserClient, 0, 2000);
    const questionMessage = activeClient.waitForMessage("question");
    activeClient.send("offerChoice", { offer: "high" });
    await waitForPhase(room, GamePhase.Chase);
    const question = await questionMessage;
    assert.strictEqual(question.kind, "mc");

    // A bystander (not the active contestant or the Chaser) can not answer.
    bystander.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: 0 });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Chase);

    // Both the active contestant and the Chaser can answer the same question.
    // Arm the auto-answer for later questions before sending this one manually —
    // resolving it triggers the next chase question right away (bug-003/bug-009
    // style race between broadcast delivery and a test's own listener setup).
    armChaseAutoAnswer(activeClient, chaserClient, true);
    const correctIndex = question.options.indexOf("Correct Answer");
    const wrongIndex = (correctIndex + 1) % question.options.length;
    const contestantBefore = room.state.players.get(room.state.activeContestantSeatId).boardPos;
    activeClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
    chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
    await sleep(50);
    // The auto-answer armed above keeps driving further rounds once this one
    // resolves, so assert progress rather than an exact stopping point.
    assert.ok(
      room.state.players.get(room.state.activeContestantSeatId).boardPos < contestantBefore,
      "the contestant's correct answer moved them toward the escape space"
    );

    await waitForChaseResolved(room);
    // Three players means a second contestant is still in line after this
    // escape — the round moves on to their cash builder, not straight to
    // TeamFinal (that only happens once every contestant has gone).
    await waitForPhase(room, GamePhase.CashBuilder);
    assert.strictEqual(room.state.players.get(activeSeatId).madeItBack, true);
  });

  it("submitFinalChaserAnswer is guarded: rejected in the lobby and by a contestant; the Chaser's correct answer still transitions", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80,
      teamFinalDurationMs: 80
    });
    room.mcQuestionSource = stubChaseSource();
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("submitFinalChaserAnswer", { questionId: 1, answer: "x" });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const chaser = room.state.chaserSeatId;
    const active = room.state.activeContestantSeatId;
    const chaserClient = chaser === seatIdOf(room, alice) ? alice : bob;
    const activeClient = active === seatIdOf(room, alice) ? alice : bob;

    await setChaserOffers(chaserClient, 0, 2000);
    armChaseAutoAnswer(activeClient, chaserClient, true);
    activeClient.send("offerChoice", { offer: "high" });
    await waitForChaseResolved(room);
    await waitForPhase(room, GamePhase.ChaserFinal);

    const chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
    assert.ok(chaserQuestion, "the chaser final should have a live question");

    activeClient.send("submitFinalChaserAnswer", { questionId: chaserQuestion.id, answer: chaserQuestion.answer });
    await sleep(50);
    assert.strictEqual(room.state.currentPhase, GamePhase.ChaserFinal);
    assert.strictEqual(room.state.chaserScore, 0, "a contestant's answer must not score for the Chaser");

    chaserClient.send("submitFinalChaserAnswer", { questionId: chaserQuestion.id, answer: chaserQuestion.answer });
    await waitForPhase(room, GamePhase.GameEnd);
  });

  it("vote mode: majority vote becomes the chaser once everyone has voted", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 500,
      chaserRevealDurationMs: 80,
      lineupDurationMs: 80
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

alice.send("chaserVote", { targetSeatId: seatIdOf(room, bob) });
    await sleep(30);
    bob.send("chaserVote", { targetSeatId: seatIdOf(room, bob) });
    carol.send("chaserVote", { targetSeatId: seatIdOf(room, alice) });
    await waitForPhase(room, GamePhase.RolesReveal);

assert.strictEqual(room.state.chaserSeatId, seatIdOf(room, bob));
    assert.strictEqual(room.state.players.get(room.state.chaserSeatId).role, PlayerRole.Chaser);
    assert.deepStrictEqual([...room.state.contestantsOrder], [seatIdOf(room, alice), seatIdOf(room, carol)]);

    alice.send("revealReady", { characterId: "bezos" });
    carol.send("revealReady");
    await sleep(100);
    assert.strictEqual(room.state.currentPhase, GamePhase.RolesReveal, "waiting on bob before advancing");

    bob.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);
    assert.strictEqual(room.state.activeContestantSeatId, seatIdOf(room, alice));
    assert.strictEqual(room.state.activeRound, 1);
  });

  it("vote mode: a tie between voters resolves to one of the tied players", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 500,
      chaserRevealDurationMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(20);
    alice.send("startGame");
    await sleep(50);

    alice.send("chaserVote", { targetSeatId: seatIdOf(room, alice) });
    await sleep(30);
    bob.send("chaserVote", { targetSeatId: seatIdOf(room, bob) });
    await waitForPhase(room, GamePhase.RolesReveal);

    assert.ok(
      room.state.chaserSeatId === seatIdOf(room, alice) ||
        room.state.chaserSeatId === seatIdOf(room, bob),
      "a tie resolves to one of the tied players"
    );
    assert.strictEqual(room.state.players.get(room.state.chaserSeatId).role, PlayerRole.Chaser);
    assert.strictEqual(room.state.contestantsOrder.length, 1);
    assert.ok(![...room.state.contestantsOrder].includes(room.state.chaserSeatId));

    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);
  });

  it("non-host cannot set the chaser mode", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    bob.send("setChaserMode", { mode: "vote" });
    await sleep(50);

    assert.strictEqual(room.state.chaserSelectionMode, "random");
    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby);
  });

  it("a player can only vote once for the chaser", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      chaserSelectionDurationMs: 500,
      chaserRevealDurationMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("setChaserMode", { mode: "vote" });
    await sleep(20);
    alice.send("startGame");
    await sleep(50);

alice.send("chaserVote", { targetSeatId: seatIdOf(room, bob) });
    await sleep(30);
    alice.send("chaserVote", { targetSeatId: seatIdOf(room, alice) });
    await sleep(30);
    assert.strictEqual(room.state.players.get(seatIdOf(room, alice)).chaserVote, seatIdOf(room, bob));
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
    assert.deepStrictEqual([...room.state.contestantsOrder], [seatIdOf(room, alice), seatIdOf(room, bob)]);
  });

  describe("chaser sets the offers (ticket 051)", () => {
    /** Two players into the Offer phase, with the active contestant's middle set to $5000. */
    async function reachOffer(colyseus: ColyseusTestServer<typeof appConfig>) {
      const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 250,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80
      });
      room.mcQuestionSource = stubChaseSource();
      const alice = await colyseus.connectTo(room, { playerName: "Alice" });
      const bob = await colyseus.connectTo(room, { playerName: "Bob" });
      await sleep(100);

      alice.send("startGame");
      await waitForPhase(room, GamePhase.RolesReveal);
      alice.send("revealReady", { characterId: "bezos" });
      bob.send("revealReady", { characterId: "nami" });
      await waitForPhase(room, GamePhase.CashBuilder);
      room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 5000;
      await waitForPhase(room, GamePhase.Offer);

      const chaser = room.state.chaserSeatId;
      const active = room.state.activeContestantSeatId;
      const chaserClient = chaser === seatIdOf(room, alice) ? alice : bob;
      const activeClient = active === seatIdOf(room, alice) ? alice : bob;
      return { room, alice, bob, chaserClient, activeClient };
    }

    it("full flow: setChaserLowOffer -> offerLowSet broadcast -> setChaserHighOffer -> offer broadcast -> contestant picks -> Chase", async () => {
      const { room, chaserClient, activeClient } = await reachOffer(colyseus);

      const lowSetPromise = activeClient.waitForMessage("offerLowSet");
      chaserClient.send("setChaserLowOffer", { amount: 1000 });
      const lowSet = await lowSetPromise;
      assert.strictEqual(lowSet.low, 1000);
      assert.strictEqual(room.currentOffer.low, 1000);
      assert.strictEqual(room.currentOffer.high, null, "high is still unset");

      const offerPromise = activeClient.waitForMessage("offer");
      chaserClient.send("setChaserHighOffer", { amount: 12000 });
      const offer = await offerPromise;
      assert.deepStrictEqual(offer.offers, { low: 1000, middle: 5000, high: 12000 });

      activeClient.send("offerChoice", { offer: "high" });
      await waitForPhase(room, GamePhase.Chase);
    });

    it("rejects a low offer from a non-Chaser player", async () => {
      const { room, activeClient } = await reachOffer(colyseus);
      activeClient.send("setChaserLowOffer", { amount: 1000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.low, null);
    });

    it("rejects a low offer outside the Offer phase, even from the Chaser", async () => {
      const { room, chaserClient, activeClient } = await reachOffer(colyseus);
      await setChaserOffers(chaserClient, 0, 12000);
      activeClient.send("offerChoice", { offer: "middle" });
      await waitForPhase(room, GamePhase.Chase);

      chaserClient.send("setChaserLowOffer", { amount: 100 });
      await sleep(50);
      assert.strictEqual(room.state.currentPhase, GamePhase.Chase, "phase unaffected by the rejected message");
    });

    it("rejects a low offer that is not a multiple of $100", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      chaserClient.send("setChaserLowOffer", { amount: 150 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.low, null);
    });

    it("rejects a low offer that is not less than the middle offer", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      chaserClient.send("setChaserLowOffer", { amount: 5000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.low, null, "low must be strictly less than middle ($5000)");
    });

    it("allows a negative low offer within the team pot, rejects one that would push it below $0", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      room.state.teamPot = 500;

      chaserClient.send("setChaserLowOffer", { amount: -600 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.low, null, "would push the team pot below $0");

      chaserClient.send("setChaserLowOffer", { amount: -500 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.low, -500, "exactly draining the team pot is allowed");
    });

    it("rejects a high offer before the low offer is set", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      chaserClient.send("setChaserHighOffer", { amount: 12000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.high, null);
    });

    it("rejects a high offer from a non-Chaser player", async () => {
      const { room, chaserClient, activeClient } = await reachOffer(colyseus);
      chaserClient.send("setChaserLowOffer", { amount: 0 });
      await sleep(30);
      activeClient.send("setChaserHighOffer", { amount: 12000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.high, null);
    });

    it("rejects a high offer that is not a multiple of $1000", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      chaserClient.send("setChaserLowOffer", { amount: 0 });
      await sleep(30);
      chaserClient.send("setChaserHighOffer", { amount: 12500 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.high, null);
    });

    it("rejects a high offer that is not more than the middle offer", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      chaserClient.send("setChaserLowOffer", { amount: 0 });
      await sleep(30);
      chaserClient.send("setChaserHighOffer", { amount: 5000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.high, null, "high must be strictly more than middle ($5000)");
    });

    it("rejects a high offer above the Chaser's remaining pot", async () => {
      const { room, chaserClient } = await reachOffer(colyseus);
      room.state.chaserPot = 10000;
      chaserClient.send("setChaserLowOffer", { amount: 0 });
      await sleep(30);
      chaserClient.send("setChaserHighOffer", { amount: 11000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.high, null, "exceeds the Chaser's remaining pot");
    });

    it("offerChoice is rejected until both low and high offers are set", async () => {
      const { room, chaserClient, activeClient } = await reachOffer(colyseus);

      activeClient.send("offerChoice", { offer: "middle" });
      await sleep(50);
      assert.strictEqual(room.state.currentPhase, GamePhase.Offer, "nothing set yet");

      chaserClient.send("setChaserLowOffer", { amount: 0 });
      await sleep(30);
      activeClient.send("offerChoice", { offer: "middle" });
      await sleep(50);
      assert.strictEqual(room.state.currentPhase, GamePhase.Offer, "high still unset");

      chaserClient.send("setChaserHighOffer", { amount: 12000 });
      await sleep(30);
      activeClient.send("offerChoice", { offer: "middle" });
      await waitForPhase(room, GamePhase.Chase);
    });

    it("ticket 058: a $0 middle with a $0 team pot skips the low offer — Chaser sets high only, round still reaches Chase", async () => {
      const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 250,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80
      });
      room.mcQuestionSource = stubChaseSource();
      const alice = await colyseus.connectTo(room, { playerName: "Alice" });
      const bob = await colyseus.connectTo(room, { playerName: "Bob" });
      await sleep(100);

      alice.send("startGame");
      await waitForPhase(room, GamePhase.RolesReveal);
      alice.send("revealReady", { characterId: "bezos" });
      bob.send("revealReady", { characterId: "nami" });
      await waitForPhase(room, GamePhase.CashBuilder);
      // Leave cashBuilderMoney at its default $0 — the contestant answers nothing correctly,
      // and this is the first round, so the team pot is also still $0.
      const offerStartPromise = alice.waitForMessage("offerStart");
      await waitForPhase(room, GamePhase.Offer);

      assert.strictEqual(room.state.teamPot, 0, "first contestant of the game — team pot starts at $0");
      assert.strictEqual(room.currentOffer.middle, 0);
      assert.strictEqual(room.currentOffer.low, 0, "low is pre-filled at $0 so the offer stays resolvable");

      const offerStart = await offerStartPromise;
      assert.strictEqual(offerStart.low, 0, "the offerStart broadcast carries the pre-filled low");

      const chaser = room.state.chaserSeatId;
      const active = room.state.activeContestantSeatId;
      const chaserClient = chaser === seatIdOf(room, alice) ? alice : bob;
      const activeClient = active === seatIdOf(room, alice) ? alice : bob;

      chaserClient.send("setChaserLowOffer", { amount: -100 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.low, 0, "a low offer can not be set when middle is already $0");

      chaserClient.send("setChaserHighOffer", { amount: 8000 });
      await sleep(50);
      assert.strictEqual(room.currentOffer.high, 8000, "the Chaser can still complete the offer with a high only");

      activeClient.send("offerChoice", { offer: "middle" });
      await waitForPhase(room, GamePhase.Chase);
    });
  });
});