<script setup>
import { ref, computed } from "vue";

const props = defineProps(["players", "isHost", "room", "chaserSelectionMode"]);
const emit = defineEmits(["start", "setChaserMode"]);
const settingsOpen = ref(false);

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
        <div class="lobbyCustomiserPlaceholder">Character customizer</div>
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
                <svg viewBox="0 0 100 90" class="lobbyBustSvg" aria-hidden="true">
                  <circle cx="50" cy="30" r="24" />
                  <circle cx="50" cy="100" r="46" />
                </svg>
                <span v-if="seatPlayer" class="lobbyBustInitial">{{ seatPlayer.name.charAt(0).toUpperCase() }}</span>
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