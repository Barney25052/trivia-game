<script setup>
import { ref } from "vue";

defineProps(["players", "isHost", "room", "chaserSelectionMode"]);
const emit = defineEmits(["start", "setChaserMode"]);
const settingsOpen = ref(false);
const rulesOpen = ref(false);
</script>

<template>
    <div class="lobbyRow">
      <div class="lobby">
        <h1 class = "lobbyTitle">Host's Lobby</h1>
        <h3 class = "roomCode">Room Code: {{room.roomId}}</h3>
        <ul>
          <li v-for="player in players" :key="player.sessionId" class = "playerName">
            {{ player.name }}
          </li>
        </ul>
        <button class="settingsButton" @click="rulesOpen = !rulesOpen">
          {{ rulesOpen ? "Close Rules" : "How to Play" }}
        </button>
        <button v-if="isHost" @click="settingsOpen = !settingsOpen" class="settingsButton">
          {{ settingsOpen ? "Close Settings" : "Settings" }}
        </button>
        <div v-if="isHost && settingsOpen" class = "settingsPanel">
          <h3 class = "settingsTitle">How do we pick the Chaser?</h3>
          <div class = "modeRow">
            <button
              class="modeButton"
              :class = "{ selected: chaserSelectionMode === 'random' || chaserSelectionMode === '' }"
              @click="emit('setChaserMode', { mode: 'random' })"
            >
              Random
            </button>
            <button
              class="modeButton"
              :class = "{ selected: chaserSelectionMode === 'vote' }"
              @click="emit('setChaserMode', { mode: 'vote' })"
            >
              Team Vote
            </button>
          </div>
        </div>
        <button v-if="isHost" @click="emit('start')" class="startButton">Start Game</button>
      </div>
      <aside v-if="rulesOpen" class = "rulesPanel">
        <h3 class = "settingsTitle">How to Play</h3>
        <h4 class = "settingsTitle">Pick the Chaser</h4>
        <p class = "rulesText">
          One player is the Chaser, everyone else is a Contestant. The host picks how the Chaser is chosen: Random or Team Vote.
        </p>
        <h4 class = "settingsTitle">Cash Builder</h4>
        <p class = "rulesText">
          Each Contestant gets 60 seconds of open-ended questions. Every correct answer adds $1,000 to their pot.
        </p>
        <h4 class = "settingsTitle">The Offer</h4>
        <p class = "rulesText">
          The Chaser offers lower, middle (the cash-builder total), or higher — drawn from the Chaser's pot ($50k to start, +$30k every round). The Contestant picks which to play for.
        </p>
        <h4 class = "settingsTitle">The Board Chase</h4>
        <p class = "rulesText">
          Seven spaces: lower starts you on 4, middle on 5, high on 6. Reach 0 to escape and bank the offer; the Chaser catches you by landing on your space. Three-option questions — once one side answers, the other gets 5 seconds.
        </p>
        <h4 class = "settingsTitle">Final Round</h4>
        <p class = "rulesText">
          The team gets 2 minutes of questions, starting on X points for every survivor. Then the Chaser gets 2 minutes: a correct answer scores 1, a wrong one lets the team push the Chaser back. Reach the team's score and the Chaser wins — otherwise the team wins.
        </p>
      </aside>
    </div>
</template>