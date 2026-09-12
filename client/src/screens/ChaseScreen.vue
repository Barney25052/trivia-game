<script setup>
import { computed, onMounted } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";

const props = defineProps([
    "players",
    "activeContestantSeatId",
    "chaserSeatId",
    "mySeatId",
    "chaserCharacterId",
    "chaserQuipText",
    "chaserQuipKey"
]);
const emit = defineEmits(["chaseResult", "auto-quip", "send-quip"]);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);

const START_QUIPS = [
    "Let's see if you can escape.",
    "Nowhere to run.",
    "This ends now."
];

onMounted(() => {
    emit("auto-quip", START_QUIPS[Math.floor(Math.random() * START_QUIPS.length)]);
});

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
  <div class="chaserSideLayout">
    <ChaserPanel
        :character-id="chaserCharacterId"
        :quip-text="chaserQuipText"
        :quip-key="chaserQuipKey"
        :is-chaser="isChaser"
        @send-quip="emit('send-quip', $event)"
    />
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
  </div>
</template>