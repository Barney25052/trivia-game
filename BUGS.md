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
- Status: triaged — ticket 060

## `bug-004` — Room can stall in `Lineup` if the last contestant leaves during the 7s hold
- Found: 2026-09-11 · ticket 049 · `server/src/rooms/TriviaRoom.ts` (`onLeave`), `server/src/gameFlow.ts` (`lineupComplete`)
- What you saw: ticket 049 inserts a `Lineup` hold after the roles-reveal ready gate. If every remaining contestant leaves during that 7s window (e.g. a 2-contestant room where one is the chaser and the other forfeits), `onLeave` removes them from `contestantsOrder`, then the pending lineup timer fires `lineupComplete`, which throws "at least one contestant" — dispatch catches and logs, but the room is stuck in `Lineup` forever (gridlocked like the pre-existing no-contestants cases).
- Expected: a departing-seat exit from `Lineup` resolves forward (advance to `CashBuilder`, or end the game/room) instead of stalling.
- Repro steps: prefer 2-player room (host+chaser and one contestant); walk to RolesReveal, both send `revealReady`, wait until `Lineup`, then `alice.leave()`; observe phase stays `lineup` past the `lineupDurationMs` timer.
- Status: triaged — ticket 061

## `bug-005` — Cash builder: on-screen pot and "correct answers" count still don't increase (ticket 048 closed without a client fix)
- Found: 2026-09-11 · user report (ticket 048 reopened) · `client/src/App.vue`, `client/src/screens/CashBuilderScreen.vue`
- What you saw: during a contestant's cash builder, answering correctly leaves the on-screen pot and the "X correct answers" label static. Ticket 048 (commit `a5404a4`) was marked done but only added a server-side regression test — its diff touches `GOAL.md`, `server/test/cashBuilderFlow.test.ts`, and `tickets/README.md`, **no client code**. A live probe (real WebSocket, 2 SDK clients) confirms the Colyseus layer patches `money 0→1000` / `count 0→1` to *both* clients, so the broken link is downstream of `onStateChange` in the Vue render path — which no automated test exercises.
- Expected: each correct answer visibly grows the pot by $1000 and increments the correct-answer count, with the pot flash, on the active contestant's screen and every spectator's screen.
- Repro steps: 1. Run `server` + `client` dev. 2. Walk a game to a cash builder. 3. Answer a question correctly. 4. Watch the pot/count on screen.
- Status: triaged — ticket 053

## `bug-006` — Random chaser mode shows the player-list screen for ~8s before the wheel; should go straight to the spinner
- Found: 2026-09-11 · user report · `server/src/rooms/handlers/effects.ts` (`startChaserSelection`), `server/src/gameConfig.ts` (`CHASER_SELECTION.randomDurationMs`), `client/src/screens/ChaserSelectionScreen.vue`
- What you saw: starting a game in random mode (the default) drops everyone onto the `ChaserSelection` screen — the full player list with "Picking the chaser…" — and holds it for the full `CHASER_SELECTION.randomDurationMs` (8s) before `pickRandomChaser` fires; only then does the `ChaserReveal` wheel appear. Random mode needs no player input, so the hold is redundant — the wheel (ticket 019/033) is the reveal.
- Expected: in random mode the pick resolves immediately and the room goes straight to the wheel; vote mode still holds on the player-list screen for the vote timer.
- Repro steps: 1. Host joins (default mode is random). 2. Start the game. 3. Observe ~8s of the player-list screen before the wheel.
- Status: triaged — ticket 054

