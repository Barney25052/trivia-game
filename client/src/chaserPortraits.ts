import { ChaserCharacter } from "./TriviaTypes.ts";
// `?inline` (data URLs in dev as well as the build) — see CharacterFace.vue's
// import comment for why a plain image URL isn't good enough here.
import bezosIcon from "./assets/images/chasers/bezos-icon.png?inline";
import bigStanIcon from "./assets/images/chasers/bigstan-icon.png?inline";
import namiIcon from "./assets/images/chasers/nami-icon.png?inline";
import maggieIcon from "./assets/images/chasers/maggie-icon.png?inline";

// Chaser portrait/name lookup (ticket 116) — the one table every screen
// resolves a Chaser's art and name from (ChaserPanel, the Chase cutscenes,
// the roster picker, the character reveal), instead of each keeping its own
// copy of the imports.
const CHASER_PORTRAITS: Record<string, string> = {
    [ChaserCharacter.Bezos]: bezosIcon,
    [ChaserCharacter.BigStan]: bigStanIcon,
    [ChaserCharacter.Nami]: namiIcon,
    [ChaserCharacter.Maggie]: maggieIcon
};

/** The Chaser's portrait, or null when there's no character to show yet —
 * callers render ChaserSilhouette.vue in that case. */
export function chaserPortrait(characterId: string): string | null {
    return CHASER_PORTRAITS[characterId] ?? null;
}

export const CHASER_NAMES: Record<string, string> = {
    [ChaserCharacter.Bezos]: "Bezos",
    [ChaserCharacter.BigStan]: "Big Stan",
    [ChaserCharacter.Nami]: "Nami",
    [ChaserCharacter.Maggie]: "Maggie"
};
