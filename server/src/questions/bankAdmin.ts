import { BANK_EDIT } from "../gameConfig.js";
import { BankQuestion } from "./bank.js";

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
 * Pure append: returns a new bank (the input is untouched) with the new
 * question at id = max(existing id) + 1. The appended row never carries a
 * `category` field — it is legacy and unused per GOAL.md.
 */
export function appendQuestion(
    bank: BankQuestion[],
    input: NewQuestionInput
): { bank: BankQuestion[]; question: BankQuestion } {
    const id = bank.reduce((max, q) => Math.max(max, q.id), 0) + 1;
    const question: BankQuestion = {
        id,
        question: input.question,
        answer: input.answer,
        alternatives: input.alternatives
    };
    return { bank: [...bank, question], question };
}