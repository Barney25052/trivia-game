# 007: Pure game-flow state transition function

## Goal

The phase machine as a **pure function** (no sockets) so transitions are unit-testable.

## Scope

- New `server/src/gameFlow.ts`: given a current phase + event + context, return the next phase and any required side-effects list, e.g.:
  - `lobby + startGame` → `cashBuilder` (for first contestant)
  - `cashBuilder + timeout` → `offer`
  - `offer + contestantChoice` → chase with chosen start space (4/5/6)
  - `chase + escape` → next contestant's `cashBuilder` (or `finalTeam` if none left)
  - `chase + caught` → contestant out → next contestant / `finalTeam`
  - `finalTeam + timeout` → `finalChaser`
  - `finalChaser + reachedScore` → `gameEnd` (chaser wins) ; `finalChaser + timeout` → `gameEnd` (team wins)
- Extend `GamePhase` (both server + client copies of `TriviaTypes.ts` — keep identical) with the new phases this needs (e.g. cashBuilder, offer, chase, finalTeam, finalChaser).
- Tests in `server/test/gameFlow.test.ts` covering each transition above, including the multi-contestant loop and all end states.

## Acceptance

- `cd server && npm test` passes (all transitions exercised).
- `cd server && npm run build` passes.
- `GamePhase` is still identical in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts`.

## Dependencies

002.