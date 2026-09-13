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
    finalStealAnswer: { type: Object, default: null },
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
    stopHoldTicker();
    if (closeTimeout) clearTimeout(closeTimeout);
    if (answerBubbleTimeout) clearTimeout(answerBubbleTimeout);
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
// A brief fallback only: the Chaser's own `answerResult` (wrong) and the
// room-wide `finalSteal` broadcast (ticket 095) both fire from the same
// server-side handler call and arrive over the same ordered connection, so
// `stealActive` below almost always takes over the view before this ever
// paints — this just covers the instant between the two.
const chaserWaitingForSteal = ref(false);

// Pops the Chaser's own submitted answer from their ChaserPanel bubble
// (ticket 098) — mirrors TeamFinalScreen's bubbleText/bubbleKey pattern.
// This is local, own-client-only state driven straight off submission (the
// server never broadcasts it — the team must never see the Chaser's typed
// text) and kept separate from the chaserQuipText/chaserQuipKey channel
// (App.vue) so a future broadcast quip can never clobber, or be clobbered
// by, this bubble. A plain local timer is enough here; ticket 099 will
// generalize this into a shared min-lifetime pattern for the final bubbles.
const ANSWER_BUBBLE_HOLD_MS = 3000;
const chaserAnswerBubbleText = ref("");
const chaserAnswerBubbleKey = ref(0);
let answerBubbleTimeout = null;

function clearAnswerBubble() {
    if (answerBubbleTimeout) {
        clearTimeout(answerBubbleTimeout);
        answerBubbleTimeout = null;
    }
    chaserAnswerBubbleText.value = "";
}

