import assert from "assert";
import {
  canonicalDigits,
  numberWordSpelling,
  readNumberWords,
  romanValue,
  scaleDigits,
  splitJoinedNumberWords
} from "../src/questions/answerNumbers.js";

describe("answer numbers (ticket 161)", () => {
  it("reads valid Roman numerals and nothing else", () => {
    assert.strictEqual(romanValue("xiv"), 14);
    assert.strictEqual(romanValue("viii"), 8);
    assert.strictEqual(romanValue("mcmlxxxix"), 1989);
    assert.strictEqual(romanValue("iiii"), null);
    assert.strictEqual(romanValue("ic"), null);
    assert.strictEqual(romanValue("mars"), null);
    assert.strictEqual(romanValue(""), null);
  });

  it("reads runs of number words", () => {
    const values = (words: string[]) => readNumberWords(words).map((number) => number.value);
    assert.deepStrictEqual(values(["twenty", "two"]), ["22"]);
    assert.deepStrictEqual(values(["one", "hundred", "forty", "seven"]), ["147"]);
    assert.deepStrictEqual(values(["two", "thousand", "nine"]), ["2009"]);
    assert.deepStrictEqual(values(["nineteen", "hundred"]), ["1900"]);
    assert.deepStrictEqual(values(["hundred"]), ["100"]);
    assert.deepStrictEqual(values(["seven", "million"]), ["7000000"]);
    assert.deepStrictEqual(values(["twenty", "first"]), ["21"]);
    assert.deepStrictEqual(values(["zero"]), ["0"]);
  });

  it("starts a new number where words can't continue one", () => {
    const values = (words: string[]) => readNumberWords(words).map((number) => number.value);
    assert.deepStrictEqual(values(["fifty", "fifty"]), ["50", "50"]);
    assert.deepStrictEqual(values(["one", "two", "three"]), ["1", "2", "3"]);
    assert.deepStrictEqual(values(["first", "second"]), ["1", "2"]);
    assert.deepStrictEqual(values(["nineteen", "eighty", "four"]), ["19", "84"]);
  });

  it("splits number words written without spaces", () => {
    assert.deepStrictEqual(splitJoinedNumberWords("twentytwo"), ["twenty", "two"]);
    assert.deepStrictEqual(splitJoinedNumberWords("seventeen"), ["seventeen"]);
    assert.deepStrictEqual(splitJoinedNumberWords("onehundredandsix"), ["one", "hundred", "six"]);
    assert.strictEqual(splitJoinedNumberWords("tent"), null);
    assert.strictEqual(splitJoinedNumberWords("often"), null);
  });

  it("spells number words with doubled letters forgiven only when asked", () => {
    assert.strictEqual(numberWordSpelling("seven", false), "seven");
    assert.strictEqual(numberWordSpelling("seeven", true), "seven");
    assert.strictEqual(numberWordSpelling("thre", true), "three");
    assert.strictEqual(numberWordSpelling("seeven", false), null);
    assert.strictEqual(numberWordSpelling("sevn", true), null);
  });

  it("canonicalises written numbers", () => {
    assert.strictEqual(canonicalDigits("3.10"), "3.1");
    assert.strictEqual(canonicalDigits("3.0"), "3");
    assert.strictEqual(canonicalDigits("10"), "10");
    assert.strictEqual(canonicalDigits("007"), "007");
    assert.strictEqual(scaleDigits("7", 1e6), "7000000");
    assert.strictEqual(scaleDigits("1.5", 1e6), "1500000");
    assert.strictEqual(scaleDigits("0.5", 100), "50");
  });
});
