import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { BankQuestion } from "../src/questions/bank.js";
import { cleanup, getTestServer } from "./testServer.js";
import { seatIdOf } from "./seatIdHelper.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPhase = async (
    room: { state: { currentPhase: GamePhase } },
    phase: GamePhase,
    timeoutMs = 3000
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

/** A stub `McQuestionSource` for the chase leg — every question carries one
 * fixed correct answer at a known text (mirrors chaseFlow.test.ts). */
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

function bankFixture(count: number): BankQuestion[] {
    const out: BankQuestion[] = [];
    for (let i = 1; i <= count; i += 1) {
        out.push({ id: i, question: `Final round fixture question ${i}?`, answer: `Answer ${i}` });
    }
    return out;
}

/**
 * A single contestant (the fastest path to a solo final since there's no one
 * left to hand the next round to) escapes the chase and lands the room in
 * TeamFinal. Registers `finalQuestion` listeners on **both** clients before
 * the escaping answer is sent, so the promises are in place before the
 * server-side effect that sends the message — a real websocket round trip
 * means registering afterward can race a message that already arrived.
 * Assumes `room` was already created (with mcQuestionSource/questionBank
 * already overridden).
 */
async function driveToChaseEscape(
    colyseus: ColyseusTestServer<typeof appConfig>,
    room: any
): Promise<{
    contestantClient: any;
    chaserClient: any;
    contestantSeatId: string;
    chaserSeatId: string;
    teamFinalQuestion: Promise<any>;
    chaserFinalQuestion: Promise<any>;
}> {
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

    // Registered now (before the chase even starts) so neither can race a
    // finalQuestion the server already sent before the test started listening.
    const teamFinalQuestion = contestantClient.waitForMessage("finalQuestion");
    const chaserFinalQuestion = chaserClient.waitForMessage("finalQuestion");

    chaserClient.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    chaserClient.send("setChaserHighOffer", { amount: 2000 });
    await sleep(30);

    const firstQuestionMessage = contestantClient.waitForMessage("question");
    contestantClient.send("offerChoice", { offer: "low" });
    let question = await firstQuestionMessage;

    // Correct every answer (Chaser wrong every time) to escape as fast as
    // possible from the low-tier start space.
    for (let round = 0; round < 6 && room.state.currentPhase === GamePhase.Chase; round += 1) {
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

    await waitForPhase(room, GamePhase.TeamFinal);
    return { contestantClient, chaserClient, contestantSeatId, chaserSeatId, teamFinalQuestion, chaserFinalQuestion };
}

describe("final round question delivery (ticket 077)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("startFinalTeam sends finalQuestion(team) only to the non-chaser side; the Chaser gets nothing", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 80,
            chaserSelectionDurationMs: 80,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80,
            teamFinalDurationMs: 10000,
            chaserFinalDurationMs: 10000
        });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { chaserFinalQuestion, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);

        const NOTHING = Symbol("chaser got nothing");
        const chaserOutcome = Promise.race([chaserFinalQuestion, sleep(200).then(() => NOTHING)]);
        const teamMessage = await teamFinalQuestion;
        const chaserResult = await chaserOutcome;

        assert.strictEqual(teamMessage.side, "team");
        assert.ok(typeof teamMessage.questionId === "number");
        assert.ok(typeof teamMessage.prompt === "string" && teamMessage.prompt.length > 0);
        assert.strictEqual(chaserResult, NOTHING, "the Chaser must not receive the team's finalQuestion");
    });

    it("startFinalChaser sends finalQuestion(chaser) only to the Chaser; the team side gets nothing further", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 80,
            chaserSelectionDurationMs: 80,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80,
            teamFinalDurationMs: 100,
            chaserFinalDurationMs: 10000
        });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserFinalQuestion, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        await teamFinalQuestion;

        // A second finalQuestion on the team side would mean the Chaser's
        // question leaked to the team — listen before the timer can fire.
        const NOTHING = Symbol("team got nothing further");
        const teamOutcome = Promise.race([
            contestantClient.waitForMessage("finalQuestion"),
            sleep(300).then(() => NOTHING)
        ]);

        await waitForPhase(room, GamePhase.ChaserFinal);
        const chaserMessage = await chaserFinalQuestion;
        const teamResult = await teamOutcome;

        assert.strictEqual(chaserMessage.side, "chaser");
        assert.ok(typeof chaserMessage.questionId === "number");
        assert.strictEqual(teamResult, NOTHING, "team clients must not receive the Chaser's finalQuestion");
    });

    it("no payload ever carries an answer string", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 80,
            chaserSelectionDurationMs: 80,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80,
            teamFinalDurationMs: 10000,
            chaserFinalDurationMs: 10000
        });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        assert.ok(!("answer" in teamMessage), "finalQuestion must never carry the answer");
        assert.ok(!("alternatives" in teamMessage), "finalQuestion must never carry accepted alternatives");
    });

    it("drawing successive team and chaser questions never repeats a question across either stream", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 80,
            chaserSelectionDurationMs: 80,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80,
            teamFinalDurationMs: 60,
            chaserFinalDurationMs: 60
        });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(30);

        const { teamFinalQuestion, chaserFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        await waitForPhase(room, GamePhase.ChaserFinal);
        const chaserMessage = await chaserFinalQuestion;

        assert.notStrictEqual(
            chaserMessage.questionId,
            teamMessage.questionId,
            "the Chaser's first question repeated the team's"
        );
    });

    it("bank exhaustion sends finalQuestion(side, null) on that side only, and the timer still ends the round", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            cashBuilderDurationMs: 80,
            chaserSelectionDurationMs: 80,
            chaserRevealDurationMs: 80,
            chaserCharacterRevealDurationMs: 80,
            revealReadyCooldownMs: 80,
            lineupDurationMs: 80,
            teamFinalDurationMs: 150,
            chaserFinalDurationMs: 10000
        });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = []; // empty bank: every draw is exhausted immediately

        const { teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        assert.strictEqual(teamMessage.side, "team");
        assert.strictEqual(teamMessage.questionId, null);
        assert.strictEqual(teamMessage.prompt, null);

        // The timer, not a question, ends the round even with an empty bank.
        await waitForPhase(room, GamePhase.ChaserFinal);
    });
});
