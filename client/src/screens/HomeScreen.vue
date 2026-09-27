<script setup>
import { ref, watch } from "vue";
import logo from "../../images/logo.png?inline";

const props = defineProps({
  // A join/create is in flight (App.vue) — the buttons wait for it.
  joining: { type: Boolean, default: false },
  // Why the last join/create failed, already worded for players.
  error: { type: String, default: "" },
  // Why the player landed back here if they didn't choose to (the host
  // left, the connection dropped).
  notice: { type: String, default: "" }
});
const emit = defineEmits(["join", "create", "add-questions"]);

// Mirrors server/src/gameConfig.ts PLAYER_NAME.maxLength — the server
// rejects the join outright past this, so stop typing at the limit instead.
const MAX_NAME_LENGTH = 24;

// The last name used on this device, so coming back to Home (after a game,
// or when the host leaves) doesn't mean typing it again. Storage can be
// unavailable (private windows, blocked site data) — then it just starts
// empty, as before.
const NAME_STORAGE_KEY = "bigBawsTrivia.playerName";

function loadSavedName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Not remembering the name is harmless.
  }
}

const playerName = ref(loadSavedName());
const roomCode = ref("");
const nameEmptyError = ref(false);
const codeEmptyError = ref(false);
// Which button started the in-flight request, so only that one says so.
const pendingAction = ref("");

// Room codes are uppercase letters (server/src/gameConfig.ts ROOM_CODE), so
// whatever case is typed, the field shows (and joins with) uppercase.
watch(roomCode, (value) => {
  const normalised = value.toUpperCase().replace(/\s+/g, "");
  if (normalised !== value) roomCode.value = normalised;
});

watch(() => props.joining, (joining) => {
  if (!joining) pendingAction.value = "";
});

function flash(errorRef) {
  errorRef.value = false;
  requestAnimationFrame(() => {
    errorRef.value = true;
  });
}

function handleJoin() {
  if (props.joining) return;
  const nameMissing = !playerName.value.trim();
  const codeMissing = !roomCode.value.trim();
  if (nameMissing) flash(nameEmptyError);
  if (codeMissing) flash(codeEmptyError);
  if (nameMissing || codeMissing) return;
  pendingAction.value = "join";
  saveName(playerName.value.trim());
  emit("join", { playerName: playerName.value, roomCode: roomCode.value });
}

function handleCreate() {
  if (props.joining) return;
  if (!playerName.value.trim()) {
    flash(nameEmptyError);
    return;
  }
  pendingAction.value = "create";
  saveName(playerName.value.trim());
  emit("join", { playerName: playerName.value, roomCode: "" });
}

function handleAddQuestions() {
  emit("add-questions");
}
</script>

<template>
  <div class="home">
      <div class="rotate"><img :src="logo" class="logo" alt="Big Baws Online Trivia"></div>
      <div class="homeInputs">
        <input
          v-model="playerName"
          placeholder="Your name"
          class="field"
          :class="{ 'input-error': nameEmptyError }"
          :maxlength="MAX_NAME_LENGTH"
          autocomplete="off"
          @animationend="nameEmptyError = false"
        />
        <input
          v-model="roomCode"
          placeholder="Room code"
          class="field"
          :class="{ 'input-error': codeEmptyError }"
          autocomplete="off"
          spellcheck="false"
          @animationend="codeEmptyError = false"
          @keyup.enter="handleJoin"
        />
        <div class="homeButtonHolder">
          <button @click="handleJoin" class="btn btn-primary" :disabled="joining">
            {{ pendingAction === "join" ? "Joining…" : "Join lobby" }}
          </button>
          <button @click="handleCreate" class="btn btn-outline" :disabled="joining">
            {{ pendingAction === "create" ? "Creating…" : "Create lobby" }}
          </button>
        </div>
        <!-- Always rendered (empty when there's nothing to say) so a message
             appearing never pushes the link below it down. -->
        <p class="homeMessage" :class="{ 'homeMessage-error': error }" role="status">{{ error || notice }}</p>
        <button @click="handleAddQuestions" class="addQuestionsLink">Add questions</button>
      </div>
  </div>
</template>
