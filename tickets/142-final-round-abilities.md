# 142: Server — final-round abilities (Skip, Pushback Immunity, Time Bonus, Short Fuse)

## Goal
Wires the four final-round abilities into the Chaser's own answering phase (`ChaserFinal`) and the team's steal mechanic — one shared active ability (Skip) plus three character passives.

## Scope
Changes land in `server/src/rooms/TriviaRoom.ts`, `server/src/rooms/handlers/messageHandlers.ts` (`submitFinalChaserAnswer`, `submitFinalStealAnswer`), and `server/src/rooms/handlers/chaserAbilities.ts`.

- **Skip** (shared, any character, 2 uses/game, active): plugs into ticket 140's `applyChaserAbilityEffect` for the `"skip"` case. Effect: discard the current chaser-final question with no scoring consequence at all (no correct, no wrong, no steal opened) and immediately call the existing `advanceFinalChaserQuestion()` to draw the next one. Ticket 140 already gates this to `ChaserFinal` phase, an unresolved current question, and no active steal window.
- **Pushback Immunity** (Bezos only, 3 uses/game, passive — no manual trigger, consumes automatically): in `submitFinalStealAnswer`'s correct-steal branch, currently:
  ```
  if (room.state.chaserScore > 0) { room.state.chaserScore -= 1; pushedBack = true; }
  else { room.state.teamScore += 1; }
  ```
  When the Chaser is Bezos, `room.state.chaserScore > 0`, and `pushbackImmunityUsesRemaining > 0`: decrement the counter, leave `chaserScore` untouched, and report `pushedBack: false` — the steal still resolves as "correct" for the team (they see the right answer confirmation and the success reaction), it just doesn't move the Chaser back. Once the counter hits 0, subsequent steals push back normally. This never touches the "Chaser at 0 → raise the team's target" branch — immunity only ever cancels an actual push-back, never a target raise (there's nothing to protect at 0; letting the target-raise trigger unchanged is correct here and matches the original design intent "a successful pushback doesn't pushback"). Broadcast enough in `finalStealResolved` for the client to distinguish "correct steal but immune" from a normal push-back (e.g. add a `pushbackBlocked: true` field) so ticket 148 can show a distinct message instead of implying the steal failed.
- **Time Bonus** (Big Stan only, unlimited, passive, +0.5s per correct): in `submitFinalChaserAnswer`'s correct branch (before the win-check `chaserScore >= teamScore`), when the Chaser is Big Stan and the clock is currently running (`room.chaserFinalClockRunning`), add `CHASER_ABILITIES.timeBonusMs` (500) to `room.chaserFinalRemainingMs`. Do this by extending the same mechanism `pauseChaserFinalClock`/`resumeChaserFinalClock` already use to track elapsed time (read the remaining time as of now, add the bonus, keep the countdown timer running against the new total) rather than letting the existing scheduled `scheduleTimer` fire on the old duration — reschedule it. Sync the change through `syncChaserFinalClockState()` immediately so clients see the extended time.
- **Short Fuse** (Nami only, unlimited, passive, steal window 10s not 20s): `room.stealWindowMs` is currently a fixed field set once from `FINAL_ROUND.stealWindowMs`. When the active Chaser's character is Nami, use `CHASER_ABILITIES.shortFuseStealWindowMs` (10,000) instead — set this in the `startFinalChaser` effect (`effects.ts`) right before the steal mechanic can ever fire, reading `chaserCharacterId` off the Chaser's player record. Everywhere else that reads `room.stealWindowMs` (the steal-open broadcast, the expiry timer) needs no other change since they already read the room field rather than the config constant directly.

## Acceptance
- `cd server && npm test` and `npm run build` pass.
- Tests cover: Skip discards a question with no score change and no steal window, and is rejected a 3rd time in the same game; a correct steal against Bezos with charges remaining doesn't decrement `chaserScore` and reports `pushbackBlocked: true`, but a correct steal once his 3 charges are spent behaves exactly like today (`pushedBack: true`); a correct steal against Bezos while he's already at 0 still raises the team's target as normal (immunity doesn't interfere with that branch); Big Stan's correct chaser-final answers extend `chaserFinalRemainingMs` by exactly 500ms each, verified against the synced `GameState` fields; Nami's `ChaserFinal` uses a 10,000ms steal window while every other character still uses 20,000ms.

## Dependencies
140 (activation handler + counters, for Skip). Independent of 141.