watch(() => props.finalQuestion, () => {
    chaserAnswerInput.value = "";
    chaserWaitingForSteal.value = false;
    clearAnswerBubble();
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
    chaserAnswerBubbleText.value = trimmed;
    chaserAnswerBubbleKey.value += 1;
    if (answerBubbleTimeout) clearTimeout(answerBubbleTimeout);
    answerBubbleTimeout = setTimeout(() => {
        chaserAnswerBubbleText.value = "";
    }, ANSWER_BUBBLE_HOLD_MS);
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
// null = not yet resolved, true/false once finalStealResolved lands — drives
// both the outcome line's color and the green/red flash below.
const stealOutcomeCorrect = ref(null);

// The submitter's typed guess (ticket 095/096): a whole-room broadcast, so
// every client — the Chaser included — renders it as a bubble over that
// exact seat in the team row, not just the submitter's own screen.
const stealAnswerSeatId = ref("");
const stealAnswerText = ref("");
const stealAnswerBubbleKey = ref(0);

// The post-resolution outcome hold (ticket 096): a 3-2-1 countdown over the
// server's stealResolveHoldMs before the question area resets. This is a
// second, separate ticker from the open-window's nowTick/stealWindowEndsAt
// above — the two never run at once, one covers the open steal window, the
// other the resolved/expired hold that follows it.
// Mirrors server/src/gameConfig.ts FINAL_ROUND.stealResolveHoldMs — duplicated
// client-side the same way CHASER_FINAL_SECONDS above is (see AGENTS.md
// gotchas): the server doesn't echo the tunable back in any payload.
const STEAL_RESOLVE_HOLD_MS = 3000;
const holdEndsAt = ref(0);
const holdNowTick = ref(0);
let holdTicker = null;

function stopHoldTicker() {
    if (holdTicker) {
        clearInterval(holdTicker);
        holdTicker = null;
    }
}
function startHoldCountdown() {
    stopHoldTicker();
    holdEndsAt.value = Date.now() + STEAL_RESOLVE_HOLD_MS;
    holdNowTick.value = Date.now();
    holdTicker = setInterval(() => {
        holdNowTick.value = Date.now();
    }, 100);
    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeout = setTimeout(() => {
        manuallyClosed.value = true;
    }, STEAL_RESOLVE_HOLD_MS);
}
const holdActive = computed(() => holdEndsAt.value > 0 && !manuallyClosed.value);
const holdSecondsLeft = computed(() =>
    holdActive.value ? Math.max(0, Math.ceil((holdEndsAt.value - holdNowTick.value) / 1000)) : 0
);

watch(() => props.finalSteal, (steal) => {
    if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
    }
    stopHoldTicker();
    holdEndsAt.value = 0;
    if (steal) {
        manuallyClosed.value = false;
        stealAnswerInput.value = "";
        stealLocked.value = false;
        stealOutcomeText.value = "";
        stealOutcomeCorrect.value = null;
        stealAnswerSeatId.value = "";
        stealAnswerText.value = "";
        startStealTicker();
        nextTick(() => stealInputBox.value?.focus());
        // No server signal reaches non-submitting clients when a steal window
        // expires with nobody answering — finalStealResolved only fires on an
        // actual submission — so this local timer (a 500ms buffer past the
        // server's own window, for network latency) is what detects that case;
        // if the window is still open at that point, start the same resolve
        // hold with no outcome line to show.
        closeTimeout = setTimeout(() => {
            if (!holdActive.value) startHoldCountdown();
        }, steal.windowMs + 500);
    } else {
        stopStealTicker();
    }
});

watch(() => props.finalStealAnswer, (message) => {
    if (!message || !props.finalSteal || message.questionId !== props.finalSteal.questionId) return;
    stealAnswerSeatId.value = message.seatId;
    stealAnswerText.value = message.answer;
    stealAnswerBubbleKey.value += 1;
});

watch(() => props.finalStealResolved, (result) => {
    if (!result) return;
    stealLocked.value = true;
    stealOutcomeCorrect.value = result.correct;
    stealOutcomeText.value = result.correct
        ? (result.pushedBack
            ? "Stolen! The Chaser is pushed back."
            : "Correct! The Chaser was already at zero — the target goes up.")
        : `Wrong — the answer was ${result.correctAnswer}`;
    startHoldCountdown();
});

function submitSteal() {
    if (isChaser.value || !stealActive.value || stealLocked.value || !props.finalSteal) return;
    const trimmed = stealAnswerInput.value.trim();
    if (!trimmed) return;
    emit("submit-final-steal-answer", { answer: trimmed, questionId: props.finalSteal.questionId });
    stealLocked.value = true;
}

// Reuses the existing chaseLockoutFlash full-viewport layer for the "steal is
// live" pulse, then swaps to a solid green/red tint — same pattern as the
// cash builder's flash classes (.cashBuilder-flash-correct/-wrong) — once the
// outcome is known, so ticket 100 can extend either the pulse or the
// resolved-tint step into a shared final-round flash later.
const stealFlashClass = computed(() => {
    if (!stealActive.value) return "";
    if (stealOutcomeCorrect.value === null) return "chaseLockoutFlash";
    return stealOutcomeCorrect.value
        ? "chaserFinalStealFlash chaserFinalStealFlash-correct"
        : "chaserFinalStealFlash chaserFinalStealFlash-wrong";
});
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
          :answer-text="chaserAnswerBubbleText"
          :answer-key="chaserAnswerBubbleKey"
          :is-chaser="isChaser"
          :quip-input="false"
          @send-quip="emit('send-quip', $event)"
      />
    </div>

    <div class="finalTargetRow">
      <div
          v-for="box in targetBoxes"
          :key="box.index"
          class="finalTargetBox"
          :class="{ 'finalTargetBox-filled': box.filled }"
      >{{ box.index }}</div>
    </div>

    <div v-if="stealFlashClass" :class="stealFlashClass"></div>

    <div class="chaserFinalBottom">
      <!-- Everyone — including the Chaser — sees the team table during a
           steal (ticket 096): the old isChaser/stealActive split left the
           Chaser stuck on a static "waiting" message while the team's whole
           interaction (who answered, what, and the outcome) happened without
           them. -->
      <template v-if="stealActive">
        <div class="chaserFinalTeamRow">
          <div v-for="p in teamPlayers" :key="p.seatId" class="teamFinalPlayer">
            <Transition name="chaser-bubble-pop">
              <div
                  v-if="p.seatId === stealAnswerSeatId && stealAnswerText"
                  :key="stealAnswerBubbleKey"
                  class="chaserPanelBubble chaserFinalStealBubble"
              >{{ stealAnswerText }}</div>
            </Transition>
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

        <template v-if="holdActive">
          <p
              v-if="stealOutcomeText"
              class="playerName chaserFinalStealOutcome"
              :class="{
                'chaserFinalStealOutcome-correct': stealOutcomeCorrect === true,
                'chaserFinalStealOutcome-wrong': stealOutcomeCorrect === false
              }"
          >{{ stealOutcomeText }}</p>
          <p class="playerName chaserFinalStealCountdown">{{ holdSecondsLeft }}</p>
        </template>
        <template v-else>
          <p class="playerName">Steal! {{ stealSecondsLeft }}s left</p>
          <input
              v-if="!isChaser"
              v-model="stealAnswerInput"
              class="teamFinalInput"
              placeholder="Type your answer..."
              :disabled="stealLocked"
              ref="stealInputBox"
              @keyup.enter="submitSteal"
          />
        </template>
      </template>

      <template v-else-if="isChaser">
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

      <template v-else>
        <p class="playerName">The Chaser is answering…</p>
      </template>
    </div>
  </div>
</template>
