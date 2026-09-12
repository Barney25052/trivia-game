# 076: Chase authority guard test gap — a non-participant cannot answer, and active-contestant leave during Chase

## Goal
Phase 4 review finding: the chase **authority guards exist** but two server behaviours around them are untested:

1. **Non-participant guard** — `submitChaseAnswer` (`server/src/rooms/handlers/messageHandlers.ts:227-230`) rejects any seat that is neither the active contestant nor the chaser ("not in this chase!"). The `chaseFlow.test.ts` guard tests cover malformed payloads, once-per-role, stale question ids — but **no test sends an answer from a third, uninvolved client** (a waiting contestant or an already-eliminated seat). A stray client abusing the handler is exactly the "authoritative and role-checked" case AGENTS.md requires, and it is currently unproven.
2. **Active-contestant leave during Chase** — `onLeave` dispatches `contestantForfeit` for the active contestant in `CashBuilder`/`Offer` **and `Chase`** (added as part of 064), but `leaveFlow.test.ts` only covers cashBuilder (line 93) and offer (line 130). Chase leave is the newest and riskiest of the three.

## Scope
- `server/test/chaseFlow.test.ts`: add a test with three clients — after the Chase starts, a **third** client (a contestant who is not the active one) sends a well-formed `submitChaseAnswer` (`{ questionId, answerIndex }` matching the live question): assert it is rejected — no `chaseAnswers` entry, no `chaseLockoutStarted` broadcast, no board movement on either side, and the round stays answerable by the real participants.
- `server/test/leaveFlow.test.ts`: add a test mirroring the existing cash-builder forfeit (line 93) but in `Chase`: the active contestant's client leaves mid-chase → `contestantForfeit` → contestant eliminated, `chaserPot` grows, next contestant's cash builder (or `TeamFinal`) starts, and **no timers remain scheduled for the departed seat**.
- Tests only — no production code changes expected; if a guard turns out to be missing, the finding belongs in this ticket's scope (fix + regression test).

## Acceptance
- Both new tests above pass; full `cd server && npm test` green; `cd server && npm run build`.
- No changes to `client/`.

## Dependencies
- Ticketing on 064's chase engine (the alleles under test); independent of 074/075.