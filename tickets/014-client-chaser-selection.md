# 014: Client: chaser-selection screens (mode pick + votes)

## Goal

Players can pick the Chaser from the client: the host chooses **Random** or **Team Vote**, contestants cast votes, and everyone sees the selection resolve into the CashBuilder.

## Scope

- `client/src/TriviaTypes.ts` — add `ChaserSelection` member (in sync with 013's server enum; keep identical).
- New `client/src/screens/ChaserSelectionScreen.vue` (follow the `<script setup>` + emit pattern of `LobbyScreen.vue`, 4-space, double quotes):
  - **Host**: pick mode `random` | `vote` → emit to a `setChaserMode` handler; show current mode + "waiting".
  - **Vote mode**: every player sees the player list and can vote for a player (`chaserVote` → emit); grey out/disable once you've voted; show each player's `chaserVote` highlighting who's already voted.
  - **Random mode**: brief "picking the chaser…" state.
  - When the server resolves, phase moves on automatically (see App wiring below) — no manual continue button needed.
- `client/src/App.vue`:
  - Add `case GamePhase.ChaserSelection: return "chaserSelection";` to `currentScreen` (App.vue:26-38).
  - Import + render `ChaserSelectionScreen` with `players`, `isHost`, `chaserSelectionMode`, `chaserSessionId`, and register `setChaserMode`/`chaserVote` senders mirroring the existing `startGame`/`chooseOffer` helpers (App.vue:89-123).
  - Track `chaserSelectionMode` in `onStateChange` alongside the other schema fields (App.vue:59-66).
- Do **NOT** add rules/role reveal (015), chaser-character reveal, or any server logic.

## Acceptance

- `cd client && npm run build` — clean (this is the typecheck; screens must pass `vue-tsc`)
- `cd server && npm run build` — clean (enum stays identical across packages)
- `GamePhase.ChaserSelection` matches exactly between `client/src/TriviaTypes.ts` and `server/src/TriviaTypes.ts`
- Dev-server smoke check against ticket 013: host picks random → game reaches CashBuilder; host picks vote → all players vote → CashBuilder.

## Dependencies

- 013 (server selection phase, schema fields, `setChaserMode`/`chaserVote` messages).