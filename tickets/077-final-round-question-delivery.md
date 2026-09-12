# 077: Final round — server question delivery for the team and Chaser streams

## Goal
Phase 5 kickoff. The final round's two parallel **open-ended** streams (team and Chaser) don't exist yet: `startFinalTeam` only sets `teamScore = survivors` (`effects.ts:213-223`) and `startFinalChaser` just starts the timer (`effects.ts:225-231`) — no questions are delivered to either side. This ticket builds the server-side delivery so 078 (team answers) and 079 (Chaser answers) have a stream to work with.

## Scope
- New small module `server/src/questions/finalRound.ts`: a final-round question stream that draws **non-repeating** questions from the shared bank (`room.questionBank`) with **one shared used-ID set across both sides** (team vs Chaser sets must not overlap, per the "two parallel sets from the same bank" rule). Reuse the loader's disting/prompt fields exactly as the cash builder does (`QuestionManager.drawNext` in `server/src/questions/cashBuilder.ts` is the pattern to mirror). No answer in any payload.
- Extend `server/src/rooms/handlers/effects.ts`:
  - `startFinalTeam`: after setting `teamScore`, draw and deliver the first team question.
  - `startFinalChaser`: draw and deliver the first Chaser question.
- **Delivery is per-side, never broadcast**: `client.send("finalQuestion", { side: "team" | "chaser", questionId, prompt })` to the non-chaser seats (team) and to the Chaser seat (chaser) separately. No broadcast of prompts to the whole room — this half-resolves the still-open TO_REVIEW #13 (question payload sensitivity) by making the wire itself side-isolated for the final, and the Chaser can never see a team prompt (or vice versa). The client filter in `App.vue` is NOT the trust boundary here — the server never sends the wrong side a prompt.
- New message types follow ticket 035's shape — add `FinalQuestionPayload` to `server/src/shared/MessageTypes.ts`.
- **Who owns the question is 078's job**: 077's `finalQuestion` is purely the prompt; the per-question buzz lock (`currentFinalTeamBuzzer`), the `buzzIn`/`finalBuzz` messages, and the "only the buzzer submits" rule land in 078.
- Bank exhaustion mid-round: send `"finalQuestion", null` to that side only; the side's remaining timer keeps running (matches the cash-builder exhaustion precedent) — the timer, not a question, ends the round.
- Tunables: no new durations needed (`FINAL_ROUND` has `teamDurationMs`/`chaserDurationMs` already); the draw retry must not exist here — the bank is local and synchronous.

## Acceptance
- New `server/test/finalRound.test.ts`:
  - On `startFinalTeam`, **only** non-chaser clients receive `finalQuestion { side: "team", questionId, prompt }`; the Chaser client receives nothing.
  - On `startFinalChaser`, only the Chaser receives `finalQuestion { side: "chaser", ... }`; team clients receive nothing.
  - No payload contains the answer string (`currentQuestion.answer` / `alternatives` never appear on the wire).
  - Drawing successive team and chaser questions yields no repeats across either stream.
  - Exhaustion (tiny stub bank) → `finalQuestion null` on that side, and the round still transitions on `finalTeamTimeout`/`finalChaserTimeout`.
- `cd server && npm test` green; `cd server && npm run build`.
- Client consumption of `finalQuestion` lands in 080/081, not here.

## Dependencies
- 063 (get-questions/bank interface pattern), 049 (final skeleton already wired into gameFlow). Groundwork for 078, 079, 080, 081, 082.