# 159: Whole-app UI polish pass (coherence, contrast, loading)

## Goal
Direct user request (2026-09-26): the game is feature-complete but "lacking a lot of polish" — images sometimes load late, the room code on the home screen is a different font/size from everything else, and there's "a lack of visual coherence and black text on coloured backgrounds" that reads as AI-made. Then: "keep going and polishing". This ticket records that pass.

## Scope
Client presentation across every screen, plus the small server pieces the polish needed:
- `client/src/style.css` (rewritten around one token set), every `client/src/screens/*.vue`, `components/ChaserPanel.vue`, `CharacterFace.vue`, new `components/ChaserSilhouette.vue`, `App.vue`, `assetPreload.js`, `chaserPortraits.ts`, `chaserAbilities.ts`, `index.html`, `public/favicon.svg` (`public/icons.svg` removed as dead).
- Server: short room codes (`server/src/roomCode.ts`, `ROOM_CODE` in `gameConfig.ts`, wired in `TriviaRoom.onCreate`), a `bankedAmount` field on `GamePlayer` so Results can show what each player actually brought back, clearer `SILENCED` copy, ability descriptions (mirrored client-side).
- Not in scope: game rules, flow timings, new features. Out-of-scope bugs found go to `BUGS.md` (`bug-023`).

## What changed
- **Loading**: every image is an inline data URL (`?inline`) and decoded up front with retained `Image` refs, so nothing pops in per screen (root cause: Vite dev serves images `no-cache`, and CSS background/mask layers re-fetched on every mount). Webfonts load with `display=block` and are warmed at boot, so no fallback-font flash.
- **Room codes**: 4 uppercase letters (no I/O), unique among live rooms, entered case-insensitively; one field style everywhere; join errors in plain words ("No room with that code…", "That room is full."); a home-screen notice when the host leaves or the connection drops.
- **Colour/type system**: white text with a short ink shadow on every coloured fill, never dark-on-colour; gold only as a trim/text colour (money, live opportunities); one role per font (Luckiest Guy titles, VT323 HUD/money/codes, Rubik UI); shared `.field`, `.btn`, `.panel`, `.chip`, `[data-tip]`, focus-visible ring; opacity-only screen fade; edge-glow answer flashes instead of full-screen washes; sentence-case labels throughout.
- **Per screen**: Lobby hairstyle/face pickers show your own character wearing each option instead of numbers; the Chaser vote marks who has voted with the same tick as the roles screen; the wheel announces the result; the Chaser's own reveal frame shows their pick; running-order first-place badge in gold trim; Chaser busts stand behind a desk (reveal), a ledge (Chaser Final nameplate) or the screen edge (caught/escaped) instead of floating on their flat-cut edge; the Chase idle card holds a question card's height so the board no longer jumps between questions; Offer shows a $0 amount in gold (red is only for negative money), explains a skipped low offer, and greys a voided middle plaque at full height; the Chaser watches the live Team Final question; steal answer bubbles clear the HUD and the post-steal hold reads "Back to <Chaser> in 3"; Team Final intro shows everyone and the head start; Results show banked (not built) money, strike it through with the pot when the Chaser wins, frown every face on a Chaser win, and share places on ties (no gold "winner" on an all-zero tie); Add Question reads back what was saved.
- **Reduced motion**: the home logo's drift, pop-ins, field shakes, the character reveal's grow/pop and the wheel's spin all respect `prefers-reduced-motion` (the wheel lands immediately; hidden-until-animated elements are pinned to their end state).
- **Cascade fixes**: three state classes that silently lost to their base class (declared later, same specificity) — Silence's red buzzer ring, the voided plaque border, Maggie's roster silhouette colour — now scoped to win.

## Acceptance
- `cd server && npm test` green; `npm run build` green in both `server/` and `client/`.
- Room codes: `server/test/roomCode.test.ts` (generator + a live create/join by code). `bankedAmount`: covered in `gameState.test.ts` / `roomFlow.test.ts`.
- Visual: every screen and state reviewed from real-time headless captures (a local gallery harness plus full bot-driven games through the real UI, as both a contestant and the Chaser), no console errors or Vue warnings from the app.

## Dependencies
None.
