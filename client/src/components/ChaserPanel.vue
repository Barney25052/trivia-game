<script setup>
import { ref, computed } from "vue";
import { CHASER_PORTRAITS, CHASER_NAMES } from "../chaserPortraits.ts";
import { CHASER_ABILITY_COPY, SHARED_CHASER_ABILITY_COPY } from "../chaserAbilities.ts";

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
    bannerPortrait: { type: Boolean, default: false },
    // Ticket 145: ability tray plumbing. `phase` tells the tray which
    // manually-activated abilities are even relevant to show as buttons on
    // this screen — mirrors the server's own phase gates
    // (server/src/rooms/handlers/chaserAbilities.ts: fiftyFifty/doubleTime/
    // reRack/jumble are Chase-only via chaseTimingGate, skip is
    // ChaserFinal-only). Passed as a literal by each screen's own
    // ChaserPanel usage rather than derived here, since the screen already
    // knows which one it is; see PHASE_ACTIVE_ABILITY_IDS below.
    phase: { type: String, default: "" },
    // Synced GameState ability counters/flags (ticket 140), mirrored in
    // App.vue's onStateChange the same way chaserPot/teamPot already are —
    // public info, not secret (see GameState.ts's own comment on these
    // fields). Keys: fiftyFiftyUsesRemaining, skipUsesRemaining,
    // pushbackImmunityUsesRemaining, doubleTimeUsedThisTableRound,
    // reRackUsedThisTableRound, jumbleUsedThisTableRound, doubleTimeArmed.
    abilityCounters: { type: Object, default: () => ({}) },
    // Best-effort client mirror of canUseAbility's timing gate — true when
    // there's a live question nobody has committed an answer to yet (mid-
    // Chase) or a live chaser-final question with no steal window open. The
    // server remains authoritative and re-validates on click regardless;
    // this only drives the disabled-button UX/tooltip.
    abilityWindowOpen: { type: Boolean, default: false },
    // Public "the Chaser just used X" cue (ticket 140's chaserAbilityUsed
    // broadcast) — a short-lived toast, deliberately a separate prop pair
    // from quipText/quipKey (not folded into the quip channel) so it can
    // never clobber, or be clobbered by, a real quip (055/057).
    abilityCueText: { type: String, default: "" },
    abilityCueKey: { type: Number, default: 0 }
});
const emit = defineEmits(["send-quip", "use-ability"]);

const portrait = computed(() => CHASER_PORTRAITS[props.characterId] ?? null);
const displayName = computed(() => CHASER_NAMES[props.characterId] ?? "");

// Ticket 145: which manually-activated ability ids are relevant to show per
// phase. Offer has none — no manually-activated ability is usable during
// Offer today (all five gate on Chase or ChaserFinal). fiftyFifty/skip are
// "shared" abilities every Chaser character gets regardless of pick (see
// chaserAbilities.ts's SHARED_CHASER_ABILITY_COPY / GOAL.md's "every Chaser
// gets 2 shared abilities regardless of pick") — Bezos included, even though
// his own CHASER_ABILITY_COPY.active is empty (he has no *character-specific*
// active; the two shared ones still apply to him).
const PHASE_ACTIVE_ABILITY_IDS = {
    offer: [],
    chase: ["fiftyFifty", "doubleTime", "reRack", "jumble"],
    chaserFinal: ["skip"]
};

// Mirrors server/src/gameConfig.ts CHASER_ABILITIES (usesPerGame for
// fiftyFifty/skip; the three character actives are usesPerTableRound, always
// 1) — same client-side duplication precedent as chaserAbilities.ts itself.
const ABILITY_MAX_USES = {
    fiftyFifty: 4,
    skip: 2,
    doubleTime: 1,
    reRack: 1,
    jumble: 1
};

// Which GameState boolean flag backs each once-per-table-round active.
const ABILITY_TABLE_ROUND_FLAG = {
    doubleTime: "doubleTimeUsedThisTableRound",
    reRack: "reRackUsedThisTableRound",
    jumble: "jumbleUsedThisTableRound"
};

const characterAbilities = computed(() => CHASER_ABILITY_COPY[props.characterId] ?? null);

const visiblePassives = computed(() => characterAbilities.value?.passive ?? []);

