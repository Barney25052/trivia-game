# 022: Client: roles-reveal as a phase screen with a ready vote + get-ready countdown

## Goal

The reveal is a proper screen in the flow, not an overlay that floats over the cash builder. "Let's Play" becomes a **group gate**: everyone clicks ready, the screen shows who's still waiting, and once all are ready the room moves to the cash builder with a short "Get ready…" cooldown before the questions start. Server groundwork is 021.

## Scope

- `client/src/App.vue`:
  - Add `case GamePhase.RolesReveal: return "rolesReveal";` to `currentScreen`; render `RolesRevealScreen` as the phase screen (it is no longer a floating overlay).
  - Remove the overlay machinery: `rolesRevealOpen`, `hasRevealedRoles`, the `if (newState.chaserSessionId && !hasRevealedRoles)` trigger, and the `closeRolesReveal` handler. `chaserSessionId` coming in no longer drives a modal — the server owns the transition to RolesReveal.
  - Add a `revealReady()` sender (`room.send("revealReady", {})`) mirroring the existing handlers.
  - Listen for `room.onMessage("getReady", …)` when entering CashBuilder so the ready countdown is server-accurate.
- `client/src/screens/RolesRevealScreen.vue`:
  - Replace the single "Let's Play" dismiss with a "Ready" button that emits `revealReady` (once per player; disabled once sent) and a per-player ready tick list (`player.revealReady`) so everyone sees who's still waiting.
  - Text reflects the vote: "Waiting for everyone to be ready…".
- `client/src/screens/CashBuilderScreen.vue`: show a "Get ready…" countdown for `cooldownMs` (from the `getReady` message; fall back to a short fixed local countdown if the message is absent) before the existing 60s display/placeholder — the active contestant shouldn't be surprised mid-countdown.
- `client/src/style.css`: classes for ready ticks, the disabled Ready button, and the get-ready state (kebab-case, palette reuse).
- No server changes (all in 021).

## Acceptance

- `cd client && npm run build` — clean
- During RolesReveal the reveal screen is the active screen (never overlapping another phase's UI), shows every player's ready state, and "Ready" is a one-shot button
- The cash builder does not begin its countdown until the server's `getReady` cooldown has run

## Dependencies

- 021 (RolesReveal phase, `revealReady` message, `getReady` broadcast).