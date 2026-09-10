# 016: Harden player setup (server-side name validation)

## Goal

The room only accepts well-formed players and rejects bad join options up front, so names in the lobby and the `startGame`/selection order are always usable. Fixes the tail of Phase 1's "player setup (names, room code)" bullet — the client UI (HomeScreen) already collects name + room code.

## Scope

- In `server/src/rooms/TriviaRoom.ts` `onJoin` (TriviaRoom.ts:208-220): validate `options.playerName`:
  - must be a non-empty string after trimming,
  - trimmed length ≤ 24 chars,
  - **reject the join** (throw — do not add to `players`/`contestantsOrder`) when invalid.
- Keep existing behavior otherwise: first joiner is host, `role = Contestant` default (`TriviaTypes`), appended to `contestantsOrder`.
- Optional (your call — small): reject duplicate names case-insensitively within the room.
- Add tests in `server/test/roomFlow.test.ts` (or new `nameValidation.test.ts` following the stub pattern in `testServer.ts`): empty / whitespace-only / too-long names → player not in `state.players`; valid names join as today.
- Do **NOT** change client inputs, room-code UX (already works via `room.roomId`), or any phase logic.

## Acceptance

- `cd server && npm test` — green (existing 42 + new validation cases)
- `cd server && npm run build` — clean
- Join attempt with an empty or >24-char name leaves `room.state.players` unchanged

## Dependencies

- None (safe to run in parallel with 013/014/015; touches `onJoin` only — only 013 also touches `TriviaRoom.ts`, so merge 016 first or last).