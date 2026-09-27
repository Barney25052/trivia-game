# 164: Refuse joins after the game has started (`bug-023`)

## Goal
Pre-upload fix, 2026-09-27. `onJoin` only validated the player name, so anyone with the 4-letter room code could join a game in progress: they got a random character, were pushed onto `contestantsOrder` as a contestant who never had a Cash Builder, and landed on whatever screen was live with no role. On a public server, any code seen on a stream or screenshot lets a stranger walk into a running game.

## Scope
- `server/src/rooms/TriviaRoom.ts` `onJoin`: once `currentPhase` has left the Lobby, the join is refused (`throw new Error("That game has already started")`, logged) before any seat is created. Deliberately not `this.lock()`: a locked room reaches the client through the matchmaker as a "locked" error, which `describeJoinError` shows as "That room is full."
- `client/src/App.vue` `describeJoinError`: "already started" → "That game has already started."
- Nothing changes for joins in the Lobby, and the host-reconnect stretch goal (GOAL.md) isn't affected, since it isn't built.

## Acceptance
- `cd server && npm test` green, including the new `test/lateJoin.test.ts` (Lobby joins still work; a join after `startGame` is refused with "already started" and leaves the players and running order untouched).
- `npm run build` green in both packages.

## Dependencies
None.
