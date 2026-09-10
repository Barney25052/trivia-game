<script setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";

const props = defineProps(["players", "chaserSessionId"]);
const emit = defineEmits(["reveal"]);

const slotH = 60;
const viewportCenter = 90;
const trackCopies = 120;
const spinMs = 3000;
const wobbleMs = 500;
const holdMs = 1500;
const scanSpeed = 24;
const scanInterval = 16;
const landingAhead = 40;

const trackEl = ref(null);
let trackY = 0;
let tickId = null;
let holdTimer = null;

const rows = computed(() => {
    const resolved = props.players.find((p) => p.sessionId === props.chaserSessionId);
    const fill = [];
    for (let i = 0; i < 8; i++) {
        fill.push(props.players[i % props.players.length] ?? { sessionId: `f${i}`, name: "" });
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
    const startY = trackY;
    const start = performance.now();
    tickId = setInterval(() => {
        const elapsed = performance.now() - start;
        if (elapsed >= spinMs + wobbleMs) {
            clearTick();
            trackY = endY;
            apply();
            holdTimer = setTimeout(() => emit("reveal"), holdMs);
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
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
}

watch(
    () => props.chaserSessionId,
    (id) => {
        stopAll();
        if (id && id !== "") {
            runLanding();
        } else {
            runScan();
        }
    },
    { immediate: true }
);

onBeforeUnmount(stopAll);
</script>

<template>
    <div class="wheelOverlay">
        <h2 class="lobbyTitle">Picking the Chaser…</h2>
        <div class="wheelViewport">
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
    </div>
</template>