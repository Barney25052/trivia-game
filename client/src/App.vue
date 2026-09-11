<script setup>
import { ref, computed } from "vue";
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
const activeContestantSeatId = ref("");
const chaserSeatId = ref("");
const mySeatId = ref("");
const teamScore = ref(0);
const currentOffer = ref(null);
const winner = ref(null);
const getReadyCooldownMs = ref(0);
const currentQuestion = ref(null);

const currentScreen = computed(() => {
  if (!room.value) return "home";
  switch (currentPhase.value) {
    case GamePhase.Lobby: return "lobby";
    case GamePhase.ChaserSelection: return "chaserSelection";
    case GamePhase.ChaserReveal: return "chaserReveal";
    case GamePhase.RolesReveal: return "rolesReveal";
    case GamePhase.CashBuilder: return "cashBuilder";
    case GamePhase.Offer: return "offer";
    case GamePhase.Chase: return "chase";
    case GamePhase.TeamFinal: return "teamFinal";
    case GamePhase.ChaserFinal: return "chaserFinal";
    case GamePhase.GameEnd: return "gameEnd";
    default: return "home";
  }
});

const myPlayer = computed(() => playersMap.value?.get(mySeatId.value));
const isHost = computed(() => myPlayer.value?.isHost === true);

const activeContestant = computed(
    () => players.value.find((p) => p.seatId === activeContestantSeatId.value)
);
const activeContestantName = computed(() => activeContestant.value?.name ?? "");
const activeContestantMoney = computed(() => activeContestant.value?.cashBuilderMoney ?? 0);
const activeContestantCorrectAnswers = computed(
    () => activeContestant.value?.cashBuilderCorrectAnswers ?? 0
);
const isActiveContestant = computed(
    () => activeContestantSeatId.value !== "" && mySeatId.value === activeContestantSeatId.value
);
const currentRoundQuestion = computed(() => {
    if (!currentQuestion.value) return null;
    if (currentQuestion.value.targetSeatId !== activeContestantSeatId.value) return null;
    return currentQuestion.value;
});

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
    
    room.value.onLeave(() => {
      handleLeave();
    })

    room.value.onStateChange((newState) => {
      currentPhase.value = newState.currentPhase;
      playersMap.value = newState.players;
      players.value = Array.from(newState.players.values());
      chaserSelectionMode.value = newState.chaserSelectionMode;
      activeContestantSeatId.value = newState.activeContestantSeatId;
      chaserSeatId.value = newState.chaserSeatId;
      teamScore.value = newState.teamScore;
    });

    room.value.onMessage("seatId", (message) => {
      mySeatId.value = message.seatId;
    });

    room.value.onMessage("phase", (message) => {
      currentPhase.value = message.phase;
      if (message.phase !== GamePhase.CashBuilder) {
        getReadyCooldownMs.value = 0;
      }
    });

    room.value.onMessage("question", (message) => {
      currentQuestion.value = message;
    });

    room.value.onMessage("offer", (message) => {
      currentOffer.value = message;
    });

    room.value.onMessage("getReady", (message) => {
      getReadyCooldownMs.value = message.cooldownMs;
    });

    room.value.onMessage("endGame", (message) => {
      winner.value = message.winner;
    });

    room.value.send("whoami", {});

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

function chaserVote({ targetSeatId }) {
  try {
    room.value?.send("chaserVote", { targetSeatId });

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

function revealReady({ characterId } = {}) {
  try {
    room.value?.send("revealReady", { characterId });

  } catch (e) {
    console.error("Failed to send reveal ready:", e);
  }
}

function submitAnswer({ answer, questionId }) {
  try {
    room.value?.send("submitAnswer", { answer, questionId });

  } catch (e) {
    console.error("Failed to submit answer:", e);
  }
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
    <ChaserSelectionScreen
      v-if="currentScreen=='chaserSelection'"
      :players="players"
      :isHost="isHost"
      :chaserSelectionMode="chaserSelectionMode"
      :chaserSeatId="chaserSeatId"
      :mySeatId="mySeatId"
      @chaserVote="chaserVote"
    />
    <ChaserWheelScreen
      v-else-if="currentScreen=='chaserReveal'"
      :players="players"
      :chaserSeatId="chaserSeatId"
    />
    <RolesRevealScreen
      v-if="currentScreen=='rolesReveal'"
      :players="players"
      :mySeatId="mySeatId"
      @ready="revealReady"
    />
    <CashBuilderScreen 
      v-if="currentScreen=='cashBuilder'"
      :getReadyCooldownMs="getReadyCooldownMs"
      :currentQuestion="currentRoundQuestion"
      :isActiveContestant="isActiveContestant"
      :activeContestantName="activeContestantName"
      :cashBuilderMoney="activeContestantMoney"
      :cashBuilderCorrectAnswers="activeContestantCorrectAnswers"
      @submit-answer="submitAnswer"
    />
    <OfferScreen
      v-if="currentScreen=='offer'"
      :offer="currentOffer"
      :mySeatId="mySeatId"
      :players="players"
      @choose="chooseOffer"
    />
    <ChaseScreen
      v-if="currentScreen=='chase'"
      :players="players"
      :activeContestantSeatId="activeContestantSeatId"
      :chaserSeatId="chaserSeatId"
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
  </div>
</template>