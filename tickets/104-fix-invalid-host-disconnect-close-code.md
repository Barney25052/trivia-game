# 104: Fix invalid WebSocket close code on host disconnect (`bug-014`)

## Goal
`TriviaRoom.onLeave`'s host-left branch calls `this.disconnect(6767)`. `6767` is outside the WebSocket spec's valid close-code range (RFC 6455: 1000-1015 reserved, 3000-3999 library/framework-registered, 4000-4999 private/application use — 6767 exceeds all of them). The installed `ws@8.21.3` validates this and throws an uncaught `TypeError` instead of silently accepting it, so every real host disconnect (or a host's page reload) crashes that code path server-side.

## Scope
- `server/src/rooms/TriviaRoom.ts` — change the host-leave `this.disconnect(6767)` call to a code inside the valid 4000-4999 private-use range (`4001`), with a short comment noting why (RFC 6455 range + `bug-014`).
- `AGENTS.md`'s Gotchas line referencing "close code 6767" — update to the new value so the docs stay accurate.
- Not in scope: the historical ticket files (001-103) that mention `6767` when describing what they implemented at the time — those are a historical record of past work, not live documentation, and AGENTS.md's "don't edit tickets you're not working on" convention means they're left as-is.
- No behavior change beyond the numeric code itself — the room still fully disconnects on host leave, same as before.

## Acceptance
- `cd server && npm test` green (existing `leaveFlow.test.ts` host-disconnect tests don't assert the literal numeric code, only phase/state behavior, so no test changes needed — confirmed by reading the test before this ticket was filed).
- `cd server && npm run build` green.
- Manual: two browser clients join a room, host's tab is closed/reloaded mid-game — server log shows the "Host left the room — disconnecting …" line with no following `TypeError`, and the other client is cleanly disconnected.
- `BUGS.md`'s `bug-014` flipped to `triaged`, citing this ticket.

## Dependencies
- None.
