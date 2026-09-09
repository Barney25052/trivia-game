# 011: Stale test/loadtest cleanup + green baseline

## Goal

A clean checkout is green end-to-end; remove template landmines.

## Scope

- `server/test/MyRoom.test.ts` references room `my_room` and `MyRoomState.mySynchronizedProperty` — neither exists. Replace with a boot smoke test (join room `trivia`, two clients, assert state sync), or delete it if ticket 008 already covers this — don't keep both.
- `server/loadtest/example.ts` + `npm run loadtest` reference `my_room`; point the script at room `trivia` (or remove the script if it stays useless).
- Confirm `server/package.json` scripts are the documented ones and nothing else references `my_room`.

## Acceptance

- `grep -rn "my_room" server` returns nothing (or only a clearly intentional reference).
- From clean subdirs:
  - `cd server && npm run build` passes
  - `cd server && npm test` passes
  - `cd client && npm run build` passes

## Dependencies

Gate ticket — run after 001–010 are done.