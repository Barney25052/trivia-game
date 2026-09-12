const CASH_BUILDER_DURATION_MS = 60_000;
const CASH_BUILDER_WRONG_REVEAL_MS = 1_000;
const CHASER_SELECTION_VOTE_MS = 30_000;
const CHASER_REVEAL_DURATION_MS = 5_000;
const CHASER_CHARACTER_REVEAL_DURATION_MS = 6_000;
const TEAM_FINAL_DURATION_MS = 120_000;
const CHASER_FINAL_DURATION_MS = 120_000;
const FINAL_WRONG_ANSWER_REVEAL_MS = 1_000;
const FINAL_STEAL_WINDOW_MS = 20_000;
const FINAL_STEAL_RESOLVE_HOLD_MS = 3_000;
const REVEAL_READY_COOLDOWN_MS = 5_000;
const LINEUP_DURATION_MS = 7_000;

export const TIMER_CLAMP = {
    minMs: 100,
    maxFactor: 10
} as const;

export const CASH_BUILDER = {
    durationMs: CASH_BUILDER_DURATION_MS,
    rewardPerCorrect: 1_000,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CASH_BUILDER_DURATION_MS * TIMER_CLAMP.maxFactor,
    /** How long a wrong answer's reveal (correct answer + red flash) stays up before the next question. */
    wrongAnswerRevealMs: CASH_BUILDER_WRONG_REVEAL_MS,
    wrongAnswerRevealMinMs: 0,
    wrongAnswerRevealMaxMs: CASH_BUILDER_WRONG_REVEAL_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_SELECTION = {
    defaultMode: "random",
    /** Vote mode only — random mode resolves immediately with no hold (ticket 054). */
    voteDurationMs: CHASER_SELECTION_VOTE_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_SELECTION_VOTE_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_REVEAL = {
    durationMs: CHASER_REVEAL_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_REVEAL_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_CHARACTER_REVEAL = {
    durationMs: CHASER_CHARACTER_REVEAL_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_CHARACTER_REVEAL_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_POT = {
    initial: 50_000,
    perRound: 30_000
} as const;

export const OFFER = {
    /** The low offer must be a multiple of this many dollars. */
    lowStep: 100,
    /** The high offer must be a multiple of this many dollars. */
    highStep: 1_000
} as const;

/** Auto-quips the Chaser's bubble shows while an offer round plays out. The
 * server picks the line and sends it inside the offer broadcasts (ticket 057) so
 * every client sees the same text at the same stage. */
export const OFFER_QUIPS = {
    start: [
        "Let's see what we're working with.",
        "This should be fun.",
        "Time to make an offer."
    ],
    low: [
        "How does that feel?",
        "Not so friendly, is it?",
        "Let's keep this tight."
    ],
    high: [
        "Now we're talking numbers.",
        "That's a real temptation.",
        "Don't get greedy now."
    ]
} as const;

export const CHASER_CHARACTERS = [
    { id: "bezos", name: "Bezos", ability: "" },
    { id: "big stan", name: "Big Stan", ability: "" },
    { id: "nami", name: "Nami", ability: "" }
] as const;

export const BOARD = {
    /** Spaces on the board are 1..spaces inclusive. */
    spaces: 7,
    /** Contestant start for a low offer. */
    startLow: 4,
    /** Contestant start for a middle offer. */
    startMiddle: 5,
    /** Contestant start for a high offer. */
    startHigh: 6,
    /** Chaser starts off the board. */
    chaserStartOffboard: 8,
    /** First correct answer moves the chaser from off-board to here. */
    chaserFirstCorrectSpace: 7,
    /** Contestant escapes (wins the chase) by reaching this space. */
    escapeSpace: 0
} as const;

export const CHASE_QUESTION = {
    optionCount: 3,
    answerWindowMs: 5_000,
    minAnswerWindowMs: TIMER_CLAMP.minMs,
    maxAnswerWindowMs: 5_000 * TIMER_CLAMP.maxFactor
} as const;

/** OpenTDB runtime multiple-choice source for the board chase (Phase 4, ticket 063).
 * The pool keeps a batch of questions in memory across rounds so we hit the free
 * API sparingly instead of once per chase question. */
export const OPEN_TDB = {
    url: "https://opentdb.com/api.php",
    tokenUrl: "https://opentdb.com/api_token.php",
    /** OpenTDB refuses to return more than this per request. */
    maxAmount: 50,
    /** Default per-fetch amount when the caller doesn't specify one. */
    defaultBatchSize: 50,
    minAmount: 1,
    /** Target questions a get-questions pool keeps available across rounds. */
    poolSize: 50,
    minPoolSize: 5,
    maxPoolSize: 200,
    /** Abort a single fetch after this long. */
    fetchTimeoutMs: 5_000,
    minFetchTimeoutMs: 1_000,
    maxFetchTimeoutMs: 30_000,
    /** Extra attempts beyond the first fetch. */
    retries: 2,
    maxRetries: 5
} as const;

/** Bounded recovery around a single chase question draw (ticket 074): the
 * live OpenTDB source already retries at the fetch level (OPEN_TDB.retries),
 * but a whole draw can still fail or come back empty. This governs the outer
 * retry loop before the room falls back to the local MC backup pool
 * (ticket 090), and only resolves the round as caught if that pool is itself
 * exhausted — the room must never simply hang. */
export const MC_SOURCE = {
    /** Extra draw attempts against the live source beyond the first. */
    retries: 2,
    maxRetries: 5,
    /** Delay between draw attempts. */
    retryDelayMs: 200,
    minRetryDelayMs: 0,
    maxRetryDelayMs: 5_000
} as const;

export const ROOM_SETTINGS = {
    max_clients: 6
} as const;

export const FINAL_ROUND = {
    teamDurationMs: TEAM_FINAL_DURATION_MS,
    chaserDurationMs: CHASER_FINAL_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_FINAL_DURATION_MS * TIMER_CLAMP.maxFactor,
    /** How long a wrong team answer's reveal stays up before the next question
     * (mirrors CASH_BUILDER.wrongAnswerRevealMs, ticket 078). */
    wrongAnswerRevealMs: FINAL_WRONG_ANSWER_REVEAL_MS,
    wrongAnswerRevealMinMs: 0,
    wrongAnswerRevealMaxMs: FINAL_WRONG_ANSWER_REVEAL_MS * TIMER_CLAMP.maxFactor,
    /** How long the team has to steal after a Chaser miss (ticket 079). */
    stealWindowMs: FINAL_STEAL_WINDOW_MS,
    stealWindowMinMs: TIMER_CLAMP.minMs,
    stealWindowMaxMs: FINAL_STEAL_WINDOW_MS * TIMER_CLAMP.maxFactor,
    /** How long the outcome beat holds before the Chaser's next question after a
     * steal resolves or expires unclaimed (ticket 095) — the frozen clock stays
     * paused through the hold so neither the reveal nor the next question races
     * away, and the pause never eats into the Chaser's budget. */
    stealResolveHoldMs: FINAL_STEAL_RESOLVE_HOLD_MS,
    stealResolveHoldMinMs: TIMER_CLAMP.minMs,
    stealResolveHoldMaxMs: FINAL_STEAL_RESOLVE_HOLD_MS * TIMER_CLAMP.maxFactor
} as const;

export const REVEAL_READY = {
    cooldownMs: REVEAL_READY_COOLDOWN_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: REVEAL_READY_COOLDOWN_MS * TIMER_CLAMP.maxFactor
} as const;

export const LINEUP = {
    durationMs: LINEUP_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: LINEUP_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const PLAYER_NAME = {
    maxLength: 24
} as const;

export const ANSWER_CHECK = {
    /** Trim + collapse runs of internal whitespace before comparing. */
    normaliseWhitespace: true,
    /** Lowercase both answers before comparing. */
    caseInsensitive: true,
    /** A single edit (substitution/insertion/deletion/transposition) always passes. */
    allowSingleEdit: true,
    /** Beyond a single edit, accept answers within this edit-distance ratio of the longer answer. */
    editDistanceRatio: 0.3
} as const;

export const CHASER_QUIP = {
    maxLength: 140
} as const;

export const RATE_LIMIT = {
    maxMessages: 20,
    windowMs: 10_000,
    minMaxMessages: 1,
    maxMaxMessages: 100,
    minWindowMs: TIMER_CLAMP.minMs,
    maxWindowMs: 60_000
} as const;
