# 008: Rewire room to new state, phases, timers

> Updated after 001–006: the room already boots `state = new GameState()` and `onJoin` registers a `GamePlayer` contestant (first is host) and pushes to `state.contestantsOrder` (006). The legacy 5-question handlers still exist but were adapted to GameState field names: `currentRound` → `activeRound`, `currentState` → `currentPhase`, the synced `answered` map became a local `Map`, and answer reveal now broadcasts an `answerReveal` message (there's no `state.answer` anymore). All of that is what this ticket removes.

## Goal

Make the room actually drive the new phase machine with server timers, replacing the old 5-round flow.

## Scope

- In `server/src/rooms/MyRoom.ts`:
  - Remove the old `messages` handlers logic for `question`/`answer`/`nextQuestion` broadcast flow and `requestQuestions`/`pickAndSendQuestion` (opentdb fetch moves behind the chase implementation — not this ticket). Also remove the legacy `answerReveal` broadcast added in 006.
  - Add a handler skeleton driven by `gameFlow.ts` (ticket 007) and `timer.ts` (ticket 003):
    - `startGame` (only when phase is lobby) → begin cash builder for the first contestant, start the 60s timer (`CASH_BUILDER.durationMs`).
    - On cash-builder timeout → advance to offer (chaser offers are Phase 3; for now persist generated amounts and emit an event).
    - Other phase transitions stubbed but wired through `gameFlow` (log + set phase), so a game can advance end-to-end in a smoke test.
  - Keep: join with `playerName`, first-joiner-is-host, host-leave disconnects room (code 6767) — onJoin already handles the player/role bits (006), iterate the lone contestants via `state.contestantsOrder`.
  - Broadcast a `phase` message on every phase change so the client can follow.
- Integration test in `server/test/roomFlow.test.ts` (boot via `@colyseus/testing`): join two clients, start, assert phases advance and the 60s timer fires → advances to offer.

## Acceptance

- `cd server && npm test` passes (boot + flow smoke test).
- `cd server && npm run build` passes.

## Dependencies

003, 006, 007.