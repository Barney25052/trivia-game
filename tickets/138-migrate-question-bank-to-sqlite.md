# 138: Migrate the open-ended question bank from JSON to SQLite

## Goal
`GOAL.md`'s "Question bank" section already named SQLite as "the planned path" for the open-ended bank if a DB was ever warranted (large curated set, admin editing) — parked pending a decision. Decided by the user (2026-09-14): do it now. The bank is actively edited through the live `/api/questions` endpoint (091–092) and will keep growing; JSON-file-rewrite-on-every-append doesn't scale that story as well as a real datastore does.

## Scope — what moves, what doesn't
- **In scope**: the **open-ended question bank only** (currently `server/data/questions.json`, 572 rows, loaded by `server/src/questions/bank.ts` and written to by `server/src/questions/bankAdmin.ts`). This is the actively admin-edited set GOAL.md's SQLite discussion was actually about.
- **Out of scope, unchanged**: the local MC backup pool (`server/data/mc-backup.json`, ticket 090) — a small, static, non-admin-edited fallback dataset; no motivating reason to move it. The OpenTDB runtime source (063) is unaffected either way. Don't touch either.

## Approach
- Add `better-sqlite3` as a server dependency — synchronous API (matches this codebase's existing synchronous `loadBank()`/`appendQuestion()` calling convention, no async ceremony needed in callers), and the "single file, zero ops, PM2-friendly" property `GOAL.md` already called out. Confirm prebuilt binaries exist for the pinned version on this team's actual dev/deploy platforms (Windows dev, whatever the PM2 deploy target is) before locking in the version — flag in the PR if a native build step turns out to be required anywhere.
- New `server/data/questions.db` (SQLite file, alongside where `questions.json` lives today) becomes the runtime source of truth. A `questions` table holding the same shape `BankQuestion` already has (`id`, `question`, `answer`, `alternatives`) — store `alternatives` as a JSON-text column (an array in, an array out) rather than a normalized child table, so nothing downstream of `loadBank()` (the answer checker, `QuestionManager`, per-contestant non-repeating draw) needs to change at all — the DB is purely behind the existing loader interface.
- `server/src/questions/bank.ts` — `loadBank()` reads from SQLite instead of `readFileSync`+`JSON.parse`. Keep the exported `BankQuestion` type and `loadBank()` signature identical so every existing consumer is untouched.
- `server/src/questions/bankAdmin.ts` — `appendQuestion` becomes a SQLite `INSERT` (still validated by the existing pure `validateNewQuestion`, which needs no DB access and stays untouched) instead of the current read-whole-file/rewrite-whole-file-atomically dance. The CRLF-preservation logic this replaces is JSON-specific and goes away entirely — note its removal explicitly so nothing quietly still expects it.
- **One-time migration/seed script** (e.g. `server/scripts/seedQuestionsDb.ts`, run manually — document the command in `AGENTS.md`, not wired into `npm start`/`npm test`) that reads the existing `questions.json` and populates `questions.db`. `questions.json` stays in the repo afterward as the seed/export format only — per `GOAL.md`'s existing wording — not read at runtime anymore.
- `server/data/questions.db` needs to live somewhere that survives `npm run build` and a redeploy (it's data, not build output) — keep it in `server/data/` like the JSON was, and call out in `AGENTS.md` that this file (unlike `build/`) must persist across deploys and should probably be gitignored going forward (seed from `questions.json` + the migration script on a fresh checkout, rather than committing a binary DB file) — decide and document whichever the user prefers.

## Tests
- `server/test/bankAdmin.test.ts` currently snapshots/restores `questions.json` around each HTTP test against the real file — rework this to run against an isolated SQLite DB per test (an in-memory `:memory:` DB, or a fresh temp-file DB per test run), not the real `questions.db`, so tests never touch real data and stay parallel-safe.
- Any other test that depends on `loadBank()`'s current JSON-file behavior (grep for `questions.json` across `server/test/`) needs the same treatment.
- `npm test` / `npm run build` (server) green with the new datastore.

## Docs
- `AGENTS.md` — update the question-bank description (currently "loaded from `server/data/questions.json`") to describe the SQLite file + the seed script; update the "Storage" line in `GOAL.md`'s "Question bank" section from "parked" to decided, matching what actually shipped.

## Acceptance
- Fresh checkout: running the seed script against the committed `questions.json` produces a working `questions.db` with all 572 rows readable via `loadBank()`.
- A full game (cash builder + final round) plays end-to-end against the SQLite-backed bank with no behavior change from a player's perspective.
- `POST /api/questions` (start `server` + hit the endpoint, or the existing test) appends a new row that `loadBank()` picks up on the next room without a server restart's worth of extra ceremony beyond what the JSON version required.
- `npm test` / `npm run build` (server) green; grep confirms `bank.ts`/`bankAdmin.ts` no longer read/write `questions.json` at runtime.

## Dependencies
None — can land independently of 130–137.
