<script setup>
import { computed, ref, watch } from "vue";
import { ChaserCharacter } from "../TriviaTypes.ts";
import bezosIcon from "../assets/images/chasers/bezos-icon.png";
import bigStanIcon from "../assets/images/chasers/bigstan-icon.png";
import namiIcon from "../assets/images/chasers/nami-icon.png";
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
import eyesHappy from "../assets/images/eyes-happy.png";
import eyesSad from "../assets/images/eyes-sad.png";
import mouthNeutral from "../assets/images/mouth.png";
import mouthHappy from "../assets/images/mouth-happy.png";
import mouthSad from "../assets/images/mouth-sad.png";

const props = defineProps({
    offer: { type: Object, default: null },
    mySeatId: { type: String, default: "" },
    players: { type: Array, default: () => [] },
    chaserSeatId: { type: String, default: "" },
    chaserPot: { type: Number, default: 0 },
    teamPot: { type: Number, default: 0 }
});
const emit = defineEmits(["setLow", "setHigh", "choose"]);

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

const chaserPortraits = {
    [ChaserCharacter.Bezos]: bezosIcon,
    [ChaserCharacter.BigStan]: bigStanIcon,
    [ChaserCharacter.Nami]: namiIcon
};

const faceImages = [face1, face2, face3];
const hairImages = [hair1, hair2, hair3, hair4, hair5, hair6];
const neutralEyesImages = [eyesNeutral1, eyesNeutral2];

const QUIPS = {
    start: [
        "Let's see what we're working with.",
        "This should be fun.",
        "Time to make an offer."
    ],
    low: [
        "How does that feel?",
        "Not so friendly, is it?",
        "Let's keep this tight."
    ],
    high: [
        "Now we're talking numbers.",
        "That's a real temptation.",
        "Don't get greedy now."
    ]
};

const lowInput = ref("");
const highInput = ref("");
const lowError = ref("");
const highError = ref("");
const quip = ref("");

const hasMiddle = computed(() => props.offer?.middle !== null && props.offer?.middle !== undefined);
const hasLow = computed(() => props.offer?.low !== null && props.offer?.low !== undefined);
const hasHigh = computed(() => props.offer?.high !== null && props.offer?.high !== undefined);

const isChaser = computed(() => props.mySeatId !== "" && props.mySeatId === props.chaserSeatId);
const isPickingContestant = computed(() => props.offer && props.mySeatId === props.offer.seatId);

const contestantName = computed(() => {
    const player = props.players.find((p) => p.seatId === props.offer?.seatId);
    return player?.name ?? "The contestant";
});

const chaserPortrait = computed(() => chaserPortraits[props.offer?.chaserCharacterId] ?? null);

function seatSeed(text) {
    let hash = 0;
    for (const char of text) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return hash;
}

const faceImg = computed(() => {
    if (!props.offer?.seatId) return face1;
    return faceImages[seatSeed(props.offer.seatId) % faceImages.length];
});
const hairImg = computed(() => {
    if (!props.offer?.seatId) return hair1;
    return hairImages[seatSeed(`${props.offer.seatId}-hair`) % hairImages.length];
});
const neutralEyesImg = computed(() => {
    if (!props.offer?.seatId) return eyesNeutral1;
    return neutralEyesImages[seatSeed(`${props.offer.seatId}-eyes`) % neutralEyesImages.length];
});

const reaction = computed(() => {
    if (hasHigh.value && props.offer.high > HAPPY_HIGH_THRESHOLD) return "happy";
    if (hasLow.value && props.offer.low <= SAD_LOW_THRESHOLD) return "sad";
    return "neutral";
});
const eyesImg = computed(() => {
    if (reaction.value === "happy") return eyesHappy;
    if (reaction.value === "sad") return eyesSad;
    return neutralEyesImg.value;
});
const mouthImg = computed(() => {
    if (reaction.value === "happy") return mouthHappy;
    if (reaction.value === "sad") return mouthSad;
    return mouthNeutral;
});

function formatAmount(amount) {
    const abs = Math.abs(amount).toLocaleString("en-US");
    return amount < 0 ? `-$${abs}` : `$${abs}`;
}

function amountFor(space) {
    if (space === MIDDLE_SPACE) return hasMiddle.value ? props.offer.middle : null;
    if (space === LOW_SPACE) return hasLow.value ? props.offer.low : null;
    if (space === HIGH_SPACE) return hasHigh.value ? props.offer.high : null;
    return null;
}

function pickQuip(stage) {
    const pool = QUIPS[stage];
    quip.value = pool[Math.floor(Math.random() * pool.length)];
}

watch(() => props.offer?.seatId, (seatId) => {
    if (seatId) pickQuip("start");
    lowInput.value = "";
    highInput.value = "";
    lowError.value = "";
    highError.value = "";
}, { immediate: true });
watch(hasLow, (revealed) => { if (revealed) pickQuip("low"); });
watch(hasHigh, (revealed) => { if (revealed) pickQuip("high"); });

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
                <div class="offerChaserBox">
                    <div class="offerMaskBox">
                        <img
                            v-if="chaserPortrait"
                            :src="chaserPortrait"
                            :alt="offer.chaserCharacterName"
                            class="offerChaserPortrait"
                        />
                    </div>
                    <Transition name="offer-pop">
                        <div v-if="quip" :key="quip" class="offerSpeechBubble">{{ quip }}</div>
                    </Transition>
                    <p v-if="offer.chaserCharacterName" class="playerName offerChaserName">
                        {{ offer.chaserCharacterName }}
                    </p>
                </div>

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
                        <div class="offerFaceWrap">
                            <div class="offerShoulders"></div>
                            <img :src="faceImg" class="offerFaceLayer" alt="" />
                            <img :src="hairImg" class="offerFaceLayer" alt="" />
                            <img :src="eyesImg" class="offerFaceLayer" alt="" />
                            <img :src="mouthImg" class="offerFaceLayer" alt="" />
                        </div>
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
                            <button class="startButton offerTierButton" @click="emit('choose', 'low')">
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
