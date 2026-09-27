# 160: Playtest feedback — taglines, Chaser-only 50/50, visible final answers, final answers on the leaderboard, bigger Time Bonus

## Goal
Direct user feedback after playing the polished build (2026-09-27): drop the quip under each character on the Chaser picker; 50/50 should only take options away from the Chaser, not the contestant; everyone should see what the Chaser answers in the final round, and the same for contestants; the end-of-game leaderboard should count final-round answers; and Big Stan's Time Bonus didn't seem to add any time.

## Scope
1. **Taglines** — removed from the roster cards, and the now-unused `tagline` data with them: `CHASER_CHARACTERS` (gameConfig.ts), the three chaser-character broadcasts (effects.ts), App.vue's offer capture, the client copy (chaserAbilities.ts), the CSS rule and two test assertions.
2. **50/50 is the Chaser's alone** — the shared question (`options`, `correctIndex`) is no longer touched. The Chaser's client alone is re-sent the question with `hiddenOptions: [one wrong index]` (`TriviaRoom.sendFiftyFiftyToChaser`, over a new generic `sendChaseQuestionView` that Jumble now uses too). The contestant and spectators keep every option; both sides still answer with real indices. Jumble and 50/50 no longer interact, so ticket 157's re-jumble path and the `jumbleActive` flag are gone. Client: `renderedOptions` leaves hidden options out, and a same-question re-send (50/50 or Jumble) no longer hides the answers for the 3s entrance again.
3. **Final-round answers are public** — a new `finalAnswer` broadcast: `{ side, questionId, seatId, answer, correct }`, plus `correctAnswer` on the team side only (the question is resolved; a Chaser miss opens a steal on the same question, so that side never carries it).
   - Team Final: the answer bubble pops over whoever answered on every screen, and a wrong answer shows "The answer was …" to the whole room, the Chaser included.
   - Chaser Final: the Chaser's answer bubble shows for everyone and holds for its full 3s even when a correct answer brings the next question in the same tick; when a miss opens a steal, the STEAL! card says what the Chaser answered.
4. **Leaderboard counts the final round** — a new `GamePlayer.finalCorrectAnswers` (correct Team Final answers and correct steals, blocked push-backs included). Results rank and show Cash Builder + final-round correct answers.
5. **Time Bonus** — it did work, but +0.5s on a clock shown in whole seconds was invisible. Now `CHASER_ABILITIES.timeBonusMs` is 2000 (descriptions updated in both copies), and a "+2s" floats off the TIME LEFT number when it lands.

## Acceptance
- `cd server && npm test` green: new "ticket 160" tests in `finalRound.test.ts` (team answer reaches every client with the reveal and counts; a wrong one doesn't count; the Chaser's answer reaches everyone without the real answer; a correct steal counts); the 50/50 tests in `chaserAbilities.test.ts` rewritten for the Chaser-only view (contestant/spectator get nothing new, the shared question keeps every option, Jumble's shuffle is never disturbed); Time Bonus tests follow `timeBonusMs`.
- `npm run build` green in both packages.
- Visual: each new state captured and reviewed (the Chaser's 50/50, bubbles and reveals for spectators and the Chaser, the steal card line, "+2s", the leaderboard).

## Dependencies
159.
