# 147: Offer screen — No Middle presentation (Bezos) — UI SIGN-OFF REQUIRED

## Goal
Makes Bezos's passive visible and dramatic on `OfferScreen.vue`: the contestant should clearly see the middle tier is off the table, not just notice a missing button.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Mock up: how the void reads on the offer board (the middle space stays empty/crossed out rather than simply never populating, so it doesn't look like a loading glitch), whether there's a beat/line calling it out (a Bezos-flavored quip already fits the existing auto-quip channel from ticket 057 — a natural place for something like "No middle ground with me" without inventing a new UI element), and how the contestant's pick buttons lay out with only two tiers instead of three.
2. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/screens/OfferScreen.vue` + `client/src/style.css`, reading the `middleVoided` field ticket 143 adds to the `offerStart`/`offer` broadcasts.

## Real behavior this ticket should NOT change
`setChaserLowOffer`/`setChaserHighOffer` (Bezos still sets numbers the same way), the underlying `middle` amount used to bound low/high (still computed and enforced server-side, just not offered as a pickable tier).

## Acceptance
- A recorded, user-approved mockup, then a manual walkthrough live in the browser with Bezos as Chaser (middle absent/voided, low+high work normally) and with another character (middle present, unchanged from today).
- `cd client && npm run build` passes.

## Dependencies
143 (server).
