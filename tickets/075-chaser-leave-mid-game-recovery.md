# 075: Chaser disconnect mid-game must resolve the room, not stall it (`bug-010`)

## Goal
`onLeave` only special-cases the **host** (disconnect 6767) and the **active contestant** in `CashBuilder`/`Offer`/`Chase` (dispatch `contestantForfeit`). A **Chaser** — who since 064 is an active answerer in every Chase and the only player who can set offers — leaving mid-round leaves `chaserSeatId` pointing at a departed seat with no handler: the room can never advance (`bug-010`, open in `BUGS.md`).

## Scope
- Add a `chaserForfeit` `FlowEvent` to the pure state machine `server/src/gameFlow.ts`: from any post-selection phase with a chaser assigned (`ChaserReveal`, `RolesReveal`, `Lineup`, `CashBuilder`, `Offer`, `Chase`, `TeamFinal`, `ChaserFinal`), a chaser forfeit ends the game — `nextPhase: GamePhase.GameEnd` + an `endGame` effect with `winner: "team"`. Reuse the existing `endGame` effect shape already consumed by the client (`effects.ts:235`). Unit-test the transition in `server/test/gameFlow.test.ts`.
- Wire it in `server/src/rooms/TriviaRoom.ts` `onLeave`: before the host check (a host-chaser still keeps today's `disconnect(6767)` behaviour — host leaving ends the room), if the departing seat is the chaser and a chaser was already selected (past office `ChaserSelection`, i.e. `chaserSeatId` set), dispatch `chaserForfeit` instead of letting the room stall. Keep the existing active-contestant forfeit branch for the non-chaser case as-is.
- This default policy is **game over, team wins** — deliberately the conservative choice: the game cannot continue without the Chaser for offers and head-to-head answers, and promoting a contestant mid-room to Chaser is a larger product change (see TO_REVIEW entry). If that promotion is desired later it is a separate ticket.
- Mark `bug-010` in `BUGS.md` as `triaged` → this ticket.

## Acceptance
- New `server/test/leaveFlow.test.ts` tests: the Chaser leaving during **Chase** and during **TeamFinal** both resolve to `gameEnd` with `endGame { winner: "team" }` broadcast; the room is not stuck in the round's phase.
- A host-Chaser leaving still disconnects the room (close 6767) — existing behaviour unchanged.
- A non-chaser contestant leaving still takes the `contestantForfeit` path (existing leaveFlow tests stay green).
- `cd server && npm test` and `cd server && npm run build`.

## Dependencies
- None (builds on the existing `endGame` effect from Phase 5's skeleton).