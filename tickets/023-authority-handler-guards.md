# 023: Authority + phase guards on the offer/chase/final handlers

## Goal

No client can drive the state machine through the not-yet-wired handlers. `offerChoice`, `chaseResult`, and `finalChaserScore` are currently unguarded — any player can fire them from any phase (e.g. a contestant sending `chaseResult` from the lobby forces a `chaseEscape`/`chaseCaught` transition). AGENTS.md requires message handlers be **authoritative and role-checked**.

## Scope

- `server/src/rooms/TriviaRoom.ts` messages (reject + log, matching the existing handler style):
  - `offerChoice`: sender must be the active contestant (`activeContestantSessionId`) **and** phase must be `GamePhase.Offer`.
  - `chaseResult`: phase must be `GamePhase.Chase`. Both sides answer in the real chase, but today this is a placeholder — gate the sender to the active contestant for now; revisit when the Chaser answers live (Phase 4).
  - `finalChaserScore`: sender must be the Chaser (`chaserSessionId`) **and** phase must be `GamePhase.ChaserFinal`.
- Tests in `server/test/roomFlow.test.ts` (stub pattern) covering each rejected path (wrong sender, wrong phase) leaves `room.state` unchanged, and the legit path still transitions.
- Do **NOT** touch `gameFlow.ts` or any phase logic.

## Acceptance

- `cd server && npm test` — green (new rejection cases)
- `cd server && npm run build` — clean
- `chaseResult` from the lobby, `offerChoice` by a non-active player, `finalChaserScore` by a contestant / outside ChaserFinal: rejected + logged, no transition

## Dependencies

- None. If run in parallel with 021/024 (both touch `TriviaRoom.ts`), merge after 021.