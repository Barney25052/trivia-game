# 090: Local MC backup question bank — OpenTDB-shaped fallback pool for the chase

## Goal
The chase recovery policy decided 2026-09-12 (TO_REVIEW #19): when OpenTDB fails or returns nothing after bounded retries, the chase falls back to a **small local ~100-question MC backup pool** in the same JSON format, delivered through the same get-questions interface — so a network blip never stalls or wrongly ends a round. This ticket builds the pool and its loader/source; ticket 074 wires the retry → fallback → caught chain.

## Scope
- `server/data/mc-backup.json`: **~100** multiple-choice questions, each mirroring the OpenTDB `type=multiple` response item shape (`{ category, type, difficulty, question, correct_answer, incorrect_answers[] }`) so the file is the same format as the live source. Run through HTML-decode-safe text (plain ASCII apostrophes/quotes; reuse `decodeHtmlEntities` at load if any entries need it).
- New `server/src/questions/mcBackup.ts` mirroring `bank.ts`'s loader:
  - `loadMcBackup()` — parse + validate the file at server start; skip/report malformed entries (like `loadBank`, so a bad row can't crash the room).
  - `createMcBackupQuestionSource(): McQuestionSource` — implements `getQuestions(amount)` (the shape from 063), drawing **non-repeating** (`id`-keyed) `McQuestion[]` from the pool; returns fewer (or `[]`) when the pool is exhausted, never throws.
- Question content: adapt ~100 sets from the existing open-ended bank (`server/data/questions.json`, 572 questions) — take `question` + its correct `answer` and add **2–3 plausible-but-wrong distractors** (nearby facts, or a convincing-but-wrong answer for the same field). Every entry validated: 3–4 options total, exactly one matches `correct_answer`, `id` unique, `question` and options non-empty, `correctIndex` in range after mapping to the `McQuestion` shape. `category` stays inert metadata (per GOAL's no-category policy).
- The `McQuestion` shape holds `correctIndex` server-side and is **never on the wire** — same invariant as live OpenTDB questions; nothing new reaches clients in this ticket.
- This ticket does NOT wire the fallback into the chase — 074 consumes this source. Only pool + loader + source here.

## Acceptance
- `cd server && npm run build` green.
- New `server/test/mcBackup.test.ts`:
  - `loadMcBackup` succeeds with ≥ 90 valid questions (target ~100, tolerance for drop/validation losses).
  - Every loaded question has 3+ options and a valid `correctIndex`.
  - `getQuestions(n)` returns ≤ n non-repeating questions; an exhausted (small fixture) source returns `[]`, not an error; a corrupt entry is skipped without throwing.
- Grep: `mcBackup` referenced by `src/questions` and by 074's fallback path once wiring lands.

## Dependencies
- 063 (`McQuestion`/`McQuestionSource` shapes this implements). 074 (wires this source into the chase recovery chain).