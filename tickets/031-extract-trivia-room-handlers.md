# 031: Extract TriviaRoom handler dispatch into a handlers module

## Goal
`TriviaRoom.ts` is ~477 lines and growing — handler dispatch, effect application, chaser-selection helpers, reveal-ready logic, and message handlers all live in one file. As Phase 2–5 add real question handling, chase logic, and final-round scoring, the file will balloon further. Extract handler logic into a dedicated `handlers/` module so the room stays a thin orchestrator (lifecycle, timers, state) while handlers are isolated, testable units.

## Scope
- Create `server/src/rooms/handlers/` directory.
- Move each `onMessage` handler (startGame, chaserVote, readyUp, offerChoice, etc.) into its own file under `handlers/`, exported as a function that takes `(room, client, payload)` and returns void (or a result the room acts on).
- Move chaser-selection helpers (`pickRandomChaser`, resolveVote, etc.) into `handlers/chaserSelection.ts`.
- Move effect-application logic (the `applyEffects` switch or equivalent) into `handlers/effects.ts`.
- `TriviaRoom.ts` keeps: `onCreate`, `onJoin`, `onLeave`, `onDispose`, timer scheduling, and a thin dispatch that calls into the handlers module.
- No behaviour changes — pure refactor. All existing tests must continue to pass.

## Acceptance
- `cd server && npm test` passes (no regressions).
- `cd server && npm run build` passes.
- `TriviaRoom.ts` is under 200 lines (handlers + effects + chaser-selection helpers extracted).
- Each handler file is independently readable and has a clear single responsibility.

## Dependencies
- None. Can be done at any point; recommended before Phase 2 lands new handlers.
