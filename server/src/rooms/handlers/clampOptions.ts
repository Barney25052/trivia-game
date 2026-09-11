import { TriviaRoom } from "../TriviaRoom.js";
import {
    CASH_BUILDER,
    CHASER_REVEAL,
    CHASER_SELECTION,
    FINAL_ROUND,
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
    if (typeof options?.revealReadyCooldownMs === "number") {
        room.revealReadyCooldownMs = clamp(
            options.revealReadyCooldownMs,
            REVEAL_READY.minMs,
            REVEAL_READY.maxMs
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
}
