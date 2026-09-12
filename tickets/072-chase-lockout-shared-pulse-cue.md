# 072: Chase lockout countdown needs a strong, shared pulsing cue for both sides

## Goal
Today the 5-second chase lockout window only starts once *either* side answers (`server/src/rooms/handlers/messageHandlers.ts:252-262`, `wasFirstAnswer` → `room.scheduleTimer(room.chaseAnswerWindowMs, ...)`), but the client only knows about its *own* submission — there's no broadcast when the window starts. Today's UI (`ChaseScreen.vue:82-91`, `startAnswerWindow()`) only shows a countdown to whichever side already answered; the side still deciding has no idea a clock is running at all.

Per user direction: **both sides** need a strong, unmistakable visual cue once the window starts — a pulsing/flashing background, and the answer buttons themselves should pulse too.

## Scope
- **UI sign-off first (AGENTS.md rule)** — confirm the exact pulse look (color, speed, background vs. buttons vs. both) with the user before implementing; this ticket only establishes the mechanism and that it must be strong/obvious.
- `server/src/rooms/handlers/messageHandlers.ts` (`submitChaseAnswer`, around line 252): when `wasFirstAnswer` is true, broadcast a new message (e.g. `chaseLockoutStarted`) with `{ questionId, windowMs: room.chaseAnswerWindowMs }` to **all** clients. Do not include which role answered or their answer index — only the fact that the window has started, so no early information leaks (per AGENTS.md's "never broadcast the correct answer/role info before reveal" rule).
- `client/src/App.vue`: listen for `chaseLockoutStarted`, store it (e.g. `chaseLockout = { questionId, windowMs, startedAt }`), and clear it whenever a new `question` broadcast arrives or the phase leaves Chase.
- `client/src/screens/ChaseScreen.vue`: replace the current self-only `startAnswerWindow()` trigger (`ChaseScreen.vue:82-91`, currently fired from `selectOption()`) with one driven by the new `chaseLockout` prop, so the countdown and pulse are synced from the *same* signal for the contestant, the Chaser, and spectators alike — not just whoever answered first.
- `client/src/style.css`: add a pulsing animation applied to the chase question area's background and to `.chaseOptionButton` while the lockout is active, strong enough to read as "the clock is running" at a glance (not a subtle fade).

## Acceptance
- Manual 2-browser check: once either side answers, **both** browsers immediately show the pulsing cue (background + buttons) and a synced countdown, not just the side that already answered.
- The still-deciding side never learns who answered or what they picked — only that a countdown has started.
- `cd server && npm test` and `cd client && npm run build` pass.

## Dependencies
- Builds on ticket 064 (`submitChaseAnswer`, `chaseAnswerWindowMs`) and ticket 065 (`ChaseScreen.vue` countdown UI).
