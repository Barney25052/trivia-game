# 043: Rename `cashBuilderQuestionsAsked` to match what it counts (correct answers)

## Goal
`cashBuilderQuestionsAsked` is synced to every client and shown as "questions answered", but it increments **only on correct answers** (`messageHandlers.ts:181`) — a player who answered 20 questions and got 5 right sees "5 questions answered", and spectators see the same. The name and the UI both lie. Rename to a truthful "correct count" and update the label.

## Scope
- `server/src/rooms/schema/GameState.ts:11` — rename the field to `cashBuilderCorrectAnswers` (uint16).
- `server/src/rooms/handlers/messageHandlers.ts:181` — update the increment to the new name.
- `client/src/App.vue` (`activeContestantQuestionsAsked`), `client/src/screens/CashBuilderScreen.vue` (prop + label) — mirror the rename; label reads e.g. "N correct answers" for both the active and spectator views.
- Tests: `server/test/cashBuilder.test.ts`, `server/test/cashBuilderFlow.test.ts` — update the field references.
- Grep the whole repo for `cashBuilderQuestionsAsked` / `QuestionsAsked` and confirm no stragglers (no-cruft rule).

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` and `cd client && npm run build` pass.
- The synced field is named `cashBuilderCorrectAnswers`; the client label no longer implies total questions asked.
- Grep for the old name returns nothing.