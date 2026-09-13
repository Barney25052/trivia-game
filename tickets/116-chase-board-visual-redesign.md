# 116: Chase screen (the board) visual redesign — UI SIGN-OFF REQUIRED

## Goal
Redesign `ChaseScreen.vue`/its `style.css` rules to match the mockup's "The Board" (**[Big Baws Style Guide, section 11](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)**) — reached through many rounds of live iteration with the user, including two rounds of them catching real factual mistakes in earlier passes (see "Things I got wrong" below — worth reading before assuming the mockup's first draft of anything was right; the *current* state of section 11 is correct, its history had bugs that got fixed in place).

## Depends on
Ticket 115 (type/colour tokens, chunky button family, frame-free circles, open-question-box, wipe/particle helpers) must land first.

## Agreed direction

**Layout**: Chaser portrait (circle) — board — contestant portrait (circle), side by side, matching today's `.chaseTableRow` (`ChaserPanel` + `.board` + `.offerContestantBox`) structure, just restyled. Pull the two portraits further from the board than today's spacing — the mockup roughly doubled the gap.

**Two-toned ground**: the whole scene's background is a horizontal gradient, `--ink-chase` on the Chaser's (left) side easing into the existing page navy on the contestant's (right) side, meeting in a neutral zone around the board — see mockup's `.chase-ground` gradient stops (32%/68%). The question box itself (below the board) is genuinely neutral (`--ink-raised`, not `--ink-chase-raised`) — it belongs to neither side.

