# 099: Client — player answer speech bubbles don't stay up long enough — UI SIGN-OFF REQUIRED

## Goal
A correct team-final answer clears the submitter's speech bubble the instant the next question arrives (`TeamFinalScreen.vue`, watch on `finalQuestion` resets `bubbleText`), so on fast correct chains the bubble flashes for ~0ms and the player never reads it. Give submitted-answer bubbles a guaranteed minimum display time.

## Proposed direction (for sign-off)
- Give each submitted-answer bubble a **minimum ~3s life independent of the next question** instead of clearing on `finalQuestion`.
  - On **correct** answers the next question arrives instantly (server `advanceFinalTeamQuestion()` is immediate) — currently that's what kills the bubble. Clear it on a local timer, not on the message.
  - On **wrong** answers keep the existing read window (the reveal holds anyway).
  - A newer submission on the same or another seat re-keys the bubble and restarts the timer (bubbles never accumulate).
- Applies to: the Team Final's own-seat bubble (`teamFinalBubble`) and the steal-table bubbles (096) on the Chaser Final. The cash-builder bubble (`CashBuilderScreen.vue`) has the same pattern — out of scope here; note it for a later ticket if it bothers anyone.
- style.css only if the pop-out or fade needs a longer easing — otherwise pure timing logic in the screens.

## Scope
- `client/src/screens/TeamFinalScreen.vue`, `client/src/screens/ChaserFinalScreen.vue` (096's bubble), `client/src/style.css` if needed.
- Not in scope: the Chaser's own bubble (098), server timing.

## Acceptance
- Manual: team answers correctly (instant next question) → the bubble still pops and stays ~3s on their seat before the flow moves on; answering again re-keys it cleanly.
- `cd client && npm run build` passes.

## Dependencies
- 096 for the Chaser-Final steal bubbles (can be done independently for the Team Final first).