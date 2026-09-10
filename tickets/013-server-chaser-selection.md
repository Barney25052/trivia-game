# 013: Server: authoritative chaser selection (random + vote)

## Goal

The game must start with exactly **one Chaser** and the rest as Contestants, so Phase 2's cash-builder round order (and later the chase) run against the right players. Adds a selection phase between Lobby and CashBuilder driven by the pure `gameFlow` state machine.

## Scope

- Add `ChaserSelection = "chaserSelection"` to `GamePhase` in **both** `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` (keep identical — AGENTS rules).
- Config: add `CHASER_SELECTION = { durationMs: 30_000 }` (+ a `defaultMode = "random"`) to `server/src/gameConfig.ts`. No magic numbers in room code.
- Schema (`server/src/rooms/schema/GameState.ts`):
  - `GameState.chaserSelectionMode: string` — `""` | `"random"` | `"vote"`.
  - `GamePlayer.chaserVote: string` — sessionId the player voted for, `""` = not voted.
- `gameFlow.ts` (stay pure — see AGENTS invariants):
  - `startGame` now `Lobby → ChaserSelection` with a single effect `{ type: "startChaserSelection" }` (instead of going straight to CashBuilder).
  - New `FlowEvent` `{ type: "chaserSelectionComplete"; chaserSessionId }` valid **only** in ChaserSelection → `CashBuilder`, effects `[{ type: "assignChaser"; sessionId }, { type: "startCashBuilder"; sessionId: <first in contestantsOrder>; round: 1 }]`. Throw if `contestantsOrder` is empty.
  - New `FlowEffect` `{ type: "assignChaser"; sessionId }`.
- Room (`server/src/rooms/MyRoom.ts`) — all handlers authoritative + role/phase-checked, reject + log otherwise:
  - `setChaserMode { mode }` — host only, Lobby phase only, `mode ∈ {random, vote}`; store on `state.chaserSelectionMode`.
  - `chaserVote { targetSessionId }` — ChaserSelection phase only; any player, once each (reject if `chaserVote` already set); reject self-vote→no, self-vote IS allowed, but `targetSessionId` must exist in `state.players`; store on `player.chaserVote`.
  - `startGame` — **restrict to host** (closes the pre-existing hole where anyone could start; add test).
  - `startChaserSelection` effect: run the selection timer (`CHASER_SELECTION.durationMs`); mode defaults to `random` if none set.
    - **random**: room picks uniformly at random among all players, then dispatches `chaserSelectionComplete`.
    - **vote**: when every player has voted **or** the timer fires → tally votes; majority wins; on a tie pick uniformly at random among the tied leaders; dispatch `chaserSelectionComplete`.
  - `assignChaser` effect: set `state.chaserSessionId`, `player.role = PlayerRole.Chaser`, and **rebuild `contestantsOrder` excluding the chaser** (order preserved) — the cash-builder order must never include the Chaser.
- Update tests:
  - `gameFlow.test.ts`: new cases for `startGame → ChaserSelection`, `chaserSelectionComplete → CashBuilder` (effects order: assignChaser before startCashBuilder), phase-guard throws for `chaserSelectionComplete` outside ChaserSelection.
  - `roomFlow.test.ts`: existing `startGame → CashBuilder` expectations now pass through the selection phase — rework them to set a mode and let random resolve (selection timer must resolve immediately for random mode), plus new tests: random picks a valid player + removes them from `contestantsOrder` + sets role; vote mode majority; vote-mode tie resolves to one of the tied; non-host `setChaserMode` rejected; second vote rejected; `startGame` by non-host rejected.

Do **NOT** build client UI (014), rules/role reveal (015), or touch opentdb/bank/offer math.

## Acceptance

- `cd server && npm test` — new + existing tests green (42+; the two `roomFlow` end-to-end tests must still pass through the new phase)
- `npm run build` in **both** packages — clean
- `GamePhase.ChaserSelection` present in both `TriviaTypes.ts` files
- Repo search for the old `startGame`→CashBuilder shortcut in tests/docs returns nothing

## Dependencies

- 012 first (it deletes dead `Question`/`Answer` enum members and `Question`/`QuestionInstance` schema — same files get touched here).