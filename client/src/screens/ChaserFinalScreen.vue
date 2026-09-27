<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";
import CharacterFace from "../components/CharacterFace.vue";
import { CHASER_NAMES } from "../chaserPortraits.ts";

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
    answerResult: { type: Object, default: null },
    // Ticket 160: the latest final-round answer, broadcast to the whole room
    // (App.vue's finalAnswer) — this screen uses side "chaser" ones.
    finalAnswer: { type: Object, default: null },
    // Per-seat face reaction store (ticket 103): seatId -> expression, see
    // App.vue's reactionsBySeat.
    reactions: { type: Object, default: () => ({}) },
    // Server-authoritative Chaser-final clock (ticket 105, fixing bug-013):
    // App.vue mirrors GameState.chaserFinalClockRunning/chaserFinalRemainingMs
    // (synced by TriviaRoom.syncChaserFinalClockState) and stamps the wall-clock
    // moment it last saw either change as chaserFinalClockSyncedAt.
    chaserFinalClockRunning: { type: Boolean, default: false },
    chaserFinalRemainingMs: { type: Number, default: 0 },
    chaserFinalClockSyncedAt: { type: Number, default: () => Date.now() },
    // Ticket 145: ability tray plumbing, passed straight through to
    // ChaserPanel — see App.vue for where these come from.
    abilityCounters: { type: Object, default: () => ({}) },
    abilityCueText: { type: String, default: "" },
    abilityCueKey: { type: Number, default: 0 },
    // Ticket 148: bumped by App.vue whenever the Chaser fires Skip — gives
    // the question box its own "just changed, no consequence" pulse on top
    // of the generic ability-cue toast ChaserPanel already renders.
    skipPulseKey: { type: Number, default: 0 },
    // Ticket 148: bumped by App.vue whenever a chaser-final clock sync is
    // inferred to be Big Stan's Time Bonus extending the running clock (see
    // App.vue's onStateChange comment) — drives a brief tick/pulse on the
    // "TIME LEFT" number below instead of a new animation language.
    chaserFinalTimeBonusKey: { type: Number, default: 0 }
});
const emit = defineEmits(["submit-final-chaser-answer", "submit-final-steal-answer", "auto-quip", "send-quip", "use-ability"]);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const teamPlayers = computed(() => props.players.filter((p) => p.seatId !== props.chaserSeatId));
// Ticket 148: Bezos's Pushback Immunity outcome line names the character
// rather than saying "the Chaser", so a spectator watching cold still learns
// whose passive just fired.
const chaserDisplayName = computed(() => CHASER_NAMES[props.chaserCharacterId] || "The Chaser");

// The displayed "Time left" is derived straight from the server's real
// running/paused clock (ticket 105) instead of a client-only setInterval
// (bug-013): while running, it counts down from chaserFinalRemainingMs as of
// chaserFinalClockSyncedAt; the moment the server pauses it (a steal window
// and its resolve hold), chaserFinalClockRunning flips to false and the
// display freezes at the exact frozen remainder instead of guessing — and
// resumes ticking from that same true remainder, not from wherever a naive
// local timer would have decremented it to. The ticker only needs to run
// while the clock is actually running; while paused, secondsLeft is a plain
// (non-ticking) computed off the frozen remainder.
const clockNowTick = ref(Date.now());
let clockTicker = null;
function stopClockTicker() {
    if (clockTicker) {
        clearInterval(clockTicker);
        clockTicker = null;
    }
}
function startClockTicker() {
    stopClockTicker();
    clockNowTick.value = Date.now();
    clockTicker = setInterval(() => {
        clockNowTick.value = Date.now();
    }, 250);
}
watch(
    () => props.chaserFinalClockRunning,
    (running) => {
        if (running) startClockTicker();
        else stopClockTicker();
    },
    { immediate: true }
);

