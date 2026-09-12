# 061: Recover the game when the last contestant leaves during the `Lineup` hold (`bug-004`)

## Goal
If every remaining contestant leaves while the room is holding on the `Lineup` interstitial (ticket 049's 7s turn-order screen), `onLeave` removes them from `contestantsOrder`, but the pending `lineupComplete` timer still fires and throws ("at least one contestant") when it finds nobody left — the room is stuck in `Lineup` forever (`server/src/rooms/TriviaRoom.ts` `onLeave`, `server/src/gameFlow.ts` `lineupComplete`).

## Scope
- `server/src/rooms/TriviaRoom.ts` `onLeave`: mirror the existing mid-round departure handling (already done for `CashBuilder`/`Offer`/`Chase` via `contestantForfeit`, lines ~267-279) for the `Lineup` phase — if the departing seat empties `contestantsOrder` while in `Lineup`, resolve forward instead of leaving the pending timer to throw. Likely needs a new or reused flow event (e.g. dispatch something that ends the game / returns to `Lobby` when zero contestants remain, since there's nobody to run a cash builder for).
- `server/src/gameFlow.ts` `lineupComplete`: decide and implement the no-contestants case explicitly (don't rely on the throw-and-log fallback) — either guard the departure so this transition is never reached with zero contestants, or handle it gracefully (e.g. transition to `GameEnd` / `Lobby`).
- Add a regression test: 2-player room (host+chaser, one contestant) reaches `Lineup`, the lone contestant leaves mid-hold, assert the room recovers (does not stay in `Lineup` past `lineupDurationMs`).

## Acceptance
- New `server/test/roomFlow.test.ts` (or similar) test reproducing `bug-004`'s repro steps passes.
- `cd server && npm test` and `npm run build` green.
- `BUGS.md` bug-004 flipped to `triaged` citing this ticket (done as part of this review).

## Dependencies
- Builds on 049 (Lineup phase) and 042 (existing active-player-leaves-mid-round recovery pattern to follow).
