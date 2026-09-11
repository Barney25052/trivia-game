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

  it("spaces are irrelevant", () => {
    assert.strictEqual(checkAnswer("Twenty  Two", "TwentyTwo"), true);
  });

  it("filler words are removed", () => {
    assert.strictEqual(checkAnswer("Kermit The Frog", "KermitFrog"), true);
  });

  it("numeric answers", () => {
    assert.strictEqual(checkAnswer("206", "206"), true);
    assert.strictEqual(checkAnswer(" 206 ", "206"), true);
  });

  it("partial match with transposition passes", () => {
    assert.strictEqual(checkAnswer("Masr", "Mars"), true);
  });

  it("wrong answer returns false", () => {
    assert.strictEqual(checkAnswer("Earth", "Mars"), false);
  });

  it("empty string returns false", () => {
    assert.strictEqual(checkAnswer("", "Mars"), false);
    assert.strictEqual(checkAnswer("   ", "Mars"), false);
  });

  it("partial match too far returns false", () => {
    assert.strictEqual(checkAnswer("Xars", "Mars"), false);
  });

  it("handles common name typo: Marc Rufallo vs Mark Ruffalo", () => {
    assert.strictEqual(checkAnswer("Marc Rufallo", "Mark Ruffalo"), true);
  });

  it("handles sentence typos: Tihs is a porly writen snetnece", () => {
    assert.strictEqual(
      checkAnswer("Tihs is a porly writen snetnece", "this is a poorly written sentence"),
      true
    );
  });

  it("accepts an alternative answer alongside the canonical one", () => {
    assert.strictEqual(checkAnswer("Fyodor Dostoevsky", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });

  it("accepts the canonical answer when alternatives are present", () => {
    assert.strictEqual(checkAnswer("Dostoevsky", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });

  it("rejects an answer that matches no alternative", () => {
    assert.strictEqual(checkAnswer("Tolstoy", ["Dostoevsky", "Fyodor Dostoevsky"]), false);
  });

  it("an empty alternatives list still accepts the canonical answer", () => {
    assert.strictEqual(checkAnswer("Mars", ["Mars"]), true);
    assert.strictEqual(checkAnswer("Earth", ["Mars"]), false);
  });

  it("alternative matching is still lenient on case and whitespace", () => {
    assert.strictEqual(checkAnswer(" fyodor dostoevsky ", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });

  it("a misspelled alternative passes if it is close enough", () => {
    assert.strictEqual(checkAnswer("Dostoevsyk", ["Dostoevsky", "Fyodor Dostoevsky"]), true);
  });
});