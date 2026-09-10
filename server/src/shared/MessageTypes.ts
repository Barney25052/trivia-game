import { GamePhase } from "../TriviaTypes.js";
import { OfferTier } from "../gameFlow.js";

export interface PhasePayload {
    phase: GamePhase;
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

export interface QuestionPayload {
    round: number;
    targetSessionId: string;
    kind: "open" | "mc";
    prompt: string;
    options?: string[];
    questionId: number;
}