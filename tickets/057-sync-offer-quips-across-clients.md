# 057: Sync the Offer screen's auto-generated quips across clients

## Goal
`OfferScreen.vue` (052) picks its speech-bubble quip with `Math.random()` independently on every client, keyed off `offer.seatId`/low-set/high-set. Two players watching the same offer round can see two different lines at the same moment — the "Chaser presence" only works if everyone sees the same quip at the same time.

## Scope
- Replace the client-side random pick with something every client resolves identically. Two ways to get there — pick one before coding, don't just default to whichever is easiest:
  - **Deterministic client-side hash (no server change)**: derive the pool index from data already in the broadcast (e.g. a hash of `seatId` + stage + `low`/`high` amount) instead of `Math.random()`. Cheap, ships entirely in `OfferScreen.vue`, but the "quip" is really just a fixed lookup — no actual variety across identical offers.
  - **Server picks and sends it**: `effects.ts` picks the quip text (or an index into a shared pool) when it builds the `offerStart`/`offerLowSet`/`offer` broadcasts, and the client just renders what it's told. More consistent with "server is authoritative for anything that must match across clients," and it's the same shape 056's persistent quip channel already needs — worth doing there instead of twice, if 056 lands soon after.
- Whichever approach: the fix is scoped to `OfferScreen.vue`'s `pickQuip`/`quip` logic (and `effects.ts` + the broadcast payloads, if server-driven). Don't touch the 055/056 persistent-panel work — that's a separate, bigger quip surface for chaser-typed text.

## Acceptance
- Two clients open on the same Offer round see identical quip text at each stage (start / low set / high set), verified manually with two browser sessions.
- `cd client && npm run build` passes (and `cd server && npm test` / `npm run build` if the server-driven option is chosen).

## Dependencies
- Builds on 052 (the quip pool and reveal-stage triggers already exist).
- Consider sequencing with 056 if the server-driven option is chosen, so the Offer quips and the persistent chaser-typed quips share one broadcast mechanism instead of two.
