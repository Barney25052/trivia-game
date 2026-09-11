# 046: Remove dead CSS — `.rotate` rule and `pan-bg` keyframe

## Goal
`client/src/style.css` has style that no component references: `.rotate` (`style.css:29`) and `@keyframes pan-bg` (`style.css:653`). No-cruft rule: hand-maintained stylesheet stays clean, no orphaned rules.

## Scope
- `client/src/style.css`: remove the `.rotate` block and the `@keyframes pan-bg` block (do NOT touch `rotate-logo` / `scale-logo`, which are used).
- Before removing, grep the client source for `.rotate`, `rotate`, and `pan-bg` to confirm zero references.

## Acceptance
- `cd client && npm run build` passes (typecheck + vite).
- Grep for `rotate` (the dead rule) and `pan-bg` returns nothing outside any intentionally-kept animation.

## Result (done 2026-09-11)
- The "confirm zero references" step FAILED for `.rotate`: it is still applied by `class="rotate"` in `client/src/screens/HomeScreen.vue:42` (the home-screen logo wrapper; the img inside separately uses `.logo` / `scale-logo`). Per user decision, `.rotate` is **kept** — it is working, referenced styling, not dead code.
- `@keyframes pan-bg` had zero references and was **removed**.
- `cd client && npm run build` passes; grep for `pan-bg` returns nothing.