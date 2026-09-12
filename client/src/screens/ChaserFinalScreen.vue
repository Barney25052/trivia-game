<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";

const props = defineProps([
    "teamScore",
    "mySeatId",
    "chaserSeatId",
    "chaserCharacterId",
    "chaserQuipText",
    "chaserQuipKey"
]);
const emit = defineEmits(["chaserReached", "auto-quip", "send-quip"]);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);

const START_QUIPS = [
    "Let's finish this.",
    "One shot at glory.",
    "Time to seal it."
];

const secondsLeft = ref(120);
let interval = null;

onMounted(() => {
  interval = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value -= 1;
  }, 1000);
  emit("auto-quip", START_QUIPS[Math.floor(Math.random() * START_QUIPS.length)]);
});

onUnmounted(() => {
  clearInterval(interval);
});

const answer = ref("");
</script>

<template>
  <div class="chaserSideLayout">
    <ChaserPanel
        :character-id="chaserCharacterId"
        :quip-text="chaserQuipText"
        :quip-key="chaserQuipKey"
        :is-chaser="isChaser"
        @send-quip="emit('send-quip', $event)"
    />
    <div class = "lobby">
      <h2 class = "lobbyTitle">Final Round — Chaser</h2>
      <p class = "playerName">Time left: {{ secondsLeft }}s</p>
      <p class = "playerName">Team is on {{ teamScore }} points</p>
      <input v-model="answer" placeholder="Type your answer..." />
      <button class="startButton">Submit</button>
      <p class = "playerName">Placeholder — real questions come in a later phase.</p>
      <button class="startButton" @click="emit('chaserReached')">Chaser caught the team</button>
    </div>
  </div>
</template>