# 100: Client — green background flash when a final-round answer is right — UI SIGN-OFF REQUIRED

## Goal
Confirm a right final-round answer with the same green full-screen flash the cash builder already uses (success feedback). Today the finals show nothing on a correct answer — the score just ticks.

## Proposed direction (for sign-off)
- Reuse the established flash pattern: `.cashBuilderScreenFlash` + `.cashBuilder-flash-correct` (`style.css:1068-1084`, token `--color-green-flash-rgb`) — or lift it into a shared class if the finals need the same stacking-context trick.
- **Trigger**: a green flash when a player answers correctly in the final round — a right team-final buzzer answer (`answerResult { correct: true }` on the answering player's client, and/or broadcast for everyone) and a right steal (`finalStealResolved { correct: true }` from 095). Mirror the cash builder's 0.6-0.7s auto-clear timer (`screenFlashTimeout`).
- **Who sees it**: propose **every team client** on a correct buzzer answer (the quest room reacts as a team) and every client on a correct steal — but that's a sign-off call; simplest correct-first version flashes the answering player's own client only. Red flash on wrong answers follows the cash-builder precedent and 096's outcome beat.
- Respect stacking contexts (`cashBuilderScreenFlash` notes at `style.css:1061-1066`) so the flash paints over the screen, not the page.
- style.css only; colours come from the existing tokens (part of the 088 palette system).

## Scope
- `client/src/screens/TeamFinalScreen.vue`, `client/src/screens/ChaserFinalScreen.vue`, `client/src/style.css`, `client/src/App.vue` (if the flash needs to be screen-global rather than per-screen).
- Not in scope: cash-builder changes, server.

## Acceptance
- Manual: right buzz-in answer in the Team Final → green flash (per the sign-off's "who sees it"); right steal in the Chaser Final → green flash; wrong answers flash red or show the existing reveal without the green.
- `cd client && npm run build` passes.

## Dependencies
- 095 (the extended `finalStealResolved { correct }` it provides) for the steal-triggered flash.