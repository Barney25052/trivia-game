# 172: The Chaser watches the Team Final

## Goal
Direct user request, 2026-10-20: "Chasers should be able to view contestant final round". `TeamFinalScreen.vue` already has a watching view for the Chaser (ticket 159), but the server still sends team questions to the team only (ticket 077), so the Chaser only ever saw "The team is answering".

## Scope
- Server: `sendFinalQuestion` sends both sides to the whole room. The team and Chaser streams draw from one non-repeating set (ticket 077), so seeing the team's questions tells the Chaser nothing about their own. Answers still never ride on `finalQuestion`.
- `FinalQuestionPayload`'s comment, `App.vue`'s `finalQuestion` comment and GOAL.md's Phase 5 line are updated to match.
- No new UI: the Chaser's watching view already exists.

## Acceptance
- `finalRound.test.ts`: the team-side test now checks that the Chaser gets the same team `finalQuestion` as the team, with no answer in it.
- `cd server && npm test` green; `npm run build` green in both packages.
- Seen live as the Chaser: the Team Final shows the live question, then who buzzed.

## Dependencies
077, 159.
