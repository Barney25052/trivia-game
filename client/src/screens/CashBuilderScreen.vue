<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

const props = defineProps({
    getReadyCooldownMs: { type: Number, default: 0 },
    currentQuestion: { type: Object, default: null },
    isActiveContestant: { type: Boolean, default: false },
    activeContestantName: { type: String, default: "" },
    cashBuilderMoney: { type: Number, default: 0 },
    cashBuilderQuestionsAsked: { type: Number, default: 0 }
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

let cooldownInterval = null;
let questionInterval = null;
let potFlashTimeout = null;

const cooldownActive = computed(() => cooldownLeft.value > 0);
const roundFinished = computed(() => {
    if (cooldownActive.value || props.currentQuestion) return false;
    return seenQuestion.value || secondsLeft.value === 0;
});
const potText = computed(() => "$" + props.cashBuilderMoney.toLocaleString("en-US"));
const questionsLabel = computed(() =>
    `${props.cashBuilderQuestionsAsked} question${props.cashBuilderQuestionsAsked === 1 ? "" : "s"} answered`
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
    if (inputDisabled.value || !props.currentQuestion || trimmed.length === 0) return;
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

onMounted(() => {
    if (props.getReadyCooldownMs > 0 && !props.currentQuestion) {
        startReadyCountdown(props.getReadyCooldownMs);
    }
});

onUnmounted(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
    if (questionInterval) clearInterval(questionInterval);
    if (potFlashTimeout) clearTimeout(potFlashTimeout);
});
</script>

<template>
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

            <template v-if="currentQuestion">
                <span class="cashBuilderCategory">{{ currentQuestion.category }}</span>
                <p class="cashBuilderQuestion">{{ currentQuestion.prompt }}</p>
            </template>
            <p v-else class="playerName">Waiting for the first question…</p>

            <input
                v-model="answerInput"
                class="cashBuilderInput"
                placeholder="Type your answer..."
                :disabled="inputDisabled"
                @keyup.enter="submit"
            />
            <button
                class="startButton cashBuilderSubmit"
                :disabled="inputDisabled"
                @click="submit"
            >
                {{ awaitingNext ? "Checking…" : "Submit" }}
            </button>

            <p v-if="roundFinished" class="playerName cashBuilderStatus">Time's up!</p>
            <p v-else-if="awaitingNext" class="playerName cashBuilderStatus">Next question…</p>
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
</template>