# 056: Persistent Chaser panel — box, portrait, and quip bubble across every phase (client)

## Goal
Make the Chaser a visible, "always there" presence for the whole game (after the first cash builder, there will be a whole reveal after first cash builder), the chaser will also not be there during the teams final round, not just during the Offer: a masked portrait box with a speech bubble, mounted once in `App.vue` so it survives phase changes. Consumes the quip channel from 055 (chaser-typed text) and keeps the auto-generated quips 052 already ships for Offer-specific beats.

## Scope
- **UI sign-off first (AGENTS.md rule)**: confirm placement/sizing once other screens' layouts (post-052) are visible — this panel has to coexist with every phase screen without overlapping their content, which is easier to judge once 052 has landed.
- New `client/src/components/ChaserPanel.vue`: the masked box + portrait (reuses the character art from ticket 036 / 052) + speech bubble. Extract the box/portrait/bubble markup 052 builds inline in `OfferScreen.vue` into this shared component so both use the same visuals instead of drifting.
- `client/src/App.vue`: mount `ChaserPanel` once, outside the `v-if="currentScreen==...` chain, so it persists across phase transitions. Listen for `chaserQuip` messages and feed them to the panel.
- Chaser-only quip input: a small text box + send button, visible only to `mySeatId === chaserSeatId`, sends `sendChaserQuip` (from 055). Client-side length cap mirroring the server's, disabled while rate-limited (reuse the pattern from other rate-limited inputs if one exists, otherwise a simple cooldown-disable).
- `client/src/style.css`: styles for the panel's fixed/persistent positioning; must not cover other screens' interactive elements (test against Lobby, CashBuilder, Chase placeholder).
- Wire a couple more auto-quip triggers beyond Offer (e.g. chaser reveal, chase start) if natural — keep this additive and small; don't try to cover every phase in one pass.

## Acceptance
- `cd client && npm run build` passes.
- Manual check: the Chaser box/portrait is visible on at least Lobby, CashBuilder, and Offer without overlapping their controls; a Chaser-typed quip shows in the bubble on every other client within ~1s; a non-Chaser sees no quip input.

## Dependencies
- Depends on 055 (server quip channel).
- Depends on 052 (extracts its inline chaser-box markup into the shared component).
