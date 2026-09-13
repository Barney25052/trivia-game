# 111: Layout stability — stop elements shifting/jumping across screens (user report) — UI SIGN-OFF REQUIRED

## Goal
User report (2026-09-13): "the layouts of a lot of the pages need to be better, elements move all over the place and it looks really unprofessional." This ticket is scoped as a **stability/bug-fix pass** — finding and fixing concrete layout-shift causes (elements reflowing/jumping as content loads or changes) — **not** the full visual redesign covered by ticket 067 ("Full layout/design pass across all screens," explicitly marked as needing a live discussion rather than a solo build). Do not attempt a redesign here; if a specific screen's look-and-feel genuinely needs rethinking rather than stabilizing, leave a note for 067 instead of improvising a new design.

## Likely contributing causes to check (not exhaustive — investigate empirically per screen)
- Images without reserved dimensions (see ticket 109 — character layer images popping in without reserved space is one concrete instance of this general problem; if 109 lands first, don't duplicate that fix, just confirm it and move on).
- Conditionally-rendered elements (`v-if`) that change a container's height/width when they appear/disappear (e.g. a bubble, a flash overlay, a status line) without the container reserving space for them — causing surrounding elements to jump.
- Text content of varying length (question prompts, player names, quip/bubble text) without `min-height`/fixed-width containers, causing surrounding layout to reflow as the text changes.
- Inconsistent use of the various `*Root` screen containers' sizing (`cashBuilderRoot`, `chaserFinalRoot`, `teamFinalRoot`, etc.) — check for screens missing a stable container size/aspect-ratio that others already have.

## Proposed direction (for sign-off)
- Walk through each phase screen (Lobby, ChaserSelection/Reveal, RolesReveal, Lineup, CashBuilder, ChaserCharacterReveal, Offer, Chase, TeamFinal, ChaserFinal, Results) in the browser, at a stable viewport size, and note concretely which elements shift and why (missing reserved space, a `v-if` popping in, etc.) before touching CSS — a scattershot pass without first identifying real causes risks papering over symptoms.
- Fix root causes: reserve space (`min-height`/fixed dimensions/`aspect-ratio`) for elements that conditionally appear or whose content length varies, rather than trying to prevent every possible change — the goal is that page structure stays visually stable even as content updates within it.
- Keep every fix inside `style.css` (plus the minimal template/class changes needed to hook a reserved-space wrapper) — this is a stabilization pass, not new features or new visual design language. Preserve the existing look (gradient bg, "Luckiest Guy" font family, current colours/animations) exactly — only the *stability* of the layout changes, not its appearance.
- If, while doing this, you find a specific screen where the look itself (not just stability) is the real problem, log it as a note under ticket 067 rather than redesigning it here.

## Scope
- `client/src/style.css` primarily; minor template tweaks (adding a wrapper div, a `min-height` class) across screen `.vue` files only where needed to fix an identified shift — not a rewrite of any screen's structure.
- Not in scope: new visual design, new components, changing the overall look/theme (that's 067's territory), the specific issues already covered by tickets 106/107/108/109/110 (don't duplicate — this ticket picks up whatever's left after those land, if they land first in the same session).

## Acceptance
- Manual walk through the full game (2+ browsers) at a fixed viewport size, screen by screen — no element visibly jumps/reflows as content loads or updates (a bubble appearing, a flash triggering, a question of a different length arriving, etc.).
- `cd client && npm run build` passes.
- Document in the ticket footnote exactly which concrete shift causes were found and fixed (a list), so it's clear this was root-caused rather than guessed at.

## Dependencies
- None, but do this last if 106/107/108/109/110 are being worked in the same session, so it isn't duplicating or fighting fixes those tickets are already making.
