# 106: Stale Cash Builder question briefly visible after the phase moves on (user report)

## Goal
User report (2026-09-13): going from the Cash Builder into the next phase (the board-chase "table" screen), the previous Cash Builder question is visible for a few seconds before the real chase question replaces it.

## Suspected root cause
`client/src/App.vue`:
- `currentQuestion` (raw ref) is only ever reassigned by the `"question"` server message handler (`applyQuestion`, ~line 189) — nothing clears it when the phase moves away from Cash Builder.
- `currentRoundQuestion` (computed, ~line 138) is passed as `:currentQuestion` to **both** `CashBuilderScreen` and `ChaseScreen` (lines 647 and 690). Its filter only excludes a non-`"mc"` (cash-builder-shaped) question when `targetSeatId !== activeContestantSeatId` — it does **not** check the current phase. So when the same contestant who just finished their Cash Builder round becomes the active contestant in Chase, the stale cash-builder question object still satisfies `targetSeatId === activeContestantSeatId` and `currentRoundQuestion` keeps returning it — `ChaseScreen` then renders that leftover prompt/text until the server's first real chase `"question"` message finally arrives and overwrites `currentQuestion`.
- Verify this is really the mechanism (rather than something CashBuilderScreen-local) before fixing — read the intervening phases (`chaserCharacterReveal`, `offer`) to confirm neither of them clears `currentQuestion` either.

## Proposed direction
- Clear `currentQuestion.value = null` (via `applyQuestion`-style reset, or directly) at the point where the room signals it's leaving Cash Builder — the existing `"phase"` broadcast handler in `App.vue` is the natural hook (reset on any phase transition away from `cashBuilder`, or more robustly, gate `currentRoundQuestion`'s cash-builder branch on `currentPhase.value === "cashBuilder"` and its chase branch on `currentPhase.value === "chase"` in addition to the existing checks, so a stale object from the wrong phase can never leak through regardless of seat-id coincidences).
- Prefer the phase-gated computed fix over scattering manual resets across every transition point — it's the more robust fix and matches the "no cruft / single source of truth" spirit of the surrounding code.
- No server changes should be needed — this is a client-side stale-state bug.

## Scope
- `client/src/App.vue` only, most likely just `currentRoundQuestion`'s computed and/or the `"phase"` message handler.
- Not in scope: the Cash Builder answer-bubble linger issue (separate ticket), any Chase-screen layout changes.

## Acceptance
- Manual 2-browser walk: play a full Cash Builder round through to its last question, let the phase advance (through Chaser Character Reveal / Offer / into Chase), and confirm the Chase screen never shows the old Cash Builder question text — it shows either nothing/a loading state or the real first chase question, never stale content.
- `cd client && npm run build` passes; `cd server && npm test` / `npm run build` stay green (no server files expected to change).

## Dependencies
- None.
