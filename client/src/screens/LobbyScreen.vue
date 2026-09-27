<script setup>
import { ref, computed, watch } from "vue";
import CharacterFace from "../components/CharacterFace.vue";
import { encodeCharacter, decodeCharacter } from "../character.ts";
import { preloadImages } from "../assetPreload.js";

const props = defineProps(["players", "isHost", "room", "chaserSelectionMode", "mySeatId"]);
const emit = defineEmits(["start", "setChaserMode", "setCharacter"]);

// The game needs a Chaser plus at least one contestant — the server rejects a
// start with fewer (gameFlow.ts startGame), so the play button says so up
// front instead of silently doing nothing.
const MIN_PLAYERS = 2;
const hostName = computed(() => props.players.find((p) => p.isHost)?.name ?? "");
const lobbyTitle = computed(() => (hostName.value ? `${hostName.value}'s Lobby` : "Lobby"));
const canStart = computed(() => props.players.length >= MIN_PLAYERS);
const startHint = computed(() => {
    if (!props.isHost) return `Waiting for ${hostName.value || "the host"} to start`;
    return canStart.value ? "Press play when everyone's in" : `Need ${MIN_PLAYERS} players to start`;
});

// Ticket 109: this screen is the earliest and highest-density real usage of
// the CharacterFace art — the live preview repaints on every swatch click,
// and every seated player gets their own bust the moment they join. Gating
// both on the same awaitable preloadImages() promise App.vue already kicked
// off at module scope (memoized there, so this doesn't trigger a second wave
// of image requests) means that by the time either renders, the browser's
// image cache is already warm and every layer paints in one frame instead of
// popping in piecemeal as each layer's own fetch happens to finish. Only
// gates this screen, not app boot generally — proportionate to where the
// stall was actually reported.
const assetsReady = ref(false);
preloadImages().then(() => {
    assetsReady.value = true;
});

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

// The picker's current look with one part swapped: the hairstyle and face
// options each show your own character wearing that option, instead of a
// bare number.
function previewWith(change) {
    return encodeCharacter({
        hairStyle: pickerHairStyle.value,
        hairColour: pickerHairColour.value,
        faceStyle: pickerFaceStyle.value,
        faceColour: pickerFaceColour.value,
        shirtColour: pickerShirtColour.value,
        ...change
    });
}

const previewCharacter = computed(() => previewWith({}));

const isDirty = computed(() => myCharacter.value !== previewCharacter.value);

function saveCharacter() {
    emit("setCharacter", { character: previewCharacter.value });
}

