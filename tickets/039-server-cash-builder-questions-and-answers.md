# 039: Server-side cash builder — question delivery, answer handler, pot tracking

## Goal
Wire the cash builder into a real gameplay loop: the server draws questions from the bank one at a time, delivers them to the active contestant, validates submitted answers, and increments `cashBuilderMoney` on correct answers. When the 60-second timer expires (already implemented), the pot total feeds into the offer. This is the core server-side work for Phase 2.

## Scope
- **Question state** — new file `server/src/questions/questionManager.ts`:
  - `QuestionManager` class (or set of pure functions) that owns:
    - A `usedIds: Map<string, Set<number>>` tracking which question IDs have been shown to each contestant (keyed by seatId — depends on ticket 034; if 034 hasn't landed yet, use sessionId and note the migration).
    - `initContestant(seatId: string)` — creates the exclusion set for a contestant.
    - `drawNext(bank, seatId)` → `BankQuestion | null` — calls `pickRandom` with the contestant's exclusion set (count=1), records the ID as used, returns the question. Returns `null` if the bank is exhausted (unlikely with 572 questions and ~60s rounds, but handle gracefully).
    - `getCurrentQuestion(seatId)` → `BankQuestion | undefined` — returns the last-drawn question for a contestant (used by the answer handler to validate against).
  - The `QuestionManager` is a room-local instance (not synced to schema). It lives on `TriviaRoom` as a field.
- **Schema addition** — `server/src/rooms/schema/GameState.ts`:
  - Add `@type("uint16") cashBuilderQuestionsAsked: number = 0` to `GamePlayer`. Incremented on each correct answer. Synced so the client can display a running count. (The actual pot total is already `cashBuilderMoney`; this is a convenience counter for the UI.)
- **Room wiring** — `server/src/rooms/TriviaRoom.ts`:
  - On `startCashBuilder` effect: call `questionManager.initContestant(sessionId)` and draw the first question. Broadcast a `"question"` message to the active contestant with `{ questionId, prompt, category }` — **no answer in the payload** (security rule).
  - Add `onMessage("submitAnswer", ...)` handler:
    - **Phase guard**: reject if not in `CashBuilder` phase.
    - **Role guard**: reject if the sender is not the active contestant.
    - **Shape validation**: reject if `payload` has no `answer` string or `questionId` number.
    - Call `checkAnswer(payload.answer, currentQuestion.answer)`.
    - If correct: increment `player.cashBuilderMoney` by `CASH_BUILDER.rewardPerCorrect` ($1000), increment `cashBuilderQuestionsAsked`.
    - Whether correct or not: draw the next question and broadcast `"question"` with the new question. If the bank is exhausted, broadcast `"question"` with `null` (or a `{ done: true }` signal) — the timer will expire and transition to Offer regardless.
  - On `cashBuilderTimeout` (already exists): clear the question manager's state for the expired contestant (free memory).
- **No gameFlow changes** — the state machine transitions (`startCashBuilder` → `cashBuilderTimeout` → `Offer`) already work. This ticket only adds content within the existing CashBuilder phase.
- **Tests** — `server/test/cashBuilder.test.ts` (new file):
  - Unit: `QuestionManager.initContestant` creates an exclusion set; `drawNext` returns a question and records the ID; calling `drawNext` twice returns different questions; `getCurrentQuestion` returns the last drawn.
  - Integration (stub-handler pattern from `roomFlow.test.ts`): send `submitAnswer` with a correct answer → `cashBuilderMoney` increments by 1000; send a wrong answer → `cashBuilderMoney` stays the same; send an answer from the wrong player → rejected; send an answer in the wrong phase → rejected; send an answer with missing fields → rejected.

## Acceptance
- `cd server && npm test` passes (new + existing).
- `cd server && npm run build` passes.
- Sending a correct `submitAnswer` increments `cashBuilderMoney` by `CASH_BUILDER.rewardPerCorrect`.
- Sending a wrong `submitAnswer` does not increment `cashBuilderMoney`.
- After each answer (right or wrong), a new `"question"` broadcast is sent to the active contestant.
- `cashBuilderQuestionsAsked` increments only on correct answers.
- The `"question"` broadcast never contains the answer.

## Dependencies
- Depends on 038 (answer checker).
- If 034 (seat ID) has landed, use seatId as the `QuestionManager` key. If not, use sessionId and note the migration line.
