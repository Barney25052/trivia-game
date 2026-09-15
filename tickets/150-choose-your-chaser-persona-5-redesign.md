# 150: Choose your Chaser screen — Persona 5 roster + ability reveal — UI SIGN-OFF REQUIRED

## Goal
Redesigns `RolesRevealScreen.vue`'s character picker (the "Choose your Chaser" screen, shown only to the player who's the Chaser) into the Persona 5-styled roster built and iterated in the [Big Baws Style Guide](https://claude.ai/artifact/6Ew1F3Em73DU5tWuMwWEAP), section 17 "Chaser Roster — Persona 5": adds the 4th Chaser (Maggie), keeps the silhouette-until-hover idea but reveals with a diagonal slash-cut instead of a plain fade, and — new — surfaces each character's passive/active abilities while picking, not just their portrait and name.

**Supersedes ticket 149** (narrower scope: just add Maggie's portrait to the existing layout). This ticket covers the full redesign 149's layout question opened into once abilities entered scope; 149's row is marked superseded in `tickets/README.md`.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. The mockup already exists and has been through two rounds of live feedback (both folded into section 17 already):
- Dropped the `-webkit-text-stroke` outline from card/title/banner text — kept the hard offset shadow, lost the bubble-letter look.
- Ability chips get a real styled hover tooltip (`data-tip` attribute + CSS `::before`/`::after` pulling the description via `content: attr(...)`), not the browser's native `title` tooltip.

Before touching code: do a final live walkthrough of section 17 with the user (screen-share or the artifact link) to confirm it still holds up, since this ticket's history is iterative feedback, not a locked spec — capture any further adjustments before or during implementation.

Implementation once confirmed:
- `client/src/screens/RolesRevealScreen.vue` — replace the `characterPicker`/`characterOptions`/`chaserImage` markup with the mockup's structure: `.p5-stage` ground, `.p5-title-block` banner, `.p5-roster-row` of `.p5-card-tilt` > `.p5-card` (button) > `.p5-card-bg` (clipped diagonal shape) + `.p5-card-content` (portrait, name, tagline, ability chips) — the bg/content split is load-bearing, not decorative: a `clip-path` on an ancestor clips its own painted descendants exactly like `overflow:hidden`, so the ability chips' hover tooltips would get cut off at the card's angled edge if they lived inside the clipped element. `availableCharacters` grows to 4 (add Maggie, `maggie-icon.png` per ticket 139's `HUMAN_TASKS.md` row — still `todo`; her card renders the `.p5-card-silhouette` SVG bust instead of an `<img>`, permanently, until that art lands — not a placeholder for the *interaction*, everything else on her card behaves identically to the other three).
- `client/src/style.css` — port every `.p5-*` rule from the mockup (fan-tilt layout, slash-reveal, ability chips + tooltips, confirm banner, the reskinned mystery-bust frame for non-Chaser players) verbatim from the artifact, renamed to this project's naming convention only where it collides with an existing class.
- New `client/src/chaserAbilities.ts` — a small static lookup (tagline + passive[] + active[] display copy per character, plus the two shared abilities' copy) mirroring the pattern `chaserPortraits.ts` already uses for names/images. This is **display copy for a screen that runs before any server round-trip** (the Chaser is choosing, not yet confirmed), so it's a deliberate client-side duplicate of ticket 139's `gameConfig.ts` content — same precedent as the intentionally-duplicated `ChaserCharacter`/`GamePhase` enums (`AGENTS.md` gotcha) — not a new message or payload. Abilities are public character traits, not secret game state, so duplicating the copy carries none of the "never leak secrets" risk that rule is about.
- The "everyone else, still waiting" mystery-bust view (the `v-else` branch, shown to every non-Chaser player while picking is in progress) gets the angular `.p5-mystery-frame` reskin only — still the generic silhouette + the Chaser's real player name + ready tick, **no character or ability info**. That reveal still happens later, unchanged, at the Chaser Character Reveal phase (ticket 059/135).
- `fiftyFifty`/`skip` (the two shared abilities every Chaser gets) are **not** shown per-card — confirmed in the mockup's own note — since they belong to every pick regardless; they surface on the in-game ability tray instead (ticket 145), not repeated four times here.

## Real behavior this ticket should NOT change
The `revealReady`/character-validation handler (server already accepts any id in `CHASER_CHARACTERS` once ticket 139 lands), the phase transition into `Offer`, the Chaser Character Reveal phase's own timing (ticket 059) — the mystery view's reskin is purely visual.

## Acceptance
- A final recorded walkthrough of the mockup with the user (confirming or capturing last adjustments), then a manual walkthrough live in the browser: all 4 characters selectable and hoverable, Maggie's card behaves identically to the other three except her portrait stays the flat silhouette, the confirm banner plays on pick, the mystery-bust view (second browser client, non-Chaser) shows no ability/character info.
- Grep confirms the old `.characterPicker`/`.characterOptions`/`.chaserImage`/`.chaserSilhouette`-adjacent bespoke rules are removed once superseded, not left alongside the new `.p5-*` rules (no-cruft rule) — check `.chaserSilhouette` itself isn't still needed for the mystery-bust markup before deleting its styles.
- `cd client && npm run build` passes.

## Dependencies
- 139 (Chaser roster + ability data model + `Maggie` enum in both `TriviaTypes.ts` copies + `chaserPortraits.ts` entry) must land first — this ticket's `chaserAbilities.ts` mirrors that data, and the picker needs the `Maggie` enum value to exist.
