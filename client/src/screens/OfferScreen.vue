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
    teamPot: { type: Number, default: 0 }
});
const emit = defineEmits(["setLow", "setHigh", "choose", "send-quip"]);

// Mirrors server/src/gameConfig.ts OFFER + BOARD — duplicated client-side the
// same way GamePhase is (see AGENTS.md gotchas): no shared module between the
// two npm projects.
const LOW_STEP = 100;
const HIGH_STEP = 1_000;
const HAPPY_HIGH_THRESHOLD = 50_000;
const SAD_LOW_THRESHOLD = 0;
const BOARD_SPACES = [7, 6, 5, 4, 3, 2, 1];
const LOW_SPACE = 4;
const MIDDLE_SPACE = 5;
const HIGH_SPACE = 6;

const lowInput = ref("");
const highInput = ref("");
const lowError = ref("");
const highError = ref("");

const hasMiddle = computed(() => props.offer?.middle !== null && props.offer?.middle !== undefined);
const hasLow = computed(() => props.offer?.low !== null && props.offer?.low !== undefined);
const hasHigh = computed(() => props.offer?.high !== null && props.offer?.high !== undefined);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const isPickingContestant = computed(() => props.offer && props.mySeatId === props.offer.seatId);

const contestantName = computed(() => {
    const player = props.players.find((p) => p.seatId === props.offer?.seatId);
    return player?.name ?? "The contestant";
});
const contestantCharacter = computed(() => {
    const player = props.players.find((p) => p.seatId === props.offer?.seatId);
    return player?.character ?? "";
});

// The happy/sad reaction is still computed here and handed to CharacterFace,
// but reaction rendering itself is deferred to ticket 103 — the component
// renders neutral for any value until then (see CharacterFace.vue).
const reaction = computed(() => {
    if (hasHigh.value && props.offer.high > HAPPY_HIGH_THRESHOLD) return "happy";
    if (hasLow.value && props.offer.middle !== 0 && props.offer.low <= SAD_LOW_THRESHOLD) return "sad";
    return "neutral";
});

function formatAmount(amount) {
    const abs = Math.abs(amount).toLocaleString("en-US");
    return amount < 0 ? `-$${abs}` : `$${abs}`;
}

function amountFor(space) {
    if (space === MIDDLE_SPACE) return hasMiddle.value ? props.offer.middle : null;
    // A $0 middle has no real low offer (ticket 058) — the board's low space
    // stays blank instead of duplicating the $0 shown at middle.
    if (space === LOW_SPACE) return hasLow.value && props.offer.middle !== 0 ? props.offer.low : null;
    if (space === HIGH_SPACE) return hasHigh.value ? props.offer.high : null;
    return null;
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
    <div class="lobby offerScreen">
        <h2 class="lobbyTitle">The Offer</h2>

        <div v-if="!offer" class="playerName">Setting up the offer…</div>

        <template v-else>
            <p class="playerName">{{ contestantName }} faces the Chaser</p>

            <div class="offerLayout">
                <ChaserPanel
                    :character-id="chaserCharacterId"
                    :quip-text="chaserQuipText"
                    :quip-key="chaserQuipKey"
                    :is-chaser="isChaser"
                    @send-quip="emit('send-quip', $event)"
                />

                <div class="offerBoard">
                    <div v-for="space in BOARD_SPACES" :key="space" class="offerBoardSpace">
                        <span class="offerSpaceNumber">{{ space }}</span>
                        <Transition name="offer-pop">
                            <span
                                v-if="amountFor(space) !== null"
                                :key="space"
                                class="offerSpaceAmount"
                                :class="{ 'offer-amount-negative': amountFor(space) <= 0 }"
                            >{{ formatAmount(amountFor(space)) }}</span>
                        </Transition>
                    </div>
                </div>

                <div class="offerContestantBox">
                    <div class="offerContestantMaskBox">
                        <CharacterFace :character="contestantCharacter" :reaction="reaction" />
                    </div>
                    <p class="playerName offerChaserName">{{ contestantName }}</p>
                </div>
            </div>

            <div class="offerControls">
                <template v-if="isChaser">
                    <p class="playerName offerPot">Your pot: {{ formatAmount(chaserPot) }}</p>
                    <div v-if="!hasLow" class="offerInputRow">
                        <input
                            v-model="lowInput"
                            type="number"
                            class="offerInput"
                            :class="{ 'input-error': lowError }"
                            placeholder="Low offer"
                            @keyup.enter="submitLow"
                        />
                        <button class="startButton" @click="submitLow">Set low offer</button>
                        <p v-if="lowError" class="playerName offerErrorText">{{ lowError }}</p>
                    </div>
                    <div v-else-if="!hasHigh" class="offerInputRow">
                        <input
                            v-model="highInput"
                            type="number"
                            class="offerInput"
                            :class="{ 'input-error': highError }"
                            placeholder="High offer"
                            @keyup.enter="submitHigh"
                        />
                        <button class="startButton" @click="submitHigh">Set high offer</button>
                        <p v-if="highError" class="playerName offerErrorText">{{ highError }}</p>
                    </div>
                    <p v-else class="playerName">Offers sent — waiting for {{ contestantName }} to pick…</p>
                </template>

                <template v-else-if="isPickingContestant">
                    <template v-if="hasLow && hasHigh">
                        <div class="offerTierRow">
                            <button
                                v-if="offer.middle !== 0"
                                class="startButton offerTierButton"
                                @click="emit('choose', 'low')"
                            >
                                <span :class="{ 'offer-amount-negative': offer.low <= 0 }">Low — {{ formatAmount(offer.low) }}</span>
                            </button>
                            <button class="startButton offerTierButton" @click="emit('choose', 'middle')">
                                Middle — {{ formatAmount(offer.middle) }}
                            </button>
                            <button class="startButton offerTierButton" @click="emit('choose', 'high')">
                                High — {{ formatAmount(offer.high) }}
                            </button>
                        </div>
                        <p class="playerName">Pick the offer you want to play for.</p>
                    </template>
                    <p v-else class="playerName">Waiting for the Chaser to set your offers…</p>
                </template>

                <template v-else>
                    <p v-if="!hasLow" class="playerName">The Chaser is setting the offers for {{ contestantName }}…</p>
                    <p v-else-if="!hasHigh" class="playerName">The low offer is in — the Chaser is deciding the high…</p>
                    <p v-else class="playerName">Waiting for {{ contestantName }} to pick…</p>
                </template>
            </div>
        </template>
    </div>
</template>
