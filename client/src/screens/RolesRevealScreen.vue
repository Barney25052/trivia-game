<script setup>
import { computed, ref } from "vue";
import { PlayerRole, ChaserCharacter } from "../TriviaTypes.ts";
import { CHASER_ABILITY_COPY } from "../chaserAbilities.ts";
import { chaserPortrait, CHASER_NAMES } from "../chaserPortraits.ts";
import CharacterFace from "../components/CharacterFace.vue";
import ChaserSilhouette from "../components/ChaserSilhouette.vue";

const selectedCharacterId = ref(null);

const props = defineProps(["players", "mySeatId"]);
const emit = defineEmits(["ready"]);

const chaser = computed(() => props.players.find((p) => p.role === PlayerRole.Chaser));
const contestants = computed(() => props.players.filter((p) => p.role === PlayerRole.Contestant));
const myRevealReady = computed(
    () => props.players.find((p) => p.seatId === props.mySeatId)?.revealReady === true
);
const allReady = computed(
    () => props.players.length > 0 && props.players.every((p) => p.revealReady === true)
);

// A character with no finished art (chaserPortrait returns null — Maggie,
// today) renders the ChaserSilhouette bust in place of an image, using the
// same base/cover layering so her card's hover reveal behaves the same.
const ROSTER = [ChaserCharacter.Bezos, ChaserCharacter.BigStan, ChaserCharacter.Nami, ChaserCharacter.Maggie];
const availableCharacters = computed(() =>
    ROSTER.map((id) => ({ id, name: CHASER_NAMES[id], img: chaserPortrait(id), ...CHASER_ABILITY_COPY[id] }))
);

const selectedCharacterName = computed(
    () => availableCharacters.value.find((c) => c.id === selectedCharacterId.value)?.name ?? ""
);

// Once the Chaser has locked in, their own frame shows who they picked;
// everyone else keeps the silhouette until the character reveal.
const isMeChaser = computed(() => chaser.value?.seatId === props.mySeatId);
const myPickPortrait = computed(() =>
    isMeChaser.value && selectedCharacterId.value !== null ? chaserPortrait(selectedCharacterId.value) : null
);
const chaserStatus = computed(() => {
    if (isMeChaser.value && selectedCharacterName.value) return `You're chasing as ${selectedCharacterName.value}`;
    return chaser.value?.revealReady ? "Ready to chase" : "Choosing a character…";
});

function handleCharacterSelect(characterId) {
    if (selectedCharacterId.value !== null) return;
    selectedCharacterId.value = characterId;
    emit('ready', { characterId });
}
</script>

<template>
    <div class="revealScreen">
        <div class="revealTop">
            <div v-if="chaser?.seatId === mySeatId && !myRevealReady" class="p5-stage">
                <div class="p5-title-block">
                    <h1 class="p5-title">Choose your Chaser</h1>
                </div>
                <div class="p5-roster-row">
                    <div v-for="character in availableCharacters" :key="character.id" class="p5-card-tilt">
                        <button
                            type="button"
                            class="p5-card"
                            :class="{ 'p5-card-selected': selectedCharacterId === character.id }"
                            :disabled="selectedCharacterId !== null"
                            :aria-pressed="selectedCharacterId === character.id"
                            @click="handleCharacterSelect(character.id)"
                        >
                            <span class="p5-card-bg"></span>
                            <span class="p5-card-content">
                                <span class="p5-card-portrait-wrap">
                                    <span class="p5-card-portrait-base">
                                        <img v-if="character.img" class="p5-card-portrait" :src="character.img" alt="">
                                        <ChaserSilhouette v-else class="p5-card-silhouette p5-card-silhouette-base" />
                                    </span>
                                    <span class="p5-card-portrait-cover">
                                        <img
                                            v-if="character.img"
                                            class="p5-card-portrait p5-card-portrait-silhouette"
                                            :src="character.img"
                                            alt=""
                                        >
                                        <ChaserSilhouette v-else class="p5-card-silhouette p5-card-silhouette-cover" />
                                    </span>
                                </span>
                                <h2 class="p5-card-name">{{ character.name }}</h2>
                                <span class="p5-card-abilities">
                                    <span
                                        v-for="ability in character.passive"
                                        :key="ability.id"
                                        class="p5-ability-chip p5-ability-chip-passive"
                                        :data-tip="ability.description"
                                    >{{ ability.name }}</span>
                                    <span
                                        v-for="ability in character.active"
                                        :key="ability.id"
                                        class="p5-ability-chip p5-ability-chip-active"
                                        :data-tip="ability.description"
                                    >{{ ability.name }}</span>
                                </span>
                            </span>
                        </button>
                    </div>
                </div>
                <p v-if="selectedCharacterId !== null" class="p5-confirm-banner">Locked in: {{ selectedCharacterName }}</p>
            </div>
            <div v-else class="p5-mystery-frame">
                <h2 class="revealLabel">The Chaser is…</h2>
                <img v-if="myPickPortrait" class="revealPickPortrait" :src="myPickPortrait" :alt="selectedCharacterName">
                <ChaserSilhouette v-else class="revealSilhouette" />
                <span class="revealChaserRow">
                    <h1 class="revealChaserName">{{ chaser?.name }}</h1>
                    <span
                        class="ready-tick"
                        :class="{ 'ready-tick-empty': !chaser?.revealReady }"
                        :aria-label="chaser?.revealReady ? 'Ready' : 'Not ready'"
                    ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" /></svg></span>
                </span>
                <p class="revealChaserStatus">{{ chaserStatus }}</p>
            </div>
        </div>
        <div class="revealBottom">
            <h3 class="revealContestantsTitle">The Contestants</h3>
            <ul class="revealContestants">
                <li v-for="player in contestants" :key="player.seatId" class="contestantCard">
                    <div class="board-portrait-circle contestantAvatar">
                        <CharacterFace :character="player.character" reaction="neutral" />
                    </div>
                    <span class="contestantName">{{ player.name }}</span>
                    <span class="contestantReadyRow">
                        <span
                            class="ready-tick"
                            :class="{ 'ready-tick-empty': !player.revealReady }"
                            :aria-label="player.revealReady ? 'Ready' : 'Not ready'"
                        ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" /></svg></span>
                        <span v-if="player.seatId === mySeatId" class="chip chip-blue">You</span>
                    </span>
                </li>
            </ul>
            <p class="status-text">{{ allReady ? "Everyone's ready!" : "Waiting for everyone to ready up…" }}</p>
            <button
                v-if="chaser?.seatId != mySeatId && !myRevealReady"
                class="btn btn-primary revealContinue"
                @click="emit('ready')"
            >I'm ready</button>
        </div>
    </div>
</template>
