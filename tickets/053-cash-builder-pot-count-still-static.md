# 053: Cash builder — on-screen pot and correct-answer count still don't increase

## Goal
Ticket 048 was closed after only proving the server patches `cashBuilderMoney`/`cashBuilderCorrectAnswers` to both clients — commit `a5404a4` touches only `GOAL.md`, `server/test/cashBuilderFlow.test.ts`, and `tickets/README.md`, with **no client change**. User report: on the live app, answering correctly still leaves the on-screen pot and "X correct answers" count static during a cash builder. Make the pot and count visibly grow on every device.

## Scope
- Reproduce first against the current client (`server` dev + `client` dev, two browsers). The transport is **already proven good**: the ticket-048 regression test plus a live probe (real WebSocket, 2 SDK clients) both show `money 0→1000` / `count 0→1` patched to the active contestant **and** the bench spectator. If the browser stays static on a fresh `npm run dev` build, the broken link is in the Vue path below; if it actually renders correctly, report that finding with evidence instead of forcing a code change (treat "renders fine" as the exception that needs proof).
- `client/src/App.vue`:
  - `onStateChange` (`:97-106`) rebuilds `players.value = Array.from(newState.players.values())` each patch — confirm this re-triggers the computeds (`players` is reassigned, so `activeContestant` at `:56`, `activeContestantMoney` at `:60`, `activeContestantCorrectAnswers` at `:61` must re-evaluate against the patched player object).
  - Confirm the props actually flow: `:cashBuilderMoney` / `:cashBuilderCorrectAnswers` (`:269-270`) feed the screen.
- `client/src/screens/CashBuilderScreen.vue`:
  - `potText` (`:33`), `questionsLabel` (`:34-36`), the `cashBuilderMoney` watcher + `potFlash` (`:89-97`), and the pot/status markup in both the active (`:121-150`) and spectator (`:152-161`) branches.
- Fix whichever link is broken. **Keep the spectator question-gate intact** (`currentRoundQuestion` → spectators never see prompt/category — `App.vue:67-71`, plus the screen only renders the prompt in the `isActiveContestant` branch).
- No scope creep: wrong-answer behavior stays as-is (no increment, next question still arrives). `cashBuilderCorrectAnswers` is typed `uint16` (`server/src/rooms/schema/GameState.ts:10`) — fine below 65,535; no change unless testing exposes an issue.
- Optional/leave-notes: there is no Vue test harness installed for client-side regression tests — do NOT add one in this ticket; document the gap if you close without one.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` and `cd client && npm run build` pass.
- Live two-client check: active contestant answers correctly → pot increments by exactly $1000 and the "correct answers" label increments, with the pot flash, on BOTH the active player's and the spectators' screens within one state patch.
- Regression: spectators still never see the question prompt or category.
- If the defect is found in the Vue path, the fix is accompanied by a note in `tickets/README.md` (or the ticket repo convention) on how to re-verify manually, since there is no automated client test.

## Dependencies
- None. Absorbs the unfinished work of 048 (which closed without touching client code).