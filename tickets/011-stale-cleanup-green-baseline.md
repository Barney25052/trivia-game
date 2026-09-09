# 011: Stale test/loadtest cleanup + green baseline

> Updated after 001–006: `server/test/MyRoom.test.ts` was **already deleted in ticket 002** (it failed on `my_room` and would not compile once `QuizState`/`MyRoomState` were gone in 006). `npm test` is green today via `gameConfig`/`timer`/`bank`/`gameState` tests (20 passing). The one stale `my_room` reference left is the loadtest script — see scope below.

## Goal

A clean checkout is green end-to-end; remove template landmines.

## Scope

- ~~`server/test/MyRoom.test.ts` references room `my_room` and `MyRoomState.mySynchronizedProperty` — neither exists. Reduce to a boot smoke test (join room `trivia`, two clients, assert state sync), or delete it, or port it.~~ **Done in ticket 002** — room behavior is covered by `timer.test.ts` and `gameState.test.ts` boot tests; do not recreate this file.
- `server/loadtest/example.ts` + `npm run loadtest` reference `my_room`; point the script at room `trivia` (or remove the script if it stays useless). The script itself is generic (`client.joinOrCreate(options.roomName, …)`); the room name comes from the `--room my_room` arg in `server/package.json`.
- Confirm `server/package.json` scripts are the documented ones and nothing else references `my_room`.

## Acceptance

- `grep -rn "my_room" server` returns nothing (or only a clearly intentional reference).
- From clean subdirs:
  - `cd server && npm run build` passes
  - `cd server && npm test` passes
  - `cd client && npm run build` passes

## Dependencies

Gate ticket — run after 001–010 are done.