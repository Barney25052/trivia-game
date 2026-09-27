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
    bubbleText.value = message.answer || "Pass!";
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

// Ticket 129: the pot's own moneyPlaque wipe/tick-up/dollar-burst sequence
// (115's shared component), replacing the old plain scale-pulse flash this
// screen used to play on a correct answer. displayedPot is the plaque's own
// shown value — kept separate from cashBuilderMoney so a correct answer can
// tick the number up over the wipe's duration instead of jumping straight
// to the new total.
const displayedPot = ref(props.cashBuilderMoney);
const potWiping = ref(false);
const potPlaqueEl = ref(null);
let potWipeTimeout = null;
let potTickRaf = null;

let cooldownInterval = null;
let questionInterval = null;
let screenFlashTimeout = null;

const cooldownActive = computed(() => cooldownLeft.value > 0);
// Matches the countdown-chip's own urgent threshold everywhere else it's
// used (see ChaseScreen.vue's lockoutUrgent) — pulses only in the last 2s
// instead of looping the whole cooldown the way the old press-me pulse did.
const cooldownUrgent = computed(() => cooldownLeft.value > 0 && cooldownLeft.value <= 2);
const roundFinished = computed(() => {
    if (cooldownActive.value || props.currentQuestion) return false;
    return seenQuestion.value || secondsLeft.value === 0;
});
const potText = computed(() => "$" + displayedPot.value.toLocaleString("en-US"));
const potLabel = computed(() => {
    if (props.isActiveContestant) return "Your pot";
    return props.activeContestantName ? `${props.activeContestantName}'s pot` : "Pot";
});
const inputDisabled = computed(() =>
    cooldownActive.value || !props.currentQuestion || roundFinished.value || awaitingNext.value
);
// Which open-question-box accent the shared question card wears right now —
// blue while it's your own turn to answer ("this is your own turn," same as
// Team Final's buzz-winner box), re-accented red/green for the two reveal
// states (ticket 129).
const questionBoxAccent = computed(() => {
    if (revealedCorrectAnswer.value) return "accent-red";
    if (correctAnswerText.value) return "accent-green";
    return "accent-blue";
});

