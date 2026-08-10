<script setup>
import { ref } from "vue";
defineProps(["players", "isHost", "room"]);
const emit = defineEmits(["startQuiz"]);
</script>

<template>
    <div class = "lobby">
      <h1 class = "lobbyTitle">Host's Lobby</h1>
      <h3 class = "roomCode">Room Code: {{room.roomId}}</h3>
      <ul>
        <li v-for="player in players" :key="player.name" class = "playerName">
          {{ player.name }}
        </li>
      </ul>
      <button v-if="isHost" @click="emit('startQuiz')" class="startButton">Start Quiz</button>
    </div>
</template>