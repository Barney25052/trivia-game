# 122: No transition into the Team Final — the last Chase drops straight into it (user report)

## Goal
User report (2026-09-13): "There also needs to be transitions between parts of the game, after the table it literally just throws you into the final round. That's too fast." Confirmed in `server/src/gameFlow.ts`: both `chaseEscape`/`chaseCaught` (lines ~248-267) and `contestantForfeit` (lines ~275-295), when there's no next contestant, push `{ type: "startFinalTeam" }` and jump `nextPhase` straight from `GamePhase.Chase` to `GamePhase.TeamFinal` in the same transition — no interstitial, unlike the equivalent moment at the *start* of the contestant rotation, which already gets one (`GamePhase.Lineup`, ticket 049).

## Proposed direction — mirror ticket 049's already-proven pattern
Add a short holding phase between the last Chase resolving and the Team Final actually starting, exactly the way `Lineup` sits between Roles Reveal and the first Cash Builder:
- **Server**: add `GamePhase.TeamFinalIntro` to `server/src/TriviaTypes.ts` **and** `client/src/TriviaTypes.ts` (must stay identical, per the existing duplication convention). In `gameFlow.ts`, when `chaseEscape`/`chaseCaught`/`contestantForfeit` have no next contestant, transition to `TeamFinalIntro` instead of `TeamFinal` directly, with a `startTeamFinalIntro` effect. Add a `TEAM_FINAL_INTRO` (or similarly-named) block to `gameConfig.ts` with a `durationMs` (a short hold — a few seconds, in the same range as `LINEUP.durationMs` ~5s; use your judgement, this is a beat, not a real screen to read for long), clamped like the other duration configs. The room runs that as a normal timer (`scheduleTimer`, matching every other hold phase) and auto-dispatches a `teamFinalIntroComplete` event that carries the flow into the *actual* `startFinalTeam` effect + `GamePhase.TeamFinal`, the same two-step shape `Lineup`→`lineupComplete`→`CashBuilder` already uses.
- **Client**: a small new interstitial screen (e.g. `client/src/screens/TeamFinalIntroScreen.vue`) — something like "Onto the Team Final!" plus the surviving contestants who made it back (the same data `ResultsScreen`/`Lineup` already have access to), auto-forwarding once the phase flips, matching `ContestantLineupScreen.vue`'s existing pattern closely (read that file for the template to follow). Wire into `App.vue`'s `currentScreen` routing. Style with existing classes where possible (reuse `lineupScreen`/`lineupTitle`/`lineupList`-family patterns) — keep it simple, this is pacing, not a new visual system (leave the *look* of it to whatever the 115-119 redesign's conventions turn out to be, or restyle later — don't invent new chrome here if 115 has already landed by the time you do this).
- Keep this scoped to the Chase→Team-Final boundary specifically, since that's the one reported. If it obviously feels like other phase boundaries (Team Final→Chaser Final, Offer→Chase) need the same treatment once this lands, note it in the footnote for a future ticket rather than expanding scope here.

## Scope
- `server/src/TriviaTypes.ts`, `client/src/TriviaTypes.ts`, `server/src/gameFlow.ts`, `server/src/gameConfig.ts`, `server/src/rooms/TriviaRoom.ts`/`handlers/effects.ts` (wiring the new effect + timer).
- `client/src/screens/TeamFinalIntroScreen.vue` (new), `client/src/App.vue`, `client/src/style.css`.
- Not in scope: any other phase-transition gaps, the visual redesign (115-119).

## Acceptance
- `cd server && npm test` — new transition test(s): a Chase resolving with no next contestant goes `Chase → TeamFinalIntro → (timer) → TeamFinal`, not straight to `TeamFinal`. `cd server && npm run build` and `cd client && npm run build` green. `TriviaTypes` parity verified by both builds succeeding (per the existing convention — not a manual grep).
- Manual: play a game down to the last contestant's Chase outcome (either escape or caught) — a brief "Onto the Team Final" beat is visible before the real Team Final screen appears, instead of an instant cut.

## Dependencies
- None (mirrors ticket 049's already-shipped pattern).
