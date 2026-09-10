# 025: Make "random" the explicit default chaser-selection mode (no more silent """)

## Goal

Random is the documented default (`gameConfig.CHASER_SELECTION.defaultMode`) and the lobby visually shows the Random button as selected — but until the host clicks a button, `GameState.chaserSelectionMode` is `""`. Every consumer has to replicate the fallback (`|| CHASER_SELECTION.defaultMode` server-side, `|| chaserSelectionMode === ''` client-side), and any literal comparison like `chaserSelectionMode === "random"` fails in the default state. That is currently breaking ticket 019's wheel (it never activates unless the host clicks Random) and is the kind of implicit-default drift this codebase should not have. Fix: store the default explicitly in state so `""` never appears.

## Scope

- `server/src/rooms/schema/GameState.ts`: `chaserSelectionMode: string = CHASER_SELECTION.defaultMode;` (i.e. defaults to `"random"`, imported from gameConfig), instead of `""`.
- `server/src/rooms/TriviaRoom.ts`:
  - `startChaserSelection` (TriviaRoom.ts:127): read `this.state.chaserSelectionMode` directly and drop the `|| CHASER_SELECTION.defaultMode` fallback (harmless belt-and-braces now that the schema defaults — but remove it so there is one source of truth).
  - `setChaserMode` (Lobby-only validation) stays; `chaserVote` in random mode should reject (ties into 023's authority work) — optional, only if quick.
- Server tests: `gameState.test.ts:25` and `roomFlow.test.ts:217` currently assert `""` — update to the new default; add a case that a fresh room reports `"random"` and a game started without any `setChaserMode` runs random picks (already implied, but assert the state value).
- `client/src/screens/LobbyScreen.vue:31`: remove `|| chaserSelectionMode === ''` so the Random button is selected by `chaserSelectionMode === "random"` alone.
- Grep for any remaining `chaserSelectionMode === ""` / `=== ''` comparisons — none should remain.
- **Do NOT touch `client/src/App.vue` or `ChaserWheelScreen.vue`** — in-flight 019 work. This ticket makes 019's `chaserSelectionMode === "random"` comparisons correct without editing them.

## Acceptance

- `cd server && npm test` — green (updated assertions + new default-mode case)
- `cd server && npm run build` and `cd client && npm run build` — clean
- A freshly created room has `state.chaserSelectionMode === "random"`; the lobby's Random button is selected by a real `"random"` value, not a `""` shortcut
- No `chaserSelectionMode` comparisons left that treat `""` as a meaningful state

## Dependencies

- None. Parallel-safe with 019 (different files — 019 is in `App.vue`/`ChaserWheelScreen.vue`/`style.css`; 025 is `GameState.ts`/`TriviaRoom.ts`/`LobbyScreen.vue`). 022 still owns the reveal-overlay removal.