/**
 * Number reading for the answer checker (ticket 161): turns number words,
 * digits and Roman numerals into canonical values so "5", "five" and "V" are
 * the same answer and a wrong number never passes as a typo.
 */

type NumberWordKind = "unit" | "teen" | "tens" | "hundred" | "scale";

interface NumberWord {
    value: number;
    kind: NumberWordKind;
    /** "first", "19th": an ordinal always ends the number it belongs to. */
    ordinal: boolean;
}

/** A number read from the answer, with the text it was read from. */
export interface ReadNumber {
    value: string;
    text: string;
}

const NUMBER_WORDS = new Map<string, NumberWord>();

function addWords(kind: NumberWordKind, ordinal: boolean, entries: [string, number][]): void {
    for (const [word, value] of entries) {
        NUMBER_WORDS.set(word, { value, kind, ordinal });
    }
}

addWords("unit", false, [
    ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4],
    ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9]
]);
addWords("teen", false, [
    ["ten", 10], ["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14],
    ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18], ["nineteen", 19]
]);
addWords("tens", false, [
    ["twenty", 20], ["thirty", 30], ["forty", 40], ["fifty", 50],
    ["sixty", 60], ["seventy", 70], ["eighty", 80], ["ninety", 90],
    // Common misspellings, so they aren't marked wrong for being number typos.
    ["fourty", 40], ["ninty", 90]
]);
addWords("hundred", false, [["hundred", 100]]);
addWords("scale", false, [["thousand", 1e3], ["million", 1e6], ["billion", 1e9], ["trillion", 1e12]]);
addWords("unit", true, [
    ["first", 1], ["second", 2], ["third", 3], ["fourth", 4], ["fifth", 5],
    ["sixth", 6], ["seventh", 7], ["eighth", 8], ["ninth", 9], ["nineth", 9]
]);
addWords("teen", true, [
    ["tenth", 10], ["eleventh", 11], ["twelfth", 12], ["twelth", 12], ["thirteenth", 13],
    ["fourteenth", 14], ["fifteenth", 15], ["sixteenth", 16], ["seventeenth", 17],
    ["eighteenth", 18], ["nineteenth", 19]
]);
addWords("tens", true, [
    ["twentieth", 20], ["thirtieth", 30], ["fortieth", 40], ["fiftieth", 50],
    ["sixtieth", 60], ["seventieth", 70], ["eightieth", 80], ["ninetieth", 90]
]);
addWords("hundred", true, [["hundredth", 100]]);
addWords("scale", true, [["thousandth", 1e3], ["millionth", 1e6], ["billionth", 1e9]]);

/** Number words keyed with doubled letters collapsed ("thre" → "three"). */
const NUMBER_WORDS_BY_COLLAPSED = new Map<string, string>();
for (const word of NUMBER_WORDS.keys()) {
    NUMBER_WORDS_BY_COLLAPSED.set(collapseRepeats(word), word);
}

/** Longest first, so "seventeen" is tried before "seven" when splitting. */
const NUMBER_WORDS_LONGEST_FIRST = [...NUMBER_WORDS.keys()].sort((a, b) => b.length - a.length);

const ROMAN_NUMERAL = /^(?=[mdclxvi])m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const ROMAN_DIGITS: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/** The value of a well-formed lowercase Roman numeral ("xiv" → 14), else null. */
export function romanValue(word: string): number | null {
    if (!ROMAN_NUMERAL.test(word)) return null;
    let total = 0;
    for (let i = 0; i < word.length; i++) {
        const digit = ROMAN_DIGITS[word[i]];
        const next = i + 1 < word.length ? ROMAN_DIGITS[word[i + 1]] : 0;
        total += digit < next ? -digit : digit;
    }
    return total;
}

function collapseRepeats(word: string): string {
    return word.replace(/(.)\1+/g, "$1");
}

/**
 * The number word this lowercase word spells, or null. With
 * `ignoreDoubledLetters`, a doubled or missing double letter still counts
 * ("seeven", "thre"); any other misspelling is not a number.
 */
