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