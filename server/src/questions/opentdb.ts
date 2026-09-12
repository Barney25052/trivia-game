import { randomInt } from "node:crypto";
import { OPEN_TDB } from "../gameConfig.js";

/** A multiple-choice question held server-side. `correctIndex` must never be
 * included in anything broadcast to a client before that question resolves —
 * the AGENTS.md "never broadcast the correct answer before reveal" invariant.
 * This shape is the server-held MC model; the chase engine (ticket 064) maps it
 * to the `question` wire payload and drops one option to show 3 of 4. */
export interface McQuestion {
    id: string;
    question: string;
    category: string;
    options: string[];
    correctIndex: number;
}

/** Thin question source the chase engine draws from — swap the backend today
 * (OpenTDB) for something else later without touching callers. */
export interface McQuestionSource {
    getQuestions(amount: number): Promise<McQuestion[]>;
}

/** Minimal fetch contract so tests can stub the network without a real HTTP stack. */
export interface OpenTdbResponse {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}

export type OpenTdbFetcher = (url: string, init: { signal: AbortSignal }) => Promise<OpenTdbResponse>;

const DEFAULT_FETCHER: OpenTdbFetcher = (url, init) => fetch(url, init);

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

export class OpenTdbError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OpenTdbError";
    }
}

/** Thrown when the API returns a non-zero response_code (1 no results, 2 invalid
 * parameter, 3 token not found, 4 token empty). Carries the code so callers can
 * react to token exhaustion (3/4) by resetting the session token. */
export class OpenTdbResponseCodeError extends OpenTdbError {
    constructor(public readonly code: number) {
        super(`OpenTDB responded with response_code ${code}`);
        this.name = "OpenTdbResponseCodeError";
    }
}

interface RequestSettings {
    timeoutMs: number;
    retries: number;
}

/** NAMED_ENTITIES covers the HTML entities trivia questions actually use — the
 * Latin-1 set, common punctuation/symbols, arrows, and Greek letters — plus any
 * character reference handled numerically. Unknown named entities are left
 * intact rather than guessed. OpenTDB encodes with semicolons, so the decoder
 * only recognises terms terminated by `;`. */
