<script setup>
import { computed } from "vue";
import { PlayerRole } from "../TriviaTypes.ts";

const props = defineProps(["players", "mySessionId"]);
const emit = defineEmits(["ready"]);

const chaser = computed(() => props.players.find((p) => p.role === PlayerRole.Chaser));
const contestants = computed(() => props.players.filter((p) => p.role === PlayerRole.Contestant));
const myRevealReady = computed(
    () => props.players.find((p) => p.sessionId === props.mySessionId)?.revealReady === true
);
const allReady = computed(
    () => props.players.length > 0 && props.players.every((p) => p.revealReady === true)
);
</script>

<template>
    <div class="revealScreen">
        <div class="revealTop">
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
            <span v-if="chaser?.sessionId === mySessionId" class="revealChaserYou">(you)</span>
        </div>
        <div class="revealBottom">
            <h3 class="revealContestantsTitle">The Contestants</h3>
            <ul class="revealContestants">
                <li v-for="player in contestants" :key="player.sessionId" class="contestantCard">
                    <div class="contestantAvatar">{{ player.name.charAt(0).toUpperCase() }}</div>
                    <span class="contestantName">{{ player.name }}</span>
                    <span class="contestantReadyRow">
                        <span
                            class="revealReadyTick"
                            :class="{ 'revealReadyTick-empty': !player.revealReady }"
                        >✓</span>
                        <span v-if="player.sessionId === mySessionId" class="contestantYou">(you)</span>
                    </span>
                </li>
            </ul>
            <p class="playerName">{{ allReady ? "All ready!" : "Waiting for everyone to be ready…" }}</p>
            <button class="revealContinue" :disabled="myRevealReady" @click="emit('ready')">Ready</button>
        </div>
    </div>
</template>