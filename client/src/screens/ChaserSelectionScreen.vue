<script setup>
import { computed } from "vue";

const props = defineProps(["players", "isHost", "chaserSelectionMode", "chaserSessionId", "mySessionId"]);
const emit = defineEmits(["chaserVote"]);

const voteMode = computed(() => props.chaserSelectionMode === "vote");
const myPlayer = computed(() => props.players.find((p) => p.sessionId === props.mySessionId));
const voteTargetSessionId = computed(() => myPlayer.value?.chaserVote ?? "");
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
          :key="player.sessionId"
          class = "voteRow"
          :class = "{ voteTarget: player.sessionId === voteTargetSessionId }"
        >
          <span class = "voteName">
            {{ player.name }}
            <span v-if="player.sessionId === mySessionId"> (you)</span>
          </span>
          <span v-if="voteMode">
            <span v-if="player.chaserVote !== ''" class = "voteStatus">
              {{ player.sessionId === voteTargetSessionId ? "your pick" : "voted" }}
            </span>
            <button
              v-if="!haveVoted"
              class="voteButton"
              @click="emit('chaserVote', { targetSessionId: player.sessionId })"
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