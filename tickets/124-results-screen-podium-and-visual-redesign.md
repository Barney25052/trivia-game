# 124: Results screen podium ranking + visual redesign — UI SIGN-OFF REQUIRED

## Goal
Found during an autonomous polish pass (2026-09-14): `ResultsScreen.vue` is the most neglected screen in the app relative to the agreed design direction. It's still the original plain text list (`<p class="playerName resultsPlayerRow">Name — $X <span>status</span></p>` per contestant) with no character art at all, and it never implemented two decisions the design conversation explicitly confirmed early on and never revisited:
- *"the Results screen should put contestants back on their CharacterFace busts (reusing existing component) instead of a plain text list"* (round one of the design conversation, `feedback_visual_direction.md`).
- *"Podium (results screen): rank by most questions answered correctly, not by survival/madeItBack — rewards the quiz part of the game"* (a later round, same file).

Neither ever shipped. This is a real behavior change (the ranking order) plus a visual one (character busts instead of plain text), not just a restyle.

## Root cause
`ResultsScreen.vue` predates the whole 115-123 redesign effort and was never revisited — it wasn't in scope for 115-119 (which covered Lobby/Chase/Chaser Final/Team Final specifically) and the two confirmed design decisions above were never turned into a ticket.

## Proposed direction
**Ranking — real behavior change**: sort `contestants` by `cashBuilderCorrectAnswers` descending (already a real synced field, `server/src/rooms/schema/GameState.ts`) instead of the current unordered `players.filter(...)` pass-through. This is the exact metric the design conversation asked for — ties can break by `seatId` order (stable, doesn't need a rule beyond "don't crash/flicker").

**Layout — reuse `ContestantLineupScreen.vue`'s card family wholesale**, the same "physical roster" pattern already fully built and dark-styled, rather than inventing a new one: each contestant becomes a `.lineupCard` with a `.lineupAvatar` (`CharacterFace`), an ordinal badge (`.lineupOrdinal`, now ranking by correct answers instead of turn order), and the contestant's name. `.lineupCard-first` highlights whoever answered the most correctly. Add their cash-builder earnings and made-it-back/caught status inside the card (new small lines/badges — reuse `.resultsStatus-back`/`.resultsStatus-caught`'s existing green/red semantics, just moved from an inline `<span>` in a paragraph into the card). A caught contestant's card dims (`opacity: 0.6`, matching `.teamFinalPlayer-eliminated`'s existing convention for the same state elsewhere) — still shown, still ranked, just visually marked as not having made it back.

**Team pot — finally the shared "prize plaque"**: replace `.teamFinalPotBox`/`.teamFinalPotAmount` (a one-off white box, explicitly called out in ticket 118's footnote as "kept for ResultsScreen.vue... not yet redesigned") with the actual shared `.moneyPlaque` component (`.who`/`.amount` children) — this was supposed to be the *one* prize-plaque component reused everywhere per the very first round of the design conversation, and Results was the one place still holding out. No wipe/squeeze animation needed here (the game's over, nothing is actively scoring) — just the static plaque markup. Delete `.teamFinalPotBox`/`.teamFinalPotAmount` once Results no longer uses them (confirm via grep they have no other consumer — ticket 118 already checked this once and found only Results depended on them).

**Everything else**: `.resultsBanner` (the win/lose gradient banner) is already correct — Luckiest Guy, a gradient reserved for this kind of big-outcome moment — leave it untouched. `.nextButton` ("Main Menu") becomes `.btn.btn-primary`, matching every other primary action button in the app now. Ground stays plain navy (`.lobby`'s existing background) — this is a team-centric, not chase-centric, screen.

## Real behavior this ticket should change (called out explicitly, not a mistake)
- The contestant ordering: from `players.filter(...)` (join/turn order) to sorted-by-`cashBuilderCorrectAnswers` descending. This is the one intentional behavior change in this ticket, confirmed by the design conversation.

## Real behavior this ticket should NOT change
- `winner`/`chaserWon` logic, `survivorCount` computation, `madeItBack`/`cashBuilderMoney` values themselves, the `leave` emit / Main Menu navigation.

## Scope
- `client/src/screens/ResultsScreen.vue` — template restructuring (list → ranked card grid) and the new sort computed.
- `client/src/style.css` — new/adjusted rules; delete `.teamFinalPotBox`/`.teamFinalPotAmount` once confirmed orphaned.

## Acceptance
- Manual: finish a game with 2+ contestants, mixed outcomes (at least one made it back, at least one caught) — the results screen shows character-bust cards ranked by correct answers (not join order or survival), the top scorer visually highlighted, a shared prize-plaque for the team pot, and a chunky Main Menu button.
- Grep confirms `teamFinalPotBox`/`teamFinalPotAmount` have zero remaining references after the change (or are kept only if a real second consumer turns up that ticket 118 missed).
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation), 120 (`ContestantLineupScreen.vue`'s current card styling, being reused here) — both already shipped.
