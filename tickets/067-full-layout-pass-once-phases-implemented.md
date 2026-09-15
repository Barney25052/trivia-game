# 067: Full layout/design pass across all screens once every phase is implemented

## Goal
Once every phase (through Phase 5's final round) has a real, non-placeholder screen, sit down with the user and go through the **whole app's layout together** — not a ticket one agent implements alone. Individual screens have been built and signed off one at a time (per AGENTS.md's UI rule), but nobody has looked at them side by side as one coherent app: consistent spacing/sizing, how the persistent Chaser panel (056) sits across the screens it appears on, board/offer/chase visual consistency, mobile/small-window behavior, and general "does this feel like one game" polish.

## Scope
- **This is a conversation, not a spec.** The agent picking this up should not walk in with a redesign — open every screen in the running app with the user, look at each one, and let them direct what changes. Treat this like the AGENTS.md UI sign-off rule, but for the whole app retroactively instead of one screen at a time.
- Likely candidates to walk through (not prescriptive — let the discussion decide): Lobby, ChaserSelection/ChaserWheel, ChaserReveal, RolesReveal (character picker), Lineup, the new ChaserCharacterReveal (059), CashBuilder, Offer, Chase, TeamFinal, ChaserFinal, GameEnd.
- Capture whatever comes out of the discussion as new, separate follow-up tickets (per-screen or per-issue) rather than trying to fix everything in this one session — this ticket's job is the conversation and the resulting punch list, not the implementation.
- Don't touch game logic/server code in this ticket — visual/layout only.

## Acceptance
- A recorded punch list of agreed layout changes (as new tickets, or notes in this ticket if small enough to fix in the same session with sign-off per change).
- Nothing merged without the user having seen and approved it live in the browser, per AGENTS.md.

## Dependencies
- Should wait until Phase 4 (063–066) and Phase 5 (final round) have real screens — reviewing placeholders alongside finished screens isn't useful. Revisit sequencing if the user wants to do an earlier partial pass instead.

## Outcome (2026-09-13)
The conversation happened — not live in the running app as originally envisioned, but against an iteratively-updated mockup artifact ([Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)), which turned out to work well for this: many fast rounds of "here's a direction → here's what's wrong → here's the fix," all reflected live in one URL the user could keep reopening, without needing a running server for every iteration.

Screens actually covered, each with its own resulting ticket:
- Chase board (`ChaseScreen.vue`) → ticket 116
- Chaser Final + the Steal (`ChaserFinalScreen.vue`) → ticket 117
- Team Final (`TeamFinalScreen.vue`) → ticket 118
- Lobby (`LobbyScreen.vue`) → ticket 119

Shared type/colour/component system underlying all four → ticket 115 (implement first; 116–119 depend on it).

**Not covered — still open for a future round of this same discussion**: Home, RolesReveal (the character-picker screen itself was the *aesthetic reference point* for the whole conversation, not redesigned — it may already be fine as-is, but that's an assumption worth confirming, not a decision that was made), ChaserSelection (vote-mode list), ChaserWheel (random-mode reveal), ChaserCharacterReveal, ContestantLineup, Offer, Results/GameEnd (only a "rank the podium by correct answers" idea was floated for Results, not a full pass). Pick this ticket back up (or open a fresh one referencing it) to continue the conversation for those.
