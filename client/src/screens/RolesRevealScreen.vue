<script setup>
import { computed, ref } from "vue";
import { PlayerRole, ChaserCharacter } from "../TriviaTypes.ts";
import { CHASER_ABILITY_COPY } from "../chaserAbilities.ts";
import CharacterFace from "../components/CharacterFace.vue";
import bezosIcon from "../assets/images/chasers/bezos-icon.png";
import bigStanIcon from "../assets/images/chasers/bigstan-icon.png";
import namiIcon from "../assets/images/chasers/nami-icon.png";

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

// Maggie has no portrait art yet (ticket 139's maggie-icon.png row is still
// `todo` in HUMAN_TASKS.md) — her `img` stays unset so the template renders
// the .p5-card-silhouette SVG bust in its place, permanently, not as a
// loading placeholder for art that's expected to land soon.
const availableCharacters = computed(() => [
    { id: ChaserCharacter.Bezos, name: "Bezos", img: bezosIcon, ...CHASER_ABILITY_COPY[ChaserCharacter.Bezos] },
    { id: ChaserCharacter.BigStan, name: "Big Stan", img: bigStanIcon, ...CHASER_ABILITY_COPY[ChaserCharacter.BigStan] },
    { id: ChaserCharacter.Nami, name: "Nami", img: namiIcon, ...CHASER_ABILITY_COPY[ChaserCharacter.Nami] },
    { id: ChaserCharacter.Maggie, name: "Maggie", img: null, ...CHASER_ABILITY_COPY[ChaserCharacter.Maggie] }
]);

const selectedCharacterName = computed(
    () => availableCharacters.value.find((c) => c.id === selectedCharacterId.value)?.name ?? ""
);

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
                                        <svg v-else class="p5-card-silhouette p5-card-silhouette-base" viewBox="0 0 120 170" aria-hidden="true">
                                            <circle class="sil" cx="60" cy="50" r="35" />
                                            <path class="sil" d="M60 95 C 25 95, 8 120, 8 170 L 112 170 C 112 120, 95 95, 60 95 z" />
                                        </svg>
                                    </span>
                                    <span class="p5-card-portrait-cover">
                                        <img
                                            v-if="character.img"
                                            class="p5-card-portrait p5-card-portrait-silhouette"
                                            :src="character.img"
                                            alt=""
                                        >
                                        <svg v-else class="p5-card-silhouette p5-card-silhouette-cover" viewBox="0 0 120 170" aria-hidden="true">
                                            <circle class="sil" cx="60" cy="50" r="35" />
                                            <path class="sil" d="M60 95 C 25 95, 8 120, 8 170 L 112 170 C 112 120, 95 95, 60 95 z" />
                                        </svg>
                                    </span>
                                </span>
                                <h2 class="p5-card-name">{{ character.name }}</h2>
                                <p class="p5-card-tagline">{{ character.tagline }}</p>
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
                <h2 class="revealLabel">The Chaser</h2>
                <svg class="chaserSilhouette" viewBox="0 0 120 170" aria-label="chaser silhouette">
                    <circle class="sil" cx="60" cy="50" r="35" />
                    <path class="sil" d="M60 95 C 25 95, 8 120, 8 170 L 112 170 C 112 120, 95 95, 60 95 z" />
                </svg>
                <span class="revealChaserRow">
                    <h1 class="revealChaserName">{{ chaser?.name }}</h1>
                    <span
                        class="revealReadyTick"
                        :class="{ 'revealReadyTick-empty': !chaser?.revealReady }"
                    >✓</span>
                </span>
            </div>
        </div>
        <div class="revealBottom">
            <h3 class="revealContestantsTitle">The Contestants</h3>
            <ul class="revealContestants">
                <li v-for="player in contestants" :key="player.seatId" class="contestantCard">
                    <div class="contestantAvatar">
                        <CharacterFace :character="player.character" reaction="neutral" />
                    </div>
                    <span class="contestantName">{{ player.name }}</span>
                    <span class="contestantReadyRow">
                        <span
                            class="revealReadyTick"
                            :class="{ 'revealReadyTick-empty': !player.revealReady }"
                        >✓</span>
                        <span v-if="player.seatId === mySeatId" class="contestantYou">(you)</span>
                    </span>
                </li>
            </ul>
            <p class="playerName">{{ allReady ? "All ready!" : "Waiting for everyone to be ready…" }}</p>
            <button
                v-if="chaser?.seatId != mySeatId && !myRevealReady"
                class="btn btn-primary revealContinue"
                @click="emit('ready')"
            >Ready</button>
        </div>
    </div>
</template>
