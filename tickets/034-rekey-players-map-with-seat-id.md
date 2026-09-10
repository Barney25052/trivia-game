# 034: Rekey the players map with a seat ID — stop leaking sessionIds to clients

## Goal
Two related problems share one fix:

1. **sessionIds are broadcast as map keys** (`players` MapSchema keys are Colyseus sessionIds) — every client sees every other client's session ID. Full hiding requires rekeying with a non-session per-player id.
2. **No stable seat identity** — the only player identifier is `sessionId`, which is ephemeral (reload = new session). The spectator-rejoin stretch ("rejoin as spectator / next round"), avatar assignment, prediction/taunt targeting, and chaser-character reveal all need a stable seat keyed player-to-round. If a player reloads and rejoins mid-room, retrofitting a stable seat id is expensive once handlers are written against sessionId.

Combining both: introduce a `seatId` (short random string, assigned on join, stored on `GamePlayer`, synced to clients) as the canonical player identifier for all game logic and client lookups. SessionIds stay server-side only.

## Scope
- `server/src/rooms/schema/GameState.ts`:
  - Add `@type("string") seatId: string` to `GamePlayer`.
  - Remove the `@type("string") sessionId` field entirely (ticket 026's scope, absorbed here).
  - Keep `sessionId` as a bare (non-synced) field on the server-side `GamePlayer` class for handler lookups.
- `server/src/rooms/TriviaRoom.ts`:
  - On join: generate a `seatId` (e.g. `crypto.randomUUID().slice(0, 8)`) and store it on the `GamePlayer`. Also store a `seatId → sessionId` lookup map on the room for handler dispatch.
  - Replace all `client.sessionId` references in handler dispatch with lookups from the seatId map (or continue using `client.sessionId` server-side but map it to seatId for the schema/broadcast).
  - `activeContestantSessionId` in `GameState.ts` → rename to `activeContestantSeatId` (and update all references in gameFlow, room, and client).
  - `chaserVote` MapSchema keys → change from sessionId to seatId.
  - `chaserSessionId` on GameState → rename to `chaserSeatId`.
- `server/src/gameFlow.ts`:
  - All `FlowEvent` sessionId fields → seatId (the context carries `activeContestantSeatId`, events carry `chaserSeatId`).
  - `contestantsOrder` → array of seatIds.
- Client (`client/src/App.vue`, all screen components):
  - `room.value.sessionId` stays (own session id, used for "am I the chaser?" / "am I active?" comparisons).
  - All lookups by map key change from sessionId to seatId.
  - `activeContestantSessionId` → `activeContestantSeatId` (and same for `chaserSessionId` → `chaserSeatId`).
  - Screen components (`ChaserSelectionScreen.vue`, `ChaseScreen.vue`, `RolesRevealScreen.vue`, `OfferScreen.vue`, `ChaserWheelScreen.vue`, `LobbyScreen.vue`, `ResultsScreen.vue`): derive identity from seatId instead of sessionId.
- `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts`: update any shared types that reference sessionIds to use seatIds.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- Grep: no client-side code reads a Colyseus sessionId from the synced schema (only `room.value.sessionId` for own identity).
- Grep: `GameState` schema has no `@type`-synced sessionId field — only `seatId`.
- Manual: join a 3-player room, walk through selection/roles reveal — "(you)" markers, vote rows, wheel, and chaser reveal all resolve to the right players using seatIds.

## Dependencies
- Absorbs ticket 026 (drop synced `GamePlayer.sessionId`). Mark 026 as done when this lands.
- Should be done before Phase 2 lands scoring (which will hard-reference player identity).
