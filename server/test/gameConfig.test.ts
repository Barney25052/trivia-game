import assert from "assert";
import { CASH_BUILDER, CHASER_POT, BOARD, CHASE_QUESTION, FINAL_ROUND, CHASER_CHARACTERS, SHARED_CHASER_ABILITIES, CHASER_ABILITIES, LINEUP, REACTION } from "../src/gameConfig.js";
import { PlayerRole, ChaserCharacter } from "../src/TriviaTypes.js";

describe("gameConfig", () => {
  it("cash builder: 60s, $1000 per correct answer", () => {
    assert.strictEqual(CASH_BUILDER.durationMs, 60_000);
    assert.strictEqual(CASH_BUILDER.rewardPerCorrect, 1_000);
  });

  it("chaser pot: starts at $50k, +$30k per round", () => {
    assert.strictEqual(CHASER_POT.initial, 50_000);
    assert.strictEqual(CHASER_POT.perRound, 30_000);
  });

  it("board: 7 spaces, offer starts 4/5/6, chaser 8 -> 7, escape at 0", () => {
    assert.strictEqual(BOARD.spaces, 7);
    assert.strictEqual(BOARD.startLow, 4);
    assert.strictEqual(BOARD.startMiddle, 5);
    assert.strictEqual(BOARD.startHigh, 6);
    assert.strictEqual(BOARD.chaserStartOffboard, 8);
    assert.strictEqual(BOARD.chaserFirstCorrectSpace, 7);
    assert.strictEqual(BOARD.escapeSpace, 0);
  });

  it("chase question: 3 options, 5s answer window once a side answers", () => {
    assert.strictEqual(CHASE_QUESTION.optionCount, 3);
    assert.strictEqual(CHASE_QUESTION.answerWindowMs, 5_000);
  });

  it("final round: 2 minutes per side", () => {
    assert.strictEqual(FINAL_ROUND.teamDurationMs, 120_000);
    assert.strictEqual(FINAL_ROUND.chaserDurationMs, 120_000);
  });

  it("lineup: ~7s interstitial, clamped like the other durations", () => {
    assert.strictEqual(LINEUP.durationMs, 7_000);
    assert.ok(LINEUP.minMs <= LINEUP.durationMs, "min clamp is at or below the default");
    assert.ok(LINEUP.maxMs >= LINEUP.durationMs, "max clamp is at or above the default");
  });

  it("reaction: two wrong in a row goes teary; offer thresholds match the retired OfferScreen computed", () => {
    assert.strictEqual(REACTION.wrongStreakTear, 2);
    assert.strictEqual(REACTION.offerSadLowThreshold, 0);
    assert.strictEqual(REACTION.offerHappyHighThreshold, 50_000);
  });

  it("PlayerRole has both roles", () => {
    assert.strictEqual(PlayerRole.Contestant, "contestant");
    assert.strictEqual(PlayerRole.Chaser, "chaser");
  });

  it("chaser roster: 4 characters, unique ids matching the enum, Bezos has 0 active, everyone else has 1 active + 1 passive", () => {
    const enumIds = Object.values(ChaserCharacter);
    assert.strictEqual(CHASER_CHARACTERS.length, 4);
    assert.strictEqual(CHASER_CHARACTERS.length, enumIds.length);

    const ids = CHASER_CHARACTERS.map((c) => c.id);
    assert.strictEqual(new Set(ids).size, ids.length, "character ids are unique");

    for (const character of CHASER_CHARACTERS) {
      assert.ok(enumIds.includes(character.id as ChaserCharacter), `${character.id} is a ChaserCharacter enum value`);
      assert.ok(character.name.length > 0, `${character.id} has a name`);
      assert.ok(character.tagline.length > 0, `${character.id} has a tagline`);
      for (const ability of [...character.passive, ...character.active]) {
        assert.ok(ability.id.length > 0, `${character.id} ability has an id`);
        assert.ok(ability.name.length > 0, `${character.id} ability has a name`);
        assert.ok(ability.description.length > 0, `${character.id} ability has a description`);
      }
    }

    const bezos = CHASER_CHARACTERS.find((c) => c.id === "bezos");
    assert.strictEqual(bezos?.active.length, 0, "Bezos has no active abilities — both traits are automatic");
    assert.strictEqual(bezos?.passive.length, 2, "Bezos has both passive traits");

    for (const character of CHASER_CHARACTERS.filter((c) => c.id !== "bezos")) {
      assert.strictEqual(character.active.length, 1, `${character.id} has exactly 1 active ability`);
      assert.strictEqual(character.passive.length, 1, `${character.id} has exactly 1 passive ability`);
    }
  });

  it("shared chaser abilities: 50/50 and skip, available to every character", () => {
    const ids = SHARED_CHASER_ABILITIES.map((a) => a.id);
    assert.deepStrictEqual(ids, ["fiftyFifty", "skip"]);
  });

  it("chaser abilities tunables: fixed use counts and constants", () => {
    assert.strictEqual(CHASER_ABILITIES.fiftyFifty.usesPerGame, 4);
    assert.strictEqual(CHASER_ABILITIES.skip.usesPerGame, 2);
    assert.strictEqual(CHASER_ABILITIES.pushbackImmunity.usesPerGame, 3);
    assert.strictEqual(CHASER_ABILITIES.doubleTime.usesPerTableRound, 1);
    assert.strictEqual(CHASER_ABILITIES.reRack.usesPerTableRound, 1);
    assert.strictEqual(CHASER_ABILITIES.jumble.usesPerTableRound, 1);
    assert.strictEqual(CHASER_ABILITIES.timeBonusMs, 500);
    assert.strictEqual(CHASER_ABILITIES.shortFuseStealWindowMs, 10_000);
  });
});