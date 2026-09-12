# 097: Client — no quip/message box for the Chaser on the Chaser Final — UI SIGN-OFF REQUIRED

## Goal
The Chaser's "Say something…" message box + Send button (`ChaserPanel.vue`, `chaserPanelInputRow` at line 72) is a distraction during the Chaser's race against the clock. Hide it on the Chaser Final only — the panel's portrait and bubble stay.

## Proposed direction (for sign-off)
- Add a prop to `ChaserPanel` (e.g. `quipInput: Boolean = true`) that hides the `chaserPanelInputRow` block when false.
- On `ChaserFinalScreen.vue` pass `false` so the Chaser tabs into nothing but the answer input during the final chase; Offer/Chase keep the input as today (their screens mount the panel with defaults).
- The bubble itself must still render (098 puts the Chaser's answers there), and broadcast quips from other phases still display — only the composable input is gone.
- style.css untouched unless the hidden row leaves a stray gap (then tighten `.chaserPanel` spacing — no dead classes).

## Scope
- `client/src/components/ChaserPanel.vue`, `client/src/screens/ChaserFinalScreen.vue`, `client/src/App.vue` (if the prop is threaded), `client/src/style.css` only if spacing needs it.
- Not in scope: removing quips from other screens, the answer speech bubble (098).

## Acceptance
- Manual: on the Chaser Final the Chaser sees portrait + bubble but no message box/Send; on Offer and Chase the quip input still works.
- `cd client && npm run build` passes.

## Dependencies
- None.