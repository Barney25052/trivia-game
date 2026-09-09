# 001: Remove dead `GamePhase` copy

## Goal

Kill the dead `GamePhase` duplicate so future agents don't edit the wrong file.

## Scope

- Delete `common/TriviaTypes.ts`.
- `GamePhase` is duplicated in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` — **both are used, keep both**. They must stay identical; that's a known tradeoff until a shared package exists (deferred).
- Do NOT add a shared/package import for TriviaTypes.

## Acceptance

- `grep -rn "enum GamePhase" --include="*.ts" .` (from repo root, excluding node_modules) finds exactly **two** definitions (server + client).
- `common/` is empty afterwards.
- `cd server && npm run build` passes.
- `cd client && npm run build` passes.

## Dependencies

None.