<script setup>
defineProps(["players", "isHost", "room"]);
const emit = defineEmits(["start"]);
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
      <button v-if="isHost" @click="emit('start')" class="startButton">Start Game</button>
    </div>
</template>