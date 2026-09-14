<script setup>
import { ref, computed } from "vue";
import { CHASER_PORTRAITS, CHASER_NAMES } from "../chaserPortraits.ts";

// Mirrors server/src/gameConfig.ts CHASER_QUIP.maxLength — duplicated
// client-side the same way GamePhase is (see AGENTS.md gotchas).
const MAX_QUIP_LENGTH = 140;
const SEND_COOLDOWN_MS = 1500;

const props = defineProps({
    characterId: { type: String, default: "" },
    quipText: { type: String, default: "" },
    quipKey: { type: Number, default: 0 },
    // The Chaser's own submitted-answer bubble during the Chaser Final
    // (ticket 098) — kept separate from quipText/quipKey so a future
    // broadcast quip can never clobber, or be clobbered by, the Chaser's
    // own answer bubble.
    answerText: { type: String, default: "" },
    answerKey: { type: Number, default: 0 },
    isChaser: { type: Boolean, default: false },
    // Hides the composable "Say something..." input row (ticket 097) — the
    // Chaser Final passes false so the Chaser only tabs into the answer
    // input. The bubble and broadcast quips still render either way.
    quipInput: { type: Boolean, default: true },
    // Ticket 116: opts into the frame-free circle-portrait treatment (115's
    // .board-portrait-wrap/.board-portrait-circle/.chaser-wrap) instead of
    // this panel's original rounded-square .chaserPanelMask box. Defaults to
    // false so Offer/Chaser Final (which still use the box) are unaffected —
    // only the Chase board opts in today. Whichever ticket redesigns Offer or
    // the Chaser Final next can flip this on there too instead of forking a
    // second component.
    circlePortrait: { type: Boolean, default: false },
    // Small VT323 countdown badge overlapping the circle's edge (ticket 116)
    // — only meaningful alongside circlePortrait. null hides the badge
    // entirely; a number shows it. See ChaseScreen.vue's lockoutBadgeSide for
    // how the caller decides whether this side gets the badge.
    countdownSeconds: { type: Number, default: null },
    countdownUrgent: { type: Boolean, default: false },
    // Ticket 117: opts into the "imposing stage" treatment for the Chaser
    // Final's own-turn banner — a bare, frame-free cutout portrait (no box,
    // no circle) with a big drop-shadow and a VT323 name underneath, mirroring
    // ChaseScreen.vue's Caught/Escaped cutscene portrait (.chaseCutsceneChaser)
    // rather than either of the other two modes below. Takes priority over
    // circlePortrait if both were ever set (they never are — only
    // ChaserFinalScreen's own-turn banner sets this, and only the Chase
    // board sets circlePortrait). Defaults to false so every other caller
    // (Offer, the Chase board) is unaffected.
    bannerPortrait: { type: Boolean, default: false }
});
const emit = defineEmits(["send-quip"]);

const portrait = computed(() => CHASER_PORTRAITS[props.characterId] ?? null);
const displayName = computed(() => CHASER_NAMES[props.characterId] ?? "");

const quipDraft = ref("");
const onCooldown = ref(false);
let cooldownTimeout = null;

const sendDisabled = computed(() => {
    const trimmed = quipDraft.value.trim();
    return onCooldown.value || trimmed.length === 0 || trimmed.length > MAX_QUIP_LENGTH;
});

function submitQuip() {
    const text = quipDraft.value.trim();
    if (onCooldown.value || text.length === 0 || text.length > MAX_QUIP_LENGTH) return;
    emit("send-quip", text);
    quipDraft.value = "";
    onCooldown.value = true;
    if (cooldownTimeout) clearTimeout(cooldownTimeout);
    cooldownTimeout = setTimeout(() => {
        onCooldown.value = false;
    }, SEND_COOLDOWN_MS);
}
</script>

<template>
    <div class="chaserPanel">
        <div v-if="bannerPortrait" class="chaserStageBanner">
            <img
                v-if="portrait"
                :src="portrait"
                :alt="displayName"
                class="chaserStageBannerImg"
            />
        </div>
        <div v-else-if="circlePortrait" class="board-portrait-wrap chaser-wrap">
            <div class="board-portrait-circle">
                <img
                    v-if="portrait"
                    :src="portrait"
                    :alt="displayName"
                    class="board-portrait-img"
                />
            </div>
            <div
                v-if="countdownSeconds !== null"
                class="countdown-chip small chaseCountdownBadge"
                :class="{ urgent: countdownUrgent }"
            >
                <span class="countdown-num">{{ countdownSeconds }}</span>
            </div>
        </div>
        <div v-else class="chaserPanelMask">
            <img
                v-if="portrait"
                :src="portrait"
                :alt="displayName"
                class="chaserPanelPortrait"
            />
        </div>
        <Transition name="chaser-bubble-pop">
            <div v-if="quipText" :key="quipKey" class="chaserPanelBubble">{{ quipText }}</div>
        </Transition>
        <Transition name="chaser-bubble-pop">
            <div v-if="answerText" :key="answerKey" class="chaserPanelBubble chaserPanelAnswerBubble">{{ answerText }}</div>
        </Transition>
        <p
            v-if="displayName"
            class="playerName chaserPanelName"
            :class="{ 'chaserPanelName-banner': bannerPortrait }"
        >{{ displayName }}</p>

        <div v-if="isChaser && quipInput" class="chaserPanelInputRow">
            <input
                v-model="quipDraft"
                type="text"
                class="chaserPanelInput"
                placeholder="Say something..."
                :maxlength="MAX_QUIP_LENGTH"
                @keyup.enter="submitQuip"
            />
            <button class="btn btn-primary chaserPanelSend" :disabled="sendDisabled" @click="submitQuip">
                Send
            </button>
        </div>
    </div>
</template>
