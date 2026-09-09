# 003: Cancellable room timer utility

## Goal

Server-authoritative timers that work with Colyseus' Room lifecycle (auto-cleaned on dispose) and are testable in isolation.

## Scope

- New `server/src/timer.ts`: a small wrapper around the Colyseus Room clock (`this.clock.setTimeout`) exposing something like:
  - `scheduleTimer(room, delayMs, onFire)` → `{ cancel() }`
  - Callbacks must NOT fire after room dispose or after `cancel()`.
  - Keep it generic — game logic in later tickets will build rounds on it.
- Put tests in `server/test/timer.test.ts` (short real delays, e.g. 20–50ms; the mocha timeout is 15s).
- Do NOT implement game rounds here.

## Acceptance

- `cd server && npm test` — timer tests pass (fires on time, cancel prevents fire).
- `cd server && npm run build` passes.

## Dependencies

None.