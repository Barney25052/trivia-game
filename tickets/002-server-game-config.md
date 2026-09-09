# 002: Server game-config constants + role enum

## Goal

Single place for the game's tunable values and player roles, so later logic shares one source of truth.

## Scope

- In `server/src/TriviaTypes.ts` (or a new `server/src/gameConfig.ts`), define a `PlayerRole` enum: `Contestant` / `Chaser`.
- Define exported constants for the locked-down rules (see `GOAL.md`):
  - Cash builder: 60s duration, `$1000` per correct answer.
  - Chaser pot: starts at `$50,000`, `+$30,000` per round, payouts deducted.
  - Board: 7 spaces (1–7), offer starts at 4 (lower) / 5 (middle) / 6 (high); Chaser starts at **8** (off board), first correct moves to **7**; escape at **space 0**; catch = Chaser reaches contestant's space.
  - Chase question: 3 options, 5s answer window once one side answers.
  - Final round: team 2 min, chaser 2 min; team starts at X = survivors count.
- Add `server/test/gameConfig.test.ts` asserting a handful of these values so drift is caught.

## Acceptance

- `cd server && npm test` — new test passes.
- `cd server && npm run build` passes.
- Each constant is consumed by at least one test (no unused config).

## Dependencies

None.