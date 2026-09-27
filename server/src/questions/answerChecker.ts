import { ANSWER_CHECK } from "../gameConfig.js";
import {
    canonicalDigits,
    isScaleWord,
    numberWordSpelling,
    readNumberWords,
    romanValue,
    scaleDigits,
    splitJoinedNumberWords
} from "./answerNumbers.js";

const FILLER_WORDS = new Set(["the", "of", "and", "a", "an", "to", "in", "for", "on", "with"]);

/**
 * One word or number of a normalised answer. `value` is set for numbers
 * (digits, number words, Roman numerals), which only ever match the same
 * value or, glued to a neighbouring word, their exact `text`. A typed
 * `roman` token may also just be a short word ("Mc" for "Mac"). Filler
 * words may be left out on either side.
 */
interface Token {
    text: string;
    value: string | null;
    roman: boolean;
    filler: boolean;
}

/** Digits (with an ordinal suffix or decimals) or a run of letters. */
const RAW_TOKEN = /\d+(?:st|nd|rd|th)(?!\p{L})|\d+(?:\.\d+)?|\p{L}+/gu;

/**
 * Split an answer into raw words: strip accents and apostrophes, lowercase
 * per `ANSWER_CHECK`, drop dots between letters ("U.N." → "un") and
 * thousands separators, then read letters and digits apart ("CO2" → "co",
 * "2"). Everything else is a separator, so spacing never matters.
 */
function rawWords(value: string): string[] {
    let normalized = value.normalize("NFKD").replace(/\p{M}/gu, "");
    if (ANSWER_CHECK.caseInsensitive) {
        normalized = normalized.toLowerCase();
    }
    normalized = normalized
        .replace(/['’‘`´ʼ]/g, "")
        .replace(/(?<=\d),(?=\d)/g, "")
        .replace(/(?<!\d)\.|\.(?!\d)/g, "");
    return normalized.match(RAW_TOKEN) ?? [];
}

/** Read numbers out of the raw words; everything else stays a word. */
function tokenize(value: string): Token[] {
    const words = rawWords(value);
    const isFiller = (word: string): boolean => FILLER_WORDS.has(word.toLowerCase());
    // An answer made only of filler ("The") needs its filler.
    const fillerCounts = words.some((word) => !isFiller(word));

    const tokens: Token[] = [];
    let numberWords: string[] = [];
    const flushNumberWords = (): void => {
        for (const number of readNumberWords(numberWords)) {
            tokens.push({ text: number.text, value: number.value, roman: false, filler: false });
        }
        numberWords = [];
    };

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const lower = word.toLowerCase();
        const next = i + 1 < words.length ? spellNumber(words[i + 1].toLowerCase()) : null;
        if (/^\d/.test(word)) {
            flushNumberWords();
            const ordinal = /^(\d+)(?:st|nd|rd|th)$/i.exec(word);
            if (ordinal !== null) {
                tokens.push({ text: word, value: canonicalDigits(ordinal[1]), roman: false, filler: false });
            } else if (next !== null && isScaleWord(next)) {
                // "7 million" is 7000000.
                const scale = readNumberWords([next])[0];
                tokens.push({ text: word + next, value: scaleDigits(word, Number(scale.value)), roman: false, filler: false });
                i++;
            } else {
                tokens.push({ text: word, value: canonicalDigits(word), roman: false, filler: false });
            }
            continue;
        }
        const spelling = spellNumber(lower);
        if (spelling !== null) {
            numberWords.push(spelling);
            continue;
        }
        // "one hundred and six" is one number.
        if (lower === "and" && numberWords.length > 0 && next !== null) {
            continue;
        }
        const joined = splitJoinedNumberWords(lower);
        if (joined !== null && joined.length > 1) {
            numberWords.push(...joined);
            continue;
        }
        flushNumberWords();
        const roman = ANSWER_CHECK.romanNumerals ? romanValue(lower) : null;
        tokens.push({
            text: word,
            value: roman === null ? null : String(roman),
            roman: roman !== null,
            filler: fillerCounts && isFiller(word)
        });
    }
    flushNumberWords();
    return tokens;
}

function spellNumber(word: string): string | null {
    return numberWordSpelling(word, ANSWER_CHECK.ignoreDoubledLetters);
}

function collapseDoubledLetters(word: string): string {
    return ANSWER_CHECK.ignoreDoubledLetters ? word.replace(/(\p{L})\1+/gu, "$1") : word;
}

/**
 * Optimal string alignment distance (Levenshtein with a single adjacent
 * transposition costing 1). With `ignoreDoubledLetters`, adding or dropping
 * a repeat of the previous letter is free ("Scarlet" → "Scarlett").
 */
function editDistance(a: string, b: string): number {
    const free = ANSWER_CHECK.ignoreDoubledLetters;
    const d: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
        d[i] = [];
        for (let j = 0; j <= b.length; j++) {
            if (i === 0 && j === 0) {
                d[i][j] = 0;
                continue;
            }
            let best = Infinity;
            if (i > 0) best = Math.min(best, d[i - 1][j] + (free && i > 1 && a[i - 1] === a[i - 2] ? 0 : 1));
            if (j > 0) best = Math.min(best, d[i][j - 1] + (free && j > 1 && b[j - 1] === b[j - 2] ? 0 : 1));
            if (i > 0 && j > 0) best = Math.min(best, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                best = Math.min(best, d[i - 2][j - 2] + 1);
            }
            d[i][j] = best;
        }
    }
    return d[a.length][b.length];
}

