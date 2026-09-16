import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
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

/** Two players (vote mode, Carol always wins the Chaser vote) walked to the
 * top of the Offer phase with a deterministic Chaser character — lets a test
 * pick "bezos" vs. any other character to exercise the No Middle passive
 * (ticket 143). Stops before any low/high is set (and before offerChoice) so
 * the test drives the rest of the offer itself and can assert on rejection.
 * `offerStart` is captured because it fires the instant Offer opens, before
 * this helper's own `waitForPhase(Offer)` would ever see it. */
async function reachOfferAsChaser(
    colyseus: ColyseusTestServer<typeof appConfig>,
    chaserCharacterId: string,
    opts?: { cashBuilderMoney?: number; teamPot?: number }
): Promise<{
    room: any;
    contestantClient: any;
    chaserClient: any;
    contestantSeatId: string;
    chaserSeatId: string;
    offerStart: any;
}> {
    const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 80,
        chaserSelectionDurationMs: 10000,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        teamFinalIntroDurationMs: 80
    });

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
    if (opts?.teamPot !== undefined) {
        room.state.teamPot = opts.teamPot;
    }
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = opts?.cashBuilderMoney ?? 5000;

    const offerStartPromise = alice.waitForMessage("offerStart");
    await waitForPhase(room, GamePhase.Offer);
    const offerStart = await offerStartPromise;

    const chaserSeatId = room.state.chaserSeatId;
    const contestantSeatId = room.state.activeContestantSeatId;
    assert.strictEqual(chaserSeatId, seatIdOf(room, carol), "Carol must be the deterministic chaser");
    assert.strictEqual(
        room.state.players.get(chaserSeatId).chaserCharacterId,
        chaserCharacterId,
        "the chaser must have picked the requested character"
    );

    return { room, contestantClient: alice, chaserClient: carol, contestantSeatId, chaserSeatId, offerStart };
}

