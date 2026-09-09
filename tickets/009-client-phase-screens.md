# 009: Client: new phase screens + flow

## Goal

Client renders the new phases; delete the old 5-question flow.

## Scope

- In `client/src/App.vue`: drive `currentState`/screens from the `phase` message + `GamePhase` (extended in ticket 007). Keep the join/create/room-code logic and host detection.
- Replace screens under `client/src/screens/` with minimal placeholders for the new phases (they'll be built out in later phases):
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
- Home → Lobby still works against a running server (`cd server && npm start`, then `cd client && npm run dev`), and the app switchs screens as the phase message arrives.

## Dependencies

001, 007.