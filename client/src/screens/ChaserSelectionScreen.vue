<script setup>
import { computed } from "vue";

// Random mode resolves the Chaser immediately and never shows this screen
// (server goes straight to the ChaserReveal wheel) — this screen is vote-mode-only.
const props = defineProps(["players", "isHost", "chaserSeatId", "mySeatId"]);
const emit = defineEmits(["chaserVote"]);

const myPlayer = computed(() => props.players.find((p) => p.seatId === props.mySeatId));
const voteTargetSeatId = computed(() => myPlayer.value?.chaserVote ?? "");
const haveVoted = computed(() => {
    const vote = myPlayer.value?.chaserVote;
    return vote !== "" && vote != null;
});
</script>

<template>
    <div class = "lobby">
      <h2 class = "lobbyTitle">Picking the Chaser…</h2>
      <ul>
        <li
          v-for="player in players"
          :key="player.seatId"
          class = "voteRow"
          :class = "{ voteTarget: player.seatId === voteTargetSeatId }"
        >
          <span class = "voteName">
            {{ player.name }}
            <span v-if="player.seatId === mySeatId"> (you)</span>
          </span>
          <span>
            <span v-if="player.chaserVote !== ''" class = "voteStatus">
              {{ player.seatId === voteTargetSeatId ? "your pick" : "voted" }}
            </span>
            <button
              v-if="!haveVoted"
              class="voteButton"
              @click="emit('chaserVote', { targetSeatId: player.seatId })"
            >
              Vote
            </button>
          </span>
        </li>
      </ul>
      <p class = "waitingText">
        {{ haveVoted ? "Waiting for votes…" : "Vote for who should be the Chaser!" }}
      </p>
    </div>
</template>