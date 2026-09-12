# 098: Client — the Chaser's final-chase answers pop from the Chaser's speech bubble — UI SIGN-OFF REQUIRED

## Goal
When the Chaser submits an answer in the Chaser Final, the typed text should pop out of their own speech bubble (the `ChaserPanel` bubble) instead of simply vanishing — matching how team answers pop from player seats.

## Proposed direction (for sign-off)
- **What the player sees**: the Chaser types and hits Enter; the submitted answer appears in the Chaser panel's bubble (the `chaserPanelBubble`) on their own client, keyed so re-submissions animate fresh, and clears when the next `finalQuestion` arrives (or after ~3s), mirroring `TeamFinalScreen`'s `bubbleText`/`bubbleKey` pattern.
- **Client-only**: the Chaser's typed text already returns to their own client (`answerResult`); per-side delivery means the team must **not** see the Chaser's answers — keep it strictly on the Chaser's screen (don't wire a broadcast).
- Keep the answer bubble **distinct from real quips** (`chaserQuipText`/`chaserQuipKey` still drive broadcast taunts; 097 hides the input but the display channel stays free) — use a dedicated answer state or a local overlay on the panel so the two never fight.
- style.css only if the panel needs an answer-specific bubble treatment; otherwise reuse `chaserPanelBubble`.

## Scope
- `client/src/screens/ChaserFinalScreen.vue`, `client/src/components/ChaserPanel.vue` (if a dedicated answer-bubble slot is cleaner than reusing the quip bubble), `client/src/style.css` if needed.
- Not in scope: team-side visibility of Chaser answers, quip removal (097), the steal bubbles (096).

## Acceptance
- Manual: in the Chaser Final the Chaser submits an answer → it pops from their bubble and stays through the reveal; the team clients see nothing of the Chaser's typed text.
- `cd client && npm run build` passes.

## Dependencies
- None (097's input-hide and this can be done together or separately — they touch the same panel).