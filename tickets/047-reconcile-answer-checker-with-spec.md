# 047: Reconcile the answer checker with ticket 038's spec — then wire `ANSWER_CHECK`

## Goal
Ticket 038's acceptance criteria say single-letter substitutions should pass *and* misspellings should fail; the implementation lands somewhere else entirely: `matchesSingle` (`server/src/questions/answerChecker.ts:58-75`) rejects every single-edit that is NOT an adjacent transposition (`distance ≤ 1` → transposition only), then accepts anything else within a 0.3 edit-distance ratio regardless of positional change count. The unit tests pass only because they were written to the implementation. Also `ANSWER_CHECK` in `gameConfig.ts:89-92` is declared as "establishes the seam" but is never consumed — the checker hard-codes everything.

## Scope
- Decide (with the owner/user, see TO_REVIEW) what leniency the game actually wants for open-ended answers, then make **spec and code agree**:
  - Either: rewrite `matchesSingle` to match the documented spec (e.g. allow single substitutions/insertions/deletions and small edit-distance ratios, transposition = 0.5-edit), or
  - Keep the current strict rule and update ticket 038's text / `GOAL.md` open question #2 to match reality.
- `server/src/gameConfig.ts` + `server/src/questions/answerChecker.ts`: make the checker read `ANSWER_CHECK` (normaliseWhitespace, caseInsensitive, plus a documented `editDistanceRatio`/`allowTranspositionOnly` field) instead of hard-coding — or, if the config stays decorative, remove it (no dead config per no-cruft rule).
- Tests: `server/test/answerChecker.test.ts` — assert the agreed behaviour explicitly (currently asserts implementation-by-accident, e.g. that "Xars" vs "Mars" fails and that sentence typos pass); keep them green and meaningful.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` passes.
- The ticket/GOAL text and the code agree on the leniency policy; `ANSWER_CHECK` is either consumed or deleted.
- The checkAnswer contract stays pure (`checkAnswer(playerAnswer, accepted)`).

## Dependencies
- Requires a human ruling on intended leniency (GOAL open question #2) before the rewrite.