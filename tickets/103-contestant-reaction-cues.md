# 103: Contestant reaction cues — server broadcasts, client flashes faces (UI sign-off required)

## Goal
Contestant faces react to gameplay: **neutral by default; correct answer → smile; wrong → frown; two wrong in a row → teary eyes**. Confirmed design: expressions **flash for a few seconds then return to neutral**, and the server is authoritative — a public `reaction` cue broadcast so every client (including spectators and the Chaser) shows the same face. Contestants only; the Chaser portrait stays static.

## Scope
Server + client.

Server:
- `server/src/gameConfig.ts`: `REACTION` block with the streak threshold (`wrongStreakTear = 2`) and the offer thresholds reused from the current OfferScreen logic. The flash hold time is client-side (below).
- New pure module `server/src/reactions.ts`: `nextExpression(prev, correct, streak)` → `"neutral" | "smile" | "frown" | "teary"` — unit-tested.
- Runtime per-seat wrong-streak state in the room (map like `sessionIdToSeatId`, cleaned on leave, reset on phase/round change — hook the existing phase broadcast).
- Broadcast `reaction { seatId, expression }` at every resolution point (messageHandlers/effects):
  - cash builder `submitAnswer` (correct → smile; wrong → frown/teary via streak),
  - chase answers per side; escape → smile; caught → teary,
  - final buzz answers + resolved steal (correct → smile),
  - offer reveal replaces OfferScreen's local computed: low set ≤ 0 → frown; high set above threshold → smile.
  - No answer text or correct index rides the cue (AGENTS.md "never broadcast before reveal"); the cue carries only correct/wrong/outcome, which the public pot/score already imply.

Client:
- `reaction` message subscription in `App.vue` into a small store; a per-seat expression flashes for `REACTION.holdMs` (~3s; client-side mirrored constant, following the codebase's existing mirror pattern) then **returns to neutral**.
- Wire the per-seat `reaction` into the `CharacterFace` instances on CashBuilder, Offer, Chase, TeamFinal, ChaserFinal (component from 102). Remove OfferScreen's local reaction/mouth computed.
- **UI sign-off per AGENTS.md**: present how the expressions look and behave before implementing.

Tests: server — pure `nextExpression` unit tests (smile on correct, frown on one wrong, teary at two wrong, streak resets on correct and on round change) + roomFlow tests asserting the `reaction` broadcast at cash builder correct/wrong, chase catch/escape, and offer reveal. Client logic verified by `npm run build` + manual 2-browser (no client test harness — see 053 precedent).

## Acceptance
- `cd server && npm test` green with the new tests.
- `cd server && npm run build` and `cd client && npm run build` green.
- Manual 2-browser: the answering client gets a correct answer → both clients see the face smile ~3s then neutral; a wrong answer → frown; two wrong in a row → teary; spectator and Chaser clients show identical reactions.

## Dependencies
- 101, 102.