function prefersReducedMotion() {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Ticket 129: reuses 115's .bill particle-burst primitive (a "$" burst — see
// style.css's own comment: spawning/removing the actual elements is a caller
// concern, not something the primitive does itself). Mirrors ChaseScreen.vue's
// spawnEscapeSparkles() (.spark) exactly, anchored to the plaque instead of
// the contestant portrait. Skipped outright under reduced motion, same reason
// as that one: .bill's animation is disabled there, but nothing else removes
// a spawned element without its animationend event firing.
function spawnMoneyBurst() {
    if (prefersReducedMotion() || !potPlaqueEl.value) return;
    const rect = potPlaqueEl.value.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    for (let i = 0; i < 8; i++) {
        const span = document.createElement("span");
        span.className = `bill ${Math.random() < 0.5 ? "gold" : "green"}`;
        span.textContent = "$";
        const angle = Math.random() * 360;
        const dist = 30 + Math.random() * 55;
        const rad = (angle * Math.PI) / 180;
        span.style.setProperty("--dx", `${Math.cos(rad) * dist}px`);
        span.style.setProperty("--dy", `${Math.sin(rad) * dist}px`);
        span.style.setProperty("--rot", `${Math.random() * 180 - 90}deg`);
        span.style.left = `${originX}px`;
        span.style.top = `${originY}px`;
        document.body.appendChild(span);
        span.addEventListener("animationend", () => span.remove());
    }
}

// Counts displayedPot up from its old value to the new one over the same
// 0.65s the plaque's own wipe sweep animates for (.plaque-wipe in
// style.css) — the counting itself is a caller-driven concern per that
// rule's own comment there.
function animatePotTickUp(from, to) {
    if (potTickRaf) cancelAnimationFrame(potTickRaf);
    if (prefersReducedMotion()) {
        displayedPot.value = to;
        return;
    }
    const durationMs = 650;
    const start = performance.now();
    function step(now) {
        const t = Math.min(1, (now - start) / durationMs);
        displayedPot.value = Math.round(from + (to - from) * t);
        if (t < 1) {
            potTickRaf = requestAnimationFrame(step);
        } else {
            potTickRaf = null;
        }
    }
    potTickRaf = requestAnimationFrame(step);
}

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

// Ticket 129: drives the moneyPlaque's wipe/tick-up/dollar-burst sequence in
// place of the old scale-pulse flash. Presentation only — cashBuilderMoney
// itself is still server-authoritative, untouched here.
watch(() => props.cashBuilderMoney, (current, previous) => {
    if (current > previous) {
        animatePotTickUp(previous, current);
        potWiping.value = true;
        spawnMoneyBurst();
        if (potWipeTimeout) clearTimeout(potWipeTimeout);
        potWipeTimeout = setTimeout(() => {
            potWiping.value = false;
            // Safety net: a backgrounded tab throttles/suspends
            // requestAnimationFrame (unlike this plain setTimeout, which
            // still fires), so animatePotTickUp's rAF loop can stall before
            // ever reaching displayedPot = current. This guarantees the
            // plaque lands on the real total regardless.
            if (potTickRaf) {
                cancelAnimationFrame(potTickRaf);
                potTickRaf = null;
            }
            displayedPot.value = current;
        }, 650);
    } else {
        displayedPot.value = current;
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
}

onUnmounted(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
    if (questionInterval) clearInterval(questionInterval);
    if (potWipeTimeout) clearTimeout(potWipeTimeout);
    if (potTickRaf) cancelAnimationFrame(potTickRaf);
    if (screenFlashTimeout) clearTimeout(screenFlashTimeout);
    clearBubble();
    document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="cashBuilderRoot">
    <div class="cashBuilderScreenFlash" :class="screenFlash"></div>
    <div class="cashBuilder">
        <h2 class="lobbyTitle">Cash Builder</h2>

        <!-- One fixed-height slot for both the pre-round countdown and the
             running clock, so the switch between them never shifts the
             content below. -->
        <div class="cashBuilderHud">
            <template v-if="cooldownActive">
                <span class="cashBuilderGetReady">Get ready</span>
                <div class="countdown-chip" :class="{ urgent: cooldownUrgent }">
                    <span class="countdown-num">{{ cooldownLeft }}</span>
                </div>
            </template>
            <div v-else class="cf-hud">
                <span>TIME LEFT <b :class="{ 'cf-hud-urgent': secondsLeft > 0 && secondsLeft <= 10 }">{{ secondsLeft }}s</b></span>
                <span>CORRECT <b>{{ cashBuilderCorrectAnswers }}</b></span>
            </div>
        </div>

        <div class="cashBuilderBody">
          <div class="cashBuilderMain">
            <div
                class="moneyPlaque cashBuilderPot"
                :class="{ wiping: potWiping }"
                ref="potPlaqueEl"
            >
                <span class="who">{{ potLabel }}</span>
                <span class="amount">{{ potText }}</span>
                <div class="plaque-wipe"></div>
            </div>

            <div v-if="isActiveContestant" class="open-question-box" :class="questionBoxAccent">
                <template v-if="revealedCorrectAnswer">
                    <span class="wrong-label">Wrong!</span>
                    <p class="wrong-answer">The answer was <strong>{{ revealedCorrectAnswer }}</strong></p>
                </template>
                <template v-else-if="correctAnswerText">
                    <span class="steal-success-label">Correct!</span>
                    <p class="steal-success-text"><strong>{{ correctAnswerText }}</strong></p>
                </template>
                <template v-else-if="currentQuestion">
                    <span class="oq-eyebrow">Question</span>
                    <p class="oq-prompt">{{ currentQuestion.prompt }}</p>
                </template>
                <p v-else class="oq-thinking">The first question is on its way…</p>

                <div class="oq-row cashBuilderAnswerRow">
                    <input
                        v-model="answerInput"
                        class="field"
                        :class="{ 'field-wrong': revealedCorrectAnswer }"
                        placeholder="Type your answer"
                        :disabled="inputDisabled"
                        @keyup.enter="submit"
                        ref="inputBox"
                        @blur="inputBox?.focus()"
                    />
                    <button class="btn btn-primary" :disabled="inputDisabled" @click="submit">Submit</button>
                </div>
            </div>

            <div v-else class="open-question-box">
                <span class="oq-eyebrow">Watching</span>
                <p class="oq-prompt">{{ activeContestantName || "A contestant" }} is building their pot.</p>
                <p class="oq-thinking">Answering<span class="oq-dots"><i></i><i></i><i></i></span></p>
            </div>

            <div class="cashBuilderStatusSlot">
                <p v-if="roundFinished" class="status-text cashBuilderStatus">Time's up!</p>
                <p v-else-if="isActiveContestant && awaitingNext && !revealedCorrectAnswer" class="status-text cashBuilderStatus">Next question…</p>
            </div>
          </div>

          <div class="cashBuilderProfile">
            <Transition name="chaser-bubble-pop">
              <div v-if="bubbleText" :key="bubbleKey" class="chaserPanelBubble cashBuilderBubble">{{ bubbleText }}</div>
            </Transition>
            <div class="board-portrait-circle cashBuilderAvatar">
              <CharacterFace :character="activeContestantCharacter" :reaction="reactions[activeContestantSeatId] ?? 'neutral'" />
            </div>
            <p class="playerName chaserPanelName">{{ activeContestantName || "A contestant" }}</p>
          </div>
        </div>
    </div>
  </div>
</template>