// Mirrors server/src/gameConfig.ts ROOM_SETTINGS.max_clients — duplicated to size the empty seats around the lobby circle.
const MAX_SEATS = 6;
// Ticket 119: bumped alongside the ring growing from 380px to 440px
// (.lobbyCircle in style.css) so seat content (crown + bust + name) sits
// with real clearance inside the ring's silhouette instead of flush against
// its edge — the position math itself (the angle formula below) is
// unchanged, only this distance.
const SEAT_RADIUS = 150;

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
      <h1 class="lobbyTitle">{{ lobbyTitle }}</h1>
      <div class="lobbyRoomBadgeRow">
        <div class="ticket-badge">
          <span class="ticket-label">Room code</span>
          <span class="code">{{ room.roomId }}</span>
          <span class="divider"></span>
          <button class="roomCodeCopyButton" @click="copyRoomCode" :aria-label="copied ? 'Copied' : 'Copy room code'">
            <svg v-if="!copied" viewBox="0 0 24 24" class="roomCodeCopyIcon" aria-hidden="true">
              <rect x="7" y="7" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M4 15 L4 5 A1 1 0 0 1 5 4 L15 4" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="roomCodeCopyIcon" aria-hidden="true">
              <path d="M4 12 L9 18 L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div class="lobbyCustomiserColumn">
        <div class="panel lobbyCharacterPicker">
          <h3 class="panel-title">Customise your look</h3>

          <div class="board-portrait-circle lobbyCharacterPreview">
            <CharacterFace v-if="assetsReady" :character="previewCharacter" reaction="neutral" />
          </div>

          <p class="lobbyCharacterLabel">Hairstyle</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in HAIR_STYLE_COUNT"
              :key="'hairStyle' + n"
              type="button"
              class="lobbyStyleOption"
              :class="{ selected: pickerHairStyle === n - 1 }"
              :aria-label="'Hairstyle ' + n"
              :aria-pressed="pickerHairStyle === n - 1"
              @click="pickerHairStyle = n - 1"
            >
              <span class="board-portrait-circle lobbyStyleOptionFace">
                <CharacterFace v-if="assetsReady" :character="previewWith({ hairStyle: n - 1 })" reaction="neutral" />
              </span>
            </button>
          </div>

          <p class="lobbyCharacterLabel">Face</p>
          <div class="lobbyCharacterRow">
            <button
              v-for="n in FACE_STYLE_COUNT"
              :key="'faceStyle' + n"
              type="button"
              class="lobbyStyleOption"
              :class="{ selected: pickerFaceStyle === n - 1 }"
              :aria-label="'Face ' + n"
              :aria-pressed="pickerFaceStyle === n - 1"
              @click="pickerFaceStyle = n - 1"
            >
              <span class="board-portrait-circle lobbyStyleOptionFace">
                <CharacterFace v-if="assetsReady" :character="previewWith({ faceStyle: n - 1 })" reaction="neutral" />
              </span>
            </button>
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
            class="btn btn-primary lobbyCharacterSaveButton"
            :disabled="!isDirty"
            @click="saveCharacter"
          >{{ isDirty ? "Save look" : "Saved" }}</button>
        </div>
      </div>

      <div class="lobbyTableColumn">
        <div class="lobbyCircle">
          <button
            v-if="isHost"
            class="lobby-start-btn"
            aria-label="Start game"
            :disabled="!canStart"
            @click="emit('start')"
          ><span class="lobby-play-triangle"></span></button>
          <div
            v-for="(seatPlayer, i) in seats"
            :key="i"
            class="lobbySeat"
            :class="{ isEmpty: !seatPlayer }"
            :style="seatPositions[i]"
          >
            <svg v-if="seatPlayer?.isHost" viewBox="0 0 100 60" class="lobbyCrown" aria-hidden="true">
              <path d="M8,52 L18,14 L38,34 L50,8 L62,34 L82,14 L92,52 Z" />
            </svg>
            <div
                v-if="seatPlayer"
                class="board-portrait-circle lobbySeatCircle"
                :class="{ poked: pokedSeatId === seatPlayer.seatId }"
                @click="poke(seatPlayer.seatId)"
                @animationend="pokedSeatId = null"
            >
              <CharacterFace v-if="assetsReady" :character="seatPlayer.character" reaction="neutral" />
            </div>
            <div v-else class="lobbyEmptyCircle"></div>
            <div class="lobbySeatName">{{ seatPlayer ? seatPlayer.name : "Open seat" }}</div>
          </div>
        </div>
      </div>

      <div class="lobbySettingsColumn">
        <div class="panel lobbySidePanel">
          <h3 class="panel-title">{{ isHost ? "Game settings" : "Get ready" }}</h3>

          <p class="lobbyCharacterLabel">Players</p>
          <p class="lobbyPlayerCount"><b>{{ players.length }}</b> / {{ MAX_SEATS }}</p>

          <p class="lobbyCharacterLabel">Picking the Chaser</p>
          <div v-if="isHost" class="segmented" role="group" aria-label="How the Chaser is picked">
            <button
              type="button"
              class="segmented-option"
              :class="{ selected: chaserSelectionMode === 'random' }"
              :aria-pressed="chaserSelectionMode === 'random'"
              @click="emit('setChaserMode', { mode: 'random' })"
            >Random</button>
            <button
              type="button"
              class="segmented-option"
              :class="{ selected: chaserSelectionMode === 'vote' }"
              :aria-pressed="chaserSelectionMode === 'vote'"
              @click="emit('setChaserMode', { mode: 'vote' })"
            >Team vote</button>
          </div>
          <p v-else class="lobbyModeText">{{ chaserSelectionMode === "vote" ? "Team vote" : "Random" }}</p>

          <p class="lobbyStartHint">{{ startHint }}</p>
        </div>
      </div>
    </div>
</template>