<script setup>
import { ref, onMounted, onUnmounted } from "vue";

defineProps(["teamScore"]);

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
      <h2 class = "lobbyTitle">Final Round — Team</h2>
      <p class = "playerName">Time left: {{ secondsLeft }}s</p>
      <p class = "playerName">Team starts at {{ teamScore }} points</p>
      <input v-model="answer" placeholder="Type your answer..." />
      <button class="startButton">Submit</button>
      <p class = "playerName">Placeholder — real questions come in a later phase.</p>
    </div>
</template>