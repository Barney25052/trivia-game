<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";
import face1 from "../assets/images/face-1.png";
import face2 from "../assets/images/face-2.png";
import face3 from "../assets/images/face-3.png";
import hair1 from "../assets/images/hair-1.png";
import hair2 from "../assets/images/hair-2.png";
import hair3 from "../assets/images/hair-3.png";
import hair4 from "../assets/images/hair-4.png";
import hair5 from "../assets/images/hair-5.png";
import hair6 from "../assets/images/hair-6.png";
import eyesNeutral1 from "../assets/images/eyes-1.png";
import eyesNeutral2 from "../assets/images/eyes-2.png";
import mouthNeutral from "../assets/images/mouth.png";

const props = defineProps({
    teamScore: { type: Number, default: 0 },
    chaserScore: { type: Number, default: 0 },
    mySeatId: { type: String, default: "" },
    chaserSeatId: { type: String, default: "" },
    chaserCharacterId: { type: String, default: "" },
    chaserQuipText: { type: String, default: "" },
    chaserQuipKey: { type: Number, default: 0 },
    players: { type: Array, default: () => [] },
    finalQuestion: { type: Object, default: null },
    finalSteal: { type: Object, default: null },
    finalStealResolved: { type: Object, default: null },
    answerResult: { type: Object, default: null }
});
const emit = defineEmits(["submit-final-chaser-answer", "submit-final-steal-answer", "auto-quip", "send-quip"]);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const teamPlayers = computed(() => props.players.filter((p) => p.seatId !== props.chaserSeatId));

// Mirrors OfferScreen/TeamFinalScreen's layered-face composition, keyed off
// seat id so the same player shows the same face across screens.
const faceImages = [face1, face2, face3];
const hairImages = [hair1, hair2, hair3, hair4, hair5, hair6];
const neutralEyesImages = [eyesNeutral1, eyesNeutral2];

function seatSeed(text) {
    let hash = 0;
    for (const char of text) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return hash;
}
function faceFor(seatId) {
    return faceImages[seatSeed(seatId) % faceImages.length];
}
function hairFor(seatId) {
    return hairImages[seatSeed(`${seatId}-hair`) % hairImages.length];
}
function eyesFor(seatId) {
    return neutralEyesImages[seatSeed(`${seatId}-eyes`) % neutralEyesImages.length];
}

// Mirrors server/src/gameConfig.ts FINAL_ROUND.chaserDurationMs — duplicated
// client-side the same way GamePhase is (see AGENTS.md gotchas): no shared
// module between the two npm projects, and the server doesn't broadcast a
// remaining-time message, so this is a local approximation of the countdown.
const CHASER_FINAL_SECONDS = 120;
const STEAL_RESULT_HOLD_MS = 2500;
const secondsLeft = ref(CHASER_FINAL_SECONDS);
let countdownInterval = null;

const START_QUIPS = [
    "Let's finish this.",
    "One shot at glory.",
    "Time to seal it."
];

onMounted(() => {
    countdownInterval = setInterval(() => {
        if (secondsLeft.value > 0) secondsLeft.value -= 1;
    }, 1000);
    emit("auto-quip", START_QUIPS[Math.floor(Math.random() * START_QUIPS.length)]);
});

onUnmounted(() => {
    clearInterval(countdownInterval);
    stopStealTicker();
    if (closeTimeout) clearTimeout(closeTimeout);
});

// The target row always spans the full width, one box per point the team
// needs to survive — it grows if a steal raises the target mid-round.
const targetBoxes = computed(() =>
    Array.from({ length: Math.max(props.teamScore, 1) }, (_, i) => ({
        index: i + 1,
        filled: i + 1 <= props.chaserScore
    }))
);

const chaserAnswerInput = ref("");
const chaserInputBox = ref(null);
// The Chaser gets no `finalSteal`/`finalStealResolved` messages (those are
// team-only) — all they know is their own answer came back wrong, so they
// wait here until the next finalQuestion arrives (steal won or lost).
const chaserWaitingForSteal = ref(false);

watch(() => props.finalQuestion, () => {
    chaserAnswerInput.value = "";
    chaserWaitingForSteal.value = false;
});

watch(() => props.answerResult, (result) => {
    if (!result || !isChaser.value) return;
    if (!result.correct) chaserWaitingForSteal.value = true;
});

function submitChaserAnswer() {
    if (!isChaser.value || !props.finalQuestion || chaserWaitingForSteal.value) return;
    const trimmed = chaserAnswerInput.value.trim();
    if (!trimmed) return;
    emit("submit-final-chaser-answer", { answer: trimmed, questionId: props.finalQuestion.questionId });
}

// The steal window countdown is driven by the server's windowMs off the
// moment finalSteal arrived — mirrors ChaseScreen's chaseLockout ticker.
const nowTick = ref(0);
let stealTicker = null;
let closeTimeout = null;

function stopStealTicker() {
    if (stealTicker) {
        clearInterval(stealTicker);
        stealTicker = null;
    }
}
function startStealTicker() {
    stopStealTicker();
    nowTick.value = Date.now();
    stealTicker = setInterval(() => {
        nowTick.value = Date.now();
    }, 250);
}

