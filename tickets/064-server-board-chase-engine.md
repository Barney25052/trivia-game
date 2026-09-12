# 064: Server — authoritative board-chase engine (Phase 4)

## Goal
Replace the current honor-system `chaseResult` handler (`server/src/rooms/handlers/messageHandlers.ts:204-219`) — which just trusts a client-sent `{ escaped: boolean }` with no question, no timer, and no position tracking at all — with the real head-to-head board chase per `GOAL.md`: 7-space board, MC questions from the bank (063), a 5-second lockout window once either side answers, both sides able to advance on the same question, and server-driven catch/escape resolution.

## Scope
- `server/src/gameConfig.ts`: `CHASE_QUESTION` already has `optionCount`/`answerWindowMs` stubs — wire them for real; add any additional tunables needed (e.g. board size already in `BOARD`).
- `server/src/rooms/schema/GameState.ts`: `GamePlayer.boardPos` already exists (defaults to `BOARD.escapeSpace`) but is never written by real gameplay — wire it: contestant starts at `BOARD.startLow/Middle/High` per their chosen offer tier (already computed in `gameFlow.ts` `contestantStartSpace`, currently unused downstream), Chaser starts at `BOARD.chaserStartOffboard` and moves to `BOARD.chaserFirstCorrectSpace` on their first correct answer, then decrements per correct answer.
- New server-authoritative flow per chase question: deliver an MC question (3 of the options, `correctIndex` never sent to clients — reuse `broadcastQuestion`'s `kind: "mc"` path, extend the payload with `options`), accept answers from **both** the active contestant and the Chaser via a new/extended message (phase + role + question-id guarded, like `submitAnswer`), start the 5s lockout timer on the *first* answer (either side), allow the second side to still answer within the window, resolve both positions when the window closes or both have answered, then either draw the next question or dispatch `chaseEscape`/`chaseCaught` when a side reaches the terminal space.
- Remove or replace the placeholder `chaseResult` handler and its `contestantChoice`-style trust-the-client shape — this is exactly the kind of "never trust client-sent values for... answer correctness" case `AGENTS.md` Security calls out.
- `gameFlow.ts`: `chaseEscape`/`chaseCaught` events already exist and are unchanged in shape — only what triggers them changes (now server-computed from real positions, not a raw client message).
- Tests in `server/test/`: full chase round (both sides answering, lockout timing, catch case, escape case), plus authority/shape guards on the new answer message (matching the `submitAnswer` guard pattern).

## Acceptance
- `cd server && npm test` green with new chase-engine tests (position tracking, lockout window, both-sides-advance-on-correct, catch, escape).
- `cd server && npm run build` green.
- No `correctIndex` ever appears in a message broadcast to non-Chaser... actually never to *any* client before that question resolves — grep the diff for this before calling it done.

## Dependencies
- Depends on 063 (MC question bank). Should land before 065 (client screen needs the real message contract) and 066 (integration tests need this engine).
