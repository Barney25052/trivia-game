import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { GameState } from "../src/rooms/schema/GameState.js";
import { GamePhase } from "../src/TriviaTypes.js";
import { OFFER_QUIPS } from "../src/gameConfig.js";
import { pickOfferQuip } from "../src/offerQuips.js";
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

describe("offerQuips", () => {
  describe("pickOfferQuip", () => {
    it("returns a member of the requested stage's pool", () => {
      for (const stage of ["start", "low", "high"] as const) {
        for (let i = 0; i < 20; i += 1) {
          assert.ok(
            OFFER_QUIPS[stage].includes(pickOfferQuip(stage)),
            `picked line should come from the ${stage} pool`
          );
        }
      }
    });
  });

  describe("quip in the offer broadcasts (ticket 057)", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeEach(async () => {
      colyseus = await getTestServer();
      await cleanup();
    });

    /** Two players into the Offer phase, with the active contestant's middle set to $5000. */
    async function reachOffer(colyseus: ColyseusTestServer<typeof appConfig>) {
      const room = await colyseus.createRoom<GameState>("trivia", {
        cashBuilderDurationMs: 250,
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
      await waitForPhase(room, GamePhase.CashBuilder);
      room.state.players.get(room.state.activeContestantSeatId).cashBuilderMoney = 5000;
      await waitForPhase(room, GamePhase.Offer);

      const chaserSeatId = room.state.chaserSeatId;
      const chaserClient = chaserSeatId === seatIdOf(room, alice) ? alice : bob;
      return { room, alice, bob, chaserClient };
    }

    it("offerStart / offerLowSet / offer all carry a pool quip that every client sees identically", async () => {
      const { room, alice, bob, chaserClient } = await reachOffer(colyseus);

      const offerStartOnAlice = alice.waitForMessage("offerStart");
      const offerStartOnBob = bob.waitForMessage("offerStart");
      const startOnAlice = await offerStartOnAlice;
      const startOnBob = await offerStartOnBob;
      assert.ok(
        OFFER_QUIPS.start.includes(startOnAlice.quip),
        "offerStart should carry a start-stage quip from the pool"
      );
      assert.strictEqual(
        startOnAlice.quip,
        startOnBob.quip,
        "both clients must receive the same start quip"
      );

      const lowSetOnAlice = alice.waitForMessage("offerLowSet");
      const lowSetOnBob = bob.waitForMessage("offerLowSet");
      chaserClient.send("setChaserLowOffer", { amount: 0 });
      const lowOnAlice = await lowSetOnAlice;
      const lowOnBob = await lowSetOnBob;
      assert.ok(
        OFFER_QUIPS.low.includes(lowOnAlice.quip),
        "offerLowSet should carry a low-stage quip from the pool"
      );
      assert.strictEqual(lowOnAlice.quip, lowOnBob.quip, "both clients must receive the same low quip");

      const offerOnAlice = alice.waitForMessage("offer");
      const offerOnBob = bob.waitForMessage("offer");
      chaserClient.send("setChaserHighOffer", { amount: 12000 });
      const offerOnAliceResolved = await offerOnAlice;
      const offerOnBobResolved = await offerOnBob;
      assert.ok(
        OFFER_QUIPS.high.includes(offerOnAliceResolved.quip),
        "offer should carry a high-stage quip from the pool"
      );
      assert.strictEqual(
        offerOnAliceResolved.quip,
        offerOnBobResolved.quip,
        "both clients must receive the same high quip"
      );

      assert.strictEqual(room.state.currentPhase, GamePhase.Offer);
    });
  });
});