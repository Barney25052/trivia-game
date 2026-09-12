# 081: Client — Chaser Final screen (replaces the placeholder) — UI SIGN-OFF REQUIRED

## Goal
`ChaserFinalScreen.vue` is a placeholder with a client-side countdown and a fake "Chaser caught the team" button that self-reports a win. Build the real screen for the Chaser's 2-minute race, including the steal interaction and a real win/lose render. **Per AGENTS.md this is UI work: present the direction below to the user and get sign-off before implementing.**

## Proposed direction (for sign-off)
- **What the screen shows** (`client/src/screens/ChaserFinalScreen.vue`, routed in `App.vue` for `currentScreen == "chaserFinal"`):
  - **Chaser view**: their question + answer input, their own score ticking up, the **team's target score** ("You're 3 behind the team"), and the 2-min countdown. **No buzz anywhere** — the prompt is shown and the Chaser types, exactly like the cash builder. Win moment: when `chaserScore >= teamScore` the screen shows the caught banner (winner "chaser" from the `endGame` broadcast already delivered).
  - **Team view**: the Chaser's score ticking up and the target — plus a **steal prompt** each time the Chaser misses (`finalSteal`: "Chaser got it wrong — steal the point!") with a **20s window countdown and an answer input open to every contestant** (no buzz button): the **first submitted answer is taken, even if it's wrong** (`submitFinalStealAnswer`); once someone submits, the inputs lock on all team screens and the outcome renders (push-back -1, or "too bad, the answer was …"). If the window expires with no answer, the prompt fades and the Chaser advances.
  - The persistent `ChaserPanel` stays inline on this screen (it is already gated to Offer/Chase/ChaserFinal per ticket 056's scope note).
  - **Remove the stub**: the "Chaser caught the team" button and `sendFinalChaserScore` (App.vue:420) are deleted — server-side counterpart removal is in 079.
- **Interaction**: steal answers go through `submitFinalStealAnswer` — any non-Chaser can type, **first submitted answer wins** (even if wrong) per 079; the push-back render (score -1) reuses the chase lockout pulse + result-hold styling from `ChaseScreen.vue` for a shared beat. The Chaser's own answer path never touches the buzz state.
- **Visual**: `style.css` classes only; reuse the chase lockout countdown/pulse and answer-button styles; update `style.css` in this ticket if needed. No new art assets.
- **Server plug**: consumes `finalQuestion` (077), `finalSteal`/`finalStealResolved`/`answerResult` (079) and the existing `endGame` broadcast; sends `submitFinalStealAnswer` (team) and `submitFinalChaserAnswer` (Chaser — no buzz, no steal input); wires them in `App.vue`.

## Scope
- `client/src/App.vue` (final-question handlers for the chaser side + steal wiring), `client/src/screens/ChaserFinalScreen.vue`, `client/src/style.css` if needed.
- Not in scope: Team Final screen (080), results screen (083), server changes.

## Acceptance
- Manual 2-browser check: the Chaser answers **directly with no buzzer of their own** and their score ticks up on **both** screens; a team steal is resolved by the **first submitted answer** (even if wrong) within the 20s window and renders a -1 on the Chaser's score when correct; the Chaser walks to the next question; game ends with the correct winner banner either direction (score reach → chaser; timeout → team).
- No "Chaser caught the team" stub remains in the client (grep `finalChaserScore` / `sendFinalChaserScore`).
- `cd client && npm run build` passes.

## Dependencies
- 077 + 079 (server contract, incl. the shared `finalChaserScore` removal note). Can proceed in parallel with 080.