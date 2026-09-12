# 055: Persistent Chaser quip channel (server)

## Goal
Let the Chaser player type a free-text quip at any point in the game (not just during the Offer), broadcast to every client. This is the server half of an always-on "Chaser presence" system (see 056) — auto-generated, screen-scoped quips (e.g. the Offer reveal beats) do **not** need this and already ship in 052 as local/client-only text.

## Scope
- `server/src/rooms/handlers/messageHandlers.ts`: new handler `sendChaserQuip(client, message, room)`.
  - **Role guard**: sender must be `room.state.chaserSeatId`. No phase guard — the Chaser can quip in any phase.
  - **Shape/bounds**: `text` must be a non-empty string after trim, capped at a `gameConfig` length (e.g. 140 chars). Reject + log anything else.
  - Reuses the per-player message rate limiter from ticket 037 — confirm the existing limiter covers this handler or extend its config; quips are the first free-text, player-initiated broadcast in the game and are the most abuse-prone message so far.
  - Broadcast `chaserQuip` `{ text, at: Date.now() }` to the room (ephemeral — not stored in synced `GameState`, since it's a transient toast, not game state).
- `server/src/rooms/TriviaRoom.ts`: wire the `sendChaserQuip` message handler.
- `server/src/gameConfig.ts`: add a `CHASER_QUIP` config block (`maxLength`, and a rate-limit override if the 037 limiter needs per-message-type tuning).
- Escape/trust: this is player-controlled text rendered on every client — the client must not use `v-html` on it (verify in 056), but that's a client concern; this ticket's job is bounding what leaves the server.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` passes.
- New test: non-Chaser sending `sendChaserQuip` is rejected + not broadcast; Chaser sending oversized/empty/non-string text is rejected; a valid quip from the Chaser broadcasts `chaserQuip` to all clients in any phase; rate limiting kicks in on spam.

## Dependencies
- Builds on ticket 037 (per-player rate limiting).
- Client consumes in 056.
