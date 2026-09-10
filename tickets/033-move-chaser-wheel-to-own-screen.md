# 033: Move chaser wheel overlay into its own screen in the phase flow

## Goal
The chaser wheel is currently a full-screen fixed overlay (`wheelOverlay`, z-index 10) that sits on top of the RolesReveal phase screen during its ~5 s landing animation. Ticket 022's acceptance required "nothing in the app is ever drawn on top of the active phase screen" (all-overlay removal), yet 019 deliberately re-introduced the overlay because the wheel IS the reveal moment. The wheel covering RolesReveal for ~5 s is a fine product choice, but it quietly reverses 022's blanket rule and makes the overlay lifecycle implicit. Move the wheel into its own screen in the phase flow so it is always the active phase screen — no overlay over another screen, ever.

## Scope
- Add a new `GamePhase` value (e.g. `ChaserReveal`) between `ChaserSelection` and `RolesReveal` in both `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts`.
- `server/src/gameFlow.ts`: `chaserSelectionComplete` transitions to `ChaserReveal` (not `RolesReveal`). A new event (e.g. `chaserRevealComplete`, fired by a server timer after the wheel animation duration) transitions `ChaserReveal → RolesReveal`.
- `server/src/rooms/TriviaRoom.ts`: wire a timer on `ChaserReveal` entry (duration = wheel animation time from `gameConfig`). On timeout, dispatch `chaserRevealComplete`.
- `client/src/App.vue`: add `ChaserReveal` to the phase→screen map. Move `ChaserWheelScreen.vue` from an overlay into a normal phase screen (remove the `wheelOverlay` z-index/fixed positioning; it renders as the full screen when active).
- Remove the overlay state (`showWheel`, z-index layering) from `App.vue` — the wheel screen is now just another phase screen.
- `client/src/style.css`: remove `.wheelOverlay` / `.wheelViewport` fixed-position rules if they're no longer needed.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- No overlay is rendered on top of any phase screen — the wheel is its own screen in the flow.
- The flow is: `ChaserSelection → ChaserReveal (wheel plays) → RolesReveal → CashBuilder`.
- Grep: no `wheelOverlay` or `z-index: 10` overlay references remain for the wheel.

## Dependencies
- None. Works independently of other phase-flow changes.