**Chaser & contestant portraits**: plain circles, no border/outline, cropped edge to edge (`object-fit: cover` for the Chaser's icon so it fills the circle like a close portrait, not a small icon with padding). The Chaser's circle is 20% bigger than the contestant's (150px vs 180px in the mockup, or keep proportional to whatever base size the real screen ends up using) — **an earlier idea to have the Chaser's portrait dynamically grow/"burst out of its circle" as they close in on the contestant was tried and explicitly abandoned** by the user after seeing it ("I dont think this is working right now but thats ok... just get rid of this idea") — implement the plain static 20%-bigger version, not a growth mechanic. If a future session wants to revisit dynamic Chaser sizing, that's new direction, not a resurrection of this one.

**Board spaces**: bigger than today's 48px-tall/260px-wide track (mockup uses 58px-tall/260px-wide). No numbers on any space — remove `boardSpaceNumber` entirely. The **ESCAPE row at the bottom of the board** (`.chaseEscapeSpace`) is removed outright, not restyled. The contestant's current space shows their wager centered in the space, VT323, white (today it's `chaseWagerBadge`, gold, Roboto, off to the side — move it, recolour it, keep the underlying `chaseWagerAmount` data/logic as-is).

**Chaser trail**: confirmed against `isChaserSpace`'s actual logic (`space >= chaserPos`) — the Chaser starts at space 7 and moves toward 1. Every space the Chaser has already passed (i.e. "behind" them, closer to 7) is the *same flat dark red* (`--chaser-deep`) — no gradient/fade across the trail (an earlier round tried a brightness gradient across the trail and the user reversed that decision — flat is final). Only the Chaser's actual current space is visually distinct: brightest red (`--chaser-glow`) with a glow (`box-shadow: 0 0 14px`). No white outline anywhere — "current" reads purely from brightness/glow.

**Question box**: its own visible card (background, padding, radius) at the bottom of the scene — today the question/options just float directly on the background. Question centered over its own button row as one aligned unit (not left-hanging text above centered buttons).

**Countdown**: this addresses the user's complaint about `.chaseLockoutFlash` (`chase-lockout-bg` keyframes) currently pulsing the *entire screen* background during the answer-window countdown — **remove that full-screen flash entirely**. Replace with a small, contained VT323 digit chip that turns red/pulses under ~2 seconds remaining, positioned as a badge overlapping the edge of whichever side (Chaser's circle or contestant's circle) is the one currently needing to answer — not floating near the question text. **Implementation note**: if you nest this badge inside a circle that has `overflow: hidden` for its own portrait crop, the badge needs to live in a separate wrapper *outside* that overflow, or the crop clips it where it overlaps the circle's edge (hit this exact bug building the mockup — see its two-layer `.board-portrait-wrap` / `.board-portrait-circle` split).

**Answer buttons**: the chunky "raised, physically pressable" button from 115, applied specifically here with a twist — picking an answer *stays* pressed in (`.picked`, turns contestant-blue, matches existing `chaseOptionButton-picked` colour) rather than springing back, while the other two options dim and disable (matches existing `:disabled` behavior). This is additive chrome only; `selectOption()`'s actual logic doesn't change.

**New-question entrance sequence** (a specific three-beat animation, user's own spec, verbatim): the question box wipes in left-to-right (`clip-path: inset()`, rounded to match the box's own corners), the prompt sits alone centered with no buttons for **3 seconds**, then the prompt settles upward and the answer buttons pop in underneath with a staggered bounce. The box's overall height never changes across any of this (buttons are laid out but invisible via `opacity`/`visibility`, never `display: none`) so nothing above/below the box reflows — this matters for ticket 111 (layout stability)'s spirit even though 111 itself is closed/separate scope. **A second, wider light-streak sweeps the *entire* scene** (Chaser, board, and contestant — not just the small question box) at the same moment, so the moment reads as crossing the whole screen rather than one small panel opening on its own — see mockup's `.stage-wipe-bar`.

**Caught / Escaped cutscenes**: a proper impact/dash beat before each outcome banner, not just the banner appearing.
- *Caught*: Chaser rockets in from the left and visually "slams into" the contestant, who's launched off-screen with rotation; a white flash and a screen-shake accompany it; then the existing `CAUGHT!` banner (reuse — no changes to that banner itself). Character floats free during this (no background box behind them, per 115's frame-free rule extended to cutscenes specifically). The Chaser should be noticeably larger/more dominant in this scene than in the board's resting-state circle (mockup scales from ~120px up to ~185px for the cutscene specifically).
- *Escaped*: the mirror — contestant dashes past a grasping Chaser (who lunges and misses), a white/blue sparkle trail (reusing the burst helper from 115 with a `"★"` glyph), blue `ESCAPED!` banner instead of red.
- Both sit on the `--ink-chase`-family ground (a Chase-phase outcome either way), with a colour-appropriate top gradient accent (warm/red top-fade for Caught, cool/blue top-fade for Escaped) easing into the shared dark base.

## Real behavior this ticket should NOT change
- `isChaserSpace`/`isPlayerSpace`/`isCurrentSpace` logic, `chaseWagerAmount` data, `selectOption()`/answer submission logic, the lockout timer's actual countdown math (`chaseLockout`/`answerWindowLeft`) — only its visual presentation changes.

## Scope
- `client/src/screens/ChaseScreen.vue` — template changes for circles, board space markup (drop numbers/escape row), question-box wrapper, entrance-sequence hooks, countdown badge placement, cutscene markup.
- `client/src/style.css` — corresponding rules, reusing 115's tokens/components.
- `client/src/components/ChaserPanel.vue` may need adjusting if the circle-portrait treatment replaces its current `.chaserPanelMask` box — check whether this screen still uses `ChaserPanel` or needs its own simpler portrait markup once it's just a circle.

## Acceptance
- Manual playthrough of a full Chase round (both a Caught and an Escaped outcome) in the browser with the user watching, per AGENTS.md — this ticket's direction was agreed via mockup, not live in the app, so the first real look still needs a nod before merging.
- `cd client && npm run build` passes; `cd server && npm test` unaffected (no server changes).
- Confirm the full-screen lockout flash is gone and nothing regressed the actual answer-window timing behavior.

## Dependencies
- 115 (design system foundation) must land first.
