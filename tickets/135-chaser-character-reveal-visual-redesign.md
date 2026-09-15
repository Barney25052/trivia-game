# 135: ChaserCharacterReveal screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
`ChaserCharacterRevealScreen.vue` (ticket 059's phase between the first cash builder and the first offer, where the Chaser's picked character gets its own reveal beat) predates the Big Baws Style Guide pass and was never revisited — ticket 067's outcome note lists it as still open. It's also the site of `bug-011` (084, already fixed) — worth a fresh look now that it'll share real design-system tokens instead of bespoke `.ccrName`/`@keyframes chaser-character-name-in` rules.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Add a ChaserCharacterReveal section to the [Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc) mockup — this is a dramatic reveal beat (comparable in spirit to the ChaserSelection wheel/reveal redesigned in 123), so it likely wants the flat chase-red ground + name-reveal treatment established there rather than a from-scratch look.
2. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/screens/ChaserCharacterRevealScreen.vue` + `client/src/style.css` — replace bespoke reveal CSS with design-system tokens/animations where they already cover the same need.

## Real behavior this ticket should NOT change
The reveal timing/duration (`CHASER_CHARACTER_REVEAL` in `gameConfig.ts`), the phase transition into `Offer`.

## Acceptance
- A recorded, user-approved mockup section, then a manual walkthrough live in the browser per `AGENTS.md`.
- Grep confirms the old bespoke `.ccrName`/`chaser-character-name-in` rules are removed once superseded, not left alongside the replacement (no-cruft rule).
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must exist first for reuse.
