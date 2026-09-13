import { ChaserCharacter } from "./TriviaTypes.ts";
import bezosIcon from "./assets/images/chasers/bezos-icon.png";
import bigStanIcon from "./assets/images/chasers/bigstan-icon.png";
import namiIcon from "./assets/images/chasers/nami-icon.png";

// Chaser portrait/name lookup (ticket 116) — pulled out of ChaserPanel.vue so
// the Chase board's Caught/Escaped cutscenes (ChaseScreen.vue) can resolve
// the same icon/name for a bare `<img>` in the cutscene stage without
// duplicating this table or reaching into ChaserPanel's internals.
export const CHASER_PORTRAITS: Record<string, string> = {
    [ChaserCharacter.Bezos]: bezosIcon,
    [ChaserCharacter.BigStan]: bigStanIcon,
    [ChaserCharacter.Nami]: namiIcon
};

export const CHASER_NAMES: Record<string, string> = {
    [ChaserCharacter.Bezos]: "Bezos",
    [ChaserCharacter.BigStan]: "Big Stan",
    [ChaserCharacter.Nami]: "Nami"
};
