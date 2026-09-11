# 045: Null-guard `onLeave` before dereferencing `player.seatId`

## Goal
`TriviaRoom.onLeave` can throw a `TypeError` on a departed client whose `client.sessionId` was never registered in `state.players` (e.g. a client rejected during join, or a leave racing `onJoin`): `TriviaRoom.ts:213` calls `this.seatIdToSessionId.delete(player.seatId)` with `player` undefined.

## Scope
- `server/src/rooms/TriviaRoom.ts` (`onLeave`):
  - `if (!player) { ...log + return early (after `messageTimes` cleanup) }` — or use optional chaining throughout.
  - Keep the host-leave → `disconnect(6767)` behaviour; the guard must not skip it if `player?.isHost` is true.
- No other files.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` passes.
- A test (extend `roomFlow.test.ts` or a room-lifecycle test) where a client leaves without an `onJoin`/rejected-join path does not throw; room continues for remaining clients.