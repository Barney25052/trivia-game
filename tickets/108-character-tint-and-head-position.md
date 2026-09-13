# 108: Character colours render too lightly; head sits too high — UI SIGN-OFF REQUIRED

## Goal
User report (2026-09-13, first real use of ticket 102's character system): the hair/face colour tint is applied too lightly to read as the chosen colour, and the character's head should sit slightly lower in its frame.

## Current implementation
`client/src/components/CharacterFace.vue` layers shoulders → face → hair → eyes → mouth inside `.offerFaceWrap`, with `hairFilter`/`faceFilter` computed from `client/src/characterColours.ts`'s `characterColourFilter(colourIndex)` (a CSS `filter` recipe: grayscale/sepia/hue-rotate/saturate/brightness) applied via inline `:style="{ filter: ... }"` on the `<img>` layers (lines ~71-72, ~82-83). Positioning comes entirely from the existing `.offerFaceWrap`/`.offerShoulders`/`.offerFaceLayer` classes in `style.css` (originally sized for the single static Offer-screen face, now reused everywhere by ticket 102).

## Proposed direction (for sign-off)
- **Tint strength**: read `characterColourFilter`'s recipe in `client/src/characterColours.ts` and increase saturation/opacity of the tint so a selected colour reads clearly against the greyscale/placeholder base art — likely raising `saturate(...)` and/or adding a stronger `brightness`/`contrast` step, or layering a semi-transparent color overlay (e.g. a `background-blend-mode` tint div) if pure CSS `filter` can't get there cleanly. Verify visually across a few different colour indices (not just index 0) that the result is clearly distinguishable from its neighbors in the 9-colour palette, not just "a bit different."
- **Head position**: nudge the face/hair/eyes/mouth stack down within `.offerFaceWrap` (a `margin-top`/`transform: translateY(...)`/adjusted `top` offset — whichever the existing layout technique in `style.css` uses for that wrapper) by a modest amount (start around 8-15px, or a similar proportion, and eyeball it against the shoulders layer so the head sits naturally on top of them rather than floating high). Check this doesn't clip or overlap on any of the 6 screens that use `CharacterFace` (CashBuilder, Offer, Chase, TeamFinal, ChaserFinal, ContestantLineup) — sizes may differ per screen if `.offerFaceWrap` is scaled differently in each.
- Since there's no real greyscale art yet (still today's colour placeholder PNGs per ticket 102's own note), tune against what's actually on screen now — the fix should still make sense once real greyscale art lands (i.e. don't hack around a placeholder-specific quirk in a way that would look wrong with real art).

## Scope
- `client/src/characterColours.ts`, `client/src/components/CharacterFace.vue`, `client/src/style.css`.
- Not in scope: the asset pop-in/loading-flash issue (separate ticket), wiring `CharacterFace` into new screens (separate ticket).

## Acceptance
- Manual: pick several different hair/face colours in the Lobby picker and confirm each one is clearly, visibly tinted (not a faint wash) in the live preview and on every screen `CharacterFace` renders on.
- Manual: the head sits visually lower/more natural relative to the shoulders on at least 3 of the 6 screens `CharacterFace` appears on (spot-check CashBuilder, Offer, and one Final screen).
- `cd client && npm run build` passes.

## Dependencies
- None (builds on 102).
