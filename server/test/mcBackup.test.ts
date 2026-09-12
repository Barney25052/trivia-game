import assert from "assert";
import { loadMcBackup, createMcBackupQuestionSource, mapRawBackupQuestion } from "../src/questions/mcBackup.js";

describe("mcBackup (ticket 090)", () => {
    it("loads at least 90 valid questions from the on-disk pool (target ~100)", () => {
        const questions = loadMcBackup();
        assert.ok(
            questions.length >= 90,
            `expected at least 90 questions, got ${questions.length}`
        );
    });

    it("every loaded question has 3+ options and a valid correctIndex", () => {
        const questions = loadMcBackup();
        for (const question of questions) {
            assert.ok(question.options.length >= 3, `${question.id} has fewer than 3 options`);
            assert.ok(
                question.correctIndex >= 0 && question.correctIndex < question.options.length,
                `${question.id} has an out-of-range correctIndex`
            );
            assert.ok(question.id.length > 0);
            assert.ok(question.question.length > 0);
        }
    });

    it("ids are unique across the whole pool", () => {
        const questions = loadMcBackup();
        const ids = new Set(questions.map((q) => q.id));
        assert.strictEqual(ids.size, questions.length, "duplicate ids found in the backup pool");
    });

    it("getQuestions(n) returns <= n non-repeating questions and never throws", async () => {
        const source = createMcBackupQuestionSource(loadMcBackup());
        const first = await source.getQuestions(10);
        assert.ok(first.length <= 10);
        const second = await source.getQuestions(10);
        const firstIds = new Set(first.map((q) => q.id));
        for (const question of second) {
            assert.ok(!firstIds.has(question.id), "the source repeated a question across draws");
        }
    });

    it("an exhausted source returns [] instead of throwing", async () => {
        const fixture = [
            { id: "fx-1", question: "Q1?", category: "test", options: ["A", "B"], correctIndex: 0 }
        ];
        const source = createMcBackupQuestionSource(fixture);
        const first = await source.getQuestions(5);
        assert.strictEqual(first.length, 1);
        const second = await source.getQuestions(5);
        assert.deepStrictEqual(second, []);
    });

    it("a corrupt entry is skipped (returns null) without throwing", () => {
        const cases = [
            {},
            { question: "Q?", correct_answer: "A" },
            { question: "Q?", correct_answer: "A", incorrect_answers: ["B"] },
            { question: "", correct_answer: "A", incorrect_answers: ["B", "C"] },
            { question: "Q?", correct_answer: "A", incorrect_answers: ["A", "B"] },
            { question: "Q?", correct_answer: "A", incorrect_answers: "not-an-array" }
        ];
        for (const bad of cases) {
            assert.doesNotThrow(() => mapRawBackupQuestion(bad as any));
            assert.strictEqual(mapRawBackupQuestion(bad as any), null, `expected null for ${JSON.stringify(bad)}`);
        }
    });

    it("loadMcBackup never throws on the production file", () => {
        assert.doesNotThrow(() => loadMcBackup());
    });
});
