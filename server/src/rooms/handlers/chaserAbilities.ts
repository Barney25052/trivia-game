import { GamePhase } from "../../TriviaTypes.js";

export type AbilityCheckResult = { ok: true } | { ok: false; reason: string };

/** Which `chaserCharacterId` (ticket 139) owns each manually-activated
 * ability (ticket 140). `"any"` marks the two shared abilities every Chaser
 * gets regardless of character (`SHARED_CHASER_ABILITIES` in gameConfig.ts);
 * every other entry restricts the ability to that one character, matching
 * its `active` roster entry in `CHASER_CHARACTERS`. */
const ABILITY_OWNER: Record<string, string> = {
    fiftyFifty: "any",
    skip: "any",
    doubleTime: "big stan",
    reRack: "nami",
    jumble: "maggie"
};

/** The only ability ids that reach this handler — `noMiddle`/`pushbackImmunity`/
 * `timeBonus`/`shortFuse`/`silence` are passive and never manually activated
 * (ticket 139), so they are deliberately absent from `ABILITY_OWNER`. */
const MANUAL_ABILITY_IDS = Object.keys(ABILITY_OWNER);

/** Shared timing gate for `fiftyFifty`/`reRack`/`jumble`: mid-Chase, a
 * question is live, and nobody has answered it yet — redrawing or altering a
 * question after either side has committed would be exploitable/confusing. */
function chaseTimingGate(room: any): AbilityCheckResult {
    if (room.state.currentPhase !== GamePhase.Chase || !room.currentChaseQuestion) {
        return { ok: false, reason: "This ability can only be used mid-Chase with a live question" };
    }
    if (Object.keys(room.chaseAnswers).length > 0) {
        return { ok: false, reason: "This ability can not be used once someone has answered the current chase question" };
    }
    return { ok: true };
}

/** Pure-ish validation (reads room state, never mutates it) for the generic
 * `useChaserAbility` message: sender must be the Chaser, the ability must be
 * one of the five manually-activated ones, owned by the Chaser's chosen
 * character (or shared), still have charges/be unused this table round, and
 * pass its own phase/timing gate. */
export function canUseAbility(room: any, seatId: string, abilityId: string): AbilityCheckResult {
    if (seatId !== room.state.chaserSeatId) {
        return { ok: false, reason: "Only the Chaser can activate an ability" };
    }
    if (!MANUAL_ABILITY_IDS.includes(abilityId)) {
        return { ok: false, reason: `Not a manually-activated ability: ${abilityId}` };
    }
    const chaser = room.state.players.get(seatId);
    if (!chaser) {
        return { ok: false, reason: "Chaser seat not found" };
    }
    const owner = ABILITY_OWNER[abilityId];
    if (owner !== "any" && chaser.chaserCharacterId !== owner) {
        return { ok: false, reason: `${abilityId} is not owned by ${chaser.chaserCharacterId || "(no character)"}` };
    }

    switch (abilityId) {
        case "fiftyFifty": {
            if (room.state.fiftyFiftyUsesRemaining <= 0) {
                return { ok: false, reason: "No 50/50 uses remaining" };
            }
            return chaseTimingGate(room);
        }
        case "reRack": {
            if (room.state.reRackUsedThisTableRound) {
                return { ok: false, reason: "Re-rack already used this table round" };
            }
            return chaseTimingGate(room);
        }
        case "jumble": {
            if (room.state.jumbleUsedThisTableRound) {
                return { ok: false, reason: "Jumble already used this table round" };
            }
            return chaseTimingGate(room);
        }
        case "doubleTime": {
            if (room.state.doubleTimeUsedThisTableRound) {
                return { ok: false, reason: "Double Time already used this table round" };
            }
            if (room.state.currentPhase !== GamePhase.Chase || !room.currentChaseQuestion) {
                return { ok: false, reason: "Double Time can only be used mid-Chase with a live question" };
            }
            if ("chaser" in room.chaseAnswers) {
                return { ok: false, reason: "The Chaser has already answered this chase question" };
            }
            if (room.state.doubleTimeArmed) {
                return { ok: false, reason: "Double Time is already armed" };
            }
            return { ok: true };
        }
        case "skip": {
            if (room.state.skipUsesRemaining <= 0) {
                return { ok: false, reason: "No Skip uses remaining" };
            }
            if (room.state.currentPhase !== GamePhase.ChaserFinal) {
                return { ok: false, reason: "Skip can only be used during ChaserFinal" };
            }
            if (room.finalChaserQuestionResolved) {
                return { ok: false, reason: "No live chaser-final question to skip" };
            }
            if (room.finalStealActive) {
                return { ok: false, reason: "Can not Skip while a steal window is open" };
            }
            return { ok: true };
        }
        default:
            return { ok: false, reason: `Unhandled ability: ${abilityId}` };
    }
}

/** The actual per-ability mutation. This ticket (140) implements only the
 * counter/flag bookkeeping — decrementing the relevant uses-remaining
 * counter, or setting the relevant per-table-round/armed boolean. The real
 * board/final-round mutations (50/50's option removal, Double Time's board
 * math, Re-rack's redraw, Jumble's shuffle, Skip's question-discard) are
 * ticket 141/142's scope — each branch below leaves a comment marking where
 * that effect plugs in. Assumes the caller already validated via
 * `canUseAbility`. */
export function applyChaserAbilityEffect(room: any, abilityId: string): void {
    switch (abilityId) {
        case "fiftyFifty":
            room.state.fiftyFiftyUsesRemaining -= 1;
            // ticket 141: remove one wrong option from the current chase question.
            break;
        case "reRack":
            room.state.reRackUsedThisTableRound = true;
            // ticket 141: redraw the current board-chase question.
            break;
        case "jumble":
            room.state.jumbleUsedThisTableRound = true;
            // ticket 141: shuffle the answer-button order on the contestant's own screen.
            break;
        case "doubleTime":
            room.state.doubleTimeUsedThisTableRound = true;
            room.state.doubleTimeArmed = true;
            // ticket 141: the next correct chase answer moves 2 spaces instead of
            // 1; a miss while armed costs a space back.
            break;
        case "skip":
            room.state.skipUsesRemaining -= 1;
            // ticket 142: discard the current chaser-final question with no penalty.
            break;
        default:
            console.warn("applyChaserAbilityEffect: unhandled ability id", abilityId);
    }
}