// Ticket 148 (Big Stan's Time Bonus): a brief tick/pulse on the clock number
// itself, plus a "+2s" that floats off it (ticket 160) — App.vue bumps
// chaserFinalTimeBonusKey once per inferred extension; this just holds the
// flag on long enough for both animations, the same one-shot-key-to-timed-flag
// shape as the answer bubbles above.
const TIME_BONUS_PULSE_MS = 1400;
// Mirrors server/src/gameConfig.ts CHASER_ABILITIES.timeBonusMs (2000ms) —
// duplicated the same way GamePhase is (AGENTS.md gotchas).
const TIME_BONUS_SECONDS = 2;
const timeBonusPulseActive = ref(false);
let timeBonusPulseTimeout = null;
watch(() => props.chaserFinalTimeBonusKey, (key) => {
    if (key === 0) return;
    timeBonusPulseActive.value = true;
    if (timeBonusPulseTimeout) clearTimeout(timeBonusPulseTimeout);
    timeBonusPulseTimeout = setTimeout(() => {
        timeBonusPulseActive.value = false;
    }, TIME_BONUS_PULSE_MS);
});

// Ticket 148 (Skip): a short pulse on the open question box so "the question
// just changed" reads as a deliberate, consequence-free beat rather than a
// silent swap — on top of, not instead of, ChaserPanel's own generic
// "Chaser used Skip!" toast (abilityCueText/Key, unchanged here).
const SKIP_PULSE_MS = 650;
const skipPulseActive = ref(false);
let skipPulseTimeout = null;
watch(() => props.skipPulseKey, (key) => {
    if (key === 0) return;
    skipPulseActive.value = true;
    if (skipPulseTimeout) clearTimeout(skipPulseTimeout);
    skipPulseTimeout = setTimeout(() => {
        skipPulseActive.value = false;
    }, SKIP_PULSE_MS);
});

const secondsLeft = computed(() => {
    if (!props.chaserFinalClockRunning) {
        return Math.max(0, Math.ceil(props.chaserFinalRemainingMs / 1000));
    }
    const endsAt = props.chaserFinalClockSyncedAt + props.chaserFinalRemainingMs;
    return Math.max(0, Math.ceil((endsAt - clockNowTick.value) / 1000));
});

const START_QUIPS = [
    "Let's finish this.",
    "One shot at glory.",
    "Time to seal it."
];

onMounted(() => {
    emit("auto-quip", START_QUIPS[Math.floor(Math.random() * START_QUIPS.length)]);
});

onUnmounted(() => {
    stopClockTicker();
    stopStealTicker();
    stopHoldTicker();
    if (closeTimeout) clearTimeout(closeTimeout);
    if (answerBubbleTimeout) clearTimeout(answerBubbleTimeout);
    if (stealAnswerBubbleTimeout) clearTimeout(stealAnswerBubbleTimeout);
    if (timeBonusPulseTimeout) clearTimeout(timeBonusPulseTimeout);
    if (skipPulseTimeout) clearTimeout(skipPulseTimeout);
});

// The target row always spans the full width, one box per point the team
// needs to survive — it grows if a steal raises the target mid-round.
const targetBoxes = computed(() =>
    Array.from({ length: Math.max(props.teamScore, 1) }, (_, i) => ({
        index: i + 1,
        filled: i + 1 <= props.chaserScore
    }))
);

// Ticket 117: full-bleed dark tension-fill bar behind the whole stage — a
// new layer, not a replacement for the target boxes above. Reacts straight
// off the same chaserScore/teamScore props as targetBoxes, so a pushed-back
// steal (chaserScore dropping) shrinks this the same way a correct Chaser
// answer grows it — no separate "reverse" case to build. Same Math.max(...,
// 1) guard as targetBoxes to avoid a divide-by-zero before teamScore is set.
const tensionFillPercent = computed(() =>
    Math.min(100, Math.max(0, (props.chaserScore / Math.max(props.teamScore, 1)) * 100))
);

