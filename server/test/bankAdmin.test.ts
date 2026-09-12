import assert from "assert";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BANK_EDIT } from "../src/gameConfig.js";
import { loadBank, QUESTIONS_PATH } from "../src/questions/bank.js";
import { appendQuestion, validateNewQuestion } from "../src/questions/bankAdmin.js";
import { getTestServer } from "./testServer.js";

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

describe("appendQuestion", () => {
  it("assigns id = max(existing id) + 1 and appends the row", () => {
    const bank = [
      { id: 3, question: "Three?", answer: "3" },
      { id: 17, question: "Seventeen?", answer: "17", alternatives: [] }
    ];
    const out = appendQuestion(bank, { question: "New?", answer: "New", alternatives: ["alt"] });
    assert.strictEqual(out.question.id, 18);
    assert.strictEqual(out.bank.length, 3);
    assert.deepStrictEqual(out.bank[2], {
      id: 18,
      question: "New?",
      answer: "New",
      alternatives: ["alt"]
    });
  });

  it("returns a new bank without mutating the input", () => {
    const bank = [{ id: 1, question: "One?", answer: "1" }];
    const snapshot = JSON.stringify(bank);
    const out = appendQuestion(bank, { question: "Two?", answer: "2", alternatives: [] });
    assert.notStrictEqual(out.bank, bank, "appendQuestion must return a new array");
    assert.strictEqual(out.bank.length, 2);
    assert.strictEqual(JSON.stringify(bank), snapshot, "input must not be mutated");
  });

  it("starts ids at 1 for an empty bank", () => {
    const out = appendQuestion([], { question: "First?", answer: "1", alternatives: [] });
    assert.strictEqual(out.question.id, 1);
  });

  it("keeps the appended row free of the legacy category field", () => {
    const bank = [{ id: 1, category: "history", question: "Old?", answer: "Old" }];
    const out = appendQuestion(bank, { question: "New?", answer: "New", alternatives: [] });
    assert.ok(!("category" in out.question), "appended rows must never carry category");
    assert.deepStrictEqual(out.question, { id: 2, question: "New?", answer: "New", alternatives: [] });
  });
});

describe("POST /api/questions", function () {
  let server: Awaited<ReturnType<typeof getTestServer>>;
  let originalBankContent: string;

  before(async () => {
    server = await getTestServer();
  });

  beforeEach(() => {
    originalBankContent = readFileSync(QUESTIONS_PATH, "utf8");
  });

  afterEach(() => {
    writeFileSync(QUESTIONS_PATH, originalBankContent, "utf8");
  });

  // Belt-and-braces: even if a test (or hook) throws, never leave a mutated
  // bank behind once the process exits.
  after(() => {
    if (originalBankContent !== undefined) {
      writeFileSync(QUESTIONS_PATH, originalBankContent, "utf8");
    }
  });

  it("201 — appends a valid question to the bank file", async () => {
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

    const raw = readFileSync(QUESTIONS_PATH, "utf8");
    assert.ok(raw.includes('"question": "Endpoint test question?"'), "the question must be written to the file");
    assert.ok(raw.includes("\r\n"), "the CRLF line endings must be preserved");
    assert.ok(!existsSync(`${QUESTIONS_PATH}.tmp`), "the temp file must be renamed away");
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
    assert.strictEqual(readFileSync(QUESTIONS_PATH, "utf8"), originalBankContent, "the bank file must be byte-identical");
    assert.ok(!existsSync(`${QUESTIONS_PATH}.tmp`), "no temp file may be left behind");
  });
});