# 136: ContestantLineup screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
`ContestantLineupScreen.vue` (the turn-order interstitial before the first cash builder, ticket 049) already borrowed the `.lineupCard` treatment that later became the reference dark-card style for Results (124) and RolesReveal (125) — but it hasn't itself been revisited since 120 (redundant "1st"/"Up first" fix). Ticket 067's outcome note still lists it as open; worth confirming it fully matches the design system now that other screens have converged on it, rather than the other way around.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Review the current `ContestantLineupScreen.vue` against the [Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc) with the user — it may turn out to already be close to done (per the same caveat 067 raised about RolesReveal, confirm rather than assume). If changes are wanted, add a Lineup section to the mockup first.
2. Present findings/direction to the user, get sign-off, then implement whatever's agreed (may be "no change needed").
- Implementation once signed off: `client/src/screens/ContestantLineupScreen.vue` + `client/src/style.css`.

## Real behavior this ticket should NOT change
The turn-order computation, `LINEUP.durationMs` hold, auto-advance into the first cash builder.

## Acceptance
- A recorded outcome (either a user-approved mockup section + implementation, or an explicit "confirmed already on-system, no change" note, mirroring ticket 067's own outcome format).
- `cd client && npm run build` passes if any change lands.

## Dependencies
- 115 (design system foundation), 120 (existing `.lineupCard` baseline).
