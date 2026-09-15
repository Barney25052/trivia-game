import { BANK_EDIT } from "../gameConfig.js";
import { BankQuestion, getBankDb } from "./bank.js";

/** Accepted input for a new open-ended question (ticket 091). */
export interface NewQuestionInput {
    question: string;
    answer: string;
    alternatives: string[];
}

/** Typed validation result — malformed input returns an error string instead
 * of throwing, so the HTTP endpoint can answer 400 directly. */
export type NewQuestionValidation =
    | { ok: true; value: NewQuestionInput }
    | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trims a field and returns null when it is missing, not a string, empty
 * after trimming, or longer than the cap. */
function cleanString(value: unknown, cap: number): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > cap) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a client-sent new-question payload. `category` is deliberately
 * ignored (legacy/unused per GOAL.md) and never passes through to the value.
 */
export function validateNewQuestion(input: unknown): NewQuestionValidation {
    if (!isRecord(input)) {
        return { ok: false, error: "body must be a JSON object" };
    }

    const question = cleanString(input.question, BANK_EDIT.maxQuestionLength);
    if (question === null) {
        return {
            ok: false,
            error: `question must be a non-empty string of at most ${BANK_EDIT.maxQuestionLength} characters`
        };
    }

    const answer = cleanString(input.answer, BANK_EDIT.maxAnswerLength);
    if (answer === null) {
        return {
            ok: false,
            error: `answer must be a non-empty string of at most ${BANK_EDIT.maxAnswerLength} characters`
        };
    }

    if (input.alternatives !== undefined && !Array.isArray(input.alternatives)) {
        return { ok: false, error: "alternatives must be an array of strings" };
    }
    const alternatives: string[] = [];
    for (const alternative of (input.alternatives as unknown[] | undefined) ?? []) {
        const cleaned = cleanString(alternative, BANK_EDIT.maxAlternativeLength);
        if (cleaned === null) {
            return {
                ok: false,
                error: `each alternative must be a non-empty string of at most ${BANK_EDIT.maxAlternativeLength} characters`
            };
        }
        alternatives.push(cleaned);
    }
    if (alternatives.length > BANK_EDIT.maxAlternatives) {
        return {
            ok: false,
            error: `alternatives may have at most ${BANK_EDIT.maxAlternatives} entries`
        };
    }

    return { ok: true, value: { question, answer, alternatives } };
}

/**
 * Inserts a new question into the SQLite question bank at
 * id = max(existing id) + 1 and returns the inserted row. The read-then-
 * insert is wrapped in a transaction so concurrent appends can't race each
 * other onto the same id (this replaces the old JSON version's atomic
 * write-temp-file-then-rename dance; the CRLF-preservation logic that dance
 * needed is JSON-specific and has been removed entirely — nothing downstream
 * still expects it). The appended row never carries a `category` field — it
 * is legacy and unused per GOAL.md.
 */
export function appendQuestion(input: NewQuestionInput): BankQuestion {
    const db = getBankDb();
    const insert = db.transaction((value: NewQuestionInput): BankQuestion => {
        const row = db.prepare("SELECT MAX(id) AS maxId FROM questions").get() as { maxId: number | null };
        const id = (row.maxId ?? 0) + 1;
        db.prepare("INSERT INTO questions (id, question, answer, alternatives) VALUES (?, ?, ?, ?)").run(
            id,
            value.question,
            value.answer,
            JSON.stringify(value.alternatives)
        );
        return { id, question: value.question, answer: value.answer, alternatives: value.alternatives };
    });
    return insert(input);
}