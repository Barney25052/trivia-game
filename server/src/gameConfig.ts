export const CASH_BUILDER = {
    durationMs: 60_000,
    rewardPerCorrect: 1_000
} as const;

export const CHASER_SELECTION = {
    durationMs: 30_000,
    defaultMode: "random"
} as const;

export const CHASER_POT = {
    initial: 50_000,
    perRound: 30_000
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
    answerWindowMs: 5_000
} as const;

export const FINAL_ROUND = {
    teamDurationMs: 120_000,
    chaserDurationMs: 120_000
} as const;

export const PLAYER_NAME = {
    maxLength: 24
} as const;