const FILLER_WORDS = new Set(["the", "of", "and", "a", "an", "to", "in", "for", "on", "with"]);

/** Maximum edit distance as a share of the longer normalised answer. */
const MAX_DISTANCE_RATIO = 0.3;

function normalize(value: string): string {
    const words = value.trim().toLowerCase().split(/\s+/);
    return words.filter((word) => word.length > 0 && !FILLER_WORDS.has(word)).join("");
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

function hasAdjacentTransposition(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length - 1; i++) {
        const swapped = a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2);
        if (swapped === b) return true;
    }
    return false;
}

function countPositionalDiffs(a: string, b: string): number {
    let diffs = 0;
    const shared = Math.min(a.length, b.length);
    for (let i = 0; i < shared; i++) {
        if (a[i] !== b[i]) diffs++;
    }
    return diffs + Math.abs(a.length - b.length);
}

function matchesSingle(playerAnswer: string, canonicalAnswer: string): boolean {
    const p = normalize(playerAnswer);
    const c = normalize(canonicalAnswer);
    if (p === c) return true;

    const longest = Math.max(p.length, c.length);
    if (longest === 0) return false;

    const distance = editDistance(p, c);
    if (distance / longest > MAX_DISTANCE_RATIO) return false;

    // A single edit only passes for an adjacent transposition ("Masr" vs
    // "Mars"); a plain substitution/insertion/deletion stays strict
    // ("Xars" vs "Mars" fails).
    if (distance <= 1) return hasAdjacentTransposition(p, c);
    if (countPositionalDiffs(p, c) <= 1) return false;
    return true;
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
