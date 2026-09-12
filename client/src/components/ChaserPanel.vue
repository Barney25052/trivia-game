<script setup>
import { ref, computed } from "vue";
import { ChaserCharacter } from "../TriviaTypes.ts";
import bezosIcon from "../assets/images/chasers/bezos-icon.png";
import bigStanIcon from "../assets/images/chasers/bigstan-icon.png";
import namiIcon from "../assets/images/chasers/nami-icon.png";

// Mirrors server/src/gameConfig.ts CHASER_QUIP.maxLength — duplicated
// client-side the same way GamePhase is (see AGENTS.md gotchas).
const MAX_QUIP_LENGTH = 140;
const SEND_COOLDOWN_MS = 1500;

const props = defineProps({
    characterId: { type: String, default: "" },
    quipText: { type: String, default: "" },
    quipKey: { type: Number, default: 0 },
    isChaser: { type: Boolean, default: false }
});
const emit = defineEmits(["send-quip"]);

const portraits = {
    [ChaserCharacter.Bezos]: bezosIcon,
    [ChaserCharacter.BigStan]: bigStanIcon,
    [ChaserCharacter.Nami]: namiIcon
};
const names = {
    [ChaserCharacter.Bezos]: "Bezos",
    [ChaserCharacter.BigStan]: "Big Stan",
    [ChaserCharacter.Nami]: "Nami"
};

const portrait = computed(() => portraits[props.characterId] ?? null);
const displayName = computed(() => names[props.characterId] ?? "");

const quipInput = ref("");
const onCooldown = ref(false);
let cooldownTimeout = null;

const sendDisabled = computed(() => {
    const trimmed = quipInput.value.trim();
    return onCooldown.value || trimmed.length === 0 || trimmed.length > MAX_QUIP_LENGTH;
});

function submitQuip() {
    const text = quipInput.value.trim();
    if (onCooldown.value || text.length === 0 || text.length > MAX_QUIP_LENGTH) return;
    emit("send-quip", text);
    quipInput.value = "";
    onCooldown.value = true;
    if (cooldownTimeout) clearTimeout(cooldownTimeout);
    cooldownTimeout = setTimeout(() => {
        onCooldown.value = false;
    }, SEND_COOLDOWN_MS);
}
</script>

<template>
    <div class="chaserPanel">
        <div class="chaserPanelMask">
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
        <p v-if="displayName" class="playerName chaserPanelName">{{ displayName }}</p>

        <div v-if="isChaser" class="chaserPanelInputRow">
            <input
                v-model="quipInput"
                type="text"
                class="chaserPanelInput"
                placeholder="Say something..."
                :maxlength="MAX_QUIP_LENGTH"
                @keyup.enter="submitQuip"
            />
            <button class="startButton chaserPanelSend" :disabled="sendDisabled" @click="submitQuip">
                Send
            </button>
        </div>
    </div>
</template>
