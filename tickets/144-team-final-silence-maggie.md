# 144: Server — Team Final passive: Silence (Maggie)

## Goal
Maggie's passive: in the team final, whoever answered the previous question correctly can't buzz in on the next one — no back-to-back answers from the same player while she's the Chaser.

## Scope
- `server/src/rooms/schema/GameState.ts`: add `@type("string") lastTeamFinalCorrectSeatId: string = ""`.
- `server/src/rooms/handlers/effects.ts`: `startFinalTeam` resets `lastTeamFinalCorrectSeatId = ""` (a fresh team final never starts with anyone silenced).
- `server/src/rooms/handlers/messageHandlers.ts`: `submitFinalAnswer`'s correct branch sets `room.state.lastTeamFinalCorrectSeatId = seatId` **unconditionally** (cheap to always track; the block below is what actually gates on Maggie). In `buzzIn`, when `chaserCharacterId === "maggie"` and `seatId === room.state.lastTeamFinalCorrectSeatId`:
  - **Exception (softlock guard):** if that seatId is the *only* eligible buzzer currently connected (every other connected, non-Chaser player has already left, or there's genuinely only one contestant in the game), allow the buzz anyway — Silence must never fully lock the team out of the round. Compute "only eligible buzzer" the same way the team-final buzz-in already reasons about who's allowed to buzz (any non-Chaser connected client), not just `contestantsOrder` (eliminated players rejoin for this round per GOAL.md, so they must count as eligible buzzers too).
  - Otherwise, reject the buzz: log it and send the attempting client a targeted rejection so the UI can show *why* — reuse the existing `client.send("error", { code, message })` pattern from rate limiting (e.g. `{ code: "SILENCED", message: "You answered last — someone else has to buzz in." }`) rather than silently dropping the message like other invalid buzzes do today.
- No change needed to `advanceFinalTeamQuestion` — it doesn't touch `lastTeamFinalCorrectSeatId`, only the per-question buzz lock (`currentFinalTeamBuzzer`/`finalTeamQuestionResolved`), which stays separate from Silence's "same player twice in a row" rule (Silence spans across questions, not within one).

## Acceptance
- `cd server && npm test` and `npm run build` pass.
- Tests cover: with Maggie as Chaser, the seat that just answered correctly is rejected (with a `SILENCED` error sent back to them specifically) on the very next question, while every other connected non-Chaser seat can still buzz; that same seat *can* buzz again on the question after that (once someone else has answered, or if nobody else does and the question's buzz simply resets — confirm the exact reset condition against `advanceFinalTeamQuestion`'s flow); with any other chaser character, the same scenario allows the repeat buzzer through unchanged; the single-eligible-buzzer exception is covered by a test with exactly one contestant in the room (or all others disconnected) — Silence must not soft-lock that game.

## Dependencies
139 (roster/character id lookup). Independent of 140–143.