const chaserAnswerInput = ref("");
const chaserInputBox = ref(null);
// A brief fallback only: the Chaser's own `answerResult` (wrong) and the
// room-wide `finalSteal` broadcast (ticket 095) both fire from the same
// server-side handler call and arrive over the same ordered connection, so
// `stealActive` below almost always takes over the view before this ever
// paints — this just covers the instant between the two.
const chaserWaitingForSteal = ref(false);

// Pops the Chaser's submitted answer from their ChaserPanel bubble (ticket
// 098) on every screen, not just the Chaser's own: the finalAnswer broadcast
// reaches the whole room (ticket 160). Kept separate from the
// chaserQuipText/chaserQuipKey channel (App.vue) so a quip can never clobber,
// or be clobbered by, this bubble. It holds for its own minimum life rather
// than clearing when the next question arrives (which a correct answer
// triggers in the same tick) — the same fix TeamFinalScreen got in 099.
const ANSWER_BUBBLE_HOLD_MS = 3000;
const chaserAnswerBubbleText = ref("");
const chaserAnswerBubbleKey = ref(0);
let answerBubbleTimeout = null;
// The Chaser's answer to the question now up for a steal, so the team can
// see what they said (and not repeat it).
const lastChaserAnswer = ref(null);
const stealChaserAnswer = computed(() =>
    props.finalSteal && lastChaserAnswer.value?.questionId === props.finalSteal.questionId
        ? lastChaserAnswer.value.answer
        : ""
);

watch(() => props.finalQuestion, () => {
    chaserAnswerInput.value = "";
    chaserWaitingForSteal.value = false;
});

