<script setup>
import { computed } from "vue";

const props = defineProps(["players", "isHost", "chaserSelectionMode", "chaserSeatId", "mySeatId"]);
const emit = defineEmits(["chaserVote"]);

const voteMode = computed(() => props.chaserSelectionMode === "vote");
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
          <span v-if="voteMode">
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
      <p v-if="!voteMode" class = "waitingText">Picking the chaser…</p>
      <p v-else class = "waitingText">
        {{ haveVoted ? "Waiting for votes…" : "Vote for who should be the Chaser!" }}
      </p>
    </div>
</template>