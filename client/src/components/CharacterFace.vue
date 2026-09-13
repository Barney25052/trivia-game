<script setup>
import { computed } from "vue";
import { decodeCharacter } from "../character.ts";
import { characterColourVar } from "../characterColours.ts";
import face1 from "../assets/images/face-1.png";
import face2 from "../assets/images/face-2.png";
import face3 from "../assets/images/face-3.png";
import hair1 from "../assets/images/hair-1.png";
import hair2 from "../assets/images/hair-2.png";
import hair3 from "../assets/images/hair-3.png";
import hair4 from "../assets/images/hair-4.png";
import hair5 from "../assets/images/hair-5.png";
import eyesNeutral1 from "../assets/images/eyes-1.png";
import eyesNeutral2 from "../assets/images/eyes-2.png";
import mouthNeutral from "../assets/images/mouth.png";
import eyesHappy from "../assets/images/eyes-happy.png";
import eyesSad from "../assets/images/eyes-sad.png";
import mouthHappy from "../assets/images/mouth-happy.png";
import mouthSad from "../assets/images/mouth-sad.png";
import mouthSmirk from "../assets/images/mouth-smirk.png";

// Shared presentational avatar (ticket 102): decodes a `character` code
// (see ../character.ts) and layers shoulders -> face -> hair -> eyes -> mouth,
// replacing the seatSeed-based layered-face markup that used to be
// duplicated across CashBuilder/Offer/Chase/TeamFinal/ChaserFinal/Lineup.
const props = defineProps({
    character: { type: String, default: "" },
    // Server-driven reaction cue (ticket 103) — "neutral" | "smile" | "frown"
    // | "teary", broadcast by the room and flashed for a few seconds by the
    // caller (see App.vue's reactionsBySeat store) before reverting to
    // "neutral". Any other/unknown value also renders neutral.
    reaction: { type: String, default: "neutral" }
});

// A fixed, valid fallback (not randomCharacter()) so a missing/invalid code
// renders one stable placeholder look instead of a different random face on
// every re-render.
const DEFAULT_CHARACTER = "00000";

const decoded = computed(() => decodeCharacter(props.character) ?? decodeCharacter(DEFAULT_CHARACTER));

const FACE_IMAGES = [face1, face2, face3];
const HAIR_IMAGES = [hair1, hair2, hair3, hair4, hair5];
// Two neutral-eyes placeholder variants exist as art; picking deterministically
// off hairStyle keeps a given character's eyes stable without spending another
// codec digit on it.
const NEUTRAL_EYES_IMAGES = [eyesNeutral1, eyesNeutral2];

const faceImg = computed(() => FACE_IMAGES[decoded.value.faceStyle % FACE_IMAGES.length]);
const hairImg = computed(() => HAIR_IMAGES[decoded.value.hairStyle % HAIR_IMAGES.length]);

// Reaction eyes/mouth (ticket 103). "teary" has no dedicated eyes art yet —
// eyes-teary.png is still `todo` in HUMAN_TASKS.md, no placeholder exists at
// all — so it falls back to the sad eyes; the mouth still switches to
// mouth-smirk so a two-in-a-row miss reads as visually more intense than a
// single wrong answer (mouth-sad) even without the real teary eyes. Revisit
// this pairing once the real art lands.
const REACTION_EYES = { smile: eyesHappy, frown: eyesSad, teary: eyesSad };
const REACTION_MOUTHS = { smile: mouthHappy, frown: mouthSad, teary: mouthSmirk };

const eyesImg = computed(() => {
    const neutralEyes = NEUTRAL_EYES_IMAGES[decoded.value.hairStyle % NEUTRAL_EYES_IMAGES.length];
    return REACTION_EYES[props.reaction] ?? neutralEyes;
});
const mouthImg = computed(() => REACTION_MOUTHS[props.reaction] ?? mouthNeutral);

// Colour model (ticket 102): the art is drawn once in greyscale (today: the
// existing colour placeholder art, see HUMAN_TASKS.md) and recoloured per
// channel — see characterColours.ts for the palette and its "one shared
// palette across channels" judgment call.
// Tint technique (ticket 108): a colour overlay (background-color blended
// against the art with background-blend-mode: multiply, masked to the art's
// own silhouette — see the .offerFaceTint rule in style.css and the comment
// in characterColours.ts) replaced the original CSS `filter` recipe, which
// read as a faint wash rather than a clear, identifiable colour.
const hairColour = computed(() => characterColourVar(decoded.value.hairColour));
const faceColour = computed(() => characterColourVar(decoded.value.faceColour));
// The shoulders/torso layer is a flat CSS shape, not an image (no
// shoulders.png exists yet — HUMAN_TASKS.md has it as `todo`), so it's
// recoloured with a plain background-color instead of an image filter.
const shirtColour = computed(() => characterColourVar(decoded.value.shirtColour));
</script>

<template>
    <div class="offerFaceWrap">
        <div class="offerShoulders" :style="{ backgroundColor: shirtColour }"></div>
        <div
            class="offerFaceLayer offerFaceTint"
            :style="{
                backgroundColor: faceColour,
                backgroundImage: `url(${faceImg})`,
                maskImage: `url(${faceImg})`,
                WebkitMaskImage: `url(${faceImg})`
            }"
        ></div>
        <div
            class="offerFaceLayer offerFaceTint"
            :style="{
                backgroundColor: hairColour,
                backgroundImage: `url(${hairImg})`,
                maskImage: `url(${hairImg})`,
                WebkitMaskImage: `url(${hairImg})`
            }"
        ></div>
        <img :src="eyesImg" class="offerFaceLayer" alt="" />
        <img :src="mouthImg" class="offerFaceLayer" alt="" />
    </div>
</template>
