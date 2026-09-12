import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { CHASER_POT } from "../src/gameConfig.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

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

/** A stub `McQuestionSource` for chase tests — see roomFlow.test.ts for the
 * full rationale behind the fixed "Correct Answer" text. */
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
 * both sides, always giving the contestant's side `contestantCorrect` and the
 * chaser's side the opposite. Must be called *before* whatever triggers entry
 * into the Chase phase — the first "mc" question can be broadcast before a
 * `waitForPhase(Chase)` poll notices, so registering late misses it (same
 * delivery-vs-state race as bug-003/bug-009). Requires `room.mcQuestionSource`
 * to already be `stubChaseSource()`.
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
async function waitForChaseResolved(
  room: { state: { currentPhase: GamePhase } },
  timeoutMs = 5000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (room.state.currentPhase !== GamePhase.Chase) {
      return;
    }
    await sleep(20);
  }
  assert.fail(`timed out waiting for the chase to resolve; still ${room.state.currentPhase}`);
}

describe("chaserPot lifecycle", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  it("starts at the fixed initial value and does not grow just from reaching the offer", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 80,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      chaserCharacterRevealDurationMs: 80,
      revealReadyCooldownMs: 80,
      lineupDurationMs: 80
    });

    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.Offer);

    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial, "no growth until a chase resolves");
  });

  it("grows by perRound and debits the escape payout, floored at 0", async () => {
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

    const bySession = new Map<string, typeof alice>(
      [alice, bob].map((client) => [seatIdOf(room, client), client])
    );

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 5000;
    await waitForPhase(room, GamePhase.Offer);

    const chaserClient = bySession.get(room.state.chaserSeatId);
    chaserClient.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    chaserClient.send("setChaserHighOffer", { amount: 10000 });
    await sleep(30);

    const contestant = bySession.get(room.state.activeContestantSeatId);
    // Arm before sending: the chase can resolve to an escape within a few ms
    // once both sides auto-answer, so a `waitForPhase(Chase)` poll afterward
    // can land after it has already moved on to TeamFinal.
    armChaseAutoAnswer(contestant, chaserClient, true);
    contestant.send("offerChoice", { offer: "high" });
    await sleep(30);
    const offerAmount = (room as any).currentOfferAmount;

    await waitForChaseResolved(room);
    await waitForPhase(room, GamePhase.TeamFinal);

    const expected = Math.max(0, CHASER_POT.initial + CHASER_POT.perRound - offerAmount);
    assert.strictEqual(room.state.chaserPot, expected);
  });

  it("grows by perRound and debits nothing when the contestant is caught", async () => {
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

    const bySession = new Map<string, typeof alice>(
      [alice, bob].map((client) => [seatIdOf(room, client), client])
    );

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 5000;
    await waitForPhase(room, GamePhase.Offer);

    const chaserClient = bySession.get(room.state.chaserSeatId);
    chaserClient.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    chaserClient.send("setChaserHighOffer", { amount: 10000 });
    await sleep(30);

    const contestant = bySession.get(room.state.activeContestantSeatId);
    armChaseAutoAnswer(contestant, chaserClient, false);
    contestant.send("offerChoice", { offer: "high" });
    await waitForChaseResolved(room);
    await waitForPhase(room, GamePhase.TeamFinal);

    assert.strictEqual(room.state.chaserPot, CHASER_POT.initial + CHASER_POT.perRound);
  });

  it("clamps at 0 when an offer exceeds the remaining pot", async () => {
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

    const bySession = new Map<string, typeof alice>(
      [alice, bob].map((client) => [seatIdOf(room, client), client])
    );

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 5000;
    await waitForPhase(room, GamePhase.Offer);

    const chaserClient = bySession.get(room.state.chaserSeatId);
    chaserClient.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    chaserClient.send("setChaserHighOffer", { amount: 10000 });
    await sleep(30);

    const contestant = bySession.get(room.state.activeContestantSeatId);
    // Catch the first question manually (a one-shot promise, registered ahead
    // of the send) so `currentOfferAmount` can be overridden before anyone
    // answers, then arm auto-answer for the remaining rounds — arming up
    // front would risk the chase resolving (and paying out) before this test
    // gets to override the amount.
    const firstQuestion = contestant.waitForMessage("question");
    contestant.send("offerChoice", { offer: "high" });
    const question = await firstQuestion;

    (room as any).currentOfferAmount = CHASER_POT.initial + CHASER_POT.perRound + 1_000_000;

    armChaseAutoAnswer(contestant, chaserClient, true);
    const correctIndex = question.options.indexOf("Correct Answer");
    const wrongIndex = (correctIndex + 1) % question.options.length;
    contestant.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
    chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });

    await waitForChaseResolved(room);
    await waitForPhase(room, GamePhase.TeamFinal);

    assert.strictEqual(room.state.chaserPot, 0, "pot never drops below 0");
  });
});
