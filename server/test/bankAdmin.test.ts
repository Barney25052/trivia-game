import assert from "assert";
import { BANK_EDIT } from "../src/gameConfig.js";
import { getBankDb, loadBank, openBankDb, setBankDb } from "../src/questions/bank.js";
import { appendQuestion, validateNewQuestion } from "../src/questions/bankAdmin.js";
import { getTestServer } from "./testServer.js";

/** Inserts a row directly (bypassing appendQuestion) so tests can seed a
 * known starting state for the isolated in-memory DB. */
function insertRow(id: number, question: string, answer: string, alternatives: string[] = []): void {
  getBankDb()
    .prepare("INSERT INTO questions (id, question, answer, alternatives) VALUES (?, ?, ?, ?)")
    .run(id, question, answer, JSON.stringify(alternatives));
}

describe("validateNewQuestion", () => {
  const validInput = () => ({
    question: "What is the capital of France?",
    answer: "Paris",
    alternatives: ["Paris, France"]
  });

  it("accepts a complete valid question and trims its fields", () => {
    const result = validateNewQuestion({
      question: "  What is the capital of France?  ",
      answer: "  Paris  ",
      alternatives: ["  Paris, France  ", "  paris "]
    });
    assert.ok(result.ok);
    if (result.ok) {
      assert.strictEqual(result.value.question, "What is the capital of France?");
      assert.strictEqual(result.value.answer, "Paris");
      assert.deepStrictEqual(result.value.alternatives, ["Paris, France", "paris"]);
    }
  });

  it("defaults missing alternatives to an empty array", () => {
    const result = validateNewQuestion({ question: "Q?", answer: "A" });
    assert.ok(result.ok);
    if (result.ok) {
      assert.deepStrictEqual(result.value.alternatives, []);
    }
  });

  it("rejects non-object bodies", () => {
    for (const input of [null, undefined, "text", 42, [], true]) {
      const result = validateNewQuestion(input);
      assert.ok(!result.ok, `expected rejection for ${JSON.stringify(input)}`);
    }
  });

  it("rejects missing, blank, non-string and over-length questions", () => {
    const cases = [
      { answer: "A" },
      { question: "", answer: "A" },
      { question: "   ", answer: "A" },
      { question: 42, answer: "A" },
      { question: null, answer: "A" },
      { question: "x".repeat(BANK_EDIT.maxQuestionLength + 1), answer: "A" }
    ];
    for (const input of cases) {
      assert.ok(!validateNewQuestion(input).ok, `expected rejection for ${JSON.stringify(input).slice(0, 80)}`);
    }
  });

  it("rejects missing, blank, non-string and over-length answers", () => {
    const cases = [
      { question: "Q?" },
      { question: "Q?", answer: "" },
      { question: "Q?", answer: "   " },
      { question: "Q?", answer: 42 },
      { question: "Q?", answer: null },
      { question: "Q?", answer: "x".repeat(BANK_EDIT.maxAnswerLength + 1) }
    ];
    for (const input of cases) {
      assert.ok(!validateNewQuestion(input).ok, `expected rejection for ${JSON.stringify(input).slice(0, 80)}`);
    }
  });

  it("rejects a non-array alternatives field", () => {
    const result = validateNewQuestion({ question: "Q?", answer: "A", alternatives: "nope" });
    assert.ok(!result.ok);
  });

  it("rejects blank or non-string alternatives", () => {
    const cases = [
      { question: "Q?", answer: "A", alternatives: [""] },
      { question: "Q?", answer: "A", alternatives: ["   "] },
      { question: "Q?", answer: "A", alternatives: [42] },
      { question: "Q?", answer: "A", alternatives: [null] },
      { question: "Q?", answer: "A", alternatives: ["ok", "x".repeat(BANK_EDIT.maxAlternativeLength + 1)] }
    ];
    for (const input of cases) {
      assert.ok(!validateNewQuestion(input).ok, `expected rejection for ${JSON.stringify(input).slice(0, 80)}`);
    }
  });

  it("rejects too many alternatives", () => {
    const alternatives = Array.from({ length: BANK_EDIT.maxAlternatives + 1 }, (_, index) => `alt ${index}`);
    const result = validateNewQuestion({ question: "Q?", answer: "A", alternatives });
    assert.ok(!result.ok);
  });

  it("accepts exactly the alternatives cap", () => {
    const alternatives = Array.from({ length: BANK_EDIT.maxAlternatives }, (_, index) => `alt ${index}`);
    const result = validateNewQuestion({ question: "Q?", answer: "A", alternatives });
    assert.ok(result.ok);
  });

  it("never carries the legacy category field into the accepted value", () => {
    const result = validateNewQuestion({ category: "history", question: "Q?", answer: "A" });
    assert.ok(result.ok);
    if (result.ok) {
      assert.ok(!("category" in result.value), "category must be ignored");
    }
  });
});

