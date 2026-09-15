# 139: Chaser roster — add Maggie + structured ability metadata (server)

## Goal
Establishes the data model for the "Chaser special abilities" stretch goal (GOAL.md open question #4, now decided) before any mechanic is wired up: a 4th Chaser character (Maggie, a career politician) and a real config shape for each character's abilities, replacing the placeholder empty `ability: ""` string. Unblocks every other ticket in this arc (140–149).

## Scope
- `server/src/TriviaTypes.ts` **and** `client/src/TriviaTypes.ts`: add `Maggie = "maggie"` to the `ChaserCharacter` enum in both copies (AGENTS.md gotcha — these two enums must stay identical).
- `server/src/gameConfig.ts`: replace the flat `CHASER_CHARACTERS` array with structured entries carrying a `tagline` and `passive`/`active` ability lists (`{ id, name, description }` each). Final roster:
  - **Bezos** — "Pays his way around the rules." Passive: `noMiddle` ("Every offer he sets skips the middle tier — only low or high."), `pushbackImmunity` ("A successful team steal doesn't push him back — 3 times a game."). No active ability (both his traits are automatic; this is intentional — flagged and accepted in the design discussion, not a bug).
  - **Big Stan** — "An aggressive gambler." Passive: `timeBonus` ("+0.5s on his final-round clock for every correct answer."). Active: `doubleTime` ("His next correct chase answer moves him 2 spaces instead of 1 — a miss while it's armed costs him a space back. Once per contestant's chase.").
  - **Nami** — "Just wants to go home." Passive: `shortFuse` ("The team's steal window is always 10s instead of 20s against her."). Active: `reRack` ("Redraws the current board-chase question. Once per contestant's chase.").
  - **Maggie** — "A career politician." Passive: `silence` ("Whoever answered the team's last final-round question correctly can't answer the next one."). Active: `jumble` ("Shuffles the answer-button order on the contestant's own screen for one board-chase question. Once per contestant's chase.").
  - Add a separate `SHARED_CHASER_ABILITIES` export (not tied to any character) for the abilities every Chaser gets regardless of pick: `fiftyFifty` ("Removes one wrong option from the current board-chase question — 4 uses a game.") and `skip` ("Discards the Chaser's current final-round question with no penalty — 2 uses a game.").
  - Add a `CHASER_ABILITIES` tunables block: `{ fiftyFifty: { usesPerGame: 4 }, skip: { usesPerGame: 2 }, pushbackImmunity: { usesPerGame: 3 }, doubleTime: { usesPerTableRound: 1 }, reRack: { usesPerTableRound: 1 }, jumble: { usesPerTableRound: 1 }, timeBonusMs: 500, shortFuseStealWindowMs: 10_000 }`. These are fixed game-balance constants, not client-supplied room options, so they need no min/max clamp pair (same precedent as `CHASER_POT.initial`/`perRound`).
  - "Once per contestant's chase" = **once per table round**: exactly one contestant's own Cash Builder → Offer → Chase turn. Say so explicitly in a comment since later tickets rely on this definition for when the per-table-round counters reset (at that contestant's `startChase`).
- `server/src/rooms/handlers/effects.ts`: update the `chaserCharacterReveal`, `startOffer`, and `chaserOffersSet` broadcasts, which currently send a single `chaserCharacterAbility: chaserChar?.ability ?? ""` string — replace with the structured `tagline`/`passive`/`active` data from the new config shape (there is no longer one flat string to send).
- `client/src/App.vue`: the two spots that currently capture `chaserCharacterAbility: message.chaserCharacterAbility` into local state must be updated to match the new payload shape. **This is plumbing, not a UI change** — nothing currently renders this field on any screen (confirmed by grep), so there is no visual/layout/copy decision here and this does not trigger AGENTS.md's UI sign-off rule. Do not add any new rendering in this ticket — that's tickets 145/149.
- `HUMAN_TASKS.md`: add a row for `maggie-icon.png` (Maggie chaser character portrait, used in RolesRevealScreen's character picker — ticket 149), status `todo`, same convention as the existing bezos/bigstan/nami rows.
- `client/src/chaserPortraits.ts`: add the `Maggie` entries to `CHASER_PORTRAITS`/`CHASER_NAMES`, importing `maggie-icon.png` the same way the other three do. The import will 404 until the art lands (`todo` in HUMAN_TASKS.md) — that's fine and matches existing precedent (other `todo` assets already have code referencing them); do not add fallback/placeholder logic beyond what the other three characters already rely on.
- Do **not** touch `RolesRevealScreen.vue`'s picker UI (adding the 4th visible option is a layout question — ticket 149) or any other screen.

## Acceptance
- `cd server && npm test` and `npm run build` pass.
- `cd client && npm run build` passes (type-checks the enum/payload shape changes).
- `grep -rn '\.ability' server/src client/src` finds no remaining references to the old flat string field.
- A unit test in `server/test/gameConfig.test.ts` (or a new `chaserCharacters.test.ts`) asserts: 4 characters exist, each id is unique, Bezos has 0 active abilities, and the other three each have exactly 1 active + 1 passive.

## Dependencies
None — this is the foundation ticket for the whole arc.
