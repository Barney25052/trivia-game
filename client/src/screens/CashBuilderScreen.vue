<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const secondsLeft = ref(60);
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
      <h2 class = "lobbyTitle">Cash Builder</h2>
      <p class = "playerName">Time left: {{ secondsLeft }}s</p>
      <input v-model="answer" placeholder="Type your answer..." />
      <button class="startButton">Submit</button>
      <p class = "playerName">Placeholder — real questions come in a later phase.</p>
    </div>
</template>