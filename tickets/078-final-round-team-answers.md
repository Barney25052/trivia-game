# 078: Final round — team buzz-in + answers (server)

## Goal
Make the team's 2-minute final round a real buzzer race: a question is shown to the team, the **first non-Chaser to buzz in** (on-screen button, or pressing space) wins the right to type the answer — and only that contestant's `submitFinalAnswer` is accepted ("no one else"). Correct → `teamScore + 1`, wrong → reveal the correct answer and go to the next question. This replaces the earlier "first submitted answer" group model (TO_REVIEW #17 — decided by the user).

## Scope
- New `buzzIn` message (`{ questionId }`) in `messageHandlers.ts` + registered in the `TriviaRoom.ts` messages map through the existing `checkRateLimit` wrapper.
- Guards (authoritative, mirror the existing handlers):
  - Phase must be `GamePhase.TeamFinal`.
  - Sender is a non-chaser seat (`seatId` present and `!== chaserSeatId`) — every contestant, active/waiting/eliminated, may buzz.
  - `questionId` matches the current team question (tracked server-side beside the 077 stream, mirroring `currentChaseQuestion`).
  - No one has buzzed this question yet.
- Server keeps a per-question buzz holder (`currentFinalTeamBuzzer` seatId, cleared when the question advances). On the first valid buzz: store it and broadcast `finalBuzz { questionId, seatId }` to every client so each screen locks its buzz button and shows who is answering.
- `submitFinalAnswer` (`{ questionId, answer }`) requires the sender to **be** the current buzzer — no other non-Chaser may submit for that question. Correct → `teamScore + 1`; wrong → no change. Either way send the cash-builder-shaped `answerResult { correct, correctAnswer }` to the buzzer and advance the team stream (077) — the next question opens a fresh buzz.
- If nobody buzzes, the question stays up and the round keeps running; the existing `finalTeamTimeout` timer is the only bound (no per-question buzz window — the 2-minute clock is the pressure).
- Buzzer leaves/disconnects before submitting: release the buzz lock back to open (any non-Chaser may buzz again) — add an `onLeave` branch for `TeamFinal` in `TriviaRoom.ts`.
- Never broadcast the expected answer; `teamScore` is synced in state (scores are not secret).
- No changes to `gameFlow` (transitions `finalTeamTimeout → ChaserFinal` already exist).

## Acceptance
- New `server/test/finalRound.test.ts` (extend the file from 077):
  - First `buzzIn` from a non-Chaser locks the question; a second `buzzIn` for the same question (from anyone) is rejected; `finalBuzz` broadcasts the winning `seatId`.
  - Only the buzzer's `submitFinalAnswer` is accepted — a different non-Chaser sending the correct answer is rejected (no score change, no advance).
  - Correct answer → `teamScore + 1` and the next `finalQuestion` arrives; wrong → `teamScore` unchanged, reveal fires, stream advances.
  - An **eliminated** contestant can buzz and answer, and it counts.
  - The **Chaser's** `buzzIn` and `submitFinalAnswer` are rejected.
  - `buzzIn`/`submitFinalAnswer` outside `TeamFinal`, malformed, or with a stale `questionId` are rejected.
  - Buzzer leaves before answering → the question returns to open and a later buzz is accepted.
  - No buzz at all: the question stays available and the round still ends on `finalTeamTimeout`.
- `cd server && npm test` green; `cd server && npm run build`.

## Dependencies
- 077 (the team stream + `finalQuestion` delivery to non-Chasers). 080's screen consumes this handler plus `finalBuzz`.