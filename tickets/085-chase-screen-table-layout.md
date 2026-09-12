# 085: Chase screen redesign — at-the-table 16:9 layout with a persistent contestant profile

## Goal
The Chase screen is currently a narrow centred column (`.lobby.chaseScreen`, max-width 380px) so it never reads as two players facing off, and the "horizontal" answer buttons (070) still stack 2+1 because each is 190px wide inside a ~340px question area. Rebuild the screen as a 16:9 table: **Chaser on the left, money board in the centre, the active contestant's profile on the right and visible the whole round**, with the question prompt + three answer buttons in a single row along the bottom. Do **not** build for mobile/small windows — design for the full 16:9 aspect.

## Scope
- `client/src/screens/ChaseScreen.vue` + `client/src/style.css` (only touch `App.vue` if plumbing is genuinely needed).
- Layout: reuse `ChaserPanel` on the left; the 7-space board + ESCAPE space centred; the active contestant's layered-face profile on the right (reuse the `OfferScreen` composition — `offerFaceWrap`/`offerShoulders`/`offerFaceLayer` pattern and the `face-*.png`/`hair-*.png`/`eyes-*.png`/`mouth-*.png` assets in `client/src/assets/images/`), with a `--contestant-blue-glow` identity outline, staying on-screen for the entire round (including the result hold — see `chaseFreeze` in App.vue).
- Question + answers along the bottom in a full-width strip; the three MC buttons genuinely side-by-side in **one** row at 16:9 (this supersedes 070's wrap — re-pin widths/sizing for a single row; if the 088 contestant-blue token has landed, use it for picked/correct states).
- The layout is fixed 16:9 and intentionally not responsive — no `@media (max-width: ...)` handling for this screen.
- This is user-directed scope pulled forward from the 067 whole-app pass. Per AGENTS.md's UI rule, present the rendered screen to the user and get sign-off before finalizing.

## Acceptance
- Manual (two browser clients through a full chase): the contestant's profile is visible for the whole round; chaser left, board centre, contestant right, question + horizontal answer buttons at the bottom; reads as one composed 16:9 scene at a typical 16:9 window.
- `cd client && npm run build` passes.

## Dependencies
- 064/065 (chase exists). Supersedes 070's wrap behaviour. 088 (contestant-blue token) optional; coordinate with 087/089 which touch the same screen.