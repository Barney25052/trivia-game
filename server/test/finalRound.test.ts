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

/**
 * Connects every named player, starts the game, clears the roles-reveal gate,
 * then drives every contestant's cash builder/offer/chase to an escape
 * (chaser always wrong) until the room reaches TeamFinal. Generalizes
 * `driveToChaseEscape` to any number of contestants (ticket 082's multi-buzz
 * scenarios need at least two team seats).
 */
async function driveAllToTeamFinal(
    colyseus: ColyseusTestServer<typeof appConfig>,
    room: any,
    playerNames: string[]
): Promise<{ clients: any[]; chaserClient: any; chaserSeatId: string; contestantClients: any[] }> {
    const clients = [];
    for (const name of playerNames) {
        clients.push(await colyseus.connectTo(room, { playerName: name }));
    }
    await sleep(100);

    clients[0].send("startGame");
    await waitForPhase(room, GamePhase.RolesReveal);

    const chaserSeatId = room.state.chaserSeatId;
    const chaserClient = clients.find((c: any) => seatIdOf(room, c) === chaserSeatId);
    const contestantClients = clients.filter((c: any) => c !== chaserClient);

    chaserClient.send("revealReady", { characterId: "bezos" });
    for (const c of contestantClients) {
        c.send("revealReady", {});
    }
    await waitForPhase(room, GamePhase.CashBuilder);

    while (room.state.currentPhase !== GamePhase.TeamFinal) {
        if (room.state.currentPhase === GamePhase.CashBuilder) {
            const activeSeatId = room.state.activeContestantSeatId;
            room.state.players.get(activeSeatId).cashBuilderMoney = 1000;
            await waitForPhase(room, GamePhase.Offer);
            continue;
        }
        if (room.state.currentPhase === GamePhase.Offer) {
            const activeSeatId = room.state.activeContestantSeatId;
            const activeClient = contestantClients.find((c: any) => seatIdOf(room, c) === activeSeatId);
            chaserClient.send("setChaserLowOffer", { amount: 0 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 2000 });
            await sleep(30);
            const firstQuestionMessage = activeClient.waitForMessage("question");
            activeClient.send("offerChoice", { offer: "low" });
            let question = await firstQuestionMessage;
            for (let round = 0; round < 6 && room.state.currentPhase === GamePhase.Chase; round += 1) {
                const correctIndex = question.options.indexOf("Correct Answer");
                const wrongIndex = (correctIndex + 1) % question.options.length;
                const nextQuestionOrPhase = Promise.race([
                    activeClient.waitForMessage("question").then((q: any) => ({ q })),
                    (async () => {
                        while (room.state.currentPhase === GamePhase.Chase) {
                            await sleep(10);
                        }
                        return { q: null };
                    })()
                ]);
                activeClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
                chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
                const { q } = await nextQuestionOrPhase;
                question = q;
            }
            continue;
        }
        await sleep(10);
    }

    return { clients, chaserClient, chaserSeatId, contestantClients };
}

