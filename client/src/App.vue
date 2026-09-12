<script setup>
import { ref, computed } from "vue";
import { Client } from "@colyseus/sdk";
import { GamePhase } from "./TriviaTypes.ts";
import { preloadImages } from "./assetPreload.js";
import HomeScreen from "./screens/HomeScreen.vue"
import LobbyScreen from "./screens/LobbyScreen.vue";
import ChaserSelectionScreen from "./screens/ChaserSelectionScreen.vue";
import ChaserWheelScreen from "./screens/ChaserWheelScreen.vue";
import ChaserCharacterRevealScreen from "./screens/ChaserCharacterRevealScreen.vue";
import RolesRevealScreen from "./screens/RolesRevealScreen.vue";
import ContestantLineupScreen from "./screens/ContestantLineupScreen.vue";
import CashBuilderScreen from "./screens/CashBuilderScreen.vue";
import OfferScreen from "./screens/OfferScreen.vue";
import ChaseScreen from "./screens/ChaseScreen.vue";
import TeamFinalScreen from "./screens/TeamFinalScreen.vue";
import ChaserFinalScreen from "./screens/ChaserFinalScreen.vue";
import ResultsScreen from "./screens/ResultsScreen.vue";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

preloadImages();

const room = ref(null);
const playersMap = ref(null);
const players = ref([]);
const currentPhase = ref(null);
const chaserSelectionMode = ref("");
const activeContestantSeatId = ref("");
const chaserSeatId = ref("");
const mySeatId = ref("");
const contestantsOrder = ref([]);
const teamScore = ref(0);
const chaserPot = ref(0);
const teamPot = ref(0);
const currentOffer = ref(null);
const winner = ref(null);
const getReadyCooldownMs = ref(0);
const currentQuestion = ref(null);
const answerResult = ref(null);
const revealChaserCharacterId = ref("");
const revealChaserCharacterName = ref("");
const chaserQuipText = ref("");
const chaserQuipKey = ref(0);
let chaserQuipClearTimeout = null;
const CHASER_QUIP_DISPLAY_MS = 6000;
const chaseWagerAmount = ref(0);
const chaseQuestionResult = ref(null);
const chaseOutcome = ref(null);
const chaseLockout = ref(null);
// A frozen {activeContestantSeatId, chaserSeatId, players} snapshot shown on
// the Chase screen during the result hold below — server state moves on to
// the next contestant (or clears) in the same dispatch as chaseEscape/
// chaseCaught, so the live refs can't be trusted for the duration of the hold.
const chaseFreeze = ref(null);
// The server sends chaseQuestionResult then, in the same tick, the phase
// change that would otherwise rip the Chase screen away before a catch/escape
// banner can show — so a terminal result holds the phase change for a beat.
// currentPhase is driven both by the synced state (onStateChange) and by the
// "phase" message, so both paths route through setPhaseFromServer to honor the hold.
const CHASE_RESULT_HOLD_MS = 2500;
let chaseResultHoldTimeout = null;
let pendingPhase = null;

