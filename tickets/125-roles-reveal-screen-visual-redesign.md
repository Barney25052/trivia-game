# 125: RolesReveal screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
Found during an autonomous polish pass (2026-09-14): `RolesRevealScreen.vue` (the "who's the Chaser / here's the roster" screen shown right after roles are assigned, before the vote/wheel even runs) is the single largest remaining screen still on the pre-115 visual language. `.revealTop`/`.revealBottom` use the old two-tone `linear-gradient(160deg, ...)` page backgrounds (the same style already replaced everywhere else — Lobby, Chase, Team Final, and now the vote/wheel screens in ticket 123), and `.contestantCard` is a plain white rounded box, not the dark `.lineupCard` family used by every other roster/list screen in the app (Lineup, TeamFinalIntro, Results). `.revealContinue` (the "Ready" button) is also still a bespoke pill (`background-color: var(--color-white); color: var(--chaser-red-dark)`), not the `.btn` family.

## Root cause
Not in scope for 115-119 (which covered Lobby/Chase/Chaser Final/Team Final) or 123 (vote/wheel) — never revisited since it predates the redesign effort.

## Proposed direction
Reuse-and-restyle only — no new components, no markup restructuring.

**Top half (Chaser reveal / character picker) — `.revealTop`:**
- Replace `background: linear-gradient(160deg, var(--chaser-red-glow), var(--chaser-red-dark))` with the flat chase ground `var(--ink-chase)` — this moment is chase-centric (it's specifically about revealing/picking the Chaser), matching the "flat dark ground, no gradient" rule already applied everywhere else (Chase screen, Chaser Final).
- `.chaserSilhouette .sil` and `.revealChaserName`/`.revealLabel` colors: verify contrast against the new flat `--ink-chase` ground (they were tuned against the gradient) and adjust to the existing chase-context text tokens if needed (e.g. whatever `.chaseHud`/`.cf-hud` already use on the same ground) — small tweak, not a redesign.
- Leave the character-picker mechanic itself (`.characterOptions`/`.chaserImage`'s grayscale-until-hover reveal) untouched — it's a distinct, already-intentional interaction, not part of the old visual language being retired.
- `.revealReadyTick`/`.revealReadyTick-empty` (the ready checkmarks): keep as-is, already reads fine against a dark ground.

**Bottom half (contestant roster) — `.revealBottom`:**
- Replace `background: linear-gradient(160deg, var(--contestant-blue-glow), var(--gradient-page-end))` with the flat page ground `var(--color-bg-page)` — team-centric, matching Lobby/Lineup/TeamFinalIntro/Results' own flat navy.
- `.contestantCard` → adopt the same dark card treatment `.lineupCard` already uses (`background: var(--ink-raised); border: 1px solid var(--ink-line)`), instead of `background-color: var(--color-white)`. `.contestantName` already has a dark-card-safe scoped override precedent (`.lineupCard .contestantName { color: var(--color-white) }`, added in ticket 124) — add the equivalent `.contestantCard .contestantName` override here rather than touching the shared base rule (same reasoning ticket 124 used: `RolesRevealScreen.vue`'s `.contestantCard` and `ContestantLineupScreen.vue`don't share a base card class, so each needs its own scoped override).
- `.revealContestantsTitle`: verify it still reads against the new flat ground (should be fine, no color change expected).

**Ready button — `.revealContinue`:**
- Replace the bespoke `background-color: var(--color-white); color: var(--chaser-red-dark)` pill with `.btn.btn-primary` (drop the two hardcoded colors, keep the sizing rule if `.btn` doesn't already cover it) — matching every other primary action button in the app now (Results' `.nextButton`, ChaserSelection's `.voteButton`).

## Real behavior this ticket should NOT change
`revealReady` toggling, `handleCharacterSelect`/chaser-character-choice emit, `allReady` gating logic, the character-picker's grayscale-reveal hover mechanic.

## Scope
- `client/src/screens/RolesRevealScreen.vue` — template class changes only (e.g. `.revealContinue` → `.btn.btn-primary`), no markup restructuring needed.
- `client/src/style.css` — `.revealTop`/`.revealBottom` background changes, `.contestantCard` dark-card treatment + scoped `.contestantCard .contestantName` override, `.revealContinue` button-family swap, any small contrast follow-ups on `.revealChaserName`/`.revealLabel`.

## Acceptance
- Manual: start a game in vote mode (so the Chaser-picker path is exercised) and in random mode (so the plain reveal path is exercised), with 2+ browser clients — both halves of the screen read as dark-themed and consistent with the rest of the app (no leftover gradient, no white card), the Ready button matches the chunky primary-button family, and the character-picker's grayscale hover reveal still works exactly as before.
- Grep confirms no remaining `linear-gradient` reference in `.revealTop`/`.revealBottom` after the change.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation), 120/124 (`.lineupCard`/`.contestantName` dark-card precedent being reused here) — all already shipped.