describe("final round — team buzz-in and answers (ticket 078)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    const roomOptions = {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalDurationMs: 10000,
        chaserFinalDurationMs: 10000,
        finalWrongAnswerRevealMs: 100
    };

    it("first buzzIn locks the question; a second buzz is rejected; finalBuzz broadcasts the winner", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        const buzzBroadcast = contestantClient.waitForMessage("finalBuzz");
        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        const buzz = await buzzBroadcast;
        assert.strictEqual(buzz.questionId, teamMessage.questionId);
        assert.strictEqual(buzz.seatId, seatIdOf(room, contestantClient));
        assert.strictEqual(room.currentFinalTeamBuzzer, seatIdOf(room, contestantClient));

        // A second buzz (even from the Chaser, who shouldn't be buzzing anyway) is ignored.
        chaserClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(100);
        assert.strictEqual(room.currentFinalTeamBuzzer, seatIdOf(room, contestantClient));
    });

    it("only the buzzer's submitFinalAnswer is accepted", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        // The Chaser never buzzes, so it never becomes the buzzer — its submit is rejected
        // and must not touch the score.
        const scoreBefore = room.state.teamScore;
        chaserClient.send("submitFinalAnswer", { questionId: teamMessage.questionId, answer: "wrong on purpose" });
        await sleep(100);
        assert.strictEqual(room.state.teamScore, scoreBefore);

        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(50);

        chaserClient.send("submitFinalAnswer", { questionId: teamMessage.questionId, answer: "irrelevant" });
        await sleep(100);
        assert.strictEqual(room.state.teamScore, scoreBefore, "a non-buzzer's answer must not resolve the question");
    });

    it("correct answer advances teamScore and delivers the next finalQuestion immediately", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;
        const scoreBefore = room.state.teamScore;

        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(50);

        const nextQuestion = contestantClient.waitForMessage("finalQuestion");
        const answerResult = contestantClient.waitForMessage("answerResult");
        // The fixture's canonical answer is "Answer <id>".
        contestantClient.send("submitFinalAnswer", { questionId: teamMessage.questionId, answer: `Answer ${teamMessage.questionId}` });

        const result = await answerResult;
        assert.strictEqual(result.correct, true);
        assert.strictEqual(room.state.teamScore, scoreBefore + 1);

        const next = await nextQuestion;
        assert.strictEqual(next.side, "team");
        assert.notStrictEqual(next.questionId, teamMessage.questionId);
        assert.strictEqual(room.currentFinalTeamBuzzer, null, "the new question reopens the buzz");
    });

    it("wrong answer holds the reveal before the next question, and rejects anything for the resolved question", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, finalWrongAnswerRevealMs: 150 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;
        const scoreBefore = room.state.teamScore;

        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(50);

        const answerResult = contestantClient.waitForMessage("answerResult");
        contestantClient.send("submitFinalAnswer", { questionId: teamMessage.questionId, answer: "definitely not it" });
        const result = await answerResult;
        assert.strictEqual(result.correct, false);
        assert.strictEqual(room.state.teamScore, scoreBefore);

        // Immediately after: the question is resolved but not yet advanced — a
        // second buzz/submit for it must be rejected.
        const NOTHING = Symbol("no finalBuzz");
        const staleOutcome = Promise.race([
            contestantClient.waitForMessage("finalBuzz"),
            sleep(50).then(() => NOTHING)
        ]);
        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        assert.strictEqual(await staleOutcome, NOTHING, "a resolved question must not accept a fresh buzz");

        const nextQuestion = await contestantClient.waitForMessage("finalQuestion");
        assert.notStrictEqual(nextQuestion.questionId, teamMessage.questionId);
    });

    it("an eliminated contestant can still buzz and answer, and it counts", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, contestantSeatId, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        room.state.players.get(contestantSeatId).isEliminated = true;
        const teamMessage = await teamFinalQuestion;
        const scoreBefore = room.state.teamScore;

        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(50);
        assert.strictEqual(room.currentFinalTeamBuzzer, contestantSeatId);

        const answerResult = contestantClient.waitForMessage("answerResult");
        contestantClient.send("submitFinalAnswer", { questionId: teamMessage.questionId, answer: `Answer ${teamMessage.questionId}` });
        await answerResult;
        assert.strictEqual(room.state.teamScore, scoreBefore + 1);
    });

    it("the Chaser's buzzIn and submitFinalAnswer are rejected", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { chaserClient, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        chaserClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(80);
        assert.strictEqual(room.currentFinalTeamBuzzer, null);

        chaserClient.send("submitFinalAnswer", { questionId: teamMessage.questionId, answer: `Answer ${teamMessage.questionId}` });
        await sleep(80);
        assert.strictEqual(room.state.teamScore, 1, "team started at 1 survivor; the Chaser's answer must not change it");
    });

    it("buzzIn/submitFinalAnswer outside TeamFinal, malformed, or with a stale questionId are rejected", async () => {
        // Outside TeamFinal (still in Lobby): both are ignored — a separate
        // room, since the driveToChaseEscape below needs its own fresh host.
        const lobbyRoom = await colyseus.createRoom<GameState>("trivia", roomOptions);
        const solo = await colyseus.connectTo(lobbyRoom, { playerName: "Solo" });
        await sleep(100);
        solo.send("buzzIn", { questionId: 1 });
        solo.send("submitFinalAnswer", { questionId: 1, answer: "x" });
        await sleep(50);
        assert.strictEqual(lobbyRoom.state.currentPhase, GamePhase.Lobby);

        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, teamFinalQuestion } = await driveToChaseEscape(colyseus, room);
        const teamMessage = await teamFinalQuestion;

        // Malformed payloads.
        contestantClient.send("buzzIn", {});
        contestantClient.send("buzzIn", { questionId: "not-a-number" });
        await sleep(50);
        assert.strictEqual(room.currentFinalTeamBuzzer, null);

        // Stale questionId.
        contestantClient.send("buzzIn", { questionId: teamMessage.questionId + 999 });
        await sleep(50);
        assert.strictEqual(room.currentFinalTeamBuzzer, null);

        contestantClient.send("buzzIn", { questionId: teamMessage.questionId });
        await sleep(50);
        contestantClient.send("submitFinalAnswer", { questionId: teamMessage.questionId + 999, answer: "x" });
        await sleep(50);
        assert.strictEqual(room.state.teamScore, 1, "a stale-questionId submit must not resolve anything");
    });

    it("the buzzer leaving before answering releases the buzz for a later buzzer", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 5000 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        // Four players guarantees at least two non-host contestants regardless
        // of who is picked as chaser — leaving the host would disconnect the
        // whole room (unrelated onLeave behavior), which isn't what this test
        // is exercising.
        const { contestantClients } = await driveAllToTeamFinal(colyseus, room, ["Alice", "Bob", "Charlie", "Dave"]);
        const nonHostContestants = contestantClients.filter(
            (c: any) => room.state.players.get(seatIdOf(room, c))?.isHost !== true
        );
        assert.ok(nonHostContestants.length >= 2, "need two non-host contestants for this scenario");

        const [firstContestant, secondContestant] = nonHostContestants;
        const question = room.finalRoundQuestions.getCurrentQuestion("team");
        assert.ok(question, "team should have a live final question");

        firstContestant.send("buzzIn", { questionId: question!.id });
        await sleep(50);
        assert.strictEqual(room.currentFinalTeamBuzzer, seatIdOf(room, firstContestant));

        firstContestant.leave();
        await sleep(150);
        assert.strictEqual(room.currentFinalTeamBuzzer, null, "the departed buzzer's lock must be released");

        secondContestant.send("buzzIn", { questionId: question!.id });
        await sleep(50);
        assert.strictEqual(room.currentFinalTeamBuzzer, seatIdOf(room, secondContestant));
    });

    it("no buzz at all: the question stays available and the round still ends on finalTeamTimeout", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 150 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        await driveToChaseEscape(colyseus, room);
        await waitForPhase(room, GamePhase.ChaserFinal);
        assert.strictEqual(room.state.teamScore, 1, "no one buzzed, so the score never moved off the survivor count");
    });
});

