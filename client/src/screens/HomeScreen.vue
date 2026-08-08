<script setup>
import { ref } from "vue";
defineProps(["players", "isHost"]);
const emit = defineEmits(["join", "create"]);

const playerName = ref("");
const roomCode = ref("");

function handleJoin() {
  emit("join", { playerName: playerName.value, roomCode: roomCode.value });
}
function handleCreate() {
  emit("join", { playerName: playerName.value, roomCode: "" });
}
</script>

<template>
  <div class="home">
      <input v-model="playerName" placeholder="Your name"/>
      <input v-model="roomCode" placeholder="Room Code" @keyup.enter="joinLobby"/>
      <button @click="handleJoin">Join Lobby</button>
      <button @click="handleCreate">Create Lobby</button>
  </div>
</template>