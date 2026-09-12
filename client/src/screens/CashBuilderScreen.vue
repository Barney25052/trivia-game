<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps({
    getReadyCooldownMs: { type: Number, default: 0 },
    currentQuestion: { type: Object, default: null },
    isActiveContestant: { type: Boolean, default: false },
    activeContestantName: { type: String, default: "" },
    cashBuilderMoney: { type: Number, default: 0 },
    cashBuilderCorrectAnswers: { type: Number, default: 0 },
    answerResult: { type: Object, default: null }
});
const emit = defineEmits(["submit-answer"]);

const CASH_BUILDER_SECONDS = 60;

const answerInput = ref("");
const cooldownLeft = ref(0);
const secondsLeft = ref(CASH_BUILDER_SECONDS);
const awaitingNext = ref(false);
const potFlash = ref(false);
const timerStarted = ref(false);
const seenQuestion = ref(false);
const inputBox = ref(null);
const screenFlash = ref("");
const revealedCorrectAnswer = ref("");

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
        screenFlash.value = "cashBuilder-flash-correct";
        screenFlashTimeout = setTimeout(() => {
            screenFlash.value = "";
        }, 700);
    } else {
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

        <template v-if="isActiveContestant">
            <div class="cashBuilderPot" :class="{ 'cashBuilderPot-flash': potFlash }">
                {{ potText }}
            </div>
            <p class="playerName cashBuilderMeta">{{ questionsLabel }}</p>

            <div class="cashBuilderQuestionArea" :class="{ 'cashBuilderQuestionArea-wrong': revealedCorrectAnswer }">
                <template v-if="revealedCorrectAnswer">
                    <span class="cashBuilderRevealLabel">✗ WRONG!</span>
                    <p class="cashBuilderRevealAnswer">The answer was <strong>{{ revealedCorrectAnswer }}</strong></p>
                </template>
                <template v-else-if="currentQuestion">
                    <span class="cashBuilderCategory">{{ currentQuestion.category }}</span>
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
                @blur="inputBox.focus()"
            />

            <p v-if="roundFinished" class="playerName cashBuilderStatus">Time's up!</p>
            <p v-else-if="awaitingNext && !revealedCorrectAnswer" class="playerName cashBuilderStatus">Next question…</p>
        </template>

        <template v-else>
            <div class="cashBuilderSpectator">
                <p class="playerName">{{ activeContestantName || "A contestant" }} is playing…</p>
                <div class="cashBuilderPot" :class="{ 'cashBuilderPot-flash': potFlash }">
                    {{ potText }}
                </div>
                <p class="playerName cashBuilderMeta">{{ questionsLabel }}</p>
            </div>
            <p v-if="roundFinished" class="playerName cashBuilderStatus">Time's up!</p>
        </template>
    </div>
  </div>
</template>