# 005: Question bank loader + random picker

## Goal

Load the JSON bank at startup and hand out random, non-repeating questions.

## Scope

- New `server/src/questions/bank.ts`:
  - `loadBank()` — reads `server/data/questions.json` (path resolved from file location, so it works from `npm start` and the built `build/` output).
  - `pickRandom(bank, count, excludeIds?)` — returns `count` distinct random questions, never repeating ids.
  - If the file is missing/corrupt, throw a clear error at load (graceful handling is a later ticket).
- Tests in `server/test/bank.test.ts`: loads bank, samples don't repeat, exclusion works, count > available throws.

## Acceptance

- `cd server && npm test` — bank tests pass.
- `cd server && npm run build` passes.

## Dependencies

004.