watch(() => props.finalAnswer, (answer) => {
    if (!answer || answer.side !== "chaser") return;
    lastChaserAnswer.value = { questionId: answer.questionId, answer: answer.answer };
    chaserAnswerBubbleText.value = answer.answer;
    chaserAnswerBubbleKey.value += 1;
    if (answerBubbleTimeout) clearTimeout(answerBubbleTimeout);
    answerBubbleTimeout = setTimeout(() => {
        chaserAnswerBubbleText.value = "";
    }, ANSWER_BUBBLE_HOLD_MS);
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

// Ticket 145: best-effort client mirror of Skip's own gate in canUseAbility
// (server/src/rooms/handlers/chaserAbilities.ts) for the ability tray's
// disabled state — a live chaser-final question exists and no steal window
// is open. Doesn't attempt to mirror the finer bank-exhaustion edge case
// (finalRoundQuestions.getCurrentQuestion) — the server re-validates
// regardless (canUseAbility), so a rare stale-enabled click there just gets
// silently rejected server-side same as any other race.
const chaserAbilityWindowOpen = computed(() => props.finalQuestion !== null && !stealActive.value);
const stealSecondsLeft = computed(() =>
    stealActive.value ? Math.max(0, Math.ceil((stealWindowEndsAt.value - nowTick.value) / 1000)) : 0
);

const stealAnswerInput = ref("");
const stealInputBox = ref(null);
const stealLocked = ref(false);
// Ticket 117: split from one combined sentence into a label + body pair so
// the template can render the steal-success-panel/wrong-panel's two-line
// layout (a big label, then a plain-text body) without any string surgery —
// same information as before, just structured for the new markup.
const stealOutcomeLabel = ref("");
const stealOutcomeBody = ref("");
// Only set on a wrong steal — kept separate from stealOutcomeBody so the
// template can bold just the answer itself (matches TeamFinalScreen's own
// "The answer was <strong>X</strong>" pattern) instead of the answer being
// buried inside a plain interpolated sentence.
const stealCorrectAnswer = ref("");
// null = not yet resolved, true/false once finalStealResolved lands — drives
// both the outcome panel's color and the green/red flash below.
const stealOutcomeCorrect = ref(null);

// The submitter's typed guess (ticket 095/096): a whole-room broadcast, so
// every client — the Chaser included — renders it as a bubble over that
// exact seat in the team row, not just the submitter's own screen.
//
// Ticket 099: this used to rely entirely on the surrounding steal/hold state
// machine (stealActive/manuallyClosed) to keep the bubble on screen — which
// happens to work out today because finalStealAnswer and finalStealResolved
// fire back-to-back from the same server handler, so the resolve-hold below
// already spans the bubble's life. That coupling is incidental, not a
// guarantee, so the bubble gets its own explicit min-life timer here too —
// same ANSWER_BUBBLE_HOLD_MS pattern as the Chaser's own bubble above and
// TeamFinalScreen's bubbleText, kept as a separate timer/variable so it
// can't collide with startHoldCountdown()'s holdTicker/closeTimeout, which
// govern the outcome banner + advance timing, not the bubble.
const stealAnswerSeatId = ref("");
const stealAnswerText = ref("");
const stealAnswerBubbleKey = ref(0);
let stealAnswerBubbleTimeout = null;

function clearStealAnswerBubble() {
    if (stealAnswerBubbleTimeout) {
        clearTimeout(stealAnswerBubbleTimeout);
        stealAnswerBubbleTimeout = null;
    }
    stealAnswerText.value = "";
}

// The post-resolution outcome hold (ticket 096): a 3-2-1 countdown over the
// server's stealResolveHoldMs before the question area resets. This is a
// second, separate ticker from the open-window's nowTick/stealWindowEndsAt
// above — the two never run at once, one covers the open steal window, the
// other the resolved/expired hold that follows it.
// Mirrors server/src/gameConfig.ts FINAL_ROUND.stealResolveHoldMs — duplicated
// client-side (see AGENTS.md gotchas on GamePhase): the server doesn't echo
// this tunable back in any payload. Unlike the overall Chaser-final clock
// (ticket 105 above), the hold itself is just a cosmetic countdown display —
// the server's own pause of the real clock through the hold is what actually
// matters, and that already comes from chaserFinalClockRunning.
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
        stealOutcomeLabel.value = "";
        stealOutcomeBody.value = "";
        stealCorrectAnswer.value = "";
        stealOutcomeCorrect.value = null;
        stealAnswerSeatId.value = "";
        clearStealAnswerBubble();
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
    // Restart the min-life timer on every submission so it re-keys and holds
    // cleanly instead of accumulating overlapping timeouts.
    if (stealAnswerBubbleTimeout) clearTimeout(stealAnswerBubbleTimeout);
    stealAnswerBubbleTimeout = setTimeout(clearStealAnswerBubble, ANSWER_BUBBLE_HOLD_MS);
});

watch(() => props.finalStealResolved, (result) => {
    if (!result) return;
    stealLocked.value = true;
    stealOutcomeCorrect.value = result.correct;
    if (result.correct) {
        // Ticket 148: a blocked push-back (Bezos's Pushback Immunity, ticket
        // 142) still reuses the same green success panel as a normal steal —
        // it IS a correct answer, it just didn't move the target — but gets
        // its own label/line so the team reads "we got it right, he just
        // didn't budge" instead of mistaking the frozen target for a miss.
        if (result.pushbackBlocked) {
            stealOutcomeLabel.value = "Blocked!";
            stealOutcomeBody.value = `Right answer, but ${chaserDisplayName.value} doesn't budge.`;
        } else {
            stealOutcomeLabel.value = result.pushedBack ? "Stolen!" : "Correct!";
            stealOutcomeBody.value = result.pushedBack
                ? `${chaserDisplayName.value} is pushed back a step.`
                : `${chaserDisplayName.value} was already at zero, so the target goes up.`;
        }
    } else {
        stealOutcomeLabel.value = "Wrong!";
        stealCorrectAnswer.value = result.correctAnswer;
    }
    startHoldCountdown();
});

