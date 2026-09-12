# 095: Server — steal interaction transport: answer bubbles, outcome reveal, 3s hold

## Goal
Server side of the user-reported "**Right now it just hangs**" steal flow in the Chaser Final. Today, when the team steals:
- `finalSteal` is sent only to the team (`messageHandlers.ts:398`) — the **Chaser's client never learns a steal is live** (it just sits on "Wrong! Waiting…").
- The submitting player's typed answer is never shared — no bubble can pop on anyone.
- On submit, `room.advanceFinalChaserQuestion()` fires **immediately** (`messageHandlers.ts:470`) — no outcome beat, no countdown, the Chaser restarts instantly.

## Scope
- **Broadcast `finalSteal` to the Chaser too** (send the whole room, or keep `sendToTeam` + a chaser send): the payload only carries the Chaser's own question id/prompt + `windowMs` — no leak (AGENTS.md "never broadcast the correct answer" is about the answer, which stays server-side until resolution). The Chaser's client needs this to render the steal + team table (096) and its countdown.
- **New broadcast `finalStealAnswer { seatId, answer, questionId }`** the instant the first (winning) submission lands. The typed answer is a guess against a prompt already shown to the whole team — safe to broadcast; never include the correct answer in it.
- **Extend `finalStealResolved`** to `{ seatId, correct, correctAnswer, pushedBack }` and send it to **both** sides at resolution — including the wrong-steal case (today a wrong steal only reaches the submitter via their private `answerResult`). This is the resolve/reveal moment, so broadcasting `correctAnswer` is allowed (the banked-answer safety rule is "never before reveal").
- **New tunable `FINAL_ROUND.stealResolveHoldMs`** (default 3000, clamped like `stealWindowMs`, `gameConfig.ts`): after a steal **resolve** *and* after an **unclaimed expiry**, wait the hold before `advanceFinalChaserQuestion()` so the outcome + 3s countdown render (096) and the Chaser doesn't get a fresh question instantly. Route both paths through 094's resume seam so the paused clock stays consistent with the hold.
- Preserve the guards: first submission wins (`finalStealActive` false-guard stays), no buzz, the Chaser can never submit a steal.
- Tests (`server/test/finalRound.test.ts` style): the winning steal answer broadcasts `{ seatId, answer }` to all clients; `finalStealResolved` carries `seatId/correct/correctAnswer/pushedBack` to both sides on resolve (correct and wrong); the Chaser receives `finalSteal`; the next chaser question is delayed by `stealResolveHoldMs` on both the submit and unclaimed-expiry paths; the existing first-wins + authority tests stay green.

## Acceptance
- `cd server && npm test` — new steal-transport and hold tests green.
- `cd server && npm run build` passes.

## Dependencies
- 094 (resume seam — the hold must not break the paused clock; do the hold *from* the resume path it adds).
- Client rendering of the new payloads is 096.