export interface PhasePayload {
    phase: string;
}

export interface OfferPayload {
    low: number;
    middle: number;
    high: number;
}

export interface GetReadyPayload {
    cooldownMs: number;
}

export interface EndGamePayload {
    winner: "chaser" | "team";
}

/** Final-round open-ended question delivery (ticket 077). Sent per-client to
 * only the side it belongs to — never broadcast, since the Chaser must never
 * see a team prompt or vice versa. `questionId` is null when that side's
 * question bank is exhausted mid-round (the round's timer still ends it). */
export interface FinalQuestionPayload {
    side: "team" | "chaser";
    questionId: number | null;
    prompt: string | null;
}

/** Broadcast the moment a non-Chaser wins the right to answer the current team
 * final question (ticket 078) — every client locks its buzz button. */
export interface FinalBuzzPayload {
    questionId: number;
    seatId: string;
}

/** Sent to the buzzer (team) or the Chaser after their own submission resolves
 * — the cash-builder-shaped result, never broadcast (ticket 078/079). */
export interface FinalAnswerResultPayload {
    correct: boolean;
    correctAnswer: string;
    questionId: number;
}

/** Sent to the team only when the Chaser misses (ticket 079): the prompt they
 * just missed, never the answer, with the steal window length. */
export interface FinalStealPayload {
    questionId: number;
    prompt: string;
    windowMs: number;
}

/** Broadcast to the team once a steal attempt resolves, so the outcome (did
 * the Chaser get pushed back, or did the target climb) can be shown. */
export interface FinalStealResolvedPayload {
    pushedBack: boolean;
}