import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { BOARD, CHASER_ABILITIES, CHASE_QUESTION, FINAL_ROUND } from "../src/gameConfig.js";
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

/** A stub `McQuestionSource` — every question carries one fixed correct
 * answer ("Correct Answer") at a known text (mirrors chaseFlow.test.ts). */
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
        out.push({ id: i, question: `Ability fixture question ${i}?`, answer: `Answer ${i}` });
    }
    return out;
}

/** Two players (Carol always wins the Chaser vote, Alice is the contestant)
 * walked into Chase with a deterministic Chaser character — lets ownership
 * tests pick the exact `chaserCharacterId` they need (e.g. "nami" to prove
 * "big stan"-only `doubleTime` is rejected). Vote mode with both players
 * voting for Carol guarantees she is the Chaser regardless of the random
 * fallback (mirrors chaseFlow.test.ts's reachChaseWithBystander). */
async function reachChaseAsChaser(
    colyseus: ColyseusTestServer<typeof appConfig>,
    chaserCharacterId: string,
    opts?: {
        offer?: "low" | "middle" | "high";
        teamFinalDurationMs?: number;
        chaserFinalDurationMs?: number;
        stealWindowMs?: number;
        stealResolveHoldMs?: number;
    }
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
        chaserSelectionDurationMs: 10000,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalIntroDurationMs: 80,
        chaseAnswerWindowMs: 2000,
        teamFinalDurationMs: opts?.teamFinalDurationMs ?? 10000,
        chaserFinalDurationMs: opts?.chaserFinalDurationMs ?? 10000,
        stealWindowMs: opts?.stealWindowMs ?? 150,
        stealResolveHoldMs: opts?.stealResolveHoldMs ?? 80
    });
    room.mcQuestionSource = stubChaseSource();
    room.questionBank = bankFixture(30);

    const carol = await colyseus.connectTo(room, { playerName: "Carol" });
    const alice = await colyseus.connectTo(room, { playerName: "Alice" });
    await sleep(100);

    carol.send("setChaserMode", { mode: "vote" });
    await sleep(30);
    carol.send("startGame");
    await sleep(50);
    alice.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await sleep(30);
    carol.send("chaserVote", { targetSeatId: seatIdOf(room, carol) });
    await waitForPhase(room, GamePhase.RolesReveal);

    alice.send("revealReady", {});
    carol.send("revealReady", { characterId: chaserCharacterId });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const chaserSeatId = room.state.chaserSeatId;
    const contestantSeatId = room.state.activeContestantSeatId;
    assert.strictEqual(chaserSeatId, seatIdOf(room, carol), "Carol must be the deterministic chaser");
    assert.strictEqual(
        room.state.players.get(chaserSeatId).chaserCharacterId,
        chaserCharacterId,
        "the chaser must have picked the requested character"
    );

    carol.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    carol.send("setChaserHighOffer", { amount: 2000 });
    await sleep(30);

    const questionMessage = alice.waitForMessage("question");
    alice.send("offerChoice", { offer: opts?.offer ?? "middle" });
    const firstQuestion = await questionMessage;

    return { room, contestantClient: alice, chaserClient: carol, contestantSeatId, chaserSeatId, firstQuestion };
}

/** Three players: Carol is the deterministic Chaser, Alice is the first
 * active contestant, Bob waits his turn — needed for the "flags reset on the
 * next contestant's startChase" test, which requires Alice to be caught and
 * the room to advance into Bob's own Chase. */
async function reachChaseAsChaserWithBystander(
    colyseus: ColyseusTestServer<typeof appConfig>,
    chaserCharacterId: string,
    offer: "low" | "middle" | "high" = "low"
): Promise<{
    room: any;
    contestantClient: any;
    chaserClient: any;
    bystanderClient: any;
    contestantSeatId: string;
    chaserSeatId: string;
    firstQuestion: any;
}> {
    const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 10000,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalIntroDurationMs: 80,
        chaseAnswerWindowMs: 2000
    });
    room.mcQuestionSource = stubChaseSource();
    room.questionBank = bankFixture(30);

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

    alice.send("revealReady", {});
    bob.send("revealReady", {});
    carol.send("revealReady", { characterId: chaserCharacterId });
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);

    const chaserSeatId = room.state.chaserSeatId;
    const contestantSeatId = room.state.activeContestantSeatId;
    assert.strictEqual(chaserSeatId, seatIdOf(room, carol), "Carol must be the deterministic chaser");
    assert.strictEqual(contestantSeatId, seatIdOf(room, alice), "Alice must be the first active contestant");

    carol.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    carol.send("setChaserHighOffer", { amount: 2000 });
    await sleep(30);

    const questionMessage = alice.waitForMessage("question");
    alice.send("offerChoice", { offer });
    const firstQuestion = await questionMessage;

    return {
        room,
        contestantClient: alice,
        chaserClient: carol,
        bystanderClient: bob,
        contestantSeatId,
        chaserSeatId,
        firstQuestion
    };
}

/** Drives a deterministic-chaser Chase (offer "low", contestant always
 * correct, Chaser always wrong) all the way to a live ChaserFinal question —
 * used by the Skip-ability tests, which need `GamePhase.ChaserFinal`. */