const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    apos: "'",
    lt: "<",
    gt: ">",
    quot: "\"",
    nbsp: "\u00a0",
    iexcl: "\u00a1",
    cent: "\u00a2",
    pound: "\u00a3",
    curren: "\u00a4",
    yen: "\u00a5",
    brvbar: "\u00a6",
    sect: "\u00a7",
    uml: "\u00a8",
    copy: "\u00a9",
    ordf: "\u00aa",
    laquo: "\u00ab",
    not: "\u00ac",
    shy: "\u00ad",
    reg: "\u00ae",
    macr: "\u00af",
    deg: "\u00b0",
    plusmn: "\u00b1",
    sup2: "\u00b2",
    sup3: "\u00b3",
    acute: "\u00b4",
    micro: "\u00b5",
    para: "\u00b6",
    middot: "\u00b7",
    cedil: "\u00b8",
    sup1: "\u00b9",
    ordm: "\u00ba",
    raquo: "\u00bb",
    frac14: "\u00bc",
    frac12: "\u00bd",
    frac34: "\u00be",
    iquest: "\u00bf",
    Agrave: "\u00c0",
    Aacute: "\u00c1",
    Acirc: "\u00c2",
    Atilde: "\u00c3",
    Auml: "\u00c4",
    Aring: "\u00c5",
    AElig: "\u00c6",
    Ccedil: "\u00c7",
    Egrave: "\u00c8",
    Eacute: "\u00c9",
    Ecirc: "\u00ca",
    Euml: "\u00cb",
    Igrave: "\u00cc",
    Iacute: "\u00cd",
    Icirc: "\u00ce",
    Iuml: "\u00cf",
    ETH: "\u00d0",
    Ntilde: "\u00d1",
    Ograve: "\u00d2",
    Oacute: "\u00d3",
    Ocirc: "\u00d4",
    Otilde: "\u00d5",
    Ouml: "\u00d6",
    times: "\u00d7",
    Oslash: "\u00d8",
    Ugrave: "\u00d9",
    Uacute: "\u00da",
    Ucirc: "\u00db",
    Uuml: "\u00dc",
    Yacute: "\u00dd",
    THORN: "\u00de",
    szlig: "\u00df",
    agrave: "\u00e0",
    aacute: "\u00e1",
    acirc: "\u00e2",
    atilde: "\u00e3",
    auml: "\u00e4",
    aring: "\u00e5",
    aelig: "\u00e6",
    ccedil: "\u00e7",
    egrave: "\u00e8",
    eacute: "\u00e9",
    ecirc: "\u00ea",
    euml: "\u00eb",
    igrave: "\u00ec",
    iacute: "\u00ed",
    icirc: "\u00ee",
    iuml: "\u00ef",
    eth: "\u00f0",
    ntilde: "\u00f1",
    ograve: "\u00f2",
    oacute: "\u00f3",
    ocirc: "\u00f4",
    otilde: "\u00f5",
    ouml: "\u00f6",
    divide: "\u00f7",
    oslash: "\u00f8",
    ugrave: "\u00f9",
    uacute: "\u00fa",
    ucirc: "\u00fb",
    uuml: "\u00fc",
    yacute: "\u00fd",
    thorn: "\u00fe",
    yuml: "\u00ff",
    OElig: "\u0152",
    oelig: "\u0153",
    Scaron: "\u0160",
    scaron: "\u0161",
    Yuml: "\u0178",
    fnof: "\u0192",
    circ: "\u02c6",
    tilde: "\u02dc",
    ensp: "\u2002",
    emsp: "\u2003",
    thinsp: "\u2009",
    zwnj: "\u200c",
    zwj: "\u200d",
    lrm: "\u200e",
    rlm: "\u200f",
    ndash: "\u2013",
    mdash: "\u2014",
    lsquo: "\u2018",
    rsquo: "\u2019",
    sbquo: "\u201a",
    ldquo: "\u201c",
    rdquo: "\u201d",
    bdquo: "\u201e",
    dagger: "\u2020",
    Dagger: "\u2021",
    bull: "\u2022",
    hellip: "\u2026",
    permil: "\u2030",
    prime: "\u2032",
    Prime: "\u2033",
    lsaquo: "\u2039",
    rsaquo: "\u203a",
    euro: "\u20ac",
    trade: "\u2122",
    larr: "\u2190",
    uarr: "\u2191",
    rarr: "\u2192",
    darr: "\u2193",
    harr: "\u2194",
    crarr: "\u21b5",
    forall: "\u2200",
    part: "\u2202",
    exist: "\u2203",
    empty: "\u2205",
    nabla: "\u2207",
    isin: "\u2208",
    notin: "\u2209",
    ni: "\u220b",
    prod: "\u220f",
    sum: "\u2211",
    minus: "\u2212",
    lowast: "\u2217",
    radic: "\u221a",
    prop: "\u221d",
    infin: "\u221e",
    ang: "\u2220",
    and: "\u2227",
    or: "\u2228",
    cap: "\u2229",
    cup: "\u222a",
    int: "\u222b",
    there4: "\u2234",
    sim: "\u223c",
    cong: "\u2245",
    asymp: "\u2248",
    ne: "\u2260",
    equiv: "\u2261",
    le: "\u2264",
    ge: "\u2265",
    sub: "\u2282",
    sup: "\u2283",
    nsub: "\u2284",
    sube: "\u2286",
    supe: "\u2287",
    oplus: "\u2295",
    otimes: "\u2297",
    perp: "\u22a5",
    sdot: "\u22c5",
    lceil: "\u2308",
    rceil: "\u2309",
    lfloor: "\u230a",
    rfloor: "\u230b",
    lang: "\u2329",
    rang: "\u232a",
    loz: "\u25ca",
    spades: "\u2660",
    clubs: "\u2663",
    hearts: "\u2665",
    diams: "\u2666",
    Alpha: "\u0391",
    Beta: "\u0392",
    Gamma: "\u0393",
    Delta: "\u0394",
    Epsilon: "\u0395",
    Zeta: "\u0396",
    Eta: "\u0397",
    Theta: "\u0398",
    Iota: "\u0399",
    Kappa: "\u039a",
    Lambda: "\u039b",
    Mu: "\u039c",
    Nu: "\u039d",
    Xi: "\u039e",
    Omicron: "\u039f",
    Pi: "\u03a0",
    Rho: "\u03a1",
    Sigma: "\u03a3",
    Tau: "\u03a4",
    Upsilon: "\u03a5",
    Phi: "\u03a6",
    Chi: "\u03a7",
    Psi: "\u03a8",
    Omega: "\u03a9",
    alpha: "\u03b1",
    beta: "\u03b2",
    gamma: "\u03b3",
    delta: "\u03b4",
    epsilon: "\u03b5",
    zeta: "\u03b6",
    eta: "\u03b7",
    theta: "\u03b8",
    iota: "\u03b9",
    kappa: "\u03ba",
    lambda: "\u03bb",
    mu: "\u03bc",
    nu: "\u03bd",
    xi: "\u03be",
    omicron: "\u03bf",
    pi: "\u03c0",
    rho: "\u03c1",
    sigmaf: "\u03c2",
    sigma: "\u03c3",
    tau: "\u03c4",
    upsilon: "\u03c5",
    phi: "\u03c6",
    chi: "\u03c7",
    psi: "\u03c8",
    omega: "\u03c9",
    thetasym: "\u03d1",
    upsih: "\u03d2",
    piv: "\u03d6"
};

