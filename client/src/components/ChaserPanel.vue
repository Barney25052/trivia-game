<script setup>
import { ref, computed } from "vue";
import { chaserPortrait, CHASER_NAMES } from "../chaserPortraits.ts";
import { CHASER_ABILITY_COPY, SHARED_CHASER_ABILITY_COPY } from "../chaserAbilities.ts";
import ChaserSilhouette from "./ChaserSilhouette.vue";

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
    // Hides the composable taunt input row (ticket 097) — the
    // Chaser Final passes false so the Chaser only tabs into the answer
    // input. The bubble and broadcast quips still render either way.
    quipInput: { type: Boolean, default: true },
    // Chase-board mode (ticket 116): the countdown badge, the Double Time
    // "Armed" badge and the Chaser's ability buttons all sit on the portrait's
    // rim, with no tray/quip input below — the board row can't grow taller
    // than the board beside it. Offer uses the default (tray below).
    rimControls: { type: Boolean, default: false },
    // Small VT323 countdown badge overlapping the circle's edge (ticket 116)
    // — only meaningful alongside rimControls. null hides the badge
    // entirely; a number shows it. See ChaseScreen.vue's lockoutBadgeSide for
    // how the caller decides whether this side gets the badge.
    countdownSeconds: { type: Number, default: null },
    countdownUrgent: { type: Boolean, default: false },
    // Ticket 117: the Chaser Final's own-turn banner — a bare, frame-free
    // cutout portrait (no circle) with a big drop-shadow and a VT323 name
    // underneath, mirroring ChaseScreen.vue's cutscene portrait
    // (.chaseCutsceneChaser). Every other caller gets the circle portrait.
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

const portrait = computed(() => chaserPortrait(props.characterId));
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
        return ABILITY_TABLE_ROUND_FLAG[id] ? "Already used this chase" : "No uses left";
    }
    if (id === "doubleTime" && props.abilityCounters.doubleTimeArmed) {
        return "Already armed for the next chase question";
    }
    if (!props.abilityWindowOpen) {
        return "Can't use it right now";
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

// Ticket (Chase board layout redesign): in rimControls mode the abilities
// render as tiny circular buttons on the portrait rim instead of the full
// below-portrait tray (which was pushing the Chase table's layout out of
// alignment with the board/contestant panel — neither of which grow in
// height, so the tray's extra rows offset the whole row). Short 2-letter
// labels since there's no room for the full name; the tooltip carries the
// full name + charges + description instead.
const ABILITY_SHORT_LABEL = {
    fiftyFifty: "50",
    doubleTime: "2X",
    reRack: "RR",
    jumble: "JM",
    skip: "SK"
};
function abilityShortLabel(id) {
    return ABILITY_SHORT_LABEL[id] ?? id.slice(0, 2).toUpperCase();
}
function miniAbilityTip(ability) {
    const base = `${ability.name} (${chargesLabel(ability.id)} left). ${ability.description}`;
    const reason = disabledReason(ability.id);
    return reason ? `${base} ${reason}.` : base;
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
    <div class="chaserPanel" :class="{ 'chaserPanel-banner': bannerPortrait }">
        <div v-if="bannerPortrait" class="chaserStageBanner">
            <img
                v-if="portrait"
                :src="portrait"
                :alt="displayName"
                class="chaserStageBannerImg"
            />
            <ChaserSilhouette v-else class="chaserStageBannerImg" />
        </div>
        <div v-else class="board-portrait-wrap chaser-wrap">
            <div class="board-portrait-circle">
                <img
                    v-if="portrait"
                    :src="portrait"
                    :alt="displayName"
                    class="board-portrait-img"
                />
                <ChaserSilhouette v-else />
            </div>
            <template v-if="rimControls">
                <div
                    v-if="countdownSeconds !== null"
                    class="countdown-chip chaseCountdownBadge"
                    :class="{ urgent: countdownUrgent }"
                >
                    <span class="countdown-num">{{ countdownSeconds }}</span>
                </div>
                <!-- Ticket 146: armed for exactly one chase question — public
                     GameState, read off the same abilityCounters prop the
                     ability buttons use for their own disabled state. -->
                <span v-if="abilityCounters.doubleTimeArmed" class="chip chip-gold doubleTimeArmedBadge">Armed</span>

                <!-- The Chaser's active abilities as small discs on the
                     portrait rim (see miniAbilityTip's comment) — no passives
                     here, every character's passives are Offer/Final-only. -->
                <div v-if="isChaser && visibleActiveAbilities.length > 0" class="chaserAbilityMiniRow">
                    <span
                        v-for="ability in visibleActiveAbilities"
                        :key="ability.id"
                        class="chaserAbilityMiniWrap"
                        :data-tip="miniAbilityTip(ability)"
                    >
                        <button
                            type="button"
                            class="chaserAbilityMiniBtn"
                            :disabled="!isAbilityUsable(ability.id)"
                            :aria-label="ability.name"
                            @click="emit('use-ability', ability.id)"
                        >{{ abilityShortLabel(ability.id) }}</button>
                    </span>
                </div>
            </template>
        </div>
        <Transition name="chaser-bubble-pop">
            <div v-if="quipText" :key="quipKey" class="chaserPanelBubble">{{ quipText }}</div>
        </Transition>
        <Transition name="chaser-bubble-pop">
            <div v-if="answerText" :key="answerKey" class="chaserPanelBubble chaserPanelAnswerBubble">{{ answerText }}</div>
        </Transition>
        <Transition name="ability-cue-pop">
            <div v-if="abilityCueText" :key="abilityCueKey" class="chip chip-gold chaserAbilityCue">{{ abilityCueText }}</div>
        </Transition>
        <!-- Name, abilities and taunt input. In the Offer/Chase modes these
             just continue the panel's column (display: contents); the
             Chaser Final banner lays them out beside the portrait. -->
        <div class="chaserPanelInfo">
            <span v-if="bannerPortrait" class="chaserPanelEyebrow">The Chaser</span>
            <p
                v-if="displayName"
                class="playerName chaserPanelName"
                :class="{ 'chaserPanelName-banner': bannerPortrait }"
            >{{ displayName }}</p>

            <div
                v-if="!rimControls && isChaser && (visiblePassives.length > 0 || visibleActiveAbilities.length > 0)"
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

            <div v-if="!rimControls && isChaser && quipInput" class="chaserPanelInputRow">
                <input
                    v-model="quipDraft"
                    type="text"
                    class="field chaserPanelInput"
                    placeholder="Taunt them…"
                    :maxlength="MAX_QUIP_LENGTH"
                    @keyup.enter="submitQuip"
                />
                <button class="btn btn-primary btn-small" :disabled="sendDisabled" @click="submitQuip">
                    Send
                </button>
            </div>
        </div>
    </div>
</template>
