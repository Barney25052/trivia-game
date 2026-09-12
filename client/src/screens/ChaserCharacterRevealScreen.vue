<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { ChaserCharacter } from "../TriviaTypes.ts";
import bezosIcon from "../assets/images/chasers/bezos-icon.png";
import bigStanIcon from "../assets/images/chasers/bigstan-icon.png";
import namiIcon from "../assets/images/chasers/nami-icon.png";

const GROW_MS = 1400;
const HOLD_MS = 1800;
const SPOTLIGHT_MS = 700;

const props = defineProps({
    chaserCharacterId: { type: String, default: "" },
    chaserCharacterName: { type: String, default: "" }
});

const portraits = {
    [ChaserCharacter.Bezos]: bezosIcon,
    [ChaserCharacter.BigStan]: bigStanIcon,
    [ChaserCharacter.Nami]: namiIcon
};

const portrait = computed(() => portraits[props.chaserCharacterId] ?? null);

const stage = ref("grow");
let stageTimeouts = [];

function clearStageTimeouts() {
    stageTimeouts.forEach(clearTimeout);
    stageTimeouts = [];
}

function runSequence() {
    clearStageTimeouts();
    stage.value = "grow";
    stageTimeouts.push(setTimeout(() => { stage.value = "hold"; }, GROW_MS));
    stageTimeouts.push(setTimeout(() => { stage.value = "spotlight"; }, GROW_MS + HOLD_MS));
    stageTimeouts.push(setTimeout(() => { stage.value = "name"; }, GROW_MS + HOLD_MS + SPOTLIGHT_MS));
}

runSequence();
onBeforeUnmount(clearStageTimeouts);
</script>

<template>
    <div class="ccrScreen" :class="stage">
        <h2 class="ccrTitle">Who will you be facing?</h2>
        <div class="ccrSpotlightBeam"></div>
        <div class="ccrPortraitWrap">
            <img v-if="portrait" :src="portrait" :alt="chaserCharacterName" class="ccrPortrait">
        </div>
        <h1 class="ccrName">{{ chaserCharacterName }}</h1>
    </div>
</template>
