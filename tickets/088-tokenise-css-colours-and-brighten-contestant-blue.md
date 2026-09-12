# 088: Colour system — tokenise every colour in `style.css` into `:root` CSS custom properties and make the contestant blue pop

## Goal
AGENTS.md says to prefer CSS custom properties in a `:root` block so the palette can be re-themed from one place, but `style.css` (~1400 lines) still hardcodes most colours. Two user asks land in one ticket: (1) sweep the file so every repeated colour is a named token — the whole program can then be redesigned from `:root` alone; (2) the contestant blue (`--contestant-blue-glow: #1f9fe0`) doesn't stand out — it's too close to the page gradient (`#189ccd → #0a72da`) so the contestant's identity (board space, picked MC answer, profile outline) gets lost.

## Scope
- `client/src/style.css` only, plus any new rules that follow. No component markup changes unless a token name improves clarity.
- Build a small, obvious token set in `:root`: contestant blue (pick a brighter/more saturated value — tune it against the page gradient so it clearly reads as "the contestant" vs the Chaser's reds), chaser reds (`--chaser-red-dark/glow/bright`, `--chaser-silhouette`), the green used for correct/start/ready, greys (disabled/placeholder), `#ffe27a` (chip/amount colour), whites, dark background colours, and the two page gradients.
- Replace raw colours across every rule with the tokens; `:root` is the expected (only) home of raw colour values; allow documented one-offs (e.g. a distinct rgba used by exactly one animation tint) only if genuinely unavoidable.
- Makes sure the new blue shows through where it matters most: chase `playerSpace`/`boardSpace-current`, `chaseOptionButton-picked`, and the contestant profile outlines (Offer + Chase + the new 085/086 screens).

## Acceptance
- `cd client && npm run build` passes.
- Grep: raw hex/rgb values in `style.css` outside `:root` reduced to zero, or each one is a justified exception noted inline.
- Manual: the contestant's blue (board space, picked MC button, profile outline) reads instantly as "the contestant" at a glance.

## Dependencies
- None. 085/086/087 should build on its tokens once landed.