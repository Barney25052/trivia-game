# 082: Phase 5 integration tests — full final round end-to-end (server)

## Goal
Prove the whole final round plays correctly from `TeamFinal` through `GameEnd` — both winner paths (Chaser reaches/passes the team score; Chaser runs out of time) and the steal mechanics — at the room/integration level, in the style of `roomFlow.test.ts`/`chaseFlow.test.ts`, after 077–079 land individually.

## Scope
- Extend `server/test/finalRound.test.ts` (or add `server/test/finalRoundFlow.test.ts`) with room-level scenarios riding the stub-handler pattern used by `roomFlow.test.ts`:
  1. **Team round → Chaser round → Chaser win**: full walk — survivors X set `teamScore` start; correct team answers bump it; `finalTeamTimeout` → ChaserFinal; Chaser answers correctly until `chaserScore >= teamScore` → `gameEnd` winner **chaser** (assert the exact-tie case banks a chaser win).
  2. **Chaser timeout → team win**: walk the same route but let the Chaser's timer expire → `gameEnd` winner **team**.
  3. **Steal push-back in anger**: Chaser answers wrong, the team steals correctly (`chaserScore - 1`, floored at 0), then the Chaser still wins by climbing back.
  4. **Eliminated players answer in the team round** and their correct answers count toward `teamScore`.
  5. **End-to-end phase order** through a full game (reuse/shorten durations via the room-option overrides from 024): `... ChaserFinal` from the last contestant's chase is reached and the game terminates — no stale `gameFlow` path, no hang (and the null-bank team/chaser exhaustion path from 077 doesn't stall).
- Mirrors the guards already unit-tested in 077/078/079 — this ticket asserts the *composition*, not re-testing each guard.

## Acceptance
- All scenarios above green on `cd server && npm test` (full suite), `cd server && npm run build`.
- No client changes.

## Dependencies
- 077, 078, 079 (the final-round server pieces must exist first).