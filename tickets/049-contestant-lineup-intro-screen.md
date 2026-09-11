# 049: Contestant lineup intro screen before the first cash builder

## Goal
As the game proper starts (right after the roles reveal / once everyone is ready), show a short "lineup" interstitial that lists the contestants in play order — 1st, 2nd, 3rd, … — then rolls straight into the cash builder for contestant 1. Makes the turn order legible up front and sets up the "one at a time" pacing before the first round.

## Scope
- **Server** (`gameFlow.ts`, `TriviaTypes.ts` both copies, `effects.ts`, `gameConfig.ts`):
  - Add `GamePhase.Lineup` to `server/src/TriviaTypes.ts` AND `client/src/TriviaTypes.ts` (must stay identical).
  - gameFlow: `revealAllReady` → `Lineup` → `CashBuilder` (a hold phase like ChaserReveal), with a `startLineup` effect that runs a configurable duration timer (add `LINEUP.durationMs` to `gameConfig.ts`, ~5s, clamped like the others) and auto-dispatches `lineupComplete`.
  - No schema change needed for the list itself — `contestantsOrder` is already synced.
- **Client**: new screen component (client/src/screens/ContestantLineupScreen.vue) rendering the contestants in `contestantsOrder` order (names + "1st"… ordinal) and, once ready, auto-forwarding to the cash builder when the phase flips. Wire it into `App.vue` `currentScreen`; add styles to `client/src/style.css` (reuse `lobby`/`playerName`/`contestantCard` classes where possible).
- **UI sign-off first** (AGENTS.md rule): present the intended screen — layout, ordinals vs plain list, chaser presence, how long it lingers — before implementing.

## Acceptance
- `cd server && npm test` (new transition test: Lobby → … → RolesReveal → all-ready → Lineup → timer auto-advance → CashBuilder), `npm run build` in both packages. TriviaTypes parity verified by build.
- Manual: after all-ready, the lineup shows for the configured duration, then contestant 1's get-ready/cash-builder screen appears.

## Dependencies
- None (rides the existing `revealAllReady` → CashBuilder path).