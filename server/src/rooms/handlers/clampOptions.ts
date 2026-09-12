import { TriviaRoom } from "../TriviaRoom.js";
import {
    CASH_BUILDER,
    CHASER_CHARACTER_REVEAL,
    CHASER_REVEAL,
    CHASER_SELECTION,
    FINAL_ROUND,
    LINEUP,
    RATE_LIMIT,
    REVEAL_READY,
} from "../../gameConfig.js";

const clamp = (value: number, minMs: number, maxMs: number): number =>
    Math.min(Math.max(value, minMs), maxMs);

export function clampRoomOptions(room: TriviaRoom, options: any): void {
    if (typeof options?.cashBuilderDurationMs === "number") {
        room.cashBuilderDurationMs = clamp(
            options.cashBuilderDurationMs,
            CASH_BUILDER.minMs,
            CASH_BUILDER.maxMs
        );
    }
    if (typeof options?.wrongAnswerRevealMs === "number") {
        room.wrongAnswerRevealMs = clamp(
            options.wrongAnswerRevealMs,
            CASH_BUILDER.wrongAnswerRevealMinMs,
            CASH_BUILDER.wrongAnswerRevealMaxMs
        );
    }
    if (typeof options?.chaserSelectionDurationMs === "number") {
        room.chaserSelectionDurationMs = clamp(
            options.chaserSelectionDurationMs,
            CHASER_SELECTION.minMs,
            CHASER_SELECTION.maxMs
        );
    }
    if (typeof options?.chaserRevealDurationMs === "number") {
        room.chaserRevealDurationMs = clamp(
            options.chaserRevealDurationMs,
            CHASER_REVEAL.minMs,
            CHASER_REVEAL.maxMs
        );
    }
    if (typeof options?.chaserCharacterRevealDurationMs === "number") {
        room.chaserCharacterRevealDurationMs = clamp(
            options.chaserCharacterRevealDurationMs,
            CHASER_CHARACTER_REVEAL.minMs,
            CHASER_CHARACTER_REVEAL.maxMs
        );
    }
    if (typeof options?.revealReadyCooldownMs === "number") {
        room.revealReadyCooldownMs = clamp(
            options.revealReadyCooldownMs,
            REVEAL_READY.minMs,
            REVEAL_READY.maxMs
        );
    }
    if (typeof options?.lineupDurationMs === "number") {
        room.lineupDurationMs = clamp(
            options.lineupDurationMs,
            LINEUP.minMs,
            LINEUP.maxMs
        );
    }
    if (typeof options?.teamFinalDurationMs === "number") {
        room.teamFinalDurationMs = clamp(
            options.teamFinalDurationMs,
            FINAL_ROUND.minMs,
            FINAL_ROUND.maxMs
        );
    }
    if (typeof options?.chaserFinalDurationMs === "number") {
        room.chaserFinalDurationMs = clamp(
            options.chaserFinalDurationMs,
            FINAL_ROUND.minMs,
            FINAL_ROUND.maxMs
        );
    }
    if (typeof options?.rateLimitMaxMessages === "number") {
        room.rateLimitMaxMessages = clamp(
            options.rateLimitMaxMessages,
            RATE_LIMIT.minMaxMessages,
            RATE_LIMIT.maxMaxMessages
        );
    }
    if (typeof options?.rateLimitWindowMs === "number") {
        room.rateLimitWindowMs = clamp(
            options.rateLimitWindowMs,
            RATE_LIMIT.minWindowMs,
            RATE_LIMIT.maxWindowMs
        );
    }
}
