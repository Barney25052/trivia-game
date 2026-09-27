<script setup>
import { computed } from "vue";
import CharacterFace from "../components/CharacterFace.vue";

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
    <div class="lobby">
      <h2 class="lobbyTitle">Pick the Chaser</h2>
      <p class="status-text">
        {{ haveVoted ? "Vote cast. Waiting for everyone else…" : "Who should play the Chaser?" }}
      </p>
      <ul class="panel voteList">
        <li
          v-for="player in players"
          :key="player.seatId"
          class="voteRow"
          :class="{ voteTarget: player.seatId === voteTargetSeatId }"
        >
          <div class="board-portrait-circle voteAvatar">
            <CharacterFace :character="player.character" reaction="neutral" />
          </div>
          <span class="voteName">{{ player.name }}</span>
          <span
            class="ready-tick"
            :class="{ 'ready-tick-empty': player.chaserVote === '' }"
            :aria-label="player.chaserVote !== '' ? 'Has voted' : 'Not voted yet'"
          ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" /></svg></span>
          <span v-if="player.seatId === mySeatId" class="chip chip-blue">You</span>
          <span class="voteActions">
            <span v-if="player.seatId === voteTargetSeatId" class="chip chip-gold">Your pick</span>
            <button
              v-if="!haveVoted"
              class="btn btn-primary btn-small"
              @click="emit('chaserVote', { targetSeatId: player.seatId })"
            >Vote</button>
          </span>
        </li>
      </ul>
    </div>
</template>
