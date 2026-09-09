# 009: Client: new phase screens + flow

> Updated after 001–006: the server no longer syncs a `QuizState` — it syncs `GameState` (006), so fields like `currentState`/`currentRound`/`answer`/`answered` are gone. The client's `App.vue` still reads `newState.currentState` (line ~52) and will need to follow `newState.currentPhase` + the server's `phase` message (008). The client `GamePhase` enum is extended in 007 and must stay identical to the server's copy. The client build is green again (001 fixed the `erasableSyntaxOnly`/`.vue`-shim issues), so enum use is fine in `vue-tsc`.

## Goal

Client renders the new phases; delete the old 5-question flow.

## Scope

- In `client/src/App.vue`: drive `currentState`/screens from the `phase` message + `currentPhase` + `GamePhase` (extended in ticket 007). Keep the join/create/room-code logic and host detection.
- Replace screens under `client/src/screens/` with minimal placeholders for the new phases (they'll be built out in later phases). Existing files: `HomeScreen.vue`, `LobbyScreen.vue`, `QuestionScreen.vue`, `ResultsScreen.vue`, `Template.vue`:
  - `LobbyScreen` (list players, host controls — chaser selection is Phase 1, keep simple)
  - `CashBuilderScreen` (typed answer input + 60s countdown display)
  - `OfferScreen` (show the three offers; contestant picks — real chaser logic is Phase 3)
  - `ChaseScreen` (3-option buttons + board position indicators 0–8)
  - `TeamFinalScreen` / `ChaserFinalScreen` (countdown + answer input)
  - `ResultsScreen` (win/loss + scores)
  - Delete `QuestionScreen` / `Template.vue` and any old-flow remnants.
- Board rendering can be basic (numbered spaces 0–8, show player + chaser position) — polish later.

## Acceptance

- `cd client && npm run build` (vue-tsc + vite) passes.
- Home → Lobby still works against a running server (`cd server && npm start`, then `cd client && npm run dev`), and the app switches screens as the phase message arrives.

## Dependencies

001, 007.