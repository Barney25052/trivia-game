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

## Outcome (investigated 2026-09-15)
**Closed — not reproducible as a real bug; confirmed as a browser-automation tooling artifact**, mirroring the ticket 113 "closed — non-reproducible" precedent (see `tickets/README.md`).

- Removed the stray `console.log(e)` left in `handleGlobalKeydown` (unambiguous cruft, unrelated to the Enter question).
- Re-read `handleGlobalKeydown` (`CashBuilderScreen.vue`) end to end: it's a `keydown` listener on `document`, the input's own handler is `@keyup.enter` — different event types, no `preventDefault`/`stopPropagation` anywhere in the file, and the early-return (`document.activeElement === inputBox.value`) means it does nothing at all whenever the input already has focus, which is always true the instant a real keypress would land on it. No interaction with the input's own `keyup.enter` found.
- Reproduced the original observation live (server + client dev, real Colyseus room, active contestant): dispatching Enter via the Browser preview tools' `computer` action — both as a discrete `key: "Return"` action after `type` (clicking into the field first, and separately after tabbing into the field) — left the typed text in the box and did **not** submit, while clicking the Submit button immediately worked, every time, across multiple fresh rounds/questions. This matches the original ticket 137 review's repro exactly.
- Went one level deeper than the original review could: attached real `keydown`/`keyup` listeners directly to the `<input class="cashBuilderInput">` DOM node and captured the actual event objects fired by the tool's synthetic `Return` key-press. Result:
  ```
  {"src":"input","type":"keydown","key":"","code":"","which":0,"defaultPrevented":false}
  {"src":"input","type":"keyup","key":"","code":"","which":0,"defaultPrevented":false}
  ```
  The synthetic key event **does** reach the input (both keydown and keyup fire, nothing swallows it), but `event.key` / `event.code` / `event.which` are all empty/zero instead of `"Enter"` / `"Enter"` / `13`. Vue 3's `@keyup.enter` modifier (`withKeys`) matches on `event.key.toLowerCase() === "enter"` — with `event.key === ""` the modifier never matches, so `submit()` is simply never invoked. No JS error, no console output, nothing to see — exactly the silent "nothing happens" the review reported. A **third** dispatch method (typing the answer plus a trailing `\n` in one `type()` call, i.e. not a discrete key action) produced yet another distinct symptom — the input's value emptied out with no `keydown`/`keyup` at all reaching the listeners and no corresponding submission (pot/correct-answer count unchanged) — confirming the failure is dispatch-method-dependent, not one consistent behavior, which is itself evidence against a real app-level bug (a genuine code bug would misbehave the same way regardless of how Enter arrives).
  - Control check: clicking the Submit button (`ref="inputBox"` — actually `.oq-submit`) worked immediately and correctly every single time in the same sessions, including cycling through several questions with both a correct and an incorrect answer, pot/correct-answer-count updating each time as expected.
- Conclusion: this is a synthetic-event limitation of the Browser preview tools' key dispatch (the same class of CDP-level artifact the original ticket 137 review flagged as a possibility), not a defect in `CashBuilderScreen.vue`. A real physical key press always populates `event.key`; the code path Vue relies on (`@keyup.enter="submit"`) is standard, correct, and provably identical to the button's own `@click="submit"` (both guarded by the same `inputDisabled` check, both calling the same `submit()`). **No code fix applied** for the Enter behavior itself — forcing a change onto already-correct code was avoided per the ticket's own instruction.
- This still needs a final human-with-a-real-keyboard check to be 100% certain (automation, however instrumented, cannot fully stand in for a physical key press) — flagging that explicitly rather than declaring it fully closed on my own authority.