const currentScreen = computed(() => {
  if (!room.value) return "home";
  switch (currentPhase.value) {
    case GamePhase.Lobby: return "lobby";
    case GamePhase.ChaserSelection: return "chaserSelection";
    case GamePhase.ChaserReveal: return "chaserReveal";
    case GamePhase.RolesReveal: return "rolesReveal";
    case GamePhase.Lineup: return "lineup";
    case GamePhase.CashBuilder: return "cashBuilder";
    case GamePhase.ChaserCharacterReveal: return "chaserCharacterReveal";
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
const chaserCharacterId = computed(() => playersMap.value?.get(chaserSeatId.value)?.chaserCharacterId ?? "");

// These read cashBuilderMoney/cashBuilderCorrectAnswers directly off players.value
// (rather than through an intermediate `activeContestant` computed) because the
// active contestant's schema instance keeps the same object identity across state
// patches — only its properties mutate. A computed that depends on that stable
// reference never re-fires, so downstream computeds built on top of it go stale.
// Depending on players.value directly (a fresh array every patch) keeps them live.
const activeContestantName = computed(
    () => players.value.find((p) => p.seatId === activeContestantSeatId.value)?.name ?? ""
);
const activeContestantMoney = computed(
    () => players.value.find((p) => p.seatId === activeContestantSeatId.value)?.cashBuilderMoney ?? 0
);
const activeContestantCorrectAnswers = computed(
    () => players.value.find((p) => p.seatId === activeContestantSeatId.value)?.cashBuilderCorrectAnswers ?? 0
);
const isActiveContestant = computed(
    () => activeContestantSeatId.value !== "" && mySeatId.value === activeContestantSeatId.value
);
const currentRoundQuestion = computed(() => {
    if (!currentQuestion.value) return null;
    // Cash-builder open questions are targeted at one seat and stay hidden from
    // everyone else. Chase MC questions are answered by both the active
    // contestant and the Chaser (and are safe to show spectators too) — the
    // server never includes correctIndex before resolution either way — so
    // they aren't filtered by targetSeatId (ticket 065, TO_REVIEW.md item 13).
    if (currentQuestion.value.kind === "mc") return currentQuestion.value;
    if (currentQuestion.value.targetSeatId !== activeContestantSeatId.value) return null;
    return currentQuestion.value;
});
const lineupContestants = computed(() =>
    contestantsOrder.value
        .map((seatId) => players.value.find((p) => p.seatId === seatId))
        .filter(Boolean)
);

function applyPhase(phase) {
  currentPhase.value = phase;
  if (phase !== GamePhase.CashBuilder) {
    getReadyCooldownMs.value = 0;
    answerResult.value = null;
  }
  if (phase !== GamePhase.Offer) {
    currentOffer.value = null;
  }
  if (phase !== GamePhase.Chase) {
    chaseLockout.value = null;
  }
}

function setPhaseFromServer(phase) {
  if (chaseResultHoldTimeout) {
    // A catch/escape banner is still showing — apply this phase change once
    // the hold clears instead of cutting the banner off.
    pendingPhase = phase;
    return;
  }
  applyPhase(phase);
}

function showChaserQuip(text) {
  if (!text) return;
  chaserQuipText.value = text;
  chaserQuipKey.value += 1;
  if (chaserQuipClearTimeout) clearTimeout(chaserQuipClearTimeout);
  chaserQuipClearTimeout = setTimeout(() => {
    chaserQuipText.value = "";
  }, CHASER_QUIP_DISPLAY_MS);
}

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
      setPhaseFromServer(newState.currentPhase);
      playersMap.value = newState.players;
      players.value = Array.from(newState.players.values());
      chaserSelectionMode.value = newState.chaserSelectionMode;
      activeContestantSeatId.value = newState.activeContestantSeatId;
      chaserSeatId.value = newState.chaserSeatId;
      teamScore.value = newState.teamScore;
      chaserPot.value = newState.chaserPot;
      teamPot.value = newState.teamPot;
      contestantsOrder.value = Array.from(newState.contestantsOrder);
      chaseWagerAmount.value = newState.chaseWagerAmount;
    });

    room.value.onMessage("seatId", (message) => {
      mySeatId.value = message.seatId;
    });

    room.value.onMessage("phase", (message) => {
      setPhaseFromServer(message.phase);
    });

    room.value.onMessage("question", (message) => {
      currentQuestion.value = message;
      chaseQuestionResult.value = null;
      chaseLockout.value = null;
    });

    room.value.onMessage("chaseLockoutStarted", (message) => {
      chaseLockout.value = {
        questionId: message.questionId,
        windowMs: message.windowMs,
        startedAt: Date.now()
      };
    });

    room.value.onMessage("answerResult", (message) => {
      answerResult.value = message;
    });

    room.value.onMessage("chaseQuestionResult", (message) => {
      chaseQuestionResult.value = message;
      const escaped = message.contestantBoardPos !== null && message.contestantBoardPos <= 0;
      const caught = !escaped
          && message.chaserBoardPos !== null
          && message.contestantBoardPos !== null
          && message.chaserBoardPos <= message.contestantBoardPos;
      if (!escaped && !caught) return;

      // Freeze the board as it looked at the moment of the result — state may
      // already have moved on to the next contestant by the time the hold
      // below clears (startCashBuilder for the next contestant fires in the
      // same server-side dispatch as chaseEscape/chaseCaught).
      chaseFreeze.value = {
        activeContestantSeatId: activeContestantSeatId.value,
        chaserSeatId: chaserSeatId.value,
        players: players.value.map((p) => ({ seatId: p.seatId, name: p.name, boardPos: p.boardPos }))
      };
      chaseOutcome.value = escaped ? "escaped" : "caught";
      if (chaseResultHoldTimeout) clearTimeout(chaseResultHoldTimeout);
      chaseResultHoldTimeout = setTimeout(() => {
        chaseResultHoldTimeout = null;
        chaseOutcome.value = null;
        chaseQuestionResult.value = null;
        chaseFreeze.value = null;
        if (pendingPhase !== null) {
          applyPhase(pendingPhase);
          pendingPhase = null;
        }
      }, CHASE_RESULT_HOLD_MS);
    });

    room.value.onMessage("chaserQuip", (message) => {
      showChaserQuip(message.text);
    });

    room.value.onMessage("chaserCharacterReveal", (message) => {
      revealChaserCharacterId.value = message.chaserCharacterId;
      revealChaserCharacterName.value = message.chaserCharacterName;
    });

    room.value.onMessage("offerStart", (message) => {
      currentOffer.value = {
        seatId: message.seatId,
        middle: message.middle,
        low: message.low,
        high: null,
        chaserCharacterId: message.chaserCharacterId,
        chaserCharacterName: message.chaserCharacterName,
        chaserCharacterAbility: message.chaserCharacterAbility
      };
      showChaserQuip(message.quip);
    });

    room.value.onMessage("offerLowSet", (message) => {
      if (currentOffer.value?.seatId !== message.seatId) return;
      currentOffer.value = { ...currentOffer.value, low: message.low };
      showChaserQuip(message.quip);
    });

    room.value.onMessage("offer", (message) => {
      currentOffer.value = {
        seatId: message.seatId,
        middle: message.offers.middle,
        low: message.offers.low,
        high: message.offers.high,
        chaserCharacterId: message.chaserCharacterId,
        chaserCharacterName: message.chaserCharacterName,
        chaserCharacterAbility: message.chaserCharacterAbility
      };
      showChaserQuip(message.quip);
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

function setChaserLowOffer(amount) {
  try {
    room.value?.send("setChaserLowOffer", { amount });

  } catch (e) {
    console.error("Failed to set the low offer:", e);
  }
}

function setChaserHighOffer(amount) {
  try {
    room.value?.send("setChaserHighOffer", { amount });

  } catch (e) {
    console.error("Failed to set the high offer:", e);
  }
}

function sendChaseAnswer({ answerIndex, questionId }) {
  try {
    room.value?.send("submitChaseAnswer", { answerIndex, questionId });

  } catch (e) {
    console.error("Failed to submit chase answer:", e);
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
  if (chaseResultHoldTimeout) {
    clearTimeout(chaseResultHoldTimeout);
    chaseResultHoldTimeout = null;
  }
  pendingPhase = null;
  chaseOutcome.value = null;
  chaseFreeze.value = null;
  chaseLockout.value = null;
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

function sendChaserQuip(text) {
  try {
    room.value?.send("sendChaserQuip", { text });

  } catch (e) {
    console.error("Failed to send chaser quip:", e);
  }
}
</script>

<template>
  <div class="app">
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
    <ContestantLineupScreen
      v-if="currentScreen=='lineup'"
      :contestants="lineupContestants"
      :mySeatId="mySeatId"
    />
    <CashBuilderScreen 
      v-if="currentScreen=='cashBuilder'"
      :getReadyCooldownMs="getReadyCooldownMs"
      :currentQuestion="currentRoundQuestion"
      :isActiveContestant="isActiveContestant"
      :activeContestantName="activeContestantName"
      :cashBuilderMoney="activeContestantMoney"
      :cashBuilderCorrectAnswers="activeContestantCorrectAnswers"
      :answerResult="answerResult"
      @submit-answer="submitAnswer"
    />
    <ChaserCharacterRevealScreen
      v-if="currentScreen=='chaserCharacterReveal'"
      :chaserCharacterId="revealChaserCharacterId"
      :chaserCharacterName="revealChaserCharacterName"
    />
    <OfferScreen
      v-if="currentScreen=='offer'"
      :offer="currentOffer"
      :mySeatId="mySeatId"
      :players="players"
      :chaserSeatId="chaserSeatId"
      :chaserCharacterId="chaserCharacterId"
      :chaserQuipText="chaserQuipText"
      :chaserQuipKey="chaserQuipKey"
      :chaserPot="chaserPot"
      :teamPot="teamPot"
      @choose="chooseOffer"
      @setLow="setChaserLowOffer"
      @setHigh="setChaserHighOffer"
      @auto-quip="showChaserQuip"
      @send-quip="sendChaserQuip"
    />
    <ChaseScreen
      v-if="currentScreen=='chase'"
      :players="chaseFreeze ? chaseFreeze.players : players"
      :activeContestantSeatId="chaseFreeze ? chaseFreeze.activeContestantSeatId : activeContestantSeatId"
      :chaserSeatId="chaseFreeze ? chaseFreeze.chaserSeatId : chaserSeatId"
      :mySeatId="mySeatId"
      :chaserCharacterId="chaserCharacterId"
      :chaserQuipText="chaserQuipText"
      :chaserQuipKey="chaserQuipKey"
      :currentQuestion="currentRoundQuestion"
      :chaseQuestionResult="chaseQuestionResult"
      :chaseOutcome="chaseOutcome"
      :chaseLockout="chaseLockout"
      :chaseWagerAmount="chaseWagerAmount"
      @submit-chase-answer="sendChaseAnswer"
      @auto-quip="showChaserQuip"
      @send-quip="sendChaserQuip"
    />
    <TeamFinalScreen
      v-if="currentScreen=='teamFinal'"
      :teamScore="teamScore"
    />
    <ChaserFinalScreen
      v-if="currentScreen=='chaserFinal'"
      :teamScore="teamScore"
      :mySeatId="mySeatId"
      :chaserSeatId="chaserSeatId"
      :chaserCharacterId="chaserCharacterId"
      :chaserQuipText="chaserQuipText"
      :chaserQuipKey="chaserQuipKey"
      @chaserReached="chaserReachedScore"
      @auto-quip="showChaserQuip"
      @send-quip="sendChaserQuip"
    />
    <ResultsScreen
      v-if="currentScreen=='gameEnd'"
      :winner="winner"
      :players="players"
      @leave="handleLeave"
    />
  </div>
</template>