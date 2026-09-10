# 028: Clear the chaser-wheel overlay on leave/disconnect

## Goal
`App.vue`'s `wheelActive` ref is only ever reset in `joinLobby` (before a fresh join) or via the wheel's `@reveal` emit (after landing). If a player leaves the room or the room disconnects (host drop kicks everyone, close code 6767) while the wheel is animating — the entire random-mode selection window ~8–13s — `wheelActive` stays `true`, so `ChaserWheelScreen` keeps spinning endlessly over the home screen with an empty/stale player list.

## Scope
- `client/src/App.vue`:
  - `handleLeave()` — reset `wheelActive` (alongside the existing `room.value = null`).
  - the `onLeave` handler — reset `wheelActive` (and check the other transient screen refs, e.g. `getReadyCooldownMs`, `currentOffer`, `winner`, while you're here — leaving a game should not carry stale phase artifacts into the next join).
- Optional: reset `wheelActive` when `currentScreen` leaves `chaserSelection` (covers the case where the phase moves on before the wheel finishes without relying on the emit).

## Acceptance
- `cd client && npm run build` passes.
- Manual: join a room set to random mode, start the game to trigger the wheel, then leave (or have the host leave to kick the room) — the wheel overlay disappears and the home screen is reachable, no lingering animation.

## Dependencies
- None. Client-only.