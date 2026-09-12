# 059: Chaser character reveal — new phase after the first cash builder, before the first offer

## Goal
Give the Chaser's chosen character (picked during `RolesReveal`, ticket 036, but currently kept hidden from contestants until it happens to render on the Offer screen) its own dramatic reveal moment — a beat the show has when the Chaser walks out. This happens **once**, after the **first** contestant's cash builder ends, before their offer — not on every subsequent contestant's offer.

## Design (signed off with the user — do not redesign)
A new phase, empty/dark screen at first:
1. Screen starts empty/dark.
2. A silhouette of the Chaser's character appears small, center screen, and grows larger with a bouncy "footstep" motion (small → big, staggered/bouncing scale steps, not a smooth linear tween) while staying fully dark/silhouetted.
3. Once it reaches full size (still dark, holds a beat).
4. A spotlight hits — the silhouette resolves to the full-color character portrait (reuse the existing `bezos-icon.png` / `bigstan-icon.png` / `nami-icon.png` assets, same ones used in the roles-reveal character picker).
5. Large name text animates in over/near the portrait.
6. Hold for a few seconds, then auto-advance to `Offer`.

## Scope
- **Server (`gameFlow.ts` + `effects.ts`)**: new `GamePhase.ChaserCharacterReveal` (add to both `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` — keep parity). New transition: `cashBuilderTimeout` in phase `CashBuilder` with `activeRound === 1` (the *first* contestant's round only) goes to `ChaserCharacterReveal` instead of straight to `Offer`; a new `chaserCharacterRevealComplete` event (server-timed, same pattern as `startChaserReveal`/`chaserRevealComplete`) transitions `ChaserCharacterReveal → Offer` with the `startOffer` effect. Every subsequent contestant's `cashBuilderTimeout` (`activeRound > 1`) skips straight to `Offer` as today.
  - New effect `startChaserCharacterReveal` in `effects.ts`: broadcast the Chaser's `chaserCharacterId`/name (reuse `CHASER_CHARACTERS` lookup, same shape as the existing `offerStart` chaser-character fields), then a `scheduleTimer` (new `CHASER_CHARACTER_REVEAL.durationMs` tunable in `gameConfig.ts`, clamped like the other phase durations) that dispatches `chaserCharacterRevealComplete`.
- **Client**: new `ChaserCharacterRevealScreen.vue` implementing the signed-off animation (CSS transitions/keyframes in `client/src/style.css`, no inline `style=`; kebab-case classes). Wire it into `App.vue`'s phase-to-screen map.
- Add a pure `gameFlow` unit test for the new transition (first round goes through the reveal; later rounds don't) plus a `roomFlow` timing test (mirrors the existing `ChaserReveal` wheel test pattern).
- No changes to the character-pick mechanism itself (still ticket 036's `revealReady` + `characterId`) — this ticket only adds the reveal moment and reuses data already in state.

## Acceptance
- `cd server && npm test` green with new tests covering: round-1 `cashBuilderTimeout` → `ChaserCharacterReveal` → (after timer) `Offer`; round-2+ `cashBuilderTimeout` → `Offer` directly (no reveal replay).
- `cd server && npm run build` and `cd client && npm run build` green.
- Manual 2-browser check: play through the first contestant's cash builder, confirm the silhouette-grow-then-spotlight animation plays once, then Offer proceeds normally; play a second contestant's round and confirm no reveal replay.

## Dependencies
- Depends on 036 (chaser character pick) and 033 (existing reveal-phase-as-own-screen pattern to follow for structure).
