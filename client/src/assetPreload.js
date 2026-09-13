import face1 from "./assets/images/face-1.png";
import face2 from "./assets/images/face-2.png";
import face3 from "./assets/images/face-3.png";
import hair1 from "./assets/images/hair-1.png";
import hair2 from "./assets/images/hair-2.png";
import hair3 from "./assets/images/hair-3.png";
import hair4 from "./assets/images/hair-4.png";
import hair5 from "./assets/images/hair-5.png";
import eyesNeutral1 from "./assets/images/eyes-1.png";
import eyesNeutral2 from "./assets/images/eyes-2.png";
import mouthNeutral from "./assets/images/mouth.png";
import bezosIcon from "./assets/images/chasers/bezos-icon.png";
import bigStanIcon from "./assets/images/chasers/bigstan-icon.png";
import namiIcon from "./assets/images/chasers/nami-icon.png";

// The CharacterFace layers (ticket 102) and chaser-portrait images are only
// ever requested lazily, the moment their screen first mounts (many separate
// requests hitting at once for e.g. TeamFinalScreen's whole player row).
// Warming the browser cache for all of them during the idle Lobby screen
// hides that first-fetch latency instead of it landing on the reveal moment.
// This list matches exactly what CharacterFace.vue imports today; the
// happy/sad reaction art (eyes-happy/eyes-sad/mouth-happy/mouth-sad/
// mouth-smirk) isn't wired into any component yet (ticket 103) so it isn't
// preloaded here either — add it back alongside that wiring.
const PRELOAD_IMAGES = [
    face1, face2, face3,
    hair1, hair2, hair3, hair4, hair5,
    eyesNeutral1, eyesNeutral2,
    mouthNeutral,
    bezosIcon, bigStanIcon, namiIcon
];

export function preloadImages() {
    for (const src of PRELOAD_IMAGES) {
        const img = new Image();
        img.src = src;
    }
}
