# 044: Finish the seat-id rekey — players map keyed by `GamePlayer.seatId`, not `sessionId`

## Goal
Ticket 034 ("rekey players map with seat ID") is marked done, but the players `MapSchema` is still keyed by `client.sessionId` (`TriviaRoom.ts:200`), `seatId` is a silent `sessionId.slice(0, 8)` (`TriviaRoom.ts:196`), and every handler/flow/offer lookup uses sessionIds (`gameFlow.ts`, `messageHandlers.ts`, `effects.ts`). This violates the AGENTS.md invariant that `sessionId` stays ephemeral — no durable-identity assumptions in handlers, scoring, or round order. Complete the rekey so identity is a stable per-round seat id.

## Scope
- `server/src/rooms/TriviaRoom.ts`:
  - Generate a real seat id for each join (stable for the seat's life in the room, not derived from the connection); key `state.players` by it; drop the `sessionId` schema field if it has no remaining consumer (or keep only what the client needs for `myPlayer`-style lookups — `App.vue` uses `room.sessionId` against the map, so the client-resident maps may need a translated `mySeatId`).
  - `gameFlow.ts` context and `FlowEvent`s switch to seat ids (`activeContestantSessionId` → `activeContestantSeatId` where it feeds the schema/UI, or a documented room-level translation layer to keep the diff small — pick one and be consistent).
  - `messageHandlers.ts`, `effects.ts`: all lookups by seat id.
- `server/src/rooms/schema/GameState.ts`: name the map keys correctly; decide whether `sessionId` and `seatId` fields stay.
- `server/src/questions/questionManager.ts`: drop the stale "rekey when ticket 034 lands" comment; key `QuestionManager` state by seat id.
- `server/src/rooms/handlers/chaserSelection.ts`: tally by the same key.
- Client: `App.vue` and `CashBuilderScreen.vue` identify the active contestant via the synced seat id; spectator question gating (`currentRoundQuestion`) still works.

## Acceptance
- `cd server && npm test` (all suites incl. nameValidation, roomFlow, cashBuilder suites), `npm run build` (server + client) pass.
- No `sessionId`-keyed players map anywhere; grep for `sessionId` in handlers/scoring/flow returns only the room's client object reference where genuinely needed.
- A player who leaves and rejoins (new sessionId) mid-game, if the phase allows, does not overwrite or ghost a seat.

## Dependencies
- Do after 042 (leave/flow recovery touches the same lookup paths) or land together.