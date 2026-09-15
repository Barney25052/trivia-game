# 145: Chaser ability tray in ChaserPanel — UI SIGN-OFF REQUIRED

## Goal
`ChaserPanel.vue` (shared across Offer/Chase/ChaserFinal per ticket 056) is where the Chaser's identity already lives — it's the natural home for a compact readout of their ability kit: what they can trigger right now, how many charges are left, and a passive blurb for the ones that just happen automatically. Also establishes the public "the Chaser just used X" cue everyone sees.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Mock up the tray treatment: where it sits in `ChaserPanel.vue`'s existing layout (portrait + name + quip bubble), how an active-ability button looks in its three states (available / disabled-no-charges / disabled-wrong-phase), how remaining charges render (a count? pips?), how the passive blurb is shown (always visible vs. a tooltip/expand), and how the public `chaserAbilityUsed` broadcast (ticket 140) surfaces to non-Chaser clients (a toast? a line in the quip bubble?).
2. Present to the user, get sign-off, then implement.
- Implementation once signed off: `client/src/components/ChaserPanel.vue` + `client/src/style.css`. New props for the ability state (uses-remaining counters, current character's ability metadata from ticket 139's config, whether each active ability is currently usable) and a `use-ability` emit that `OfferScreen.vue`/`ChaseScreen.vue`/`ChaserFinalScreen.vue` wire to a new `sendMessage("useChaserAbility", { ability })` in `App.vue`, plus an `onMessage("chaserAbilityUsed", ...)` handler there feeding whatever public cue was agreed on.
- This ticket only builds the shared tray shell and plumbing. It does **not** need to render every ability's bespoke in-game effect (a jumbled board, a voided middle tier, a steal outcome) — those are tickets 146–148, which each add their own screen-specific rendering and call into this tray's buttons/emits.

## Real behavior this ticket should NOT change
The existing quip channel (tickets 055/057) and its bubble, the persistent panel's phase scoping (Offer/Chase/ChaserFinal only, per ticket 056's footnote), anything server-side (140's handler is already authoritative — this ticket is purely about surfacing its state and triggering it).

## Acceptance
- A recorded, user-approved mockup, then a manual walkthrough live in the browser: the tray correctly shows/hides/disables buttons across at least two different chaser characters (one with an active ability, Bezos with none) and across the three phases it appears in.
- `cd client && npm run build` passes.

## Dependencies
139, 140 (ability config + activation handler must exist to wire against).
