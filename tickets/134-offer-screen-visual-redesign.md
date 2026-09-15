# 134: Offer screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
`OfferScreen.vue` is the one core-gameplay screen (Lobby/ChaserSelection/RolesReveal/Lineup/CashBuilder/Chase/TeamFinal/ChaserFinal/Results all redesigned by 115–129) that ticket 067's outcome note explicitly left open — it still carries its original low/mid/high tier boxes and Chaser quip bubble from tickets 052/055/056/057, never revisited against the Big Baws Style Guide.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Add an Offer section to the [Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc) mockup, reusing established components (`.moneyPlaque` for the three tiers, the chunky `.btn` family for the Chaser's low/high number entry and the contestant's pick buttons, the existing `ChaserPanel.vue` treatment already shared with Chase/Chaser Final).
2. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/screens/OfferScreen.vue` + `client/src/style.css`. `ChaserPanel.vue` itself is shared with Chase/Chaser Final (already redesigned) — reuse, don't fork.

## Real behavior this ticket should NOT change
`setChaserLowOffer`/`setChaserHighOffer`/`offerChoice` handlers and their validation (server-side, untouched), the persistent Chaser quip channel (ticket 055/057), spectator-wait behavior.

## Acceptance
- A recorded, user-approved mockup section, then a manual walkthrough live in the browser (Chaser setting low/high, contestant picking, spectators waiting) per `AGENTS.md`.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must exist first for reuse.
