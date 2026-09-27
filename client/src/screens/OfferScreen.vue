<script setup>
import { computed, ref, watch } from "vue";
import ChaserPanel from "../components/ChaserPanel.vue";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps({
    offer: { type: Object, default: null },
    mySeatId: { type: String, default: "" },
    players: { type: Array, default: () => [] },
    chaserSeatId: { type: String, default: "" },
    chaserCharacterId: { type: String, default: "" },
    chaserQuipText: { type: String, default: "" },
    chaserQuipKey: { type: Number, default: 0 },
    chaserPot: { type: Number, default: 0 },
    teamPot: { type: Number, default: 0 },
    // Per-seat face reaction store (ticket 103): seatId -> expression, see
    // App.vue's reactionsBySeat.
    reactions: { type: Object, default: () => ({}) },
    // Ticket 145: ability tray plumbing, passed straight through to
    // ChaserPanel — see App.vue for where these come from. No active
    // ability is usable during Offer (ChaserPanel's phase="offer" shows
    // passives only), so there's no abilityWindowOpen to compute here.
    abilityCounters: { type: Object, default: () => ({}) },
    abilityCueText: { type: String, default: "" },
    abilityCueKey: { type: Number, default: 0 }
});
const emit = defineEmits(["setLow", "setHigh", "choose", "send-quip", "use-ability"]);

// Mirrors server/src/gameConfig.ts OFFER — duplicated client-side the same
// way GamePhase is (see AGENTS.md gotchas): no shared module between the two
// npm projects. The former HAPPY_HIGH_THRESHOLD/SAD_LOW_THRESHOLD mirror
// (server/src/gameConfig.ts REACTION) is gone — the server now decides the
// reaction itself and broadcasts it (ticket 103), so this screen no longer
// needs to know the thresholds at all. The BOARD.startLow/startMiddle/
// startHigh mirror this screen used to also carry (for the old 7-space board
// visual) is gone too as of ticket 134 — those numbers are still real
// server-side config (they set the contestant's Chase starting space), just
// no longer something this screen renders; ChaseScreen.vue's own BOARD_SPACES
// is unrelated to this file and untouched.
const LOW_STEP = 100;
const HIGH_STEP = 1_000;

const lowInput = ref("");
const highInput = ref("");
const lowError = ref("");
const highError = ref("");

const hasMiddle = computed(() => props.offer?.middle !== null && props.offer?.middle !== undefined);
const hasLow = computed(() => props.offer?.low !== null && props.offer?.low !== undefined);
const hasHigh = computed(() => props.offer?.high !== null && props.offer?.high !== undefined);
// Ticket 147: Bezos's No Middle passive (ticket 143, server-authoritative —
// see messageHandlers.ts's offerChoice) voids the middle tier as a pickable
// offer. Read straight off the broadcast data App.vue already captures onto
// currentOffer (offerStart/offer messages) — no new plumbing needed here.
const isMiddleVoided = computed(() => !!props.offer?.middleVoided);
// A $0 middle has no real low offer (ticket 058) — the low tier plaque never
// reveals an amount in that case, same as the old board's low space always
// staying blank instead of duplicating the $0 shown at middle.
const showLowAmount = computed(() => hasLow.value && props.offer?.middle !== 0);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const isPickingContestant = computed(() => props.offer && props.mySeatId === props.offer.seatId);
// Once both offers are in, the picking contestant chooses by clicking the
// tier plaques themselves (no separate row of buttons repeating the same
// three amounts).
const canPick = computed(() => isPickingContestant.value && hasLow.value && hasHigh.value);

function canPickTier(tier) {
    if (!canPick.value) return false;
    if (tier === "low") return showLowAmount.value;
    if (tier === "middle") return !isMiddleVoided.value;
    return true;
}

function pickTier(tier) {
    if (canPickTier(tier)) emit("choose", tier);
}

