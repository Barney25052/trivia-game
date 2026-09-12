# 066: Phase 4 integration tests — full board-chase flow

## Goal
End-to-end coverage for the real board chase (064 + 065), mirroring how 041 covered the full cash-builder flow — the room-level integration tests are what actually caught the honor-system trust gap in the original `chaseResult` handler, so this phase needs the same treatment before it's called done.

## Scope
- `server/test/`: new integration test file (e.g. `chaseFlow.test.ts`) covering, at the `roomFlow` stub-handler level (per `AGENTS.md` testing conventions):
  - A full chase round from `Offer` → `Chase` → escape (contestant reaches space 0, offer amount lands in `teamPot`, `chaserPot` debited).
  - A full chase round ending in a catch (Chaser reaches the contestant's space, contestant `isEliminated`, `chaserPot` grows by the round increment).
  - Both-sides-advance-on-one-correct-answer within the lockout window.
  - Authority/shape guards on the new chase-answer message (wrong phase, wrong role, malformed payload, stale/mismatched question id) — matching the guard-test pattern already used for `submitAnswer` (041) and the offer handlers (051).
  - Turn order: after a chase resolves, the next contestant's cash builder starts correctly (or `TeamFinal` if it was the last contestant) — this is existing `gameFlow` logic, just needs re-verification against the real chase trigger instead of the old stub message.

## Acceptance
- `cd server && npm test` green, test count grows meaningfully (call out the before/after count in the PR).
- Tests assert real behavior (position values, pot amounts, elimination flags) — not just "did not crash" (per `REVIEWERS.md`'s test-quality radar).

## Dependencies
- Depends on 064 (engine) — can be written alongside 064 rather than strictly after, if the same agent does both.
