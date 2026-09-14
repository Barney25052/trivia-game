# 128: Chase border fix follow-up, question text contrast, Cash Builder bubble broadcast

## Goal
User-reported live (2026-09-14), as a direct follow-up to ticket 127: three issues found after that ticket shipped.
1. Ticket 127's Chase full-bleed fix didn't fully land visually — the gradient still read as boxed. Root cause: `.chaseTable` kept a `padding: 20px` on all sides, so even with `.chaseGround` itself border-free and `width:100%`, the page's own plain navy background still showed through as a 20px gap on every side of the gradient — a color-boundary "line" with no actual `border` property involved.
2. Chase's question card renders black text on a dark card — `.chaseQuestion` never had an explicit text colour (unlike every equivalent question-prompt style elsewhere: `.cashBuilderQuestion`, `.oq-prompt`), so it fell back to the browser's default black, nearly unreadable against `.chaseQuestionBox`'s dark `--ink-raised` background.
3. The Cash Builder answer bubble (already reportedly working per ticket 127's own report) turned out to only ever render for the active contestant's own client — every other player (watching someone else's turn) never sees it, because the bubble text was purely local component state set inside `submit()`, never sent to anyone else.

## Root cause
1. `.chaseTable`'s padding predated ticket 127 and was carried over unchanged when that ticket made the element full-width/full-height — nobody had reason to reconsider it since the outer box previously had its own visible border anyway.
2. Latent gap in ticket 116's original CSS — `.chaseQuestionBox`'s card was always fairly dark, but apparently light enough (or never scrutinized closely enough) that a missing text colour wasn't noticed until now.
3. `bubbleText`/`bubbleKey` in `CashBuilderScreen.vue` were always local-only refs, set directly inside `submit()` — this works by construction only for the client that called `submit()`. No other Cash Builder screen redesign ticket touched this, so it was never caught. Confirmed with the user directly that broadcasting the guessed text (regardless of correctness) is acceptable here — Cash Builder is a solo scoring round, not a race, and the room already gets a public correct/wrong `reaction` cue the instant a guess lands, so withholding the text itself protects nothing.

## Changes made
**`client/src/style.css`:**
- `.chaseTable`: removed `padding: 20px` entirely — `.chaseGround` already provides its own internal `padding: 24px` for the actual game pieces, so removing the outer padding lets the gradient itself reach every edge with zero gap.
- `.chaseQuestionBox`: background darkened from `var(--ink-raised)` (#23303e) to a scoped `#131a22`, specifically for this card's own contrast needs — not a change to the shared `--ink-raised` token, which is used broadly elsewhere.
- `.chaseQuestion`: added `color: var(--color-white)`.

**Cash Builder bubble broadcast** (`server/src/shared/MessageTypes.ts`, `server/src/rooms/handlers/messageHandlers.ts`, `client/src/App.vue`, `client/src/screens/CashBuilderScreen.vue`):
- New `CashBuilderAnswerPayload` type + `room.broadcast("cashBuilderAnswer", {questionId, seatId, answer})` added to the `submitAnswer` handler, right alongside the existing `broadcastAnswerReaction` call — sent to everyone, not just the submitter, mirroring the existing `finalStealAnswer` broadcast's precedent for "safe to broadcast, never carries the correct answer directly."
- `App.vue`: new `cashBuilderAnswer` ref, populated via `onMessage("cashBuilderAnswer", ...)`, reset on leaving the CashBuilder phase, passed down as a prop.
- `CashBuilderScreen.vue`: `bubbleText`/`bubbleKey` are now set from a `watch` on the new `cashBuilderAnswer` prop instead of directly inside `submit()` — so the bubble renders identically for the active contestant and every spectator. `submit()` no longer touches the bubble state directly.

## Real behavior this ticket should change (called out explicitly)
Cash Builder spectators (anyone who isn't the currently-active contestant) can now see the active contestant's answer bubble pop over their portrait — previously only the active contestant ever saw it. This does mean a spectator can now infer the correct answer slightly before the formal reveal whenever the active contestant answers correctly (confirmed acceptable with the user: Cash Builder is solo scoring, not competitive, so this isn't a fairness issue).

## Real behavior this ticket should NOT change
Chase's board/answer/lockout logic, Cash Builder's scoring/timer logic, the correct-answer reveal timing for the active contestant themselves (`answerResult`, still private via `client.send`).

## Scope
- `client/src/style.css`, `client/src/screens/CashBuilderScreen.vue`, `client/src/App.vue`, `server/src/shared/MessageTypes.ts`, `server/src/rooms/handlers/messageHandlers.ts`.

## Acceptance
- Manual: Chase's gradient reaches every edge of the screen with zero gap on any side (confirmed via `getBoundingClientRect`: `.chaseGround`'s x/width match the full viewport). The question card is visibly darker with white, easily-readable text. In Cash Builder, a spectator's client shows the active contestant's typed guess as a speech bubble over their portrait, matching what the active contestant sees on their own screen.
- `cd client && npm run build` and `cd server && npm test`/`npm run build` both pass.

## Dependencies
- 127 (this ticket's own direct predecessor, same user report thread) — already shipped.
