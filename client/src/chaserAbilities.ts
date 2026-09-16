import { ChaserCharacter } from "./TriviaTypes.ts";

// Chaser ability display copy for the "Choose your Chaser" roster picker
// (ticket 150) — pulled out the same way chaserPortraits.ts already pulls
// out names/images, so RolesRevealScreen.vue can render a tagline + ability
// chips per character without reaching into server code.
//
// This is a deliberate client-side duplicate of server/src/gameConfig.ts's
// CHASER_CHARACTERS/SHARED_CHASER_ABILITIES content (ticket 139) — same
// precedent as the intentionally-duplicated ChaserCharacter/GamePhase enums
// (AGENTS.md gotcha). The picker screen runs before any server round-trip
// (the Chaser is choosing, not yet confirmed), and abilities are public
// character traits, not secret game state, so this duplication carries none
// of the "never leak secrets" risk that precedent is about. Keep in sync
// with gameConfig.ts by hand if the roster/abilities ever change.

export interface ChaserAbilityCopy {
    id: string;
    name: string;
    description: string;
}

export interface ChaserCharacterCopy {
    tagline: string;
    passive: ChaserAbilityCopy[];
    active: ChaserAbilityCopy[];
}

export const CHASER_ABILITY_COPY: Record<string, ChaserCharacterCopy> = {
    [ChaserCharacter.Bezos]: {
        tagline: "Pays his way around the rules.",
        passive: [
            {
                id: "noMiddle",
                name: "No Middle",
                description: "Every offer he sets skips the middle tier — only low or high."
            },
            {
                id: "pushbackImmunity",
                name: "Pushback Immunity",
                description: "A successful team steal doesn't push him back — 3 times a game."
            }
        ],
        // Bezos intentionally has 0 active abilities — both his traits are
        // automatic; this is a design decision (GOAL.md), not an oversight,
        // mirroring gameConfig.ts's own note on the server-side entry.
        active: []
    },
    [ChaserCharacter.BigStan]: {
        tagline: "An aggressive gambler.",
        passive: [
            {
                id: "timeBonus",
                name: "Time Bonus",
                description: "+0.5s on his final-round clock for every correct answer."
            }
        ],
        active: [
            {
                id: "doubleTime",
                name: "Double Time",
                description: "His next correct chase answer moves him 2 spaces instead of 1 — a miss while it's armed costs him a space back. Once per contestant's chase."
            }
        ]
    },
    [ChaserCharacter.Nami]: {
        tagline: "Just wants to go home.",
        passive: [
            {
                id: "shortFuse",
                name: "Short Fuse",
                description: "The team's steal window is always 10s instead of 20s against her."
            }
        ],
        active: [
            {
                id: "reRack",
                name: "Re-rack",
                description: "Redraws the current board-chase question. Once per contestant's chase."
            }
        ]
    },
    [ChaserCharacter.Maggie]: {
        tagline: "A career politician.",
        passive: [
            {
                id: "silence",
                name: "Silence",
                description: "Whoever answered the team's last final-round question correctly can't answer the next one."
            }
        ],
        active: [
            {
                id: "jumble",
                name: "Jumble",
                description: "Shuffles the answer-button order on the contestant's own screen for one board-chase question. Once per contestant's chase."
            }
        ]
    }
};

// The two abilities every Chaser gets regardless of character. Not shown
// per-card on the roster picker (confirmed in the mockup's own note) since
// they belong to every pick regardless — they surface on the in-game
// ability tray instead (ticket 145). Exported anyway since the copy mirrors
// gameConfig.ts's SHARED_CHASER_ABILITIES 1:1, so ticket 145 can reuse it
// instead of re-typing the strings a third time.
export const SHARED_CHASER_ABILITY_COPY: ChaserAbilityCopy[] = [
    {
        id: "fiftyFifty",
        name: "50/50",
        description: "Removes one wrong option from the current board-chase question — 4 uses a game."
    },
    {
        id: "skip",
        name: "Skip",
        description: "Discards the Chaser's current final-round question with no penalty — 2 uses a game."
    }
];
