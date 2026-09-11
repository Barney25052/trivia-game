<script setup>
import { computed } from "vue";
import { PlayerRole } from "../TriviaTypes.ts";

const props = defineProps(["offer", "mySeatId", "players"]);
const emit = defineEmits(["choose"]);

const tiers = ["low", "middle", "high"];

function contestantName() {
  const player = props.players.find((p) => p.seatId === props.offer?.seatId);
  return player?.name;
}

const chaserCharacterName = computed(
    () => props.offer?.chaserCharacterName ?? ""
);
const chaserCharacterAbility = computed(
    () => props.offer?.chaserCharacterAbility ?? ""
);
</script>

<template>
    <div class = "lobby">
      <h2 class = "lobbyTitle">The Offer</h2>
      <p class = "playerName">{{ contestantName() }} faces the Chaser</p>
      <p v-if="chaserCharacterName" class = "playerName">Chaser: {{ chaserCharacterName }}</p>
      <p v-if="chaserCharacterAbility" class = "playerName">{{ chaserCharacterAbility }}</p>
      <div v-if="offer && offer.seatId === mySeatId">
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