<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
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
    teamPot: { type: Number, default: 0 },
    players: { type: Array, default: () => [] },
    mySeatId: { type: String, default: "" },
    chaserSeatId: { type: String, default: "" },
    finalQuestion: { type: Object, default: null },
    finalBuzzSeatId: { type: String, default: "" },
    answerResult: { type: Object, default: null }
});
const emit = defineEmits(["buzz-in", "submit-final-answer"]);

// Mirrors OfferScreen/CashBuilderScreen's layered-face composition, keyed off
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

// Mirrors server/src/gameConfig.ts FINAL_ROUND.teamDurationMs — duplicated
// client-side the same way GamePhase is (see AGENTS.md gotchas): no shared
// module between the two npm projects, and the server doesn't broadcast a
// remaining-time message, so this is a local approximation of the countdown.
const TEAM_FINAL_SECONDS = 120;
const secondsLeft = ref(TEAM_FINAL_SECONDS);
let countdownInterval = null;

onMounted(() => {
    countdownInterval = setInterval(() => {
        if (secondsLeft.value > 0) secondsLeft.value -= 1;
    }, 1000);
    document.addEventListener("keydown", handleSpace);
});

onUnmounted(() => {
    clearInterval(countdownInterval);
    document.removeEventListener("keydown", handleSpace);
    clearBubble();
});

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const teamPlayers = computed(() => props.players.filter((p) => p.seatId !== props.chaserSeatId));

// Mirrors ChaserFinalScreen's target row: one box per point of teamScore,
// filled by chaserScore. During the team's own section chaserScore is still
// 0, so it renders as the empty target the team is filling as they answer
// correctly.
const targetBoxes = computed(() =>
    Array.from({ length: Math.max(props.teamScore, 1) }, (_, i) => ({
        index: i + 1,
        filled: i + 1 <= props.chaserScore
    }))
);

const isBuzzWinner = computed(() => props.finalBuzzSeatId !== "" && props.finalBuzzSeatId === props.mySeatId);
const buzzWinnerName = computed(
    () => teamPlayers.value.find((p) => p.seatId === props.finalBuzzSeatId)?.name ?? "A teammate"
);
const potText = computed(() => "$" + props.teamPot.toLocaleString("en-US"));

const answerInput = ref("");
const inputBox = ref(null);
const revealedCorrectAnswer = ref("");
// Only the buzz winner's own client ever learns the typed text (the server
// sends `submitFinalAnswer` results to the submitter only, same as the cash
// builder) — so the bubble only ever pops up over your own seat.
//
// Ticket 099: on a correct answer the server's advanceFinalTeamQuestion()
// fires immediately, so the next `finalQuestion` can arrive within the same
// tick as the submission — clearing the bubble from that watch (as it used
// to) let it flash for ~0ms. A local minimum-life timer, independent of
// finalQuestion, guarantees it stays readable. Mirrors ChaserFinalScreen's
// chaserAnswerBubbleText/answerBubbleTimeout pattern from ticket 098.
const ANSWER_BUBBLE_HOLD_MS = 3000;
const bubbleText = ref("");
const bubbleKey = ref(0);
let bubbleTimeout = null;

function clearBubble() {
    if (bubbleTimeout) {
        clearTimeout(bubbleTimeout);
        bubbleTimeout = null;
    }
    bubbleText.value = "";
}

const buzzOpen = computed(
    () => props.finalQuestion !== null && props.finalBuzzSeatId === "" && !revealedCorrectAnswer.value
);
const canBuzz = computed(() => !isChaser.value && buzzOpen.value);

function buzz() {
    if (!canBuzz.value || !props.finalQuestion) return;
    emit("buzz-in", { questionId: props.finalQuestion.questionId });
}

function submit() {
    if (!isBuzzWinner.value || !props.finalQuestion || revealedCorrectAnswer.value) return;
    const trimmed = answerInput.value.trim();
    if (!trimmed) return;
    emit("submit-final-answer", { answer: trimmed, questionId: props.finalQuestion.questionId });
    bubbleText.value = trimmed;
    bubbleKey.value += 1;
    // Restart the min-life timer on every submission so a same-seat resubmit
    // (e.g. a rapid double-submit) re-keys and holds cleanly instead of
    // accumulating overlapping timeouts.
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(clearBubble, ANSWER_BUBBLE_HOLD_MS);
    answerInput.value = "";
}

