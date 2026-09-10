# 012: De-template legacy cruft

## Goal

Remove machine-generated/legacy leftovers so the codebase reflects the current asymmetric flow and template names stop leaking into new work. Split out of the post-Phase-0 discussion; scope limited to renaming/removal — no behavior change.

## Scope

- Rename room handler `MyRoom` → `TriviaRoom`:
  - `server/src/rooms/MyRoom.ts` → `server/src/rooms/TriviaRoom.ts` (class + filename)
  - `server/src/app.config.ts` import + `defineRoom` registration
  - `server/README.md` file reference (`src/rooms/MyRoom.ts` → new name)
- Drop dead `GamePhase` members `Question` and `Answer` from **both** `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` (keep the enums identical).
- Delete the now-unused schema classes `Question` and `QuestionInstance` from `server/src/rooms/schema/GameState.ts` (legacy multiple-choice leftovers; only self-referenced today).
- Fix template metadata in `server/package.json` (`name` → e.g. `trivia-server`, drop the "npm init template…" description).
- Repo-wide search for stale names (`MyRoom`, `my-app`, `my_room`, `QuizState`, `GamePhase.Question`, `GamePhase.Answer`) and clean up doc hits (AGENTS.md, GOAL.md, tickets), leaving only historical notes where intentional.

Do **NOT** change game logic, transitions, phases, or test behavior. The legacy `Board`/`chaserFirstCorrectSpace` config stays (future Phase 4 uses it).

## Acceptance

- `npm test` (server) — 42 passing, no regressions
- `npm run build` (server) and `npm run build` (client) — clean
- A repo-wide search for `MyRoom|my-app|QuizState|my_room` returns no live code/docs hits (only historical notes in `tickets/` are acceptable)

## Dependencies

- 001–011 (Phase 0 done; this is the first post-Phase-0 ticket)