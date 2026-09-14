<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";
import CharacterFace from "../components/CharacterFace.vue";
import { CHASER_PORTRAITS, CHASER_NAMES } from "../chaserPortraits.ts";

const props = defineProps({
    players: { type: Array, default: () => [] },
    activeContestantSeatId: { type: String, default: "" },
    chaserSeatId: { type: String, default: "" },
    mySeatId: { type: String, default: "" },
    chaserCharacterId: { type: String, default: "" },
    chaserQuipText: { type: String, default: "" },
    chaserQuipKey: { type: Number, default: 0 },
    currentQuestion: { type: Object, default: null },
    chaseQuestionResult: { type: Object, default: null },
    chaseOutcome: { type: String, default: null },
    chaseLockout: { type: Object, default: null },
    chaseWagerAmount: { type: Number, default: 0 },
    // Per-seat face reaction store (ticket 103): seatId -> expression, see
    // App.vue's reactionsBySeat.
    reactions: { type: Object, default: () => ({}) }
});
const emit = defineEmits(["submit-chase-answer", "auto-quip", "send-quip"]);

// Mirrors server/src/gameConfig.ts BOARD + CHASE_QUESTION — duplicated
// client-side the same way GamePhase is (see AGENTS.md gotchas): no shared
// module between the two npm projects.
const BOARD_SPACES = [7, 6, 5, 4, 3, 2, 1];
const ESCAPE_SPACE = 0;
const ON_BOARD_MAX = 7;
const CHASER_OFFBOARD = 8;

const START_QUIPS = [
    "Let's see if you can escape.",
    "Nowhere to run.",
    "This ends now."
];
const CATCH_QUIPS = ["Got you!", "Nowhere left to go.", "That's how it's done."];
const ESCAPE_QUIPS = ["Lucky this time.", "You got away... barely.", "Enjoy it while it lasts."];

onMounted(() => {
    emit("auto-quip", START_QUIPS[Math.floor(Math.random() * START_QUIPS.length)]);
});

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const isContestant = computed(() => props.mySeatId !== "" && props.mySeatId === props.activeContestantSeatId);
const isParticipant = computed(() => isChaser.value || isContestant.value);

const contestantPos = computed(
    () => props.players.find((p) => p.seatId === props.activeContestantSeatId)?.boardPos ?? ESCAPE_SPACE
);
const chaserPos = computed(
    () => props.players.find((p) => p.seatId === props.chaserSeatId)?.boardPos ?? CHASER_OFFBOARD
);
const activeContestantName = computed(
    () => props.players.find((p) => p.seatId === props.activeContestantSeatId)?.name ?? "the contestant"
);
const chaserIsOnBoard = computed(() => chaserPos.value <= ON_BOARD_MAX);

const activeContestantCharacter = computed(
    () => props.players.find((p) => p.seatId === props.activeContestantSeatId)?.character ?? ""
);

// Ticket 116: the Caught/Escaped cutscene's Chaser image is a bare <img> of
// the same portrait ChaserPanel renders — resolved from the shared lookup
// (chaserPortraits.ts) instead of duplicating ChaserPanel's own table.
const chaserPortraitSrc = computed(() => CHASER_PORTRAITS[props.chaserCharacterId] ?? null);
const chaserDisplayName = computed(() => CHASER_NAMES[props.chaserCharacterId] ?? "");

function isPlayerSpace(space) {
    return contestantPos.value === space;
}

// The exact space a token currently sits on gets a glowing outline on top of
// the flat tint — the Chaser's trail stays flat so the head of the trail
// (their actual position) always pops out at a glance.
function isCurrentSpace(space) {
    return isPlayerSpace(space) || (chaserIsOnBoard.value && chaserPos.value === space);
}

// The Chaser's current space, and every space behind them (closer to their
// start), stays red so the board reads as a trail closing in on the contestant.
function isChaserSpace(space) {
    return chaserIsOnBoard.value && space >= chaserPos.value;
}

function formatAmount(amount) {
    const abs = Math.abs(amount).toLocaleString("en-US");
    return amount < 0 ? `-$${abs}` : `$${abs}`;
}

const myAnswerIndex = ref(null);

