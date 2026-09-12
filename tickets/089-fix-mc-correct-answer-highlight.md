# 089: Bug — correct multiple-choice answer never highlights on the chase reveal

## Goal
When a chase question resolves, the correct option should flash green (and a wrong picked option red) for the reveal beat. On-screen the correct answer is **not** getting highlighted, despite the reveal classes (`chaseOptionButton-correct`/`-wrong`) and the ticket 073 reveal-hold mechanism both existing.

## Scope
- Trace the reveal path end to end and find why the highlight doesn't render:
  - Server broadcasts `chaseQuestionResult` with `correctIndex` + `questionId` (`server/src/rooms/TriviaRoom.ts` ~line 232).
  - `App.vue` buffers the next `"question"` behind `CHASE_REVEAL_HOLD_MS` (1500ms) and clears `chaseQuestionResult` when it applies (`App.vue` ~line 236–293).
  - `ChaseScreen.vue` gates `chaseOptionButton-correct`/`-wrong` on `revealed` = `chaseQuestionResult` whose `questionId` matches `currentQuestion.questionId`.
- Candidates to check: the result's `questionId` never matching the client's `currentQuestion.questionId` (payload field vs the `"question"` message's field); `applyQuestion` clearing `chaseQuestionResult` before the reveal paints; the `:disabled` + `opacity: 0.6` styling masking the green; the class landing on the wrong button. Fix the actual cause and keep the reveal beat holding the next question long enough to be seen.
- No Vue test harness exists — verify manually with two clients; keep the server-side Phase 4 coverage of the `chaseQuestionResult` payload intact (confirm `correctIndex` is present there as part of the ticket if useful).

## Acceptance
- Manual (two browser clients through a chase): after a question resolves (both sides answer or the 5s lockout expires) the correct option visibly highlights green and a wrong picked option red for the reveal beat on every client, then the next question arrives.
- `cd client && npm run build` passes; `cd server && npm test` green.

## Dependencies
- 073 (the reveal hold). Coordinate with 085/087 — they touch the same classes/panel.