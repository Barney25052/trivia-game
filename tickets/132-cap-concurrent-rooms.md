# 132: Cap concurrent `trivia` rooms server-wide

## Goal
`AGENTS.md`'s Security section calls for capping "active rooms and connections" — per-room `maxClients` (`ROOM_SETTINGS.max_clients`, `server/src/gameConfig.ts:155`) and per-connection message rate limiting (ticket 037) both exist; nothing yet bounds how many *rooms* can exist at once. An unauthenticated client can call `client.create("trivia", ...)` in a loop and spin up unbounded rooms, each holding a live game-flow instance, timers, and question-manager state.

## Scope
- `server/src/gameConfig.ts` — add `ROOM_SETTINGS.maxConcurrentRooms` (a tunable, no magic number in room code, per the architecture invariant).
- Track live room count and reject creation past the cap. Colyseus 0.17's `defineRoom` doesn't expose a built-in "max rooms" option, so this needs an explicit counter: increment on room creation (`onCreate`), decrement on disposal (`onDispose`), and reject a new room in `onCreate` (throw, per Colyseus's documented pattern for rejecting room creation) once the cap is hit. Keep the counter module-scoped in `TriviaRoom.ts` (or a small dedicated module if that reads cleaner) — this is a single-process app (PM2 `exec_mode: fork`, per `ecosystem.config.cjs`), so an in-memory counter is correct; don't build cross-process coordination that doesn't exist yet.
- Surface a clear client-facing error when rejected (the Colyseus SDK already turns an `onCreate` throw into a join/create error on the client) rather than a silent hang.

## Acceptance
- New test in `server/test/` (or an existing room-lifecycle test file) that creates `ROOM_SETTINGS.maxConcurrentRooms` rooms successfully, then asserts the next `createRoom("trivia", ...)` call is rejected; then disposes one room and confirms a new one is accepted again.
- `npm test` / `npm run build` (server) green.

## Dependencies
None.
