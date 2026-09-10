# 041: Phase 2 integration tests — full cash builder flow

## Goal
Phase 2's server-side pieces (038, 039) need an end-to-end integration test that exercises the complete cash builder flow: get-ready cooldown → first question delivered → correct answer → pot incremented → wrong answer → pot unchanged → next question delivered → timer expires → transition to Offer with correct pot total. This catches wiring bugs between the question manager, answer handler, room effects, and gameFlow transitions that unit tests alone miss.

## Scope
- Create `server/test/cashBuilderFlow.test.ts` (or extend `roomFlow.test.ts` if the existing flow-walk test is the right home — evaluate which is cleaner).
- Use the stub-handler integration pattern from `roomFlow.test.ts` (short timers via `gameConfig` overrides, direct `dispatch` calls).
- **Test: full cash builder round**:
  1. Walk the flow to `RolesReveal` → all ready → `CashBuilder` (getReady cooldown fires → startCashBuilder).
  2. Assert a `"question"` message was broadcast to the active contestant with `{ questionId, prompt, category }` — no answer field.
  3. Send `submitAnswer` with the correct answer → assert `cashBuilderMoney` increased by 1000, `cashBuilderQuestionsAsked` is 1.
  4. Assert a new `"question"` broadcast arrived (different `questionId`).
  5. Send `submitAnswer` with a wrong answer → assert `cashBuilderMoney` unchanged, `cashBuilderQuestionsAsked` still 1.
  6. Assert another `"question"` broadcast.
  7. Let the cashBuilder timer expire → assert phase transitions to `Offer`.
  8. Assert the `startOffer` effect's offer amounts are based on the earned `cashBuilderMoney` (middle = pot, low = pot/2, high = pot*2).
- **Test: authority guards**:
  - Send `submitAnswer` from a non-active player → assert rejected (no pot change, no question advance).
  - Send `submitAnswer` in the Offer phase → assert rejected.
  - Send `submitAnswer` with missing `answer` field → assert rejected.
  - Send `submitAnswer` with missing `questionId` → assert rejected.
- **Test: bank exhaustion edge case** (optional but recommended):
  - Mock or configure a tiny bank (2 questions). Walk a cash builder round that exhausts it. Assert the last `"question"` broadcast signals done (null payload or `{ done: true }`). Assert the timer still transitions to Offer.

## Acceptance
- `cd server && npm test` passes (new + existing — 0 regressions).
- `cd server && npm run build` passes.
- The full cash builder flow is covered by at least one integration test that asserts question delivery, answer checking, pot increments, and the transition to Offer.

## Dependencies
- Depends on 039 (server-side cash builder wiring).
- Should be done after 040 (client screen) is complete, but the tests are server-only and don't require the client.
