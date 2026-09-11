import { ANSWER_CHECK } from "../gameConfig.js";

const FILLER_WORDS = new Set(["the", "of", "and", "a", "an", "to", "in", "for", "on", "with"]);

/**
 * Normalise player and canonical answers: trim, collapse whitespace and
 * lowercase per `ANSWER_CHECK`, then drop filler words and join the remaining
 * words without spaces (so spacing and articles never decide a match).
 */
function normalize(value: string): string {
    let normalized = value.trim();
    if (ANSWER_CHECK.normaliseWhitespace) {
        normalized = normalized.replace(/\s+/g, " ");
    }
    if (ANSWER_CHECK.caseInsensitive) {
        normalized = normalized.toLowerCase();
    }
    return normalized
        .split(/\s+/)
        .filter((word) => word.length > 0 && !FILLER_WORDS.has(word))
        .join("");
}

/**
 * Optimal string alignment distance (Levenshtein with a single adjacent
 * transposition costing 1). Answers are short, so a full matrix is fine.
 */
function editDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const d: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
            }
        }
    }

    return d[a.length][b.length];
}

/**
 * Leniency policy (ticket 047, GOAL open question #2): after normalising,
 * an answer passes when it is a single edit from the canonical answer
 * (substitution, insertion, deletion or transposition — "Xars" → "Mars")
 * or when its edit distance is within `ANSWER_CHECK.editDistanceRatio` of
 * the longer answer. Clearly different answers ("Earth" → "Mars") fail.
 */
function matchesSingle(playerAnswer: string, canonicalAnswer: string): boolean {
    const p = normalize(playerAnswer);
    const c = normalize(canonicalAnswer);
    if (p === c) return true;

    const longest = Math.max(p.length, c.length);
    if (longest === 0) return false;

    const distance = editDistance(p, c);
    if (ANSWER_CHECK.allowSingleEdit && distance <= 1) return true;
    return distance / longest <= ANSWER_CHECK.editDistanceRatio;
}

/**
 * Check a typed answer against the canonical answer or any of its
 * alternatives. Accepts either a single string (back-compat with the
 * original contract) or an array of accepted answers, in which case a
 * match against ANY of them passes.
 */
export function checkAnswer(playerAnswer: string, acceptedAnswers: string | string[]): boolean {
    const answers = Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers];
    return answers.some((accepted) => matchesSingle(playerAnswer, accepted));
}