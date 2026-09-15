# 148: Final-round ability controls — Skip, Pushback Immunity, Time Bonus, Short Fuse, Silence — UI SIGN-OFF REQUIRED

## Goal
Surfaces the final round's one active ability (Skip) as a real control, and gives the three passives (Pushback Immunity, Time Bonus, Short Fuse) plus Maggie's Silence enough on-screen presence that players understand why the clock moved, a steal didn't land, or a buzz was refused — without it reading as a bug.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Mock up, for `ChaserFinalScreen.vue`: the Skip button (from ticket 145's tray) and its "question just changed, no consequence" beat; how a `pushbackBlocked: true` steal outcome (ticket 142) reads differently from a normal push-back on the existing steal-table interaction (ticket 096) so the team understands their correct answer *did* land, it just didn't move the target; a small +0.5s tick indicator on the Chaser's clock display when Time Bonus fires (Big Stan); whether Short Fuse's 10s window (Nami) needs any callout beyond the countdown simply reading a smaller number than usual.
2. Mock up, for `TeamFinalScreen.vue`: how the buzz-in button communicates a `SILENCED` rejection (ticket 144) to the specific player it happened to — a shake + message rather than a silent no-op, since this is confusing if unexplained (the show's audience needs to see this is a rule, not a bug).
3. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/screens/ChaserFinalScreen.vue`, `client/src/screens/TeamFinalScreen.vue`, `client/src/App.vue` (wiring the new `SILENCED` error and `pushbackBlocked` field through), + `client/src/style.css`.

## Real behavior this ticket should NOT change
The steal transport/hold mechanics (tickets 094–096), the buzz-in lock mechanics (ticket 078) beyond the one new rejection reason, the Chaser-final clock's pause/resume mechanics (ticket 094) beyond Time Bonus's extension already computed server-side.

## Acceptance
- A recorded, user-approved mockup, then a manual walkthrough live in the browser covering: Skip mid-Chaser-Final, a Bezos steal that's blocked vs. one that isn't (after 3 charges), a Big Stan correct answer visibly extending the clock, and a Maggie team-final round where the same player is visibly blocked from re-buzzing.
- `cd client && npm run build` passes.

## Dependencies
142 (server final-round abilities), 144 (server Silence), 145 (shared tray).
