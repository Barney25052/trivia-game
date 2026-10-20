import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { ChaserCharacter, GamePhase } from "../src/TriviaTypes.js";
import { CHASER_ABILITIES } from "../src/gameConfig.js";
import { canUseAbility, poweredChaserCharacter } from "../src/rooms/handlers/chaserAbilities.js";
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

/** Carol wins the Chaser vote and locks in `characterId` with the given
 * `revealReady` extras; Alice is the contestant. Stops at the Roles Reveal
 * if Carol's message is refused. */
async function lockInChaser(
    colyseus: ColyseusTestServer<typeof appConfig>,
    characterId: string,
    chaserExtras: Record<string, unknown>,
    contestantExtras: Record<string, unknown> = {}
): Promise<{ room: any; carol: any; alice: any }> {
    const room: any = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 400,
        chaserSelectionDurationMs: 10000,
        chaserRevealDurationMs: 80,
        chaserCharacterRevealDurationMs: 80,
        revealReadyCooldownMs: 80,
        lineupDurationMs: 80,
        chaseAnswerWindowMs: 2000
    });
    room.mcQuestionSource = stubChaseSource();
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

    alice.send("revealReady", { ...contestantExtras });
    carol.send("revealReady", { characterId, ...chaserExtras });
    await sleep(50);
    return { room, carol, alice };
}

/** Walks a locked-in room through the Offer into a live chase question. */
async function reachChase(room: any, carol: any, alice: any, offer: "low" | "middle" | "high"): Promise<any> {
    await waitForPhase(room, GamePhase.CashBuilder);
    room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 1000;
    await waitForPhase(room, GamePhase.Offer);
    carol.send("setChaserLowOffer", { amount: 0 });
    await sleep(30);
    carol.send("setChaserHighOffer", { amount: 2000 });
    await sleep(30);
    const question = alice.waitForMessage("question");
    alice.send("offerChoice", { offer });
    return question;
}

describe("Chaser hard mode (ticket 170)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
        colyseus = await getTestServer();
        await cleanup();
    });

    it("the Chaser's lock-in turns hard mode on for the whole room", async () => {
        const { room, carol } = await lockInChaser(colyseus, ChaserCharacter.BigStan, { hardMode: true });
        assert.strictEqual(room.state.players.get(seatIdOf(room, carol)).revealReady, true);
        assert.strictEqual(room.state.hardMode, true);
    });

    it("stays off when the Chaser doesn't ask for it, whatever a contestant sends", async () => {
        const { room, carol } = await lockInChaser(colyseus, ChaserCharacter.Nami, {}, { hardMode: true });
        assert.strictEqual(room.state.players.get(seatIdOf(room, carol)).revealReady, true);
        assert.strictEqual(room.state.hardMode, false, "a contestant can't switch the Chaser's powers off");
    });

    it("refuses a malformed hardMode, leaving the Chaser to pick again", async () => {
        const { room, carol } = await lockInChaser(colyseus, ChaserCharacter.Maggie, { hardMode: "yes" });
        assert.strictEqual(room.state.currentPhase, GamePhase.RolesReveal);
        assert.strictEqual(room.state.players.get(seatIdOf(room, carol)).revealReady, false);
        assert.strictEqual(room.state.hardMode, false);
    });

    it("refuses every manual ability mid-chase, without spending a charge", async () => {
        const { room, carol, alice } = await lockInChaser(colyseus, ChaserCharacter.BigStan, { hardMode: true });
        await reachChase(room, carol, alice, "low");
        let cues = 0;
        alice.onMessage("chaserAbilityUsed", () => { cues += 1; });

        for (const ability of ["fiftyFifty", "doubleTime", "reRack", "jumble", "skip"]) {
            assert.deepStrictEqual(
                canUseAbility(room, room.state.chaserSeatId, ability),
                { ok: false, reason: "Hard mode: the Chaser plays with no powers" },
                ability
            );
            carol.send("useChaserAbility", { ability });
        }
        await sleep(150);
        assert.strictEqual(cues, 0, "nothing fired");
        assert.strictEqual(room.state.fiftyFiftyUsesRemaining, CHASER_ABILITIES.fiftyFifty.usesPerGame);
        assert.strictEqual(room.state.doubleTimeUsedThisTableRound, false);
        assert.strictEqual(room.state.doubleTimeArmed, false);
    });

    it("Bezos's No Middle is off: the middle offer is a legal pick", async () => {
        const { room, carol, alice } = await lockInChaser(colyseus, ChaserCharacter.Bezos, { hardMode: true });
        const offerStart = alice.waitForMessage("offerStart");
        const firstQuestion = reachChase(room, carol, alice, "middle");
        assert.strictEqual((await offerStart).middleVoided, false);
        await firstQuestion;
        assert.strictEqual(room.state.currentPhase, GamePhase.Chase);
        assert.strictEqual(room.state.chaseWagerAmount, 1000, "played for the middle offer");
    });

    it("no character's passive matches in hard mode", () => {
        const room = {
            state: {
                hardMode: true,
                chaserSeatId: "seat-1",
                players: new Map([["seat-1", { chaserCharacterId: ChaserCharacter.Maggie }]])
            }
        };
        assert.strictEqual(poweredChaserCharacter(room), "", "Silence, Time Bonus, Short Fuse and both of Bezos's passives all check this");
        room.state.hardMode = false;
        assert.strictEqual(poweredChaserCharacter(room), ChaserCharacter.Maggie);
    });
});
