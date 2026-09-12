# 087: Chase lockout pulse — full-screen background in dark blue

## Goal
The 5s lockout pulse (072) currently flashes only the `.chaseQuestionArea` background in black (`rgba(0,0,0,0.5)`), which reads as a panel effect rather than the "clock is ticking" danger it should be. Make the pulse cover the whole viewport as a background layer, and use a dark blue tint instead of black.

## Scope
- `client/src/style.css` — rework `@keyframes chase-lockout-bg` from black to dark blue (e.g. a dark `rgba` built from `--contestant-blue-glow`, or a new dark-blue token declared in `:root` — reuse ticket 088's tokens if they've landed by then).
- `client/src/screens/ChaseScreen.vue` — add a fixed full-viewport flash layer driven by the existing `lockoutActive` computed, mirroring the `.cashBuilderScreenFlash` full-screen-panel pattern from the cash builder (`position: fixed; inset: 0; pointer-events: none`) so it sits behind the board/buttons and can't swallow clicks or fight stacking.
- Keep or drop the button-scale pulse (072) based on what the user prefers once they see the full-screen version.

## Acceptance
- Manual: during a chase lockout the entire viewport pulses dark blue behind the board/buttons on every client (contestant, Chaser, spectators).
- `cd client && npm run build` passes.

## Dependencies
- 072 (the `chaseLockout`/`chaseLockoutStarted` signal exists). Coordinate with 085/088 — 085 redesigns the same screen, 088 provides the colour tokens.