// Screen-reader name for a tier plaque (its visible text is split across a
// label span and an amount span).
function tierLabel(tier, amount) {
    return amount === null ? `${tier} offer: not set yet` : `${tier} offer: ${formatAmount(amount)}`;
}

const contestantName = computed(() => {
    const player = props.players.find((p) => p.seatId === props.offer?.seatId);
    return player?.name ?? "The contestant";
});
const contestantCharacter = computed(() => {
    const player = props.players.find((p) => p.seatId === props.offer?.seatId);
    return player?.character ?? "";
});

function formatAmount(amount) {
    const abs = Math.abs(amount).toLocaleString("en-US");
    return amount < 0 ? `-$${abs}` : `$${abs}`;
}

// The Chaser's auto-quips are no longer picked here — the server sends the line
// inside the offerStart/offerLowSet/offer broadcasts (ticket 057) so every
// client shows the same text. This watch only resets the local input state.
watch(() => props.offer?.seatId, () => {
    lowInput.value = "";
    highInput.value = "";
    lowError.value = "";
    highError.value = "";
}, { immediate: true });

function validateLow(amount) {
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) return "Enter a whole number.";
    if (amount % LOW_STEP !== 0) return `Must be a multiple of ${LOW_STEP}.`;
    if (amount >= props.offer.middle) return "Must be less than the middle offer.";
    if (amount < 0 && -amount > props.teamPot) return "Would push the team pot below $0.";
    if (amount > 0 && amount > props.chaserPot) return "Exceeds your remaining pot.";
    return "";
}

function validateHigh(amount) {
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) return "Enter a whole number.";
    if (amount % HIGH_STEP !== 0) return `Must be a multiple of ${HIGH_STEP}.`;
    if (amount <= props.offer.middle) return "Must be more than the middle offer.";
    if (amount > props.chaserPot) return "Exceeds your remaining pot.";
    return "";
}

function submitLow() {
    const amount = Number(lowInput.value);
    const error = validateLow(amount);
    if (error) {
        lowError.value = error;
        return;
    }
    lowError.value = "";
    emit("setLow", amount);
}

function submitHigh() {
    const amount = Number(highInput.value);
    const error = validateHigh(amount);
    if (error) {
        highError.value = error;
        return;
    }
    highError.value = "";
    emit("setHigh", amount);
}
</script>

