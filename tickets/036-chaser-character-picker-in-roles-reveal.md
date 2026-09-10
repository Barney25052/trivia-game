# 036: Chaser character picker during roles-reveal, identity revealed at offer stage

## Goal
The stretch goal "Chaser characters" lets the Chaser player pick which Chaser character they want to be from a roster (each with their own name, identity, and ability). Per the TO_REVIEW decision: the Chaser picks their character **during the roles-reveal phase** (this becomes their "ready" action — they can't ready up until they've picked), but the character identity is **not revealed to contestants until the first offer round**. This ticket establishes the schema and wiring so the roster/picker UI can land later without reworking Phase 1's reveal flow.

## Scope
- `server/src/rooms/schema/GameState.ts`: add `@type("string") chaserCharacterId: string` (empty string until picked, set during roles-reveal).
- `server/src/TriviaTypes.ts` + `client/src/TriviaTypes.ts`: add a `ChaserCharacter` enum or interface with the initial roster (2–3 placeholder characters with id, name, and ability description — real art/names come later via HUMAN_TASKS.md).
- `server/src/rooms/TriviaRoom.ts`: on the Chaser's `readyUp` message during `RolesReveal`, require a `characterId` payload. Validate it against the roster; store it on `GameState.chaserCharacterId`. The Chaser cannot ready up without a valid pick.
- `server/src/gameFlow.ts`: no changes to phase transitions — roles-reveal already waits for all-readies.
- Client (`RolesRevealScreen.vue`): when the local player is the Chaser, show the character roster as a picker before the ready button. The Chaser selects a character, then clicks "Ready". Non-Chaser players see a waiting state (no character info).
- Client (`OfferScreen.vue` / `ChaserRevealScreen` from ticket 033): when the first offer round begins, reveal the Chaser's character identity to all players (name + ability). This is a display-only change — broadcast the character info alongside the offer or as a separate one-shot message.
- `server/src/gameConfig.ts`: add a `CHASER_CHARACTERS` array with the initial roster.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` and `cd client && npm run build` pass.
- During roles-reveal, the Chaser sees a character picker; non-Chaser players do not.
- The Chaser cannot ready up without selecting a valid character.
- `GameState.chaserCharacterId` is populated after the Chaser readies up.
- At the first offer round, the Chaser's character name/ability is visible to all players.

## Dependencies
- Should land after or alongside ticket 033 (ChaserReveal screen), since the character reveal timing ties into the reveal flow. Can be done independently if the reveal is handled in the offer screen instead.
