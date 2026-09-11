# 050: Chaser pot — lifecycle, payouts, and cap (server)

## Goal
The synced `chaserPot` is currently static (`CHASER_POT.initial`, never written). Make it a live budget: it grows each round, paying escaped offers is debited from it, and it never goes below $0. This is the money that bounds what the Chaser can offer (Phase 3), so it must land before offer-setting.

## Scope
- `server/src/rooms/handlers/effects.ts`:
  - **Grow**: `chaserPot += CHASER_POT.perRound` at the round boundary (after a contestant's chase resolves — on the `chaseEscape`/`chaseCaught` effect, not on `startOffer`), per GOAL "+$30k after every round".
  - **Debit**: the `addToTeamPot` effect also does `chaserPot -= effect.amount`, floored at `0` (offer paid out on escape); `eliminateContestant` (caught) debits nothing.
- `server/src/gameConfig.ts`: `CHASER_POT` stays the single source of tunables. Decide (with the user) whether the initial/`perRound` values are randomized per game — default is fixed `50_000` / `30_000`; if randomizing, document the range and add a test that the pot stays in bounds.
- Tests (`server/test/` — extend `roomFlow.test.ts` or a new `chaserPot.test.ts`): pot grows between rounds; escape debits the offered amount; caught debits nothing; pot never drops below 0 even if an offer exceeds the remaining pot (clamp).

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` passes.
- The pot math is asserted at each stage (start, +perRound, −payout, floor 0) — not just "no crash".

## Dependencies
- None. Consumed by 051 (offer ceiling) and 052 (Chaser pot visibility).