<script setup>
import { ref, onMounted, onUnmounted } from "vue";

defineProps(["teamScore"]);
const emit = defineEmits(["chaserReached"]);

const secondsLeft = ref(120);
let interval = null;

onMounted(() => {
  interval = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value -= 1;
  }, 1000);
});

onUnmounted(() => {
  clearInterval(interval);
});

const answer = ref("");
</script>

<template>
    <div class = "lobby">
      <h2 class = "lobbyTitle">Final Round — Chaser</h2>
      <p class = "playerName">Time left: {{ secondsLeft }}s</p>
      <p class = "playerName">Team is on {{ teamScore }} points</p>
      <input v-model="answer" placeholder="Type your answer..." />
      <button class="startButton">Submit</button>
      <p class = "playerName">Placeholder — real questions come in a later phase.</p>
      <button class="startButton" @click="emit('chaserReached')">Chaser caught the team</button>
    </div>
</template>