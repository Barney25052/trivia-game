# 040: Client cash builder screen — question display, answer submission, pot display

## Goal
Replace the placeholder `CashBuilderScreen.vue` with a real screen: the active contestant sees the current question, types and submits an answer, and watches their pot grow. Spectators (every other player) see a waiting state showing who's playing and their running total. This completes the Phase 2 client work.

## Scope
- **Message listener** — `client/src/App.vue`:
  - Add `onMessage("question", ...)` handler that stores the current question payload (`{ questionId, prompt, category } | null`) in a reactive ref.
  - Pass the question ref, the active contestant's seatId (or sessionId if 034 hasn't landed), and the local player's identity info down to `CashBuilderScreen`.
- **Screen rewrite** — `client/src/screens/CashBuilderScreen.vue`:
  - **Props**: `getReadyCooldownMs`, `currentQuestion` (the question payload or null), `isActiveContestant` (boolean — is this player the one playing?), `activeContestantName` (string), `cashBuilderMoney` (number, from synced state), `cashBuilderQuestionsAsked` (number, from synced state), `secondsLeft` (number — the timer, still computed client-side from the getReady cooldown + cashBuilder duration, or received from the server).
  - **Active contestant view** (`isActiveContestant === true`):
    - Show the question prompt and category.
    - Text input + Submit button. On submit: send `"submitAnswer"` message with `{ answer: input value, questionId: currentQuestion.questionId }`. Clear the input after submit.
    - Disable the input/submit while the getReady cooldown is active (before the first question arrives).
    - Show running pot total (`$X,XXX`) and questions asked count.
    - Show countdown timer (seconds remaining).
    - While waiting for the next question (between submits), show a brief "Checking..." or "Next question..." state.
  - **Spectator view** (`isActiveContestant === false`):
    - Show the active contestant's name and a "playing..." message.
    - Show their pot total and questions asked (pulled from synced state).
    - Show the countdown timer.
    - No input, no question text (spectators should NOT see the questions).
  - **Empty/null question state**: when `currentQuestion` is null (timer expired or bank exhausted), show "Time's up!" or similar and disable input.
- **Styling** — `client/src/style.css`:
  - Add minimal classes for the cash builder layout: `.cashBuilder`, `.cashBuilderQuestion`, `.cashBuilderInput`, `.cashBuilderPot`, `.cashBuilderSpectator`.
  - Reuse existing patterns (the gradient background, Luckiest Guy font, button styles from `answerButton`).
  - Active vs spectator views can be visually distinct (e.g. spectator has a dimmed/muted treatment).
- **No server changes** — all wiring exists from ticket 039.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- Active contestant sees questions, can type and submit answers, sees pot grow in real time.
- Spectators see the active player's name, pot, and timer — but NOT the question text.
- Submitting an answer clears the input and shows a brief transition before the next question.
- When the timer hits zero, input is disabled and a "Time's up!" message appears.
- `CashBuilderScreen` has no `<style scoped>` — all styles in `style.css`.

## Dependencies
- Depends on 039 (server sends `"question"` broadcasts and accepts `"submitAnswer"`).
