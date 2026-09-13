# 113: Cash Builder's correct-answer screen flash can stay stuck on past its 700ms timer (`bug-016`)

## Goal
Live-testing during ticket 107 observed the green `.cashBuilder-flash-correct` full-screen tint (`client/src/screens/CashBuilderScreen.vue`) still fully visible several seconds after two fast-chained correct answers, well past its own 700ms auto-clear (`screenFlashTimeout`). The round's own `secondsLeft` countdown (a separate `setInterval`) kept ticking normally in the same tab over the same interval, and the unrelated `bubbleText` 3s timer cleared on schedule — so the tab wasn't broadly stalled, only this one 700ms clear didn't fire (or fired then got re-triggered without a subsequent clear).

## First step — rule out a testing artifact before chasing a real bug
The repro used two browser tabs (one per player) with the browser's own background-tab timer throttling in play — a backgrounded tab can throttle/delay/coalesce `setTimeout` significantly. Before investigating the component logic, reproduce with the Cash Builder tab kept in the **foreground** the whole time (no tab-switching during the test). If it does NOT reproduce that way, this may simply be an artifact of multi-tab manual testing, not a real bug — say so plainly in the ticket footnote, close it out as "not reproducible outside backgrounded-tab testing," and skip the rest of this ticket's scope.

## If it does reproduce with the tab foregrounded — investigate
`client/src/screens/CashBuilderScreen.vue`, the `watch(() => props.answerResult, ...)` handler (currently ~line 150) and the `screenFlash`/`screenFlashTimeout` state it manages:
- Confirm `App.vue` always assigns a genuinely new object to whatever ref backs `answerResult` on every `"answerResult"` message (a Vue `watch` on a getter compares by reference — if the same object were somehow mutated in place and reassigned to the same reference, or if two rapid messages land in the same reactive flush and only the watcher's *last* invocation matters, the intermediate correct-flash's own `setTimeout` could still be pending correctly — but check for any code path where `screenFlashTimeout` gets overwritten without the old timer being allowed to complete or properly cleared).
- Check whether a wrong-answer flash immediately following a correct one (or vice versa) can leave `screenFlashTimeout` pointing at a timer that will later stomp on state a subsequent branch set (e.g. the wrong-branch doesn't clear via a timeout at all, relying on the `currentQuestion` watcher elsewhere — confirm the two clearing mechanisms can't race each other and leave `screenFlash` stuck).

## Scope
- `client/src/screens/CashBuilderScreen.vue` only.
- Not in scope: the bubble-linger fix (107, already done), the pot-flash (`potFlash`/`potFlashTimeout`, a separate and apparently-unaffected mechanism — only touch it if you find it shares the actual root cause).

## Acceptance
- Either: documented as not reproducible with a foregrounded tab (ticket closed with that finding), or: a concrete root cause is found and fixed, with manual verification (foregrounded tab, several fast-chained correct answers in a row) showing the flash always clears at ~700ms.
- `cd client && npm run build` passes if any code changes; `cd server` tests/build stay green (no server changes expected).
- `BUGS.md`'s `bug-016` updated to reflect the outcome (resolved with the fix, or closed as a non-reproducible testing artifact — either is an acceptable resolution, just be honest about which).

## Dependencies
- None.