/** Decode HTML character references from OpenTDB text: numeric references
 * (decimal and hex) plus the named entities above. Unknown named entities are
 * kept verbatim. */
export function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity) => {
        if (entity.startsWith("#x") || entity.startsWith("#X")) {
            const codePoint = parseInt(entity.slice(2), 16);
            if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
                return String.fromCodePoint(codePoint);
            }
            return match;
        }
        if (entity.startsWith("#")) {
            const codePoint = parseInt(entity.slice(1), 10);
            if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
                return String.fromCodePoint(codePoint);
            }
            return match;
        }
        return NAMED_ENTITIES[entity] ?? match;
    });
}

/** Trim, HTML-decode, and collapse internal whitespace runs on a piece of
 * OpenTDB text (question, category, or option). Returns "" for anything that is
 * not a non-blank string. */
function cleanText(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    return decodeHtmlEntities(value.trim()).replace(/\s{2,}/g, " ").trim();
}

/** Stable id for a question made from its decoded text, so the same OpenTDB
 * question maps to the same id across fetches and is never re-served. */
function questionId(question: string): string {
    let hash = 0;
    for (let i = 0; i < question.length; i += 1) {
        hash = (hash << 5) - hash + question.charCodeAt(i);
        hash |= 0;
    }
    return `q-${(hash >>> 0).toString(36)}`;
}

function shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
}

/** Map one raw OpenTDB result into the server-held MC shape, or null when the
 * item is malformed. The correct answer is shuffled into a random option slot
 * and the position recorded in `correctIndex` — never broadcast. */
function mapRawQuestion(raw: unknown): McQuestion | null {
    if (!isObject(raw)) {
        return null;
    }
    const question = cleanText(raw.question);
    const category = cleanText(raw.category);
    const correctAnswer = cleanText(raw.correct_answer);
    if (question.length === 0 || correctAnswer.length === 0) {
        return null;
    }
    if (!Array.isArray(raw.incorrect_answers) || raw.incorrect_answers.length !== 3) {
        return null;
    }
    const incorrectAnswers = raw.incorrect_answers
        .map((item) => cleanText(item))
        .filter((text) => text.length > 0);
    if (incorrectAnswers.length !== 3) {
        return null;
    }
    const options = [correctAnswer, ...incorrectAnswers];
    if (new Set(options).size !== 4) {
        // A duplicate option makes the correct answer ambiguous — drop the item.
        return null;
    }
    shuffle(options);
    return {
        id: questionId(question),
        question,
        category,
        options,
        correctIndex: options.indexOf(correctAnswer)
    };
}

/** Validate and map a raw OpenTDB `?type=multiple` payload into server-held MC
 * questions, dropping malformed items. Throws `OpenTdbResponseCodeError` on a
 * non-zero response_code and `OpenTdbError` when nothing usable came back. */
