# 040: Client cash builder screen — question display, answer submission, pot display

## Goal
Replace the placeholder `CashBuilderScreen.vue` with a real screen: the active contestant sees the current question, types and submits an answer, and watches their pot grow. Spectators (every other player) see a waiting state showing who's playing and their running total. This completes the Phase 2 client work.

## Scope
- **Message listener** — `client/src/App.vue`:
  - Add `room.onMessage("question", ...)` handler that stores the current question payload (`{ questionId: number, prompt: string, category: string } | null`) in a reactive ref. The server broadcasts `null` when the timer expires or the bank is exhausted (see ticket 039). Note: for the open-ended cash builder the payload has **no `options`** — that field only appears for MC questions later.
  - Pass the question ref, the active contestant's `sessionId` (seat-id migration is ticket 034; the server still tracks the active contestant by `activeContestantSessionId` today — derive `isActiveContestant` by comparing that to the local player's `sessionId`), and the local player's identity down to `CashBuilderScreen`.
- **Screen rewrite** — `client/src/screens/CashBuilderScreen.vue`:
  - **Props**: `getReadyCooldownMs`, `currentQuestion` (the question payload or null), `isActiveContestant` (boolean — is this player the one playing?), `activeContestantName` (string), `cashBuilderMoney` (number, from synced state), `cashBuilderQuestionsAsked` (number, from synced state), `secondsLeft` (number — the timer, still computed client-side from the get-ready cooldown + cash-builder duration, or received from the server).
  - **Active contestant view** (`isActiveContestant === true`):
    - Show the category tag and question prompt.
    - Text input + Submit button. On submit: send `"submitAnswer"` with `{ answer: input value, questionId: currentQuestion.questionId }`. Clear the input after submit.
    - Disable the input/submit while the get-ready cooldown is active (before the first question arrives).
    - Show running pot total (`$X,XXX`, thousands-separated) and questions asked.
    - Show countdown timer (seconds remaining).
    - While waiting for the next question (between submits), show a brief "Checking…" / "Next question…" state.
  - **Spectator view** (`isActiveContestant === false`):
    - Show the active contestant's name + "… is playing" and their pot total + questions asked (pulled from synced state).
    - Show the countdown timer.
    - **No question text, no input.** The server gates the `question` publish by `targetSessionId`, and the client must never render the prompt/category for a non-active player.
  - **Empty/null question state**: when `currentQuestion` is null (timer expired or bank exhausted), show "Time's up!" and disable input.
- **Styling** — `client/src/style.css`:
  - Add classes: `.cashBuilder`, `.cashBuilderQuestion`, `.cashBuilderInput`, `.cashBuilderPot`, `.cashBuilderSpectator`, `.cashBuilderTimer` — all 4-space indent, kebab-case, one declaration per line, lowercase hex. Group them together.
  - Reuse existing patterns: gradient background, "Luckiest Guy" titles, `answerButton` styles for the Submit button.
  - Active vs spectator views are visually distinct — the spectator panel uses a dimmed/muted treatment (e.g. reduced opacity or a muted palette).
  - Small pot-increment feedback on a correct answer (e.g. a brief scale/fade flash on the pot total) for the "watch it grow" feel.
  - No `<style scoped>`, no inline `style=` unless truly necessary.
- **No server changes** — all wiring exists from ticket 039.

## Acceptance
- `cd server && npm test` passes (server untouched, must stay green).
- `cd server && npm run build` and `cd client && npm run build` pass (client build is the typecheck gate: `vue-tsc -b && vite build`).
- Active contestant sees questions, can type and submit answers, sees pot grow in real time (with a visible feedback flash on correct answers).
- Spectators see the active player's name, pot, and timer — but **NOT** the question text or category.
- Submitting an answer clears the input and shows a brief transition state before the next question.
- When the timer hits zero / bank is exhausted (`currentQuestion === null`), input is disabled and "Time's up!" appears.
- `CashBuilderScreen` has no `<style scoped>` — all styles live in `style.css`.

## Dependencies
- Depends on 039 (server sends `"question"` broadcasts and accepts `"submitAnswer"`).
- Revisit after 034 lands (seat-id player keying) if it changed client session-id handling — today, keep using `sessionId`.
