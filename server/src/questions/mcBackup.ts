import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { decodeHtmlEntities } from "./opentdb.js";
import type { McQuestion, McQuestionSource } from "./opentdb.js";

/** Raw shape of one entry in `server/data/mc-backup.json` — mirrors the
 * OpenTDB `type=multiple` response item so the fallback pool is the same
 * format as the live source (ticket 090). */
interface BackupQuestionRaw {
    category?: unknown;
    question?: unknown;
    correct_answer?: unknown;
    incorrect_answers?: unknown;
}

interface McBackupFile {
    questions: BackupQuestionRaw[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// From both the source tree (server/src/questions/) and the build output
// (server/build/questions/) this resolves to server/data/mc-backup.json.
const MC_BACKUP_PATH = resolve(__dirname, "../../data/mc-backup.json");

function cleanText(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    return decodeHtmlEntities(value.trim()).replace(/\s{2,}/g, " ").trim();
}

/** Stable id for a backup question made from its decoded text — mirrors
 * opentdb.ts's questionId so ids from either source never collide by chance,
 * but with a distinct prefix so the two pools are trivially distinguishable. */
function backupQuestionId(question: string): string {
    let hash = 0;
    for (let i = 0; i < question.length; i += 1) {
        hash = (hash << 5) - hash + question.charCodeAt(i);
        hash |= 0;
    }
    return `mcb-${(hash >>> 0).toString(36)}`;
}

function shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
}

/** Map one raw backup entry into the server-held MC shape, or null when the
 * entry is malformed — a bad row is skipped, never crashes the room. Exported
 * for direct unit coverage of the malformed-entry path (ticket 090). */
export function mapRawBackupQuestion(raw: BackupQuestionRaw): McQuestion | null {
    const question = cleanText(raw.question);
    const category = cleanText(raw.category);
    const correctAnswer = cleanText(raw.correct_answer);
    if (question.length === 0 || correctAnswer.length === 0) {
        return null;
    }
    if (!Array.isArray(raw.incorrect_answers) || raw.incorrect_answers.length < 2) {
        return null;
    }
    const incorrectAnswers = raw.incorrect_answers
        .map((item) => cleanText(item))
        .filter((text) => text.length > 0);
    if (incorrectAnswers.length < 2) {
        return null;
    }
    const options = [correctAnswer, ...incorrectAnswers];
    if (new Set(options).size !== options.length) {
        // A duplicate option makes the correct answer ambiguous — drop the item.
        return null;
    }
    shuffle(options);
    return {
        id: backupQuestionId(question),
        question,
        category,
        options,
        correctIndex: options.indexOf(correctAnswer)
    };
}

/** Parse and validate `server/data/mc-backup.json` at server start. Skips (and
 * reports) malformed entries rather than throwing, so one bad row can't crash
 * the room — same contract as `loadBank`. */
export function loadMcBackup(): McQuestion[] {
    let raw: string;
    try {
        raw = readFileSync(MC_BACKUP_PATH, "utf8");
    } catch (err) {
        throw new Error(`Failed to read the MC backup pool at ${MC_BACKUP_PATH}: ${(err as Error).message}`);
    }

    let parsed: McBackupFile;
    try {
        parsed = JSON.parse(raw) as McBackupFile;
    } catch (err) {
        throw new Error(`MC backup pool at ${MC_BACKUP_PATH} is not valid JSON: ${(err as Error).message}`);
    }

    const questions: McQuestion[] = [];
    let skipped = 0;
    for (const entry of parsed.questions ?? []) {
        const mapped = mapRawBackupQuestion(entry);
        if (mapped) {
            questions.push(mapped);
        } else {
            skipped += 1;
        }
    }
    if (skipped > 0) {
        console.warn(`Skipped ${skipped} malformed entr${skipped === 1 ? "y" : "ies"} in the MC backup pool`);
    }
    return questions;
}

/** An `McQuestionSource` backed by the local backup pool (ticket 090): drawn
 * once at load, non-repeating by id, returns fewer (or none) once exhausted
 * instead of throwing — the chase recovery chain (ticket 074) treats an empty
 * result as "the backup is exhausted", not an error. */
export function createMcBackupQuestionSource(pool: McQuestion[] = loadMcBackup()): McQuestionSource {
    const remaining = [...pool];

    return {
        async getQuestions(amount: number): Promise<McQuestion[]> {
            const requested = Math.max(0, Math.floor(amount));
            if (requested === 0) {
                return [];
            }
            const count = Math.min(requested, remaining.length);
            return remaining.splice(0, count);
        }
    };
}