async function reachChaserFinal(
    colyseus: ColyseusTestServer<typeof appConfig>,
    chaserCharacterId: string,
    opts?: { teamFinalDurationMs?: number; stealWindowMs?: number; stealResolveHoldMs?: number }
): Promise<{
    room: any;
    contestantClient: any;
    chaserClient: any;
    contestantSeatId: string;
    chaserSeatId: string;
    chaserMessage: any;
}> {
    const { room, contestantClient, chaserClient, contestantSeatId, chaserSeatId, firstQuestion } =
        await reachChaseAsChaser(colyseus, chaserCharacterId, {
            offer: "low",
            teamFinalDurationMs: opts?.teamFinalDurationMs ?? 80,
            stealWindowMs: opts?.stealWindowMs ?? 150,
            stealResolveHoldMs: opts?.stealResolveHoldMs ?? 80
        });

    const chaserFinalQuestion = chaserClient.waitForMessage("finalQuestion");

    let question = firstQuestion;
    for (let round = 0; round < 4 && room.state.currentPhase === GamePhase.Chase; round += 1) {
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
    await waitForPhase(room, GamePhase.ChaserFinal, 5000);
    const chaserMessage = await chaserFinalQuestion;

    return { room, contestantClient, chaserClient, contestantSeatId, chaserSeatId, chaserMessage };
}

describe("chaser ability activation handler (ticket 140)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("defaults the synced counters from CHASER_ABILITIES and starts every per-round/armed flag false", async () => {
        const { room } = await reachChaseAsChaser(colyseus, "bezos");

        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, CHASER_ABILITIES.fiftyFifty.usesPerGame);
        assert.strictEqual(room.state.skipUsesRemaining, CHASER_ABILITIES.skip.usesPerGame);
        assert.strictEqual(room.state.pushbackImmunityUsesRemaining, CHASER_ABILITIES.pushbackImmunity.usesPerGame);
        assert.strictEqual(room.state.doubleTimeUsedThisTableRound, false);
        assert.strictEqual(room.state.reRackUsedThisTableRound, false);
        assert.strictEqual(room.state.jumbleUsedThisTableRound, false);
        assert.strictEqual(room.state.doubleTimeArmed, false);
    });

    it("a non-Chaser client is rejected", async () => {
        const { room, contestantClient } = await reachChaseAsChaser(colyseus, "bezos");
        const before = room.state.fiftyFiftyUsesRemaining;

        const NOTHING = Symbol("no chaserAbilityUsed broadcast");
        const outcome = Promise.race([
            contestantClient.waitForMessage("chaserAbilityUsed"),
            sleep(150).then(() => NOTHING)
        ]);
        contestantClient.send("useChaserAbility", { ability: "fiftyFifty" });
        assert.strictEqual(await outcome, NOTHING, "a non-Chaser must never trigger the broadcast");
        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, before, "a non-Chaser must not be able to activate an ability");
    });

    it("an ability not owned by the current character is rejected (Nami's client sending doubleTime)", async () => {
        const { room, chaserClient } = await reachChaseAsChaser(colyseus, "nami");

        chaserClient.send("useChaserAbility", { ability: "doubleTime" });
        await sleep(80);

        assert.strictEqual(room.state.doubleTimeUsedThisTableRound, false, "Nami does not own doubleTime — Big Stan does");
        assert.strictEqual(room.state.doubleTimeArmed, false);
    });

    it("an ability used with 0 charges remaining is rejected", async () => {
        const { room, chaserClient } = await reachChaseAsChaser(colyseus, "bezos");
        room.state.fiftyFiftyUsesRemaining = 0;

        const NOTHING = Symbol("no chaserAbilityUsed broadcast");
        const outcome = Promise.race([
            chaserClient.waitForMessage("chaserAbilityUsed"),
            sleep(150).then(() => NOTHING)
        ]);
        chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
        assert.strictEqual(await outcome, NOTHING);
        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, 0, "must stay at 0, never go negative");
    });

    it("fiftyFifty is rejected once chaseAnswers is non-empty", async () => {
        const { room, contestantClient, chaserClient, firstQuestion } = await reachChaseAsChaser(colyseus, "bezos");
        const before = room.state.fiftyFiftyUsesRemaining;

        // Only the contestant answers — leaves chaseAnswers non-empty.
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 0 });
        await sleep(50);

        chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
        await sleep(50);
        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, before, "50/50 must be rejected once either side has answered");
    });

    it("reRack is rejected once chaseAnswers is non-empty", async () => {
        const { room, contestantClient, chaserClient, firstQuestion } = await reachChaseAsChaser(colyseus, "nami");

        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 0 });
        await sleep(50);

        chaserClient.send("useChaserAbility", { ability: "reRack" });
        await sleep(50);
        assert.strictEqual(room.state.reRackUsedThisTableRound, false, "Re-rack must be rejected once either side has answered");
    });

    it("jumble is rejected once chaseAnswers is non-empty", async () => {
        const { room, contestantClient, chaserClient, firstQuestion } = await reachChaseAsChaser(colyseus, "maggie");

        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 0 });
        await sleep(50);

        chaserClient.send("useChaserAbility", { ability: "jumble" });
        await sleep(50);
        assert.strictEqual(room.state.jumbleUsedThisTableRound, false, "Jumble must be rejected once either side has answered");
    });

    it("doubleTime is rejected once the Chaser has already answered the current chase question", async () => {
        const { room, chaserClient, firstQuestion } = await reachChaseAsChaser(colyseus, "big stan");

        chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 0 });
        await sleep(50);

        chaserClient.send("useChaserAbility", { ability: "doubleTime" });
        await sleep(50);
        assert.strictEqual(
            room.state.doubleTimeUsedThisTableRound,
            false,
            "Double Time must be rejected once the Chaser has answered the current chase question"
        );
        assert.strictEqual(room.state.doubleTimeArmed, false);
    });

    it("skip is rejected outside ChaserFinal", async () => {
        const { room, chaserClient } = await reachChaseAsChaser(colyseus, "bezos");

        chaserClient.send("useChaserAbility", { ability: "skip" });
        await sleep(50);
        assert.strictEqual(
            room.state.skipUsesRemaining,
            CHASER_ABILITIES.skip.usesPerGame,
            "Skip must be rejected mid-Chase — it only applies in ChaserFinal"
        );
    });

    it("skip is rejected while a steal window is open", async () => {
        const { room, contestantClient, chaserClient, chaserMessage } = await reachChaserFinal(colyseus, "bezos");
        const before = room.state.skipUsesRemaining;

        const steal = contestantClient.waitForMessage("finalSteal");
        chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
        await steal;
        assert.strictEqual(room.finalStealActive, true);

        chaserClient.send("useChaserAbility", { ability: "skip" });
        await sleep(50);
        assert.strictEqual(room.state.skipUsesRemaining, before, "Skip must be rejected while a steal window is open");
    });

    it("a valid fiftyFifty activation decrements the counter and broadcasts chaserAbilityUsed", async () => {
        const { room, chaserClient, chaserSeatId } = await reachChaseAsChaser(colyseus, "bezos");
        const before = room.state.fiftyFiftyUsesRemaining;

        const broadcastPromise = chaserClient.waitForMessage("chaserAbilityUsed");
        chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
        const broadcast = await broadcastPromise;

        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, before - 1);
        assert.deepStrictEqual(broadcast, { ability: "fiftyFifty", seatId: chaserSeatId });
    });

    it("a valid doubleTime activation sets the used-this-round flag, arms it, and broadcasts chaserAbilityUsed", async () => {
        const { room, chaserClient, chaserSeatId } = await reachChaseAsChaser(colyseus, "big stan");

        const broadcastPromise = chaserClient.waitForMessage("chaserAbilityUsed");
        chaserClient.send("useChaserAbility", { ability: "doubleTime" });
        const broadcast = await broadcastPromise;

        assert.strictEqual(room.state.doubleTimeUsedThisTableRound, true);
        assert.strictEqual(room.state.doubleTimeArmed, true);
        assert.deepStrictEqual(broadcast, { ability: "doubleTime", seatId: chaserSeatId });

        // A second activation this same table round must be rejected (already used).
        chaserClient.send("useChaserAbility", { ability: "doubleTime" });
        await sleep(50);
        assert.strictEqual(room.state.doubleTimeUsedThisTableRound, true);
    });

    it("doubleTimeArmed resets to false once the chase question it was armed for resolves", async () => {
        const { room, contestantClient, chaserClient, firstQuestion } = await reachChaseAsChaser(colyseus, "big stan");

        const broadcastPromise = chaserClient.waitForMessage("chaserAbilityUsed");
        chaserClient.send("useChaserAbility", { ability: "doubleTime" });
        await broadcastPromise;
        assert.strictEqual(room.state.doubleTimeArmed, true);

        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 0 });
        chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: 1 });
        await resultPromise;

        assert.strictEqual(room.state.doubleTimeArmed, false, "doubleTimeArmed must not survive past the question it was armed for");
    });

    it("a valid skip activation during ChaserFinal decrements skipUsesRemaining and broadcasts chaserAbilityUsed", async () => {
        const { room, chaserClient, chaserSeatId } = await reachChaserFinal(colyseus, "bezos");
        const before = room.state.skipUsesRemaining;

        const broadcastPromise = chaserClient.waitForMessage("chaserAbilityUsed");
        chaserClient.send("useChaserAbility", { ability: "skip" });
        const broadcast = await broadcastPromise;

        assert.strictEqual(room.state.skipUsesRemaining, before - 1);
        assert.deepStrictEqual(broadcast, { ability: "skip", seatId: chaserSeatId });
    });

    it("per-table-round flags reset when startChase fires for the next contestant", async () => {
        const {
            room,
            contestantClient: alice,
            chaserClient: carol,
            bystanderClient: bob,
            contestantSeatId: aliceSeatId,
            firstQuestion
        } = await reachChaseAsChaserWithBystander(colyseus, "nami", "low");

        // Ticket 141: reRack actually redraws now, so the pre-activation
        // `firstQuestion` is stale the instant it fires — wait for the fresh
        // broadcast it triggers and drive the rest of the round from that.
        const freshQuestion = alice.waitForMessage("question");
        const usedBroadcast = carol.waitForMessage("chaserAbilityUsed");
        carol.send("useChaserAbility", { ability: "reRack" });
        await usedBroadcast;
        assert.strictEqual(room.state.reRackUsedThisTableRound, true);
        const rerackedQuestion = await freshQuestion;
        assert.notStrictEqual(rerackedQuestion.questionId, firstQuestion.questionId, "reRack must have drawn a different question");

        // Catch Alice (Chaser always correct, contestant always wrong) — with a
        // bystander still waiting, this advances to Bob's CashBuilder next
        // rather than ending the game.
        let question = rerackedQuestion;
        for (let round = 0; round < 4 && room.state.currentPhase === GamePhase.Chase; round += 1) {
            const correctIndex = question.options.indexOf("Correct Answer");
            const wrongIndex = (correctIndex + 1) % question.options.length;
            const nextQuestionOrPhase = Promise.race([
                alice.waitForMessage("question").then((q: any) => ({ q })),
                (async () => {
                    while (room.state.currentPhase === GamePhase.Chase) {
                        await sleep(10);
                    }
                    return { q: null };
                })()
            ]);
            alice.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
            carol.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
            const { q } = await nextQuestionOrPhase;
            question = q;
        }

        assert.strictEqual(room.state.players.get(aliceSeatId).isEliminated, true);
        await waitForPhase(room, GamePhase.CashBuilder);
        assert.strictEqual(room.state.activeContestantSeatId, seatIdOf(room, bob), "should now be Bob's turn");

        room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
        await waitForPhase(room, GamePhase.Offer);
        carol.send("setChaserLowOffer", { amount: 0 });
        await sleep(30);
        carol.send("setChaserHighOffer", { amount: 2000 });
        await sleep(30);
        bob.send("offerChoice", { offer: "middle" });
        await waitForPhase(room, GamePhase.Chase);

        assert.strictEqual(
            room.state.reRackUsedThisTableRound,
            false,
            "the per-table-round flag must reset for the new contestant's chase (startChase effect)"
        );
    });

    it("rejects a malformed useChaserAbility payload (non-string/missing ability, unknown ability id)", async () => {
        const { room, chaserClient } = await reachChaseAsChaser(colyseus, "bezos");
        const before = room.state.fiftyFiftyUsesRemaining;

        chaserClient.send("useChaserAbility", {});
        chaserClient.send("useChaserAbility", { ability: 5 });
        chaserClient.send("useChaserAbility", { ability: "noMiddle" }); // passive — never manually activated
        chaserClient.send("useChaserAbility", { ability: "not-a-real-ability" });
        await sleep(80);

        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, before, "none of the malformed payloads should change any counter");
    });
});

