import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
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

const bank = loadBank();

/**
 * Walk the flow into CashBuilder with a known active contestant.
 */
async function openCashBuilder(
    colyseus: ColyseusTestServer<typeof appConfig>,
    opts?: { bankOverride?: BankQuestion[]; cashBuilderDurationMs?: number; wrongAnswerRevealMs?: number }
): Promise<{
    room: any;
    activeClient: any;
    benchClient: any;
    activeSeatId: string;
}> {
    const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: opts?.cashBuilderDurationMs ?? 8000,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        wrongAnswerRevealMs: opts?.wrongAnswerRevealMs ?? 0
    });
    if (opts?.bankOverride) {
        room.questionBank = opts.bankOverride;
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
    assert.ok(activeSeatId, "active contestant is set once cash builder starts");
    const activeClient = seatIdOf(room, alice) === activeSeatId ? alice : bob;
    const benchClient = seatIdOf(room, alice) === activeSeatId ? bob : alice;
    return { room, activeClient, benchClient, activeSeatId };
}

describe("cashBuilderFlow (integration)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("full cash builder round: correct answer → pot++, wrong answer → pot unchanged, timer → Offer with correct pot", async () => {
        const { room, activeClient, activeSeatId } = await openCashBuilder(colyseus, {
            cashBuilderDurationMs: 80
        });

        const offerStartPromise = activeClient.waitForMessage("offerStart");

        const q1 = await activeClient.waitForMessage("question");
        assert.ok(q1, "first question is delivered after cooldown");
        assert.strictEqual(q1.targetSeatId, activeSeatId);
        assert.ok(!("answer" in q1), "question must not leak the answer");
        assert.ok(typeof q1.questionId === "number");
        assert.ok(typeof q1.prompt === "string");
        assert.ok(typeof q1.category === "string");

        const canonical1 = bank.find((q) => q.id === q1.questionId);
        assert.ok(canonical1, "question id resolves in the bank");

        const q2Promise = activeClient.waitForMessage("question");
        activeClient.send("submitAnswer", {
            answer: canonical1.answer,
            questionId: q1.questionId
        });
        const q2 = await q2Promise;
        assert.ok(q2, "a new question arrives after a correct answer");
        assert.notStrictEqual(q2.questionId, q1.questionId, "questions are non-repeating");
        assert.strictEqual(
            room.state.players.get(activeSeatId).cashBuilderMoney,
            CASH_BUILDER.rewardPerCorrect,
            "correct answer adds $1000 to pot"
        );
        assert.strictEqual(
            room.state.players.get(activeSeatId).cashBuilderCorrectAnswers,
            1
        );

        const canonical2 = bank.find((q) => q.id === q2.questionId);
        assert.ok(canonical2);

        const q3Promise = activeClient.waitForMessage("question");
        activeClient.send("submitAnswer", {
            answer: "this is definitely not the answer",
            questionId: q2.questionId
        });
        const q3 = await q3Promise;
        assert.ok(q3, "a new question arrives after a wrong answer");
        assert.strictEqual(
            room.state.players.get(activeSeatId).cashBuilderMoney,
            CASH_BUILDER.rewardPerCorrect,
            "wrong answer does not change the pot"
        );
        assert.strictEqual(
            room.state.players.get(activeSeatId).cashBuilderCorrectAnswers,
            1,
            "wrong answer does not increment questions asked"
        );

        const offerStart = await offerStartPromise;
        assert.strictEqual(room.state.currentPhase, GamePhase.Offer);
        assert.strictEqual(
            offerStart.middle,
            CASH_BUILDER.rewardPerCorrect,
            "middle offer equals the earned pot"
        );
    });

    it("a correct answer patches the pot to BOTH clients: the active contestant and the bench spectator observe the incremented cashBuilderMoney (ticket 048)", async () => {
        const { room, activeClient, benchClient, activeSeatId } = await openCashBuilder(colyseus, {
            cashBuilderDurationMs: 800
        });

        const q1 = await activeClient.waitForMessage("question");
        const canonical1 = bank.find((q) => q.id === q1.questionId);
        assert.ok(canonical1, "question id resolves in the bank");

        // Attach the reactive state readers that mirror the client render path
        // (App.vue onStateChange -> players array -> activeContestantMoney).
        const observed: Record<string, number> = {
            active: -1,
            bench: -1
        };
        const reader = (label: string, player: string) => (state: any) => {
            const value = state.players.get(player)?.cashBuilderMoney;
            if (typeof value === "number") observed[label] = value;
        };
        activeClient.onStateChange(reader("active", activeSeatId));
        benchClient.onStateChange(reader("bench", activeSeatId));

        activeClient.send("submitAnswer", {
            answer: canonical1.answer,
            questionId: q1.questionId
        });

        const deadline = Date.now() + 1500;
        while (Date.now() < deadline && observed.active !== CASH_BUILDER.rewardPerCorrect) {
            await sleep(20);
        }

        assert.strictEqual(
            observed.active,
            CASH_BUILDER.rewardPerCorrect,
            "active contestant's client sees the pot grow"
        );
        assert.strictEqual(
            observed.bench,
            CASH_BUILDER.rewardPerCorrect,
            "bench spectator's client sees the pot grow"
        );
        assert.strictEqual(
            room.state.players.get(activeSeatId).cashBuilderMoney,
            CASH_BUILDER.rewardPerCorrect,
            "server state agrees"
        );
    });

    it("submitAnswer sends an answerResult to the submitting client only, with correct/wrong flag and the correct answer text", async () => {
        const { activeClient, benchClient } = await openCashBuilder(colyseus, {
            cashBuilderDurationMs: 8000
        });

        const q1 = await activeClient.waitForMessage("question");
        const canonical1 = bank.find((q) => q.id === q1.questionId)!;

        const benchGotResult = benchClient.waitForMessage("answerResult");
        const activeResult1 = activeClient.waitForMessage("answerResult");
        const q2Promise = activeClient.waitForMessage("question");
        activeClient.send("submitAnswer", { answer: canonical1.answer, questionId: q1.questionId });
        const result1 = await activeResult1;
        assert.strictEqual(result1.correct, true, "correct answer reports correct: true");
        assert.strictEqual(result1.correctAnswer, canonical1.answer);

        const q2 = await q2Promise;
        const canonical2 = bank.find((q) => q.id === q2.questionId)!;

        const activeResult2 = activeClient.waitForMessage("answerResult");
        activeClient.send("submitAnswer", { answer: "definitely wrong", questionId: q2.questionId });
        const result2 = await activeResult2;
        assert.strictEqual(result2.correct, false, "wrong answer reports correct: false");
        assert.strictEqual(result2.correctAnswer, canonical2.answer, "wrong answer reveals the correct answer text");

        const raceTimeout = new Promise((resolve) => setTimeout(() => resolve("no-result"), 200));
        assert.strictEqual(
            await Promise.race([benchGotResult, raceTimeout]),
            "no-result",
            "the bench spectator never receives answerResult"
        );
    });

    it("a wrong answer holds the correct-answer reveal for wrongAnswerRevealMs before the next question is delivered", async () => {
        const { activeClient } = await openCashBuilder(colyseus, {
            cashBuilderDurationMs: 8000,
            wrongAnswerRevealMs: 300
        });

        const q1 = await activeClient.waitForMessage("question");

        const start = Date.now();
        const q2Promise = activeClient.waitForMessage("question");
        activeClient.send("submitAnswer", { answer: "definitely wrong", questionId: q1.questionId });
        await q2Promise;
        const elapsed = Date.now() - start;
        assert.ok(elapsed >= 300, `next question should be held back for the reveal window (elapsed ${elapsed}ms)`);
    });

    it("submitAnswer from a non-active player is rejected (no pot change, no question advance)", async () => {
        const { room, benchClient, activeClient, activeSeatId } = await openCashBuilder(colyseus);

        const q1 = await activeClient.waitForMessage("question");
        const canonical = bank.find((q) => q.id === q1.questionId);
        assert.ok(canonical);

        benchClient.send("submitAnswer", {
            answer: canonical.answer,
            questionId: q1.questionId
        });
        await sleep(50);

        const player = room.state.players.get(activeSeatId);
        assert.strictEqual(player.cashBuilderMoney, 0, "bench answer does not affect pot");
        assert.strictEqual(player.cashBuilderCorrectAnswers, 0);
    });

    it("submitAnswer in the Offer phase is rejected", async () => {
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

        alice.send("startGame");
        await waitForPhase(room, GamePhase.RolesReveal);
        alice.send("revealReady", { characterId: "bezos" });
        bob.send("revealReady", { characterId: "nami" });
        await waitForPhase(room, GamePhase.Offer);

        const active = room.state.activeContestantSeatId;
        const activeClient = seatIdOf(room, alice) === active ? alice : bob;

        activeClient.send("submitAnswer", { answer: "Mars", questionId: 1 });
        await sleep(50);

        assert.strictEqual(room.state.currentPhase, GamePhase.Offer, "phase does not change on a rejected answer");
    });

    it("submitAnswer with missing answer field is rejected", async () => {
        const { room, activeClient } = await openCashBuilder(colyseus);

        const q1 = await activeClient.waitForMessage("question");

        activeClient.send("submitAnswer", { questionId: q1.questionId });
        await sleep(30);

        assert.strictEqual(room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney, 0);
    });

    it("submitAnswer with missing questionId field is rejected", async () => {
        const { room, activeClient } = await openCashBuilder(colyseus);

        await activeClient.waitForMessage("question");

        activeClient.send("submitAnswer", { answer: "Mars" });
        await sleep(30);

        assert.strictEqual(room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney, 0);
    });

    it("submitAnswer with wrong questionId is rejected", async () => {
        const { room, activeClient, activeSeatId } = await openCashBuilder(colyseus);

        await activeClient.waitForMessage("question");

        activeClient.send("submitAnswer", { answer: "Mars", questionId: 999999 });
        await sleep(50);

        assert.strictEqual(room.state.players.get(activeSeatId).cashBuilderMoney, 0);
        assert.strictEqual(room.state.players.get(activeSeatId).cashBuilderCorrectAnswers, 0);
    });

    it("bank exhaustion: a tiny bank of 2 questions is drained, then null is broadcast and the timer still transitions to Offer", async () => {
        const tinyBank: BankQuestion[] = [
            { id: 1, category: "test", question: "What is 2+2?", answer: "4" },
            { id: 2, category: "test", question: "Capital of France?", answer: "Paris" }
        ];
        const { room, activeClient, activeSeatId } = await openCashBuilder(colyseus, {
            bankOverride: tinyBank,
            cashBuilderDurationMs: 80
        });

        const offerStartPromise = activeClient.waitForMessage("offerStart");

        const q1 = await activeClient.waitForMessage("question");
        const c1 = tinyBank.find((q) => q.id === q1.questionId)!;
        const q2Promise = activeClient.waitForMessage("question");
        activeClient.send("submitAnswer", { answer: c1.answer, questionId: q1.questionId });
        const q2 = await q2Promise;
        assert.ok(q2, "second question delivered from the 2-question bank");

        const c2 = tinyBank.find((q) => q.id === q2.questionId)!;
        const exhaustedPromise = activeClient.waitForMessage("question");
        activeClient.send("submitAnswer", { answer: c2.answer, questionId: q2.questionId });

        const exhausted = await exhaustedPromise;
        assert.strictEqual(exhausted, null, "null payload signals the bank is exhausted");
        assert.strictEqual(
            room.state.players.get(activeSeatId).cashBuilderMoney,
            CASH_BUILDER.rewardPerCorrect * 2,
            "both correct answers added to the pot"
        );

        const offerStart = await offerStartPromise;
        assert.strictEqual(room.state.currentPhase, GamePhase.Offer);
        assert.strictEqual(offerStart.middle, CASH_BUILDER.rewardPerCorrect * 2);
    });
});
