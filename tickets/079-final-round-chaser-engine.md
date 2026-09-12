# 079: Final round — Chaser answer engine, steal/push-back, and win/lose (server)

## Goal
Make the Chaser's 2-minute round a real race with win/lose resolution. Add `chaserScore` to state, a `submitFinalChaserAnswer` handler (correct → +1, immediate win when `chaserScore >= teamScore`; wrong → the team gets a steal chance to push the Chaser back one), wire the steal window, and remove the placeholder self-report `finalChaserScore` handler (currently a button that instantly wins — `messageHandlers.ts:276-287`).

## Scope
- `server/src/rooms/schema/GameState.ts`: add `@type("number") chaserScore: number = 0;` beside `teamScore` (line 31). Scores are synced, not secret.
- `server/src/gameConfig.ts` `FINAL_ROUND`: add `stealWindowMs` (default 5000, min/max clamp fields consistent with the other durations) — consumed and clamped in `clampOptions.ts`.
- Replace `finalChaserScore` (`messageHandlers.ts:276-287` + its `TriviaRoom.ts:330-333` registration) with `submitFinalChaserAnswer` (`{ questionId, answer }`), guarded: phase `ChaserFinal`, seat is the Chaser, shape valid, `questionId` matches the current Chaser question, once per question.
  - **Correct** → `chaserScore + 1`; if `chaserScore >= teamScore` dispatch `finalChaserReachedScore` (→ `GameEnd`, winner chaser — ties count as the Chaser reaching the team, per "reaches/passes"). Otherwise advance the Chaser stream (077).
  - **Wrong** → steal: send the **team** seats a `finalSteal` message (`{ questionId, prompt, windowMs }` — the same prompt the Chaser just missed, never the answer), start a `stealWindowMs` timer. Any non-chaser may send `submitFinalStealAnswer` (`{ questionId, answer }`): correct → `chaserScore = max(0, chaserScore - 1)` (push-back floor at 0) and the Chaser advances; wrong or window expiry → no push-back, Chaser advances. Only one steal outcome per question.
  - Correct-answer reveal on the Chaser's miss: reuse the `answerResult` shape to the steal submitter, or a lightweight `finalStealResolved { pushedBack }` broadcast to the team so 081 can render the outcome. Keep the expected answer off the wire until the resolve moment.
- Timer paths unchanged: `finalChaserTimeout` → `GameEnd` winner team (already wired in gameFlow/effects). `endGame { winner }` broadcast already exists (`effects.ts:235`).
- Delete the dead placeholder: `finalChaserScore` from `messageHandlers.ts`, its registration row, and its `client/src/App.vue:420` `sendFinalChaserScore` stub + the stub button in `ChaserFinalScreen.vue` (the latter is 081's job — note the shared removal).
- Pure `gameFlow` wins: the win/lose transitions are already unit-tested; this ticket adds the state/flow wiring and the steal mechanics only.

## Acceptance
- New `server/test/finalRound.test.ts` (extend 077/078's file):
  - Chaser correct answer → `chaserScore + 1`; reaching exactly `teamScore` (tie) ends the game with winner "chaser"; a chaser answer below the target just advances.
  - Chaser wrong answer → team receives `finalSteal` with the prompt and **no answer**; a correct steal → `chaserScore - 1`, floored at 0 (no negatives); an incorrect or timed-out steal → no push-back.
  - Only the Chaser can `submitFinalChaserAnswer`; only non-chasers can `submitFinalStealAnswer`; malformed/stale/out-of-phase submissions are rejected.
  - `finalChaserTimeout` still ends the game winner "team".
  - Grep shows no remaining reference to `finalChaserScore` in `server/src` (client removal tracked in 081).
- `cd server && npm test` green; `cd server && npm run build`.

## Dependencies
- 077 (the Chaser stream + `finalQuestion` delivery). 078 (team `submitFinalAnswer`) sits on the same stream but is server-independent of this handler.