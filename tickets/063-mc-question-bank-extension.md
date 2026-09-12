# 063: Extend the question bank to multiple-choice (Phase 4)

## Goal
The board chase needs 3-option multiple-choice questions from our own bank (no opentdb at runtime — decided in `GOAL.md`). Today `server/data/questions.json` / `BankQuestion` (`server/src/questions/bank.ts`) only support the open-ended `{ answer, alternatives }` shape used by the cash builder and final round.

## Scope
- `server/src/questions/bank.ts`: extend `BankQuestion` to optionally carry an MC shape — `options: string[]` (the full option pool for a question) and `correctIndex: number` — alongside the existing open-ended fields. Keep both kinds in one bank file (a `kind: "open" | "mc"` discriminant, or infer from the presence of `options`) rather than splitting into two files, matching how `broadcastQuestion` (`TriviaRoom.ts:119`) already carries a `kind` field for the wire format.
- `server/data/questions.json`: add a meaningful set of MC questions (existing bank has 572 open-ended entries at various categories — decide with the user whether to add new MC-authored entries or derive MC options from existing open-ended answers + distractors; **this needs a quick check-in with the user on where the MC content comes from**, since hand-authoring hundreds of MC questions is a real content task, not just code).
- `loadBank()` / `pickRandom()`: no signature change needed if MC and open questions share one array and one id space — a per-kind filter at the picker call site is enough (the board chase and cash builder each ask for a specific `kind`).
- Update `server/test/*` question-bank tests to cover MC entries (options length, correctIndex bounds, never serialized to a client before reveal — this is the security invariant from `AGENTS.md`: "the correct MC index... must stay server-side until the moment of resolution").

## Acceptance
- `cd server && npm test` green with new tests for MC entries (shape validation, correctIndex never present on the client-facing payload — see 064's delivery handler).
- `cd server && npm run build` green.

## Dependencies
- None (extends 004/005's existing bank infrastructure). Should land before 064 (board-chase engine needs MC questions to draw from).
