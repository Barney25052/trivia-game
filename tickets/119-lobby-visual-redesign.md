# 119: Lobby visual redesign — UI SIGN-OFF REQUIRED

## Goal
Redesign `LobbyScreen.vue`/its `style.css` rules to match the mockup's "The Lobby" (**[Big Baws Style Guide, section 15](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)**).

## Depends on
Ticket 115 (foundation).

## Why this screen, and what's actually changing
The Lobby already has the best physical idea in the whole game — a real circular table with real seats, a host crown, a "poke a bust" interaction, a live character-customizer preview — it just wasn't dressed for it (Roboto throughout, a plain white room-code pill, flat squared-off bust boxes, a whole-body squash for the poke reaction). This ticket is almost entirely reuse-and-restyle, not new mechanics.

## Agreed direction

**Ground**: plain existing page navy — team-centric screen, no chase tint.

**Title**: "Host's Lobby" in Luckiest Guy, centered, replacing the current Roboto `h1`.

**Room code**: the shared ticket-badge component from 115 (punched side-notches, dashed divider, VT323 code) instead of `.roomCode`'s current plain white pill. Copy-to-clipboard behavior/icon-swap stays exactly as it is today, just restyled.

**The table**: bigger ring than the mockup's own first pass ended up needing — build with generous clearance from the start rather than tuning down from a too-tight radius (the mockup initially sized seats too close to the ring's edge and had to be pulled in twice; aim for seat *content* — crown included, name label included, not just the bust circle — comfortably inside the ring's silhouette with real margin, not flush against it). The ring itself uses the same raised-3D-block shadow trick as 115's buttons/118's table slab, for visual consistency across all three "physical furniture" moments in the app.
- Seated players: frame-free circles (115), same technique as 116/118/117.
- Host gets a crown (existing SVG icon, keep as-is, just repositioned/restyled to match).
- Empty seats: dashed-outline circle, "Open seat" label — same idea as today's dashed-stroke placeholder, restyled to match the new circle language.
- **Poking a seated player**: the head-wobble/eyes-squeeze reaction from 115, replacing the existing `.lobbyBustInner.poked`/`lobby-bust-poke` whole-bust squash animation entirely — this is the same "independent per-part motion over rigid whole-body squash" rule established for 117/118's buzz reactions, now applied to the interaction it was probably originally inspired by. **No particle effect on poke** — this was tried (a few sparkles) and explicitly removed; poking is just the wobble, nothing else.
- **Start button** (host only): the host's center-of-table button becomes a big circular raised-3D-press button (115's family) with a play triangle. Build the triangle as a CSS border-triangle (`width:0;height:0;border-*`), not a text glyph/icon font character — a text "▶" glyph's own font metrics don't reliably center inside a circle; a border-triangle can be positioned with an exact, intentional optical-centering offset (nudge it a few px toward the point side, since a triangle's visual weight sits closer to its flat base than its point).

**Character customizer**: keep the real screen's full set of rows (hairstyle, face style, hair colour, face colour, shirt colour — the mockup only demoed one representative row, hair colour, to keep the demo page short; that's not a scope cut, build all five) — restyle the existing swatch buttons (`lobbyCharacterSwatchButton`/`lobbyCharacterColourSwatch`) with the same chunky-circle-swatch treatment shown for the one demoed row, and restyle the live preview box as a frame-free circle. Save button becomes a chunky `.btn-primary` (115).

**Settings dropdown** (chaser-selection mode: Random / Team Vote): not specifically redesigned in the mockup — restyle its two mode buttons with the chunky button family from 115 for consistency, but no other changes are specified; use judgement or check back with the user if something looks obviously wrong once it's using the new button chrome.

## Real behavior this ticket should NOT change
- Seat-position math (`seatPositions`/`SEAT_RADIUS`), `poke()`'s state (`pokedSeatId`) — only what CSS/animation plays when `.poked` is set, character-picker state (`pickerHairStyle` etc.)/`saveCharacter()`, room-code copy logic, chaser-mode selection (`setChaserMode`). Only presentation.

## Scope
- `client/src/screens/LobbyScreen.vue` — template changes for the ticket-badge, circle busts, crown positioning, start button, customizer swatches.
- `client/src/style.css` — corresponding rules; **delete** `.lobbyBustInner.poked`/`lobby-bust-poke` once the wobble reaction replaces it, don't leave both (per AGENTS.md's "no cruft" rule).

## Acceptance
- Manual walkthrough with 2+ browsers (host + at least one other player) — poke a few seats, try the character customizer end to end, copy the room code, start the game as host — with the user watching live, per AGENTS.md.
- Grep for `lobby-bust-poke` / `lobbyBustInner.poked` to confirm the old animation was actually removed, not just superseded and left behind.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must land first.
