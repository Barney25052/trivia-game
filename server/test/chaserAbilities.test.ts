import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { CHASER_ABILITIES } from "../src/gameConfig.js";
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

        const usedBroadcast = carol.waitForMessage("chaserAbilityUsed");
        carol.send("useChaserAbility", { ability: "reRack" });
        await usedBroadcast;
        assert.strictEqual(room.state.reRackUsedThisTableRound, true);

        // Catch Alice (Chaser always correct, contestant always wrong) — with a
        // bystander still waiting, this advances to Bob's CashBuilder next
        // rather than ending the game.
        let question = firstQuestion;
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
