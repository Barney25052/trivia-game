# 117: Chaser Final + Steal visual redesign — UI SIGN-OFF REQUIRED

## Goal
Redesign `ChaserFinalScreen.vue`/its `style.css` rules to match the mockup's "Chaser Final — finalized" and "The Steal" (**[Big Baws Style Guide, sections 06, 12, 14](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)**).

## Depends on
Ticket 115 (foundation). Ticket 116's board/portrait treatment is a useful visual reference but this screen doesn't share markup with the board.

## Agreed direction

**The Chaser's own turn (default state)** — an imposing top banner replacing today's small 220×220 `ChaserPanel`:
- Chaser portrait rendered much larger (mockup: ~190px tall) with a dramatic drop-shadow, name in VT323 beneath it, sitting on the `--ink-chase` ground with a soft red radial vignette behind (`.chase-stage-vignette`).
- **Keep the existing target-box row as-is** (`finalTargetRow`/`finalTargetBox`) — the user explicitly liked it ("it's cool") — but add a **full-bleed dark tension-fill bar** behind/around it: a solid `--chaser-deep` rectangle spanning the scene, growing in width from left as `chaserScore` climbs toward `teamScore` (width = `chaserScore / teamScore * 100%`), with a bright `--chaser-edge` leading line. This is a new layer, not a replacement for the target boxes.
- Below that: the question is **open-ended text, not multiple choice** — confirmed against `ChaserFinalScreen.vue`, this round uses a free-text input (`chaserAnswerInput`), not the Chase board's answer buttons. Use the shared `.open-question-box` from 115, red-accented (`accent-red`) for the Chaser's own turn — prompt, chunky input, chunky Submit button. Time/score line (`Time left: Ns · Chaser N — Target N`) moves fully into VT323 as one HUD strip, since it's scoreboard data, not prose.

**A new "Watching" state — this is a small functional change, not purely visual.** Today, while the Chaser answers, teammates see only "The Chaser is answering…" with the question itself withheld — but nothing about the question is actually secret, only the Chaser's typed guess needs to stay hidden (never broadcast, per AGENTS.md's security rules — don't change that). Add a read-only variant of the open-question-box (no accent, no input) showing the same prompt plus a pulsing "The Chaser is answering…" indicator, so non-Chaser clients aren't staring at a blank state during the tensest moment of their own round. This requires exposing `finalQuestion.prompt` to non-Chaser clients during this branch if it isn't already (check — `finalQuestion` itself may already be synced to everyone; if so this is template-only).

**Wrong / waiting for steal**: reuse a shared "wrong panel" component (dark card, thick red border, Luckiest-Guy "✗ WRONG!" label) instead of the current plain `<p>` text — same component 118's Team Final wrong-answer state uses, don't build two.

**The Steal — confirmed real mechanics, read before implementing.** This is *not* a buzz-in like the Team Final: every non-Chaser team member gets their own input the instant the Chaser answers wrong, and whichever submission the server accepts first wins it (`stealLocked` today is local per-client state; there's no shared "buzz winner" concept the way `finalBuzzSeatId` works in `TeamFinalScreen.vue`). Don't build a buzzer for this — it would misrepresent how it actually works.
- **The imposing Chaser banner is fully replaced** by the steal prompt during a steal, not shown alongside it (confirmed: `chaserFinalTop` swaps `ChaserPanel` out for the steal question via `v-if="stealActive"` today already — keep that swap, just restyle both sides of it). Target row + tension fill stay visible/untouched underneath either way.
- **Ground colour switches too, live**: the instant a steal opens, the scene's background eases (0.5s transition) from `--ink-chase` to the plain page navy, and the red vignette fades to 0 opacity — it's the team's moment now, not the Chaser's. Reverses back to red once the steal resolves and the Chaser's turn resumes.
- The steal's own answer box uses the same `.open-question-box`, **gold**-accented (`accent-gold`) — gold means "an opportunity is live," distinct from red (Chaser's turn) and blue (Team Final, ticket 118). Team busts shown alongside it use the same frame-free circle treatment as 116/118, with a "Steal! Ns left" label.
- **On a successful steal**: pops a speech bubble over whoever's answer was accepted (same bubble component as 118), triggers their head-wobble/eyes-squeeze reaction (from 115 — this is the one place in the whole game where the tension-fill mechanic runs in reverse), shows a **green** (`--success-green`, not gold — gold is "opportunity," green is "correct," per 115's colour rule) success panel ("Stolen! The Chaser is pushed back."), and mechanically the tension-fill shrinks + one target box un-fills, since the Chaser is actually pushed back a space.

## Real behavior this ticket should NOT change
- `stealLocked`/`finalStealAnswer`/`finalStealResolved` handling, `chaserFinalClockRunning`/`chaserFinalRemainingMs` clock logic, the steal-resolve-hold countdown timing, `submitChaserAnswer`/`submitSteal` message shapes. Only presentation, plus the one explicitly-called-out functional addition (showing the question during "Watching").

## Scope
- `client/src/screens/ChaserFinalScreen.vue` — template restructuring for the banner/steal swap, the new Watching branch, the open-question-box markup, ground-colour toggle class.
- `client/src/style.css` — corresponding rules.
- Possibly `client/src/components/ChaserPanel.vue` if its markup is reused vs. replaced for the bigger banner treatment — check against how 116 resolves the same question for the Chase screen's Chaser portrait, and keep the two consistent if `ChaserPanel` stays a shared component.

## Acceptance
- Manual playthrough of a Chaser Final round including at least one wrong answer (triggering a steal) and one successful steal, with the user watching live, per AGENTS.md.
- Confirm the Chaser's typed guess is still never broadcast to the team (check the "Watching" state addition didn't accidentally leak it — only `finalQuestion.prompt` should be newly exposed, never `chaserAnswerInput`).
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must land first.
