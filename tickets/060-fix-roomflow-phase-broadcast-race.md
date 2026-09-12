# 060: Fix `roomFlow` test race — `phases` array misses `RolesReveal` broadcast (`bug-003`)

## Goal
`server/test/roomFlow.test.ts:149` ("chaser reveal is its own phase") fails consistently: `waitForPhase` returns as soon as server state matches, but the client's `phases` array (populated by an `onMessage("phase", ...)` handler) can lag behind — a classic delivery-vs-state race, not a real game bug, but a flaky/broken test that erodes trust in the suite.

## Scope
- `server/test/roomFlow.test.ts`: fix `waitForPhase` (or the assertion pattern it feeds) so it doesn't race the `phase` broadcast — e.g. await the client's own `onMessage("phase")` delivery for the target phase (or a short subsequent tick) rather than only polling server-side state.
- Do not change any room/gameFlow behavior — this is a test-only fix for a documented race (`BUGS.md` bug-003).
- Re-run `npm test` several times (not just once) to confirm the flake is actually gone, not just less likely.

## Acceptance
- `cd server && npm test` passes on at least 5 consecutive runs with no `RolesReveal`-related failures.
- `BUGS.md` bug-003 flipped to `triaged` citing this ticket (done as part of this review).

## Dependencies
- None — isolated to the test file.