## `bug-007` — Offer screen's auto-generated quips aren't synced across clients
- Found: 2026-09-12 · ticket 052 · `client/src/screens/OfferScreen.vue` (`pickQuip`, `quip`)
- What you saw: the Chaser speech-bubble quip is picked with `Math.random()` independently on every client whenever `offer.seatId`/low/high changes, so two players watching the same offer round can see different quip text at the same moment — there's no single source of truth for what the bubble says.
- Expected: every client shows the same quip text at the same stage of the same offer round.
- Repro steps: open two browser clients on the same room, reach the Offer phase, and compare the chaser's speech-bubble text on both screens as the low/high offers are set — they're picked independently and can diverge.
- Status: resolved — fixed in-ticket 2026-09-12 as part of ticket 057 (the server now picks the line and ships it inside the `offerStart`/`offerLowSet`/`offer` broadcasts, so every client renders the same text; client-side `pickQuip`/`QUIPS` removed from `OfferScreen.vue`)

## `bug-008` — Cash builder answer input silently swallows the submission (uncaught `focus()` on null)
- Found: 2026-09-12 · ticket 056 · `client/src/screens/CashBuilderScreen.vue` (the answer `<input>`, `@blur="inputBox.focus()"`, `submit()`)
- What you saw: pressing Enter in the cash-builder answer input (both via real typing and via browser automation) intermittently does nothing — the input text is not cleared, `cashBuilderMoney`/`cashBuilderCorrectAnswers` don't change, and the same question stays on screen. The console shows `Vue warn: Unhandled error during execution of native event handler` at `<CashBuilderScreen>`, with the underlying error `TypeError: Cannot read properties of null (reading 'focus')`. Sending the identical `submitAnswer` message directly over the room connection (bypassing this input entirely) works every time and correctly updates the pot — isolating the bug to this component's focus handling, not the server.
- Expected: every Enter-triggered submission reaches the server and the input always clears.
- Suspected cause: `submit()` flips `awaitingNext`/`inputDisabled` to `true` synchronously, which sets the input's `:disabled` attribute; a browser auto-blurs an element the instant it becomes disabled while focused, and `@blur="inputBox.focus()"` then dereferences `inputBox.value` without optional chaining (unlike the `handleGlobalKeydown` use of `inputBox.value?.focus()` just above it) — if the ref is momentarily null during that patch, the handler throws and (per the repro) the answer never reaches `room.send`.
- Repro steps: 1. Run `server` + `client` dev, two players, reach `CashBuilder` as the active contestant. 2. Type an answer and press Enter. 3. Watch devtools console for the `focus()` TypeError and confirm the input text is not cleared / pot unchanged. May take 1-2 tries to reproduce.
- Status: triaged — ticket 062

## `bug-009` — `offerQuips` test times out on `offerStart`: `waitForMessage` registered after the broadcast is already delivered
- Found: 2026-09-12 · ticket 060 · `server/test/offerQuips.test.ts` (same delivery-vs-state race family as bug-003, but a separate site)
- What you saw: `npm test` fails `offerQuips` → "quip in the offer broadcasts (ticket 057)" with `Error: message 'offerStart' was not called. timed out (3000ms)` — observed on 2/2 consecutive full-suite runs on clean `dev` HEAD. In `reachOffer` the cash builder is `cashBuilderDurationMs: 250`; when that timer fires, the `startOffer` effect broadcasts `offerStart` and `setPhase(Offer)` runs immediately after, so `waitForPhase(room, Offer)` (polls server state, instant) returns and the test then calls `alice.waitForMessage("offerStart")` — but the client has often already received the `offerStart` message, and the SDK `waitForMessage` only listens for *future* messages, so the promise never resolves.
- Expected: the test registers the `offerStart`/`offerLowSet`/`offer` `waitForMessage` listeners before the broadcasts can be delivered (e.g. right after entering the CashBuilder phase), or gates on the client's own message delivery like ticket 060's `waitForPhaseBroadcast`.
- Repro steps: 1. `cd server && npm test`. 2. Observe `offerQuips` "offerStart ... timed out" (reproduced on 2/2 runs).
- Status: resolved — fixed in-ticket 2026-09-12 as part of ticket 068 (`reachOffer` now registers the `offerStart` listeners for both clients right after entering `CashBuilder`, before the cash-builder timer fires and broadcasts; the test awaits the pre-registered promises instead of calling `waitForMessage` after `Offer` already settled)
