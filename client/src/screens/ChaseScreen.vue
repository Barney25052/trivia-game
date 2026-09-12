<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";

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
    chaseWagerAmount: { type: Number, default: 0 }
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
    emit("submit-chase-answer", { answerIndex: index, questionId: props.currentQuestion.questionId });
}

watch(() => props.currentQuestion, () => {
    myAnswerIndex.value = null;
    stopLockoutTicker();
});

watch(() => props.chaseOutcome, (outcome) => {
    if (outcome === "caught") {
        emit("auto-quip", CATCH_QUIPS[Math.floor(Math.random() * CATCH_QUIPS.length)]);
    } else if (outcome === "escaped") {
        emit("auto-quip", ESCAPE_QUIPS[Math.floor(Math.random() * ESCAPE_QUIPS.length)]);
    }
});

onUnmounted(() => stopLockoutTicker());
</script>

<template>
  <div class="chaserSideLayout">
    <ChaserPanel
        :character-id="chaserCharacterId"
        :quip-text="chaserQuipText"
        :quip-key="chaserQuipKey"
        :is-chaser="isChaser"
        @send-quip="emit('send-quip', $event)"
    />
    <div class="lobby chaseScreen">
      <h2 class="lobbyTitle">The Chase</h2>

      <p v-if="!chaserIsOnBoard" class="playerName chaseOffboardNote">
        The Chaser is off the board — one correct answer to enter.
      </p>

      <div class="board">
        <div
          v-for="space in BOARD_SPACES"
          :key="space"
          class="boardSpace"
          :class="{ playerSpace: isPlayerSpace(space), chaserSpace: isChaserSpace(space), 'boardSpace-current': isCurrentSpace(space) }"
        >
          <span class="boardSpaceNumber">{{ space }}</span>
          <span v-if="isPlayerSpace(space) && chaseWagerAmount !== 0" class="chaseWagerBadge">
            {{ formatAmount(chaseWagerAmount) }}
          </span>
        </div>
        <div class="chaseEscapeSpace">ESCAPE</div>
      </div>

      <div class="chaseQuestionArea" :class="{ 'chaseQuestionArea-lockout': lockoutActive }">
        <template v-if="currentQuestion">
          <p class="chaseQuestion">{{ currentQuestion.prompt }}</p>
          <div class="chaseOptions">
            <button
              v-for="(option, index) in currentQuestion.options"
              :key="index"
              class="startButton chaseOptionButton"
              :class="[
                {
                  'chaseOptionButton-picked': myAnswerIndex === index,
                  'chaseOptionButton-correct': revealed && resultForCurrentQuestion.correctIndex === index,
                  'chaseOptionButton-wrong': revealed && myAnswerIndex === index && resultForCurrentQuestion.correctIndex !== index,
                  'chaseOptionButton-lockout': lockoutActive
                },
                optionFontClass
              ]"
              :disabled="!isParticipant || hasAnswered || revealed"
              @click="selectOption(index)"
            >{{ option }}</button>
          </div>

          <p v-if="isParticipant && hasAnswered && !revealed" class="playerName chaseWaitingStatus">
            Locked in<span v-if="lockoutActive"> — waiting ({{ answerWindowLeft }}s)</span>…
          </p>
          <p v-else-if="isParticipant && !hasAnswered && !revealed" class="playerName chaseWaitingStatus">
            Pick your answer!<span v-if="lockoutActive"> — {{ answerWindowLeft }}s left</span>
          </p>
          <p v-else-if="!isParticipant && !revealed" class="playerName chaseWaitingStatus">
            {{ activeContestantName }} and the Chaser are answering…<span v-if="lockoutActive"> ({{ answerWindowLeft }}s)</span>
          </p>
        </template>
        <p v-else class="playerName">Waiting for the next question…</p>
      </div>

      <Transition name="chase-outcome-pop">
        <div
          v-if="chaseOutcome"
          class="chaseOutcomeBanner"
          :class="chaseOutcome === 'escaped' ? 'chaseOutcomeBanner-escaped' : 'chaseOutcomeBanner-caught'"
        >
          {{ chaseOutcome === "escaped" ? "ESCAPED!" : "CAUGHT!" }}
        </div>
      </Transition>
    </div>
  </div>
</template>
