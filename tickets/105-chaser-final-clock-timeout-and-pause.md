# 105: Chaser Final round doesn't end at 0; clock must genuinely pause during a pushback (`bug-013` + user report)

## Goal
User report (2026-09-13 live session): the Chaser Final round doesn't end once the time runs out, and the clock should pause while the team is doing a pushback (steal). This combines an already-logged cosmetic bug (`bug-013`: the client's displayed "Time left" never pauses during a steal window, unlike the server-authoritative clock) with what may be a deeper server-side bug where the round can fail to actually end on timeout — possibly because the clock never resumes after a steal, so the "did we hit 0" check that only runs inside `resumeChaserFinalClock`/`runChaserFinalCountdown` never gets a chance to fire.

## Investigation starting points (server)
`server/src/rooms/TriviaRoom.ts`:
- `chaserFinalClockRunning` (~line 127), `startChaserFinalClock` (~283), `pauseChaserFinalClock` (~291), `resumeChaserFinalClock` (~308), `runChaserFinalCountdown` (~320) — the pause/resume/expiry machinery.
- Around line 358-362, whatever calls `resumeChaserFinalClock()` after a steal resolves (find every call site of `pauseChaserFinalClock`/`resumeChaserFinalClock` and confirm every pause has a matching resume — a steal window that ends without one would freeze the clock forever with the round unable to progress or end).
- `server/src/gameFlow.ts:341` — the `finalChaserTimeout` case — confirm it actually transitions to a terminal phase and that nothing upstream swallows or fails to dispatch it.
- Check `server/test/finalRound.test.ts` for existing steal/timeout coverage and extend it — add a regression test that plays out one or more steal windows and asserts the round still ends (reaches `GameEnd`) at the correct total elapsed time, not later and not never.

## Investigation starting points (client)
`client/src/screens/ChaserFinalScreen.vue`:
- `secondsLeft`/`countdownInterval` — a plain client-side `setInterval` ticking down once a second with no awareness of `stealActive`/`holdActive` (this is `bug-013`, logged 2026-09-13). It must freeze while the server's real clock is paused (during a steal window and its `stealResolveHoldMs` hold) and only resume ticking once `chaserFinalClockRunning` is true again server-side — the server should be the source of truth here (e.g. sync remaining time or a running/paused flag), not an independently-running client timer that just estimates.

## Proposed direction (for sign-off — this ticket touches client UI, specifically the clock display)
- Fix the server-side bug first (whatever is actually preventing the round from ending — likely a missing/broken resume-after-steal call, or a case where `resumeChaserFinalClock` is called but the phase has already moved on and the check is skipped). Add a failing regression test that reproduces the hang/non-ending before fixing it, so the fix is provably correct.
- Then make the client's displayed clock authoritative-driven: have the server include enough info (a running/paused flag and/or the true remaining ms) in whatever sync path already exists for the Chaser Final (state fields, or a message), and have `ChaserFinalScreen.vue` derive `secondsLeft` from that instead of ticking blindly — pausing its own local ticker whenever the server says the clock isn't running (during `stealActive`/`holdActive`), matching the real budget exactly.
- Keep changes minimal and behavior-preserving outside of the bug: don't change steal-window duration, resolve-hold duration, or any other final-round timing/rule.

## Scope
- `server/src/rooms/TriviaRoom.ts`, `server/src/gameFlow.ts` (only if the timeout-handling case itself is broken), `server/test/finalRound.test.ts` (new regression coverage).
- `client/src/screens/ChaserFinalScreen.vue`, `client/src/App.vue` if a new synced field/message needs threading through.
- Not in scope: Team Final's own timer (separate, not reported as broken), any other final-round visual polish.

## Acceptance
- New/updated `server/test/finalRound.test.ts` case(s) proving: a Chaser Final round that includes one or more steal windows still ends at the correct total elapsed server time, and never hangs past it.
- `cd server && npm test` and `cd server && npm run build` green.
- `cd client && npm run build` green.
- Manual 2-3 browser walk: reach Chaser Final, let time run down to 0 with no steals — the round ends. Separately, force a Chaser miss so a steal/pushback opens — the displayed "Time left" visibly freezes for the steal window + resolve hold, then resumes ticking from where it left off (not from where a naive local timer would have decremented it to).

## Dependencies
- None (builds on already-shipped 094/095).
