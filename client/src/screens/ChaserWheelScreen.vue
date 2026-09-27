<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps(["players", "chaserSeatId"]);

const slotH = 60;
const viewportCenter = 90;
const trackCopies = 120;
const spinMs = 3000;
const wobbleMs = 500;
const scanSpeed = 24;
const scanInterval = 16;
const landingAhead = 40;

const trackEl = ref(null);
let trackY = 0;
let tickId = null;
// Set once the wheel has settled on the Chaser, so the result can be
// announced under it rather than left for players to read off the slot.
const landed = ref(false);
const chaserName = computed(() => props.players.find((p) => p.seatId === props.chaserSeatId)?.name ?? "");

const rows = computed(() => {
    const resolved = props.players.find((p) => p.seatId === props.chaserSeatId);
    const fill = [];
    for (let i = 0; i < 8; i++) {
        fill.push(props.players[i % props.players.length] ?? { seatId: `f${i}`, name: "" });
    }
    return [...fill, resolved ?? fill[0]];
});

const displayRows = computed(() => {
    const r = rows.value;
    const result = [];
    for (let i = 0; i < trackCopies; i++) {
        result.push(...r);
    }
    return result;
});

function prefersReducedMotion() {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

function apply() {
    if (trackEl.value) {
        trackEl.value.style.transform = `translateY(${trackY}px)`;
    }
}

function clearTick() {
    if (tickId) {
        clearInterval(tickId);
        tickId = null;
    }
}

function runScan() {
    clearTick();
    // Reduced motion: the window just sits still until the Chaser is known.
    if (prefersReducedMotion()) return;
    tickId = setInterval(() => {
        trackY -= scanSpeed;
        apply();
    }, scanInterval);
}

function runLanding() {
    clearTick();
    const currentSlot = Math.max(0, Math.floor(-trackY / slotH));
    const chaserInRow = rows.value.length - 1;
    const chaserSlotLen = rows.value.length;
    const targetSlot = Math.ceil((currentSlot + landingAhead - chaserInRow) / chaserSlotLen) * chaserSlotLen + chaserInRow;
    const targetIndex = Math.min(targetSlot, displayRows.value.length - 1);
    const endY = viewportCenter - (targetIndex * slotH + slotH / 2);
    // Reduced motion: no spin, straight to the result.
    if (prefersReducedMotion()) {
        trackY = endY;
        apply();
        landed.value = true;
        return;
    }
    const startY = trackY;
    const start = performance.now();
    tickId = setInterval(() => {
        const elapsed = performance.now() - start;
        if (elapsed >= spinMs + wobbleMs) {
            clearTick();
            trackY = endY;
            apply();
            landed.value = true;
            return;
        }
        if (elapsed < spinMs) {
            const t = elapsed / spinMs;
            trackY = easeOutQuart(t) * (endY - startY) + startY;
        } else {
            const tt = elapsed - spinMs;
            trackY = endY + 14 * Math.exp((-5 * tt) / wobbleMs) * Math.sin((3 * Math.PI * tt) / wobbleMs);
        }
        apply();
    }, scanInterval);
}

function stopAll() {
    clearTick();
}

watch(
    () => props.chaserSeatId,
    (id) => {
        stopAll();
        landed.value = false;
        if (id && id !== "") {
            runLanding();
        } else {
            runScan();
        }
    },
    { immediate: true }
);

// The watch above can position the track before it's mounted (the
// reduced-motion jump straight to the result), so apply it once it is.
onMounted(apply);
onBeforeUnmount(stopAll);
</script>

<template>
    <div class="wheelScreen">
        <h2 class="lobbyTitle">{{ landed ? "We have a Chaser!" : "Picking the Chaser…" }}</h2>
        <div class="wheelViewport" :class="{ 'wheelViewport-landed': landed }">
            <div ref="trackEl" class="wheelTrack">
                <div
                    v-for="(row, idx) in displayRows"
                    :key="idx"
                    class="wheelSlot"
                >
                    {{ row.name }}
                </div>
            </div>
        </div>
        <!-- Always rendered (hidden until the wheel lands) so the line
             appearing never moves the wheel. -->
        <p class="status-text wheelResult" :class="{ 'wheelResult-shown': landed }">
            <strong>{{ chaserName }}</strong> will be chasing everyone else.
        </p>
    </div>
</template>