# 114: `chaseFlow` lockout-window test is timing-flaky (`bug-017`)

## Goal
`server/test/chaseFlow.test.ts:260-275` ("lockout window: the round resolves from just one side's answer once the window closes, without waiting for the other side") asserts against wall-clock `Date.now()` with only ~20ms of slack, so it fails intermittently under incidental system load (1 failure observed in 2 consecutive full `npm test` runs, always at this same assertion). Same family as the already-fixed `bug-003`/`bug-009` test-timing flakes (tickets 060/068).

## Scope
- `server/test/chaseFlow.test.ts` only.
- Widen the slack, or better, use the room's mocked/virtual clock instead of wall-clock timing — `scheduleTimer` (`server/src/timer.ts`) already supports a controllable clock per its own test suite (`server/test/timer.test.ts` — read it for the pattern already established there) — prefer that over a looser wall-clock bound if it's a straightforward swap, since it eliminates the flake source entirely rather than just making it less likely.
- No production code changes expected — this is a test-only fix.

## Acceptance
- `cd server && npm test` — run it several times in a row (at least 5) with no failures at this assertion.
- `cd server && npm run build` stays green.
- `BUGS.md`'s `bug-017` flipped to resolved, citing this ticket.

## Dependencies
- None.
