# 080: Client — Team Final screen (replaces the placeholder) — UI SIGN-OFF REQUIRED

## Goal
`TeamFinalScreen.vue` is a placeholder (client-side countdown, fake submit). Build the real screen so the team's 2-minute group round is playable. **Per AGENTS.md this is UI work: present the direction below to the user and get sign-off before implementing.**

## Proposed direction (for sign-off)
- **What the screen shows** (`client/src/screens/TeamFinalScreen.vue`, routed in `App.vue` for `currentScreen == "teamFinal"`):
  - Header: "THE TEAM FINAL" + a server-driven countdown (2 min) and the team's running score, starting at X = survivors.
  - For **non-chaser players** (every contestant — including eliminated ones, who rejoin): the current team question, an answer input + submit (Enter), and a correct/wrong flash + "Correct answer: …" reveal backed by the existing `answerResult` message — visually mirroring `CashBuilderScreen.vue` so round-to-round pacing feels consistent.
  - For the **Chaser**: a waiting panel ("Chaser, your round is next — you're up after the team") — **no question, no score of their own yet**, matching 077's per-side delivery.
- **Interaction**: any team member's first submission answers the current question (078's model); the pot/score ticks up on everyone's screen via synced `teamScore` (patches to all clients — same path ticket 048 fixed for the cash builder).
- **Visual**: reuse the established look — `style.css` classes only (`lobby`-family layout, `answer`/`submitAnswer` input styles from the cash builder, `.roomCode`-style headers, "Luckiest Guy" titles, gradient + timers like other phase screens). No new art assets required; update `style.css` in the same ticket if a new class is warranted.
- **Server plug**: consumes `finalQuestion` (077) + `answerResult` (078) messages; wires them in `App.vue` next to the existing `question` handler (currently there is no `finalQuestion` client handler at all).

## Scope
- `client/src/App.vue` (`finalQuestion`/`answerResult` wiring for the team side), `client/src/screens/TeamFinalScreen.vue`, `client/src/style.css` if needed.
- Not in scope: the Chaser Final screen (081), results screen (083), any server changes.

## Acceptance
- Manual 2-browser check (server + client dev, walk to TeamFinal): non-chaser clients see the question and can submit; a correct answer ticks the score on **both** team and chaser clients; eliminated players can still answer; the Chaser sees no question; on the final `finalTeamTimeout` the room advances to ChaserFinal.
- `cd client && npm run build` passes.

## Dependencies
- 077 + 078 (server contract this consumes). Blocks 081's full manual verification only in so far as the phase must be reachable.