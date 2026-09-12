# 054: Random chaser mode should go straight to the wheel — skip the ChaserSelection player-list hold

## Goal
In random mode (the default, ticket 025), starting the game drops everyone onto the `ChaserSelection` screen — the full player list with "Picking the chaser…" — and holds there for the full `CHASER_SELECTION.randomDurationMs` (**8s**) before `pickRandomChaser` fires; only then does the `ChaserReveal` wheel appear. User report: "clicking random chaser goes to a weird intermediate screen that lists all the players, then the spinner — it should just go straight to the spinner." Random mode takes no player input, so the hold is redundant: the wheel IS the reveal (tickets 019/033). Also when voting, it should NOT show the wheel after voting.

## Scope
- Make the random-mode pick resolve **immediately** so clients go straight to `ChaserReveal` (the wheel).
  - Recommended low-risk approach (keeps `gameFlow.ts` pure): in `server/src/rooms/handlers/effects.ts` `startChaserSelection`, for `chaserSelectionMode === "random"` dispatch `chaserSelectionComplete` (call `pickRandomChaser` now) instead of scheduling the `randomDurationMs` timer; leave the vote-mode hold exactly as-is. If a one-frame flash of `ChaserSelection` is perceptible on clients, drive the skip in `gameFlow.ts` instead (`startGame` in random context returns `ChaserReveal` effects directly) — decide based on what the browser shows.
  - Confirm `assignChaser` still runs before `startChaserReveal`, so `player.role` / `state.chaserSeatId` are set when `ChaserWheelScreen` mounts and the wheel lands on the chosen seat.
- `server/src/gameConfig.ts`: `CHASER_SELECTION.randomDurationMs` becomes dead if the random path no longer waits on it (tests use `chaserSelectionDurationMs: 80-100` so they do not depend on the 8s default). Remove it or repurpose it explicitly (e.g. as the floor for an instant/queued pick) — no silent dead config (AGENTS.md "No cruft").
- Tests to update (they currently ride the shortened random hold and/or assert the random-mode `ChaserSelection` broadcast):
  - `server/test/roomFlow.test.ts` — e.g. `:290` asserts `phases.includes(GamePhase.ChaserSelection)` after a random-mode run; the "random mode picks a chaser" tests (`:61-69`, `:125-142`, `:188-210`).
  - `server/test/cashBuilderFlow.test.ts`, `server/test/cashBuilder.test.ts`, `server/test/rateLimit.test.ts`, `server/test/leaveFlow.test.ts` — the ones passing `chaserSelectionDurationMs` for random-mode flow and waiting through `ChaserSelection`/`ChaserReveal`.
  - Add a regression: random mode reaches `ChaserReveal` with no `ChaserSelection` wait (or transitions out of `ChaserSelection` in the same dispatch, depending on the approach).
- Client: `ChaserSelectionScreen.vue` (`client/src/screens/ChaserSelectionScreen.vue`) effectively becomes vote-mode-only. Fix it only if the server skip still shows it in random mode; do not add a second spinner — the `ChaserReveal` wheel stays the one and only random reveal.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` and `cd client && npm run build` pass.
- Pure/room-flow test: random mode goes `startGame → ChaserReveal` without a `ChaserSelection` hold (assert the wheel is reached without waiting on `randomDurationMs`).
- Vote mode unchanged: still lands on `ChaserSelection`, lists players, waits for `allPlayersVoted` to resolve within `voteDurationMs`.
- Live check: host clicks start in random mode → all clients see the wheel immediately (no ~8s static player-list screen first).
- Grep: no dead references to a removed `randomDurationMs`.

## Dependencies
- None. Decision on whether the intermediate `ChaserSelection` phase is skipped entirely or resolved in the same dispatch is left to the implementer's live check.