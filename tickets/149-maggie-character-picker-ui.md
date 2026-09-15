# 149: Maggie roster art + character picker entry — UI SIGN-OFF REQUIRED

**Superseded by ticket 150.** The layout question this ticket opened ("how does a 4th portrait fit?") grew into showing each character's abilities during picking too, once that entered scope — the mockup conversation and implementation now live under 150. Do not pick this ticket up; see 150 instead.

## Goal
Adds Maggie as a 4th pickable option on the Chaser's character picker during Roles Reveal — the roster grows from 3 to 4 for the first time, which is a real layout question, not a drop-in.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Mock up how `RolesRevealScreen.vue`'s `characterOptions` row handles a 4th portrait (reflow to a 2x2 grid? stay single-row and shrink? confirm against the Big Baws Style Guide's existing character-picker treatment).
2. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/screens/RolesRevealScreen.vue` (add Maggie to `availableCharacters`, import `maggie-icon.png` per ticket 139's `HUMAN_TASKS.md` row) + `client/src/style.css` if the grid needs new rules.

## Real behavior this ticket should NOT change
The ready-gate/character-validation logic (server, `revealReady` handler — already accepts any id in `CHASER_CHARACTERS` per ticket 139, needs no server change here).

## Acceptance
- A recorded, user-approved mockup, then a manual walkthrough live in the browser: all 4 characters selectable, picker layout holds up at normal window sizes.
- `cd client && npm run build` passes.
- `HUMAN_TASKS.md`'s `maggie-icon.png` row flipped to `done` once the user has actually dropped the art in (not part of this ticket's own commit if the art isn't ready yet — leave `todo` and note it in the ticket status table).

## Dependencies
139 (roster + `HUMAN_TASKS.md` row).