describe("final round — Chaser answer engine and steal (ticket 079)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    const roomOptions = {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalDurationMs: 80,
        chaserFinalDurationMs: 10000,
        stealWindowMs: 150
    };

    async function toChaserFinal(colyseus: ColyseusTestServer<typeof appConfig>, room: any) {
        const driven = await driveToChaseEscape(colyseus, room);
        await driven.teamFinalQuestion;
        await waitForPhase(room, GamePhase.ChaserFinal);
        const chaserMessage = await driven.chaserFinalQuestion;
        return { ...driven, chaserMessage };
    }

    it("correct Chaser answers advance chaserScore and reaching the team's score (a tie) wins", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        assert.strictEqual(room.state.teamScore, 1);

        const endGame = chaserClient.waitForMessage("endGame");
        const result = chaserClient.waitForMessage("answerResult");
        chaserClient.send("submitFinalChaserAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        assert.strictEqual((await result).correct, true);
        assert.strictEqual(room.state.chaserScore, 1);
        const end = await endGame;
        assert.strictEqual(end.winner, "chaser");
        await waitForPhase(room, GamePhase.GameEnd);
    });

    it("the Chaser never buzzes: a buzzIn from the Chaser during ChaserFinal is rejected", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        chaserClient.send("buzzIn", { questionId: chaserMessage.questionId });
        await sleep(80);
        assert.strictEqual(room.currentFinalTeamBuzzer, null);
        assert.strictEqual(room.state.currentPhase, GamePhase.ChaserFinal);
    });

    it("a wrong Chaser answer opens a steal window; a correct steal pushes the Chaser back while above 0", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 80 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        room.state.chaserScore = 2;

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        const stealMessage = await steal;
        assert.strictEqual(stealMessage.questionId, chaserMessage.questionId);
        assert.strictEqual(stealMessage.windowMs, room.stealWindowMs);
        assert.ok(!("answer" in stealMessage));

        const resolved = contestantClient.waitForMessage("finalStealResolved");
        contestantClient.send("submitFinalStealAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        const resolvedMessage = await resolved;
        assert.strictEqual(resolvedMessage.pushedBack, true);
        assert.strictEqual(room.state.chaserScore, 1);
    });

    it("a correct steal while chaserScore is 0 raises the team's target instead", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 80 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        assert.strictEqual(room.state.chaserScore, 0);
        const teamScoreBefore = room.state.teamScore;

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;

        contestantClient.send("submitFinalStealAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        await sleep(80);
        assert.strictEqual(room.state.chaserScore, 0);
        assert.strictEqual(room.state.teamScore, teamScoreBefore + 1);
    });

    it("a wrong first steal answer closes the window with no effect, and a second answer is rejected as stale", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 80 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        room.state.chaserScore = 3;

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;

        contestantClient.send("submitFinalStealAnswer", { questionId: chaserMessage.questionId, answer: "wrong steal guess" });
        await sleep(80);
        assert.strictEqual(room.state.chaserScore, 3, "a wrong steal must not move the score");
        assert.strictEqual(room.finalStealActive, false, "the window closes after the first attempt");

        contestantClient.send("submitFinalStealAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        await sleep(80);
        assert.strictEqual(room.state.chaserScore, 3, "a second steal attempt must be rejected as stale");
    });

    it("an unclaimed steal (window expires) advances the Chaser with no score change", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 80, stealWindowMs: 100 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        room.state.chaserScore = 3;

        const steal = contestantClient.waitForMessage("finalSteal");
        const nextChaserQuestion = chaserClient.waitForMessage("finalQuestion");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;

        const next = await nextChaserQuestion;
        assert.notStrictEqual(next.questionId, chaserMessage.questionId);
        assert.strictEqual(room.state.chaserScore, 3);
        assert.strictEqual(room.state.teamScore, room.state.teamScore);
    });

    it("only the Chaser can submitFinalChaserAnswer; only non-Chasers can submitFinalStealAnswer", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 80, stealWindowMs: 2000 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClient, chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);

        contestantClient.send("submitFinalChaserAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        await sleep(80);
        assert.strictEqual(room.state.chaserScore, 0, "a non-Chaser must not be able to answer for the Chaser");

        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await sleep(80);
        assert.strictEqual(room.finalStealActive, true);

        chaserClient.send("submitFinalStealAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        await sleep(80);
        assert.strictEqual(room.finalStealActive, true, "the Chaser must not be able to steal from itself");
    });

    it("malformed and out-of-phase submissions are rejected", async () => {
        // Out-of-phase check on its own room — a separate host from the one
        // driveToChaseEscape below connects.
        const lobbyRoom = await colyseus.createRoom<GameState>("trivia", roomOptions);
        const solo = await colyseus.connectTo(lobbyRoom, { playerName: "Solo" });
        await sleep(100);
        solo.send("submitFinalChaserAnswer", { questionId: 1, answer: "x" });
        solo.send("submitFinalStealAnswer", { questionId: 1, answer: "x" });
        await sleep(50);
        assert.strictEqual(lobbyRoom.state.currentPhase, GamePhase.Lobby);

        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { chaserClient, chaserMessage } = await toChaserFinal(colyseus, room);
        chaserClient.send("submitFinalChaserAnswer", {});
        chaserClient.send("submitFinalChaserAnswer", { questionId: "nope", answer: 5 });
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId + 999, answer: "x" });
        await sleep(80);
        assert.strictEqual(room.state.chaserScore, 0);
        assert.strictEqual(room.finalStealActive, false);
    });

    it("finalChaserTimeout still ends the game with the team winning", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, chaserFinalDurationMs: 150 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        await toChaserFinal(colyseus, room);
        await waitForPhase(room, GamePhase.GameEnd);
    });
});

