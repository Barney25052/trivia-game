# 048: Cash builder — pot/score doesn't visibly increase during the round

## Goal
During a contestant's cash builder, a correct answer should visibly grow the pot on every device. Report: the on-screen pot stays static while the round runs, even though the server-side increment is verified by tests (`server/test/cashBuilderFlow.test.ts`, `server/test/cashBuilder.test.ts`). The sync/render path is the suspect, not the increment.

## Scope
- `client/src/App.vue` and `client/src/screens/CashBuilderScreen.vue`:
  - Verify the money actually patches to clients: the server increments `cashBuilderMoney` on correct answers (`server/src/rooms/handlers/messageHandlers.ts:179-182`) and tests assert it — confirm `room.onStateChange` (`client/src/App.vue:89-97`) re-applies the players array and that `activeContestantMoney` (`client/src/App.vue:53-60`) re-reads the patched player.
  - Check the render path in `CashBuilderScreen.vue`: `potText` (`:33`), the `cashBuilderMoney` watcher + `potFlash` (`:89-97`), and the on-screen pot/financial display built from the `cashBuilderMoney`/`cashBuilderQuestionsAsked` props (`CashBuilderScreen.vue` props + template).
  - Fix whichever link is broken (state subscription, computed, prop, or screen render). Keep the spectator question-gate intact (`currentRoundQuestion`, `App.vue:64-68`).
- If the report is actually about the "questions answered" label not moving, cross-reference ticket 043 (the counter only increments on correct answers and is misnamed) — decide with 043 whether 048 covers the pot only.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` and `cd client && npm run build` pass.
- Live check (two browsers, or a server test + manual client): active contestant answers correctly → the pot increments and flashes on the active player's screen and the spectators' screens within one state patch.
- No regression: spectators still never see the question prompt/category.

## Dependencies
- None. May overlap with 043 (counter naming) — co-ordinate if both touch the screen's money/counter props.