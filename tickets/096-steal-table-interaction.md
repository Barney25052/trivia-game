# 096: Client — steal-table interaction: answer bubbles, outcome + countdown, Chaser sees the table — UI SIGN-OFF REQUIRED

## Goal
Fix "Right now it just hangs" on the player side of the Chaser-Final steal, and give the Chaser the table view during the pushback. When the Chaser misses, the team's table at the bottom should show the first submitted answer popping out of that player's seat, the correct/wrong outcome, a 3s countdown, then the Chaser resumes.

## Proposed direction (for sign-off)
- **`ChaserFinalScreen.vue`, steal mode** (currently `messageHandlers` sends the steal to the team only; 095 changes the transport):
  - **Everyone — including the Chaser — sees the team table during a steal.** Today `ChaserFinalScreen.vue:248-291` splits `isChaser` vs `v-else-if="stealActive"`, so the Chaser sees only static "Wrong! Waiting to see if the team steals…". Restructure: a steal window renders the `chaserFinalTeamRow` table (already built, lines 266-279) to *all* seats.
  - **Submitter's answer pops from their seat**: render the `finalStealAnswer { seatId, answer }` payload as a `chaserPanelBubble`-style bubble over that player's seat on every client (key by seatId + a message key), so the whole room sees *who* answered and *what*.
  - **Outcome**: on `finalStealResolved { seatId, correct, correctAnswer, pushedBack }` show "☑ Stolen! · Chaser pushed back" / "The target goes up" (pushedBack false) or "✗ Wrong — the answer was …" (correct=wrong case), from 095.
  - **3s countdown**: after resolution (and on a locally-detected unclaimed expiry) show a `3 → 2 → 1` tick over `stealResolveHoldMs` before the question area resets — keep the existing local steal-window ticker (`nowTick`/`stealWindowEndsAt`) for the open window; the hold ticker is separate.
  - Flash: green for a correct steal, red for wrong — see 100's shared flash approach; reuse the existing `chaseLockoutFlash` layer or the cash-builder flash classes.
- **Visual**: `style.css` only; new classes kebab-case, mirroring `teamFinalPlayer`/`chaserPanelBubble` styling; no new art assets. No `v-html`.
- **Server plug**: consumes the 095 payloads (`finalSteal` now reaching the Chaser, `finalStealAnswer`, extended `finalStealResolved`); keeps `submitFinalStealAnswer`.

## Scope
- `client/src/screens/ChaserFinalScreen.vue`, `client/src/App.vue` (new handlers for `finalStealAnswer` + extended `finalStealResolved`), `client/src/style.css`.
- Not in scope: the server (095), the Chaser's own answer bubble (098), quips (097), the Team Final's own-seat bubble linger (099).

## Acceptance
- Manual 2-3 browsers (server + client dev, walk to ChaserFinal): Chaser answers wrong → **both** the Chaser's and each team client's screen show the team table + steal prompt + window countdown; a teammate submits → the answer bubble appears over that exact seat on every client; the outcome line + 3s countdown render; then the next chaser question arrives.
- `cd client && npm run build` passes.

## Dependencies
- 095 (transport and hold). Can be implemented in parallel with 094/097-100.