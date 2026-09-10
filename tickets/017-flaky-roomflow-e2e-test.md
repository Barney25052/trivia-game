# 017: Fix flaky `roomFlow` end-to-end test (server)

## Goal

`server/test/roomFlow.test.ts` (test **"walks the full flow end-to-end via the stub handlers"**) fails intermittently under full-suite load, so `npm test` is not reliably green. Make it deterministic.

## Scope / Reproduction

Failure signature (observed during ticket 015):

```
1) roomFlow
       walks the full flow end-to-end via the stub handlers:
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'offer'
- 'cashBuilder'

at Context.<anonymous> (test/roomFlow.test.ts:106:12)
```

Where it happens:

- The room is created with short durations at `test/roomFlow.test.ts:73-77`: `cashBuilderDurationMs: 80`, `chaserSelectionDurationMs: 80`, `teamFinalDurationMs: 80`.
- First contestant escapes → `gameFlow` reaches the second contestant's CashBuilder and `TriviaRoom.startCashBuilder` arms an **80ms** cash-builder timer.
- The test then `await sleep(80)` (line 105) and asserts `currentPhase === CashBuilder` (line 106) — the 80ms server timer races the 80ms sleep. When the timer wins, the phase is already `Offer`.
- The same race pattern exists at line 121→122: `chaseResult escaped:false` → 80ms `teamFinalDurationMs` timer versus `await sleep(80)` before asserting `TeamFinal`.

How to reproduce:

- `cd server && npm test` — observed failing **back-to-back** under full-suite load. Server log right before the assert shows: `made it back — N added to the team pot` → `Cash builder for <id> (round 2, 80ms)` → `Offer for <id>...` (timer already fired).
- `npx mocha -r tsx test/roomFlow.test.ts --exit --timeout 15000 --grep "walks the full flow"` — passes 3/3 in isolation (single test, low load).

Confirms it is a pre-existing timing flake, not a functional regression:

- Reproduced identically with ticket 015's client-only changes stashed (server code untouched by 015).
- It passed on earlier tickets; subtle load/timing shifts make the 80ms-vs-80ms boundary fail under the full suite.

Constraint: do not fix by inflating real durations to dodge sleeps — assert phases with deterministic waits (e.g. message waiters / polling with timeout) so the test no longer depends on an 80ms sleep outrunning an 80ms timer.

## Acceptance

- `cd server && npm test` green on 3 consecutive full-suite runs.
- The end-to-end test's phase assertions no longer race a server timer against a fixed sleep (no `sleep(X)` where `X === durationMs`).

## Dependencies

- None. Server-only, no client coupling.