export function mapOpenTdbPayload(payload: unknown): McQuestion[] {
    if (!isObject(payload) || !Array.isArray(payload.results)) {
        throw new OpenTdbError("OpenTDB payload is missing a results array");
    }
    if (typeof payload.response_code !== "number" || payload.response_code !== 0) {
        throw new OpenTdbResponseCodeError(
            typeof payload.response_code === "number" ? payload.response_code : -1
        );
    }
    const questions: McQuestion[] = [];
    for (const item of payload.results) {
        const mapped = mapRawQuestion(item);
        if (mapped) {
            questions.push(mapped);
        }
    }
    if (questions.length === 0) {
        throw new OpenTdbError("OpenTDB returned no usable multiple-choice questions");
    }
    return questions;
}

function buildUrl(options: {
    amount?: number;
    difficulty?: string;
    category?: number;
    token?: string;
}): string {
    const url = new URL(OPEN_TDB.url);
    const amount = clamp(options.amount ?? OPEN_TDB.defaultBatchSize, OPEN_TDB.minAmount, OPEN_TDB.maxAmount);
    url.searchParams.set("amount", String(amount));
    url.searchParams.set("type", "multiple");
    if (options.difficulty !== undefined) {
        const difficulty = options.difficulty.toLowerCase();
        if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
            throw new OpenTdbError(`Invalid OpenTDB difficulty: ${options.difficulty}`);
        }
        url.searchParams.set("difficulty", difficulty);
    }
    if (options.category !== undefined) {
        const category = Math.trunc(options.category);
        if (!Number.isFinite(category) || category < 9 || category > 32) {
            throw new OpenTdbError(`Invalid OpenTDB category: ${options.category}`);
        }
        url.searchParams.set("category", String(category));
    }
    if (options.token !== undefined && options.token.length > 0) {
        url.searchParams.set("token", options.token);
    }
    return url.toString();
}

/** Fetch the JSON body of a URL with a bounded timeout and retry budget.
 * Transient failures (network errors, aborts, HTTP 5xx, bad JSON) are retried;
 * permanent failures (HTTP 4xx) throw immediately. */
