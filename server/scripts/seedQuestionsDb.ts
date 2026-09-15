/**
 * One-time / as-needed migration (ticket 138): reads server/data/questions.json
 * and (re)populates server/data/questions.db, the SQLite file loadBank()
 * (server/src/questions/bank.ts) reads at runtime.
 *
 * Not wired into `npm start` or `npm test` — run manually after a fresh
 * checkout (questions.db is gitignored — see AGENTS.md), or whenever
 * questions.json is hand-edited and needs to be re-imported. Re-running is
 * safe: it replaces the entire contents of questions.db with what's
 * currently in questions.json.
 *
 * Usage (from server/): npx tsx scripts/seedQuestionsDb.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BankQuestion, DB_PATH, openBankDb } from "../src/questions/bank.js";

interface QuestionBankFile {
    questions: BankQuestion[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(__dirname, "../data/questions.json");

function main(): void {
    const raw = readFileSync(JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as QuestionBankFile;
    const questions = parsed.questions;

    const db = openBankDb(DB_PATH);
    const insert = db.prepare(
        "INSERT INTO questions (id, question, answer, alternatives) VALUES (?, ?, ?, ?)"
    );
    const reseed = db.transaction((rows: BankQuestion[]) => {
        db.prepare("DELETE FROM questions").run();
        for (const row of rows) {
            insert.run(row.id, row.question, row.answer, JSON.stringify(row.alternatives ?? []));
        }
    });
    reseed(questions);
    db.close();

    console.log(`Seeded ${questions.length} questions from ${JSON_PATH} into ${DB_PATH}`);
}

main();
