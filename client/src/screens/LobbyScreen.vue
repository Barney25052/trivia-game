<script setup>
import { ref } from "vue";
defineProps(["players", "isHost", "room"]);
const emit = defineEmits(["startQuiz"]);
</script>

<template>
    <div class = "lobby">
      <h3>Room Code: {{room.roomId}}</h3>
      <h2>Players</h2>
      <ul>
        <li v-for="player in players" :key="player.name">
          {{ player.name }}
        </li>
      </ul>
      <button v-if="isHost" @click="emit('startQuiz')">Start Quiz</button>
    </div>
</template>