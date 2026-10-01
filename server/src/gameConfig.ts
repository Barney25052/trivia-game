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
const TEAM_FINAL_INTRO_DURATION_MS = 5_000;

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

/** Abilities every Chaser gets regardless of which character they pick
 * (ticket 139) — not tied to any character's roster entry below. */
export const SHARED_CHASER_ABILITIES = [
    {
        id: "fiftyFifty",
        name: "50/50",
        description: "Removes one wrong option from the current board-chase question on the Chaser's screen only. 4 uses a game."
    },
    {
        id: "skip",
        name: "Skip",
        description: "Swaps the Chaser's current final-round question for a new one, no penalty. 2 uses a game."
    }
] as const;

/** Chaser character roster (ticket 139): passive abilities (always on,
 * nothing to trigger) and active abilities (the Chaser must deliberately
 * activate them — ticket 140's useChaserAbility handler).
 * Bezos intentionally has 0 active abilities — both his traits are
 * automatic; this is a design decision (GOAL.md), not an oversight. */
export const CHASER_CHARACTERS = [
    {
        id: "bezos",
        name: "Bezos",
        passive: [
            {
                id: "noMiddle",
                name: "No Middle",
                description: "Every offer he makes skips the middle tier. Low or high only."
            },
            {
                id: "pushbackImmunity",
                name: "Pushback Immunity",
                description: "A successful team steal doesn't push him back. Works 3 times a game."
            }
        ],
        active: []
    },
    {
        id: "big stan",
        name: "Big Stan",
        passive: [
            {
                id: "timeBonus",
                name: "Time Bonus",
                description: "+2s on his final-round clock for every correct answer."
            }
        ],
        active: [
            {
                id: "doubleTime",
                name: "Double Time",
                description: "His next correct chase answer moves him 2 spaces instead of 1, but a miss while it's armed costs him a space. Once per contestant's chase."
            }
        ]
    },
    {
        id: "nami",
        name: "Nami",
        passive: [
            {
                id: "shortFuse",
                name: "Short Fuse",
                description: "The team's steal window is always 10s instead of 20s against her."
            }
        ],
        active: [
            {
                id: "reRack",
                name: "Re-rack",
                description: "Redraws the current board-chase question. Once per contestant's chase."
            }
        ]
    },
    {
        id: "maggie",
        name: "Maggie",
        passive: [
            {
                id: "silence",
                name: "Silence",
                description: "Whoever answered the team's last final-round question correctly can't answer the next one."
            }
        ],
        active: [
            {
                id: "jumble",
                name: "Jumble",
                description: "Shuffles the answer-button order on the contestant's own screen for one board-chase question. Once per contestant's chase."
            }
        ]
    }
] as const;

/** Fixed game-balance constants for the abilities above — not client-supplied
 * room options, so (same precedent as CHASER_POT.initial/perRound) they need
 * no min/max clamp pair.
 *
 * "Once per contestant's chase" = once per table round: exactly one
 * contestant's own Cash Builder -> Offer -> Chase turn. Later tickets (140+)
 * rely on this definition for when the usesPerTableRound counters reset —
 * at that contestant's startChase. */
export const CHASER_ABILITIES = {
    fiftyFifty: { usesPerGame: 4 },
    skip: { usesPerGame: 2 },
    pushbackImmunity: { usesPerGame: 3 },
    doubleTime: { usesPerTableRound: 1 },
    reRack: { usesPerTableRound: 1 },
    jumble: { usesPerTableRound: 1 },
    // Ticket 160: was 500ms, which a whole-second clock barely showed.
    timeBonusMs: 2000,
    shortFuseStealWindowMs: 10_000
} as const;

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

/** Room codes — the id players type (or read out) to join a friend's room.
 * Short, uppercase letters only, and no I or O (they read as 1 and 0). The
 * client uppercases what's typed, so joining is case-insensitive. */
export const ROOM_CODE = {
    length: 4,
    alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ",
    /** Collisions allowed at one length before a code grows a letter, so
     * creating a room can never spin forever. */
    maxAttemptsPerLength: 20
} as const;

export const ROOM_SETTINGS = {
    max_clients: 6,
    /** Hard cap on `trivia` rooms alive at once in this process (ticket 132)
     * — an abuse guard against unbounded `client.create("trivia", ...)`
     * calls, not a capacity/performance ceiling. Tune based on real traffic
     * once deployed. */
    maxConcurrentRooms: 50
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

/** A short holding beat between the last Chase resolving and the real Team
 * Final starting (ticket 122) — mirrors LINEUP's role as a pacing pause, not
 * a real screen to read for long. */
export const TEAM_FINAL_INTRO = {
    durationMs: TEAM_FINAL_INTRO_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: TEAM_FINAL_INTRO_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const PLAYER_NAME = {
    maxLength: 24
} as const;

/** Open-answer leniency (ticket 047, tightened by ticket 161). Answers are
 * compared word by word; numbers (digits, number words, Roman numerals)
 * always need the exact value. */
export const ANSWER_CHECK = {
    /** Lowercase both answers before comparing. */
    caseInsensitive: true,
    /** Words shorter than this (after collapsing doubled letters) must be typed exactly: "Cat" is not "Bat". */
    minTypoWordLength: 4,
    /** Edits each longer word can absorb, per letter of the shorter of the two words (rounded down, at least 1). */
    typoEditsPerLetter: 0.25,
    /** Compare words with doubled letters collapsed, so "Scarlet Johanson" is "Scarlett Johansson". */
    ignoreDoubledLetters: true,
    /** Read Roman numerals as numbers: "Frozen II" is "Frozen 2", "Louis XV" is not "Louis XIV". */
    romanNumerals: true,
    /** Most words regrouped at once when the spacing differs ("Kermitthefrog", "ACDC"). Bounds the checker's work. */
    maxRegroupWords: 6,
    /** A typed answer longer than this is wrong without being checked, so an oversized message can't
     * make the checker slow. */
    maxTypedLength: 200
} as const;

export const CHASER_QUIP = {
    maxLength: 140
} as const;

/** Contestant character codec ranges (ticket 101) — `[hairStyle][hairColour]
 * [faceStyle][faceColour][shirtColour]`, each a single 0-based digit. */
export const CHARACTER = {
    hairStyles: 5,
    faceStyles: 3,
    colours: 9
} as const;

/** Contestant face reactions (ticket 103): the server decides the expression
 * and broadcasts a `reaction { seatId, expression }` cue so every client
 * (including spectators and the Chaser) renders the same flash. */
export const REACTION = {
    /** Consecutive wrong answers before the flashed expression escalates from
     * frown to teary (cash builder). */
    wrongStreakTear: 2,
    /** Reused from OfferScreen.vue's former local "happy"/"sad" computed
     * (tickets 057/058): a low offer at or below this is a frown, a high
     * offer above this is a smile. The server now decides and broadcasts the
     * `reaction` cue itself instead of each client inferring it from the
     * synced offer amounts. */
    offerSadLowThreshold: 0,
    offerHappyHighThreshold: 50_000
} as const;

export const RATE_LIMIT = {
    maxMessages: 20,
    windowMs: 10_000,
    minMaxMessages: 1,
    maxMaxMessages: 100,
    minWindowMs: TIMER_CLAMP.minMs,
    maxWindowMs: 60_000
} as const;
