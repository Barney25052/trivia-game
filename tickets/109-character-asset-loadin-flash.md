# 109: Character layer images flash/look broken on first load (user report)

## Goal
User report (2026-09-13): face option 2 took a while to load in the Lobby picker and looked broken while doing so; more generally, parts of a character's body take a while to load the first time, which reads poorly (e.g. the very first "smile" reaction).

## Current state
`client/src/assetPreload.js` already calls `new Image().src = ...` for every layer image `CharacterFace.vue` can use (face/hair/eyes/mouth variants, including the reaction art), and `client/src/App.vue:23` calls `preloadImages()` at module scope — so preloading is already wired up, but the user is still seeing load-in delay/breakage. Investigate why the existing preload isn't fully hiding first-use latency before changing anything:
- `preloadImages()` fires as soon as `App.vue`'s module evaluates, which may be at almost the same moment the Lobby's character picker (or any other early `CharacterFace` usage) first tries to render those same images — a race, not a guarantee, especially over a slow/cold connection. `new Image().src = ...` also doesn't return a promise the app can wait on, so there's currently no way to know preloading has actually finished.
- Confirm whether an `<img>` with no explicit `width`/`height` is the reason a not-yet-loaded image looks "broken" (a collapsed/zero-size box, or a broken-image icon, rather than a graceful placeholder) — check `.offerFaceLayer`/`.offerFaceWrap` in `style.css` for any reserved dimensions.
- Check whether the actual placeholder PNGs (`client/src/assets/images/*.png`) vary significantly in file size — a much larger `face-2.png` would explain why that one specifically was slow while others weren't.

## Proposed direction
- Give `CharacterFace.vue`'s wrapper/layers fixed dimensions (via CSS, on `.offerFaceWrap`/`.offerFaceLayer`) so a not-yet-loaded image reserves its space instead of collapsing or showing a jarring broken-image glyph — this alone should remove the "looks broken" perception even if a load is still in flight.
- Make `preloadImages()` actually awaitable (return a `Promise.all` of each image's `load`/`error` event) and gate the earliest real usage of `CharacterFace` (the Lobby picker) on it if practical — e.g. show a brief "loading…" state or simply delay rendering the picker's live thumbnails until preload settles, rather than changing the overall app boot flow. Keep this proportionate: don't block the whole app on every asset if that's overkill — the goal is just to stop mid-list images from visibly stalling.
- If the actual file sizes are unnecessarily large for placeholder art, consider that a data problem to flag rather than something to "fix" with more code — note it in the ticket footnote rather than trying to optimize placeholder PNGs that will be replaced by real art later.

## Scope
- `client/src/assetPreload.js`, `client/src/components/CharacterFace.vue`, `client/src/style.css`, `client/src/screens/LobbyScreen.vue` if the picker's own thumbnail rendering needs the same treatment.
- Not in scope: replacing placeholder art, the tint/position ticket (108), general layout stability (separate ticket) — though if this ticket's fixed-dimension change also happens to reduce layout shift elsewhere, that's a welcome side effect, not the goal.

## Acceptance
- Manual: hard-refresh (clear cache) and open the Lobby character picker — cycling through face/hair options (including face option 2 specifically) shows no broken-image flash or visible pop-in stall; if an image genuinely hasn't loaded yet, its space is reserved cleanly rather than collapsing.
- Manual: trigger a reaction (e.g. a correct Cash Builder answer) as the very first reaction of a fresh session and confirm the happy eyes/mouth art appears without a load stall.
- `cd client && npm run build` passes.

## Dependencies
- None (builds on 102/103).
