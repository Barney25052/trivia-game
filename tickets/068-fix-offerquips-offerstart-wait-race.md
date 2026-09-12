# 068: Fix `offerQuips` test flake — `waitForMessage("offerStart")` registered after the broadcast is delivered (`bug-009`)

## Goal
The single room test in `server/test/offerQuips.test.ts` ("offerStart / offerLowSet / offer all carry a pool quip...") fails intermittently (`Error: message 'offerStart' was not called. timed out (3000ms)` — 3 of 5 full-suite runs on clean `dev` HEAD). `reachOffer` returns as soon as server state is `Offer` (polled via `waitForPhase`), but by then `startOffer` has already broadcast `offerStart` (the `startCashBuilder` effect schedules a `cashBuilderDurationMs: 250` timer; when it fires, the effect broadcasts `offerStart` and `setPhase(Offer)` runs right after). The test registers `alice/bob.waitForMessage("offerStart")` only after `reachOffer` returns, and the SDK's `waitForMessage` listens for *future* messages only — so when the client has already received `offerStart`, the promise never resolves and the test times out. Same delivery-vs-state race family as bug-003 (fixed in 060); here the race is on the message listener registration, not a `phases` array.

## Scope
- `server/test/offerQuips.test.ts`: register the two `offerStart` `waitForMessage` listeners (`alice` and `bob`) **before** the broadcast can be delivered — the natural spot is right after `waitForPhase(room, GamePhase.CashBuilder)` inside `reachOffer` (the cash-builder timer has not yet fired, so there is a deterministic 250ms window), then return them from `reachOffer` and have the test `await` those same promises instead of registering fresh ones.
- The `offerLowSet` and `offer` registrations are driven by test-triggered `setChaserLowOffer`/`setChaserHighOffer` broadcasts that happen after `reachOffer` returns, so they are not racy — leave them as-is unless it reads cleaner to move them into `reachOffer` too.
- Do not change any room/gameFlow/effects behavior — this is a test-only fix.
- Re-run `npm test` several times (not just once) to confirm the flake is actually gone, not just less likely.

## Acceptance
- `cd server && npm test` passes on at least 5 consecutive runs with no `offerQuips` failures.
- `cd server && npm run build` green.
- `BUGS.md` bug-009 flipped to `triaged` citing this ticket (done as part of this review).

## Dependencies
- None — isolated to `server/test/offerQuips.test.ts`. (Ticket 060's `waitForPhaseBroadcast` helper in `roomFlow.test.ts` is the reference pattern if the fix instead gates on client-side delivery.)