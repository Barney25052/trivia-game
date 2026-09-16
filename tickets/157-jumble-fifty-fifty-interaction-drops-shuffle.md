# 157: Jumble's shuffled order silently reverts if 50/50 is used on the same question

## Goal
When the Chaser uses Jumble (Maggie) on a board-chase question and then uses 50/50 (shared) on that same still-unanswered question — both legal individually, and nothing currently stops using both on one question — the contestant's shuffled button order silently reverts to natural order. Not a scoring bug (the client falls back safely to natural-order index mapping, so clicks still resolve correctly), but a UX inconsistency: the "Shuffled!" badge/layout the contestant was just given disappears with no explanation. Found via code trace (not live-reproduced) during ticket 146's implementation.

## Root cause
`server/src/rooms/handlers/chaserAbilities.ts`'s `fiftyFifty` case calls `room.broadcastQuestion(...)` unconditionally, which re-sends a plain `"question"` message with no `displayOrder` field to **every** client, including a contestant who was already jumbled on that same question. `App.vue`'s `applyQuestion` replaces `currentQuestion` wholesale, so this overwrites (drops) the contestant's `displayOrder`. `ChaseScreen.vue`'s `renderedOptions` computed (ticket 146) guards on `displayOrder.length === options.length` and falls back to natural order when it doesn't match — which is why this is silent rather than broken, but it does mean the contestant's answer layout changes mid-question with no cue.

## Scope
- `server/src/rooms/handlers/chaserAbilities.ts` (the `fiftyFifty` case) — when re-broadcasting the narrowed question after 50/50, if the current question already has a jumble in effect for the active contestant, either (a) re-derive and re-send a valid `displayOrder` for the narrowed option set (preferred — keeps the "shuffled" experience intact through the narrowing) or (b) explicitly clear/re-target the jumble state so the contestant's client can show a clear "order reset" cue instead of a silent revert. Pick whichever reads better and is simpler given the actual code shape — this is a small, contained fix.
- `client/src/screens/ChaseScreen.vue` — if going with option (a), no client change should be needed (the existing `displayOrder` consumption already works); if (b), the "Shuffled!" badge/logic may need a companion "no longer shuffled" moment.

## Acceptance
- Reproduce first: as a Maggie Chaser, use Jumble on a live chase question, then use 50/50 on that same question before anyone answers — confirm today's behavior (silent revert to natural order) before your fix.
- After the fix: either the shuffle persists correctly through the narrowing, or the revert is clearly communicated to the contestant — no silent, unexplained layout change.
- A new test covering this interaction (both abilities on one question, in either order) confirming the contestant's `displayOrder` (or its absence) behaves as decided above.
- `cd server && npm test && npm run build` and `cd client && npm run build` green.

## Dependencies
141, 146 (done) — this is a follow-up interaction bug between abilities both of those tickets shipped.
