# 086: Cash builder — active contestant's profile on the right, answers pop out of a speech bubble

## Goal
During a cash builder the active contestant is just a name and a pot counter. Put their picture on the right-hand side of the cash-builder screen for **everyone** — the active contestant, the Chaser, and spectators — and have each typed answer pop out of a speech bubble anchored to that profile.

## Scope
- `client/src/screens/CashBuilderScreen.vue` + `client/src/style.css`.
- Right-hand profile: reuse the layered-face composition from `OfferScreen` (`offerFaceWrap`/`offerShoulders`/`offerFaceLayer` pattern; `face-*.png`/`hair-*.png`/`eyes-*.png`/`mouth-*.png` in `client/src/assets/images/`), picking assets by the active contestant's seat id the same way OfferScreen's `seatSeed` does. Render it in **both** the active-contestant branch and the spectator branch of the current template so all clients see it.
- Speech bubble: each time an answer is submitted (correct, wrong, or empty pass), show the typed text in a speech bubble anchored to the profile; clear it when the next question arrives or the round ends (the wrong-answer reveal window already lasts ~2.5s — keep the bubble visible through it). The typed text is the contestant's own input and already public, so there's no answer/correctness leak — the server's accepted answer stays off the wire until the normal reveal as always.
- Optional (only if it fits the session): happy/sad eyes+mouth reaction during the bubble, reusing OfferScreen's `mouthHappy`/`mouthSad`/`eyesHappy`/`eyesSad`.
- UI direction provided by the user; present the rendered screen for sign-off per AGENTS.md.

## Acceptance
- Manual (two+ clients into a cash builder): on every client the active contestant's layered-face profile sits on the right; each submitted answer appears in a speech bubble from the profile until the next question; the bubble clears at round end.
- `cd client && npm run build` passes.

## Dependencies
- 040 (the cash-builder screen exists). No new art required — reuses existing face/hair/eyes/mouth assets; `shoulders.png` (HUMAN_TASKS.md, `todo`) is only needed if the current CSS `.offerShoulders` placeholder isn't good enough.