# 052: Offer screen — Chaser sets high/low with pot visibility; contestant picks; spectators wait

## Goal
Replace the placeholder `OfferScreen.vue` with the real two-step offer UX: the **Chaser** sees the active contestant's cash-builder total (the middle offer) and their **remaining chaser pot** (the rationing pressure), sets the high + low offers, and submits. Once set, the **active contestant** sees the three tiers and picks one to play for. Everyone else watches ("Chaser is making the offer…" → the three amounts).

## Scope
- **UI sign-off first (AGENTS.md rule)**: present the intended screen state — chaser view, contestant view, spectator view, validation feedback, where the chaser-pot number sits — before writing any markup.
- `client/src/screens/OfferScreen.vue` rebuild:
  - **Chaser view** (and only the Chaser): middle amount, remaining `chaserPot`, inputs for high + low with client-side validation mirroring the server's (low < middle < high, ≤ pot), Submit → new `setChaserOffers` message.
  - **Active contestant view**: three tier buttons showing `$low / $middle / $high`, disabled + "waiting for the Chaser" until the offers are set; pick → existing `offerChoice`.
  - **Spectator / inactive view**: waiting states only, never the inputs.
  - Chaser-character reveal (ticket 036) stays on this screen.
- `client/src/App.vue`: new `setChaserOffers` (`room.send`), track new offer message shape; keep `currentOffer` gating (`offer.sessionId === mySessionId`) working in both steps.
- `client/src/style.css`: styles for the offer rows (reuse `lobby`, `playerName`, `startButton`, `answerButton` patterns; new kebab-case classes grouped together), 4-space indent, no `<style scoped>`.
- `common` message shapes: if 035's shared payload types land, type the new `offer`/`setChaserOffers` payloads there; otherwise keep them in the ticket's contract (server broadcast → client `onMessage`).

## Acceptance
- `cd client && npm run build` passes; `cd server && npm test` stays green (server unchanged except none — client-only, but verify the message contract against 051).
- Manual 3-player check: Chaser sets offers within the pot → contestant sees three tiers and picks → Chase starts with the right starting space; a chaser attempting an out-of-bounds offer is blocked.

## Dependencies
- Depends on 051 (server accepts `setChaserOffers`).