function handleSpace(e) {
    if (e.code !== "Space" && e.key !== " ") return;
    if (document.activeElement === inputBox.value) return;
    if (!canBuzz.value) return;
    e.preventDefault();
    buzz();
}

watch(() => props.finalQuestion, () => {
    revealedCorrectAnswer.value = "";
    answerInput.value = "";
    // bubbleText is intentionally NOT cleared here (ticket 099) — it has its
    // own minimum-life timer above, independent of when the next question
    // arrives.
});

watch(() => props.answerResult, (result) => {
    if (!result || !isBuzzWinner.value) return;
    // A correct answer ticks teamScore via synced state and the next question
    // follows immediately — nothing to hold here. A wrong answer holds the
    // reveal until the server's next finalQuestion clears it above.
    if (!result.correct) revealedCorrectAnswer.value = result.correctAnswer;
});

watch(isBuzzWinner, (winner) => {
    if (winner) nextTick(() => inputBox.value?.focus());
});
</script>

<template>
  <div class="teamFinalRoot">
    <h2 class="lobbyTitle">The Team Final</h2>
    <p class="playerName teamFinalScore">Time left: {{ secondsLeft }}s · Team score: {{ teamScore }}</p>

    <div class="finalTargetRow">
      <div
          v-for="box in targetBoxes"
          :key="box.index"
          class="finalTargetBox"
          :class="{ 'finalTargetBox-filled': box.filled }"
      >{{ box.index }}</div>
    </div>

    <div v-if="isChaser" class="teamFinalQuestionArea">
      <p class="playerName">Chaser, your round is next — you're up after the team.</p>
    </div>

    <div v-else class="teamFinalQuestionArea" :class="{ 'teamFinalQuestionArea-wrong': revealedCorrectAnswer }">
      <template v-if="revealedCorrectAnswer">
        <span class="teamFinalRevealLabel">✗ WRONG!</span>
        <p class="teamFinalRevealAnswer">The answer was <strong>{{ revealedCorrectAnswer }}</strong></p>
      </template>
      <template v-else-if="finalQuestion">
        <p class="teamFinalQuestion">{{ finalQuestion.prompt }}</p>

        <button
            v-if="!isBuzzWinner && finalBuzzSeatId === ''"
            class="startButton teamFinalBuzzButton"
            @click="buzz"
        >Buzz in!</button>

        <p v-else-if="!isBuzzWinner" class="playerName">{{ buzzWinnerName }} is answering…</p>

        <input
            v-else
            v-model="answerInput"
            class="teamFinalInput"
            placeholder="Type your answer..."
            ref="inputBox"
            @keyup.enter="submit"
        />
      </template>
      <p v-else class="playerName">Waiting for the first question…</p>
    </div>

    <div class="teamFinalTable">
      <div class="teamFinalPlayers">
        <div
            v-for="p in teamPlayers"
            :key="p.seatId"
            class="teamFinalPlayer"
            :class="{ 'teamFinalPlayer-eliminated': p.isEliminated }"
        >
          <div
              class="teamFinalPlayerGlow"
              :class="{ 'teamFinalPlayerGlow-active': p.seatId === finalBuzzSeatId }"
          ></div>
          <Transition name="chaser-bubble-pop">
            <div
                v-if="p.seatId === mySeatId && bubbleText"
                :key="bubbleKey"
                class="chaserPanelBubble teamFinalBubble"
            >{{ bubbleText }}</div>
          </Transition>
          <p class="playerName teamFinalPlayerName">{{ p.name }}</p>
          <div class="teamFinalAvatarWrap">
            <div class="offerFaceWrap">
              <div class="offerShoulders"></div>
              <img :src="faceFor(p.seatId)" class="offerFaceLayer" alt="" />
              <img :src="hairFor(p.seatId)" class="offerFaceLayer" alt="" />
              <img :src="eyesFor(p.seatId)" class="offerFaceLayer" alt="" />
              <img :src="mouthNeutral" class="offerFaceLayer" alt="" />
            </div>
          </div>
        </div>
      </div>
      <div class="teamFinalPotBox">
        <span class="teamFinalPotAmount">{{ potText }}</span>
      </div>
    </div>
  </div>
</template>