async function requestJson(fetcher: OpenTdbFetcher, url: string, settings: RequestSettings): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= settings.retries; attempt += 1) {
        try {
            const response = await fetcher(url, { signal: AbortSignal.timeout(settings.timeoutMs) });
            if (!response.ok) {
                if (response.status >= 500) {
                    throw new Error(`OpenTDB responded with HTTP ${response.status}`);
                }
                throw new OpenTdbError(`OpenTDB responded with HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (error instanceof OpenTdbError) {
                throw error;
            }
            lastError = error;
        }
    }
    throw new OpenTdbError(
        `OpenTDB request failed after ${settings.retries + 1} attempts: ` +
        `${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
}

export interface OpenTdbFetchOptions {
    /** How many questions to ask for (clamped to OPEN_TDB amounts). */
    amount?: number;
    /** Optional difficulty filter: "easy" | "medium" | "hard". */
    difficulty?: string;
    /** Optional OpenTDB numeric category filter (9–32). */
    category?: number;
    /** Session token to pass along (minimises repeats across fetches). */
    token?: string;
    /** Injectable fetcher — tests pass a stub; defaults to the global fetch. */
    fetcher?: OpenTdbFetcher;
    timeoutMs?: number;
    retries?: number;
}

/** Fetch a batch of multiple-choice questions from OpenTDB and map them to the
 * server-held MC shape. Best-effort: bounded timeout, bounded retries, and a
 * typed error the caller can fall back from on a network blip. */
export async function fetchMcQuestions(options: OpenTdbFetchOptions = {}): Promise<McQuestion[]> {
    const timeoutMs = clamp(
        options.timeoutMs ?? OPEN_TDB.fetchTimeoutMs,
        OPEN_TDB.minFetchTimeoutMs,
        OPEN_TDB.maxFetchTimeoutMs
    );
    const retries = clamp(options.retries ?? OPEN_TDB.retries, 0, OPEN_TDB.maxRetries);
    const fetcher = options.fetcher ?? DEFAULT_FETCHER;
    const url = buildUrl(options);
    const payload = await requestJson(fetcher, url, { timeoutMs, retries });
    return mapOpenTdbPayload(payload);
}

export interface OpenTdbSourceSettings {
    /** Target questions the pool keeps available across rounds (clamped). */
    poolSize?: number;
    /** Optional difficulty filter applied to every fetch. */
    difficulty?: string;
    /** Optional OpenTDB numeric category filter (9–32). */
    category?: number;
    /** Injectable fetcher — tests pass a stub. */
    fetcher?: OpenTdbFetcher;
    timeoutMs?: number;
    retries?: number;
}

/** Request a fresh OpenTDB session token (or reset an exhausted one) so the API
 * keeps serving new questions instead of repeating the previous batch. */
async function requestOpenTdbToken(
    fetcher: OpenTdbFetcher,
    settings: RequestSettings,
    resetToken?: string
): Promise<string> {
    const url = new URL(OPEN_TDB.tokenUrl);
    url.searchParams.set("command", resetToken ? "reset" : "request");
    if (resetToken) {
        url.searchParams.set("token", resetToken);
    }
    const payload = await requestJson(fetcher, url.toString(), settings);
    if (!isObject(payload) || payload.response_code !== 0) {
        throw new OpenTdbError("OpenTDB failed to issue a session token");
    }
    if (typeof payload.token !== "string" || payload.token.length === 0) {
        throw new OpenTdbError("OpenTDB returned a malformed session token");
    }
    return payload.token;
}

/** A pooled `McQuestionSource` backed by OpenTDB. Numbers the API calls down:
 * it fetches a batch once, holds it in memory, and draws non-repeating
 * questions for the chase engine across multiple rounds without hitting the
 * network every question. Session-token exhaustion is detected and the token
 * reset automatically. */
export function createOpenTdbQuestionSource(settings: OpenTdbSourceSettings = {}): McQuestionSource {
    const fetcher = settings.fetcher ?? DEFAULT_FETCHER;
    const timeoutMs = clamp(
        settings.timeoutMs ?? OPEN_TDB.fetchTimeoutMs,
        OPEN_TDB.minFetchTimeoutMs,
        OPEN_TDB.maxFetchTimeoutMs
    );
    const retries = clamp(settings.retries ?? OPEN_TDB.retries, 0, OPEN_TDB.maxRetries);
    const poolSize = clamp(settings.poolSize ?? OPEN_TDB.poolSize, OPEN_TDB.minPoolSize, OPEN_TDB.maxPoolSize);
    const requestSettings: RequestSettings = { timeoutMs, retries };

    const pool: McQuestion[] = [];
    const seenIds = new Set<string>();
    let token = "";

    const refill = async (): Promise<void> => {
        if (pool.length >= poolSize) {
            return;
        }
        if (token === "") {
            token = await requestOpenTdbToken(fetcher, requestSettings);
        }
        // Bounded attempts: filling poolSize (≤ 200) takes ≤ 4 requests at 50 each.
        const maxAttempts = Math.ceil(poolSize / OPEN_TDB.maxAmount) + 2;
        for (let attempt = 0; attempt < maxAttempts && pool.length < poolSize; attempt += 1) {
            const wanted = Math.min(poolSize - pool.length, OPEN_TDB.maxAmount);
            let questions: McQuestion[];
            try {
                questions = await fetchMcQuestions({
                    amount: wanted,
                    difficulty: settings.difficulty,
                    category: settings.category,
                    token,
                    fetcher,
                    timeoutMs,
                    retries
                });
            } catch (error) {
                if (error instanceof OpenTdbResponseCodeError && (error.code === 3 || error.code === 4)) {
                    token = await requestOpenTdbToken(fetcher, requestSettings, token);
                    continue;
                }
                throw error;
            }
            const fresh = questions.filter((question) => !seenIds.has(question.id));
            if (fresh.length === 0) {
                // The API is repeating itself — stop rather than loop.
                return;
            }
            for (const question of fresh) {
                seenIds.add(question.id);
                pool.push(question);
            }
        }
    };

    return {
        async getQuestions(amount: number): Promise<McQuestion[]> {
            const requested = Math.max(0, Math.floor(amount));
            if (requested === 0) {
                return [];
            }
            if (pool.length < requested) {
                await refill();
            }
            const count = Math.min(requested, pool.length);
            return pool.splice(0, count);
        }
    };
}