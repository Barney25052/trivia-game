<script setup>
import { ref } from "vue";

defineProps(["players", "isHost", "room", "chaserSelectionMode"]);
const emit = defineEmits(["start", "setChaserMode"]);
const settingsOpen = ref(false);
</script>

<template>
    <div class = "lobby">
      <h1 class = "lobbyTitle">Host's Lobby</h1>
      <h3 class = "roomCode">Room Code: {{room.roomId}}</h3>
      <ul>
        <li v-for="player in players" :key="player.sessionId" class = "playerName">
          {{ player.name }}
        </li>
      </ul>
      <button v-if="isHost" @click="settingsOpen = !settingsOpen" class="settingsButton">
        {{ settingsOpen ? "Close Settings" : "Settings" }}
      </button>
      <div v-if="isHost && settingsOpen" class = "settingsPanel">
        <h3 class = "settingsTitle">How do we pick the Chaser?</h3>
        <div class = "modeRow">
          <button
            class="modeButton"
            :class = "{ selected: chaserSelectionMode === 'random' || chaserSelectionMode === '' }"
            @click="emit('setChaserMode', { mode: 'random' })"
          >
            Random
          </button>
          <button
            class="modeButton"
            :class = "{ selected: chaserSelectionMode === 'vote' }"
            @click="emit('setChaserMode', { mode: 'vote' })"
          >
            Team Vote
          </button>
        </div>
      </div>
      <button v-if="isHost" @click="emit('start')" class="startButton">Start Game</button>
    </div>
</template>