describe("offer-phase passive: No Middle (Bezos) (ticket 143)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    describe("broadcasts carry middleVoided", () => {
        it("offerStart carries middleVoided: true when Bezos is the Chaser", async () => {
            const { room, offerStart } = await reachOfferAsChaser(colyseus, "bezos");
            assert.strictEqual(offerStart.middleVoided, true);
            assert.strictEqual(room.currentOffer.middleVoided, true, "also tracked on room.currentOffer");
        });

        it("offerStart carries middleVoided: false for a non-Bezos Chaser", async () => {
            const { room, offerStart } = await reachOfferAsChaser(colyseus, "nami");
            assert.strictEqual(offerStart.middleVoided, false);
            assert.strictEqual(room.currentOffer.middleVoided, false);
        });

        it("the offer broadcast (once low/high are both set) carries middleVoided: true for Bezos", async () => {
            const { room, contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "bezos");

            const offerPromise = contestantClient.waitForMessage("offer");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            const offer = await offerPromise;

            assert.strictEqual(offer.middleVoided, true);
            assert.deepStrictEqual(offer.offers, { low: 1000, middle: 5000, high: 12000, middleVoided: true });
            assert.strictEqual(room.currentOffer.middleVoided, true);
        });

        it("the offer broadcast carries middleVoided: false for a non-Bezos Chaser", async () => {
            const { contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "big stan");

            const offerPromise = contestantClient.waitForMessage("offer");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            const offer = await offerPromise;

            assert.strictEqual(offer.middleVoided, false);
        });
    });

    describe("offerChoice enforcement", () => {
        it("rejects 'middle' against a Bezos Chaser — logged, no state change, still stuck in Offer", async () => {
            const { room, contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "bezos");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            await sleep(30);

            const currentOfferAmountBefore = room.currentOfferAmount;
            const wagerBefore = room.state.chaseWagerAmount;

            contestantClient.send("offerChoice", { offer: "middle" });
            await sleep(50);

            assert.strictEqual(room.state.currentPhase, GamePhase.Offer, "the middle pick must be rejected, not transition to Chase");
            assert.strictEqual(room.currentOfferAmount, currentOfferAmountBefore, "no state change from the rejected pick");
            assert.strictEqual(room.state.chaseWagerAmount, wagerBefore, "no state change from the rejected pick");
        });

        it("still allows 'low' against a Bezos Chaser", async () => {
            const { room, contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "bezos");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            await sleep(30);

            contestantClient.send("offerChoice", { offer: "low" });
            await waitForPhase(room, GamePhase.Chase);
            assert.strictEqual(room.currentOfferAmount, 1000);
        });

        it("still allows 'high' against a Bezos Chaser", async () => {
            const { room, contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "bezos");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            await sleep(30);

            contestantClient.send("offerChoice", { offer: "high" });
            await waitForPhase(room, GamePhase.Chase);
            assert.strictEqual(room.currentOfferAmount, 12000);
        });

        it("a rejected 'middle' pick does not block a later valid pick from the same contestant", async () => {
            const { room, contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "bezos");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            await sleep(30);

            contestantClient.send("offerChoice", { offer: "middle" });
            await sleep(50);
            assert.strictEqual(room.state.currentPhase, GamePhase.Offer);

            contestantClient.send("offerChoice", { offer: "high" });
            await waitForPhase(room, GamePhase.Chase);
            assert.strictEqual(room.currentOfferAmount, 12000);
        });

        it("'middle' still works exactly as before against a non-Bezos Chaser", async () => {
            const { room, contestantClient, chaserClient } = await reachOfferAsChaser(colyseus, "maggie");
            chaserClient.send("setChaserLowOffer", { amount: 1000 });
            await sleep(30);
            chaserClient.send("setChaserHighOffer", { amount: 12000 });
            await sleep(30);

            contestantClient.send("offerChoice", { offer: "middle" });
            await waitForPhase(room, GamePhase.Chase);
            assert.strictEqual(room.currentOfferAmount, 5000, "the middle (cash builder take) amount was accepted");
        });
    });

    describe("ticket 058's $0-middle pre-fill is unaffected by middleVoided", () => {
        it("Bezos as Chaser: low is still pre-filled to $0 exactly as before, but 'middle' is now rejected while 'low' still resolves the round", async () => {
            const { room, contestantClient, chaserClient, offerStart } = await reachOfferAsChaser(colyseus, "bezos", {
                cashBuilderMoney: 0,
                teamPot: 0
            });

            assert.strictEqual(room.currentOffer.middle, 0);
            assert.strictEqual(room.currentOffer.low, 0, "low is still pre-filled at $0, same as without No Middle");
            assert.strictEqual(offerStart.low, 0, "the offerStart broadcast still carries the pre-filled low");
            assert.strictEqual(offerStart.middleVoided, true);

            // The pre-fill means setChaserLowOffer is still a no-op here (ticket 058) —
            // unrelated to, and unaffected by, No Middle.
            chaserClient.send("setChaserLowOffer", { amount: -100 });
            await sleep(50);
            assert.strictEqual(room.currentOffer.low, 0, "a low offer can not be set when middle is already $0");

            chaserClient.send("setChaserHighOffer", { amount: 8000 });
            await sleep(50);
            assert.strictEqual(room.currentOffer.high, 8000);

            // "middle" is $0 here too, but it's still a voided tier against Bezos.
            contestantClient.send("offerChoice", { offer: "middle" });
            await sleep(50);
            assert.strictEqual(room.state.currentPhase, GamePhase.Offer, "middle must stay rejected even though its value equals the pre-filled low");

            contestantClient.send("offerChoice", { offer: "low" });
            await waitForPhase(room, GamePhase.Chase);
            assert.strictEqual(room.currentOfferAmount, 0);
        });

        it("non-Bezos Chaser: low is pre-filled to $0 and 'middle' still resolves the round normally", async () => {
            const { room, contestantClient, chaserClient, offerStart } = await reachOfferAsChaser(colyseus, "nami", {
                cashBuilderMoney: 0,
                teamPot: 0
            });

            assert.strictEqual(room.currentOffer.middle, 0);
            assert.strictEqual(room.currentOffer.low, 0);
            assert.strictEqual(offerStart.low, 0);
            assert.strictEqual(offerStart.middleVoided, false);

            chaserClient.send("setChaserHighOffer", { amount: 8000 });
            await sleep(50);

            contestantClient.send("offerChoice", { offer: "middle" });
            await waitForPhase(room, GamePhase.Chase);
            assert.strictEqual(room.currentOfferAmount, 0);
        });
    });
});