/** `typed` is `accepted` with one letter dropped or two neighbours swapped. */
function isDropOrSwap(typed: string, accepted: string): boolean {
    for (let i = 0; i < accepted.length; i++) {
        if (typed.length === accepted.length - 1 && accepted.slice(0, i) + accepted.slice(i + 1) === typed) return true;
        if (typed.length === accepted.length && i + 1 < accepted.length
            && accepted.slice(0, i) + accepted[i + 1] + accepted[i] + accepted.slice(i + 2) === typed) return true;
    }
    return false;
}

/**
 * Leniency policy (ticket 047, tightened by ticket 161): each word of the
 * accepted answer has its own typo budget — a share of the shorter word's
 * length, at least one edit. Doubled letters are free ("Scarlet Johanson").
 * A word under `minTypoWordLength` letters may only lose a letter or swap
 * two ("Teh", "Bo Marley"), never change one ("Serie B" is not "Serie A").
 * So swapping a whole word ("Manchester City" for "Manchester United") or
 * changing a word's length past its budget ("Baseball" for "Basketball")
 * fails.
 */
function wordsMatch(typed: string, accepted: string): boolean {
    const t = collapseDoubledLetters(typed);
    const a = collapseDoubledLetters(accepted);
    if (t === a) return true;
    if (accepted.length < ANSWER_CHECK.minTypoWordLength) return isDropOrSwap(typed, accepted) || isDropOrSwap(t, a);
    const budget = Math.max(1, Math.floor(Math.min(t.length, a.length) * ANSWER_CHECK.typoEditsPerLetter));
    return editDistance(typed, accepted) <= budget;
}

/** Typed text that may be read as letters: words, and Roman-looking words. */
function isLetters(token: Token): boolean {
    return token.value === null || token.roman;
}

/**
 * Numbers must be equal, and an accepted number is never a typo. A typed
 * Roman-looking word can still be a typo of an accepted word ("Mc" for
 * "Mac"); a typed number can't.
 */
function tokensMatch(typed: Token, accepted: Token): boolean {
    if (typed.value !== null && accepted.value !== null) return typed.value === accepted.value;
    if (accepted.value !== null || !isLetters(typed)) return typed.text === accepted.text;
    return wordsMatch(typed.text, accepted.text);
}

/** The group as written, and without its filler words if it has any. */
function withAndWithoutFiller(tokens: Token[]): Token[][] {
    const withoutFiller = tokens.filter((token) => !token.filler);
    return withoutFiller.length === tokens.length || withoutFiller.length === 0 ? [tokens] : [tokens, withoutFiller];
}

function joinText(tokens: Token[]): string {
    return tokens.map((token) => token.text).join("");
}

/** The most a word's piece can differ in length from it and still match. */
function lengthSlack(token: Token): number {
    const length = collapseDoubledLetters(token.text).length;
    return Math.max(1, Math.floor(length * ANSWER_CHECK.typoEditsPerLetter));
}

/**
 * A Roman numeral cut out of running letters must not have another numeral
 * letter glued on: "ElizabethII" is not "Elizabeth I" plus a typo.
 */
function isWholeNumeral(whole: string, start: number, end: number): boolean {
    const piece = whole.slice(start, end);
    if (start > 0 && romanValue(whole[start - 1] + piece) !== null) return false;
    return end >= whole.length || romanValue(piece + whole[end]) === null;
}

/**
 * Whether `whole` can be cut into consecutive, non-empty pieces that each
 * match their word of `parts` within that word's own budget. Accepted
 * numbers must be spelled exactly. Since no piece is empty, a whole word
 * can't hide inside a typo.
 */
