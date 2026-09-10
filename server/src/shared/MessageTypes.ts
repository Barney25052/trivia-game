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