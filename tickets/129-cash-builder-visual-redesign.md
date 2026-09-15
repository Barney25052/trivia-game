# 129: Cash Builder screen visual redesign — UI SIGN-OFF REQUIRED

## Goal
Redesign `CashBuilderScreen.vue`/its `style.css` rules to match the mockup's "Cash Builder" (**[Big Baws Style Guide, section 16](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)**).

## Depends on
Ticket 115 (foundation).

## Why this screen, and what's actually changing
Cash Builder is the one screen every other visual-redesign ticket (116–119, 123–125) skipped. Every touch it's had since 115 landed — 112 (timer hardcoded), 113 (flash stuck), 121 (correct-answer text missing), 128 (bubble broadcast) — fixed *behaviour*, never restyled it. It still has the pre-115 look: a lone plain number for the pot, an always-looping-pulse "Get ready…Ns" sentence, a plain "Time left: Ns" sentence, and its own bespoke wrong/correct card colours instead of the shared components every other screen already uses.

## Agreed direction

**Ground**: plain existing page navy — team-centric screen, no chase tint. No structural change otherwise — the real screen already sits directly on the page background with no card chrome of its own, and stays that way.

**Pot**: swap `.cashBuilderPot` (a lone number) for the shared `.moneyPlaque` component (115), labelled "Cash Builder pot" the same as every other screen that shows a pot. A correct answer plays the plaque's own established wipe/tick-up/dollar-burst sequence (section 05 of the mockup), replacing the current plain `pot-flash` scale pulse.

**Pre-round cooldown**: "Get ready…Ns" (`.getReadyCountdown`, an always-looping `press-me` pulse) becomes the chunky countdown-digit chip (section 08) — it only turns urgent/pulses in its last ~2 seconds, which fits the established "feedback-only, never ambient/looping" motion rule better than the current infinite pulse.

**Running clock**: "Time left: Ns" becomes a pixel-font HUD line ("TIME LEFT 0:52"), matching the HUD line already used on Chaser Final/Team Final, instead of a plain sentence.

**Question card**: `.cashBuilderQuestionArea` (a bespoke translucent-black bordered box) becomes the shared `open-question-box` (sections 12/13), accented blue — "this is your own turn," the same blue Team Final uses for whoever's currently answering. Its wrong/correct reveal states swap from `.cashBuilderQuestionArea-wrong`/`-correct` + `.cashBuilderRevealLabel`/`.cashBuilderRevealAnswer` to `open-question-box.accent-red`/`.accent-green` (accent-green is new, added for this screen in the mockup — no earlier screen shows a correct-answer state on this component) with the same `.wrong-label`/`.steal-success-label` + `.wrong-answer`/`.steal-success-text` pairing already used on every other screen's reveal moment.

**Input**: `.cashBuilderInput` gets the chunky field chrome from section 03 (thick ink border, flat fill) instead of default browser input styling. Keep the existing wrong-answer shake (`cash-builder-input-shake`) as-is — that motion isn't part of this pass, just restyle the chrome underneath it.

**Small functional addition** (flagged during mockup review, confirmed acceptable): add a real `Submit` button (`.oq-submit`, calling the existing `submit()`) next to the input. Today the screen is Enter-only with no visible affordance to submit — `.cashBuilderSubmit` already exists in `style.css` but was never actually wired to a button in the template. Keep Enter-to-submit working exactly as it does today; the button is additive, not a replacement.

**Spectator view**: no visual change beyond the shared pot/HUD swap above — it already reuses the same pot/meta line as the active contestant's view, just without the question card/input.

## Real behavior this ticket should NOT change
Cooldown/timer logic (`startReadyCountdown`, `startQuestionTimer`, `secondsLeft`/`cooldownLeft`), scoring/pot logic, `answerResult`/`cashBuilderAnswer` handling, the existing speech-bubble broadcast (ticket 128, untouched), the wrong-answer input shake animation, the `roundFinished`/`awaitingNext` state machine. Only presentation.

## Scope
- `client/src/screens/CashBuilderScreen.vue` — template changes for the moneyPlaque, countdown chip, HUD line, open-question-box, and the new Submit button.
- `client/src/style.css` — corresponding rules; **delete** `.getReadyCountdown`, `.cashBuilderQuestionArea-wrong`, `.cashBuilderQuestionArea-correct`, `.cashBuilderRevealLabel`, `.cashBuilderRevealLabel-correct`, `.cashBuilderRevealAnswer`, `.cashBuilderRevealAnswer strong`, `.cashBuilderPot-flash`, and the `pot-flash` keyframe once their replacements are in — don't leave both (per AGENTS.md's "no cruft" rule). `press-me` itself stays (still used by `.lineupCard-first`).
- Add `.open-question-box.accent-green` to the shared component rules (introduced in the mockup, section 16, specifically for this screen's correct-answer state).

## Acceptance
- Manual walkthrough as the active contestant (answer correctly, answer wrong, let the timer run out) and as a spectator, with the user watching live, per AGENTS.md.
- Grep for `getReadyCountdown`, `cashBuilderQuestionArea-wrong`, `cashBuilderQuestionArea-correct`, `cashBuilderRevealLabel`, `cashBuilderPot-flash`, and `pot-flash` to confirm the old rules were actually removed, not just superseded and left behind.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must land first.