describe("Phase 5 integration — full final round end-to-end (ticket 082)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    const roomOptions = {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalDurationMs: 10000,
        chaserFinalDurationMs: 10000,
        finalWrongAnswerRevealMs: 60,
        stealWindowMs: 2000
    };

    it("a buzz race between two team contestants: only the first buzzer's submit is accepted", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        const { contestantClients } = await driveAllToTeamFinal(colyseus, room, ["Alice", "Bob", "Charlie"]);
        const [racerA, racerB] = contestantClients;
        const question = room.finalRoundQuestions.getCurrentQuestion("team");
        assert.ok(question, "team should have a live final question");

        const buzzBroadcastA = racerA.waitForMessage("finalBuzz");
        racerA.send("buzzIn", { questionId: question!.id });
        racerB.send("buzzIn", { questionId: question!.id });
        const winningBuzz = await buzzBroadcastA;
        assert.strictEqual(winningBuzz.seatId, seatIdOf(room, racerA));
        assert.strictEqual(room.currentFinalTeamBuzzer, seatIdOf(room, racerA));

        const scoreBefore = room.state.teamScore;
        racerB.send("submitFinalAnswer", { questionId: question!.id, answer: `Answer ${question!.id}` });
        await sleep(80);
        assert.strictEqual(room.state.teamScore, scoreBefore, "the second buzzer's answer must not resolve the question");

        const answerResult = racerA.waitForMessage("answerResult");
        racerA.send("submitFinalAnswer", { questionId: question!.id, answer: `Answer ${question!.id}` });
        assert.strictEqual((await answerResult).correct, true);
        assert.strictEqual(room.state.teamScore, scoreBefore + 1, "only the winning buzzer's answer counts");
    });

    it("full walk: team buzzing, eliminated players counting, a Chaser steal, then a Chaser win by reaching the team score", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", roomOptions);
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(30);

        const { contestantClients, chaserClient } = await driveAllToTeamFinal(colyseus, room, ["Alice", "Bob", "Charlie"]);
        // Everyone escaped the chase, so nobody is actually eliminated — flip one
        // seat's flag directly to exercise "an eliminated contestant still counts".
        const eliminatedSeatId = seatIdOf(room, contestantClients[0]);
        room.state.players.get(eliminatedSeatId).isEliminated = true;

        let teamQuestion = room.finalRoundQuestions.getCurrentQuestion("team");
        assert.ok(teamQuestion, "team should have a live final question");

        // Round 1: the eliminated contestant buzzes and answers correctly.
        // Polling `room` directly (rather than waiting on a client message)
        // sidesteps the two-listener race of "who gets notified first" —
        // `advanceFinalTeamQuestion` runs synchronously server-side, so the
        // draw is already reflected in room state as soon as the send lands.
        let beforeRound = room.state.teamScore;
        contestantClients[0].send("buzzIn", { questionId: teamQuestion!.id });
        await sleep(50);
        contestantClients[0].send("submitFinalAnswer", { questionId: teamQuestion!.id, answer: `Answer ${teamQuestion!.id}` });
        await sleep(80);
        assert.strictEqual(room.state.teamScore, beforeRound + 1, "the eliminated player's correct answer still counts");
        teamQuestion = room.finalRoundQuestions.getCurrentQuestion("team");
        assert.ok(teamQuestion, "team should have a fresh final question after round 1");

        // Round 2: a different contestant buzzes and answers correctly.
        beforeRound = room.state.teamScore;
        contestantClients[1].send("buzzIn", { questionId: teamQuestion!.id });
        await sleep(50);
        contestantClients[1].send("submitFinalAnswer", { questionId: teamQuestion!.id, answer: `Answer ${teamQuestion!.id}` });
        await sleep(80);
        assert.strictEqual(room.state.teamScore, beforeRound + 1);

        room.dispatch({ type: "finalTeamTimeout" });
        await waitForPhase(room, GamePhase.ChaserFinal);
        const target = room.state.teamScore;

        // Chaser misses once — the team steals correctly, pushing the Chaser back.
        let chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
        assert.ok(chaserQuestion, "chaser should have a live final question");
        room.state.chaserScore = 1;
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserQuestion!.id, answer: "not it at all" });
        await sleep(50);
        assert.strictEqual(room.finalStealActive, true, "a Chaser miss opens the steal window");
        contestantClients[0].send("submitFinalStealAnswer", {
            questionId: chaserQuestion!.id,
            answer: `Answer ${chaserQuestion!.id}`
        });
        await sleep(80);
        assert.strictEqual(room.state.chaserScore, 0, "a correct steal above 0 pushes the Chaser back");
        assert.strictEqual(room.state.teamScore, target, "the target is unaffected once the Chaser was still above 0 pre-steal");
        chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");

        // Chaser now climbs correct-answer by correct-answer to reach the target exactly.
        const endGame = chaserClient.waitForMessage("endGame");
        while (room.state.chaserScore < target) {
            assert.ok(chaserQuestion, "chaser should always have a live question while below the target");
            chaserClient.send("submitFinalChaserAnswer", { questionId: chaserQuestion!.id, answer: chaserQuestion!.answer });
            await sleep(60);
            chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
        }

        const end = await endGame;
        assert.strictEqual(end.winner, "chaser");
        await waitForPhase(room, GamePhase.GameEnd);
        assert.strictEqual(room.state.chaserScore, target, "the Chaser won by reaching the team's score exactly");
    });

    it("the full game runs from Lobby through GameEnd with no hang", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", { ...roomOptions, teamFinalDurationMs: 150, chaserFinalDurationMs: 150 });
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);

        await driveAllToTeamFinal(colyseus, room, ["Alice", "Bob"]);
        await waitForPhase(room, GamePhase.ChaserFinal);
        await waitForPhase(room, GamePhase.GameEnd, 3000);
    });
});

