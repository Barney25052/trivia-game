const CASH_BUILDER_DURATION_MS = 60_000;
const CHASER_SELECTION_RANDOM_MS = 8_000;
const CHASER_SELECTION_VOTE_MS = 30_000;
const CHASER_REVEAL_DURATION_MS = 5_000;
const TEAM_FINAL_DURATION_MS = 120_000;
const CHASER_FINAL_DURATION_MS = 120_000;
const REVEAL_READY_COOLDOWN_MS = 5_000;

export const TIMER_CLAMP = {
    minMs: 100,
    maxFactor: 10
} as const;

export const CASH_BUILDER = {
    durationMs: CASH_BUILDER_DURATION_MS,
    rewardPerCorrect: 1_000,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CASH_BUILDER_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_SELECTION = {
    defaultMode: "random",
    randomDurationMs: CHASER_SELECTION_RANDOM_MS,
    voteDurationMs: CHASER_SELECTION_VOTE_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_SELECTION_VOTE_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_REVEAL = {
    durationMs: CHASER_REVEAL_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_REVEAL_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const CHASER_POT = {
    initial: 50_000,
    perRound: 30_000
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
    answerWindowMs: 5_000
} as const;

export const ROOM_SETTINGS = {
    max_clients: 6
} as const;

export const FINAL_ROUND = {
    teamDurationMs: TEAM_FINAL_DURATION_MS,
    chaserDurationMs: CHASER_FINAL_DURATION_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: CHASER_FINAL_DURATION_MS * TIMER_CLAMP.maxFactor
} as const;

export const REVEAL_READY = {
    cooldownMs: REVEAL_READY_COOLDOWN_MS,
    minMs: TIMER_CLAMP.minMs,
    maxMs: REVEAL_READY_COOLDOWN_MS * TIMER_CLAMP.maxFactor
} as const;

export const PLAYER_NAME = {
    maxLength: 24
} as const;

export const ANSWER_CHECK = {
    normaliseWhitespace: true,
    caseInsensitive: true
} as const;