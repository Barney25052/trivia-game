# 165: Cap typed answers before they're relayed to the room (`bug-025`)

## Goal
Pre-upload fix, 2026-09-27. The four typed-answer handlers only checked that the answer was a string, then broadcast it to every client (`cashBuilderAnswer`, `finalAnswer`, `finalStealAnswer`) and echoed malformed payloads into the log. Nothing capped the length, and the answer boxes had no `maxlength`, so one player could push a roughly 4,000-character wall of text (the WebSocket transport's 4 KB message cap) into everyone's answer bubble and the server log, 20 times per 10 seconds. AGENTS.md's Security section requires inbound strings to be capped.

## Scope
- `server/src/rooms/handlers/messageHandlers.ts`: the identical shape guard in `submitAnswer`, `submitFinalAnswer`, `submitFinalChaserAnswer` and `submitFinalStealAnswer` becomes one `isTypedAnswerPayload` helper, which also rejects answers longer than `ANSWER_CHECK.maxTypedLength` (200, from ticket 161). A rejected answer is logged by its length only, never echoed, and nothing is resolved, so the player can simply answer again.
- `client/src/answerLimits.ts` (new): `MAX_TYPED_ANSWER_LENGTH`, mirroring the server cap (same duplication convention as `MAX_QUIP_LENGTH`). Used as `maxlength` on the Cash Builder, Team Final and both Chaser Final answer boxes. No visual change.
- Empty answers are unchanged (accepted and judged wrong): a blank Cash Builder submit is how a player passes a question (`CashBuilderScreen.vue`'s `submit`), and the final rounds already block blank submits client-side.

## Acceptance
- `cd server && npm test` green, including the new `cashBuilderFlow` test: an over-long answer is not relayed and doesn't score, and the same question can still be answered.
- `npm run build` green in both packages.

## Dependencies
161 (`ANSWER_CHECK.maxTypedLength`).
