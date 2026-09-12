# 078: Final round — team answers (server)

## Goal
Make the team's 2-minute group round actually score points: a `submitFinalAnswer` message that guards phase/role/shape, checks the team's current question leniently (reuse `checkAnswer`), bumps `teamScore` on a correct answer, and advances the team stream from 077. Everyone on the team answers as a group — including eliminated players, who rejoin for this round per the rules.

## Scope
- `server/src/rooms/handlers/messageHandlers.ts` + `TriviaRoom.ts` messages map: add `submitFinalAnswer` (`{ questionId, answer }`), registered through the existing `checkRateLimit` wrapper like the others.
- Guards (authoritative, mirror `submitAnswer` at `messageHandlers.ts:303-351`):
  - Phase must be `GamePhase.TeamFinal`.
  - Sender must be a non-chaser seat (`seatId` present and `!== chaserSeatId`) — every contestant, active/waiting/eliminated, may answer.
  - Shape: `questionId` string, `answer` non-empty string (capped length via existing name/answer limits — reuse the `PLAYER_NAME.maxLength`-style cap or an `ANSWER` cap from `gameConfig`).
  - `questionId` must match the current team question (tracked server-side in a `currentFinalTeamQuestion` alongside the 077 stream, mirroring `currentChaseQuestion`).
- **Group resolution model**: the first submitted answer for the current team question resolves it (any non-chaser's submission closes the question) — correct → `teamScore + 1`, wrong → no change. Either way the team stream advances to the next question (or `null` on exhaustion). A second submission for the same question is rejected. This matches the cash-builder's no-penalty advance while letting a group share one question at a time.
- Reveal: reuse the cash-builder `answerResult` message (`{ correct, correctAnswer }`, `messageHandlers.ts:334`) sent to the submitting client only, so 080 can flash correct/wrong with the right answer on a miss.
- Never broadcast the expected answer; `teamScore` is synced in state (scores are not secret).
- No changes to gameFlow (transitions `finalTeamTimeout → ChaserFinal` already exist).

## Acceptance
- New `server/test/finalRound.test.ts` (or extend `finalRound.test.ts` from 077):
  - Correct `submitFinalAnswer` → `teamScore + 1` and the next `finalQuestion` arrives for the team.
  - Wrong answer → `teamScore` unchanged, stream still advances.
  - A second submission for the same question is rejected (only the first counts).
  - An **eliminated** contestant can answer and it counts.
  - The **Chaser** sending `submitFinalAnswer` is rejected.
  - `submitFinalAnswer` outside `TeamFinal`, with a malformed payload, or with a stale `questionId` is rejected.
  - `answerResult` carries the correct answer text to the submitter on a wrong answer.
- `cd server && npm test` green; `cd server && npm run build`.

## Dependencies
- 077 (the team stream + `finalQuestion` delivery to non-chasers). 078's handler is the counterpart that 080's screen consumes.