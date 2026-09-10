# 015: Client: show roles + rules to all players

## Goal

Every player sees their role (Chaser vs Contestant) and the game rules before play; once selection resolves, the Chaser's identity is clearly revealed to the room. Client-only — the server already syncs `GamePlayer.role` and `chaserSessionId` (013).

## Scope

- Role display: badge each player in `LobbyScreen.vue` (and the future `ChaserSelectionScreen`) with `Contestant` / `Chaser` based on `players[i].role`; when `chaserSessionId` is non-empty show a prominent line, e.g. "**Name** is the Chaser" — and if that's you, "You are the Chaser".
- Rules panel: a small static read-only summary extracted from GOAL.md's rules (cash builder 60s/$1k, offers high/middle/low, 7-space board + 5s timer, team final 2 min each) shown in the lobby for everyone — keep it a plain component/data array, no router.
- Placement suggestions: `client/src/screens/RulesPanel.vue` + `client/src/screens/roles` helpers, or inline in `LobbyScreen.vue` — your call to keep files small (AGENTS: small focused files).
- Client `script setup` style, 4-space indent, double quotes.
- Do **NOT** implement chaser-character selection / reveal drama (stretch goal); no server changes.

## Acceptance

- `cd client && npm run build` — clean
- Rendered lobby shows a role for every listed player + the rules panel
- After a resolved selection (`chaserSessionId` set), the Chaser's name is visible to all players

## Dependencies

- 013 (schema/role assignment). Can run in parallel with 014 (different screens; coordinate any shared `LobbyScreen.vue` edits).