import assert from "assert";
import { loadBank, pickRandom, BankQuestion } from "../src/questions/bank.js";

describe("question bank", () => {
  const bank = loadBank();

  it("loads the seed data with at least 40 unique questions", () => {
    assert.ok(bank.length >= 40, `expected >= 40 questions, got ${bank.length}`);
    const ids = new Set(bank.map((question) => question.id));
    assert.strictEqual(ids.size, bank.length, "question ids must be unique");
  });

  it("every question carries an alternatives array of strings", () => {
    for (const question of bank) {
      assert.ok(Array.isArray(question.alternatives), `question ${question.id} lacks an alternatives array`);
      for (const alternative of question.alternatives ?? []) {
        assert.strictEqual(typeof alternative, "string", `question ${question.id} has a non-string alternative`);
      }
    }
  });

  it("pickRandom returns the requested number of distinct questions", () => {
    const picked = pickRandom(bank, 5);
    assert.strictEqual(picked.length, 5);
    const ids = new Set(picked.map((question) => question.id));
    assert.strictEqual(ids.size, 5, "picked questions must not repeat ids");
  });

  it("pickRandom honours excluded ids", () => {
    const excludeIds = new Set(bank.slice(0, 10).map((question) => question.id));
    const picked = pickRandom(bank, 5, excludeIds);
    for (const question of picked) {
      assert.ok(!excludeIds.has(question.id), `picked excluded question ${question.id}`);
    }
  });

  it("pickRandom honours exclusions across consecutive draws", () => {
    const first = pickRandom(bank, 3);
    const second = pickRandom(bank, 3, new Set(first.map((question) => question.id)));
    const firstIds = new Set(first.map((question) => question.id));
    for (const question of second) {
      assert.ok(!firstIds.has(question.id), `picked the same question twice: ${question.id}`);
    }
  });

  it("pickRandom throws when count exceeds the available pool", () => {
    assert.throws(() => pickRandom(bank, bank.length + 1), /Cannot pick/);
  });

  it("pickRandom throws when exclusions leave too few questions", () => {
    const allIds = new Set(bank.map((question) => question.id));
    assert.throws(() => pickRandom(bank, 5, allIds), /Cannot pick/);
  });
});