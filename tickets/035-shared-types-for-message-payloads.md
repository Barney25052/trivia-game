# 035: Shared type definitions for server→client message payloads

## Goal
Type sharing between server and client is currently two duplicated enums (`TriviaTypes.ts`). The `offer`, `getReady`, `phase`, and `endGame` broadcast payloads are untyped — the client `onMessage` handlers take implicit `any`. As payload shapes multiply (question broadcasts, chase results, social channels), hand-maintained-duplication of payload shapes doesn't scale: a renamed field in a server broadcast silently breaks the client. Commit to a shared type approach before Phase 2 defines the question payload — the cheapest point to lock in.

## Scope
- Create `common/MessageTypes.ts` (or `shared/MessageTypes.ts`) containing TypeScript interfaces for every server→client message payload:
  - `PhasePayload { phase: GamePhase }`
  - `OfferPayload { low: number; middle: number; high: number }` (or whatever the current shape is)
  - `GetReadyPayload { cooldownMs: number }`
  - `EndGamePayload { winner: string }`
  - `QuestionPayload` (skeleton, matching ticket 030's shape)
  - Any future payloads (chase result, taunt, etc.) — add skeletons now or as they land.
- Server imports from `common/MessageTypes.ts` when calling `this.broadcast("offer", payload)`.
- Client imports the same types for `onMessage("offer", (message: OfferPayload) => ...)`.
- Add a parity test: a test in `server/test/` that asserts every `GamePhase` enum member in `common/TriviaTypes.ts` matches the server's copy (extend the existing 018 test, or add a new one for message types if feasible — at minimum, a compile-time check via shared import).
- Remove the `any`-typed `onMessage` handlers in `App.vue`.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- Every `onMessage` handler in `App.vue` has an explicit type (no implicit `any`).
- `common/MessageTypes.ts` exists and is imported by both server and client.
- Grep: no `onMessage(` call in the client uses an untyped callback.

## Dependencies
- None. Can be done independently; ideally before Phase 2 lands new message channels.
