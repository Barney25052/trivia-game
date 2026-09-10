<script setup>
defineProps(["winner", "players"]);
const emit = defineEmits(["leave"]);
</script>

<template>
    <div class = "lobby">
        <h2 class = "lobbyTitle">Game Over</h2>
        <h3 class = "lobbyTitle">{{ winner === "chaser" ? "The Chaser wins!" : "The Team wins!" }}</h3>
        <ul>
          <li v-for="player in players" :key="player.sessionId">
              <div class = "playerResult">
                  <p class ="playerName">{{ player.name }} — {{ player.score }}</p>
              </div>
          </li>
        </ul>
        <button @click="emit('leave')" class = "nextButton">Main Menu</button>
    </div>
</template>