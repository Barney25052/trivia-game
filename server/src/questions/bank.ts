import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";

export interface BankQuestion {
    id: number;
    question: string;
    answer: string;
    alternatives?: string[];
}

interface QuestionBankFile {
    questions: BankQuestion[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// From both the source tree (server/src/questions/) and the build output
// (server/build/questions/) this resolves to server/data/questions.json.
const QUESTIONS_PATH = resolve(__dirname, "../../data/questions.json");

export function loadBank(): BankQuestion[] {
    let raw: string;
    try {
        raw = readFileSync(QUESTIONS_PATH, "utf8");
    } catch (err) {
        throw new Error(`Failed to read question bank at ${QUESTIONS_PATH}: ${(err as Error).message}`);
    }

    try {
        const parsed = JSON.parse(raw) as QuestionBankFile;
        return parsed.questions;
    } catch (err) {
        throw new Error(`Question bank at ${QUESTIONS_PATH} is not valid JSON: ${(err as Error).message}`);
    }
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