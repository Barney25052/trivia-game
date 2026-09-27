<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import CharacterFace from "../components/CharacterFace.vue";
import { MAX_TYPED_ANSWER_LENGTH } from "../answerLimits.ts";

const props = defineProps({
    teamScore: { type: Number, default: 0 },
    teamPot: { type: Number, default: 0 },
    players: { type: Array, default: () => [] },
    mySeatId: { type: String, default: "" },
    chaserSeatId: { type: String, default: "" },
    finalQuestion: { type: Object, default: null },
    finalBuzzSeatId: { type: String, default: "" },
    answerResult: { type: Object, default: null },
    // Ticket 160: the latest final-round answer, broadcast to the whole room
    // (App.vue's finalAnswer) — this screen uses side "team" ones.
    finalAnswer: { type: Object, default: null },
    // Per-seat face reaction store (ticket 103): seatId -> expression, see
    // App.vue's reactionsBySeat.
    reactions: { type: Object, default: () => ({}) },
    // Ticket 148 (Maggie's Silence, ticket 144's SILENCED error): App.vue
    // only ever forwards this from a `client.send` targeted at the rejected
    // client, so any value here is always about *this* client's own buzz —
    // no seatId to check. silencedKey is a one-shot bump, same pattern as
    // the ability-cue/bubble timers elsewhere.
    silencedMessage: { type: String, default: "" },
    silencedKey: { type: Number, default: 0 }
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
    if (silencedTimeout) clearTimeout(silencedTimeout);
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
// style.css). It stays on the answering player's own screen (driven by their
// own `answerResult`); everyone else gets the answer bubble and, when it's
// wrong, the reveal from the finalAnswer broadcast instead (ticket 160).
const screenFlash = ref("");
let screenFlashTimeout = null;
// Ticket 160: the typed answer reaches every client (the finalAnswer
// broadcast), so the bubble pops over whichever seat answered, on every
// screen — including the answerer's own, the same way the Cash Builder's
// cashBuilderAnswer bubble works (ticket 128).
//
// Ticket 099: on a correct answer the server's advanceFinalTeamQuestion()
// fires immediately, so the next `finalQuestion` can arrive within the same
// tick as the submission — clearing the bubble from that watch (as it used
// to) let it flash for ~0ms. A local minimum-life timer, independent of
// finalQuestion, guarantees it stays readable. Mirrors ChaserFinalScreen's
// chaserAnswerBubbleText/answerBubbleTimeout pattern from ticket 098.
const ANSWER_BUBBLE_HOLD_MS = 3000;
const bubbleText = ref("");
const bubbleSeatId = ref("");
const bubbleKey = ref(0);
let bubbleTimeout = null;

function clearBubble() {
    if (bubbleTimeout) {
        clearTimeout(bubbleTimeout);
        bubbleTimeout = null;
    }
    bubbleText.value = "";
}

// Ticket 148 (Maggie's Silence): a shake + the server's own rejection
// message on the buzzer, rather than a silent no-op — this is a real game
// rule (only the previous question's scorer is locked out), not a bug, so it
// needs to visibly explain itself. Same one-shot-key-to-timed-flag shape as
// the answer bubbles above.
const SILENCED_DISPLAY_MS = 2200;
const silencedActive = ref(false);
let silencedTimeout = null;
watch(() => props.silencedKey, (key) => {
    if (key === 0) return;
    silencedActive.value = true;
    if (silencedTimeout) clearTimeout(silencedTimeout);
    silencedTimeout = setTimeout(() => {
        silencedActive.value = false;
    }, SILENCED_DISPLAY_MS);
});

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

watch(() => props.finalAnswer, (answer) => {
    if (!answer || answer.side !== "team") return;
    bubbleSeatId.value = answer.seatId;
    bubbleText.value = answer.answer;
    bubbleKey.value += 1;
    // Restart the min-life timer on every answer so a quick next one re-keys
    // and holds cleanly instead of accumulating overlapping timeouts.
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(clearBubble, ANSWER_BUBBLE_HOLD_MS);
    // A wrong answer shows the real one to the whole room, not just the
    // answerer (whose own answerResult does the same, plus the flash).
    if (!answer.correct) revealedCorrectAnswer.value = answer.correctAnswer;
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
      <span>TIME LEFT <b :class="{ 'cf-hud-urgent': secondsLeft > 0 && secondsLeft <= 10 }">{{ secondsLeft }}s</b></span>
      <span>TEAM SCORE <b>{{ teamScore }}</b></span>
    </div>

    <!-- Fixed-height stage for the question, whichever state it's in, so the
         table below never jumps. -->
    <div class="teamFinalStage">
      <div v-if="revealedCorrectAnswer" class="wrong-panel">
        <span class="wrong-label">Wrong!</span>
        <p class="wrong-answer">The answer was <strong>{{ revealedCorrectAnswer }}</strong></p>
      </div>
      <!-- The Chaser just watches: the live question and who's on it, no
           buzzer. -->
      <template v-else-if="isChaser">
        <div v-if="finalQuestion" class="open-question-box">
          <span class="oq-eyebrow">{{ finalBuzzSeatId === "" ? "Waiting for a buzz" : `${buzzWinnerName} is answering` }}</span>
          <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
          <p v-if="finalBuzzSeatId !== ''" class="oq-thinking">Thinking<span class="oq-dots"><i></i><i></i><i></i></span></p>
          <p v-else class="oq-thinking">Your round is next.</p>
        </div>
        <p v-else class="status-text">The team is answering. Your round is next.</p>
      </template>

      <template v-else>
        <template v-if="finalQuestion">
          <div v-if="isBuzzWinner" class="open-question-box accent-blue">
            <span class="oq-eyebrow">Your answer</span>
            <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
            <div class="oq-row">
              <input
                  v-model="answerInput"
                  class="field"
                  placeholder="Type your answer"
                  :maxlength="MAX_TYPED_ANSWER_LENGTH"
                  ref="inputBox"
                  @keyup.enter="submit"
              />
              <button class="btn btn-primary" @click="submit">Submit</button>
            </div>
          </div>
          <template v-else-if="finalBuzzSeatId === ''">
            <div class="open-question-box">
              <span class="oq-eyebrow">Buzz in to answer</span>
              <p class="oq-prompt teamFinalPrompt">{{ finalQuestion.prompt }}</p>
            </div>
            <div class="teamFinalBuzzer">
              <button
                  class="buzzer-btn"
                  :class="{ 'buzzer-btn-silenced': silencedActive }"
                  @click="buzz"
              >BUZZ!</button>
              <span class="teamFinalBuzzHint">or press Space</span>
              <Transition name="chaser-bubble-pop">
                <p v-if="silencedActive" class="buzzer-silenced-msg">{{ silencedMessage }}</p>
              </Transition>
            </div>
          </template>
          <div v-else class="open-question-box">
            <span class="oq-eyebrow">{{ buzzWinnerName }} is answering</span>
            <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
            <p class="oq-thinking">Thinking<span class="oq-dots"><i></i><i></i><i></i></span></p>
          </div>
        </template>
        <p v-else class="status-text">The first question is on its way…</p>
      </template>
    </div>

    <div class="teamFinalTable">
      <div class="teamFinalSeatsRow">
        <div
            v-for="p in teamPlayers"
            :key="p.seatId"
            class="teamFinalPlayer"
            :class="{ buzzing: p.seatId === finalBuzzSeatId }"
        >
          <Transition name="chaser-bubble-pop">
            <div
                v-if="p.seatId === bubbleSeatId && bubbleText"
                :key="bubbleKey"
                class="chaserPanelBubble teamFinalBubble"
            >{{ bubbleText }}</div>
          </Transition>
          <div class="teamFinalAvatarWrap">
            <CharacterFace :character="p.character" :reaction="reactions[p.seatId] ?? 'neutral'" />
          </div>
        </div>
      </div>
      <!-- The table: the team stands behind it, each with a name plate on
           its front edge (a row matching the seats row's widths/gaps), and
           the pot on the front panel. -->
      <div class="teamFinalTableSlab" :class="{ 'teamFinalTableSlab-lit': finalBuzzSeatId !== '' }">
        <div class="teamFinalNameRow">
          <span
              v-for="p in teamPlayers"
              :key="p.seatId"
              class="teamFinalNamePlate"
              :class="{
                'teamFinalNamePlate-you': p.seatId === mySeatId,
                'teamFinalNamePlate-buzzing': p.seatId === finalBuzzSeatId
              }"
          >{{ p.name }}</span>
        </div>
        <span class="teamFinalTableAmount">{{ potText }}</span>
      </div>
    </div>
  </div>
</template>
