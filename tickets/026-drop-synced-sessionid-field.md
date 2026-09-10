# 026: Drop the synced GamePlayer.sessionId field — use map keys for identity

## Goal
`GamePlayer.sessionId` (`@type("string")`, GameState.ts:7) is broadcast to every client, duplicating an identifier the client already has two other ways: its own `room.sessionId` and the `players` MapSchema keys (which ARE the sessionIds). The screen code leans on the synced field for identity comparisons, which is a second source of truth that would get stale the moment any durable-identity/reconnect scheme lands (stretch: host reconnect). Remove the synced field; make client identity lookups use the map keys / own sessionId instead.

## Scope
- `server/src/rooms/schema/GameState.ts:7` — remove the `@type("string")` decorator from `GamePlayer.sessionId`. The bare field remains available server-side (room code reads it); it just stops syncing.
- Client: replace reads of `player.sessionId` from synced state in:
  - `client/src/App.vue` — keep `room.value.sessionId` (own id) and expose the players map *keys* alongside the values so screens can map id → player.
  - `client/src/screens/ChaserSelectionScreen.vue` (lines 8, 22, 24, 28, 32, 37), `ChaseScreen.vue` (8, 12), `RolesRevealScreen.vue` (11, 33, 38, 46), `OfferScreen.vue` (8, 17), `ChaserWheelScreen.vue` (23, 26), `LobbyScreen.vue` (15), `ResultsScreen.vue` (11) — derive `(you)`, vote-target, active-contestant, and chaser lookups from the map keys / introduced alias instead of the field.
- No server logic changes: room handlers already use `client.sessionId` and map keys directly.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- Grep: no screen reads `player.sessionId` from a `@type`-synced schema field.
- Manual: join a 3-player room, walk through selection/roles reveal — the "(you)" markers, vote rows, wheel, and chaser reveal all resolve to the right players.

## Dependencies
- None. Note: the `players` MapSchema keys still sync sessionIds to clients — full hiding would require rekeying the map; that decision is parked in `TO_REVIEW.md`.