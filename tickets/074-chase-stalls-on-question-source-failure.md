# 074: Chase stalls permanently when the MC question source fails or returns nothing

## Goal
Phase 4 review finding: the Chase round can hang the room forever. `startNextChaseQuestion` (`server/src/rooms/TriviaRoom.ts:165-195`) broadcasts `"question", null` and returns on **either** a fetch error (line 174) **or** an empty draw (line 180), leaving the room in `Chase` with no `currentChaseQuestion`, no answer window, and no timer — nothing can ever advance the phase. Reachable through the real `opentdb` source (network/timeout/API failure) on the very first chase question (`effects.ts:185` `startChase`) or any subsequent one (`TriviaRoom.ts:250`).

**Recovery policy (decided 2026-09-12, TO_REVIEW #19):** a failing source can never strand a Chase. Bounded retries against OpenTDB → **fall back to a small local MC backup pool** (ticket 090) delivered through the same get-questions interface → only if the backup itself is exhausted does the round resolve as caught (last resort so the room never hangs).

## Scope
- Add a bounded recovery to `startNextChaseQuestion` in `server/src/rooms/TriviaRoom.ts`:
  - Retry the draw a small bounded number of times (tunable, e.g. `MC_SOURCE.retries` / `retryDelayMs` in `server/src/gameConfig.ts`) instead of giving up on the first error — the chase questions stream from a live API re-drawn every round (ticket 064), and the current code treats a single transient network blip as fatal.
  - After retries are exhausted, **serve from the local MC backup pool** (090) — the room keeps playing real questions instead of hanging, and a network blip never ends or unfairly resolves a round.
  - Only if the backup pool is itself exhausted (extreme game length) resolve the round **as caught** (dispatch the existing `contestantForfeit`) — the room keeps moving to the next contestant / final. Keep a guard so there is always an eventual resolution path (a timer, or the retry loop itself is fully synchronous after the final failure).
  - The empty-draw branch must take the same fallback path, not a separate dead-end broadcast.
- Do NOT change the cash-builder `"question", null` broadcast — there it is a benign "bank exhausted" signal while the timer drives the transition (`cashBuilderFlow.test.ts:322` covers it).
- Config only, no magic numbers; keep `CHASE_QUESTION` import usage consistent with `clampOptions.ts`.

## Acceptance
- New test in `server/test/chaseFlow.test.ts` (inject a stub `mcQuestionSource` that throws): after the bounded OpenTDB retries, the chase draws its questions from the MC backup pool (stub the pool too, or point it at a tiny fixture) and plays normally — no hang, no wrongful resolution.
- A stub source that throws exactly once then succeeds: pure OpenTDB play continues (question delivered, both sides can answer).
- A stub source that returns an empty batch: falls back to the backup pool the same way, not by hanging.
- Backup pool exhausted (empty fixture) with the source failing: the round resolves as caught within the bound — contestant eliminated, `chaserPot` grows by `perRound`, flow advances to the next contestant's `CashBuilder` (or `TeamFinal` if last). No hang.
- `cd server && npm test` (full suite green) and `cd server && npm run build`.

## Dependencies
- Ticket 090 (the local MC backup pool must exist and load through the get-questions interface first). Ticket 064 (the chase engine this guards); 063 already placed the source behind the injectable get-questions interface so the stub is trivial.