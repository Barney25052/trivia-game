import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { BOARD, CHASE_QUESTION } from "../src/gameConfig.js";
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

/** A stub `McQuestionSource` — every question carries one fixed correct
 * answer ("Correct Answer") at a known text, so a test can find its index in
 * whatever shuffled `options` the room broadcasts without needing the
 * server's secret `correctIndex`. */
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

/** Two players (one contestant, one Chaser) walked into Chase with a stub MC
 * source and a test-friendly answer window; returns the first question's
 * broadcast payload alongside the room and clients. */
async function reachChase(
    colyseus: ColyseusTestServer<typeof appConfig>,
    opts?: { chaseAnswerWindowMs?: number; offer?: "low" | "middle" | "high" }
): Promise<{
    room: any;
    contestantClient: any;
    chaserClient: any;
    contestantSeatId: string;
    chaserSeatId: string;
    firstQuestion: any;
}> {
    const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        chaseAnswerWindowMs: opts?.chaseAnswerWindowMs ?? CHASE_QUESTION.answerWindowMs
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
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const chaserSeatId = room.state.chaserSeatId;
    const contestantSeatId = room.state.activeContestantSeatId;
    const chaserClient = chaserSeatId === seatIdOf(room, alice) ? alice : bob;
    const contestantClient = contestantSeatId === seatIdOf(room, alice) ? alice : bob;

    chaserClient.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    chaserClient.send("setChaserHighOffer", { amount: 2000 });
    await sleep(30);

    const questionMessage = contestantClient.waitForMessage("question");
    contestantClient.send("offerChoice", { offer: opts?.offer ?? "middle" });
    const firstQuestion = await questionMessage;

    return { room, contestantClient, chaserClient, contestantSeatId, chaserSeatId, firstQuestion };
}

/** Three players reach Chase with a deterministic chaser (vote-mode, host voted
 * in): Alice is the active contestant, Carol is the Chaser, and Bob sits out
 * as a waiting contestant — the non-participant this ticket's guard test needs. */
async function reachChaseWithBystander(
    colyseus: ColyseusTestServer<typeof appConfig>
): Promise<{
    room: any;
    contestantClient: any;
    chaserClient: any;
    bystanderClient: any;
    contestantSeatId: string;
    firstQuestion: any;
}> {
    const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 10000,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        chaseAnswerWindowMs: CHASE_QUESTION.answerWindowMs
    });
    room.mcQuestionSource = stubChaseSource();

    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    const bob = await colyseus.connectTo(room, { playerName: "Bob" });
    await sleep(100);

    carol.send("setChaserMode", { mode: "vote" });
    await sleep(30);
    carol.send("startGame");
    await sleep(50);
    alice.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await sleep(30);
    bob.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await sleep(30);
    carol.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await waitForPhase(room, GamePhase.RolesReveal);

    alice.send("revealReady");
    bob.send("revealReady");
    carol.send("revealReady", { characterId: "bezos" });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const contestantSeatId = room.state.activeContestantSeatId;
    assert.strictEqual(contestantSeatId, seatIdOf(room, alice), "Alice is the first active contestant");

    carol.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    carol.send("setChaserHighOffer", { amount: 2000 });
    await sleep(30);

    const questionMessage = alice.waitForMessage("question");
    alice.send("offerChoice", { offer: "high" });
    const firstQuestion = await questionMessage;

    return {
        room,
        contestantClient: alice,
        chaserClient: carol,
        bystanderClient: bob,
        contestantSeatId,
        firstQuestion
    };
}

