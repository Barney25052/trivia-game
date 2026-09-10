# 030: Add a per-round question event schema & a first-class "spectator/table" axis

## Goal
The game-flow work ahead (Phase 2 cash-builder, Phase 4 chase, Phase 5 final) and every social stretch (taunt bar, prediction pool, ghost scoreboard, at-the-table faces, spectator rejoin) all depend on two things the schema/room have no home for yet:

1. **A per-question broadcast** describing *who* is answering *what* right now — so non-active players (the bench, the dead, the chaser) can react, ghost-answer, or predict instead of just staring at a static waiting screen.
2. **A clean per-seat status** — today `GamePlayer` has `isEliminated` + `madeItBack` + `boardPos` + `score` as separate booleans/fields with overlapping, partially-dead meanings. The stretches need a single, understood axis like `seatState`: `active | waiting | eliminated` (player still at-table vs out) plus `madeItBack` for the final. This is much cheaper to establish now than to migrate once scores/boards/chaser-pots land on top of the current schema.

This ticket deliberately does **not** implement any stretch feature — it carves the seams so future phases don't fight the existing schema. Where a feature (e.g. ghost scoring) needs real per-player storage, that stays with its own phase; this ticket only lands the shared *shape*.

## Scope
- `server/src/rooms/schema/GameState.ts`:
  - Introduce a small per-question broadcast payload shape (can't be a `@type` class if it's one-shot event data — but at least define a TypeScript interface in `server/src/` so `gameFlow`/room and the client agree on the field names) for a new server→client `question` channel: `{ round, targetSessionId, kind: "open" | "mc", prompt, options?: string[], questionId }`. Correct answers stay server-side (security rule unaffected).
  - Add `seatState` (or agreed name) to `GamePlayer` as an enum-ish string; keep `isEliminated`/`madeItBack` for now but document the intended relationship, OR migrate to the single axis now (see TO_REVIEW #10 — do NOT flip the old booleans without sign-off).
- `server/src/rooms/TriviaRoom.ts`: wire the `question` broadcast method so Phase 2/4/5 and stretch features call one helper (`broadcastQuestion`) instead of inventing their own channel.
- Client: mirror the `question` payload in `client/src/TriviaTypes.ts` (or a new shared types file — see TO_REVIEW #9) and add the skeleton listener in `App.vue`.
- No gameFlow changes beyond what's needed for the payload interface to compile.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- The `question` channel shape and `broadcastQuestion` helper exist and are unit-testable; correct answers are NOT in the broadcast shape.
- `seatState` (or agreed name) is documented on `GamePlayer` and used by at least the room's `eliminateContestant` / `addToTeamPot` effects so it's not dead.

## Dependencies
- None. Intended as the pre-work that Phase 2 and the dead-player stretches build on.