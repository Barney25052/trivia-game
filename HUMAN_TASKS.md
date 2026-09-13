# HUMAN_TASKS.md

Hand-made art the game needs. Agents add a row here whenever their ticket needs an asset only a human can create (character faces, avatars, icons, chaser art), then reference the file name in code/UI so the wiring is ready. The user makes the art, drops it in `client/src/images/`, and crosses the row off.

Status values: `todo`, `done`.

| File | What it is | Where it's used | Status |
|------|------------|-----------------|--------|
| bezos-icon.png | Bezos chaser character portrait | RolesRevealScreen (character picker) | done |
| bigstan-icon.png | Big Stan chaser character portrait | RolesRevealScreen (character picker) | done |
| nami-icon.png | Nami chaser character portrait | RolesRevealScreen (character picker) | done |
| shoulders.png | Contestant shoulders/torso layer to sit under the face. Draw in GREYSCALE (no colour) — the app recolours it per-character via a CSS filter keyed to the `shirtColour` digit, same convention as hair/face below (see `client/src/characterColours.ts`). Until this exists, `CharacterFace` renders a plain flat-colour CSS shape instead of an image, so its absence never crashes/404s. | CharacterFace component (every screen showing a contestant: Lobby, Lineup, CashBuilder, Offer, Chase, TeamFinal, ChaserFinal) | todo |
| hair-1.png – hair-5.png | 5 hairstyle layers for the contestant character system (tickets 101/102). Draw each in GREYSCALE (no colour) — the app recolours per-character via a CSS filter keyed to the `hairColour` digit. Today's colour placeholder PNGs stand in for these until the real greyscale art lands. | CharacterFace component (Lobby picker + every screen showing a contestant) | todo |
| face-1.png – face-3.png | 3 face-shape layers. Draw each in GREYSCALE — recoloured per-character via a CSS filter keyed to the `faceColour` digit, same convention as hair. | CharacterFace component (Lobby picker + every screen showing a contestant) | todo |
| eyes-1.png, eyes-2.png | 2 neutral-eyes variants (picked deterministically per character, not player-chosen). These are flat art, NOT colour-tinted — the codec has no eye-colour channel, only hair/face/shirt are recoloured — so draw them in a fixed colour that reads reasonably against every face tint. | CharacterFace component (neutral expression) | todo |
| eyes-happy.png | Happy reaction eyes. Flat art, not colour-tinted (same as neutral eyes above). Not wired into any component's logic yet — reactions land in ticket 103. | CharacterFace component (reaction eyes, ticket 103) | todo |
| eyes-sad.png | Sad reaction eyes. Flat art, not colour-tinted. Not wired into any component's logic yet — reactions land in ticket 103. | CharacterFace component (reaction eyes, ticket 103) | todo |
| eyes-teary.png | Teary reaction eyes — no placeholder file exists yet at all; needed alongside eyes-happy/eyes-sad for ticket 103's reaction states. Flat art, not colour-tinted. | CharacterFace component (reaction eyes, ticket 103) | todo |
| mouth.png | Neutral mouth. Flat art, not colour-tinted. | CharacterFace component (neutral expression) | todo |
| mouth-happy.png | Happy reaction mouth. Flat art, not colour-tinted. Not wired into any component's logic yet — reactions land in ticket 103. | CharacterFace component (reaction mouth, ticket 103) | todo |
| mouth-sad.png | Sad reaction mouth. Flat art, not colour-tinted. Not wired into any component's logic yet — reactions land in ticket 103. | CharacterFace component (reaction mouth, ticket 103) | todo |
| mouth-smirk.png | Smirk reaction mouth. Flat art, not colour-tinted. Not wired into any component's logic yet — reactions land in ticket 103. | CharacterFace component (reaction mouth, ticket 103) | todo |