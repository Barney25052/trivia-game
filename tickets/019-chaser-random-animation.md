# 019: Chaser selection: random-mode animation

## Goal

Random mode isn't a frozen "Picking the chaser…" card for 15–30 seconds — there's nothing to look at. Names visibly cycle (roulette/spinning feel) for the whole selection duration, then settle on the chosen Chaser the moment the server resolves.

## Scope

- `client/src/screens/ChaserSelectionScreen.vue`:
  - When mode is `random` and `chaserSessionId === ""`, rotate a highlight through `players` on an interval (~300ms), looping until resolution.
  - Stop the rotation the instant `chaserSessionId` becomes non-empty and pin the highlight on that player (the current `prop`; App.vue already passes it).
  - No artificial delay after resolution — settle as soon as the prop arrives.
- `client/src/style.css`: a `.chaserCycle` (or kebab-case equivalent) highlight class reusing the existing palette/custom properties; follow the CSS conventions (4-space, one declaration per line, trailing semicolons). No `<style scoped>`.
- Vote mode stays exactly as today (interactive).
- Client-only. No server changes — `chaserSessionId` is already broadcast by the room on resolution.

## Acceptance

- `cd client && npm run build` — clean
- In random mode, player names visibly cycle from phase entry until the Chaser is broadcast; then the highlight lands on and stays on that player
- Vote mode renders unchanged

## Dependencies

- None (client-only; sits on top of 014's screen).