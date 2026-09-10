# 032: Normalise GamePhase.GameEnd value to camelCase

## Goal
`GamePhase.GameEnd` has the string value `"gameend"` while every other enum member uses camelCase (`"finalTeam"`, `"finalChaser"`, `"chaserSelection"`, etc.). Works today because `App.vue` maps via the enum member, but any string comparison with `"gameEnd"` (camelCase) would silently fail. The inconsistency will bite once Phase 2+ adds string-based routing or logging. Fix it while the enum is small and the blast radius is zero.

## Scope
- `server/src/TriviaTypes.ts` — change `GameEnd = "gameend"` → `GameEnd = "gameEnd"`.
- `client/src/TriviaTypes.ts` — same change (keep them identical per TriviaTypes parity rule).
- Grep for the old `"gameend"` string across both packages and update any hardcoded references (e.g. test assertions, screen switch statements).
- Verify the `gameFlow.ts` switch cases that reference `GamePhase.GameEnd` still compile (they use the enum member, not the string, so this should be clean).

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- Grep for `"gameend"` (lowercase, no camel) returns zero hits across the codebase.

## Dependencies
- None.
