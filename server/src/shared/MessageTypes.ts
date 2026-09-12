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

/** Broadcast when the Chaser misses so the team gets a steal chance (ticket
 * 079): the prompt they just missed, never the answer, with the steal window
 * length. Sent to the whole room — payload only carries the Chaser's own
 * question id/prompt + `windowMs`, no leak — so the Chaser's client can render
 * the steal and its countdown too (ticket 095). */
export interface FinalStealPayload {
    questionId: number;
    prompt: string;
    windowMs: number;
}

/** Broadcast the instant the first (winning) steal submission lands — the typed
 * guess from the submitting seat, against a prompt already shown to the whole
 * team (ticket 095). Never carries the correct answer. */
export interface FinalStealAnswerPayload {
    questionId: number;
    seatId: string;
    answer: string;
}

/** Broadcast to the whole room the moment a steal attempt resolves, correct or
 * wrong — the reveal moment, so carrying the canonical answer is allowed
 * (ticket 095). `pushedBack` true when the Chaser was knocked back; when they
 * are already at 0 the team target climbs instead. */
export interface FinalStealResolvedPayload {
    questionId: number;
    seatId: string;
    correct: boolean;
    correctAnswer: string;
    pushedBack: boolean;
}