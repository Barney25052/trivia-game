<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps({
    getReadyCooldownMs: { type: Number, default: 0 },
    // Server-authoritative cash-builder duration in ms (ticket 112, fixing
    // bug-015) — mirrors GameState.cashBuilderDurationMs via App.vue. The
    // default only matters before the first state patch arrives; the real
    // countdown always starts from whatever value the room actually used.
    cashBuilderDurationMs: { type: Number, default: 60_000 },
    currentQuestion: { type: Object, default: null },
    isActiveContestant: { type: Boolean, default: false },
    activeContestantName: { type: String, default: "" },
    activeContestantSeatId: { type: String, default: "" },
    activeContestantCharacter: { type: String, default: "" },
    cashBuilderMoney: { type: Number, default: 0 },
    cashBuilderCorrectAnswers: { type: Number, default: 0 },
    answerResult: { type: Object, default: null },
    // Broadcast the instant any client submits a Cash Builder answer (ticket
    // 128) — {questionId, seatId, answer}, reaches every client including
    // spectators, not just the active contestant's own. See
    // server/src/shared/MessageTypes.ts's CashBuilderAnswerPayload comment
    // for why this one is safe to broadcast regardless of correctness.
    cashBuilderAnswer: { type: Object, default: null },
    // Per-seat face reaction store (ticket 103): seatId -> expression, see
    // App.vue's reactionsBySeat.
    reactions: { type: Object, default: () => ({}) }
});
const emit = defineEmits(["submit-answer"]);

// Each submitted answer (correct, wrong, or an empty pass) pops into a speech
// bubble anchored to the profile — driven by the cashBuilderAnswer broadcast
// so it renders identically for the active contestant and every spectator
// (ticket 128), not just locally on the submitter's own client.
//
// Ticket 107 (same family as ticket 099's Team/Chaser Final fix): on a
// correct answer the next question can arrive within the same tick as the
// submission, so clearing the bubble from the currentQuestion watch (as it
// used to) let it flash for ~0ms. A local minimum-life timer, independent of
// currentQuestion, guarantees it stays readable. Mirrors TeamFinalScreen's
// bubbleText/bubbleTimeout pattern.
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

watch(() => props.cashBuilderAnswer, (message) => {
    if (!message) return;
    bubbleText.value = message.answer || "(passed)";
    bubbleKey.value += 1;
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(clearBubble, ANSWER_BUBBLE_HOLD_MS);
});

const answerInput = ref("");
const cooldownLeft = ref(0);
// Ticket 112 (fixing bug-015): starts from the server-authoritative
// cashBuilderDurationMs prop instead of a hardcoded 60 — this component is
// freshly mounted (v-if) each time a contestant's cash builder round begins,
// so this initial value is always the real duration in effect for this round.
const secondsLeft = ref(Math.ceil(props.cashBuilderDurationMs / 1000));
const awaitingNext = ref(false);
const potFlash = ref(false);
const timerStarted = ref(false);
const seenQuestion = ref(false);
const inputBox = ref(null);
const screenFlash = ref("");
const revealedCorrectAnswer = ref("");
// Ticket 121: a correct answer only ever triggered the green screen flash,
// with no confirmation of what the accepted answer actually was — real gap
// for fuzzy-matched open-ended answers, where what you typed and what the
// server matched it to can differ. Separate ref (not reusing
// revealedCorrectAnswer) since the two have different lifetimes: the wrong
// reveal holds until the next question arrives, this clears on the same
// short timer as the correct flash itself.
const correctAnswerText = ref("");

let cooldownInterval = null;
let questionInterval = null;
let potFlashTimeout = null;
let screenFlashTimeout = null;

const cooldownActive = computed(() => cooldownLeft.value > 0);
const roundFinished = computed(() => {
    if (cooldownActive.value || props.currentQuestion) return false;
    return seenQuestion.value || secondsLeft.value === 0;
});
const potText = computed(() => "$" + props.cashBuilderMoney.toLocaleString("en-US"));
const questionsLabel = computed(() =>
    `${props.cashBuilderCorrectAnswers} correct answer${props.cashBuilderCorrectAnswers === 1 ? "" : "s"}`
);
const inputDisabled = computed(() =>
    cooldownActive.value || !props.currentQuestion || roundFinished.value || awaitingNext.value
);

