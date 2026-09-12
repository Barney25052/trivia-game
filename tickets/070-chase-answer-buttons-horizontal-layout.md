# 070: Lay out chase answer buttons side-by-side instead of stacked

## Goal
The three MC answer buttons on the Chase screen (`client/src/screens/ChaseScreen.vue:158-171`, `.chaseOptions` in `client/src/style.css`) are currently stacked vertically (`flex-direction: column`). They should sit next to each other horizontally instead.

## Scope
- `client/src/style.css`: change `.chaseOptions` from a column to a row layout (`flex-direction: row`, wrapping as needed — `flex-wrap: wrap` — so it still degrades sensibly on narrow viewports).
- `.chaseOptionButton` currently sets a fixed `width: 300px` (`style.css`) sized for a stacked column; revisit the sizing (e.g. a smaller fixed width, or `flex: 1` with a `min-width`) so three buttons fit side-by-side at typical viewport widths without overflowing horizontally. Reuse the pattern already established by `.offerTierRow` / `.offerTierButton` (`style.css:1105-1115`), which solves the same "buttons side-by-side" layout for the Offer screen.
- No script changes expected — this is CSS-only.

## Acceptance
- Manual check: on the Chase screen, all three answer buttons render in a row (wrapping to a second line only if the viewport is too narrow to fit them), matching the Offer screen's tier-button layout style.
- `cd client && npm run build` passes.

## Dependencies
- Builds on ticket 065 (`ChaseScreen.vue`, `.chaseOptions`/`.chaseOptionButton` in `style.css`).
