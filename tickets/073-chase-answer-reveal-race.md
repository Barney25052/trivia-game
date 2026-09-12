# 073: Chase correct/wrong answer reveal never actually renders (raced out by the next question)

## Goal
Ticket 065 built the reveal — once both sides have answered, `resultForCurrentQuestion` (`client/src/screens/ChaseScreen.vue:93-97`) should highlight the correct option green and a wrong pick red (`chaseOptionButton-correct` / `-wrong`, `ChaseScreen.vue:163-167`). In practice this never has a chance to render: on a **non-terminal** round, the server broadcasts `chaseQuestionResult` and then, in the very same synchronous call, immediately draws and broadcasts the *next* `question` (`server/src/rooms/TriviaRoom.ts:200-253`, `resolveChaseQuestion()` → `this.startNextChaseQuestion()` at line 250). Client-side, the `question` handler (`client/src/App.vue:194-197`) sets `currentQuestion.value` to the new question and immediately nulls `chaseQuestionResult.value` — so by the time Vue would paint a frame, `resultForCurrentQuestion` already sees a `currentQuestion` that isn't the one the result was for, and the reveal condition (`ChaseScreen.vue:98`, `revealed`) never renders. This mirrors the same pattern ticket 065 already had to solve for the *terminal* catch/escape case (`App.vue`'s `chaseResultHoldTimeout` hold) — it just wasn't applied to ordinary (non-terminal) rounds.

## Scope
- `client/src/App.vue`: extend the existing hold pattern (currently only triggered for a terminal `escaped`/`caught` result, see the `chaseQuestionResult` handler) to **every** chase result — buffer the incoming `question` message for a short, fixed reveal delay (e.g. 1.5–2s, get the exact duration confirmed with the user — this is a UI-timing detail, not a new screen, but worth a quick check) whenever a `chaseQuestionResult` for the *current* question just arrived, then apply the buffered `question` once the delay elapses. This is the same shape as the terminal-result hold, just shorter and unconditional instead of gated on escape/caught.
- Make sure the existing terminal-result hold (2.5s, escape/caught banner) and this new non-terminal reveal hold don't fight each other — a terminal result should just go straight to its own (longer) hold, not double up.
- No server changes — the server's behavior (resolve then immediately advance) is correct and expected; this is purely a client-side timing fix so the reveal is actually visible before the next question replaces it.

## Acceptance
- Manual 2-browser check: after both sides answer a non-terminal chase question, the correct option visibly highlights green (and a wrong pick highlights red) for a beat before the next question appears — for both the contestant and the Chaser.
- `cd client && npm run build` passes.

## Dependencies
- Builds on ticket 065 (`ChaseScreen.vue` reveal styling, `App.vue`'s existing terminal-result hold).