<template>
    <div class="offerScreen">
        <h2 class="lobbyTitle">The Offer</h2>

        <p v-if="!offer" class="status-text">Setting up the offer…</p>

        <template v-else>
            <p class="status-text offerSubtitle"><strong>{{ contestantName }}</strong> faces the Chaser</p>

            <div class="offerLayout">
                <ChaserPanel
                    :character-id="chaserCharacterId"
                    :quip-text="chaserQuipText"
                    :quip-key="chaserQuipKey"
                    :is-chaser="isChaser"
                    phase="offer"
                    :ability-counters="abilityCounters"
                    :ability-cue-text="abilityCueText"
                    :ability-cue-key="abilityCueKey"
                    @send-quip="emit('send-quip', $event)"
                    @use-ability="emit('use-ability', $event)"
                />

                <div class="offerTierPlaques" :class="{ 'offerTierPlaques-picking': canPick }">
                    <button
                        type="button"
                        class="moneyPlaque offerTierPlaque"
                        :disabled="!canPickTier('low')"
                        :aria-label="offer.middle === 0 ? 'Low offer: none' : tierLabel('Low', showLowAmount ? offer.low : null)"
                        @click="pickTier('low')"
                    >
                        <span class="who">Low</span>
                        <Transition name="offer-pop">
                            <span
                                v-if="showLowAmount"
                                key="low-amount"
                                class="amount"
                                :class="{ 'offer-amount-negative': offer.low < 0 }"
                            >{{ formatAmount(offer.low) }}</span>
                            <span v-else-if="offer.middle === 0" key="low-none" class="amount offerAmountPending">NONE</span>
                            <span v-else key="low-pending" class="amount offerAmountPending">?</span>
                        </Transition>
                    </button>
                    <button
                        type="button"
                        class="moneyPlaque offerTierPlaque"
                        :class="{ offerTierPlaqueVoided: isMiddleVoided }"
                        :disabled="!canPickTier('middle')"
                        :aria-label="isMiddleVoided ? 'Middle offer: voided' : tierLabel('Middle', hasMiddle ? offer.middle : null)"
                        @click="pickTier('middle')"
                    >
                        <span class="who">Middle</span>
                        <span v-if="isMiddleVoided" class="amount offerVoidStamp">No middle</span>
                        <Transition v-else name="offer-pop">
                            <span
                                v-if="hasMiddle"
                                key="middle-amount"
                                class="amount"
                                :class="{ 'offer-amount-negative': offer.middle < 0 }"
                            >{{ formatAmount(offer.middle) }}</span>
                            <span v-else key="middle-pending" class="amount offerAmountPending">?</span>
                        </Transition>
                    </button>
                    <button
                        type="button"
                        class="moneyPlaque offerTierPlaque"
                        :disabled="!canPickTier('high')"
                        :aria-label="tierLabel('High', hasHigh ? offer.high : null)"
                        @click="pickTier('high')"
                    >
                        <span class="who">High</span>
                        <Transition name="offer-pop">
                            <span
                                v-if="hasHigh"
                                key="high-amount"
                                class="amount"
                                :class="{ 'offer-amount-negative': offer.high < 0 }"
                            >{{ formatAmount(offer.high) }}</span>
                            <span v-else key="high-pending" class="amount offerAmountPending">?</span>
                        </Transition>
                    </button>
                </div>

                <div class="offerContestant">
                    <div class="board-portrait-circle offerContestantAvatar">
                        <CharacterFace :character="contestantCharacter" :reaction="reactions[offer.seatId] ?? 'neutral'" />
                    </div>
                    <p class="playerName chaserPanelName">{{ contestantName }}</p>
                </div>
            </div>

            <div class="offerControls">
                <template v-if="isChaser">
                    <template v-if="!hasLow || !hasHigh">
                        <p class="offerPot">Your pot <b>{{ formatAmount(chaserPot) }}</b></p>
                        <div class="offerInputRow">
                            <input
                                v-if="!hasLow"
                                v-model="lowInput"
                                type="number"
                                class="field offerInput"
                                :class="{ 'input-error': lowError }"
                                placeholder="Low offer"
                                :step="LOW_STEP"
                                @keyup.enter="submitLow"
                            />
                            <input
                                v-else
                                v-model="highInput"
                                type="number"
                                class="field offerInput"
                                :class="{ 'input-error': highError }"
                                placeholder="High offer"
                                :step="HIGH_STEP"
                                @keyup.enter="submitHigh"
                            />
                            <button v-if="!hasLow" class="btn btn-primary" @click="submitLow">Set low offer</button>
                            <button v-else class="btn btn-primary" @click="submitHigh">Set high offer</button>
                        </div>
                        <p class="offerErrorText">{{ !hasLow ? lowError : highError }}</p>
                    </template>
                    <p v-else class="status-text">Offers sent. Waiting for {{ contestantName }} to pick…</p>
                </template>

                <template v-else-if="isPickingContestant">
                    <p v-if="canPick" class="status-text">Pick an offer to play for. Higher offers start you closer to the Chaser.</p>
                    <p v-else class="status-text">The Chaser is setting your offers…</p>
                </template>

                <template v-else>
                    <p v-if="!hasLow" class="status-text">The Chaser is setting the offers for {{ contestantName }}…</p>
                    <p v-else-if="!hasHigh" class="status-text">
                        {{ offer.middle === 0 ? "No low offer this time. The Chaser is setting the high one…" : "The low offer is in. Now the high one…" }}
                    </p>
                    <p v-else class="status-text">Waiting for {{ contestantName }} to pick…</p>
                </template>
            </div>
        </template>
    </div>
</template>
