# 123: ChaserSelection (vote) + ChaserReveal (wheel) visual redesign — UI SIGN-OFF REQUIRED

## Goal
Found during an autonomous polish pass (2026-09-14): now that Lobby, Chase, Chaser Final/Steal, and Team Final all use the 115-119 design system (dark grounds, Luckiest Guy/VT323/Rubik type, chunky buttons, frame-free circles), `ChaserSelectionScreen.vue` (the vote-mode "pick the Chaser" list) and `ChaserWheelScreen.vue` (the slot-machine reveal spin) are the two remaining screens still on the pre-redesign look — a plain white card with default pill buttons, and the old blue page gradient. They sit right at the very start of every game (the wheel plays in *every* game, vote mode or random) so the clash is one of the first things a player sees.

## Root cause
Neither screen was in scope for tickets 115-119 (which covered Lobby/Chase/Chaser Final/Team Final specifically). No mockup section exists for either — this ticket proposes a direction from the already-agreed design tokens/components rather than a new mockup pass.

## Proposed direction
No new components — this is pure reuse-and-restyle from 115's existing shared primitives, same spirit as ticket 119's "almost entirely reuse-and-restyle" framing.

**`ChaserSelectionScreen.vue` (vote mode):**
- Drop the plain `<ul>`/white-card look entirely. Wrap the list in a dark raised card: `background: var(--ink-raised); border: 1px solid var(--ink-line); border-radius: 14px;` (the same card language `.lobbyCharacterPicker`/`.open-question-box` already use) instead of the browser-default list styling.
- `.voteRow`: keep the flex row layout, add a `border-bottom: 1px solid var(--ink-line)` divider between rows (last row: none) instead of the current no-divider/white-card grouping.
- `.voteName`: white Rubik text (`color: var(--color-white)`) instead of black — it's sitting on a dark card now.
- `.voteStatus` ("voted" / "your pick"): move to the VT323 pixel font, gold (`var(--color-gold)`), matching how other small scoreboard/status badges in the app read (e.g. `.oq-eyebrow`) — this is status metadata, not prose.
- `.voteButton`: becomes `.btn.btn-primary` sized down (a small chunky raised button), replacing the plain pill.
- `.voteRow.voteTarget` (highlights your own pick): replace the pale-green highlight — green is reserved for "correct" everywhere else in the app (115's colour rule) and "this is my pick" isn't a correctness signal — with a subtle blue-tinted background instead: `rgba(var(--contestant-blue-glow-rgb), 0.12)` plus a `1px solid var(--contestant-blue-glow)` left border, echoing how a "your own" state reads elsewhere (e.g. the Offer screen's blue contestant box).

**`ChaserWheelScreen.vue` (the spin):**
- `.wheelScreen`: replace the old `linear-gradient(135deg, var(--gradient-page-start), var(--gradient-page-end))` blue gradient with the plain dark ground (`background-color: var(--color-bg-page)`) — this moment is team-centric (nobody's revealed as Chaser yet), matching the "plain navy, no chase tint" rule already applied to Lobby/Cash Builder/Team Final.
- `.wheelViewport`: replace the `rgba(white, 0.85)` near-white background with a dark raised card (`var(--ink-raised)`, plus a `1px solid var(--ink-line)` border) so the mask-gradient fades into the dark ground at top/bottom instead of into white.
- `.wheelSlot`: switch from black text to the VT323 pixel font in white (`color: var(--color-white)`) — this reads as a slot-machine/arcade readout, the same register as board-space numbers and countdown chips elsewhere.
- Leave the actual spin mechanics (`runScan`/`runLanding`/timing constants) completely untouched — presentation only.

## Real behavior this ticket should NOT change
`chaserVote` message handling, `haveVoted`/`voteTargetSeatId` computed logic, the wheel's scan/landing physics and timing (`spinMs`/`wobbleMs`/`scanSpeed`/etc.), how `chaserSeatId` arriving triggers `runLanding()`.

## Scope
- `client/src/screens/ChaserSelectionScreen.vue`, `client/src/screens/ChaserWheelScreen.vue` — template class changes only, no markup restructuring needed.
- `client/src/style.css` — corresponding rules for `.voteRow`/`.voteName`/`.voteStatus`/`.voteButton`/`.voteRow.voteTarget`, `.wheelScreen`/`.wheelViewport`/`.wheelSlot`.

## Acceptance
- Manual: play through both chaser-selection modes (random skips straight to the wheel; vote mode shows the restyled vote list first) with 2+ browser clients — the vote list and the wheel both read as dark-themed and consistent with the rest of the app, not a leftover white/blue-gradient screen.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must land first — already shipped.
