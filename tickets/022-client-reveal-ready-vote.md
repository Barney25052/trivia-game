# 022: Client: roles-reveal baked into the flow as a phase screen (ready vote + get-ready countdown)

## Goal

The roles reveal is a **real step in the game flow, not an overlay**. Today the client pops a modal the moment `chaserSessionId` appears in synced state, so it floats over whatever screen comes next (ChaserSelection resolving, then CashBuilder with its timer already running). After this ticket the reveal **only renders as the active screen for the `RolesReveal` phase** — the server (021) owns the transition `ChaserSelection → RolesReveal → CashBuilder`, and the client renders exactly one screen per phase, with no overlay layer at all. "Let's Play" becomes a **group gate**: everyone clicks ready, the screen shows who's still waiting, and once all are ready the room moves to the cash builder with a short "Get ready…" cooldown before the questions start. Server groundwork is 021 — this ticket must land before 019 is judged done, because the current overlay is what the 019 agent is fighting when it pops over the chaser-selection screen.

## Scope

- `client/src/App.vue`:
  - Add `case GamePhase.RolesReveal: return "rolesReveal";` to `currentScreen`; render `RolesRevealScreen` as the phase screen.
  - **Remove the overlay machinery wholesale** — this is the core of the ticket, not a side note: delete `rolesRevealOpen`, `hasRevealedRoles`, the `if (newState.chaserSessionId && !hasRevealedRoles)` trigger, and `closeRolesReveal`; delete the overlay `<RolesRevealScreen>` render block. After this, **nothing in the app is ever drawn on top of the active phase screen**.
  - `currentScreen` must be a pure function of `currentPhase` (driven by the server's `phase` broadcast + `GameState.currentPhase`) — no state-side effects decide screen visibility.
  - Add a `revealReady()` sender (`room.send("revealReady", {})`) mirroring the existing handlers.
  - Listen for `room.onMessage("getReady", …)` so the ready countdown is server-accurate.
- `client/src/screens/RolesRevealScreen.vue`:
  - Replace the single "Let's Play" dismiss with a "Ready" button that emits `revealReady` (once per player; disabled once sent) and a per-player ready tick list (`player.revealReady`) so everyone sees who's still waiting.
  - Text reflects the vote: "Waiting for everyone to be ready…".
- `client/src/screens/CashBuilderScreen.vue`: show a "Get ready…" countdown for `cooldownMs` (from the `getReady` message; fall back to a short fixed local countdown if the message is absent) before the existing 60s display/placeholder — the active contestant shouldn't be surprised mid-countdown.
- `client/src/style.css`: classes for ready ticks, the disabled Ready button, and the get-ready state (kebab-case, palette reuse). Remove any dead overlay styling.
- No server changes (all in 021).

## Acceptance

- `cd client && npm run build` — clean
- The reveal is a **phase screen, checked by phase only**: it renders *iff* `currentPhase === GamePhase.RolesReveal`, and no other phase ever has it visible (grep the diff for `rolesRevealOpen` / `hasRevealedRoles` / `chaserSessionId`-driven rendering → none remain)
- The reveal can never overlap another screen — including ChaserSelection when it resolves and CashBuilder — because there is no overlay layer left in the app
- During RolesReveal the screen shows every player's ready state, and "Ready" is a one-shot button
- The cash builder does not begin a running countdown until the server's `getReady` cooldown has elapsed (i.e. the reveal cannot sit over a started timer)

## Dependencies

- 021 (RolesReveal phase, `revealReady` message, `getReady` broadcast) — land first.
- Unblocks 019: the overlay this removes is currently popping over `ChaserSelectionScreen` on resolution.