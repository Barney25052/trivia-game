# 094: Server — pause the Chaser's final clock during a steal window

## Goal
Every time the Chaser misses in the Chaser Final, a steal window opens (up to 20s by default) — but the 2-minute clock keeps burning through it. Freeze the Chaser's countdown for the whole pushback, resuming only when the steal resolves or expires.

## Scope
- The Chaser-final clock is currently a single non-pausable one-shot: `startFinalChaser` schedules `chaserFinalDurationMs` and fires `finalChaserTimeout` (`handlers/effects.ts:227-235`). A miss (`submitFinalChaserAnswer`, `messageHandlers.ts:396-411`) opens the steal but leaves the clock running.
- Convert it to a **resumable countdown**:
  - Track remaining ms on the room (`chaserFinalRemainingMs`).
  - When a steal opens (Chaser miss): cancel the active timer, freeze remaining.
  - When the steal resolves or expires unclaimed: **resume** — schedule the remainder before `advanceFinalChaserQuestion()`. If the remainder is already 0/negative on resume, dispatch `finalChaserTimeout` immediately instead.
  - Keep `finalChaserReachedScore` untouched (it fires on a correct answer, which never happens during a steal).
- Expose small room helpers (e.g. `pauseChaserFinalClock()` / `resumeChaserFinalClock()`) so the steal lifecycle in 095 uses the same seam from both the resolve and unclaimed-expiry paths.
- Cancel/clear on `onLeave`/dispose as today; the team-final clock stays as-is.
- No config changes needed unless a minimum pause granularity is wanted — reuse `FINAL_ROUND` tunables as-is.
- Tests (`server/test/finalRound.test.ts` or a new `chaserClockPause.test.ts`, following the stub-handler room pattern): a steal window overlapping where the clock would have run out does **not** time out during the steal; a resumed remainder correctly fires `finalChaserTimeout` (team wins) after both a resolved steal and an unclaimed expiry; remaining <= 0 on resume dispatches immediately.

## Acceptance
- `cd server && npm test` — new pause/resume tests green.
- `cd server && npm run build` passes.

## Dependencies
- None. This ticket only touches the clock; 095 builds the steal messaging/hold on top of its resume seam.