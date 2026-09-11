<script setup>
const props = defineProps(["players", "activeContestantSeatId", "chaserSeatId"]);
const emit = defineEmits(["chaseResult"]);

const boardSpaces = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function playerPos() {
  return props.players.find((p) => p.seatId === props.activeContestantSeatId)?.boardPos;
}

function chaserPos() {
  const chaser = props.players.find((p) => p.seatId === props.chaserSeatId);
  return chaser ? chaser.boardPos : 8;
}

function isPlayerSpace(space) {
  return playerPos() === space;
}

function isChaserSpace(space) {
  return chaserPos() === space;
}

function selectOption() {
  emit("chaseResult", false);
}
</script>

<template>
    <div class = "lobby">
      <h2 class = "lobbyTitle">The Chase</h2>
      <div class = "board">
        <div
          v-for="space in boardSpaces"
          :key="space"
          class = "boardSpace"
          :class = "{ playerSpace: isPlayerSpace(space), chaserSpace: isChaserSpace(space) }"
        >
          {{ space }}
        </div>
      </div>
      <p class = "playerName">You: {{ playerPos() }} | Chaser: {{ chaserPos() }}</p>
      <button v-for="index in [1, 2, 3]" :key="index" class="startButton" @click="selectOption">
        Option {{ index }}
      </button>
      <p class = "playerName">Placeholder — chase questions come in a later phase.</p>
    </div>
</template>