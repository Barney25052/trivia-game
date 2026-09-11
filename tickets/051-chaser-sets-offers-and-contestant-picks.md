# 051: Chaser sets the high & low offers; contestant picks (server)

## Goal
Turn the Offer phase into a real two-step round: the Chaser proposes the **high** and **low** offers (the **middle** is fixed = the contestant's cash-builder total), then the active contestant picks a tier to play for. High must be > middle, low must be < middle, and both are capped by the Chaser's remaining pot — no more auto-computed offers.

## Scope
- `server/src/gameFlow.ts`:
  - New `FlowEvent` `{ type: "chaserOffersSet" }` (valid only in `Offer` phase) that keeps the phase in `Offer` and carries the accepted offers forward to `contestantChoice`.
  - `startOffer` effect semantics change: broadcast the middle amount + chaser identity/character (as today) and signal "waiting for the Chaser" rather than final three tiers. After `chaserOffersSet`, the final three tiers are broadcast.
- `server/src/rooms/handlers/messageHandlers.ts` — new authoritative handler `setChaserOffers` (or extend `offerChoice`):
  - **Role guard**: sender must be the Chaser (`state.chaserSessionId`). **Phase guard**: `Offer` only. Reject + log otherwise.
  - **Shape/bounds**: `high`/`low` must be finite numbers; `middle` is immutable from `cashBuilderMoney`; enforce `low < middle < high`; enforce both `high ≤ chaserPot` and `low ≤ chaserPot` (pot ceiling — link 050); reject anything else.
  - Existing `offerChoice` stays: active-contestant + `Offer` guarded, but it now dispatches after the chaser's offers are set (not before).
- `server/src/rooms/handlers/effects.ts`: remove the hard-coded `low = floor(take/2), high = take*2` math; add a `chaserOffersSet` effect that stores the accepted offers in `room.currentOffer` and broadcasts them.
- **Offer policy decisions to surface to the user** (do NOT bury in code):
  - Default high/low: multiples/splits of middle (e.g. low = 50%, high = 2×), and/or arbitrary chaser-typed amounts within the pot bound — pick one; put the default multipliers + ceilings in `gameConfig.ts`.
  - **Negative low offers**: GOAL allows low < $0 ("as long as the player pot does not go below $0"). Negative payouts complicate team-pot math — recommend clamping low ≥ $0 unless the user explicitly wants the show's "minus money" gimmick. Record whichever in GOAL + `gameConfig`.
- `server/test/cashBuilderFlow.test.ts` and `roomFlow.test.ts`: update the assertions that assume auto-computed `low/middle/high`; add guard tests (chaser-only, offer-phase-only, malformed amounts, ordering violation, pot-ceiling rejection).

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` passes.
- New integration test walks: cash builder → Offer → chaser `setChaserOffers` (valid) → broadcast three tiers → contestant pick → Chase; plus each rejection path.
- The offer amounts actually flow into `startChase`'s starting spaces (low→4, middle→5, high→6) unchanged.

## Dependencies
- Depends on 050 (chaser pot bounds the offers).
- Client consumes in 052.