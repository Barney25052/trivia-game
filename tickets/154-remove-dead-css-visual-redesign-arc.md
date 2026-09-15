# 154: Remove dead CSS accumulated across the visual redesign arc

## Goal
The ticket 137 whole-project review's no-cruft sweep (`AGENTS.md` "No cruft": "Dead CSS in `client/src/style.css` — no commented-out or orphaned rules") found five rule blocks in `client/src/style.css` with zero references anywhere in `client/src/**/*.vue` or `*.ts` — each superseded by a later ticket's replacement, or written for a feature that was never actually wired up. Remove them.

## Evidence (confirmed via repo-wide grep across `client/src/**/*.vue` and `*.ts`, excluding `style.css` itself, 2026-09-15)
- `.cashBuilderSubmit` / `.cashBuilderSubmit:disabled` (`client/src/style.css:1180-1187`) — ticket 129 added a real Submit button to `CashBuilderScreen.vue` using the shared `.oq-submit` class instead (`client/src/screens/CashBuilderScreen.vue:382`); `.cashBuilderSubmit` itself was never wired to any element and is now pure dead weight.
- `.characterOption-selected` (`client/src/style.css:192`) — `RolesRevealScreen.vue`'s actual character-picker markup (`client/src/screens/RolesRevealScreen.vue:39-47`) renders each option as `<img class="chaserImage" ...>` with no selected-state class at all; `.characterOption-selected` doesn't match any class the template ever applies.
- `.chaserSideLayout` plus its `@media (max-width: 900px)` block (`client/src/style.css:1440-1461`) — zero references in any `.vue`/`.ts` file.
- `.revealChaserYou` (`client/src/style.css:889-895`) — every "(you)" tag in the app (`ContestantLineupScreen.vue`, `RolesRevealScreen.vue`, `TeamFinalIntroScreen.vue`) uses `.contestantYou` instead; `.revealChaserYou` is unreferenced.
- `.plaque-squeeze.squeezing` plus `@keyframes plaque-squeeze` (`client/src/style.css:2666-2672`) — the rule's own comment describes it as "used alone for a purely delightful (no game effect) click on a money plaque," but no component ever toggles a `squeezing` class on anything; it was never wired to a click handler.

## Scope
- `client/src/style.css` — delete the five rule blocks above (and only those; don't touch `.moneyPlaque`/`.wiping`, which are live and used by `CashBuilderScreen.vue`/`OfferScreen.vue`/`ResultsScreen.vue`).
- Before deleting, re-grep each class name against the working tree in case a same-session ticket has since started using it — this list was accurate as of the ticket 137 review (2026-09-15 dev HEAD).
- Don't reintroduce or "fix" any of these into working features as part of this ticket — if the Cash Builder plaque-squeeze click effect or a character-picker selected-state highlight is wanted, that's a new UI ticket with its own sign-off, not a silent addition here.

## Acceptance
- `grep -rn "cashBuilderSubmit\|characterOption-selected\|chaserSideLayout\|revealChaserYou\|plaque-squeeze\|squeezing" client/src/style.css` returns nothing.
- `cd client && npm run build` passes.
- Visual smoke check (per `AGENTS.md`'s UI sign-off rule, since this touches `style.css` even though it's pure deletion of unreferenced rules): confirm Cash Builder, Roles Reveal's character picker, the Offer/Chase/Chaser-Final Chaser-side layout, the Lineup/Roles-Reveal/Team-Final-Intro "(you)" tag, and any money-plaque component all render unchanged.

## Dependencies
None — pure cleanup, independent of the rest of the queue.