function submitSteal() {
    if (isChaser.value || !stealActive.value || stealLocked.value || !props.finalSteal) return;
    const trimmed = stealAnswerInput.value.trim();
    if (!trimmed) return;
    emit("submit-final-steal-answer", { answer: trimmed, questionId: props.finalSteal.questionId });
    stealLocked.value = true;
}

// Ticket 117: the open steal window no longer gets a full-viewport pulse —
// the imposing stage's own ground/vignette easing to the team's navy (see
// chaserFinalStageClass below) carries that "it's the team's moment now"
// signal instead, so .chaseLockoutFlash has no callers left anywhere (see the
// tickets/README.md ticket-117 footnote) and its declaration is removed from
// style.css. This still flashes a solid green/red tint via
// .chaserFinalStealFlash-correct/-wrong once the outcome is known — same
// shared rule (next to .cashBuilderScreenFlash/.finalScreenFlash, ticket 100)
// as before, just without the null-outcome branch.
const stealFlashClass = computed(() => {
    if (!stealActive.value || stealOutcomeCorrect.value === null) return "";
    return stealOutcomeCorrect.value
        ? "chaserFinalStealFlash chaserFinalStealFlash-correct"
        : "chaserFinalStealFlash chaserFinalStealFlash-wrong";
});

// Ticket 117: the stage's ground eases from the Chaser's red (--ink-chase) to
// the team's plain navy the instant a steal opens, and its red vignette fades
// to 0 — "it's the team's moment now" — then reverses once the steal
// resolves and chaserFinalTop swaps back to the Chaser's own banner.
const chaserFinalStageClass = computed(() => (stealActive.value ? "chaserFinalStage-steal" : ""));
</script>

