# 038: Answer validation utility for open-ended questions

## Goal
The cash builder needs to check typed answers against the question bank. Today `bank.ts` stores a single canonical `answer` string per question (e.g. `"Mars"`, `"Carbon dioxide"`, `"206"`) but provides no validation function. This ticket adds a pure, testable answer-checker that normalises player input and compares it against the canonical answer — the foundation every other Phase 2 ticket builds on.

## Scope
- Create `server/src/questions/answerChecker.ts`:
  - Export `checkAnswer(playerAnswer: string, canonicalAnswer: string): boolean`.
  - Normalise both strings: `trim()` whitespace, `toLowerCase()`, collapse runs of internal whitespace to a single space.
  - Return `true` if the normalised strings match exactly.
  - This is intentionally lenient on whitespace/casing but strict on content — `"Mars"`, `"mars"`, `" Mars "` all pass; `"Earth"` does not. Leniency on single-edit typos and articles is decided under ticket 047 (see the update note below).
- Add constants to `server/src/gameConfig.ts`:
  - `ANSWER_CHECK: { normaliseWhitespace: true, caseInsensitive: true }` — documents the current behaviour as config. Not consumed by logic today (the checker hard-codes these), but establishes the seam so a future ticket can flip to exact-match or add fuzzy matching without touching the checker's call sites. **Updated by ticket 047**: the checker now reads this config (`+ allowSingleEdit`, `+ editDistanceRatio`), so it is no longer decorative.
- Create `server/test/answerChecker.test.ts`:
  - Exact match (`"Mars"` === `"Mars"`).
  - Case-insensitive (`"mars"` === `"Mars"`).
  - Leading/trailing whitespace (`" Mars "` === `"Mars"`).
  - Internal whitespace collapse (`"Carbon  dioxide"` === `"Carbon dioxide"`). 
  - Spaces are irrelevant (`"Twenty  Two"` === `"TwentyTwo"`)
  - Filler words (The, of, and, etc) are irrelevant (`"Kermit The Frog"` === `"KermitFrog"`)
  - Numeric answers (`"206"` === `"206"`, `" 206 "` === `"206"`).
  - Partial match returns `true` (`"Masr"` === `"Mars"`). Use some sort of string distance to check it is within a sensible distance, allow for spelling mistakes.
  - Wrong answer returns `false`.
  - Empty string returns `false`.

## Acceptance
- `cd server && npm test` passes (new tests + existing).
- `cd server && npm run build` passes.
- `checkAnswer` is exported from `server/src/questions/answerChecker.ts` and is a pure function (no side effects, no state).

## Dependencies
- None. Pure utility, no wiring into the room yet.
