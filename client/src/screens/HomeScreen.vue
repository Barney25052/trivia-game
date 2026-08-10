<script setup>
import { ref } from "vue";
defineProps([]);
const emit = defineEmits(["join", "create"]);

const playerName = ref("");
const roomCode = ref("");
const nameEmptyError = ref(false);
const codeEmptyError = ref(false);
import logo from '../../images/logo.png'

function handleJoin() {
  if(!playerName.value.trim()) {
    nameEmptyError.value = false;
    requestAnimationFrame(() => {
      nameEmptyError.value = true;
    })
  }
  if(!roomCode.value.trim()) {
    codeEmptyError.value = false;
    requestAnimationFrame(() => {
      codeEmptyError.value = true;
    })
  }
  if(!roomCode.value.trim() || !playerName.value.trim()) {return;}
  emit("join", { playerName: playerName.value, roomCode: roomCode.value });
}
function handleCreate() {
  if(!playerName.value.trim()) {
    nameEmptyError.value = false;
    requestAnimationFrame(() => {
      nameEmptyError.value = true;
    })
    return;
  }
  emit("join", { playerName: playerName.value, roomCode: "" });
}
</script>

<template>
  <div class="home">
      <div class="rotate"><img :src="logo" class = "logo"></img></div>
      <div class="homeInputs">
        <input v-model="playerName" placeholder="Your name" :class = "{ 'input-error': nameEmptyError}" @animationend="nameEmptyError=false"/>
        <input v-model="roomCode" placeholder="Room Code" :class = "{ 'input-error': codeEmptyError}" @animationend="codeEmptyError=false"/>
        <div class="homeButtonHolder">
          <button @click="handleJoin" class="joinButton">Join Lobby</button>
          <button @click="handleCreate" class="createButton">Create Lobby</button>
        </div>
      </div>
  </div>
</template>