# 173: Everyone watches the Cash Builder question

## Goal
Direct user request, 2026-10-20: the other contestants and the Chaser should see the playing contestant's Cash Builder questions. Every client already receives the questions, but `CashBuilderScreen.vue` showed watchers only "Alice is building their pot".

## Scope
- Server: the `cashBuilderAnswer` broadcast also carries `correct` and `correctAnswer`. The question is finished by the time it's answered, and the next one is a different question, so this reveals nothing still in play.
- Client: one question card for everyone. Watchers see the live prompt under "Alice is answering", the answer bubble (already there), then "Correct!" or "Wrong! The answer was …". Only the player gets the input row, the blue "your turn" accent and the full-screen flash.
- UI direction signed off by the user in chat (the full question card).

## Acceptance
- `cashBuilderFlow.test.ts`: a watcher receives `cashBuilderAnswer` with `correct` and `correctAnswer` after a wrong answer, and after a right one.
- `cd server && npm test` green; `npm run build` green in both packages.
- Seen live as the Chaser: the question, the bubble and the reveal.

## Dependencies
128 (answer bubble broadcast), 129 (Cash Builder redesign).
