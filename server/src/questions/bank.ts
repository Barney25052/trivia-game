import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";

export interface BankQuestion {
    id: number;
    question: string;
    answer: string;
    alternatives?: string[];
}

interface QuestionRow {
    id: number;
    question: string;
    answer: string;
    alternatives: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// From both the source tree (server/src/questions/) and the build output
// (server/build/questions/) this resolves to server/data/questions.db.
// Exported so the seed script (server/scripts/seedQuestionsDb.ts) and the
// add-question endpoint (app.config.ts, via bankAdmin.ts) share the exact
// same file loadBank() reads, in both run modes.
export const DB_PATH = resolve(__dirname, "../../data/questions.db");

const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        alternatives TEXT NOT NULL DEFAULT '[]'
    )
`;

let db: Database.Database | undefined;

/**
 * Opens a connection to a question-bank SQLite file (or `:memory:`) and
 * makes sure the `questions` table exists. Used for the default runtime
 * connection (via getBankDb), the seed script, and per-test isolated DBs —
 * unlike getBankDb() this never checks whether the file pre-exists, so it's
 * also how the seed script/tests create a brand new DB from scratch.
 */
export function openBankDb(path: string): Database.Database {
    const instance = new Database(path);
    instance.pragma("journal_mode = WAL");
    instance.exec(SCHEMA_SQL);
    return instance;
}

/**
 * Returns the shared better-sqlite3 connection to the question bank,
 * opening it lazily on first use. Throws a clear error instead of silently
 * opening an empty database if server/data/questions.db has never been
 * seeded — see "Question bank" in AGENTS.md for the seed command.
 */
export function getBankDb(): Database.Database {
    if (!db) {
        if (!existsSync(DB_PATH)) {
            throw new Error(
                `Question bank database not found at ${DB_PATH}. Seed it once with: ` +
                    `cd server && npx tsx scripts/seedQuestionsDb.ts (see AGENTS.md).`
            );
        }
        db = openBankDb(DB_PATH);
    }
    return db;
}

/**
 * Test-only hook: points loadBank()/appendQuestion() at a different
 * connection (e.g. a fresh `:memory:` DB from openBankDb) instead of the
 * default file at DB_PATH. Pass undefined to reset back to the default.
 */
export function setBankDb(instance: Database.Database | undefined): void {
    db = instance;
}

export function loadBank(): BankQuestion[] {
    let rows: QuestionRow[];
    try {
        rows = getBankDb()
            .prepare("SELECT id, question, answer, alternatives FROM questions ORDER BY id ASC")
            .all() as QuestionRow[];
    } catch (err) {
        throw new Error(`Failed to read question bank at ${DB_PATH}: ${(err as Error).message}`);
    }

    return rows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        alternatives: JSON.parse(row.alternatives) as string[]
    }));
}

export function pickRandom(
    bank: BankQuestion[],
    count: number,
    excludeIds: ReadonlySet<number> = new Set()
): BankQuestion[] {
    const pool = bank.filter((question) => !excludeIds.has(question.id));
    if (count > pool.length) {
        throw new Error(`Cannot pick ${count} questions from a pool of ${pool.length}`);
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }

    return shuffled.slice(0, count);
}
