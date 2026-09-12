# 080: Client — Team Final screen with buzz-in (replaces the placeholder) — UI SIGN-OFF REQUIRED

## Goal
`TeamFinalScreen.vue` is a placeholder (client-side countdown, fake submit). Build the real screen so the team's 2-minute **buzz-in** round is playable: a question is shown to the team, the first to buzz (button **or space**) gets to type the answer — nobody else. **Per AGENTS.md this is UI work: present the direction below to the user and get sign-off before implementing.**

## Proposed direction (for sign-off)
- **What the screen shows** (`client/src/screens/TeamFinalScreen.vue`, routed in `App.vue` for `currentScreen == "teamFinal"`):
  - Header: "THE TEAM FINAL" + a server-driven countdown (2 min) and the team's running score, starting at X = survivors.
  - For **non-chaser players** (every contestant — including eliminated ones, who rejoin), three states on the current team question:
    1. **Buzz open** — the question + a prominent **Buzz in** button; pressing **space** buzzes too (same effect). Everyone is looking at the same question and racing.
    2. **A contestant won the buzz** (`finalBuzz { seatId }`) — non-buzzers see "«name» is answering…" with their buzz button locked; only the winning contestant's screen shows the answer input + submit (Enter).
    3. **Answer resolved** — correct/wrong flash + "Correct answer: …" reveal backed by the existing `answerResult` message, then the next question resets to buzz-open.
  - For the **Chaser**: a waiting panel ("Chaser, your round is next — you're up after the team") — **no question, no buzz, no score of their own yet**, matching 077's per-side delivery.
- **Interaction**: only the buzz winner can type (078's rule); `teamScore` ticks up on everyone's screen via synced state (patches to all clients — same path ticket 048 fixed for the cash builder). Buzz input should be throttled client-side so a spam of space presses doesn't hammer the room (server side is guarded by `buzzIn` + `checkRateLimit` anyway).
- **Visual**: reuse the established look — `style.css` classes only (`lobby`-family layout, `answer`/`submitAnswer` input styles from the cash builder, `.roomCode`-style headers, "Luckiest Guy" titles, gradient + timers like other phase screens). A `buzz`/`buzzButton` button state (open/locked/activated) can reuse the `answerButton` styling. No new art assets; update `style.css` in the same ticket if a new class is warranted.
- **Server plug**: consumes `finalQuestion` (077) + `finalBuzz` + `answerResult` (078) messages; sends `buzzIn` and `submitFinalAnswer`; wires them in `App.vue` next to the existing `question` handler (there is no `finalQuestion` client handler yet).

## Scope
- `client/src/App.vue` (`finalQuestion`/`finalBuzz`/`answerResult` wiring for the team side, buzzer ref), `client/src/screens/TeamFinalScreen.vue`, `client/src/style.css` if needed.
- Not in scope: the Chaser Final screen (081), results screen (083), any server changes.

## Acceptance
- Manual 2-browser check (server + client dev, walk to TeamFinal): non-chaser clients see the question and the buzz button; buzzing (button and **space**) from the first client locks it out on the second and shows the winner's answer input only there; a correct answer ticks the score on **both** team and chaser clients; eliminated players can buzz too; the Chaser sees no question and no buzz button; a wrong answer reveals then advances; on the final `finalTeamTimeout` the room advances to ChaserFinal.
- `cd client && npm run build` passes.

## Dependencies
- 077 + 078 (server contract this consumes, incl. `finalBuzz`). Blocks 081's full manual verification only in so far as the phase must be reachable.