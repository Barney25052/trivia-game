# 170: Chaser hard mode — no powers at all

## Goal
Direct user request, 2026-10-20: an optional hard mode for the Chaser with no powerups. The user chose who decides: the Chaser turns their own powers off, not the host.

## Scope
- Server: synced `GameState.hardMode` (public, like the ability counters). The Chaser sets it once, alongside their character, in the Roles Reveal `revealReady` message (`hardMode: boolean`, optional, anything else rejected and logged). It can't change after lock-in, so powers can't be switched back on mid-game.
- Hard mode turns off every power, active and passive: `canUseAbility` refuses all five manual abilities (50/50, Skip, Double Time, Re-rack, Jumble), and the five passives (Bezos's No Middle and Pushback Immunity, Big Stan's Time Bonus, Nami's Short Fuse, Maggie's Silence) all read the Chaser's character through one `poweredChaserCharacter(room)` helper that answers "" in hard mode.
- Client: a "Hard mode" switch on the Chaser's "Choose your Chaser" screen. Switched on, the roster cards swap their ability chips for "No powers", and the pick sends `hardMode: true`. Everyone else sees "Hard mode: no powers" under the Chaser's name on the Roles Reveal and the character reveal. `ChaserPanel` shows no ability tray or passives in hard mode (the flag rides in `abilityCounters`).
- UI direction signed off by the user in chat (the Chaser's own toggle, powers hidden rather than greyed).

## Acceptance
- New tests in `server/test/hardMode.test.ts`: the Chaser's `revealReady` sets the flag; a contestant's `hardMode` is ignored; a non-boolean is rejected; every manual ability is refused; Bezos's middle offer stays pickable; Big Stan gets no Time Bonus; Maggie can't silence.
- `cd server && npm test` green; `npm run build` green in both packages.
- Seen live: the switch on the roster screen, "No powers" on the cards, and no ability tray on the chase board in hard mode.

## Dependencies
139–150 (Chaser abilities).
