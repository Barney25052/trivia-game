# 093: Client — Team Final target/steps row (parity with the Chaser Final) — UI SIGN-OFF REQUIRED

## Goal
The Team Final screen has no visual representation of the target — just "Team score: N". Add the same **steps-to-reach row** the Chaser Final already has: one box per point of `teamScore`, starting at X (the number of contestants who made it back) and growing by 1 for every correct team answer (and when a steal raises the target mid-Chaser-Final).

## Proposed direction (for sign-off)
- The Chaser Final already renders this row (`chaserFinalTargetRow` + `chaserFinalTargetBox`/`-filled`, `ChaserFinalScreen.vue:236-243`, `style.css:1998-2026`) driven by `teamScore` (box count) with fill-by-`chaserScore` progress.
- **Extract it into a shared row** rather than copying a second class definition (the "No cruft" rule): rename `chaserFinalTargetRow`/`chaserFinalTargetBox`/`chaserFinalTargetBox-filled` → a shared `finalTargetRow`/`finalTargetBox`/`finalTargetBox-filled` (update both screens) and render it on `TeamFinalScreen` too, between the header and the question area.
- Same semantics on the team side: boxes `1..teamScore`; filled = `box.index <= chaserScore`. During the team's own section `chaserScore` is 0, so the row renders as the target the team is holding (unfilled boxes with their point numbers) — it ticks upward on every correct answer. Spy on the existing score label for the "how many you've banked" context.
- Server needs nothing — `teamScore`/`chaserScore` are already synced to every client.
- style.css only; the id-animation/pop on the score can reuse the target-box beat when a box appears.

## Scope
- `client/src/screens/TeamFinalScreen.vue`, `client/src/screens/ChaserFinalScreen.vue`, `client/src/style.css`.
- Not in scope: the steal-target visuals on the Chaser Final (chase table is not involved), touching the server.

## Acceptance
- Manual 2-browser walk to TeamFinal: the row renders with exactly `teamScore` boxes (== survivors at the start); a correct buzzer answer bumps it +1 on **both** clients; a steal that raises the target grows it; the Chaser Final still shows the identical row.
- `cd client && npm run build` passes; the old `chaserFinalTargetRow` class name is gone everywhere (grep).

## Dependencies
- None.