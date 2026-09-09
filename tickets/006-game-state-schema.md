# 006: New asymmetric game state schema

## Goal

Replace the old 5-question `QuizState` with a schema that models the whole asymmetric game.

## Scope

- New `server/src/rooms/schema/GameState.ts` defining Colyseus `@type()` schema classes. Suggested shape (adjust as design dictates):
  - `GamePlayer`: `name`, `sessionId`, `role` (contestant/chaser), `cashBuilderMoney`, `boardPos`, `isEliminated`, `madeItBack`, `isHost`, `score` (final-round contribution).
  - `GameState`: `players` map, `currentPhase` (GamePhase), `chaserSessionId`, `chaserPot`, `teamPot`, `activeContestantSessionId`, `activeRound`, `teamScore` (final round), plus a `contestantsOrder` array if needed.
  - Keep `Question` classes from `MyRoomState.ts` for the chase (reuse or move them).
- In `server/src/rooms/MyRoom.ts`: swap `state = new QuizState()` → `state = new GameState()` and update `onJoin` to add a `GamePlayer` (role defaults to contestant; chaser assignment is Phase 1).
- Delete or stop using the old `QuizState` / template `MyRoomState.mySynchronizedProperty`.
- Tests in `server/test/gameState.test.ts`: default values are correct; a player added via `onJoin` is a contestant.

## Acceptance

- `cd server && npm test` passes (including a boot/test of the room state after join).
- `cd server && npm run build` passes.

## Dependencies

001, 002.