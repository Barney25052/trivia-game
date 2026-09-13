<script setup>
import { ref, computed, watch } from "vue";
import CharacterFace from "../components/CharacterFace.vue";
import { encodeCharacter, decodeCharacter } from "../character.ts";

const props = defineProps(["players", "isHost", "room", "chaserSelectionMode", "mySeatId"]);
const emit = defineEmits(["start", "setChaserMode", "setCharacter"]);
const settingsOpen = ref(false);

// Mirrors server/src/gameConfig.ts CHARACTER — duplicated client-side the
// same way GamePhase is (see AGENTS.md gotchas).
const HAIR_STYLE_COUNT = 5;
const FACE_STYLE_COUNT = 3;
const COLOUR_COUNT = 9;

// Reads the primitive `character` string directly off players.value on every
// access (rather than through an intermediate "myPlayer" object computed)
// for the same reason App.vue's activeContestantMoney/CorrectAnswers do
// (see its comment): a player's schema instance keeps the same object
// identity across state patches — only its properties mutate in place — so
// a computed that returns that stable object reference never re-fires, and
// anything built on top of it (isDirty below) goes stale after a save.
// players.value.find(...) re-running against a fresh array every patch,
// returning a primitive, keeps this one live.
const myCharacter = computed(
    () => props.players.find((p) => p.seatId === props.mySeatId)?.character ?? ""
);

// Local picker state, seeded from the player's own synced character the
// first time it's available (join assigns a random one server-side — ticket
// 101 — so this is never empty for long, but the picker mounts before that
// sync can land). Seeding only once avoids clobbering in-progress edits if
// players.value re-renders for an unrelated reason.
const pickerHairStyle = ref(0);
const pickerHairColour = ref(0);
const pickerFaceStyle = ref(0);
const pickerFaceColour = ref(0);
const pickerShirtColour = ref(0);
let seededFromServer = false;

watch(myCharacter, (character) => {
    if (seededFromServer || !character) return;
    const decoded = decodeCharacter(character);
    if (!decoded) return;
    pickerHairStyle.value = decoded.hairStyle;
    pickerHairColour.value = decoded.hairColour;
    pickerFaceStyle.value = decoded.faceStyle;
    pickerFaceColour.value = decoded.faceColour;
    pickerShirtColour.value = decoded.shirtColour;
    seededFromServer = true;
}, { immediate: true });

const previewCharacter = computed(() => encodeCharacter({
    hairStyle: pickerHairStyle.value,
    hairColour: pickerHairColour.value,
    faceStyle: pickerFaceStyle.value,
    faceColour: pickerFaceColour.value,
    shirtColour: pickerShirtColour.value
}));

const isDirty = computed(() => myCharacter.value !== previewCharacter.value);

function saveCharacter() {
    emit("setCharacter", { character: previewCharacter.value });
}

// Mirrors server/src/gameConfig.ts ROOM_SETTINGS.max_clients — duplicated to size the empty seats around the lobby circle.
const MAX_SEATS = 6;
const SEAT_RADIUS = 130;

const seats = computed(() => Array.from({ length: MAX_SEATS }, (_, i) => props.players[i] ?? null));

const seatPositions = computed(() =>
  seats.value.map((_, i) => {
    const angle = (-90 + (360 / MAX_SEATS) * i) * (Math.PI / 180);
    return {
      left: `calc(50% + ${Math.round(Math.cos(angle) * SEAT_RADIUS)}px)`,
      top: `calc(50% + ${Math.round(Math.sin(angle) * SEAT_RADIUS)}px)`,
    };
  })
);

const pokedSeatId = ref(null);
function poke(seatId) {
  pokedSeatId.value = null;
  requestAnimationFrame(() => {
    pokedSeatId.value = seatId;
  });
}

const copied = ref(false);
let copiedTimeout = null;
async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(props.room.roomId);
  } catch {
    return;
  }
  copied.value = true;
  clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => {
    copied.value = false;
  }, 1500);
}
</script>

