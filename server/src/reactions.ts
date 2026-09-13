import { REACTION } from "./gameConfig.js";

/** The four face states `CharacterFace` can render (ticket 103). Mirrors the
 * client's `reaction` prop values 1:1 — see
 * client/src/components/CharacterFace.vue. */
export type Expression = "neutral" | "smile" | "frown" | "teary";

/**
 * Pure resolution-outcome -> face-expression mapping (ticket 103). Callers
 * decide *when* to call this (cash builder answer, chase question, final
 * answer, ...) and pass in the already-updated wrong-streak count; this
 * function only decides which face that outcome earns.
 *
 * `prev` — the expression currently showing for this seat, or "neutral" if
 * none — is accepted for API symmetry with the room's broadcast call sites
 * (every caller already knows what's currently displayed) but today's rules
 * don't depend on it: a correct answer always smiles regardless of what came
 * before, and a wrong answer's severity is purely a function of the streak
 * the caller passes in. Kept as a parameter rather than dropped so a future
 * rule (e.g. avoiding an abrupt smile -> teary flip) can use it without
 * changing every call site.
 */
export function nextExpression(prev: Expression, correct: boolean, streak: number): Expression {
    if (correct) {
        return "smile";
    }
    return streak >= REACTION.wrongStreakTear ? "teary" : "frown";
}