<template>
  <div class="chaserFinalRoot" :class="chaserFinalStageClass">
    <h2 class="lobbyTitle chaserFinalTitle">The Chaser Final</h2>

    <div class="chaserFinalStage">
      <div class="chaserFinalStageVignette"></div>
      <div
          class="chaserFinalTensionFill"
          :class="{ 'chaserFinalTensionFill-empty': tensionFillPercent === 0 }"
          :style="{ width: tensionFillPercent + '%' }"
      ></div>

      <div class="chaserFinalTop">
        <div v-if="stealActive" class="chaserFinalStealPromptTop">
          <span class="chaserFinalStealLabel">Steal!</span>
          <p class="oq-prompt chaserFinalStealPrompt">{{ finalSteal.prompt }}</p>
          <p v-if="stealChaserAnswer" class="chaserFinalStealChaserAnswer">
            {{ chaserDisplayName }} said <strong>{{ stealChaserAnswer }}</strong>
          </p>
        </div>
        <ChaserPanel
            v-else
            banner-portrait
            :character-id="chaserCharacterId"
            :quip-text="chaserQuipText"
            :quip-key="chaserQuipKey"
            :answer-text="chaserAnswerBubbleText"
            :answer-key="chaserAnswerBubbleKey"
            :is-chaser="isChaser"
            :quip-input="false"
            phase="chaserFinal"
            :ability-counters="abilityCounters"
            :ability-window-open="chaserAbilityWindowOpen"
            :ability-cue-text="abilityCueText"
            :ability-cue-key="abilityCueKey"
            @send-quip="emit('send-quip', $event)"
            @use-ability="emit('use-ability', $event)"
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
    </div>

    <div class="cf-hud">
      <span class="cf-hud-clock">
        TIME LEFT <b :class="{ 'cf-hud-time-tick': timeBonusPulseActive, 'cf-hud-urgent': secondsLeft > 0 && secondsLeft <= 10 }">{{ secondsLeft }}s</b>
        <span v-if="timeBonusPulseActive" class="cf-hud-bonus">+{{ TIME_BONUS_SECONDS }}s</span>
      </span>
      <span>CHASER <b>{{ chaserScore }}</b></span>
      <span>TARGET <b>{{ teamScore }}</b></span>
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
            <div
                class="teamFinalAvatarWrap"
                :class="{ chaserFinalStealWinner: p.seatId === stealAnswerSeatId && stealOutcomeCorrect === true }"
            >
              <CharacterFace :character="p.character" :reaction="reactions[p.seatId] ?? 'neutral'" />
            </div>
            <p class="playerName teamFinalPlayerName">{{ p.name }}</p>
          </div>
        </div>

        <template v-if="holdActive">
          <div v-if="stealOutcomeCorrect === true" class="steal-success-panel">
            <span class="steal-success-label">{{ stealOutcomeLabel }}</span>
            <p class="steal-success-text">{{ stealOutcomeBody }}</p>
          </div>
          <div v-else-if="stealOutcomeCorrect === false" class="wrong-panel">
            <span class="wrong-label">{{ stealOutcomeLabel }}</span>
            <p class="wrong-answer">The answer was <strong>{{ stealCorrectAnswer }}</strong></p>
          </div>
          <p class="chaserFinalStealCountdown">Back to {{ chaserDisplayName }} in <b>{{ holdSecondsLeft }}</b></p>
        </template>
        <template v-else>
          <!-- The prompt is already shown big at the top of the stage, so
               this box only carries the clock, the rule and the input. -->
          <div v-if="!isChaser" class="open-question-box accent-gold">
            <span class="oq-eyebrow">Steal · <b>{{ stealSecondsLeft }}s</b> left</span>
            <p class="oq-thinking chaserFinalStealHint">Anyone can answer. Get it right to push the Chaser back.</p>
            <div class="oq-row">
              <input
                  v-model="stealAnswerInput"
                  class="field"
                  placeholder="Type your answer"
                  :disabled="stealLocked"
                  ref="stealInputBox"
                  @keyup.enter="submitSteal"
              />
              <button class="btn btn-primary" :disabled="stealLocked" @click="submitSteal">Submit</button>
            </div>
          </div>
          <p v-else class="status-text">The team is trying to steal. <strong>{{ stealSecondsLeft }}s</strong> left</p>
        </template>
      </template>

      <template v-else-if="isChaser">
        <template v-if="finalQuestion">
          <div
              v-if="!chaserWaitingForSteal"
              class="open-question-box accent-red"
              :class="{ 'open-question-box-skip-pulse': skipPulseActive }"
          >
            <span class="oq-eyebrow">Your answer</span>
            <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
            <div class="oq-row">
              <input
                  v-model="chaserAnswerInput"
                  class="field"
                  placeholder="Type your answer"
                  ref="chaserInputBox"
                  @keyup.enter="submitChaserAnswer"
              />
              <button class="btn btn-primary" @click="submitChaserAnswer">Submit</button>
            </div>
          </div>
          <div v-else class="wrong-panel">
            <span class="wrong-label">Wrong!</span>
            <p class="wrong-answer">Now the team gets a chance to steal…</p>
          </div>
        </template>
        <p v-else class="status-text">The first question is on its way…</p>
      </template>

      <!-- Ticket 117 "Watching" state: the prompt is safe to show (only the
           Chaser's typed guess must stay hidden), so non-Chaser clients now
           see the same finalQuestion.prompt the Chaser is working from,
           instead of a blank "is answering" placeholder. -->
      <template v-else>
        <div
            v-if="finalQuestion"
            class="open-question-box"
            :class="{ 'open-question-box-skip-pulse': skipPulseActive }"
        >
          <span class="oq-eyebrow">{{ chaserDisplayName }} is answering</span>
          <p class="oq-prompt">{{ finalQuestion.prompt }}</p>
          <p class="oq-thinking">Thinking<span class="oq-dots"><i></i><i></i><i></i></span></p>
        </div>
        <p v-else class="status-text">The first question is on its way…</p>
      </template>
    </div>
  </div>
</template>
