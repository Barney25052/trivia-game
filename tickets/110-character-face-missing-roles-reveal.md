# 110: Contestants' custom characters aren't shown on the Roles Reveal screen (user report)

## Goal
Ticket 102 wired the shared `CharacterFace` component into CashBuilder, Offer, Chase, TeamFinal, ChaserFinal, and ContestantLineup — but not `RolesRevealScreen.vue`, which the user has now flagged as a gap: a contestant's custom-picked character isn't visible there.

## Current state
`client/src/screens/RolesRevealScreen.vue` currently only renders a **Chaser character picker** (`characterPicker`/`characterPickerLabel`/`characterOptions`, ~lines 36-46) — the Chaser choosing which roster portrait (Bezos/Big Stan/Nami) to play as. That's a different, pre-existing system (`CHASER_CHARACTERS` in `gameConfig.ts`) and is unrelated to a contestant's custom `character` codec avatar from 101/102. Read the rest of the screen (the player list it presumably renders showing names/roles) to find where each player's identity is displayed, and add their `CharacterFace` there.

## Proposed direction (for sign-off)
- Wherever `RolesRevealScreen.vue` lists players (likely showing name + role — Chaser vs Contestant), render each **contestant's** avatar via `<CharacterFace :character="player.character" />` next to their name/role, same as the player list treatment already established in `LobbyScreen.vue` by ticket 102. The Chaser keeps their roster portrait/picker as-is — do not touch that part.
- Match sizing/placement to how this screen already lays out its player rows; don't redesign the screen beyond adding the avatar.

## Scope
- `client/src/screens/RolesRevealScreen.vue`, `client/src/style.css` only if a new small layout tweak is needed to fit the avatar into the existing row.
- Not in scope: the Chaser's own character/portrait picker on this screen (leave as-is), any other screen (102 already covered the rest).

## Acceptance
- Manual 2-browser: pick a distinctive character in the Lobby, reach Roles Reveal — that contestant's real picked avatar (not a placeholder or nothing) is visible on every client, including spectators and the Chaser.
- `cd client && npm run build` passes.

## Dependencies
- 101, 102 (both already shipped).
