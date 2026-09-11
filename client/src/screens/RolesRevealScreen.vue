<script setup>
import { computed, ref } from "vue";
import { PlayerRole, ChaserCharacter } from "../TriviaTypes.ts";
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
const availableCharacters = computed(() => [
    { id: ChaserCharacter.Bezos, name: "Bezos", img: bezosIcon },
    { id: ChaserCharacter.BigStan, name: "Big Stan", img: bigStanIcon },
    { id: ChaserCharacter.Nami, name: "Nami", img: namiIcon }
]);

function handleCharacterSelect(characterId) {
    selectedCharacterId.value = characterId;
    emit('ready', { characterId });
}
</script>

<template>
    <div class="revealScreen">
        <div class="revealTop">
            <div v-if="chaser?.seatId === mySeatId && !myRevealReady" class="characterPicker">
                <h1 class="characterPickerLabel">Choose your Chaser character</h1>
                <div class="characterOptions">
                    <img
                        v-for="character in availableCharacters"
                        :key="character.id"
                        type="button"
                        class="chaserImage"
                        :disabled="selectedCharacterId !== null"
                        @click="handleCharacterSelect(character.id)"
                        :src = "character.img"
                    >
                </img>
                </div>
            </div>
            <div v-else>
                <h2 class="revealLabel">The Chaser is</h2>
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
                    <div class="contestantAvatar">{{ player.name.charAt(0).toUpperCase() }}</div>
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
                class="revealContinue"
                @click="emit('ready')"
            >Ready</button>
        </div>
    </div>
</template>
