# 091: Server — add-question endpoint (append to the open-ended bank)

## Goal
Let the home-page "Add questions" screen (092) persist a new open-ended question into `server/data/questions.json` over HTTP. Today the bank is hand-edited JSON only; this is the web path of the question-bank-editor stretch goal.

## Scope
- `server/src/questions/bankAdmin.ts` (new): pure `validateNewQuestion(input)` and `appendQuestion(bank, input)` (returns `{ bank, question }`), mirroring the `bank.ts` pure-module style:
  - `question` / `answer`: non-empty trimmed strings capped by a constant (reuse/loosen the existing answer-checker caps; put caps in `gameConfig.ts` under a `BANK_EDIT` block, no magic numbers).
  - `alternatives`: optional array of non-empty strings, array length capped (e.g. 10).
  - `id = max(existing id) + 1`.
  - **No `category` field** — it is legacy/unused per GOAL.md; the new question must not carry it.
  - Returns typed errors for malformed input (no throwing on bad shapes).
- `server/src/app.config.ts`: register `app.post("/api/questions", ...)` with `express.json()`:
  - Read the bank via `loadBank()` (reuses `QUESTIONS_PATH` so source and build runs hit the same file), append, and write back **atomically** (write `questions.json.tmp`, then rename over) so a crash can't corrupt the bank.
  - Respond `201 { id, question, answer, alternatives }` or `400 { error }`.
  - Note: rooms load the bank at `onCreate` (`TriviaRoom.ts:126`) — an added question applies to the **next** room; refreshing in-flight rooms is out of scope.
  - CORS: the Vite dev client (:5173) hits this on :2567 cross-origin — allow the `POST` (simple `Access-Control-Allow-Origin` handling, dev-friendly; nothing secret crosses it). Production is same-origin once the client is served from the server.
- Tests in `server/test/bankAdmin.test.ts`: pure `validateNewQuestion`/`appendQuestion` (id increment, alternative handling, length/emptiness caps, alternatives cap, category never present in the appended row) + an endpoint test on the `testServer.ts` pattern (POST → 201 and the file contains the question; malformed → 400 and the bank file is untouched).
- Not in scope: editing/deleting existing questions, duplicate detection, SQLite, auth, the client screen (092).

## Acceptance
- `cd server && npm test` — new bankAdmin tests green (the suite is ~211+ and climbing).
- Straight-line check: `npm start`, then `curl -X POST localhost:2567/api/questions -H "Content-Type: application/json" -d '{"question":"Test?","answer":"Answer","alternatives":["alt a","alt b"]}'` → `201` with a new id; the row exists in `server/data/questions.json`; a malformed body (empty question, non-array alternatives) → `400` and the file is unchanged.
- `cd server && npm run build` passes.

## Dependencies
- None. Bank shape is `BankQuestion` in `server/src/questions/bank.ts`; client work is 092.