// Pops the picked answer's own text into a speech bubble over whichever
// side picked it (ticket 127) — mirrors CashBuilderScreen/TeamFinalScreen's
// bubble, but simpler: no independent min-life timer is needed since
// myAnswerIndex is only ever cleared when a genuinely new question arrives
// (the watch below), never synchronously alongside the submission itself
// the way a correct Cash Builder answer can advance same-tick.
const myAnswerBubbleKey = ref(0);
const myAnswerText = computed(() => {
    if (myAnswerIndex.value === null || !props.currentQuestion) return "";
    return props.currentQuestion.options[myAnswerIndex.value] ?? "";
});

const resultForCurrentQuestion = computed(() => {
    if (!props.chaseQuestionResult || !props.currentQuestion) return null;
    if (props.chaseQuestionResult.questionId !== props.currentQuestion.questionId) return null;
    return props.chaseQuestionResult;
});
const revealed = computed(() => resultForCurrentQuestion.value !== null);
const hasAnswered = computed(() => myAnswerIndex.value !== null);

// The 5s lockout pulse + countdown (ticket 072) are not self-reported: they're
// driven by the shared `chaseLockout` signal the server broadcasts the moment
// either side answers first, so the contestant, the Chaser, and spectators all
// see the same clock start from the same event. `windowMs` comes off the
// server, not a client-side constant.
const nowTick = ref(0);
let lockoutInterval = null;

const lockoutActive = computed(() => {
    if (!props.chaseLockout || !props.currentQuestion) return false;
    if (props.chaseLockout.questionId !== props.currentQuestion.questionId) return false;
    if (revealed.value) return false;
    return Date.now() < props.chaseLockout.startedAt + props.chaseLockout.windowMs;
});

const answerWindowLeft = computed(() => {
    if (!lockoutActive.value) return 0;
    return Math.max(0, Math.ceil(
        (props.chaseLockout.startedAt + props.chaseLockout.windowMs - nowTick.value) / 1000
    ));
});

// Ticket 116: replaces the old full-screen .chaseLockoutFlash with a small
// countdown badge overlapping whichever side's circle still needs to answer.
// chaseLockoutStarted is deliberately anonymous server-side (see
// submitChaseAnswer's own comment) — it never says who answered first, so a
// spectator has no way to know which side the badge belongs on, and shows it
// on both. A participant already knows their own hasAnswered state locally
// though, so they can work out the other side's status by elimination
// (lockout only ever starts once exactly one side has answered) — that's not
// new information leaking from the server, just the client's own state plus
// a rule already visible on screen ("the clock is running").
const lockoutBadgeSide = computed(() => {
    if (!lockoutActive.value) return null;
    if (isChaser.value) return hasAnswered.value ? "contestant" : "chaser";
    if (isContestant.value) return hasAnswered.value ? "chaser" : "contestant";
    return "both";
});
const lockoutUrgent = computed(() => lockoutActive.value && answerWindowLeft.value <= 2);
const chaserCountdownSeconds = computed(() => (
    lockoutBadgeSide.value === "chaser" || lockoutBadgeSide.value === "both" ? answerWindowLeft.value : null
));
const contestantCountdownSeconds = computed(() => (
    lockoutBadgeSide.value === "contestant" || lockoutBadgeSide.value === "both" ? answerWindowLeft.value : null
));

function stopLockoutTicker() {
    if (lockoutInterval) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
    }
    nowTick.value = 0;
}

function startLockoutTicker() {
    stopLockoutTicker();
    nowTick.value = Date.now();
    lockoutInterval = setInterval(() => {
        nowTick.value = Date.now();
        if (!lockoutActive.value) {
            stopLockoutTicker();
        }
    }, 250);
}

watch(
    [() => props.chaseLockout, () => revealed.value],
    () => {
        if (lockoutActive.value) {
            startLockoutTicker();
        } else {
            stopLockoutTicker();
        }
    },
    { immediate: true }
);

// Long options shrink so they fit the fixed 190px button width without
// overflowing (the shortest-size tier is applied when even the longest
// option fits comfortably at the smaller sizes).
const optionFontClass = computed(() => {
    const longest = Math.max(0, ...(props.currentQuestion?.options ?? []).map((o) => o.length));
    if (longest > 36) return "chaseOptionButton-fontXs";
    if (longest > 24) return "chaseOptionButton-fontSm";
    return "";
});

function selectOption(index) {
    if (!isParticipant.value || hasAnswered.value || revealed.value || !props.currentQuestion) return;
    myAnswerIndex.value = index;
    myAnswerBubbleKey.value += 1;
    emit("submit-chase-answer", { answerIndex: index, questionId: props.currentQuestion.questionId });
}

