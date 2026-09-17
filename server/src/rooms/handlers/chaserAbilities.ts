import { randomInt } from "node:crypto";
import { GamePhase } from "../../TriviaTypes.js";
import { shuffle } from "../../questions/chaseOptions.js";

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
            const timingResult = chaseTimingGate(room);
            if (timingResult.ok === false) {
                return timingResult;
            }
            // ticket 156: chaseTimingGate only blocks use *after* an answer
            // lands (chaseAnswers non-empty) — it does not stop a second
            // activation on the same still-unanswered question. Without this,
            // a Chaser with multiple charges could narrow a question all the
            // way down to a single, obviously-correct option before anyone
            // answers. `chaseTimingGate` having returned ok guarantees
            // `room.currentChaseQuestion` is non-null here.
            if (room.currentChaseQuestion.fiftyFiftyUsedThisQuestion) {
                return { ok: false, reason: "50/50 has already been used on this chase question" };
            }
            return { ok: true };
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
            // ticket 142: `finalChaserQuestionResolved` alone isn't a
            // sufficient guard — if the question bank is exhausted mid-
            // ChaserFinal, advanceFinalChaserQuestion() leaves it `false`
            // (see finalRound.test.ts's "bank exhaustion" case) with no live
            // question object to actually discard. Require a real current
            // question too, so an exhausted bank can't let Skip "succeed"
            // with nothing behind it (flagged by the ticket-140 implementer).
            if (!room.finalRoundQuestions.getCurrentQuestion("chaser")) {
                return { ok: false, reason: "No live chaser-final question to skip (question bank exhausted)" };
            }
            return { ok: true };
        }
        default:
            return { ok: false, reason: `Unhandled ability: ${abilityId}` };
    }
}

/** The actual per-ability mutation. Ticket 140 wired the counter/flag
 * bookkeeping — decrementing the relevant uses-remaining counter, or setting
 * the relevant per-table-round/armed boolean. Ticket 141 wires the real
 * board-chase effects for the four abilities that fire mid-Chase (50/50,
 * Double Time's arming, Re-rack, Jumble); Double Time's actual board math
 * lives in `TriviaRoom.resolveChaseQuestion`, since it only applies once the
 * armed question resolves. Skip's chaser-final question-discard stays ticket
 * 142's scope. Assumes the caller already validated via `canUseAbility`. */
export function applyChaserAbilityEffect(room: any, abilityId: string): void {
    switch (abilityId) {
        case "fiftyFifty": {
            room.state.fiftyFiftyUsesRemaining -= 1;
            // Design choice (ticket 141): the contestant and the Chaser see
            // and answer the same shared chase question — there is no
            // per-recipient option split anywhere in
            // TriviaRoom.startNextChaseQuestion/submitChaseAnswer today — so
            // narrowing the options here is deliberately mutual-benefit and
            // double-edged: it makes the question easier for whichever side
            // needed the help *and* for the other side at the same instant.
            // That's one valid reading of "the Chaser plays a 50/50" (raise
            // their own odds at the cost of also helping the contestant
            // catch up). A future ticket could split per-recipient question
            // views to make this Chaser-only; that's out of scope here.
            const question = room.currentChaseQuestion;
            if (question) {
                // ticket 156: mark this question as spent for 50/50 the
                // instant it fires (regardless of whether the defensive
                // no-op below finds anything left to narrow) so
                // `canUseAbility` rejects a second activation before the
                // question resolves.
                question.fiftyFiftyUsedThisQuestion = true;
                const wrongIndexes: number[] = [];
                for (let index = 0; index < question.options.length; index += 1) {
                    if (index !== question.correctIndex) {
                        wrongIndexes.push(index);
                    }
                }
                // Nothing left to drop if a question is already down to just
                // the correct option (e.g. only 2 options to begin with).
                if (wrongIndexes.length > 0) {
                    const dropIndex = wrongIndexes[randomInt(wrongIndexes.length)];
                    question.options = question.options.filter((_: string, index: number) => index !== dropIndex);
                    question.correctIndex = question.correctIndex > dropIndex
                        ? question.correctIndex - 1
                        : question.correctIndex;
                    room.broadcastQuestion(
                        room.state.activeRound,
                        room.state.activeContestantSeatId,
                        "mc",
                        question.id,
                        question.prompt,
                        question.options
                    );
                    // ticket 157: the plain broadcast above carries no
                    // displayOrder, so a contestant already Jumbled on this
                    // question would otherwise have their shuffle silently
                    // overwritten with natural order the instant App.vue
                    // applies it. If Jumble is in effect, immediately follow
                    // up with a fresh permutation of the now-narrowed option
                    // indices via the same targeted send Jumble itself uses —
                    // the contestant's client processes this second, so their
                    // shuffle persists through the narrowing instead of
                    // reverting.
                    if (question.jumbleActive) {
                        const displayOrder = question.options.map((_: string, index: number) => index);
                        shuffle(displayOrder);
                        room.sendJumbledQuestionToContestant(displayOrder);
                    }
                }
            }
            break;
        }
        case "reRack":
            room.state.reRackUsedThisTableRound = true;
            // "Redraw now" via the exact same draw+broadcast path a normal
            // chase-question advance already uses — not a parallel path.
            room.startNextChaseQuestion().catch((error: unknown) => {
                console.error("Re-rack failed to draw the next chase question:", error);
            });
            break;
        case "jumble": {
            room.state.jumbleUsedThisTableRound = true;
            const question = room.currentChaseQuestion;
            if (question) {
                const displayOrder = question.options.map((_: string, index: number) => index);
                shuffle(displayOrder);
                // Targeted: only the active contestant's own client gets this
                // extra displayOrder hint. correctIndex/resolution never
                // reads it — see sendJumbledQuestionToContestant.
                room.sendJumbledQuestionToContestant(displayOrder);
                // ticket 157: remember a Jumble is now in effect for this
                // question so a later fiftyFifty narrowing can re-derive and
                // re-send a fresh displayOrder instead of silently dropping
                // it via its plain broadcastQuestion re-send.
                question.jumbleActive = true;
            }
            break;
        }
        case "doubleTime":
            room.state.doubleTimeUsedThisTableRound = true;
            room.state.doubleTimeArmed = true;
            // The board-math consumption lives in
            // TriviaRoom.resolveChaseQuestion, since it only applies once
            // the armed question actually resolves.
            break;
        case "skip":
            room.state.skipUsesRemaining -= 1;
            // ticket 142: discard the current chaser-final question with no
            // scoring consequence at all — no correct, no wrong, no steal
            // window opened — then draw the next one via the same path a
            // normal chaser-final advance already uses.
            room.advanceFinalChaserQuestion();
            break;
        default:
            console.warn("applyChaserAbilityEffect: unhandled ability id", abilityId);
    }
}