function startReadyCountdown(totalMs) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownLeft.value = Math.ceil(totalMs / 1000);
    cooldownInterval = setInterval(() => {
        cooldownLeft.value -= 1;
        if (cooldownLeft.value <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            startQuestionTimer();
        }
    }, 1000);
}

function startQuestionTimer() {
    if (questionInterval || timerStarted.value) return;
    timerStarted.value = true;
    questionInterval = setInterval(() => {
        if (secondsLeft.value > 0) {
            secondsLeft.value -= 1;
        } else {
            clearInterval(questionInterval);
            questionInterval = null;
        }
    }, 1000);
}

function submit() {
    const trimmed = answerInput.value.trim();
    if (inputDisabled.value || !props.currentQuestion) return; //Let empty inputs count as it lets the player pass the question
    emit("submit-answer", { answer: trimmed, questionId: props.currentQuestion.questionId });
    // The bubble itself is driven by the cashBuilderAnswer broadcast watch
    // above, not set here directly — it reaches this same client's own
    // screen the same way it reaches every spectator's.
    answerInput.value = "";
    awaitingNext.value = true;
}

watch(() => props.getReadyCooldownMs, (ms) => {
    if (ms > 0 && !props.currentQuestion) startReadyCountdown(ms);
});

watch(() => props.currentQuestion, (question) => {
    if (question) {
        seenQuestion.value = true;
        awaitingNext.value = false;
        // The wrong-answer flash has no timer of its own — it's meant to hold until
        // the next question arrives, so clear it here. The correct-answer flash is
        // a brief animation that clears itself on its own timer instead: a correct
        // answer's next question can arrive in the same tick as the flash starting,
        // and clearing it here would cut the animation off before it's visible.
        if (screenFlash.value === "cashBuilder-flash-wrong") {
            screenFlash.value = "";
        }
        revealedCorrectAnswer.value = "";
        // correctAnswerText is intentionally NOT cleared here, same reason as
        // screenFlash above and bubbleText (ticket 107): confirmed live that
        // the server's advanceQuestion() fires synchronously on a correct
        // answer (server/src/rooms/handlers/messageHandlers.ts submitAnswer),
        // so the next currentQuestion can arrive within the same tick as this
        // watch running — clearing it here left the confirmation visible for
        // ~0ms. Its own 700ms timeout below (matching the correct flash's
        // cadence) is the only thing that clears it.
        startQuestionTimer();
    } else {
        awaitingNext.value = false;
    }
});

watch(() => props.cashBuilderMoney, (current, previous) => {
    if (current > previous) {
        potFlash.value = true;
        if (potFlashTimeout) clearTimeout(potFlashTimeout);
        potFlashTimeout = setTimeout(() => {
            potFlash.value = false;
        }, 600);
    }
});

watch(() => props.answerResult, (result) => {
    if (!result) return;
    if (screenFlashTimeout) clearTimeout(screenFlashTimeout);
    if (result.correct) {
        revealedCorrectAnswer.value = "";
        correctAnswerText.value = result.correctAnswer;
        screenFlash.value = "cashBuilder-flash-correct";
        screenFlashTimeout = setTimeout(() => {
            screenFlash.value = "";
            correctAnswerText.value = "";
        }, 700);
    } else {
        correctAnswerText.value = "";
        revealedCorrectAnswer.value = result.correctAnswer;
        screenFlash.value = "cashBuilder-flash-wrong";
    }
});

onMounted(() => {
    if (props.getReadyCooldownMs > 0 && !props.currentQuestion) {
        startReadyCountdown(props.getReadyCooldownMs);
    }   

    document.addEventListener('keydown', handleGlobalKeydown);
});