describe("chase flow (ticket 064)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("delivers an mc question narrowed to CHASE_QUESTION.optionCount options with no correctIndex, and wires the contestant's start space", async () => {
        const { room, contestantSeatId, chaserSeatId, firstQuestion } = await reachChase(colyseus, { offer: "high" });

        assert.strictEqual(firstQuestion.kind, "mc");
        assert.strictEqual(firstQuestion.options.length, CHASE_QUESTION.optionCount);
        assert.ok(!("correctIndex" in firstQuestion), "correctIndex must never be broadcast before resolution");
        assert.ok(firstQuestion.options.includes("Correct Answer"));

        assert.strictEqual(room.state.players.get(contestantSeatId).boardPos, BOARD.startHigh);
        assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, BOARD.chaserStartOffboard);
    });

    it("syncs the chosen offer amount into state.chaseWagerAmount so every client can display it (ticket 065)", async () => {
        const { room } = await reachChase(colyseus, { offer: "high" });

        assert.strictEqual(room.state.chaseWagerAmount, 2000, "the high offer set for this round was $2000");
    });

    it("both sides can advance on the same question: a correct contestant moves toward escape and a correct Chaser boards at chaserFirstCorrectSpace", async () => {
        const { room, contestantClient, chaserClient, contestantSeatId, chaserSeatId, firstQuestion } =
            await reachChase(colyseus, { offer: "high" });

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        const result = await resultPromise;

        assert.strictEqual(result.contestantCorrect, true);
        assert.strictEqual(result.chaserCorrect, true);
        assert.strictEqual(
            room.state.players.get(contestantSeatId).boardPos,
            BOARD.startHigh - 1,
            "a correct contestant answer moves them one space toward the escape space"
        );
        assert.strictEqual(
            room.state.players.get(chaserSeatId).boardPos,
            BOARD.chaserFirstCorrectSpace,
            "the Chaser's first correct answer boards them at chaserFirstCorrectSpace"
        );
    });

    it("an incorrect answer does not move that side", async () => {
        const { room, contestantClient, chaserClient, contestantSeatId, chaserSeatId, firstQuestion } =
            await reachChase(colyseus, { offer: "high" });

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const wrongIndex = (correctIndex + 1) % firstQuestion.options.length;
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: wrongIndex });
        chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: wrongIndex });
        await resultPromise;

        assert.strictEqual(room.state.players.get(contestantSeatId).boardPos, BOARD.startHigh);
        assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, BOARD.chaserStartOffboard);
    });

    it("lockout window: the round resolves from just one side's answer once the window closes, without waiting for the other side", async () => {
        const windowMs = 150;
        const { room, contestantClient, contestantSeatId, firstQuestion } =
            await reachChase(colyseus, { offer: "high", chaseAnswerWindowMs: windowMs });

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        const startedAt = Date.now();
        // Only the contestant answers; the Chaser never does.
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        const result = await resultPromise;
        const elapsedMs = Date.now() - startedAt;

        assert.ok(elapsedMs >= windowMs - 20, `expected the round to wait out the ${windowMs}ms lockout, resolved after ${elapsedMs}ms`);
        assert.strictEqual(result.contestantCorrect, true);
        assert.strictEqual(result.chaserCorrect, false, "a side that never answered counts as incorrect");
        assert.strictEqual(room.state.players.get(contestantSeatId).boardPos, BOARD.startHigh - 1);
    });

    it("broadcasts chaseLockoutStarted to every client the moment one side answers first — with no role or answer info (ticket 072)", async () => {
        const windowMs = 500;
        const { contestantClient, chaserClient, firstQuestion } =
            await reachChase(colyseus, { offer: "high", chaseAnswerWindowMs: windowMs });

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const contestantLockout = contestantClient.waitForMessage("chaseLockoutStarted");
        const chaserLockout = chaserClient.waitForMessage("chaseLockoutStarted");
        // Only the contestant answers — the Chaser is the side still deciding,
        // which must still see that a clock is running.
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        const chaserMessage = await chaserLockout;
        const contestantMessage = await contestantLockout;

        assert.strictEqual(chaserMessage.questionId, firstQuestion.questionId);
        assert.strictEqual(chaserMessage.windowMs, windowMs);
        assert.strictEqual(contestantMessage.questionId, firstQuestion.questionId);
        assert.strictEqual(contestantMessage.windowMs, windowMs);
        assert.ok(
            !("role" in chaserMessage) && !("answerIndex" in chaserMessage),
            "the lockout signal must not leak which side answered or what they picked"
        );
    });

    it("resolves immediately once both sides have answered, without waiting for the lockout window", async () => {
        const windowMs = 2000;
        const { contestantClient, chaserClient, firstQuestion } =
            await reachChase(colyseus, { offer: "high", chaseAnswerWindowMs: windowMs });

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        const startedAt = Date.now();
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        await resultPromise;
        const elapsedMs = Date.now() - startedAt;

        assert.ok(elapsedMs < windowMs, `expected an immediate resolution once both sides answered, took ${elapsedMs}ms`);
    });

    it("submitChaseAnswer rejects a malformed payload: wrong questionId/answerIndex types, out-of-range index, and a mismatched questionId", async () => {
        const { room, contestantClient, contestantSeatId, firstQuestion } = await reachChase(colyseus, { offer: "high" });

        contestantClient.send("submitChaseAnswer", { questionId: 12345, answerIndex: 0 });
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: "0" });
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 1.5 });
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: -1 });
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: firstQuestion.options.length });
        contestantClient.send("submitChaseAnswer", { questionId: "not-the-current-question", answerIndex: 0 });
        await sleep(50);

        assert.strictEqual(
            room.state.players.get(contestantSeatId).boardPos,
            BOARD.startHigh,
            "none of the malformed payloads should have moved the contestant"
        );
    });

    it("a role can only answer once per question", async () => {
        const { room, contestantClient, contestantSeatId, firstQuestion } = await reachChase(colyseus, { offer: "high" });

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const wrongIndex = (correctIndex + 1) % firstQuestion.options.length;
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: wrongIndex });
        await sleep(30);
        // A second answer from the same role for the same question is ignored —
        // the first (wrong) answer stands.
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        await sleep(30);

        assert.strictEqual(room.state.currentPhase, GamePhase.Chase, "still mid-question — the Chaser hasn't answered");
        assert.strictEqual(room.state.players.get(contestantSeatId).boardPos, BOARD.startHigh);
    });

    it("catch: the Chaser reaching the contestant's space ends the chase and eliminates the contestant", async () => {
        // Low tier starts the contestant closest to the Chaser (BOARD.startLow),
        // so a Chaser-only streak of correct answers catches up in two rounds:
        // offboard -> chaserFirstCorrectSpace, then one decrement onto startLow.
        const { room, contestantClient, chaserClient, contestantSeatId, firstQuestion } =
            await reachChase(colyseus, { offer: "low" });

        let question = firstQuestion;
        for (let round = 0; round < 4; round += 1) {
            if (room.state.currentPhase !== GamePhase.Chase) {
                break;
            }
            const correctIndex = question.options.indexOf("Correct Answer");
            const wrongIndex = (correctIndex + 1) % question.options.length;
            const nextQuestionOrPhase = Promise.race([
                contestantClient.waitForMessage("question").then((q: any) => ({ q })),
                (async () => {
                    while (room.state.currentPhase === GamePhase.Chase) {
                        await sleep(10);
                    }
                    return { q: null };
                })()
            ]);
            contestantClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
            chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
            const { q } = await nextQuestionOrPhase;
            question = q;
        }

        // Only one contestant in this 2-player room — once they're caught there's
        // no next contestant, so the round moves straight to the team final.
        assert.strictEqual(room.state.currentPhase, GamePhase.TeamFinal);
        assert.strictEqual(room.state.players.get(contestantSeatId).isEliminated, true);
    });

    it("escape: the contestant reaching the escape space ends the chase and pays the team pot", async () => {
        const { room, contestantClient, chaserClient, contestantSeatId, firstQuestion } =
            await reachChase(colyseus, { offer: "low" });

        let question = firstQuestion;
        for (let round = 0; round < 4; round += 1) {
            if (room.state.currentPhase !== GamePhase.Chase) {
                break;
            }
            const correctIndex = question.options.indexOf("Correct Answer");
            const wrongIndex = (correctIndex + 1) % question.options.length;
            const nextQuestionOrPhase = Promise.race([
                contestantClient.waitForMessage("question").then((q: any) => ({ q })),
                (async () => {
                    while (room.state.currentPhase === GamePhase.Chase) {
                        await sleep(10);
                    }
                    return { q: null };
                })()
            ]);
            contestantClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
            chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
            const { q } = await nextQuestionOrPhase;
            question = q;
        }

        // Only one contestant in this 2-player room — once they escape there's
        // no next contestant, so the round moves straight to the team final.
        assert.strictEqual(room.state.currentPhase, GamePhase.TeamFinal);
        assert.strictEqual(room.state.players.get(contestantSeatId).madeItBack, true);
        assert.strictEqual(room.state.teamPot, 0, "the low-tier offer for this round was $0");
    });

    it("a non-participant (a waiting contestant) cannot submit a chase answer (ticket 076)", async () => {
        const { room, bystanderClient, contestantSeatId, firstQuestion } =
            await reachChaseWithBystander(colyseus);

        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const NO_LOCKOUT = Symbol("no lockout broadcast");
        const lockoutOrTimeout = Promise.race([
            bystanderClient.waitForMessage("chaseLockoutStarted"),
            sleep(150).then(() => NO_LOCKOUT)
        ]);
        bystanderClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        const outcome = await lockoutOrTimeout;

        assert.strictEqual(
            outcome,
            NO_LOCKOUT,
            "a rejected non-participant answer must not start the lockout window"
        );
        assert.strictEqual(
            room.state.players.get(contestantSeatId).boardPos,
            BOARD.startHigh,
            "a stray answer from a non-participant must not move the board"
        );
        assert.strictEqual(room.state.currentPhase, GamePhase.Chase, "the round must still be answerable");
    });
});
