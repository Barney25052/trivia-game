import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { QuestionManager } from "../src/questions/questionManager.js";
import { loadBank, BankQuestion } from "../src/questions/bank.js";
import { CASH_BUILDER } from "../src/gameConfig.js";
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

describe("QuestionManager", () => {
  const bank = loadBank();

  it("initContestant sets up a fresh contestant so drawNext works immediately", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    const drawn = qm.drawNext(bank, "alice");
    assert.ok(drawn, "drawNext works right after initContestant");
    assert.strictEqual(qm.getCurrentQuestion("alice")?.id, drawn?.id);
  });

  it("drawNext returns a question and records the ID as used", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    const single = [{ id: 1, category: "test", question: "Q1", answer: "A1" }] as BankQuestion[];
    const drawn = qm.drawNext(single, "alice");
    assert.strictEqual(drawn?.id, 1);
    assert.strictEqual(drawn?.question, "Q1");
    assert.strictEqual(qm.drawNext(single, "alice"), null, "the single question is now used");
  });

  it("drawing twice returns different questions", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    const small = [
      { id: 1, category: "test", question: "Q1", answer: "A1" },
      { id: 2, category: "test", question: "Q2", answer: "A2" }
    ] as BankQuestion[];
    const first = qm.drawNext(small, "alice");
    const second = qm.drawNext(small, "alice");
    assert.ok(first && second, "both draws succeed from a 2-question bank");
    assert.notStrictEqual(first.id, second.id, "used ids are excluded on the next draw");
  });

  it("getCurrentQuestion returns the last drawn question", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    const small = [
      { id: 1, category: "test", question: "Q1", answer: "A1" },
      { id: 2, category: "test", question: "Q2", answer: "A2" }
    ] as BankQuestion[];
    qm.drawNext(small, "alice");
    const second = qm.drawNext(small, "alice");
    assert.strictEqual(qm.getCurrentQuestion("alice")?.id, second?.id);
  });

  it("contestants have independent used-id sets", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    qm.initContestant("bob");
    const single = [{ id: 1, category: "test", question: "Q1", answer: "A1" }] as BankQuestion[];
    assert.strictEqual(qm.drawNext(single, "alice")?.id, 1);
    assert.strictEqual(qm.drawNext(single, "bob")?.id, 1, "bob's set is independent of alice's");
  });

  it("drawNext returns null when the bank is exhausted", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    const single = [{ id: 1, category: "test", question: "Q1", answer: "A1" }] as BankQuestion[];
    assert.ok(qm.drawNext(single, "alice"));
    assert.strictEqual(qm.drawNext(single, "alice"), null);
  });

  it("clearContestant frees the contestant's state", () => {
    const qm = new QuestionManager();
    qm.initContestant("alice");
    const single = [{ id: 1, category: "test", question: "Q1", answer: "A1" }] as BankQuestion[];
    qm.drawNext(single, "alice");
    qm.clearContestant("alice");
    assert.strictEqual(qm.getCurrentQuestion("alice"), undefined);
    assert.strictEqual(qm.drawNext(single, "alice")?.id, 1, "the question can be drawn again");
  });
});