// Ticket 116: new-question entrance sequence — the question box wipes in
// (an unconditional CSS animation, replayed because the box is keyed on
// questionId in the template, i.e. a fresh DOM node per question — nothing
// here toggles a class for it), the prompt sits alone for
// ENTRANCE_PROMPT_HOLD_MS, then the answer buttons pop in. buttonsRevealed
// alone drives the "buttons hidden" look (opacity/visibility in CSS, never
// display:none), so the box's height never changes across the sequence.
const buttonsRevealed = ref(false);
const ENTRANCE_PROMPT_HOLD_MS = 3000;
let entranceTimeout = null;

function stopEntranceTimer() {
    if (entranceTimeout) {
        clearTimeout(entranceTimeout);
        entranceTimeout = null;
    }
}

watch(() => props.currentQuestion, (question) => {
    myAnswerIndex.value = null;
    stopLockoutTicker();
    stopEntranceTimer();
    buttonsRevealed.value = false;
    if (question) {
        entranceTimeout = setTimeout(() => {
            buttonsRevealed.value = true;
            entranceTimeout = null;
        }, ENTRANCE_PROMPT_HOLD_MS);
    }
});

// Ticket 116: Caught/Escaped cutscene — a short impact/dash beat plays first
// (pure CSS, autoplaying the moment the cutscene markup mounts), then the
// existing CAUGHT!/ESCAPED! banner (unchanged) pops in a beat later so the
// two read as a sequence rather than appearing on top of each other.
const OUTCOME_BANNER_DELAY_MS = { caught: 500, escaped: 650 };
const showOutcomeBanner = ref(false);
let outcomeBannerTimeout = null;
const cutsceneContestantEl = ref(null);

function stopOutcomeBannerTimer() {
    if (outcomeBannerTimeout) {
        clearTimeout(outcomeBannerTimeout);
        outcomeBannerTimeout = null;
    }
}

