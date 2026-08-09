<script setup>
import { ref, computed} from "vue";
import { Client } from "@colyseus/sdk";
import { GamePhase } from "./TriviaTypes.ts";
import HomeScreen from "./screens/HomeScreen.vue"
import LobbyScreen from "./screens/LobbyScreen.vue";
import QuestionScreen from "./screens/QuestionScreen.vue";
import ResultsScreen from "./screens/ResultsScreen.vue";

// Change this to your deployed server URL later
const SERVER_URL = "ws://localhost:2567";

const room = ref(null);      
const playersMap = ref(null);   
const players = ref([]);
const answeredMap = ref([]);
const currentPhase = ref(null)
const currentQuestion = ref(null);

const currentState = computed(() => {
  if (!room.value) return "home";
  switch (currentPhase.value) {
    case GamePhase.Lobby: return "lobby";
    case GamePhase.Question: return "question";
    case GamePhase.Answer: return "answer";
    case GamePhase.GameEnd: return "gameend";
    default: return "home";
  }
});

const myPlayer = computed(() => playersMap.value?.get(room.value?.sessionId));
const isHost = computed(() => myPlayer.value?.isHost === true);
const haveIAnswered = computed(() => answeredMap.value?.[room.value?.sessionId] === true)

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

    room.value.onStateChange((newState) => {
      console.log("State changed", newState.currentState);
      currentPhase.value = newState.currentState;
      playersMap.value = newState.players;
      players.value = Array.from(newState.players.values());
      answeredMap.value = newState.answered ? Object.fromEntries(newState.answered.entries()) : {};
    });

    room.value.onLeave(() => {
      room.value = null;
    });

    room.value.onMessage("question", (message) => {
      console.log("message received")
      currentQuestion.value = message
    })

  } catch (e) {
    console.error("Failed to join:", e);
  }
}

async function startQuiz() {
  try {
    room.value?.send("startGame", {});

  } catch (e) {
    console.error("Failed to start:", e);
  }
}

async function nextQuestion() {
  try {
    console.log("To the next!");
    room.value?.send("nextQuestion", {});
  } catch (e) {
    console.error("Failed to go to next question:", e);
  }
}

function submitAnswer(index) {
  console.log("INDEX:", index)
  room.value?.send("answer", {optionIndex: index})
}

function handleLeave() {
  room.value?.leave()
  room.value = null
}
</script>

<template>
  <div class="app">
    <h1>Trivia Lobby</h1>
    <h1>{{ currentState }}</h1>

    <HomeScreen v-if="currentState=='home'" @join="handleJoin" @create="handleJoin"/>
    <LobbyScreen 
      v-if="currentState=='lobby'" 
      @startQuiz="startQuiz"
      :players="players"
      :isHost="isHost"
      :room = "room"
    />
    <QuestionScreen 
      v-if="currentState=='question'"
      @answerSubmitted="submitAnswer"
      :myPlayer="myPlayer"
      :currentQuestion="currentQuestion"
      :haveIAnswered="haveIAnswered"
    />
    <ResultsScreen
      v-if="currentState=='answer'"
      @nextQuestion="nextQuestion"
      :isHost = "isHost"
    />
    <div v-if="currentState=='gameend'">
      <h4 v-for="(player, index) in players" :key="index">{{ player.name }} - {{ player.score }}</h4>
      <button @click="handleLeave">Main Menu</button>
    </div>
  </div>
</template>

<style scoped>
.app {
  max-width: 400px;
  margin: 60px auto;
  font-family: sans-serif;
}
input {
  padding: 8px;
  margin-right: 8px;
}
button {
  padding: 8px 16px;
}
li {
  margin: 6px 0;
}
</style>