const stealWindowEndsAt = computed(() =>
    props.finalSteal ? props.finalSteal.startedAt + props.finalSteal.windowMs : 0
);
// Closes the steal prompt locally once its window has run out — the server
// never tells non-submitting team clients the window expired unclaimed, only
// that a correct steal happened (finalStealResolved), so this local clock is
// the only signal they get for "nobody answered in time".
const manuallyClosed = ref(false);
const stealActive = computed(() => props.finalSteal !== null && !manuallyClosed.value);
const stealSecondsLeft = computed(() =>
    stealActive.value ? Math.max(0, Math.ceil((stealWindowEndsAt.value - nowTick.value) / 1000)) : 0
);

const stealAnswerInput = ref("");
const stealInputBox = ref(null);
const stealLocked = ref(false);
const stealOutcomeText = ref("");

watch(() => props.finalSteal, (steal) => {
    if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
    }
    if (steal) {
        manuallyClosed.value = false;
        stealAnswerInput.value = "";
        stealLocked.value = false;
        stealOutcomeText.value = "";
        startStealTicker();
        nextTick(() => stealInputBox.value?.focus());
        closeTimeout = setTimeout(() => {
            manuallyClosed.value = true;
        }, steal.windowMs + 500);
    } else {
        stopStealTicker();
    }
});

watch(() => props.finalStealResolved, (result) => {
    if (!result) return;
    stealLocked.value = true;
    stealOutcomeText.value = result.pushedBack
        ? "Stolen! The Chaser is pushed back."
        : "Correct! The Chaser was already at zero — the target goes up.";
    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeout = setTimeout(() => {
        manuallyClosed.value = true;
    }, STEAL_RESULT_HOLD_MS);
});

watch(() => props.answerResult, (result) => {
    if (!result || isChaser.value || stealLocked.value) return;
    // Only the team member who submitted the steal answer gets this — a
    // correct one is immediately followed by finalStealResolved above, so
    // only render the wrong case here.
    if (!result.correct) {
        stealLocked.value = true;
        stealOutcomeText.value = `Wrong — the answer was ${result.correctAnswer}`;
        if (closeTimeout) clearTimeout(closeTimeout);
        closeTimeout = setTimeout(() => {
            manuallyClosed.value = true;
        }, STEAL_RESULT_HOLD_MS);
    }
});

function submitSteal() {
    if (isChaser.value || !stealActive.value || stealLocked.value || !props.finalSteal) return;
    const trimmed = stealAnswerInput.value.trim();
    if (!trimmed) return;
    emit("submit-final-steal-answer", { answer: trimmed, questionId: props.finalSteal.questionId });
    stealLocked.value = true;
}
</script>

<template>
  <div class="chaserFinalRoot">
    <h2 class="lobbyTitle chaserFinalTitle">The Chaser Final</h2>
    <p class="playerName chaserFinalScore">
      Time left: {{ secondsLeft }}s · Chaser {{ chaserScore }} — Target {{ teamScore }}
    </p>

    <div class="chaserFinalTop">
      <div v-if="stealActive" class="chaserFinalStealQuestion">
        <span class="teamFinalRevealLabel">STEAL!</span>
        <p class="teamFinalQuestion">{{ finalSteal.prompt }}</p>
      </div>
      <ChaserPanel
          v-else
          :character-id="chaserCharacterId"
          :quip-text="chaserQuipText"
          :quip-key="chaserQuipKey"
          :is-chaser="isChaser"
          @send-quip="emit('send-quip', $event)"
      />
    </div>

    <div class="chaserFinalTargetRow">
      <div
          v-for="box in targetBoxes"
          :key="box.index"
          class="chaserFinalTargetBox"
          :class="{ 'chaserFinalTargetBox-filled': box.filled }"
      >{{ box.index }}</div>
    </div>

    <div v-if="stealActive" class="chaseLockoutFlash"></div>

    <div class="chaserFinalBottom">
      <template v-if="isChaser">
        <template v-if="finalQuestion">
          <template v-if="!chaserWaitingForSteal">
            <p class="teamFinalQuestion">{{ finalQuestion.prompt }}</p>
            <input
                v-model="chaserAnswerInput"
                class="teamFinalInput"
                placeholder="Type your answer..."
                ref="chaserInputBox"
                @keyup.enter="submitChaserAnswer"
            />
          </template>
          <p v-else class="playerName">Wrong! Waiting to see if the team steals…</p>
        </template>
        <p v-else class="playerName">Waiting for the first question…</p>
      </template>

      <template v-else-if="stealActive">
        <div class="chaserFinalTeamRow">
          <div v-for="p in teamPlayers" :key="p.seatId" class="teamFinalPlayer">
            <div class="teamFinalAvatarWrap">
              <div class="offerFaceWrap">
                <div class="offerShoulders"></div>
                <img :src="faceFor(p.seatId)" class="offerFaceLayer" alt="" />
                <img :src="hairFor(p.seatId)" class="offerFaceLayer" alt="" />
                <img :src="eyesFor(p.seatId)" class="offerFaceLayer" alt="" />
                <img :src="mouthNeutral" class="offerFaceLayer" alt="" />
              </div>
            </div>
            <p class="playerName teamFinalPlayerName">{{ p.name }}</p>
          </div>
        </div>
        <p class="playerName">Steal! {{ stealSecondsLeft }}s left</p>
        <p v-if="stealOutcomeText" class="playerName">{{ stealOutcomeText }}</p>
        <input
            v-else
            v-model="stealAnswerInput"
            class="teamFinalInput"
            placeholder="Type your answer..."
            :disabled="stealLocked"
            ref="stealInputBox"
            @keyup.enter="submitSteal"
        />
      </template>

      <template v-else>
        <p class="playerName">The Chaser is answering…</p>
      </template>
    </div>
  </div>
</template>
