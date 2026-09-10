import assert from "assert";
import { checkAnswer } from "../src/questions/answerChecker.js";

describe("answer checker", () => {
  it("exact match", () => {
    assert.strictEqual(checkAnswer("Mars", "Mars"), true);
  });

  it("case-insensitive", () => {
    assert.strictEqual(checkAnswer("mars", "Mars"), true);
  });

  it("leading/trailing whitespace", () => {
    assert.strictEqual(checkAnswer(" Mars ", "Mars"), true);
  });

  it("internal whitespace collapse", () => {
    assert.strictEqual(checkAnswer("Carbon  dioxide", "Carbon dioxide"), true);
  });

  it("numeric answers", () => {
    assert.strictEqual(checkAnswer("206", "206"), true);
    assert.strictEqual(checkAnswer(" 206 ", "206"), true);
  });

  it("wrong answer returns false", () => {
    assert.strictEqual(checkAnswer("Earth", "Mars"), false);
  });

  it("empty string returns false", () => {
    assert.strictEqual(checkAnswer("", "Mars"), false);
  });

  it("partial match returns false", () => {
    assert.strictEqual(checkAnswer("Mar", "Mars"), false);
  });
});