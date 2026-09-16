# 158: `roomFlow` full-walkthrough test is flaky against the real-timer rate limiter (`bug-022`)

## Goal
`server/test/roomFlow.test.ts`'s `"walks the full flow end-to-end via the stub handlers"` test intermittently fails with `Error: message 'endGame' was not called. timed out (3000ms)`, preceded by `<sessionId> rate limited: <n> messages within <windowMs>ms` in the log. Found 2026-09-16 while verifying ticket 147 (which doesn't touch server code — confirmed this is pre-existing, not a regression from that ticket).

## What was observed
- The test passes reliably in true isolation (`npx mocha --grep "walks the full flow..."` alone, run repeatedly) — completes in ~1.2-1.3s.
- Run as part of the full `npm test` suite (391 other tests first), it fails intermittently: observed **failing twice and passing twice across 4 consecutive full-suite runs** on the same unmodified `dev` HEAD, no code changes between runs.
- The rate limiter (`server/src/rooms/TriviaRoom.ts`'s `checkRateLimit`, config `RATE_LIMIT.maxMessages: 20` / `RATE_LIMIT.windowMs: 10_000`, `server/src/gameConfig.ts`) is real-wall-clock-based (`Date.now()`), scoped per-room-per-`sessionId` (not leaked across rooms/tests — confirmed by reading the implementation). The stub-handler-driven full-flow test drives an entire game (Lobby → chaser selection → roles reveal → lineup → cash builder → offer → chase, repeated per contestant → team final → chaser final → game end) about as fast as the event loop allows, with no artificial pacing between stub-sent messages.
- This looks like the same class of issue ticket 114 already fixed once in `chaseFlow.test.ts` (a wall-clock assertion with too little slack, intermittent under system load) — a real-timer race, not a logic bug. Whether the *specific* trigger here is "a genuine burst of 20+ messages from one session lands inside one real 10s window when the system happens to be fast" or something else needs confirming, not assuming.

## Scope
- Investigate whether this specific test's stub-handler sequence can legitimately send 20+ messages from a single `sessionId` within a real 10-second window — if so, that's the actual proximate cause (a fast-enough machine/moment lets it happen; a slower one spreads the same messages past the window naturally).
- Fix using the same tools ticket 114 established for real-timer test flakiness in this codebase: give this test's own room a generous `rateLimitMaxMessages`/`rateLimitWindowMs` room-option override (the same override mechanism `clampRoomOptions` already exists for — short-duration/relaxed-limit overrides for tests are explicitly supported per `AGENTS.md`'s "Clamp room options" section) rather than a global rate-limit change, OR pace the stub handlers with tiny artificial delays if that's a better fit for this specific test's style. Do not weaken the production `RATE_LIMIT` defaults — this is a test-tuning fix, not a product-behavior change.
- Re-run the full suite at least 5 times after the fix to confirm the flake is actually gone, not just less frequent (mirror ticket 114's own verification rigor).

## Acceptance
- `cd server && npm test` run 5 consecutive times, all green, no `rate limited` log line appearing anywhere near this specific test.
- `cd server && npm run build` green.
- No change to `RATE_LIMIT`'s production defaults in `gameConfig.ts` unless investigation genuinely concludes that's warranted (explain why, if so).

## Dependencies
None — a test-robustness fix, independent of the rest of the queue.
