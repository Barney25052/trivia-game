# 120: Lineup screen shows redundant "1st" + "Up first" on the same card (user report)

## Goal
User report (2026-09-13): the Contestant Lineup screen shows duplicate information for whoever's up first — both the ordinal badge and a separate tag say the same thing.

## Root cause
`client/src/screens/ContestantLineupScreen.vue`: every card renders `contestant.ordinal` (`"1st"`, `"2nd"`, `"3rd"`, ...) via `computed lineup`, and the first-position card additionally renders a `v-if="contestant.position === 1"` `lineupFirstTag` reading "Up first" (line 45). For the first contestant these say the same thing side by side ("1st" ... "Up first").

## Proposed direction
- Keep the ordinal badge for every contestant (it's the only positional info for 2nd/3rd/etc., so it stays useful) and drop the separate "Up first" tag — the highlighted `lineupCard-first` styling plus "1st" already communicates it without a second label repeating the same fact.
- If dropping the tag reads as too subtle once it's actually on screen, an acceptable alternative is the reverse — keep "Up first" and suppress the ordinal specifically for position 1 (so position 1 shows "Up first" alone, positions 2+ show "2nd"/"3rd"/etc. as today). Either resolves the duplication; use judgement once it's rendering for real, and note which you picked.
- This is a small, single-file fix — don't restructure the rest of the screen.

## Scope
- `client/src/screens/ContestantLineupScreen.vue`, `client/src/style.css` only if a class becomes dead and needs removing (no-cruft rule).

## Acceptance
- Manual: reach the Lineup screen with 2+ contestants — the first contestant's card shows exactly one "you're up first" signal, not two overlapping ones; other positions still show their ordinal.
- `cd client && npm run build` passes.

## Dependencies
- None.
