# 027: Remove template cruft and dead CSS

## Goal
Clean up leftover template filler: dead HTTP routes, stale `package.json` metadata, sample env files, and dead CSS classes never referenced by any `.vue` file. Keeps the codebase clean and avoids confusing future agents.

## Scope

### Server — template filler routes
- `server/src/app.config.ts:31-33` — remove the `api_hello` route (`GET /api/hello` returning `"Hello World"`). Also remove the now-unused `createEndpoint` import (keep `createRouter` if the router is needed at all — if no routes remain, drop the whole `routes` block and its imports).
- `server/src/app.config.ts:41-43` — remove the `GET /hi` Express route.

### Server — stale package.json metadata
- `server/package.json:20-23` — replace the template `bugs` and `homepage` URLs (pointing at `colyseus/create-colyseus`) with project-appropriate values or remove the fields.

### Server — template sample env files
- `server/.env.development` and `server/.env.production` contain `SAMPLE=development` / `SAMPLE=production` — template sample values that nothing reads, and they're git-tracked (the root `.gitignore` only ignores `.env` / `.env.*.local`, not `.env.*`). Remove both files and add `server/.env.*` (or `.env.*`) to `.gitignore` so future env files aren't accidentally committed. The tests inject from `.env.development` automatically — verify `npm test` still passes with the file gone.

### Client — dead CSS
- `client/src/style.css` — remove the following classes, confirmed unreferenced in every `.vue` file:
  - `.bg-square` and `.bg-square::before` (lines 21–50)
  - `.question` (line 256), `.answers` (line 265), `.waiting` (line 273), `.answerButton` and `.answerButton:hover` (lines 292–296), `.questionText` (line 304), `.results` (line 309), `.correctAnswer` (line 395)
- Remove the two commented-out `box-shadow` lines (lines 91 and 103).
- Keep `.rotate` and its `rotate-logo` keyframe — `HomeScreen.vue:42` uses `.rotate`.

### Scope exclusions
- Dead schema fields (`boardPos`, `score`, `chaserPot`) are intentionally reserved for Phase 3–5 — leave them and their tests.
- `CHASE_QUESTION`, `rewardPerCorrect`, `TIMER_CLAMP` in gameConfig are test-asserted config for upcoming phases — leave them.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` passes.
- `cd client && npm run build` passes.
- `git status` shows `server/.env.development` and `server/.env.production` removed (untracked), and `.gitignore` ignores `.env.*`.
- Grep confirms no references to `/api/hello`, `/hi`, or any removed CSS class in source.

## Dependencies
- None