function cutMatches(whole: string, parts: Token[], partsAreTyped: boolean): boolean {
    let starts = new Set([0]);
    for (const part of parts) {
        const ends = new Set<number>();
        const exact = !(partsAreTyped ? isLetters(part) : part.value === null);
        const target = exact ? part.text.length : collapseDoubledLetters(part.text).length;
        const slack = exact ? 0 : lengthSlack(part);
        for (const start of starts) {
            for (let end = start + 1; end <= whole.length; end++) {
                const piece = whole.slice(start, end);
                const pieceLength = exact ? piece.length : collapseDoubledLetters(piece).length;
                if (pieceLength > target + slack) break;
                if (pieceLength < target - slack) continue;
                const matches = exact
                    ? piece === part.text && (!part.roman || isWholeNumeral(whole, start, end))
                    : partsAreTyped ? wordsMatch(part.text, piece) : wordsMatch(piece, part.text);
                if (matches) ends.add(end);
            }
        }
        starts = ends;
        if (starts.size === 0) return false;
    }
    return starts.has(whole.length);
}

/**
 * Several typed words against one accepted word: "Spider Man" for
 * "Spiderman". The typing gets that one word's budget, not one per piece.
 */
function joinedMatch(typed: Token[], accepted: Token): boolean {
    return withAndWithoutFiller(typed).some((group) => {
        const joined = joinText(group);
        if (accepted.value !== null || !group.every(isLetters)) return joined === accepted.text;
        return wordsMatch(joined, accepted.text) && cutMatches(accepted.text, group, true);
    });
}

/**
 * Typed words spaced differently from as many or more accepted words:
 * "Spiderman" for "Spider-Man", "ACDC" for "AC/DC", "Re dSea" for "Red Sea".
 * The typed letters are cut up to match each accepted word within its own
 * budget. The typing never has more words than the accepted group, so an
 * extra typed word can't be passed off as a typo.
 */
function splitMatch(typed: Token[], accepted: Token[]): boolean {
    if (!typed.every(isLetters)) return false;
    return withAndWithoutFiller(typed).some((typedGroup) => withAndWithoutFiller(accepted).some((parts) => {
        if (typedGroup.length > parts.length) return false;
        const whole = joinText(typedGroup);
        const wholeLength = collapseDoubledLetters(whole).length;
        const partsLength = parts.reduce((sum, part) => sum + collapseDoubledLetters(part.text).length, 0);
        const slack = parts.reduce((sum, part) => sum + lengthSlack(part), 0);
        if (Math.abs(wholeLength - partsLength) > slack) return false;
        return cutMatches(whole, parts, false);
    }));
}

/**
 * Align the typed words with the accepted ones in order, skipping filler on
 * either side: word for word, or regrouped where the spacing differs (see
 * `joinedMatch` and `splitMatch`). Every other accepted word and number must
 * be covered.
 */
function matchesSingle(playerAnswer: string, acceptedAnswer: string): boolean {
    const typed = tokenize(playerAnswer);
    const accepted = tokenize(acceptedAnswer);
    if (typed.length === 0 || accepted.length === 0) return false;

    const reachable = Array.from({ length: typed.length + 1 }, (): boolean[] => []);
    reachable[0][0] = true;
    for (let i = 0; i <= typed.length; i++) {
        const typedGroupEnd = Math.min(typed.length, i + ANSWER_CHECK.maxRegroupWords);
        for (let j = 0; j <= accepted.length; j++) {
            if (!reachable[i][j]) continue;
            if (i < typed.length && typed[i].filler) reachable[i + 1][j] = true;
            if (j < accepted.length && accepted[j].filler) reachable[i][j + 1] = true;
            if (i === typed.length || j === accepted.length) continue;
            if (tokensMatch(typed[i], accepted[j])) reachable[i + 1][j + 1] = true;
            for (let end = i + 2; end <= typedGroupEnd; end++) {
                if (joinedMatch(typed.slice(i, end), accepted[j])) reachable[end][j + 1] = true;
            }
            const acceptedGroupEnd = Math.min(accepted.length, j + ANSWER_CHECK.maxRegroupWords);
            for (let typedEnd = i + 1; typedEnd <= typedGroupEnd; typedEnd++) {
                for (let acceptedEnd = j + Math.max(2, typedEnd - i); acceptedEnd <= acceptedGroupEnd; acceptedEnd++) {
                    if (splitMatch(typed.slice(i, typedEnd), accepted.slice(j, acceptedEnd))) {
                        reachable[typedEnd][acceptedEnd] = true;
                    }
                }
            }
        }
    }
    return reachable[typed.length][accepted.length] === true;
}

/**
 * Check a typed answer against the canonical answer or any of its
 * alternatives. Accepts either a single string (back-compat with the
 * original contract) or an array of accepted answers, in which case a
 * match against ANY of them passes.
 */
export function checkAnswer(playerAnswer: string, acceptedAnswers: string | string[]): boolean {
    // Longer than any real answer, and it would make the alignment costly.
    if (playerAnswer.length > ANSWER_CHECK.maxTypedLength) return false;
    const answers = Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers];
    return answers.some((accepted) => matchesSingle(playerAnswer, accepted));
}
