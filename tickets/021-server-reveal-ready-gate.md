# 021: Server: gate cash builder behind a roles-reveal ready vote + "get ready" cooldown

## Goal

The roles-reveal screen must not sit over a running cash-builder timer. After the Chaser is chosen, the server holds the game: the room enters a dedicated **RolesReveal** phase, all players acknowledge the reveal (a group vote — no per-person skip), then a short "get ready" cooldown runs, and *only then* does the 60s cash-builder timer start. Client counterpart is 022.

## Scope

- `server/src/TriviaTypes.ts` **and** `client/src/TriviaTypes.ts` (keep identical — 018 parity rule): add `GamePhase.RolesReveal = "rolesReveal"`.
- `server/src/gameConfig.ts`: `REVEAL_READY = { cooldownMs: 5_000 }`.
- `server/src/gameFlow.ts` (stays pure):
  - `chaserSelectionComplete` → `nextPhase: RolesReveal`, effects `assignChaser` + `startRolesReveal` (a no-timer hold, unlike CashBuilder).
  - New event `revealAllReady` (valid only in RolesReveal) → `nextPhase: CashBuilder`, effect `startReadyCooldown { sessionId, round }` where gameFlow computes the first non-chaser contestant and round 1.
  - New event `readyCooldownDone` (valid only in CashBuilder) → effect `startCashBuilder { sessionId, round }` from `context.activeContestantSessionId` / `context.activeRound` (set by the room when it applies the cooldown).
- `server/src/rooms/schema/GameState.ts`: `@type("boolean") revealReady = false;` on `GamePlayer`.
- `server/src/rooms/TriviaRoom.ts`:
  - Apply `startRolesReveal` (hold; no timer).
  - Apply `startReadyCooldown`: set `activeContestantSessionId`/`activeRound` from the effect payload, schedule `REVEAL_READY.cooldownMs` → dispatch `readyCooldownDone`, and `broadcast("getReady", { cooldownMs })` so clients can show an accurate countdown.
  - Apply `startCashBuilder`: existing behavior (schedule the 60s timer).
  - New message `revealReady`: phase must be RolesReveal and sender must be a player → set `revealReady`; when every player has `revealReady === true`, dispatch `revealAllReady`.
- Tests: `server/test/gameFlow.test.ts` for the two new transition paths; `server/test/roomFlow.test.ts` (stub pattern) proving the cash-builder timer does NOT start until all players ready + cooldown elapses (use bounded short `cashBuilderDurationMs`/`cooldownMs` overrides — see 024).
- **Only 022 depends on this. Merge before 023/024 if run in parallel — all three touch `TriviaRoom.ts`.**

## Acceptance

- `cd server && npm test` — green (new transitions + ready-gate cases)
- `cd server && npm run build` — clean; `npm run build` in client also clean (phase enum parity)
- `room.state.currentPhase` reaches RolesReveal after selection; no cash-builder timer is scheduled until every player has sent `revealReady`; the cooldown elapses before the 60s timer starts

## Dependencies

- None upstream. Client half is 022.