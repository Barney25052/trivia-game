# 029: Move maxClients and stray debug log into config/cleanup

## Goal
Two small room-code blemishes that violate the "no magic numbers in room code" and "no secrets/sloppy logs" conventions, cheap to fix now while the room is small:

- `TriviaRoom.ts:26` — `maxClients = 4` is a magic number with no config or comment. The 4-player table size is also a real design assumption (one chaser + up to 3 contestants) that the dead-player/ghost/spectator stretch goals may want to change. Put it in `gameConfig` so it's tunable and discoverable.
- `TriviaRoom.ts:457` — `console.log(options)` dumps the raw join options object. Today options only carry `playerName`, but it's a debug leftover that would triage PII/secret fields the moment a future join option grows (e.g. avatarId). Remove it, or log a fixed/trimmed field.

## Scope
- `server/src/gameConfig.ts`: add a `ROOM` (or `TABLE`) config with `maxClients`, e.g. `{ maxClients: 4 }`.
- `server/src/rooms/TriviaRoom.ts`: `maxClients = ROOM.maxClients`; delete the `console.log(options)` line at 457.
- Grep confirms no other raw join-option logging.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- `TriviaRoom.ts` references `ROOM.maxClients` (or equivalent), not a literal `4`.
- No `console.log(options)` (or raw options dump) remains.

## Dependencies
- None.