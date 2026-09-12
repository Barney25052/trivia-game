# 063: Multiple-choice questions from OpenTDB for the board chase (Phase 4)

> **Update (decision change)**: this ticket was originally drafted as "extend our bank to multiple-choice" with no opentdb at runtime. Decided instead — per `GOAL.md` "Question bank" — the board chase pulls **multiple-choice questions from the OpenTDB API at runtime**. The local bank stays open-ended-only. Scope rewritten accordingly.

## Goal
The board chase needs 3-option multiple-choice questions. They come from the **OpenTDB API** (`https://opentdb.com/api.php`, `type=multiple`) at runtime, served to the chase engine behind the existing thin **get-questions interface** so the source can swap later. Open-ended rounds (cash builder + final) keep using our local bank (`server/data/questions.json`); MC is never stored locally. Make sure to be aware of the limit on the free API, possibly source a large pool of questions to be used over multiple rounds to reduce API calls.

## Scope
- New server-side OpenTDB client module (e.g. `server/src/questions/opentdb.ts`): fetch `type=multiple` questions (optionally filtering difficulty/category if we tune it), validate/trim the response, HTML-decode the question text and options (OpenTDB returns escaped text), and map each item to a server-held MC shape — `{ id, question, category, options: string[] (the 4 returned answers), correctIndex }`. Cap/validate unexpected shapes and bounds.
- Deliver via the chase engine showing **3 of 4** options; `correctIndex` stays server-only until the moment of resolution — the AGENTS.md "never broadcast the correct answer before reveal" invariant (extend `broadcastQuestion`'s existing `kind: "mc"` wire path with `options`; never send `correctIndex`).
- Fetching is **best-effort**: bounded timeout, retry, and graceful in-flight-failure handling so a network blip can't hard-crash the round (see `GOAL.md` Phase 6 hardening).
- `api-test.py` at the repo root is the scratch harness for the API — reference it, don't depend on it.
- No changes to the local open-ended bank for MC.

## Acceptance
- `cd server && npm test` green with new tests for the OpenTDB mapping/validation — shape, option count, `correctIndex` bounds, HTML decode — using fixture payloads (no live network in tests).
- `cd server && npm run build` green.
- Grep the diff: `correctIndex` never appears in any client-bound message before reveal.

## Dependencies
- None (extends 004/005's bank infrastructure for open-ended only). Should land before 064 (board-chase engine draws MC questions from it).