describe("board-chase ability effects (ticket 141)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("fiftyFifty narrows a 3-option question to 2 (both sides get the same narrowed question) and the remaining correct index still resolves correctly", async () => {
        const { room, contestantClient, chaserClient, firstQuestion } = await reachChaseAsChaser(colyseus, "bezos");
        assert.strictEqual(firstQuestion.options.length, CHASE_QUESTION.optionCount);
        // reachChaseAsChaser only awaits the contestant's copy of the first
        // "question" broadcast — let the Chaser's own socket finish
        // dispatching its copy too, so the waiter below can't race it and
        // catch that stale original instead of the narrowed re-broadcast.
        await sleep(50);

        const contestantNarrowed = contestantClient.waitForMessage("question");
        const chaserNarrowed = chaserClient.waitForMessage("question");
        chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
        const narrowed = await contestantNarrowed;
        const chaserSideNarrowed = await chaserNarrowed;

        assert.strictEqual(narrowed.questionId, firstQuestion.questionId);
        assert.strictEqual(narrowed.options.length, 2, "50/50 drops exactly one wrong option");
        assert.ok(narrowed.options.includes("Correct Answer"), "the correct option must survive the narrowing");
        assert.ok(!("correctIndex" in narrowed), "the re-broadcast must never leak correctIndex before resolution");
        // Mutual-benefit/double-edged by design (ticket 141): both sides get
        // the identical narrowed options, not a Chaser-only view.
        assert.deepStrictEqual(chaserSideNarrowed.options, narrowed.options);

        const correctIndex = narrowed.options.indexOf("Correct Answer");
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        contestantClient.send("submitChaseAnswer", { questionId: narrowed.questionId, answerIndex: correctIndex });
        chaserClient.send("submitChaseAnswer", { questionId: narrowed.questionId, answerIndex: correctIndex });
        const result = await resultPromise;

        assert.strictEqual(result.correctIndex, correctIndex);
        assert.strictEqual(result.contestantCorrect, true);
        assert.strictEqual(result.chaserCorrect, true);
    });

    it("reRack replaces the current chase question (different id) without touching board positions or answer counters", async () => {
        const { room, contestantClient, chaserClient, contestantSeatId, chaserSeatId, firstQuestion } =
            await reachChaseAsChaser(colyseus, "nami");
        const contestantBoardPosBefore = room.state.players.get(contestantSeatId).boardPos;
        const chaserBoardPosBefore = room.state.players.get(chaserSeatId).boardPos;
        const fiftyFiftyBefore = room.state.fiftyFiftyUsesRemaining;

        const freshQuestion = contestantClient.waitForMessage("question");
        chaserClient.send("useChaserAbility", { ability: "reRack" });
        const fresh = await freshQuestion;

        assert.notStrictEqual(fresh.questionId, firstQuestion.questionId, "reRack must draw a different question");
        assert.strictEqual(fresh.kind, "mc");
        assert.ok(!("correctIndex" in fresh));
        assert.strictEqual(room.state.reRackUsedThisTableRound, true);
        assert.strictEqual(room.state.players.get(contestantSeatId).boardPos, contestantBoardPosBefore, "reRack must not move the contestant");
        assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, chaserBoardPosBefore, "reRack must not move the Chaser");
        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, fiftyFiftyBefore, "reRack must not touch unrelated ability counters");
        assert.deepStrictEqual(room.chaseAnswers, {}, "reRack must not touch the answer counters");

        // The fresh question is fully live — both sides can still answer it.
        const correctIndex = fresh.options.indexOf("Correct Answer");
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        contestantClient.send("submitChaseAnswer", { questionId: fresh.questionId, answerIndex: correctIndex });
        chaserClient.send("submitChaseAnswer", { questionId: fresh.questionId, answerIndex: correctIndex });
        const result = await resultPromise;
        assert.strictEqual(result.contestantCorrect, true);
        assert.strictEqual(result.chaserCorrect, true);
    });

    it("jumble's targeted send reaches only the active contestant's client with a valid permutation, and scoring still resolves against the true correctIndex", async () => {
        const { contestantClient, chaserClient, bystanderClient, room, firstQuestion } =
            await reachChaseAsChaserWithBystander(colyseus, "maggie", "middle");
        // reachChaseAsChaserWithBystander only awaits the contestant's copy
        // of the first "question" broadcast — let the Chaser's and
        // bystander's own sockets finish dispatching their copies too, so
        // the "no extra message" waiters below can't race that in-flight
        // delivery and mistake it for a targeted jumble send.
        await sleep(50);

        const NOTHING = Symbol("no extra question message");
        const contestantJumbled = contestantClient.waitForMessage("question");
        const chaserExtra = Promise.race([chaserClient.waitForMessage("question"), sleep(200).then(() => NOTHING)]);
        const bystanderExtra = Promise.race([bystanderClient.waitForMessage("question"), sleep(200).then(() => NOTHING)]);

        chaserClient.send("useChaserAbility", { ability: "jumble" });

        const jumbled = await contestantJumbled;
        assert.strictEqual(jumbled.questionId, firstQuestion.questionId);
        assert.strictEqual(jumbled.kind, "mc");
        assert.ok(!("correctIndex" in jumbled));
        assert.ok(Array.isArray(jumbled.displayOrder), "the contestant's send must carry a displayOrder");
        assert.deepStrictEqual(
            [...jumbled.displayOrder].sort((a: number, b: number) => a - b),
            jumbled.options.map((_option: string, index: number) => index),
            "displayOrder must be a valid permutation of the real option indices"
        );

        assert.strictEqual(await chaserExtra, NOTHING, "the Chaser must not receive a targeted jumble send");
        assert.strictEqual(await bystanderExtra, NOTHING, "a spectator must not receive a targeted jumble send");
        assert.strictEqual(room.state.jumbleUsedThisTableRound, true);

        // Submitting the real (un-jumbled) index still resolves correctly —
        // displayOrder is a display-only hint and never touches
        // correctIndex/resolution.
        const correctIndex = firstQuestion.options.indexOf("Correct Answer");
        const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
        contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
        const result = await resultPromise;
        assert.strictEqual(result.contestantCorrect, true);
        assert.strictEqual(result.chaserCorrect, true);
    });

    describe("doubleTime board math", () => {
        it("correct + armed + off-board skips a space (chaserFirstCorrectSpace - 1)", async () => {
            const { room, contestantClient, chaserClient, chaserSeatId, firstQuestion } =
                await reachChaseAsChaser(colyseus, "big stan");
            assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, BOARD.chaserStartOffboard);

            const armedBroadcast = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "doubleTime" });
            await armedBroadcast;

            const correctIndex = firstQuestion.options.indexOf("Correct Answer");
            const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
            contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            const result = await resultPromise;

            assert.strictEqual(result.doubleTimeArmed, true);
            assert.strictEqual(result.chaserCorrect, true);
            assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, BOARD.chaserFirstCorrectSpace - 1);
            assert.strictEqual(room.state.doubleTimeArmed, false, "must clear after resolving regardless of outcome");
        });

        it("correct + armed + on-board moves max(escapeSpace, boardPos - 2)", async () => {
            const { room, contestantClient, chaserClient, chaserSeatId, firstQuestion } =
                await reachChaseAsChaser(colyseus, "big stan");
            room.state.players.get(chaserSeatId).boardPos = 5;

            const armedBroadcast = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "doubleTime" });
            await armedBroadcast;

            const correctIndex = firstQuestion.options.indexOf("Correct Answer");
            const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
            contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            const result = await resultPromise;

            assert.strictEqual(result.doubleTimeArmed, true);
            assert.strictEqual(result.chaserCorrect, true);
            assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, Math.max(BOARD.escapeSpace, 5 - 2));
            assert.strictEqual(room.state.doubleTimeArmed, false, "must clear after resolving regardless of outcome");
        });

        it("wrong + armed + on-board retreats one space, capped at chaserFirstCorrectSpace", async () => {
            const { room, contestantClient, chaserClient, chaserSeatId, firstQuestion } =
                await reachChaseAsChaser(colyseus, "big stan");
            room.state.players.get(chaserSeatId).boardPos = 5;

            const armedBroadcast = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "doubleTime" });
            await armedBroadcast;

            const correctIndex = firstQuestion.options.indexOf("Correct Answer");
            const wrongIndex = (correctIndex + 1) % firstQuestion.options.length;
            const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
            contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: wrongIndex });
            const result = await resultPromise;

            assert.strictEqual(result.doubleTimeArmed, true);
            assert.strictEqual(result.chaserCorrect, false);
            assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, Math.min(BOARD.chaserFirstCorrectSpace, 5 + 1));
            assert.strictEqual(room.state.doubleTimeArmed, false, "must clear after resolving regardless of outcome");
        });

        it("wrong + armed + off-board applies no extra penalty", async () => {
            const { room, contestantClient, chaserClient, chaserSeatId, firstQuestion } =
                await reachChaseAsChaser(colyseus, "big stan");
            assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, BOARD.chaserStartOffboard);

            const armedBroadcast = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "doubleTime" });
            await armedBroadcast;

            const correctIndex = firstQuestion.options.indexOf("Correct Answer");
            const wrongIndex = (correctIndex + 1) % firstQuestion.options.length;
            const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
            contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            chaserClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: wrongIndex });
            const result = await resultPromise;

            assert.strictEqual(result.doubleTimeArmed, true);
            assert.strictEqual(result.chaserCorrect, false);
            assert.strictEqual(
                room.state.players.get(chaserSeatId).boardPos,
                BOARD.chaserStartOffboard,
                "an armed miss while still off-board has nothing to retreat from"
            );
            assert.strictEqual(room.state.doubleTimeArmed, false, "must clear after resolving regardless of outcome");
        });

        it("clears even when the lockout window expires with the Chaser never answering (counts as wrong)", async () => {
            const { room, contestantClient, chaserClient, chaserSeatId, firstQuestion } =
                await reachChaseAsChaser(colyseus, "big stan");
            room.chaseAnswerWindowMs = 200;
            room.state.players.get(chaserSeatId).boardPos = 5;

            const armedBroadcast = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "doubleTime" });
            await armedBroadcast;

            const correctIndex = firstQuestion.options.indexOf("Correct Answer");
            const resultPromise = contestantClient.waitForMessage("chaseQuestionResult");
            // Only the contestant answers — the Chaser never does, so the
            // lockout window closes the question and it counts as a miss.
            contestantClient.send("submitChaseAnswer", { questionId: firstQuestion.questionId, answerIndex: correctIndex });
            const result = await resultPromise;

            assert.strictEqual(result.doubleTimeArmed, true);
            assert.strictEqual(result.chaserCorrect, false);
            assert.strictEqual(room.state.players.get(chaserSeatId).boardPos, Math.min(BOARD.chaserFirstCorrectSpace, 5 + 1));
            assert.strictEqual(room.state.doubleTimeArmed, false, "must clear after resolving regardless of outcome");
        });
    });

    describe("a full chase round using each ability once still ends in a valid escape/caught dispatch", () => {
        it("big stan: fiftyFifty + doubleTime, driven to a catch", async () => {
            const { room, contestantClient, chaserClient, contestantSeatId } =
                await reachChaseAsChaser(colyseus, "big stan", { offer: "low" });

            const narrowedPromise = contestantClient.waitForMessage("question");
            chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
            const narrowed = await narrowedPromise;
            assert.strictEqual(narrowed.options.length, 2);

            const armedBroadcast = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "doubleTime" });
            await armedBroadcast;

            // Contestant always wrong, Chaser always correct — catches
            // quickly from a "low" start.
            let question = narrowed;
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
                contestantClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
                chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
                const { q } = await nextQuestionOrPhase;
                question = q;
            }

            await waitForPhase(room, GamePhase.TeamFinal);
            assert.strictEqual(room.state.players.get(contestantSeatId).isEliminated, true, "the chase round resolved as a valid catch");
        });

        it("nami: fiftyFifty + reRack, driven to an escape", async () => {
            const { room, contestantClient, chaserClient, contestantSeatId, firstQuestion } =
                await reachChaseAsChaser(colyseus, "nami", { offer: "low" });

            const freshPromise = contestantClient.waitForMessage("question");
            chaserClient.send("useChaserAbility", { ability: "reRack" });
            const fresh = await freshPromise;
            assert.notStrictEqual(fresh.questionId, firstQuestion.questionId);

            const narrowedPromise = contestantClient.waitForMessage("question");
            chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
            const narrowed = await narrowedPromise;
            assert.strictEqual(narrowed.options.length, 2);

            // Contestant always correct, Chaser always wrong — escapes
            // quickly from a "low" start (BOARD.startLow rounds to reach 0).
            let question = narrowed;
            for (let round = 0; round < BOARD.startLow + 2 && room.state.currentPhase === GamePhase.Chase; round += 1) {
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
            assert.strictEqual(room.state.players.get(contestantSeatId).madeItBack, true, "the chase round resolved as a valid escape");
        });

        it("maggie: fiftyFifty + jumble, driven to a catch", async () => {
            const { room, contestantClient, chaserClient, contestantSeatId } =
                await reachChaseAsChaser(colyseus, "maggie", { offer: "low" });

            const narrowedPromise = contestantClient.waitForMessage("question");
            chaserClient.send("useChaserAbility", { ability: "fiftyFifty" });
            const narrowed = await narrowedPromise;
            assert.strictEqual(narrowed.options.length, 2);

            const jumbledPromise = contestantClient.waitForMessage("question");
            chaserClient.send("useChaserAbility", { ability: "jumble" });
            const jumbled = await jumbledPromise;
            assert.ok(Array.isArray(jumbled.displayOrder));
            assert.strictEqual(jumbled.questionId, narrowed.questionId);

            // The contestant answers using the real (un-jumbled) option index
            // — displayOrder never changes what index scores correctly.
            // Contestant always wrong, Chaser always correct — a catch.
            let question = jumbled;
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
                contestantClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: wrongIndex });
                chaserClient.send("submitChaseAnswer", { questionId: question.questionId, answerIndex: correctIndex });
                const { q } = await nextQuestionOrPhase;
                question = q;
            }

            await waitForPhase(room, GamePhase.TeamFinal);
            assert.strictEqual(room.state.players.get(contestantSeatId).isEliminated, true, "the chase round resolved as a valid catch");
        });
    });
});

