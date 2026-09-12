# 102: Lobby character picker + shared `CharacterFace` component (client) — UI sign-off required

## Goal
Players build their avatar in the lobby (5 hairstyles, 3 faces, hair/face/shirt colour × 9) and save it via `setCharacter` (101). One shared `CharacterFace.vue` renders any player's code everywhere the game shows a contestant, replacing the five duplicated seat-seeded face compositions.

## Scope
Client only — the server already exposes `character` from 101.

- `client/src/components/CharacterFace.vue`: presentational component; props `character: string`, `reaction: string` (wired in 103; renders neutral until then). Decodes the code and layers shoulders → face → hair → eyes → mouth, tinting the greyscale art per channel.
- Colour model (confirmed with user): **greyscale art + CSS tint** — each layer is drawn once in greyscale; the app recolours via a CSS filter lookup. A single 9-colour palette expressed as `:root` CSS custom properties (extends ticket 088's token system) plus a small TS colour→filter map for the hair/face/shirt channels. ⚠ Assumption to confirm at implementation: one *shared* 9-colour palette across all three channels.
- Codec/decode helpers client-side in `client/src/character.ts` (duplicated copy from 101, kept in parity).
- Lobby picker in `LobbyScreen.vue` (confirmed placement: beside the settings rail): hairstyle row (5), face row (3), three colour rows (hair/face/shirt, 9 swatches each), a live `CharacterFace` preview, and Save → sends `setCharacter`. The player list renders each player's avatar.
- Swap the inline layered-face markup + `seatSeed` selection in `CashBuilderScreen.vue`, `OfferScreen.vue`, `ChaseScreen.vue`, `TeamFinalScreen.vue`, `ChaserFinalScreen.vue` and the Lineup placeholders (`ContestantLineupScreen.vue`) for `CharacterFace`. Remove the per-screen face/hair/eyes/mouth imports the component absorbs; keep `assetPreload.js` preloading the component's assets.
- `HUMAN_TASKS.md`: add rows for the real **greyscale** art (5 hairstyles, 3 faces, shoulders, neutral eyes ×2, happy/sad/teary eyes, neutral/happy/sad mouths + smirk) documenting the greyscale+tint convention; reconcile the existing placeholder stubs. Note: the codec supports **5** hairstyles — `hair-6.png` is currently orphaned; confirm/retire it here (no-cruft rule).
- **UI sign-off per AGENTS.md**: present the picker layout and `CharacterFace` styling direction to the user before implementing.

## Acceptance
- `cd client && npm run build` and `cd server && npm run build` green.
- Manual 2-browser: pick a character in the lobby; it renders identically for the owner and for spectators on Lineup/CashBuilder/Offer/Chase/TeamFinal/ChaserFinal.

## Dependencies
- 101.