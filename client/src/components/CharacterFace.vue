<script setup>
import { computed } from "vue";
import { decodeCharacter } from "../character.ts";
import { characterColourFilter, characterColourVar } from "../characterColours.ts";
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

// Shared presentational avatar (ticket 102): decodes a `character` code
// (see ../character.ts) and layers shoulders -> face -> hair -> eyes -> mouth,
// replacing the seatSeed-based layered-face markup that used to be
// duplicated across CashBuilder/Offer/Chase/TeamFinal/ChaserFinal/Lineup.
const props = defineProps({
    character: { type: String, default: "" },
    // Reaction wiring lands in ticket 103 — accepted now so callers don't
    // need a breaking prop change later, but every value renders the same
    // neutral eyes/mouth until then. Do not add reaction branching here.
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
const eyesImg = computed(() => NEUTRAL_EYES_IMAGES[decoded.value.hairStyle % NEUTRAL_EYES_IMAGES.length]);
const mouthImg = computed(() => mouthNeutral);

// Colour model (ticket 102): the art is drawn once in greyscale (today: the
// existing colour placeholder art, see HUMAN_TASKS.md) and recoloured via a
// CSS filter per channel — see characterColours.ts for the palette + recipe
// and its "one shared palette across channels" judgment call.
const hairFilter = computed(() => characterColourFilter(decoded.value.hairColour));
const faceFilter = computed(() => characterColourFilter(decoded.value.faceColour));
// The shoulders/torso layer is a flat CSS shape, not an image (no
// shoulders.png exists yet — HUMAN_TASKS.md has it as `todo`), so it's
// recoloured with a plain background-color instead of an image filter.
const shirtColour = computed(() => characterColourVar(decoded.value.shirtColour));
</script>

<template>
    <div class="offerFaceWrap">
        <div class="offerShoulders" :style="{ backgroundColor: shirtColour }"></div>
        <img :src="faceImg" class="offerFaceLayer" :style="{ filter: faceFilter }" alt="" />
        <img :src="hairImg" class="offerFaceLayer" :style="{ filter: hairFilter }" alt="" />
        <img :src="eyesImg" class="offerFaceLayer" alt="" />
        <img :src="mouthImg" class="offerFaceLayer" alt="" />
    </div>
</template>