describe("final round — Chaser clock pause/resume (ticket 094)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    /** Short-circuits to a ChaserFinal with a live question and both clients
     * seated (reuses the ticket 082 chase-escape driver). */
    async function madeToChaserFinal(colyseus: ColyseusTestServer<typeof appConfig>, room: any) {
        room.mcQuestionSource = stubChaseSource();
        room.questionBank = bankFixture(20);
        const driven = await driveToChaseEscape(colyseus, room);
        await driven.teamFinalQuestion;
        await waitForPhase(room, GamePhase.ChaserFinal);
        const chaserMessage = await driven.chaserFinalQuestion;
        return { ...driven, chaserMessage };
    }

    const fastMotionOptions = {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 80,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalDurationMs: 80
    };

    it("a Chaser miss freezes the clock — the round does not time out while the steal is open", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            ...fastMotionOptions,
            chaserFinalDurationMs: 1500,
            stealWindowMs: 2000
        });
        const { contestantClient, chaserClient, chaserMessage } = await madeToChaserFinal(colyseus, room);

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;
        assert.strictEqual(room.finalStealActive, true);
        assert.strictEqual(room.chaserFinalClockRunning, false, "the clock must be paused while the steal is open");
        const frozenRemaining = room.chaserFinalRemainingMs;
        assert.ok(
            frozenRemaining > 0 && frozenRemaining <= 1500,
            `remaining ${frozenRemaining} should be the budget minus the pre-miss elapsed time`
        );

        // Stay inside the steal for longer than the frozen remainder would have
        // taken to run out — the paused clock must never fire.
        await sleep(frozenRemaining + 300);
        assert.strictEqual(room.state.currentPhase, GamePhase.ChaserFinal, "the round must not time out during the steal");
        assert.strictEqual(room.chaserFinalRemainingMs, frozenRemaining, "the frozen remainder must not drain during the steal");
    });

    it("resuming after a resolved steal runs out the frozen remainder — the team wins by timeout", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            ...fastMotionOptions,
            chaserFinalDurationMs: 1500,
            stealWindowMs: 2000
        });
        const { contestantClient, chaserClient, chaserMessage } = await madeToChaserFinal(colyseus, room);

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;
        const frozenRemaining = room.chaserFinalRemainingMs;
        assert.strictEqual(room.chaserFinalClockRunning, false);

        contestantClient.send("submitFinalStealAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        await sleep(50);
        assert.strictEqual(room.chaserFinalClockRunning, true, "the clock must resume after a resolved steal");
        assert.ok(room.chaserFinalRemainingMs <= frozenRemaining);

        await waitForPhase(room, GamePhase.GameEnd, 4000);
        assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
    });

    it("resuming after an unclaimed expiry runs out the frozen remainder — the team wins by timeout", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            ...fastMotionOptions,
            chaserFinalDurationMs: 1500,
            stealWindowMs: 120
        });
        const { contestantClient, chaserClient, chaserMessage } = await madeToChaserFinal(colyseus, room);

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;
        assert.strictEqual(room.chaserFinalClockRunning, false);

        // Nobody steals — the window expires on its own and resumes the clock.
        const resumeDeadline = Date.now() + 1000;
        while (Date.now() < resumeDeadline && !room.chaserFinalClockRunning) {
            await sleep(20);
        }
        assert.strictEqual(room.chaserFinalClockRunning, true, "an unclaimed expiry must resume the clock");

        await waitForPhase(room, GamePhase.GameEnd, 4000);
        assert.strictEqual(room.state.currentPhase, GamePhase.GameEnd);
    });

    it("resuming with an already-exhausted remainder ends the game immediately — the team wins", async () => {
        const room = await colyseus.createRoom<GameState>("trivia", {
            ...fastMotionOptions,
            chaserFinalDurationMs: 10000,
            stealWindowMs: 2000
        });
        const { contestantClient, chaserClient, chaserMessage } = await madeToChaserFinal(colyseus, room);

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;
        assert.strictEqual(room.chaserFinalClockRunning, false);

        // White-box: zero the frozen remainder so the resume must end the round.
        room.chaserFinalRemainingMs = 0;

        const endGame = contestantClient.waitForMessage("endGame");
        contestantClient.send("submitFinalStealAnswer", {
            questionId: chaserMessage.questionId,
            answer: `Answer ${chaserMessage.questionId}`
        });
        const end = await endGame;
        assert.strictEqual(end.winner, "team");
        await waitForPhase(room, GamePhase.GameEnd);
    });
});