<template>
    <div class="lobbyRow">
      <h1 class = "lobbyTitle">Host's Lobby</h1>
      <h3 class = "roomCode">
        Room Code: {{room.roomId}}
        <button class="roomCodeCopyButton" @click="copyRoomCode" :aria-label="copied ? 'Copied' : 'Copy room code'">
          <svg v-if="!copied" viewBox="0 0 24 24" class="roomCodeCopyIcon" aria-hidden="true">
            <rect x="7" y="7" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M4 15 L4 5 A1 1 0 0 1 5 4 L15 4" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="roomCodeCopyIcon" aria-hidden="true">
            <path d="M4 12 L9 18 L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </h3>

      <div class="lobbyCustomiserColumn">
        <div class="lobbyCharacterPicker">
          <h3 class="settingsTitle">Customize your look</h3>

          <div class="lobbyCharacterPreview">
            <CharacterFace :character="previewCharacter" reaction="neutral" />
          </div>

          <p class="lobbyCharacterLabel">Hairstyle</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in HAIR_STYLE_COUNT"
              :key="'hairStyle' + n"
              type="button"
              class="lobbyCharacterSwatchButton"
              :class="{ selected: pickerHairStyle === n - 1 }"
              :aria-label="'Hairstyle ' + n"
              @click="pickerHairStyle = n - 1"
            >{{ n }}</button>
          </div>

          <p class="lobbyCharacterLabel">Face</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in FACE_STYLE_COUNT"
              :key="'faceStyle' + n"
              type="button"
              class="lobbyCharacterSwatchButton"
              :class="{ selected: pickerFaceStyle === n - 1 }"
              :aria-label="'Face ' + n"
              @click="pickerFaceStyle = n - 1"
            >{{ n }}</button>
          </div>

          <p class="lobbyCharacterLabel">Hair colour</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in COLOUR_COUNT"
              :key="'hairColour' + n"
              type="button"
              class="lobbyCharacterColourSwatch"
              :class="{ selected: pickerHairColour === n - 1 }"
              :style="{ backgroundColor: `var(--character-colour-${n - 1})` }"
              :aria-label="'Hair colour ' + n"
              @click="pickerHairColour = n - 1"
            ></button>
          </div>

          <p class="lobbyCharacterLabel">Face colour</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in COLOUR_COUNT"
              :key="'faceColour' + n"
              type="button"
              class="lobbyCharacterColourSwatch"
              :class="{ selected: pickerFaceColour === n - 1 }"
              :style="{ backgroundColor: `var(--character-colour-${n - 1})` }"
              :aria-label="'Face colour ' + n"
              @click="pickerFaceColour = n - 1"
            ></button>
          </div>

          <p class="lobbyCharacterLabel">Shirt colour</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in COLOUR_COUNT"
              :key="'shirtColour' + n"
              type="button"
              class="lobbyCharacterColourSwatch"
              :class="{ selected: pickerShirtColour === n - 1 }"
              :style="{ backgroundColor: `var(--character-colour-${n - 1})` }"
              :aria-label="'Shirt colour ' + n"
              @click="pickerShirtColour = n - 1"
            ></button>
          </div>

          <button
            type="button"
            class="startButton lobbyCharacterSaveButton"
            :disabled="!isDirty"
            @click="saveCharacter"
          >{{ isDirty ? "Save" : "Saved" }}</button>
        </div>
      </div>

      <div class="lobby">
        <div class="lobbyCircle">
          <button
            v-if="isHost"
            class="lobbyTable lobbyStartButton"
            aria-label="Start game"
            @click="emit('start')"
          >
            <svg viewBox="0 0 24 24" class="lobbyStartIcon" aria-hidden="true">
              <path d="M8 5 L19 12 L8 19 Z" />
            </svg>
          </button>
          <div v-else class="lobbyTable"></div>
          <div
            v-for="(seatPlayer, i) in seats"
            :key="i"
            class="lobbySeat"
            :class="{ isEmpty: !seatPlayer }"
            :style="seatPositions[i]"
          >
            <div class="lobbyBust" :class="{ empty: !seatPlayer }">
              <div
                class="lobbyBustInner"
                :class="{ poked: seatPlayer && pokedSeatId === seatPlayer.seatId }"
                @click="seatPlayer && poke(seatPlayer.seatId)"
                @animationend="pokedSeatId = null"
              >
                <div v-if="seatPlayer" class="lobbyBustAvatar">
                  <CharacterFace :character="seatPlayer.character" reaction="neutral" />
                </div>
                <svg v-else viewBox="0 0 100 90" class="lobbyBustSvg" aria-hidden="true">
                  <circle cx="50" cy="30" r="24" />
                  <circle cx="50" cy="100" r="46" />
                </svg>
                <svg v-if="seatPlayer?.isHost" viewBox="0 0 100 60" class="lobbyCrown" aria-hidden="true">
                  <path d="M8,52 L18,14 L38,34 L50,8 L62,34 L82,14 L92,52 Z" />
                </svg>
              </div>
            </div>
            <div class="lobbySeatName">{{ seatPlayer ? seatPlayer.name : "Open seat" }}</div>
          </div>
        </div>
      </div>

      <div class="lobbySettingsColumn">
        <template v-if="isHost">
          <button @click="settingsOpen = !settingsOpen" class="settingsButton" aria-haspopup="true" :aria-expanded="settingsOpen">
            {{ settingsOpen ? "Close Settings" : "Settings" }}
          </button>
          <aside v-if="settingsOpen" class = "settingsDropdown">
            <h3 class = "settingsTitle">How do we pick the Chaser?</h3>
            <div class = "modeRow">
              <button
                class="modeButton"
                :class = "{ selected: chaserSelectionMode === 'random' }"
                @click="emit('setChaserMode', { mode: 'random' })"
              >
                Random
              </button>
              <button
                class="modeButton"
                :class = "{ selected: chaserSelectionMode === 'vote' }"
                @click="emit('setChaserMode', { mode: 'vote' })"
              >
                Team Vote
              </button>
            </div>
          </aside>
        </template>
      </div>
    </div>
</template>