// appendQuestion now does a real SQLite INSERT (ticket 138) rather than
// returning a new in-memory array, so every test here runs against a fresh
// isolated :memory: DB — never the real questions.db.
describe("appendQuestion", () => {
  beforeEach(() => {
    setBankDb(openBankDb(":memory:"));
  });

  afterEach(() => {
    setBankDb(undefined);
  });

  it("assigns id = max(existing id) + 1 and appends the row", () => {
    insertRow(3, "Three?", "3");
    insertRow(17, "Seventeen?", "17");

    const question = appendQuestion({ question: "New?", answer: "New", alternatives: ["alt"] });

    assert.strictEqual(question.id, 18);
    const bank = loadBank();
    assert.strictEqual(bank.length, 3);
    assert.deepStrictEqual(bank[2], {
      id: 18,
      question: "New?",
      answer: "New",
      alternatives: ["alt"]
    });
  });

  it("leaves existing rows untouched", () => {
    insertRow(1, "One?", "1");
    const before = loadBank();

    appendQuestion({ question: "Two?", answer: "2", alternatives: [] });

    const after = loadBank();
    assert.strictEqual(after.length, 2);
    assert.deepStrictEqual(after[0], before[0], "the pre-existing row must be unchanged");
  });

  it("starts ids at 1 for an empty bank", () => {
    const question = appendQuestion({ question: "First?", answer: "1", alternatives: [] });
    assert.strictEqual(question.id, 1);
  });

  it("keeps the appended row free of the legacy category field", () => {
    insertRow(1, "Old?", "Old");
    const question = appendQuestion({ question: "New?", answer: "New", alternatives: [] });
    assert.ok(!("category" in question), "appended rows must never carry category");
    assert.deepStrictEqual(question, { id: 2, question: "New?", answer: "New", alternatives: [] });
  });
});

describe("POST /api/questions", function () {
  let server: Awaited<ReturnType<typeof getTestServer>>;

  before(async () => {
    server = await getTestServer();
  });

  // Isolated in-memory DB per test (ticket 138) — the running test server
  // (booted once for the whole mocha process, see testServer.ts) shares the
  // same bank.ts module, so pointing its DB singleton at a fresh :memory:
  // connection here redirects the live /api/questions handler too, without
  // ever touching the real server/data/questions.db.
  beforeEach(() => {
    setBankDb(openBankDb(":memory:"));
    insertRow(1, "Seed question?", "Seed answer");
  });

  afterEach(() => {
    setBankDb(undefined);
  });

  it("201 — appends a valid question to the bank", async () => {
    const before = loadBank();
    const maxId = Math.max(0, ...before.map((q) => q.id));

    const res = await server.http.post("/api/questions", {
      body: {
        question: "Endpoint test question?",
        answer: "Endpoint answer",
        alternatives: ["alt one", "alt two"]
      }
    });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.id, maxId + 1);
    assert.strictEqual(res.data.question, "Endpoint test question?");
    assert.strictEqual(res.data.answer, "Endpoint answer");
    assert.deepStrictEqual(res.data.alternatives, ["alt one", "alt two"]);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*", "dev CORS must allow the Vite client");

    const after = loadBank();
    assert.strictEqual(after.length, before.length + 1);
    const added = after.find((q) => q.id === maxId + 1);
    assert.ok(added, "the new row must exist in the bank");
    assert.strictEqual(added?.answer, "Endpoint answer");
    assert.deepStrictEqual(added?.alternatives, ["alt one", "alt two"]);
    assert.ok(!("category" in added!), "appended row must not carry category");
  });

  it("400 — rejects malformed payloads and leaves the bank untouched", async () => {
    const before = loadBank();
    const beforeCount = before.length;
    const cases = [
      { body: { answer: "A" } }, // missing question
      { body: { question: "", answer: "A" } }, // blank question
      { body: { question: "Q?", answer: "A", alternatives: "nope" } }, // non-array alternatives
      { body: { question: "Q?", answer: "x".repeat(BANK_EDIT.maxAnswerLength + 1) } }, // over-length answer
      { body: { question: "Q?", answer: "A", alternatives: Array.from({ length: BANK_EDIT.maxAlternatives + 1 }, (_, index) => `alt ${index}`) } },
      {} // no body at all
    ];

    for (const input of cases) {
      await assert.rejects(
        server.http.post("/api/questions", input),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400, `expected 400 for ${JSON.stringify(input).slice(0, 80)}`);
          assert.strictEqual(typeof err.data?.error, "string", "400 response must carry { error: string }");
          return true;
        }
      );
    }

    assert.strictEqual(loadBank().length, beforeCount, "the bank must be untouched");
  });
});
