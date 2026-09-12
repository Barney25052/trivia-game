# 084: Chaser character reveal — name text flashes black with a white outline before settling white

## Goal
On the ChaserCharacterRevealScreen (059) the character's name (`h1.ccrName`) has an ugly first moment: it renders as black text with a white outline, then snaps to the intended white. The reveal should read cleanly from the first frame.

## Scope
- `client/src/screens/ChaserCharacterRevealScreen.vue` + `client/src/style.css` (`.ccrName`, `@keyframes chaser-character-name-in`, the `.ccrScreen.name` state, and anything the name inherits — `h1` defaults at style.css `.h1, h2, h3, h4`).
- Root-cause it first: check the keyframe's opacity/transform stages, inherited `h1` styling, any text-stroke/outline, and how the name sits over the black `ccrScreen` background + white spotlight beam. Fix the real cause (colour, stroke, or animation keyframe) rather than papering over the frame.
- Don't touch the portrait/spotlight choreography — just the name text's appearance through its entrance.

## Acceptance
- Manual (two browser clients): walk a game to ChaserCharacterReveal (after the first cash builder). The reveal name reads cleanly on every client from first frame to done — no black-with-white-outline flash.
- `cd client && npm run build` passes.

## Dependencies
- Ticket 059 (the reveal screen exists and shipped this).