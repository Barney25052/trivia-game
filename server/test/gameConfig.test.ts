import assert from "assert";
import { CASH_BUILDER, CHASER_POT, BOARD, CHASE_QUESTION, FINAL_ROUND, CHASER_CHARACTERS } from "../src/gameConfig.js";
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

  it("PlayerRole has both roles", () => {
    assert.strictEqual(PlayerRole.Contestant, "contestant");
    assert.strictEqual(PlayerRole.Chaser, "chaser");
  });

  it("chaser roster: every character matches the enum and carries an ability field", () => {
    const enumIds = Object.values(ChaserCharacter);
    assert.strictEqual(CHASER_CHARACTERS.length, enumIds.length);
    for (const character of CHASER_CHARACTERS) {
      assert.ok(enumIds.includes(character.id), `${character.id} is a ChaserCharacter enum value`);
      assert.ok(character.name.length > 0, `${character.id} has a name`);
      assert.strictEqual(typeof character.ability, "string", `${character.id} has an ability string`);
    }
  });
});