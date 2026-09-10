<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

const props = defineProps({
    getReadyCooldownMs: { type: Number, default: 0 }
});

const FALLBACK_READY_COOLDOWN_MS = 3000;

const cooldownLeft = ref(0);
const secondsLeft = ref(60);
let cooldownInterval = null;
let questionInterval = null;

const readyCountdownActive = computed(() => cooldownLeft.value > 0);

function startReadyCountdown(totalMs) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownLeft.value = Math.ceil(totalMs / 1000);
    cooldownInterval = setInterval(() => {
        cooldownLeft.value -= 1;
        if (cooldownLeft.value <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            startCashBuilder();
        }
    }, 1000);
}

function startCashBuilder() {
    if (questionInterval) return;
    questionInterval = setInterval(() => {
        if (secondsLeft.value > 0) secondsLeft.value -= 1;
    }, 1000);
}

watch(() => props.getReadyCooldownMs, (ms) => {
    if (ms > 0) startReadyCountdown(ms);
});

onMounted(() => {
    startReadyCountdown(props.getReadyCooldownMs > 0 ? props.getReadyCooldownMs : FALLBACK_READY_COOLDOWN_MS);
});

onUnmounted(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
    if (questionInterval) clearInterval(questionInterval);
});

const answer = ref("");
</script>

<template>
    <div class="lobby">
        <h2 class="lobbyTitle">Cash Builder</h2>
        <p v-if="readyCountdownActive" class="playerName getReadyCountdown">
            Get ready… {{ cooldownLeft }}s
        </p>
        <p v-else class="playerName">Time left: {{ secondsLeft }}s</p>
        <input v-model="answer" placeholder="Type your answer..." />
        <button class="startButton">Submit</button>
        <p class="playerName">Placeholder — real questions come in a later phase.</p>
    </div>
</template>