# 133: Home screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
`HomeScreen.vue` (name entry, Join/Create, the "Add questions" link) is one of the screens ticket 067's outcome note flagged as never covered by the Big Baws Style Guide conversation — it's still pre-115 (plain white input, default `.btn`-less buttons, no chunky/semi-skeuomorphic treatment the rest of the app now has).

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule, do not walk in with a redesign already decided. Before touching code:
1. Open the existing [Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc) mockup artifact and add a new section for Home, reusing the established tokens/components from ticket 115 (chunky `.btn` family, `.lineupCard`/`.ink-raised` dark surfaces, the established input chrome from ticket 129's `open-question-box`/section 03) rather than inventing new visual language.
2. Present the mockup section to the user, get sign-off (or iterate per their direction), *then* implement.
- Implementation once signed off: `client/src/screens/HomeScreen.vue` + `client/src/style.css` — the name input, Join/Create buttons, the room-code field (if present), and the "Add questions" link (`.addQuestionsLink`, added in ticket 092) all move to the agreed direction.

## Real behavior this ticket should NOT change
`handleJoin`/`handleCreate`/`add-questions` emits, any client-side validation already present, room-connection logic in `App.vue`.

## Acceptance
- A recorded punch list / agreed direction (as a mockup section the user has seen and approved), then a manual walkthrough with the user live in the browser per `AGENTS.md`.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must exist first for reuse.
