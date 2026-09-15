# 136: ContestantLineup screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
`ContestantLineupScreen.vue` (the turn-order interstitial before the first cash builder, ticket 049) already borrowed the `.lineupCard` treatment that later became the reference dark-card style for Results (124) and RolesReveal (125) — but it hasn't itself been revisited since 120 (redundant "1st"/"Up first" fix). Ticket 067's outcome note still lists it as open; worth confirming it fully matches the design system now that other screens have converged on it, rather than the other way around.

## Scope
This is a conversation, not a spec — per `AGENTS.md`'s UI rule. Before touching code:
1. Review the current `ContestantLineupScreen.vue` against the [Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc) with the user — it may turn out to already be close to done (per the same caveat 067 raised about RolesReveal, confirm rather than assume). If changes are wanted, add a Lineup section to the mockup first.
2. Present findings/direction to the user, get sign-off, then implement whatever's agreed (may be "no change needed").
- Implementation once signed off: `client/src/screens/ContestantLineupScreen.vue` + `client/src/style.css`.

## Real behavior this ticket should NOT change
The turn-order computation, `LINEUP.durationMs` hold, auto-advance into the first cash builder.

## Acceptance
- A recorded outcome (either a user-approved mockup section + implementation, or an explicit "confirmed already on-system, no change" note, mirroring ticket 067's own outcome format).
- `cd client && npm run build` passes if any change lands.

## Dependencies
- 115 (design system foundation), 120 (existing `.lineupCard` baseline).

## Outcome (2026-09-15)
Confirmed already on-system — no code changes made. Run unattended per the standing autonomous-UI-signoff note (`memory/feedback_autonomous_ui_signoff.md`): implement/confirm per the ticket's own proposed direction rather than blocking on live sign-off, since the direction here is explicitly "reuse the established pattern, don't invent a new one."

Reviewed `client/src/screens/ContestantLineupScreen.vue` and every rule it uses in `client/src/style.css` (`.lineupScreen`, `.lineupTitle`, `.lineupList`, `.lineupCard`, `.lineupCard .contestantName`, `.lineupCard-first`, `.lineupAvatar`, `.lineupOrdinal`, `.contestantYou`) against how Results (124) and RolesReveal (125) — the two screens that came *after* this one and converged on the same card family — actually use it:
- Results (`ResultsScreen.vue`) reuses `.lineupCard`/`.lineupAvatar`/`.lineupOrdinal`/`.contestantName` wholesale (style.css comment at the `.resultsPlayerMoney` rule confirms this explicitly), and deliberately does **not** reuse `.lineupCard-first`'s looping `press-me` pulse for its own top-score highlight — the style.css comment there explains why: the pulse suits Lineup's brief ~7s hold (`LINEUP.durationMs`), but would violate the "motion is feedback-only, never ambient" rule on a screen that stays up until the player clicks through. That is a documented, deliberate divergence, not drift in Lineup — it confirms Lineup's own use of the pulse is the correct baseline the other screen is explicitly measured against.
- RolesReveal (`RolesRevealScreen.vue`) uses a structurally identical but separately-named card (`.contestantCard`), explicitly scoped separately from `.lineupCard` (own style.css comment: "RolesRevealScreen.vue is the only `.contestantCard` consumer") with the same `--ink-raised`/`--ink-line` dark-card treatment, same avatar-circle-on-`--color-grey-avatar-bg` pattern, and the same `.contestantName`/`.contestantYou` colour handling. No divergence found.
- Typography: `.lineupTitle` is an `<h2>` with no `font-family` override, correctly picking up the global `h1,h2,h3,h4 { font-family: var(--font-display) }` (Luckiest Guy) rule — same mechanism `.revealContestantsTitle`/`.lobbyTitle` rely on. `.lineupOrdinal` correctly uses `--font-pixel` (VT323) for its bare position number, matching the documented "board-space-number role" from ticket 115. Body text (`.contestantName`, `.contestantYou`) uses `--font-body` (Rubik), consistent everywhere.
- Colour/surface tokens: `.lineupCard` uses `--ink-raised`/`--ink-line`, the same dark-card surface as `.contestantCard` and the cash-builder/offer panels; `.lineupScreen` itself sets no background and correctly inherits the flat `--color-bg-page` navy from `body`, matching the documented "team-centric screens keep `--color-bg-page` as-is" convention (comment above `.revealContestants`).
- Buttons: this screen has no buttons (it's a passive, timed interstitial that auto-advances via `LINEUP.durationMs`/`scheduleTimer`), so the `.btn` family and moneyPlaque/open-question-box components the ticket flagged as "likely doesn't need those" are correctly absent.
- No dead CSS: grepped for `lineupFirstTag` (ticket 120's removed "Up first" tag) across `client/src` — zero matches. No orphaned rule was left behind when that element was dropped.

**Ticket 120 regression check**: still intact. The template (`ContestantLineupScreen.vue`) renders only the `lineupOrdinal` badge ("1st"/"2nd"/...) plus the `lineupCard-first` pulse highlight for position 1 — no separate "Up first" tag exists anywhere in the template or CSS. Confirmed live in the browser (see below): the first contestant's card shows exactly one positional signal.

**Visually verified** (both dev servers via the Browser preview tools, 3 real players — Ryan as host/contestant, Maya as contestant, Chris auto-picked as Chaser — through Lobby → ChaserSelection → RolesReveal ready-up → Lineup):
- Title "CONTESTANTS IN ORDER" renders in the Luckiest Guy display font, centered.
- Two cards rendered side by side (the two contestants; the Chaser correctly does not appear on this screen), each a dark `--ink-raised` card with a `--ink-line` border and rounded corners, matching the Results/RolesReveal card look.
- Ryan's card (position 1, "you") shows a "1st" badge (blue circle, top-left corner) and a red "(you)" tag under the name — no second "up first" label anywhere.
- Maya's card shows a plain "2nd" badge, no "(you)" tag.
- Round avatar with the character face renders correctly inside each card.
- No host crown appears on this screen — correct, since Lineup shows turn order among contestants only, not lobby/host status (the crown is a Lobby-only concept, confirmed by grep: `crown` only appears in `LobbyScreen.vue`/`ChaserSelectionScreen.vue`).
- The screen auto-advanced into Cash Builder after the ~7s hold with no interaction needed, confirming `LINEUP.durationMs`/auto-advance was untouched (it was never touched — no code changed).

No gaps found. No out-of-scope bugs found during this play-through.

`cd server && npm test` run as the required sanity check (server untouched by this ticket): 334 passing, matching the current baseline exactly — no regressions. No `client && npm run build` run since no code changed (ticket's own acceptance criterion only requires it "if any change lands").