export function numberWordSpelling(word: string, ignoreDoubledLetters: boolean): string | null {
    if (NUMBER_WORDS.has(word)) return word;
    return ignoreDoubledLetters ? NUMBER_WORDS_BY_COLLAPSED.get(collapseRepeats(word)) ?? null : null;
}

/** Whether the word is "hundred", "thousand", "million"... (which scale digits: "7 million"). */
export function isScaleWord(word: string): boolean {
    const numberWord = NUMBER_WORDS.get(word);
    return numberWord !== undefined && !numberWord.ordinal
        && (numberWord.kind === "hundred" || numberWord.kind === "scale");
}

/**
 * Split a word written without spaces into number words ("twentytwo" →
 * ["twenty", "two"]), or null if it isn't made entirely of them. "and" may
 * join them ("onehundredandsix") and is dropped.
 */
export function splitJoinedNumberWords(word: string): string[] | null {
    if (word.length === 0) return [];
    if (word.startsWith("and")) {
        const rest = splitJoinedNumberWords(word.slice(3));
        if (rest !== null && rest.length > 0) return rest;
    }
    for (const numberWord of NUMBER_WORDS_LONGEST_FIRST) {
        if (!word.startsWith(numberWord)) continue;
        const rest = splitJoinedNumberWords(word.slice(numberWord.length));
        if (rest !== null) return [numberWord, ...rest];
    }
    return null;
}

/**
 * Canonical form of a written number: thousands separators should already
 * be gone, trailing decimal zeros are dropped ("3.10" → "3.1"). Leading zeros
 * are kept, because "007" is not the same answer as "7".
 */
export function canonicalDigits(digits: string): string {
    if (!digits.includes(".")) return digits;
    const trimmed = digits.replace(/0+$/, "").replace(/\.$/, "");
    return trimmed.length > 0 ? trimmed : "0";
}

/** Digits times a power of ten, exactly ("1.5" × 10^6 → "1500000"). */
export function scaleDigits(digits: string, scale: number): string {
    const zeros = Math.round(Math.log10(scale));
    const [whole, fraction = ""] = digits.split(".");
    const shifted = whole + fraction.padEnd(zeros, "0");
    const point = whole.length + zeros;
    const value = `${shifted.slice(0, point)}.${shifted.slice(point)}`.replace(/^0+(?=\d)/, "");
    return canonicalDigits(value);
}

/**
 * Read a run of consecutive number words into numbers: "one hundred six" →
 * 106, "twenty one" → 21. Words that can't continue the current number start
 * a new one ("fifty fifty" → 50, 50), and an ordinal ends one.
 */
export function readNumberWords(words: string[]): ReadNumber[] {
    const numbers: ReadNumber[] = [];
    let total = 0;
    let group = 0;
    let lastScale = Infinity;
    let text = "";
    let open = false;

    const flush = (): void => {
        if (open) numbers.push({ value: String(total + group), text });
        total = 0;
        group = 0;
        lastScale = Infinity;
        text = "";
        open = false;
    };

    const continues = (word: NumberWord): boolean => {
        const lastTwoDigits = group % 100;
        switch (word.kind) {
            case "unit":
                return word.value > 0 && (lastTwoDigits === 0 || (lastTwoDigits >= 20 && lastTwoDigits % 10 === 0));
            case "teen":
            case "tens":
                return lastTwoDigits === 0;
            case "hundred":
                return group >= 1 && group <= 99;
            case "scale":
                return group > 0 && word.value < lastScale;
        }
    };

    for (const spelled of words) {
        const word = NUMBER_WORDS.get(spelled);
        if (word === undefined) {
            flush();
            continue;
        }
        if (open && !continues(word)) flush();
        switch (word.kind) {
            case "unit":
            case "teen":
            case "tens":
                group += word.value;
                break;
            case "hundred":
                group = (group || 1) * 100;
                break;
            case "scale":
                total += (group || 1) * word.value;
                group = 0;
                lastScale = word.value;
                break;
        }
        text += spelled;
        open = true;
        if (word.ordinal || word.value === 0) flush();
    }
    flush();
    return numbers;
}