function prefersReducedMotion() {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Reuses 115's .spark particle-burst primitive (a "★" burst — see
// style.css's own comment: spawning/removing the actual elements is a
// caller concern, not something the primitive does itself). Skipped
// outright under reduced motion: .spark's animation is disabled there, but
// nothing else removes the spawned element without its animationend event
// firing, so spawning here would otherwise leave stars stuck on screen.
function spawnEscapeSparkles() {
    if (prefersReducedMotion() || !cutsceneContestantEl.value) return;
    const rect = cutsceneContestantEl.value.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    for (let i = 0; i < 10; i++) {
        const span = document.createElement("span");
        span.className = `spark${Math.random() < 0.5 ? " blue" : ""}`;
        span.textContent = "★";
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

watch(() => props.chaseOutcome, (outcome) => {
    stopOutcomeBannerTimer();
    showOutcomeBanner.value = false;
    if (outcome === "caught") {
        emit("auto-quip", CATCH_QUIPS[Math.floor(Math.random() * CATCH_QUIPS.length)]);
        outcomeBannerTimeout = setTimeout(() => { showOutcomeBanner.value = true; }, OUTCOME_BANNER_DELAY_MS.caught);
    } else if (outcome === "escaped") {
        emit("auto-quip", ESCAPE_QUIPS[Math.floor(Math.random() * ESCAPE_QUIPS.length)]);
        nextTick(() => spawnEscapeSparkles());
        outcomeBannerTimeout = setTimeout(() => { showOutcomeBanner.value = true; }, OUTCOME_BANNER_DELAY_MS.escaped);
    }
});

onUnmounted(() => {
    stopLockoutTicker();
    stopEntranceTimer();
    stopOutcomeBannerTimer();
});
</script>

<template>
  <div class="chaseTable">
    <h2 class="lobbyTitle chaseTableTitle">The Chase</h2>

    <div class="chaseGround">
      <template v-if="!chaseOutcome">
        <div v-if="currentQuestion" class="chaseWipeBar" :key="'wipe-' + currentQuestion.questionId"></div>

        <div class="chaseTableRow">
          <ChaserPanel
              circle-portrait
              :character-id="chaserCharacterId"
              :quip-text="chaserQuipText"
              :quip-key="chaserQuipKey"
              :answer-text="isChaser ? myAnswerText : ''"
              :answer-key="myAnswerBubbleKey"
              :is-chaser="isChaser"
              :countdown-seconds="chaserCountdownSeconds"
              :countdown-urgent="lockoutUrgent"
              @send-quip="emit('send-quip', $event)"
          />

          <div class="board">
            <div
              v-for="space in BOARD_SPACES"
              :key="space"
              class="boardSpace"
              :class="{ playerSpace: isPlayerSpace(space), chaserSpace: isChaserSpace(space), 'boardSpace-current': isCurrentSpace(space) }"
            >
              <span v-if="isPlayerSpace(space) && chaseWagerAmount !== 0" class="chaseWagerBadge">
                {{ formatAmount(chaseWagerAmount) }}
              </span>
            </div>
          </div>

          <div class="board-portrait-wrap">
            <Transition name="chaser-bubble-pop">
              <div v-if="isContestant && myAnswerText" :key="myAnswerBubbleKey" class="chaserPanelBubble">{{ myAnswerText }}</div>
            </Transition>
            <div class="board-portrait-circle">
              <CharacterFace :character="activeContestantCharacter" :reaction="reactions[activeContestantSeatId] ?? 'neutral'" />
            </div>
            <div
              v-if="contestantCountdownSeconds !== null"
              class="countdown-chip small chaseCountdownBadge"
              :class="{ urgent: lockoutUrgent }"
            >
              <span class="countdown-num">{{ contestantCountdownSeconds }}</span>
            </div>
          </div>
        </div>

        <div class="chaseQuestionArea">
          <template v-if="currentQuestion">
            <div
              class="chaseQuestionBox"
              :key="currentQuestion.questionId"
              :class="{ 'chaseQuestionBox-buttons-hidden': !buttonsRevealed }"
            >
              <p class="chaseQuestion">{{ currentQuestion.prompt }}</p>
              <div class="chaseOptions chaseOptions-row">
                <button
                  v-for="(option, index) in currentQuestion.options"
                  :key="index"
                  class="answer-btn"
                  :class="[
                    {
                      picked: myAnswerIndex === index,
                      dimmed: hasAnswered && myAnswerIndex !== index && !(revealed && resultForCurrentQuestion.correctIndex === index),
                      'chaseOptionButton-correct': revealed && resultForCurrentQuestion.correctIndex === index,
                      'chaseOptionButton-wrong': revealed && myAnswerIndex === index && resultForCurrentQuestion.correctIndex !== index,
                      'chase-pop-in': buttonsRevealed
                    },
                    optionFontClass
                  ]"
                  :disabled="!isParticipant || hasAnswered || revealed"
                  @click="selectOption(index)"
                >{{ option }}</button>
              </div>
            </div>

            <p v-if="isParticipant && hasAnswered && !revealed" class="playerName chaseWaitingStatus">Locked in…</p>
            <p v-else-if="!isParticipant && !revealed" class="playerName chaseWaitingStatus">{{ activeContestantName }} and the Chaser are answering…</p>
          </template>
          <p v-else class="playerName">Waiting for the next question…</p>
        </div>
      </template>

      <div
        v-else
        class="chaseCutscene"
        :class="chaseOutcome === 'caught' ? 'chaseCutscene-caught' : 'chaseCutscene-escaped'"
      >
        <img
          v-if="chaserPortraitSrc"
          :src="chaserPortraitSrc"
          :alt="chaserDisplayName"
          class="chaseCutsceneChaser"
          :class="chaseOutcome === 'caught' ? 'chaseCutsceneChaser-caught' : 'chaseCutsceneChaser-escaped'"
        />
        <div
          ref="cutsceneContestantEl"
          class="chaseCutsceneContestant"
          :class="chaseOutcome === 'caught' ? 'chaseCutsceneContestant-caught' : 'chaseCutsceneContestant-escaped'"
        >
          <CharacterFace :character="activeContestantCharacter" reaction="neutral" />
        </div>
        <div v-if="chaseOutcome === 'caught'" class="chaseCutsceneFlash"></div>
      </div>
    </div>

    <Transition name="chase-outcome-pop">
      <div
        v-if="showOutcomeBanner"
        class="chaseOutcomeBanner"
        :class="chaseOutcome === 'escaped' ? 'chaseOutcomeBanner-escaped' : 'chaseOutcomeBanner-caught'"
      >
        {{ chaseOutcome === "escaped" ? "ESCAPED!" : "CAUGHT!" }}
      </div>
    </Transition>
  </div>
</template>
