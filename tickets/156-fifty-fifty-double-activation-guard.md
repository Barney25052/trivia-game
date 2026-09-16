# 156: Close the 50/50 double-activation gap on a single board-chase question

## Goal
Ticket 141 wired 50/50's real effect (remove one random wrong option, re-broadcast the narrowed question), guarded by ticket 140's `canUseAbility` gate: `Object.keys(room.chaseAnswers).length === 0` (nobody has answered the current question yet). That gate blocks 50/50 *after* an answer lands, but not a **second or third activation on the same still-unanswered question** — a Chaser with multiple charges (4/game) can currently spend 2+ of them back-to-back on one question, narrowing a 3-option question down to a single, obviously-correct option before anyone answers. Found and flagged (not fixed) during ticket 141's implementation.

## Scope
- `server/src/rooms/handlers/chaserAbilities.ts` (`canUseAbility`'s `fiftyFifty` gate, or `applyChaserAbilityEffect`'s `fiftyFifty` case — whichever reads cleaner) — add a per-question "already used" guard: 50/50 should be usable **at most once per board-chase question**, not just gated on "nobody's answered yet." A question narrowed from 3 options to 2 has nothing left to remove a *wrong* option from without leaving exactly one (defensive no-op territory ticket 141 already added for that edge) — but the real fix is preventing the second activation from ever being attempted in the first place, not just handling it gracefully once it happens.
- Track this with the same per-question-scoped pattern the codebase already uses elsewhere (e.g. how `chaseAnswers` itself is reset per question) — a boolean on the current chase-question state (or reuse/extend `ActiveChaseQuestion` from ticket 141) that resets whenever a new question is drawn (`startNextChaseQuestion`, Re-rack's redraw) and gets set the first time 50/50 fires.
- Keep the existing defensive no-op (skip narrowing if no wrong options remain, don't throw) as a belt-and-suspenders backstop even after this fix — a good defensive habit, not something to remove.

## Acceptance
- New test: activating 50/50 twice on the same unanswered question is rejected the second time (the charge is not spent, the question stays at 2 options, not narrowed to 1).
- Existing ticket 140/141 tests for 50/50's other gates (chaseAnswers-non-empty, uses-remaining, ownership) still pass unchanged.
- `cd server && npm test && npm run build` green.

## Dependencies
141 (done) — this is its direct follow-up, found during that ticket's own implementation.
