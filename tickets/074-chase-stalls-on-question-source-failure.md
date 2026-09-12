# 074: Chase stalls permanently when the MC question source fails or returns nothing

## Goal
Phase 4 review finding: the Chase round can hang the room forever. `startNextChaseQuestion` (`server/src/rooms/TriviaRoom.ts:165-195`) broadcasts `"question", null` and returns on **either** a fetch error (line 174) **or** an empty draw (line 180), leaving the room in `Chase` with no `currentChaseQuestion`, no answer window, and no timer — nothing can ever advance the phase. Reachable through the real `opentdb` source (network/timeout/API failure) on the very first chase question (`effects.ts:185` `startChase`) or any subsequent one (`TriviaRoom.ts:250`).

## Scope
- Add a bounded recovery to `startNextChaseQuestion` in `server/src/rooms/TriviaRoom.ts` so a failing source can never strand a Chase:
  - Retry the draw a small bounded number of times (tunable, e.g. `MC_SOURCE.retries` / `retryDelayMs` in `server/src/gameConfig.ts`) instead of giving up on the first error — the chase questions stream from a live API re-drawn every round (ticket 064), and the current code treats a single transient network blip as fatal.
  - Only after retries are exhausted, resolve the round **as caught** (dispatch the existing `contestantForfeit`) — the room keeps moving to the next contestant / final instead of hanging, and a broken API never rewards the team. Keep a guard so there is always an eventual resolution path (a timer, or the retry loop itself is fully synchronous after the final failure).
  - The empty-draw branch must take the same recovery path, not a separate dead-end broadcast.
- Do NOT change the cash-builder `"question", null` broadcast — there it is a benign "bank exhausted" signal while the timer drives the transition (`cashBuilderFlow.test.ts:322` covers it).
- Config only, no magic numbers; keep `CHASE_QUESTION` import usage consistent with `clampOptions.ts`.

## Acceptance
- New test in `server/test/chaseFlow.test.ts` (inject a stub `mcQuestionSource` that throws): the Chase round resolves as caught within the retry bound — the contestant is eliminated, `chaserPot` grows by `perRound`, and the flow advances to the next contestant's `CashBuilder` (or `TeamFinal` if last). No hang.
- A stub source that throws exactly once then succeeds: the chase continues normally (question delivered, both sides can answer).
- A stub source that returns an empty batch: resolves the same way as the error case, not by hanging.
- `cd server && npm test` (full suite green) and `cd server && npm run build`.

## Dependencies
- Ticket 064 (the chase engine this guards); 063 already placed the source behind the injectable get-questions interface so the stub is trivial.