# 020: Lobby screen polish — readable names, settings to the side, drop "How to Play"

## Goal

The lobby is legible (no white-on-white player names) and the chaser-mode settings sit beside the room card where you'd expect them. The "How to Play" panel is removed by product decision — the roles-reveal screen already shows roles, and rules can return in-game later if wanted.

## Scope

- `client/src/screens/LobbyScreen.vue`:
  - **Name readability**: `playerName` rows are white on the gradient → invisible. Give them a color from `style.css`'s `:root` palette that reads against that background (do not repeat the same white that fails).
  - **Settings placement**: move the host's chaser-mode panel from underneath the room card into a side rail. `lobbyRow` already has an `aside` slot pattern — mirror it (this is where `rulesPanel` currently sits). Keep the Settings toggle button.
  - **Remove "How to Play"**: delete the button, its toggle state (`rulesOpen`), the `rulesPanel` aside content, and the `rulesText` markup entirely.
- `client/src/style.css`: remove the now-dead `.rulesPanel` / `.rulesText` declarations (no cruft), add a class for the side settings rail.
- No server changes.

## Acceptance

- `cd client && npm run build` — clean
- Player names readable in the lobby
- Settings panel renders to the side of the room card, not underneath it
- No "How to Play" button or rules panel anywhere

## Dependencies

- None. Note: partial reversal of 015's rules panel (roles reveal stays).