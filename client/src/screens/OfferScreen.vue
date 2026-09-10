<script setup>
import { computed } from "vue";
import { PlayerRole, ChaserCharacter } from "../TriviaTypes.ts";

const props = defineProps(["offer", "mySessionId", "players"]);
const emit = defineEmits(["choose"]);

const tiers = ["low", "middle", "high"];

function contestantName() {
  const player = props.players.find((p) => p.sessionId === props.offer?.sessionId);
  return player?.name;
}

const mySession = computed(() => props.mySessionId);
const chaserCharacterId = computed(
    () => props.offer?.chaserCharacterId
);
const chaserCharacterInfo = computed(() => {
    if (!chaserCharacterId.value) return null;
    const char = Object.entries(ChaserCharacter).find(
        ([, value]) => value === chaserCharacterId.value
    );
    if (!char) return null;
    const [name, value] = char;
    return { id: value, name };
});
</script>

<template>
    <div class = "lobby">
      <h2 class = "lobbyTitle">The Offer</h2>
      <p class = "playerName">{{ contestantName() }} faces the Chaser</p>
      <p v-if="chaserCharacterInfo" class = "playerName">Chaser: {{ chaserCharacterInfo.name }}</p>
      <div v-if="offer && offer.sessionId === mySessionId">
        <button
          v-for="tier in tiers"
          :key="tier"
          class="startButton"
          @click="emit('choose', tier)"
        >
          {{ tier }} — ${{ offer.offers[tier] }}
        </button>
        <p class = "playerName">Pick the offer you want to play for.</p>
      </div>
      <p v-else class = "playerName">Waiting for {{ contestantName() }} to pick...</p>
    </div>
</template>