<script setup>
import { ref, computed} from "vue";
import { Client } from "@colyseus/sdk";
import HomeScreen from "./screens/HomeScreen.vue"

// Change this to your deployed server URL later
const SERVER_URL = "ws://localhost:2567";

const room = ref(null);      
const playersMap = ref(null);   
const players = ref([]) 
const currentQuestion = ref(null);

const myPlayer = computed(() => playersMap.value?.get(room.value?.sessionId));
const isHost = computed(() => myPlayer.value?.isHost === true);

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

    room.value.onStateChange((state) => {
      playersMap.value = state.players;
      players.value = Array.from(state.players.values());
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
</script>

<template>
  <div class="app">
    <h1>Trivia Lobby</h1>

    <!-- Join screen: shown until we have a room -->
    <HomeScreen v-if="!room" @join="handleJoin" @create="handleJoin"/>

    <!-- Lobby screen: shown once we're connected -->
    <div v-else class="lobby-screen">
      <div v-if="currentQuestion">
        <h2>{{currentQuestion.question}}</h2>
        <h2>{{currentQuestion.a1}}</h2>
        <h2>{{currentQuestion.a2}}</h2>
        <h2>{{currentQuestion.a3}}</h2>
        <h2>{{currentQuestion.a4}}</h2>
      </div>
      <div v-else>
        <h3>Room Code: {{room.roomId}}</h3>
        <h2>Players</h2>
        <ul>
          <li v-for="player in players" :key="player.name">
            {{ player.name }}
          </li>
        </ul>
        <button v-if="isHost" @click="startQuiz">Start Quiz</button>
      </div>
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