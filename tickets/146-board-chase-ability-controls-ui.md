# 146: Board-chase ability controls — 50/50, Double Time, Re-rack, Jumble — UI SIGN-OFF REQUIRED

## Goal
Gives the Chaser's ability-tray buttons (ticket 145) real, visible effects on `ChaseScreen.vue`, and renders each ability's outcome for everyone watching.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Mock up: how a narrowed 50/50 question re-renders (an option visibly removed/faded rather than just vanishing instantly?); how "Double Time armed" reads on the Chaser's side of the board (a visible badge?) and how its outcome (double-move vs. knocked-back-a-space) is called out on the existing `chaseQuestionResult` reveal beat; how Re-rack's "new question" moment reads (does it reuse the existing `chaseWipeBar` entrance, or need its own beat so it doesn't look like a normal question transition?); and — most novel — how Jumble's shuffled button order is communicated *only* on the contestant's own screen without confusing them (does it get a label like "Shuffled!" so they know why the order changed, or stay silent?).
2. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/screens/ChaseScreen.vue` + `client/src/style.css`, consuming ticket 145's tray for the trigger buttons and ticket 141's server broadcasts (narrowed `question.options`, `chaseQuestionResult.doubleTimeArmed`, the re-drawn question's new id, the contestant-only `displayOrder` field). The contestant's answer-button click handler must map the clicked *visual* position back through `displayOrder` to the real option index before emitting `submit-chase-answer` — the server always resolves against the true index, this is purely a client-side rendering permutation (see ticket 141's note).

## Real behavior this ticket should NOT change
`resolveChaseQuestion`'s scoring/board-movement math (server, already correct per ticket 141), the existing lockout pulse/countdown (ticket 072/087), the Caught/Escaped cutscene.

## Acceptance
- A recorded, user-approved mockup, then a manual walkthrough live in the browser with two clients (Chaser + contestant): trigger each of the four abilities at least once across a real chase and confirm the visible effect matches the sign-off mockup and the underlying board positions are correct.
- `cd client && npm run build` passes.

## Dependencies
141 (server mechanics), 145 (shared tray).
