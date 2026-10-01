# 167: Maggie's portrait art

## Goal
The user drew Maggie's portrait (`client/src/assets/images/chasers/maggie-icon.png`, 128×128 pixel art like the other Chasers) and asked for it to go into the game, 2026-10-01. Until now the file was a flat placeholder square, so `chaserPortraits.ts` deliberately hid it: Maggie was listed in `PORTRAIT_ART_PENDING` and every portrait slot showed the generic `ChaserSilhouette` bust for her.

## Scope
- `client/src/chaserPortraits.ts`: `PORTRAIT_ART_PENDING` is gone; `chaserPortrait` returns Maggie's art like anyone else's. It still returns null when there is no character to show yet.
- `client/src/screens/RolesRevealScreen.vue`: the roster cards' `ChaserSilhouette` fallback branches are removed, since every roster character now has art; her card uses the same base/black-cover image layers as the others.
- `client/src/style.css`: the orphaned `.p5-card-silhouette*` rules are removed. `ChaserSilhouette` itself stays: it is still the mystery bust before a character is revealed (the non-Chaser reveal frame, `ChaserPanel`, the character reveal, the chase board).
- `HUMAN_TASKS.md`: `maggie-icon.png` → `done`. GOAL.md's note that her art is a placeholder is updated.
- No direction to sign off: the art drops into the slots the other three Chasers already use.

## Acceptance
- `cd client && npm run build` green. Server untouched.
- Seen on the production build with Maggie picked in a two-player game: her roster card shows her blacked-out silhouette and the slash reveal uncovers the portrait on hover; the Chaser's lock-in frame, the Offer screen's Chaser circle and the chase board all show her portrait. The character reveal screen uses the same lookup but went by unobserved during the run.
- `grep -rn "PORTRAIT_ART_PENDING\|p5-card-silhouette" client/src` finds nothing.

## Dependencies
150 (the roster), 139 (Maggie).
