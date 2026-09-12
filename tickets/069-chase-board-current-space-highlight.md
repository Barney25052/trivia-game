# 069: Highlight the contestant's and Chaser's *current* board space

## Goal
On the Chase board (`client/src/screens/ChaseScreen.vue`), the contestant's space is tinted blue (`playerSpace`) and the Chaser's space plus every space behind it is tinted red (`chaserSpace`, ticket 065's "trail" effect — `isChaserSpace()` at `ChaseScreen.vue:62-64`). The trail makes multiple spaces the same flat red, so there's no way to tell which one is the Chaser's *actual current* space at a glance. Add a glowing border to each token's current space, layered on top of the existing flat tint, so the current position always pops out.

## Scope
- **UI sign-off first (AGENTS.md rule)** — this is a small, contained tweak (a highlight, not a new layout), but confirm the exact glow treatment (thickness, color, whether it animates) with the user before landing it, since `style.css` is hand-edited and the user cares about the exact look.
- `client/src/screens/ChaseScreen.vue`: add a modifier class (e.g. `boardSpace-current`) applied only when `isPlayerSpace(space)` is true (contestant) or `chaserPos === space` specifically (not the whole trail range) for the Chaser.
- `client/src/style.css`: style the new modifier class with a glowing border/box-shadow using the existing `--contestant-blue-glow` / `--chaser-red-glow` custom properties (already used elsewhere, e.g. `.offerContestantMaskBox` at `style.css:1044`), distinct from the flat `.playerSpace` / `.chaserSpace` fill.
- Keep the trailing (non-current) chaser spaces exactly as they are today — only the current space gets the extra highlight.

## Acceptance
- Manual check: during a chase, the contestant's space and the Chaser's *current* space are visually distinguishable from any other tinted space (including the Chaser's own trail) at a glance.
- `cd client && npm run build` passes.

## Dependencies
- Builds on ticket 065 (`ChaseScreen.vue`, `.playerSpace`/`.chaserSpace` in `style.css`).
