<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps({
    teamScore: { type: Number, default: 0 },
    teamPot: { type: Number, default: 0 },
    players: { type: Array, default: () => [] },
    mySeatId: { type: String, default: "" },
    chaserSeatId: { type: String, default: "" },
    finalQuestion: { type: Object, default: null },
    finalBuzzSeatId: { type: String, default: "" },
    answerResult: { type: Object, default: null },
    // Per-seat face reaction store (ticket 103): seatId -> expression, see
    // App.vue's reactionsBySeat.
    reactions: { type: Object, default: () => ({}) }
});
const emit = defineEmits(["buzz-in", "submit-final-answer"]);

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
    if (screenFlashTimeout) clearTimeout(screenFlashTimeout);
});

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const teamPlayers = computed(() => props.players.filter((p) => p.seatId !== props.chaserSeatId));

const isBuzzWinner = computed(() => props.finalBuzzSeatId !== "" && props.finalBuzzSeatId === props.mySeatId);
const buzzWinnerName = computed(
    () => teamPlayers.value.find((p) => p.seatId === props.finalBuzzSeatId)?.name ?? "A teammate"
);
const potText = computed(() => "$" + props.teamPot.toLocaleString("en-US"));

// Ticket 118: full-bleed background bars, one per point of teamScore (see
// style.css's .teamFinalTargetBg comment — chaserScore is always 0 here, so
// this only ever grows). Keyed by plain index so Vue's TransitionGroup below
// only plays the rise-in animation for the newly-appended bar, not the ones
// already on screen.
const targetBars = computed(() => Array.from({ length: props.teamScore }, (_, i) => i));

const answerInput = ref("");
const inputBox = ref(null);
const revealedCorrectAnswer = ref("");
// Full-viewport correct/wrong flash (ticket 100) — same shared
// .finalScreenFlash pattern/timing as CashBuilderScreen's screenFlash (see
// style.css). `answerResult` is sent to the buzz winner's own client only
// (server/src/rooms/handlers/messageHandlers.ts submitFinalAnswer uses
// `client.send`, never a broadcast), so a "flash every team client" version
// would need a new server broadcast — out of this ticket's scope — hence
// this flashes only the answering player's own screen.
const screenFlash = ref("");
let screenFlashTimeout = null;
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
    // The wrong-answer flash has no timer of its own — it holds until the
    // next question arrives (mirrors CashBuilderScreen's screenFlash, ticket
    // 100). The correct-answer flash clears itself on its own short timer
    // below instead, since a correct answer's next question can land in the
    // same tick as the flash starting.
    if (screenFlash.value === "finalScreenFlash-wrong") {
        screenFlash.value = "";
    }
    // bubbleText is intentionally NOT cleared here (ticket 099) — it has its
    // own minimum-life timer above, independent of when the next question
    // arrives.
});

watch(() => props.answerResult, (result) => {
    if (!result || !isBuzzWinner.value) return;
    // A correct answer ticks teamScore via synced state and the next question
    // follows immediately — nothing to hold here beyond the brief flash. A
    // wrong answer holds the reveal until the server's next finalQuestion
    // clears it above.
    if (screenFlashTimeout) clearTimeout(screenFlashTimeout);
    if (result.correct) {
        screenFlash.value = "finalScreenFlash-correct";
        screenFlashTimeout = setTimeout(() => {
            screenFlash.value = "";
        }, 700);
    } else {
        revealedCorrectAnswer.value = result.correctAnswer;
        screenFlash.value = "finalScreenFlash-wrong";
    }
});

watch(isBuzzWinner, (winner) => {
    if (winner) nextTick(() => inputBox.value?.focus());
});
</script>

<template>
  <div class="teamFinalRoot">
    <TransitionGroup tag="div" name="team-final-target-bar" class="teamFinalTargetBg" aria-hidden="true">
      <div v-for="i in targetBars" :key="i" class="teamFinalTargetBar"></div>
    </TransitionGroup>
    <div class="finalScreenFlash" :class="screenFlash"></div>

    <h2 class="lobbyTitle">The Team Final</h2>

    <div class="cf-hud">
      <span>TIME LEFT <b>{{ secondsLeft }}s</b></span>
      <span>TEAM SCORE <b>{{ teamScore }}</b></span>
    </div>

    <div v-if="isChaser" class="teamFinalQuestionBlock">
      <p class="playerName">Chaser, your round is next — you're up after the team.</p>
    </div>

    <template v-else>
      <div v-if="revealedCorrectAnswer" class="wrong-panel">
        <span class="wrong-label">✗ WRONG!</span>
        <p class="wrong-answer">The answer was <strong>{{ revealedCorrectAnswer }}</strong></p>
      </div>
      <template v-else-if="finalQuestion">
        <div v-if="isBuzzWinner" class="open-question-box accent-blue">
          <span class="oq-eyebrow">Your answer</span>
          <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
          <div class="oq-row">
            <input
                v-model="answerInput"
                class="oq-input"
                placeholder="Type your answer..."
                ref="inputBox"
                @keyup.enter="submit"
            />
            <button class="oq-submit" @click="submit">Submit</button>
          </div>
        </div>
        <div v-else-if="finalBuzzSeatId === ''" class="teamFinalQuestionBlock">
          <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
          <button class="buzzer-btn" @click="buzz">BUZZ IN</button>
        </div>
        <div v-else class="open-question-box">
          <span class="oq-eyebrow accent-neutral">{{ buzzWinnerName }} is answering</span>
          <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
          <p class="oq-thinking">Waiting<span class="oq-dots"><i></i><i></i><i></i></span></p>
        </div>
      </template>
      <p v-else class="playerName">Waiting for the first question…</p>
    </template>

    <div class="teamFinalTable">
      <div class="teamFinalSeatsRow">
        <div
            v-for="p in teamPlayers"
            :key="p.seatId"
            class="teamFinalPlayer"
            :class="{ 'teamFinalPlayer-eliminated': p.isEliminated, buzzing: p.seatId === finalBuzzSeatId }"
        >
          <Transition name="chaser-bubble-pop">
            <div
                v-if="p.seatId === mySeatId && bubbleText"
                :key="bubbleKey"
                class="chaserPanelBubble teamFinalBubble"
            >{{ bubbleText }}</div>
          </Transition>
          <p class="playerName teamFinalPlayerName">{{ p.name }}</p>
          <div class="teamFinalAvatarWrap">
            <CharacterFace :character="p.character" :reaction="reactions[p.seatId] ?? 'neutral'" />
          </div>
        </div>
      </div>
      <div class="teamFinalTableSlab" :class="{ 'teamFinalTableSlab-lit': finalBuzzSeatId !== '' }">
        <span class="teamFinalTableAmount">{{ potText }}</span>
      </div>
    </div>
  </div>
</template>
