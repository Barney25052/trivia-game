# 155: Investigate — Cash Builder answer input may not submit on Enter

## Goal
Live browser testing during the ticket 137 whole-project review reproduced, twice, a case where pressing Enter in the Cash Builder answer input did not submit the answer — the typed text stayed in the box, the pot/timer didn't change, and nothing happened until the (ticket 129) Submit button was clicked directly, which worked immediately both times. Confirm whether this is a real regression or an artifact of the automated browser tool used for the review, and fix if real.

## What was observed
- `client/src/screens/CashBuilderScreen.vue:378` binds `@keyup.enter="submit"` on the answer `<input>`.
- Repro (via the Browser preview tools' `computer` action): click the input (focuses it, confirmed by the typed text appearing), type an answer, press the `Return` key. Expected: same effect as clicking Submit. Observed: no effect — text stays in the box, `answerResult`/pot/timer unchanged — until the Submit button (`ref="inputBox"`, `.oq-submit`) is clicked, which submits correctly on the same question.
- Code review found no obvious bug: `submit()` (`CashBuilderScreen.vue:213-222`) looks correct, and the global `keydown` listener (`handleGlobalKeydown`, lines 308-313) returns early whenever the input is already focused, so it shouldn't interfere with the input's own `keyup.enter` handler.
- **Not yet confirmed with a real keyboard in a real browser** — synthetic key events dispatched by browser-automation tooling (e.g. via CDP) don't always reproduce a genuine key-press's full event sequence, so this could be a tooling artifact rather than a product bug. Flagging per `REVIEWERS.md`'s "evidence over assertion" — the evidence here is real but incomplete.

## Scope
- Reproduce (or rule out) with an actual keyboard: run `server` + `client` dev, reach Cash Builder as the active contestant, type an answer, press Enter (not click Submit), and confirm whether it submits.
- If it reproduces for real: find the actual cause (candidates to check — `:disabled` state timing similar to the historical `bug-008`/ticket-062 focus bug, an event-modifier mismatch, a stale closure) and fix with a regression test if the existing Vue test setup allows it, or a clear manual-verification note if not (this codebase has no Vue component test harness — see the precedent in ticket 053's footnote in `tickets/README.md`).
- If it does not reproduce with a real keyboard: close this out as tooling-only, no code change, and note that in `tickets/README.md`'s status table per the existing precedent (e.g. ticket 113's "closed — non-reproducible" footnote).

## Acceptance
- A clear verdict either way, backed by a real-keyboard repro attempt (not just automated-tool testing).
- If fixed: `cd client && npm run build` passes, and the Enter-to-submit path is manually reverified working across at least 3 consecutive questions (including one wrong answer, to confirm the reveal-hold `:disabled` window doesn't retrigger the issue).

## Dependencies
None.