describe("final-round ability effects (ticket 142)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    describe("Skip", () => {
        it("discards the current question with no score change and no steal window, then draws a fresh one", async () => {
            const { room, chaserClient, chaserSeatId, chaserMessage } = await reachChaserFinal(colyseus, "bezos");
            const scoreBefore = room.state.chaserScore;

            const freshQuestion = chaserClient.waitForMessage("finalQuestion");
            const broadcastPromise = chaserClient.waitForMessage("chaserAbilityUsed");
            chaserClient.send("useChaserAbility", { ability: "skip" });
            const broadcast = await broadcastPromise;
            assert.deepStrictEqual(broadcast, { ability: "skip", seatId: chaserSeatId });

            const next = await freshQuestion;
            assert.strictEqual(next.side, "chaser");
            assert.notStrictEqual(next.questionId, chaserMessage.questionId, "skip must draw a different question");
            assert.strictEqual(room.state.chaserScore, scoreBefore, "skip must not change chaserScore");
            assert.strictEqual(room.finalStealActive, false, "skip must never open a steal window");
            assert.strictEqual(room.finalChaserQuestionResolved, false, "the freshly-drawn question is live again");
        });

        it("is usable up to its 2-uses-per-game cap, then rejected a 3rd time in the same game", async () => {
            const { room, chaserClient } = await reachChaserFinal(colyseus, "bezos");
            assert.strictEqual(room.state.skipUsesRemaining, CHASER_ABILITIES.skip.usesPerGame);

            for (let use = 0; use < CHASER_ABILITIES.skip.usesPerGame; use += 1) {
                const broadcastPromise = chaserClient.waitForMessage("chaserAbilityUsed");
                const freshQuestion = chaserClient.waitForMessage("finalQuestion");
                chaserClient.send("useChaserAbility", { ability: "skip" });
                await broadcastPromise;
                await freshQuestion;
            }
            assert.strictEqual(room.state.skipUsesRemaining, 0);

            const NOTHING = Symbol("no chaserAbilityUsed broadcast");
            const outcome = Promise.race([
                chaserClient.waitForMessage("chaserAbilityUsed"),
                sleep(150).then(() => NOTHING)
            ]);
            chaserClient.send("useChaserAbility", { ability: "skip" });
            assert.strictEqual(await outcome, NOTHING, "a 3rd Skip in the same game must be rejected");
            assert.strictEqual(room.state.skipUsesRemaining, 0, "must stay at 0, never go negative");
        });

        it("is rejected once the question bank is exhausted mid-ChaserFinal, even though finalChaserQuestionResolved stays false", async () => {
            const { room, chaserClient } = await reachChaserFinal(colyseus, "bezos");
            const before = room.state.skipUsesRemaining;

            // Simulate the bank running dry mid-round (the gap the ticket-140
            // implementer flagged): draining the bank and re-drawing leaves
            // finalChaserQuestionResolved false (advanceFinalChaserQuestion
            // always clears it, draw success or not) but no live question
            // object behind it — the resolved-flag gate alone can't catch this.
            room.questionBank = [];
            room.advanceFinalChaserQuestion();
            assert.strictEqual(room.finalChaserQuestionResolved, false, "the resolved flag alone does not catch this gap");
            assert.strictEqual(room.finalRoundQuestions.getCurrentQuestion("chaser"), null, "the bank is exhausted — no live question");

            const NOTHING = Symbol("no chaserAbilityUsed broadcast");
            const outcome = Promise.race([
                chaserClient.waitForMessage("chaserAbilityUsed"),
                sleep(150).then(() => NOTHING)
            ]);
            chaserClient.send("useChaserAbility", { ability: "skip" });
            assert.strictEqual(await outcome, NOTHING, "Skip must be rejected with no live question to discard");
            assert.strictEqual(room.state.skipUsesRemaining, before, "Skip must not consume a charge when rejected");
        });
    });

    describe("Pushback Immunity (Bezos)", () => {
        it("blocks exactly 3 steals (reporting pushbackBlocked, not pushedBack), then behaves normally once spent", async () => {
            const { room, contestantClient, chaserClient } = await reachChaserFinal(colyseus, "bezos");

            for (let charge = CHASER_ABILITIES.pushbackImmunity.usesPerGame; charge >= 1; charge -= 1) {
                room.state.chaserScore = 2;
                const chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
                assert.ok(chaserQuestion, `chaser should have a live question (charge ${charge})`);

                const steal = contestantClient.waitForMessage("finalSteal");
                chaserClient.send("submitFinalChaserAnswer", { questionId: chaserQuestion.id, answer: "not it at all" });
                await steal;

                const resolved = contestantClient.waitForMessage("finalStealResolved");
                contestantClient.send("submitFinalStealAnswer", {
                    questionId: chaserQuestion.id,
                    answer: chaserQuestion.answer
                });
                const resolvedMessage = await resolved;
                assert.strictEqual(resolvedMessage.correct, true);
                assert.strictEqual(resolvedMessage.pushbackBlocked, true, `steal with ${charge} charge(s) left should still be blocked`);
                assert.strictEqual(resolvedMessage.pushedBack, false);
                assert.strictEqual(room.state.chaserScore, 2, "chaserScore must not move while immune");
                assert.strictEqual(room.state.pushbackImmunityUsesRemaining, charge - 1);

                // Let the outcome-beat hold pass so the Chaser stream advances
                // to a fresh question before the next iteration.
                await sleep(150);
            }

            // Charges exhausted — a correct steal now behaves exactly like today.
            room.state.chaserScore = 2;
            const chaserQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
            assert.ok(chaserQuestion, "chaser should have a live question after immunity runs out");

            const steal = contestantClient.waitForMessage("finalSteal");
            chaserClient.send("submitFinalChaserAnswer", { questionId: chaserQuestion.id, answer: "not it at all" });
            await steal;

            const resolved = contestantClient.waitForMessage("finalStealResolved");
            contestantClient.send("submitFinalStealAnswer", {
                questionId: chaserQuestion.id,
                answer: chaserQuestion.answer
            });
            const resolvedMessage = await resolved;
            assert.strictEqual(resolvedMessage.pushedBack, true, "once exhausted, steals push back normally");
            assert.strictEqual(resolvedMessage.pushbackBlocked, false);
            assert.strictEqual(room.state.chaserScore, 1);
            assert.strictEqual(room.state.pushbackImmunityUsesRemaining, 0);
        });

        it("a correct steal while Bezos is already at 0 still raises the team's target — immunity never touches that branch", async () => {
            const { room, contestantClient, chaserClient, chaserMessage } = await reachChaserFinal(colyseus, "bezos");
            assert.strictEqual(room.state.chaserScore, 0);
            const teamScoreBefore = room.state.teamScore;
            const immunityBefore = room.state.pushbackImmunityUsesRemaining;

            const steal = contestantClient.waitForMessage("finalSteal");
            chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
            await steal;

            const resolved = contestantClient.waitForMessage("finalStealResolved");
            contestantClient.send("submitFinalStealAnswer", {
                questionId: chaserMessage.questionId,
                answer: `Answer ${chaserMessage.questionId}`
            });
            const resolvedMessage = await resolved;
            assert.strictEqual(resolvedMessage.pushedBack, false);
            assert.strictEqual(resolvedMessage.pushbackBlocked, false, "immunity does not apply to the raise-target branch");
            assert.strictEqual(room.state.chaserScore, 0);
            assert.strictEqual(room.state.teamScore, teamScoreBefore + 1);
            assert.strictEqual(room.state.pushbackImmunityUsesRemaining, immunityBefore, "a target raise must not consume an immunity charge");
        });
    });

    describe("Time Bonus (Big Stan)", () => {
        it("a correct chaser-final answer extends chaserFinalRemainingMs by ~500ms, synced immediately", async () => {
            const { room, chaserClient, chaserMessage } = await reachChaserFinal(colyseus, "big stan");
            // Headroom so this single correct answer doesn't also win the game
            // (chaserScore reaching teamScore) before the extension can be read.
            room.state.teamScore = 5;
            const remainingBefore = room.state.chaserFinalRemainingMs;
            assert.strictEqual(room.state.chaserFinalClockRunning, true);

            const result = chaserClient.waitForMessage("answerResult");
            chaserClient.send("submitFinalChaserAnswer", {
                questionId: chaserMessage.questionId,
                answer: `Answer ${chaserMessage.questionId}`
            });
            assert.strictEqual((await result).correct, true);

            // Not exact-to-the-millisecond: extendChaserFinalClock also
            // subtracts the real wall-clock time elapsed since the clock
            // started (same bookkeeping pauseChaserFinalClock uses), so the
            // net increase is ~500ms minus a few ms of real test/processing
            // time — never more than the flat bonus itself.
            const delta = room.state.chaserFinalRemainingMs - remainingBefore;
            assert.ok(
                delta > 400 && delta <= CHASER_ABILITIES.timeBonusMs,
                `expected the clock to extend by ~${CHASER_ABILITIES.timeBonusMs}ms net of negligible real processing time, got ${delta}ms`
            );
        });

        it("extends the clock again on a second correct answer — additive, not a one-time flat add", async () => {
            const { room, chaserClient, chaserMessage } = await reachChaserFinal(colyseus, "big stan");
            room.state.teamScore = 5;
            const remainingAtStart = room.state.chaserFinalRemainingMs;

            const firstResult = chaserClient.waitForMessage("answerResult");
            const nextQuestion = chaserClient.waitForMessage("finalQuestion");
            chaserClient.send("submitFinalChaserAnswer", {
                questionId: chaserMessage.questionId,
                answer: `Answer ${chaserMessage.questionId}`
            });
            await firstResult;
            const secondQuestion = await nextQuestion;

            const secondResult = chaserClient.waitForMessage("answerResult");
            chaserClient.send("submitFinalChaserAnswer", {
                questionId: secondQuestion.questionId,
                answer: `Answer ${secondQuestion.questionId}`
            });
            await secondResult;

            const totalDelta = room.state.chaserFinalRemainingMs - remainingAtStart;
            assert.ok(
                totalDelta > 700 && totalDelta <= 2 * CHASER_ABILITIES.timeBonusMs,
                `two correct answers should extend the clock by ~${2 * CHASER_ABILITIES.timeBonusMs}ms total, got ${totalDelta}ms`
            );
        });

        it("does not extend the clock for a character other than Big Stan", async () => {
            const { room, chaserClient, chaserMessage } = await reachChaserFinal(colyseus, "bezos");
            room.state.teamScore = 5;
            const remainingBefore = room.state.chaserFinalRemainingMs;

            const result = chaserClient.waitForMessage("answerResult");
            chaserClient.send("submitFinalChaserAnswer", {
                questionId: chaserMessage.questionId,
                answer: `Answer ${chaserMessage.questionId}`
            });
            await result;

            assert.strictEqual(room.state.chaserFinalRemainingMs, remainingBefore, "only Big Stan gets the Time Bonus");
        });
    });

    describe("Short Fuse (Nami)", () => {
        it("Nami's ChaserFinal uses a 10,000ms steal window even when the room was configured with the true 20,000ms default", async () => {
            const { room } = await reachChaserFinal(colyseus, "nami", { stealWindowMs: FINAL_ROUND.stealWindowMs });
            assert.strictEqual(room.stealWindowMs, CHASER_ABILITIES.shortFuseStealWindowMs);
        });

        it("every other character keeps the room's configured steal window (the true 20,000ms default) unchanged", async () => {
            const { room } = await reachChaserFinal(colyseus, "bezos", { stealWindowMs: FINAL_ROUND.stealWindowMs });
            assert.strictEqual(room.stealWindowMs, FINAL_ROUND.stealWindowMs);
        });

        it("does not reset a non-Nami chaser's short test-only stealWindowMs override back to the config default", async () => {
            const { room } = await reachChaserFinal(colyseus, "big stan", { stealWindowMs: 250 });
            assert.strictEqual(
                room.stealWindowMs,
                250,
                "startFinalChaser must not touch room.stealWindowMs for a non-Nami chaser"
            );
        });

        it("actually broadcasts a 10,000ms steal window when Nami misses, overriding a 150ms room option", async () => {
            const { room, contestantClient, chaserClient, chaserMessage } = await reachChaserFinal(colyseus, "nami", { stealWindowMs: 150 });

            const steal = contestantClient.waitForMessage("finalSteal");
            chaserClient.send("submitFinalChaserAnswer", { questionId: chaserMessage.questionId, answer: "not it at all" });
            const stealMessage = await steal;

            assert.strictEqual(stealMessage.windowMs, CHASER_ABILITIES.shortFuseStealWindowMs);
            assert.strictEqual(room.stealWindowMs, CHASER_ABILITIES.shortFuseStealWindowMs);
        });
    });
});
