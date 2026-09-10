# 024: Clamp room-option duration overrides to gameConfig bounds

## Goal

`onCreate` trusts raw client-supplied durations for four timers (`cashBuilderDurationMs`, `chaserSelectionDurationMs`, `teamFinalDurationMs`, `chaserFinalDurationMs`) with no bounds — a client can pass `0`, negatives, or absurd values. AGENTS.md "Security → Clamp room options" requires clamping to `gameConfig` bounds; the bounds don't exist yet.

## Scope

- `server/src/gameConfig.ts`: give each timer config explicit bounds, e.g. `{ durationMs, minMs, maxMs }`. The lower bound must keep the short test overrides usable (suggest `minMs: 100`); the upper bound a sane ceiling (suggest `maxMs: 10 * durationMs`). Named constants, no bare numbers.
- `server/src/rooms/TriviaRoom.ts` `onCreate`: clamp every accepted override into `[minMs, maxMs]` instead of trusting it (a non-number/absent option keeps the default).
- Tests: creating a room with an out-of-bounds override yields the clamped value (`cashBuilderDurationMs: 0` → `minMs`; `1e15` → `maxMs`), in a new `clampRoomOptions.test.ts` (or roomFlow stub test).

## Acceptance

- `cd server && npm test` — green (clamping cases)
- `cd server && npm run build` — clean
- Out-of-bounds create options are clamped, never trusted

## Dependencies

- None. If run in parallel with 021/023 (both touch `TriviaRoom.ts`), merge after 021.