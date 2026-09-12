# 083: Game-end results screen + drop the dead `GamePlayer.score` — UI SIGN-OFF REQUIRED

## Goal
Phase 5 review finding (also the payload of the final rounds): `ResultsScreen.vue` (`client/src/screens/ResultsScreen.vue`, rendered for `currentScreen == "gameEnd"`) reads `player.score` — a field that is **never written** (`server/src/rooms/schema/GameState.ts:17`; nothing sets it, it stays 0) — so the results screen has no real data to show. Once 079 lands there are final scores to display. **Per AGENTS.md this touches UI: present direction and get sign-off before implementing.**

## Proposed direction (for sign-off)
- **What it shows**: after `endGame { winner }`, render the outcome from real state — winner banner ("The Chaser caught you" / "The team made it back"), the final `teamScore` vs `chaserScore`, the banked `teamPot`, and the survivor count X. Any per-contestant money display should come from real fields (`cashBuilderMoney`, `madeItBack`) — not the dead `score`.
- **Dead code**: remove `@type("number") score` from `GamePlayer` (`GameState.ts:17`) and any remaining references (`ResultsScreen.vue`). Grep `player.score` / `.score` to confirm no other readers before deleting.
- **Visual**: follow the existing results/game-over styling in `style.css`; no new assets.

## Scope
- `server/src/rooms/schema/GameState.ts`, `client/src/screens/ResultsScreen.vue`, `client/src/App.vue` if the winner/score refs need lifting, `client/src/style.css` as needed.
- No message/flow changes — `endGame`, `teamScore`, `chaserScore`, `teamPot` are all already synced.

## Acceptance
- Manual 2-browser: complete a game to `GameEnd`; the results screen shows the correct winner, both final scores, the team pot, and the survivors — with a chaser-win game and a team-win game both distinguishing correctly.
- Grep confirms no remaining `.score` references against `GamePlayer` in `server/src` and `client/src`.
- `cd server && npm test`, `cd server && npm run build`, `cd client && npm run build` all green.

## Dependencies
- 079 (adds `chaserScore`; otherwise the results screen would only have half the scoreboard).