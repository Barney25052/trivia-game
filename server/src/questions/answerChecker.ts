const FILLER_WORDS = new Set(["the", "of", "and", "a", "an", "to", "in", "for", "on", "with"]);

const normalize = (ans: string): string => {
    const lowered = ans.trim().toLowerCase();
    const words = lowered.split(/\s+/).filter((word) => !FILLER_WORDS.has(word));
    return words.join("");
};

const _charDiffCount = (a: string, b: string): number => {
    let diffs = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) diffs++;
    }
    diffs += Math.abs(a.length - b.length);
    return diffs;
};

const _hasTransposition = (a: string, b: string): boolean => {
    const n = a.length;
    const m = b.length;
    if (Math.abs(n - m) > 1) return false;
    let diffIdx = -1;
    let secondDiff = -1;
    for (let i = 0; i < Math.max(n, m); i++) {
        if (a[i] !== b[i]) {
            if (diffIdx === -1) diffIdx = i;
            else secondDiff = i;
        }
    }
    if (diffIdx === -1 || secondDiff === -1) return false;
    if (secondDiff - diffIdx !== 1) return false;
    if (a[diffIdx] !== b[secondDiff]) return false;
    if (a[secondDiff] !== b[diffIdx]) return false;
    return true;
};

const damerauLevenshtein = (a: string, b: string): number => {
    const n = a.length;
    const m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;

    const last: Record<string, number> = {};
    const d: number[][] = [];

    for (let i = 0; i <= n; i++) {
        d[i] = [i];
    }
    for (let j = 0; j <= m; j++) {
        d[0][j] = j;
    }

    let _i = 0;
    for (let i = 1; i <= n; i++) {
        const aI = a[i - 1];
        d[i][0] = i;
        let _j = 0;
        for (let j = 1; j <= m; j++) {
            const bJ = b[j - 1];
            const cost = aI === bJ ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost
            );

            const km = last[aI];
            if (km !== undefined && km <= i - 1) {
                const tmp = d[km - 1][j - 1] + (i - 1 - km) + (j - 1 - _j);
                if (tmp < d[i][j]) {
                    d[i][j] = tmp;
                }
            }
            last[bJ] = j;
            _j = j;
        }
        _i = i;
    }

    return d[n][m];
};

export function checkAnswer(playerAnswer: string, canonicalAnswer: string): boolean {
    const p = normalize(playerAnswer);
    const c = normalize(canonicalAnswer);
    if (p === c) return true;

    const distance = damerauLevenshtein(p, c);
    const maxLen = Math.max(p.length, c.length);

    if (maxLen === 0) return false;
    if (distance / maxLen > 0.3) return false;

    if (distance <= 1 && _hasTransposition(p, c)) return true;

    if (_charDiffCount(p, c) <= 1) return false;

    return distance / maxLen <= 0.3;
}