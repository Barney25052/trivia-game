# 062: Fix cash-builder answer input silently swallowing submissions (`bug-008`)

## Goal
Pressing Enter in the cash-builder answer input intermittently does nothing: `submit()` disables the input synchronously, the browser auto-blurs the now-disabled-but-still-focused element, and `@blur="inputBox.focus()"` (`client/src/screens/CashBuilderScreen.vue:189`) dereferences `inputBox.value` without optional chaining — unlike the safe `inputBox.value?.focus()` used elsewhere in the same file (line 139) — throwing a `TypeError` that (per the logged repro) prevents the answer from reaching the server.

## Scope
- `client/src/screens/CashBuilderScreen.vue:189`: change `@blur="inputBox.focus()"` to use the same safe pattern as line 139 (`inputBox?.focus()` or an equivalent null-guarded call).
- Read through `submit()` (lines ~74-99) and confirm the disable-then-refocus sequence doesn't have a similar unguarded access elsewhere in the file.
- This is a client-only fix — no server changes.

## Acceptance
- Manual repro: two players, active contestant reaches `CashBuilder`, type an answer, press Enter repeatedly (including holding Enter) — no console `TypeError`, the input always clears, and the pot/count updates every time.
- `cd client && npm run build` passes.
- `BUGS.md` bug-008 flipped to `triaged` citing this ticket (done as part of this review).

## Dependencies
- None — isolated to `CashBuilderScreen.vue`.