function handleGlobalKeydown(e) {
    if (inputDisabled.value) return;
    if (document.activeElement === inputBox.value) return; // already focused, let it type normally
    inputBox.value?.focus();
    console.log(e)
}

onUnmounted(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
    if (questionInterval) clearInterval(questionInterval);
    if (potFlashTimeout) clearTimeout(potFlashTimeout);
    if (screenFlashTimeout) clearTimeout(screenFlashTimeout);
    clearBubble();
    document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="cashBuilderRoot">
    <div class="cashBuilderScreenFlash" :class="screenFlash"></div>
    <div class="lobby cashBuilder">
        <h2 class="lobbyTitle">Cash Builder</h2>

        <p v-if="cooldownActive" class="playerName getReadyCountdown">
            Get ready… {{ cooldownLeft }}s
        </p>
        <p v-else class="cashBuilderTimer">Time left: {{ secondsLeft }}s</p>

        <div class="cashBuilderBody">
          <div class="cashBuilderMain">
            <template v-if="isActiveContestant">
                <div class="cashBuilderPot" :class="{ 'cashBuilderPot-flash': potFlash }">
                    {{ potText }}
                </div>
                <p class="playerName cashBuilderMeta">{{ questionsLabel }}</p>

                <div
                    class="cashBuilderQuestionArea"
                    :class="{ 'cashBuilderQuestionArea-wrong': revealedCorrectAnswer, 'cashBuilderQuestionArea-correct': correctAnswerText }"
                >
                    <template v-if="revealedCorrectAnswer">
                        <span class="cashBuilderRevealLabel">✗ WRONG!</span>
                        <p class="cashBuilderRevealAnswer">The answer was <strong>{{ revealedCorrectAnswer }}</strong></p>
                    </template>
                    <template v-else-if="correctAnswerText">
                        <span class="cashBuilderRevealLabel cashBuilderRevealLabel-correct">✓ Correct!</span>
                        <p class="cashBuilderRevealAnswer"><strong>{{ correctAnswerText }}</strong></p>
                    </template>
                    <template v-else-if="currentQuestion">
                        <p class="cashBuilderQuestion">{{ currentQuestion.prompt }}</p>
                    </template>
                    <p v-else class="playerName">Waiting for the first question…</p>
                </div>

                <input
                    v-model="answerInput"
                    class="cashBuilderInput"
                    :class="{ 'cashBuilderInput-wrong': revealedCorrectAnswer }"
                    placeholder="Type your answer..."
                    :disabled="inputDisabled"
                    @keyup.enter="submit"
                    ref="inputBox"
                    @blur="inputBox?.focus()"
                />

                <div class="cashBuilderStatusSlot">
                    <p v-if="roundFinished" class="playerName cashBuilderStatus">Time's up!</p>
                    <p v-else-if="awaitingNext && !revealedCorrectAnswer" class="playerName cashBuilderStatus">Next question…</p>
                </div>
            </template>

            <template v-else>
                <div class="cashBuilderSpectator">
                    <p class="playerName">{{ activeContestantName || "A contestant" }} is playing…</p>
                    <div class="cashBuilderPot" :class="{ 'cashBuilderPot-flash': potFlash }">
                        {{ potText }}
                    </div>
                    <p class="playerName cashBuilderMeta">{{ questionsLabel }}</p>
                </div>
                <div class="cashBuilderStatusSlot">
                    <p v-if="roundFinished" class="playerName cashBuilderStatus">Time's up!</p>
                </div>
            </template>
          </div>

          <div class="offerContestantBox cashBuilderProfileBox">
            <Transition name="chaser-bubble-pop">
              <div v-if="bubbleText" :key="bubbleKey" class="chaserPanelBubble cashBuilderBubble">{{ bubbleText }}</div>
            </Transition>
            <div class="offerContestantMaskBox">
              <CharacterFace :character="activeContestantCharacter" :reaction="reactions[activeContestantSeatId] ?? 'neutral'" />
            </div>
            <p class="playerName offerChaserName">{{ activeContestantName || "A contestant" }}</p>
          </div>
        </div>
    </div>
  </div>
</template>