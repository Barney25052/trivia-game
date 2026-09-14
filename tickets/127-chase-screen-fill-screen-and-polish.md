# 127: Full-screen layout fix, Chase screen text cleanup, and answer-bubble consistency

## Goal
User-reported live (2026-09-14): "the UI doesn't fill the full screen" on a lot of pages, called out specifically on the Chase screen where "the thing with the gradient is blocked with a line around it" — a visible bordered box floating in a sea of unused dark background, instead of an immersive full-bleed backdrop. Also reported: redundant status text on the Chase screen ("The Chaser is off the board — one correct answer to enter", "Pick your answer!"), and that the per-player answer speech bubble (already used in the Cash Builder and Team Final) is missing from other screens where players also answer questions — specifically the Chase screen.

Confirmed live with the user (asked directly, given the potentially broad blast radius): the desired direction is **full-bleed, no frame** — each screen's background/ground should stretch edge-to-edge with no border/box around it, while the actual interactive content stays comfortably centered so it doesn't look absurdly stretched on wide monitors.

## Root cause
- `#app` was capped at `height: 95%` (a stray leftover), leaving a permanent dead strip at the bottom of every screen.
- `.chaseTable`/`.chaseGround` (Chase board, ticket 116) and `.chaserFinalRoot`/`.chaserFinalStage` (Chaser Final, ticket 117) were both built as a fixed/max-width column (960px / 700px) with a bordered, border-radius'd "ground" panel inside — the exact "boxed card floating on the page background" look the user flagged. `TeamFinalScreen.vue` (ticket 118) had already solved the same problem correctly via a `position:fixed` full-viewport background layer (`.teamFinalTargetBg`), but Chase/Chaser Final predate that lesson and never got the same treatment.
- `.chaseCutscene` (the CAUGHT!/ESCAPED! cutscene box) had its own second nested border, the same issue one level deeper.
- The shared `.lobby` base class (500px max-width, used by `ChaserSelectionScreen`/`ResultsScreen`/`CashBuilderScreen`/`OfferScreen`) and its per-screen overrides (`.cashBuilder` 820px, `.offerScreen` 900px) left most of the screen as unused page background on any normal desktop width, with no distinct border but still a very narrow column.
- `ChaseScreen.vue` never wired up `ChaserPanel`'s existing `answer-text`/`answer-key` props (already built for the Chaser Final in ticket 098) for the Chaser's own pick, and had no equivalent bubble at all for the contestant's side.

## Changes made
**Layout (`client/src/style.css`):**
- `#app`: `height: 95%` → `100%`.
- `.chaseTable`: fixed `960px` column → `width:100%; height:100%; display:flex; flex-direction:column;` (no more `margin:auto` centering a narrow box).
- `.chaseGround`: border/border-radius removed, `flex:1` (fills all of `.chaseTable`'s remaining height) plus `display:flex; flex-direction:column; justify-content:center` so its content group centers within the taller full-bleed area instead of hugging the top.
- `.chaseCutscene`: border/border-radius removed (was a second nested frame inside `.chaseGround`).
- `.chaserFinalRoot`/`.chaserFinalStage`: identical treatment to `.chaseTable`/`.chaseGround`.
- `.lobby` (500px → 700px), `.cashBuilder` (820px → 1000px), `.offerScreen` (900px → 1100px): all widened (each screen's own internal max-widths on individual elements — `.voteList`, `.lineupList`, `.moneyPlaque`, `.offerBoard`, etc. — already keep those from stretching awkwardly, so this only grows the breathing room around them).
- `.teamFinalRoot`/`.teamFinalStage` and `.wheelViewport` deliberately **not** touched: Team Final already solves this correctly via its own full-viewport `.teamFinalTargetBg` layer (a documented ticket-118 decision to keep the "table" content column at a fixed stage width while the score visualization goes full-bleed separately), and the wheel's small fixed-width viewport is an intentional inset "slot machine" widget, not a page-level content frame.
- Removed now-orphaned `.chaseOffboardNote`/`.chaseOffboardNote-hidden` rules (their only consumer was deleted below).

**Chase screen cleanup (`client/src/screens/ChaseScreen.vue`):**
- Removed the "The Chaser is off the board — one correct answer to enter." note and the "Pick your answer!" status line — both redundant with what the board/buttons already show. Kept "Locked in…" and "{{name}} and the Chaser are answering…", which convey real status, not just filler.
- Added `myAnswerText`/`myAnswerBubbleKey`, wired to `ChaserPanel`'s existing `answer-text`/`answer-key` props for the Chaser's own pick, and a new `.chaserPanelBubble` on the contestant's `.board-portrait-wrap` for the contestant's own pick — each only visible on the picking player's own client (mirrors the existing privacy-safe pattern from Cash Builder/Team Final/Chaser Final; no new server broadcast needed since a multiple-choice pick is only ever known locally anyway, same as before). No independent min-life timer needed here (unlike those screens): `myAnswerIndex` only ever clears when a genuinely new question arrives, never synchronously alongside the submission itself.

## Real behavior this ticket should NOT change
Chase's answer/lockout/reveal logic, board position math, the character-picker's grayscale-reveal mechanic, Team Final's full-viewport target-bar background, the wheel spin mechanics.

## Scope
- `client/src/style.css` — layout width/height/border changes listed above.
- `client/src/screens/ChaseScreen.vue` — text removal, answer-bubble wiring.

## Acceptance
- Manual: Chase screen's gradient backdrop fills the whole screen edge-to-edge with no visible border, confirmed via `getBoundingClientRect`/`getComputedStyle` at multiple viewport widths; same for the Chaser Final's stage. The redundant status lines are gone. Picking an answer in Chase (either side) pops a speech bubble with the picked answer text over that player's own portrait, on that player's own client.
- `cd client && npm run build` passes.

## Dependencies
- 115-118 (design system foundation, Chase/Chaser Final/Team Final visual redesigns) — already shipped.
