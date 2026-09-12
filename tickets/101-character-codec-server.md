# 101: Contestant character codec + `GamePlayer.character` + validated `setCharacter` (server)

## Goal
Lay the authoritative data model for custom contestant avatars: every player carries a validated 5-digit character code (hairstyle + colour, face + colour, shirt colour) on the synced schema, and can update it from the lobby. Rendering (102) and reactions (103) land on top of this.

## Scope
Server only — no client change in this ticket (both builds stay green).

- Define the codec once, as a pure module duplicated in **both** packages per the GamePhase parity convention (`server/src/character.ts` and `client/src/character.ts` — the client copy is verified by build, not grep):
  - Layout: `[hairStyle][hairColour][faceStyle][faceColour][shirtColour]` (5 digits, 0-based). `10234` = hair style 1 → hair colour 0, face style 2 → face colour 3, shirt colour 4.
  - Ranges from a new `CHARACTER` block in `server/src/gameConfig.ts`: 5 hairstyles, 3 faces, 9 colours per channel.
  - Helpers: `encodeCharacter(...)`, `decodeCharacter(code)`, `isValidCharacter(code)`, `randomCharacter()`.
- `server/src/rooms/schema/GameState.ts`: add `@type("string") character: string = ""` to `GamePlayer`.
- `server/src/rooms/handlers/messageHandlers.ts` (+ TriviaRoom wiring): join assigns `randomCharacter()` when absent so nobody is codeless; new `setCharacter` message (`{ character }`) — self-only, idempotent, **validated** with `isValidCharacter` (reject + log malformed/out-of-range/wrong-length/`null`/non-string input, per the security rules), rate-limited like other non-gameplay input (037). Phase-agnostic: picking can happen any time, but the lobby is the real UI (102).
- Tests (`server/test/character.test.ts` + a roomFlow case): codec bounds — encode/validate/random never produce out-of-range output; join assigns a valid default; `setCharacter` updates the schema and rejects bad codes.
- No rendering, no reactions, no chaser-roster changes in this ticket.

## Acceptance
- `cd server && npm test` green with the new tests.
- `cd server && npm run build` and `cd client && npm run build` green (client untouched this ticket).

## Dependencies
- None.