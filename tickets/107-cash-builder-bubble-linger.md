# 107: Cash Builder speech bubble doesn't stay up long enough (user report)

## Goal
Ticket 099 gave the Team Final's and Chaser Final steal-table's submitted-answer bubbles a guaranteed minimum ~3s life, independent of when the next question arrives, but explicitly left the Cash Builder's own bubble out of scope, noting it "has the same pattern — out of scope here; note it for a later ticket if it bothers anyone." The user has now reported exactly that: the Cash Builder bubble clears too fast to read.

## Root cause (same family as 099)
`client/src/screens/CashBuilderScreen.vue`: `bubbleText` is cleared inside the `watch(() => props.currentQuestion, ...)` handler the instant the next question arrives (~line 111), same as `TeamFinalScreen.vue`'s bubble was before 099. On a correct answer the next question can arrive near-instantly, giving the bubble ~0ms of visible life.

## Proposed direction
- Apply the exact same fix 099 already proved out: give `bubbleText` its own minimum-life timer (reuse the `ANSWER_BUBBLE_HOLD_MS` constant/value already established in `TeamFinalScreen.vue`/`ChaserFinalScreen.vue` for consistency, ~3000ms), cleared and restarted on every new submission, and no longer cleared by the `currentQuestion` watcher.
- A newer submission re-keys the bubble and restarts the timer cleanly, same as 099's Team Final fix (no leaked/stacked timers).
- style.css only if needed — this should be pure timing logic in `CashBuilderScreen.vue`, mirroring 099's approach almost exactly.

## Scope
- `client/src/screens/CashBuilderScreen.vue` only.
- Not in scope: server changes, the Team/Chaser Final bubbles (099 already covers them), the stale-question bleed issue (separate ticket).

## Acceptance
- Manual: answer correctly in the Cash Builder in a fast chain (so the next question arrives almost immediately) — the bubble is now visibly readable for ~3s before clearing; answering again re-keys it cleanly with no stuck/duplicated bubbles.
- `cd client && npm run build` passes.

## Dependencies
- None (099 already established the pattern to copy).
