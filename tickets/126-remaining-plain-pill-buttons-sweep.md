# 126: Sweep remaining plain-pill buttons to the chunky button family — UI SIGN-OFF REQUIRED

## Goal
Found during an autonomous polish pass (2026-09-14): after 115-125, three buttons/classes are the last consumers of the pre-115 plain-pill look (the generic `button { background-color: var(--color-white); border-radius: 25px; ... }` rule plus one-off azure overrides), instead of the `.btn`/`.btn-primary`/`.btn-outline` chunky family every other primary action in the app now uses:
- `HomeScreen.vue`'s `.joinButton`/`.createButton` — the very first buttons a player ever sees.
- `OfferScreen.vue`'s `.startButton`/`.offerTierButton` usages (`Set low offer`, `Set high offer`, and the three low/middle/high pick buttons).
- `ChaserPanel.vue`'s small inline `.chaserPanelSend` ("Send" quip button, also `.startButton`-based).

`.startButton` itself (defined once in `style.css`, still azure) has no other remaining consumers — Lobby's own `.startButton` usage was already fully retired in ticket 119.

## Root cause
Not in scope for any prior ticket — 115-119/122-125 each targeted a specific screen; these three were never swept because none of them are a full-screen redesign, just leftover buttons.

## Proposed direction
Pure class swap, no new CSS components:

- `HomeScreen.vue`: `.joinButton` → `.btn.btn-primary`, `.createButton` → `.btn.btn-outline` (Join is the primary path, Create is the secondary/alternate path — mirrors how `.btn-primary`/`.btn-outline` are already paired elsewhere, e.g. Team Final's buzz-vs-pass framing). Keep each button's own `width`/`margin` sizing rule (rename or fold into the existing `.joinButton`/`.createButton` selectors if `.btn` doesn't already size them) — only the color/border/shadow chrome comes from `.btn-primary`/`.btn-outline`.
- `OfferScreen.vue`: `.startButton` → `.btn.btn-primary` on all four usages (`submitLow`, `submitHigh`, and the two non-tier-row `startButton` spots), `.offerTierButton` keeps its own sizing class alongside `.btn.btn-primary` (same pattern ticket 123 used for `.voteButton` — small chunky button, not full `.btn` default size).
- `ChaserPanel.vue`: `.chaserPanelSend` → `.btn.btn-primary` (kept small via its own sizing class, same pattern).
- Once all consumers are swapped, delete the now-orphaned `.startButton`/`.startButton:hover`, `.joinButton`/`.joinButton:hover`, `.createButton`/`.createButton:hover` rules from `style.css` — confirm via grep each has zero remaining template references first.

## Real behavior this ticket should NOT change
`handleJoin`/`handleCreate`/`handleAddQuestions` logic, `submitLow`/`submitHigh`/`validateLow`/`validateHigh`, the offer-tier `choose` emit, `chaserPanelSend`'s quip-submit logic, any disabled-state gating.

## Scope
- `client/src/screens/HomeScreen.vue`, `client/src/screens/OfferScreen.vue`, `client/src/components/ChaserPanel.vue` — template class changes only.
- `client/src/style.css` — delete orphaned `.startButton`/`.joinButton`/`.createButton` rules (and their `:hover` variants) once confirmed unreferenced; add/adjust small sizing-only classes as needed for the tier/send buttons.

## Acceptance
- Manual: Home screen's Join/Create buttons read as chunky primary/outline, matching Lobby's own Join/Create-adjacent buttons; Offer screen's low/high input buttons and low/middle/high pick buttons read as chunky primary (small); ChaserPanel's Send button reads as chunky primary (small) without visually overwhelming the quip input row it sits in.
- Grep confirms zero remaining `class="startButton"`/`class="joinButton"`/`class="createButton"` (or compound class strings containing them) after the change, and the corresponding `style.css` rules are deleted.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation), 123 (established the "shared `.btn.btn-primary` plus a small sizing-only companion class" pattern for the tier/send-style buttons) — both already shipped.