const visibleActiveAbilities = computed(() => {
    const allowedIds = PHASE_ACTIVE_ABILITY_IDS[props.phase] ?? [];
    if (allowedIds.length === 0) return [];
    const all = [...SHARED_CHASER_ABILITY_COPY, ...(characterAbilities.value?.active ?? [])];
    return all.filter((ability) => allowedIds.includes(ability.id));
});

function chargesRemaining(id) {
    if (id === "fiftyFifty") return props.abilityCounters.fiftyFiftyUsesRemaining ?? 0;
    if (id === "skip") return props.abilityCounters.skipUsesRemaining ?? 0;
    const flag = ABILITY_TABLE_ROUND_FLAG[id];
    if (flag) return props.abilityCounters[flag] ? 0 : 1;
    return 0;
}

function chargesLabel(id) {
    return `${chargesRemaining(id)}/${ABILITY_MAX_USES[id] ?? 1}`;
}

// Empty string = usable. Anything else is the disabled reason, also used to
// extend the hover tooltip so a dimmed button still explains itself.
function disabledReason(id) {
    if (chargesRemaining(id) <= 0) {
        return ABILITY_TABLE_ROUND_FLAG[id] ? "Already used this table round" : "No uses remaining";
    }
    if (id === "doubleTime" && props.abilityCounters.doubleTimeArmed) {
        return "Already armed — resolves on the next chase question";
    }
    if (!props.abilityWindowOpen) {
        return "Not usable right now";
    }
    return "";
}

function isAbilityUsable(id) {
    return props.isChaser && disabledReason(id) === "";
}

function abilityTip(ability) {
    const reason = disabledReason(ability.id);
    return reason ? `${ability.description} (${reason})` : ability.description;
}

// Pushback Immunity is the one passive with a live public counter (3 uses a
// game) — worth surfacing since it's already synced GameState, not secret.
// Every other passive is purely descriptive (always-on, no charges to track).
function passiveTip(passive) {
    if (passive.id === "pushbackImmunity" && typeof props.abilityCounters.pushbackImmunityUsesRemaining === "number") {
        return `${passive.description} (${props.abilityCounters.pushbackImmunityUsesRemaining}/3 left)`;
    }
    return passive.description;
}

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
            <!-- Ticket 146: armed for exactly one chase question (see
                 TriviaRoom.startNextChaseQuestion/resolveChaseQuestion) — public
                 GameState, so this reads the same abilityCounters prop every
                 caller already threads through for the ability tray's own
                 disabled-state check, rather than a new prop. -->
            <span v-if="abilityCounters.doubleTimeArmed" class="doubleTimeArmedBadge">ARMED</span>
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
        <Transition name="ability-cue-pop">
            <div v-if="abilityCueText" :key="abilityCueKey" class="chaserAbilityCue">{{ abilityCueText }}</div>
        </Transition>
        <p
            v-if="displayName"
            class="playerName chaserPanelName"
            :class="{ 'chaserPanelName-banner': bannerPortrait }"
        >{{ displayName }}</p>

        <div
            v-if="isChaser && (visiblePassives.length > 0 || visibleActiveAbilities.length > 0)"
            class="chaserAbilityTray"
        >
            <div v-if="visiblePassives.length > 0" class="chaserAbilityPassiveRow">
                <span
                    v-for="passive in visiblePassives"
                    :key="passive.id"
                    class="p5-ability-chip p5-ability-chip-passive"
                    :data-tip="passiveTip(passive)"
                >{{ passive.name }}</span>
            </div>
            <div v-if="visibleActiveAbilities.length > 0" class="chaserAbilityActiveRow">
                <span
                    v-for="ability in visibleActiveAbilities"
                    :key="ability.id"
                    class="chaserAbilityBtnWrap"
                    :data-tip="abilityTip(ability)"
                >
                    <button
                        type="button"
                        class="chaserAbilityBtn"
                        :disabled="!isAbilityUsable(ability.id)"
                        @click="emit('use-ability', ability.id)"
                    >
                        <span class="chaserAbilityBtnName">{{ ability.name }}</span>
                        <span class="chaserAbilityBtnCharges">{{ chargesLabel(ability.id) }}</span>
                    </button>
                </span>
            </div>
        </div>

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
