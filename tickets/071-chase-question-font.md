# 071: Chase question prompt is using the wrong font

## Goal
Every other question/label class in `client/src/style.css` sets `font-family: "Luckiest Guy", cursive;` (e.g. `.cashBuilderQuestion` at `style.css:672-680`, `.offerSpaceNumber`, `.lobbyTitle`, etc.), but `.chaseQuestion` (added in ticket 065) has no `font-family` declared at all. Since `body` (`style.css:12-19`) also sets no font-family, the Chase question prompt falls back to the browser's default font instead of the site's display font.

## Scope
- `client/src/style.css`: add `font-family: "Luckiest Guy", cursive; font-weight: 400; font-style: normal;` to `.chaseQuestion`, matching the pattern used by `.cashBuilderQuestion` and every other text class in the file.
- While in there, double check no other new class added in ticket 065 (`.chaseWaitingStatus`, `.chaseOffboardNote`, `.chaseEscapeSpace`, `.chaseOutcomeBanner`, `.boardSpaceNumber`, `.chaseWagerBadge`) is missing the same declaration — `.chaseEscapeSpace`, `.chaseOutcomeBanner`, and `.boardSpaceNumber`/`.chaseWagerBadge` already have it; `.chaseWaitingStatus` and `.chaseOffboardNote` rely on the `playerName` class they're combined with in the template for their font, which is correct — just confirm `.chaseQuestion` is the only gap.

## Acceptance
- Manual check: the Chase question prompt renders in the same "Luckiest Guy" display font as the cash-builder question and other headings.
- `cd client && npm run build` passes.

## Dependencies
- Builds on ticket 065 (`.chaseQuestion` in `client/src/style.css`).
