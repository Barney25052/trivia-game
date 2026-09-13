# 121: Cash Builder doesn't show the correct-answer text when the contestant gets it right (user report)

## Goal
User report (2026-09-13): "Correct answers aren't shown when they get the right answer" during the Cash Builder. Today, `client/src/screens/CashBuilderScreen.vue`'s `watch(() => props.answerResult, ...)` only sets `revealedCorrectAnswer` on a **wrong** answer (`if (!result.correct) revealedCorrectAnswer.value = result.correctAnswer;` per ticket 053's original implementation) — a correct answer only triggers the green screen flash, with no confirmation text of what the accepted answer actually was. For open-ended fuzzy-matched answers especially, a player who typed something slightly different from the canonical answer has no way to see what the system actually matched it to.

## Proposed direction
- On a correct answer, also show the correct-answer text briefly — e.g. a "✓ Correct: `<answer>`" line in the question area (reuse the existing reveal-text styling/placement used for the wrong case, just with correct framing/colour instead of the danger one), auto-clearing on the same cadence the correct flash already uses (or whenever the next question arrives, whichever reads better once it's on screen).
- Don't change any server messages — `answerResult` already carries `correctAnswer` on every response (check `server/src/rooms/handlers/messageHandlers.ts`'s `submitAnswer` to confirm it's sent on both outcomes, not just wrong, before assuming a server change is needed).
- Keep the existing green-flash timing/behavior as-is; this adds a text confirmation alongside it, not a replacement.

## Scope
- `client/src/screens/CashBuilderScreen.vue`, `client/src/style.css` if a new "correct reveal" class is needed (or reuse/adapt the existing wrong-reveal one with a modifier).
- Not in scope: the Chase screen (already highlights the correct MC option green on reveal, per ticket 089 — that gap is already closed), server changes.

## Acceptance
- Manual: answer a Cash Builder question correctly — the correct-answer text is visible on screen for a beat (own client and spectators), not just a colour flash; answering wrong still shows the existing "Correct answer: …" reveal unchanged.
- `cd client && npm run build` passes; `cd server` tests/build stay green (no server changes expected).

## Dependencies
- None.
