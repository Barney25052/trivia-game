# 042: Recover the game flow when the active player leaves mid-round

## Goal
Disconnecting mid-game (reload = forfeit seat, per AGENTS.md) currently freezes the round: if the active contestant leaves during `CashBuilder`, `Offer`, or `Chase`, the room keeps spinning timers for a ghost session and nobody can answer/choose/advance — the table is stuck until everyone else leaves.

## Scope
- `server/src/rooms/TriviaRoom.ts` (`onLeave`):
  - When the leaving client is not the host (host already disconnects the room, close code 6767), run the flow recovery instead of only deleting state.
  - Since the state machine's `FlowEvent`s are session-addressed, recovery belongs in the **room** (it owns `onLeave`) but must route through `gameFlow` for the transition, mirroring the effect/`dispatch` pattern — do not decide transitions in `onLeave` (keep `gameFlow.ts` pure).
  - Scope the recovery to what the current phase needs:
    - `RolesReveal` / `ChaserSelection`: the ready/vote gates re-check membership — verify leaving during these phases already unblocks the game, and fix only if it doesn't (the ready gate must not wait forever on a departed seat).
    - `CashBuilder` / `Offer` / `Chase` (active player): advance to that contestant's `startOffer`/next-contestant/`startChase` outcome as if the round was forfeited or caught — pick the policy (safest default: treat a leave as a forfeit → caught, no offer paid) and implement via a `FlowEvent` if one is needed, or reuse `chaseCaught` where the phase allows.
    - `TeamFinal`: a team member leaving mid-group round doesn't block scoring; verify and leave as-is.
- `server/src/rooms/TriviaRoom.ts` / `QuestionManager`: on leave, clean the departed player's `questionManager` state (`clearContestant`) and `messageTimes` (already done) so no per-seat state leaks across the game.
- `server/src/gameFlow.ts`: only if a new event/effect is required (e.g. `contestantForfeit`) — keep it pure and tested like the others.

## Acceptance
- `cd server && npm test` passes; `cd server && npm run build` passes.
- New tests (extend `roomFlow.test.ts` or a new `leaveFlow.test.ts`): active contestant leaves during `CashBuilder` → room still reaches `Offer`/next contestant; same for `Offer`. No timers keep firing for the departed session; `QuestionManager` holds no state for the departed seat.
- A non-active player leaving during a round does not disturb `activeContestantSessionId`.

## Dependencies
- None (pure follow-up; touches room wiring only).