describe("cashBuilder", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeEach(async () => {
    colyseus = await getTestServer();
    await cleanup();
  });

  const bank = loadBank();

  async function openCashBuilder(bankOverride?: BankQuestion[]): Promise<{
    room: any;
    activeClient: any;
    benchClient: any;
    activeSeatId: string;
  }> {
    const room = await colyseus.createRoom<GameState>("trivia", {
      cashBuilderDurationMs: 8000,
      chaserSelectionDurationMs: 80,
      chaserRevealDurationMs: 80,
      revealReadyCooldownMs: 80
    });
    if (bankOverride) {
      room.questionBank = bankOverride;
    }
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    alice.send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);
    alice.send("revealReady", { characterId: "bezos" });
    bob.send("revealReady", { characterId: "nami" });
    await waitForPhase(room, GamePhase.CashBuilder);

    const activeSeatId = room.state.activeContestantSeatId;
    assert.ok(activeSeatId, "active contestant is set once the get-ready cooldown begins");
    const activeClient = seatIdOf(room, alice) === activeSeatId ? alice : bob;
    const benchClient = seatIdOf(room, alice) === activeSeatId ? bob : alice;
    return { room, activeClient, benchClient, activeSeatId };
  }

  it("a correct submitAnswer increments cashBuilderMoney and delivers a new question", async () => {
    const { room, activeClient, activeSeatId } = await openCashBuilder();

    const firstQuestion = await activeClient.waitForMessage("question");
    assert.notStrictEqual(firstQuestion, null, "the first question is delivered after the cooldown");
    assert.strictEqual(firstQuestion.targetSeatId, activeSeatId);
    assert.ok(
      !("answer" in firstQuestion),
      "the question broadcast must never leak the answer"
    );
    assert.ok("prompt" in firstQuestion && "category" in firstQuestion && "questionId" in firstQuestion);

    const canonical = bank.find((q) => q.id === firstQuestion.questionId);
    assert.ok(canonical, "question id resolves in the bank");

    const nextQuestionPromise = activeClient.waitForMessage("question");
    activeClient.send("submitAnswer", {
      answer: canonical.answer,
      questionId: firstQuestion.questionId
    });

    const nextQuestion = await nextQuestionPromise;
    const player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, CASH_BUILDER.rewardPerCorrect);
    assert.strictEqual(player.cashBuilderCorrectAnswers, 1);
    assert.notStrictEqual(nextQuestion, null, "a new question is delivered after a correct answer");
    assert.notStrictEqual(nextQuestion.questionId, firstQuestion.questionId);
  });

  it("a wrong submitAnswer leaves the pot unchanged and still delivers a new question", async () => {
    const { room, activeClient, activeSeatId } = await openCashBuilder();

    const firstQuestion = await activeClient.waitForMessage("question");
    const canonical = bank.find((q) => q.id === firstQuestion.questionId);
    assert.ok(canonical);

    const nextQuestionPromise = activeClient.waitForMessage("question");
    activeClient.send("submitAnswer", {
      answer: canonical.answer + " definitely not",
      questionId: firstQuestion.questionId
    });

    const nextQuestion = await nextQuestionPromise;
    const player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, 0, "wrong answer adds nothing to the pot");
    assert.strictEqual(player.cashBuilderCorrectAnswers, 0, "correct answers only counts correct answers");
    assert.notStrictEqual(nextQuestion, null, "a wrong answer still advances to the next question");
  });

  it("a submitAnswer from a non-active player is rejected", async () => {
    const { room, benchClient, activeSeatId } = await openCashBuilder();

    const firstQuestion = await benchClient.waitForMessage("question");
    const canonical = bank.find((q) => q.id === firstQuestion.questionId);
    assert.ok(canonical);

    benchClient.send("submitAnswer", {
      answer: canonical.answer,
      questionId: firstQuestion.questionId
    });
    await sleep(50);

    const player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, 0, "the bench can not answer for the active contestant");
    assert.strictEqual(player.cashBuilderCorrectAnswers, 0);
  });

  it("a submitAnswer outside the CashBuilder phase is rejected", async () => {
    const room = await colyseus.createRoom<GameState>("trivia", {});
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    await sleep(50);

    alice.send("submitAnswer", { answer: "Mars", questionId: 1 });
    await sleep(50);

    assert.strictEqual(room.state.currentPhase, GamePhase.Lobby, "the phase never changes on a rejected answer");
  });

  it("a submitAnswer with missing fields is rejected", async () => {
    const { room, activeClient, activeSeatId } = await openCashBuilder();

    const firstQuestion = await activeClient.waitForMessage("question");

    activeClient.send("submitAnswer", { answer: "Mars" });
    await sleep(30);
    let player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, 0, "a payload without questionId is rejected");

    activeClient.send("submitAnswer", { questionId: firstQuestion.questionId });
    await sleep(30);
    player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, 0, "a payload without answer is rejected");
    assert.strictEqual(player.cashBuilderCorrectAnswers, 0);
  });

  it("a submitAnswer that does not match the current questionId is rejected", async () => {
    const { room, activeClient, activeSeatId } = await openCashBuilder();

    await activeClient.waitForMessage("question");

    activeClient.send("submitAnswer", { answer: "Mars", questionId: 999999 });
    await sleep(50);

    const player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, 0);
    assert.strictEqual(player.cashBuilderCorrectAnswers, 0);
  });

  it("an alternative answer counts as correct", async () => {
    const bank = [
      { id: 1, category: "test", question: "Which planet is known as the Red Planet?", answer: "Mars", alternatives: ["Red planet", "Sol"] }
    ] as BankQuestion[];
    const { room, activeClient, activeSeatId } = await openCashBuilder(bank);

    const firstQuestion = await activeClient.waitForMessage("question");
    assert.strictEqual(firstQuestion.questionId, 1, "the overridden bank feeds the first question");

    const nextQuestionPromise = activeClient.waitForMessage("question");
    activeClient.send("submitAnswer", {
      answer: "red planet",
      questionId: firstQuestion.questionId
    });
    const nextQuestion = await nextQuestionPromise;

    const player = room.state.players.get(activeSeatId);
    assert.strictEqual(player.cashBuilderMoney, CASH_BUILDER.rewardPerCorrect, "an alternative answer earns the reward");
    assert.strictEqual(player.cashBuilderCorrectAnswers, 1);
    assert.strictEqual(nextQuestion, null, "the one-question bank is exhausted after the answer");
  });
});