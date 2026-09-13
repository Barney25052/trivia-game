# 112: Cash Builder's "Time left" display is hardcoded, disconnected from the real duration (`bug-015`)

## Goal
`client/src/screens/CashBuilderScreen.vue` counts down from a hardcoded `CASH_BUILDER_SECONDS = 60`, completely disconnected from the server-authoritative `cashBuilderDurationMs` (`server/src/gameConfig.ts`'s `CASH_BUILDER_DURATION_MS = 60_000`). They currently happen to agree in the shipped default, which is why this has gone unnoticed — but any room-option override (already used throughout this repo's own tests and by agents doing manual verification, per `TriviaRoom.ts`'s `clampRoomOptions`) desyncs the two immediately, and any future change to the default duration in `gameConfig.ts` would silently break the displayed countdown for every real player too.

## Scope
- `client/src/screens/CashBuilderScreen.vue`: derive `secondsLeft`'s starting point from a real synced value instead of the local constant. Check whether the room already exposes the effective `cashBuilderDurationMs` to clients (e.g. via join options echoed back, a state field, or a message) before adding anything new — reuse it if so; if not, the smallest fix is likely threading the value the server actually used through `client/src/App.vue` into this screen as a prop (mirroring how other duration-derived client timers in this codebase already get their authoritative value — check `ChaserFinalScreen.vue`'s post-105 pattern for a recent precedent of a client display deriving from a real synced source instead of a hardcoded guess).
- Not in scope: any other screen's timer display (this bug was found specifically in `CashBuilderScreen.vue`), changing the actual cash-builder duration or gameplay behavior.

## Acceptance
- Manual: start a Cash Builder round with a non-default `cashBuilderDurationMs` room option (e.g. a short test override) and confirm the on-screen "Time left" now starts from and counts down the real configured duration, not a fixed 60.
- `cd client && npm run build` passes; `cd server && npm test` / `npm run build` stay green.
- `BUGS.md`'s `bug-015` flipped to resolved, citing this ticket.

## Dependencies
- None.
