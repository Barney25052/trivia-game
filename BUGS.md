# BUGS.md

Bugs an agent finds **while working a ticket** that are outside that ticket's scope get logged here instead of being silently fixed or silently ignored. A follow-up session converts `open` entries into actionable tickets in `tickets/` and marks them `triaged` (citing the ticket number).

**Status**: `open` | `triaged` (link the ticket)

## `bug-001` — `npm run build` (server) fails on handler-extraction imports and missing names
- Found: 2026-09-11 · ticket 038 · `server/src/rooms/TriviaRoom.ts`, `server/src/rooms/handlers/effects.ts`, `server/src/rooms/handlers/messageHandlers.ts`
- What you saw: `npm run build` in `server/` fails with 5 errors: `Cannot find name 'OfferTier'` and `Cannot find name 'FlowEvent'` (`TriviaRoom.ts`), `Cannot find module '../gameFlow.js'` plus missing `.js` extension on `./chaserSelection` imports (`handlers/`). Likely fallout from the ticket 031 handler extraction + ticket 036 character-picker changes.
- Expected: `npm run build` passes (green gate per ticket).
- Repro steps: 1. `cd server && npm run build` on clean `dev` HEAD. 2. Observe the 5 TS errors above.
- Status: resolved — fixed in-ticket 2026-09-11 as part of ticket 038's green gate (`OfferTier`/`FlowEvent` added to the `gameFlow` import in `TriviaRoom.ts`; `effects.ts` path corrected to `../../gameFlow.js`; `.js` extensions added to `./chaserSelection` imports)

## `bug-002` — `roomFlow` tests stall at `rolesReveal` after character-gated ready (flaky, 1–3 failures per run)
- Found: 2026-09-11 · ticket 038 · `server/test/roomFlow.test.ts` + character-gated `revealReady` handler
- What you saw: a varying subset of `roomFlow` tests fails per run with `timed out waiting for phase <offer|cashBuilder>; got rolesReveal` (e.g. "roles reveal gates the cash builder", "offerChoice is guarded", "chaseResult is guarded", "finalChaserScore is guarded"). Several tests send bare `revealReady` with no `characterId` (lines 89, 225, 260, 296-area), while ticket 036 made ready require the Chaser's character pick — so the room never leaves `rolesReveal`.
- Expected: full `npm test` green and stable.
- Repro steps: 1. `cd server && npm test`. 2. Re-run; observe a different 1–3 of the above tests failing each time, always stuck at `rolesReveal`.
- Status: resolved — fixed in-ticket 2026-09-11 as part of ticket 038's green gate (all `revealReady` sends in `server/test/roomFlow.test.ts` now pass `{ characterId: "blight" }`)

## `bug-003` — `roomFlow` test "chaser reveal is its own phase" fails: `phases` array missing `RolesReveal` broadcast
- Found: 2026-09-11 · ticket 043 · `server/test/roomFlow.test.ts:149`
- What you saw: `waitForPhase(room, GamePhase.RolesReveal)` returns (server state is RolesReveal), but `phases` (populated by `alice.onMessage("phase", ...)`) does not include `RolesReveal` — the assertion `phases.includes(GamePhase.RolesReveal)` fails. Fails consistently on `dev` HEAD.
- Expected: `phases` always contains every phase the server transitioned through, since `phase` broadcast messages are delivered before state settles.
- Root cause (suspected): `waitForPhase` polls server state directly and returns as soon as state matches; the Colyseus `phase` broadcast message is delivered asynchronously, so alice's `onMessage` handler may not have run yet when the assert fires. Classic client-delivery-vs-server-state race.
- Repro: `cd server && npm test` on clean `dev` HEAD — "chaser reveal is its own phase" fails; re-runs also fail.
- Status: open