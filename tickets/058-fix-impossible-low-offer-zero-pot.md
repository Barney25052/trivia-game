# 058: Fix the impossible low offer when a contestant banks $0 and the team pot is $0

## Goal
Close a real softlock found in Phase 3 review: if a contestant's cash-builder middle is $0 (they answered zero questions correctly) **and** the team pot is still $0 (typically the first contestant of the game), there is no legal low offer — the Chaser can never proceed, and the room is stuck in `Offer` forever.

## Root cause (verified in code)
`setChaserLowOffer` (`server/src/rooms/handlers/messageHandlers.ts:102-140`) and its mirrored client validation (`client/src/screens/OfferScreen.vue:149-156`) both require:
- `amount < middle` (line 125 server / line 152 client) — when `middle === 0`, `amount` must be negative.
- `amount >= 0 || -amount <= teamPot` (line 129 server / line 153 client) — when `teamPot === 0`, `amount` cannot be negative.

Both constraints together admit no value when `middle === 0 && teamPot === 0`.

## Decided fix (confirmed with user)
When the offer's middle is `$0`, **skip the low-offer step entirely**: the Chaser sets only a high offer, and the contestant picks between middle ($0, safer start at space 5) or high (riskier start at space 6, real money). Do not invent a low offer or new money in this case.

## Scope
- `server/src/gameFlow.ts`: no phase change needed — `Offer` stays `Offer` — but `chaserOffersSet`/the offer-completion check must not require a low value when middle is $0. Cleanest: when `startOffer`'s `take === 0`, immediately set `currentOffer.low = 0` server-side (server/src/rooms/handlers/effects.ts:99-121, the `startOffer` case) instead of `null`, and broadcast the `offerStart`/state so the client never shows a low-offer input for this round. `offerChoice`'s "both must be set" gate (`messageHandlers.ts` around the `offerChoice` handler) should treat `low === 0` under this rule as already-set.
- `server/src/rooms/handlers/messageHandlers.ts`: `setChaserLowOffer` should reject attempts to set a low offer when middle is already $0 (nothing to set — keep the authority guard consistent with the client not offering the control).
- `client/src/screens/OfferScreen.vue`: when `props.offer.middle === 0`, don't render the low-offer input/step — go straight to the high-offer input for the Chaser, and show the contestant only "middle ($0) vs high" as pickable tiers (the low tier button should not render, or should render disabled/hidden — match the existing tier-row markup, don't add a new component).
- Add a regression test in `server/test/` covering: contestant banks $0, team pot is $0, Chaser can still complete the offer (sets only a high offer) and the round proceeds to `Chase`.

## Acceptance
- New server test: a contestant who earns $0 in the cash builder while `teamPot === 0` reaches a resolvable offer (Chaser sets high only, contestant can choose middle or high) and the game advances to `Chase`.
- `cd server && npm test` and `npm run build` green; `cd client && npm run build` green.
- Manual check: force a $0 cash-builder round as the first contestant, confirm the Offer screen shows no low-offer step and the game doesn't stall.

## Dependencies
- Builds on 051 (server offer-setting) and 052 (offer screen UI).
