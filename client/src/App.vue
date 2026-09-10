<script setup>
import { ref, computed, watch} from "vue";
import { Client } from "@colyseus/sdk";
import { GamePhase } from "./TriviaTypes.ts";
import HomeScreen from "./screens/HomeScreen.vue"
import LobbyScreen from "./screens/LobbyScreen.vue";
import ChaserSelectionScreen from "./screens/ChaserSelectionScreen.vue";
import ChaserWheelScreen from "./screens/ChaserWheelScreen.vue";
import RolesRevealScreen from "./screens/RolesRevealScreen.vue";
import CashBuilderScreen from "./screens/CashBuilderScreen.vue";
import OfferScreen from "./screens/OfferScreen.vue";
import ChaseScreen from "./screens/ChaseScreen.vue";
import TeamFinalScreen from "./screens/TeamFinalScreen.vue";
import ChaserFinalScreen from "./screens/ChaserFinalScreen.vue";
import ResultsScreen from "./screens/ResultsScreen.vue";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

const room = ref(null);
const playersMap = ref(null);
const players = ref([]);
const currentPhase = ref(null);
const chaserSelectionMode = ref("");
const activeContestantSessionId = ref("");
const chaserSessionId = ref("");
const teamScore = ref(0);
const currentOffer = ref(null);
const winner = ref(null);
const hasRevealedRoles = ref(false);
const rolesRevealOpen = ref(false);
const wheelActive = ref(false);

const currentScreen = computed(() => {
  if (!room.value) return "home";
  switch (currentPhase.value) {
    case GamePhase.Lobby: return "lobby";
    case GamePhase.ChaserSelection: return "chaserSelection";
    case GamePhase.CashBuilder: return "cashBuilder";
    case GamePhase.Offer: return "offer";
    case GamePhase.Chase: return "chase";
    case GamePhase.TeamFinal: return "teamFinal";
    case GamePhase.ChaserFinal: return "chaserFinal";
    case GamePhase.GameEnd: return "gameEnd";
    default: return "home";
  }
});

const myPlayer = computed(() => playersMap.value?.get(room.value?.sessionId));
const mySessionId = computed(() => room.value?.sessionId);
const isHost = computed(() => myPlayer.value?.isHost === true);

watch(
    () => currentScreen.value,
    (screen) => {
        if (screen === "chaserSelection" && chaserSelectionMode.value === "random") {
            wheelActive.value = true;
        }
    }
);

async function handleJoin({ playerName, roomCode }) {
  await joinLobby(playerName, roomCode);
}

async function joinLobby(playerName, roomCode) {
  const client = new Client(SERVER_URL);

  try {

    if(roomCode == "") {
      room.value = await client.create("trivia", {playerName : playerName});
    } else {
      room.value = await client.joinById(roomCode, {playerName : playerName});
    }

    hasRevealedRoles.value = false;
    rolesRevealOpen.value = false;
    wheelActive.value = false;

    room.value.onStateChange((newState) => {
      currentPhase.value = newState.currentPhase;
      playersMap.value = newState.players;
      players.value = Array.from(newState.players.values());
      chaserSelectionMode.value = newState.chaserSelectionMode;
      activeContestantSessionId.value = newState.activeContestantSessionId;
      chaserSessionId.value = newState.chaserSessionId;
      teamScore.value = newState.teamScore;

      if (newState.chaserSessionId && !hasRevealedRoles.value && chaserSelectionMode.value !== "random") {
        hasRevealedRoles.value = true;
        rolesRevealOpen.value = true;
      }
    });

    room.value.onMessage("phase", (message) => {
      currentPhase.value = message.phase;
    });

    room.value.onMessage("offer", (message) => {
      currentOffer.value = message;
    });

    room.value.onMessage("endGame", (message) => {
      winner.value = message.winner;
    });

    room.value.onLeave(() => {
      room.value = null;
    });

  } catch (e) {
    console.error("Failed to join:", e);
  }
}

function startGame() {
  try {
    room.value?.send("startGame", {});

  } catch (e) {
    console.error("Failed to start:", e);
  }
}

function setChaserMode({ mode }) {
  try {
    room.value?.send("setChaserMode", { mode });

  } catch (e) {
    console.error("Failed to set chaser mode:", e);
  }
}

function chaserVote({ targetSessionId }) {
  try {
    room.value?.send("chaserVote", { targetSessionId });

  } catch (e) {
    console.error("Failed to send chaser vote:", e);
  }
}

function chooseOffer(offer) {
  try {
    room.value?.send("offerChoice", { offer });

  } catch (e) {
    console.error("Failed to choose offer:", e);
  }
}

function sendChaseResult(escaped) {
  try {
    room.value?.send("chaseResult", { escaped });

  } catch (e) {
    console.error("Failed to send chase result:", e);
  }
}

function chaserReachedScore() {
  try {
    room.value?.send("finalChaserScore", {});

  } catch (e) {
    console.error("Failed to send final chaser score:", e);
  }
}

function handleLeave() {
  room.value?.leave()
  room.value  = null
}

function closeRolesReveal() {
  rolesRevealOpen.value = false;
}

function openRolesReveal() {
  if (hasRevealedRoles.value) return;
  hasRevealedRoles.value = true;
  rolesRevealOpen.value = true;
}

function handleWheelReveal() {
  wheelActive.value = false;
  openRolesReveal();
}
</script>

<template>
  <div class="app">
    <p>{{ currentScreen }}</p>

    <HomeScreen v-if="currentScreen=='home'" @join="handleJoin" @create="handleJoin"/>
    <LobbyScreen 
      v-if="currentScreen=='lobby'" 
      @start="startGame"
      @setChaserMode="setChaserMode"
      :players="players"
      :isHost="isHost"
      :room = "room"
      :chaserSelectionMode="chaserSelectionMode"
    />
    <ChaserWheelScreen
      v-if="wheelActive"
      :players="players"
      :chaserSessionId="chaserSessionId"
      @reveal="handleWheelReveal"
    />
    <ChaserSelectionScreen
      v-if="currentScreen=='chaserSelection' && chaserSelectionMode!=='random'"
      :players="players"
      :isHost="isHost"
      :chaserSelectionMode="chaserSelectionMode"
      :chaserSessionId="chaserSessionId"
      :mySessionId="mySessionId"
      @chaserVote="chaserVote"
    />
    <CashBuilderScreen 
      v-if="currentScreen=='cashBuilder'"
    />
    <OfferScreen
      v-if="currentScreen=='offer'"
      :offer="currentOffer"
      :mySessionId="mySessionId"
      :players="players"
      @choose="chooseOffer"
    />
    <ChaseScreen
      v-if="currentScreen=='chase'"
      :players="players"
      :activeContestantSessionId="activeContestantSessionId"
      :chaserSessionId="chaserSessionId"
      @chaseResult="sendChaseResult"
    />
    <TeamFinalScreen
      v-if="currentScreen=='teamFinal'"
      :teamScore="teamScore"
    />
    <ChaserFinalScreen
      v-if="currentScreen=='chaserFinal'"
      :teamScore="teamScore"
      @chaserReached="chaserReachedScore"
    />
    <ResultsScreen
      v-if="currentScreen=='gameEnd'"
      :winner="winner"
      :players="players"
      @leave="handleLeave"
    />
    <RolesRevealScreen
      v-if="rolesRevealOpen"
      :players="players"
      :mySessionId="mySessionId"
      @continue="closeRolesReveal"
    />
  </div>
</template>