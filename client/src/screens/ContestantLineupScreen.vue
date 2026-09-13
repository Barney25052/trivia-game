<script setup>
import { computed } from "vue";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps(["contestants", "mySeatId"]);

const lineup = computed(() =>
    props.contestants.map((contestant, index) => {
        const position = index + 1;
        return {
            ...contestant,
            position,
            ordinal: ordinal(position)
        };
    })
);

function ordinal(position) {
    const suffixes = ["th", "st", "nd", "rd"];
    const mod100 = position % 100;
    const suffix = suffixes[(mod100 - 20) % 10] ?? suffixes[mod100] ?? suffixes[0];
    return `${position}${suffix}`;
}
</script>

<template>
    <div class="lineupScreen">
        <h2 class="lineupTitle">Contestants in order</h2>
        <div class="lineupList">
            <div
                v-for="contestant in lineup"
                :key="contestant.seatId"
                class="lineupCard"
                :class="{ 'lineupCard-first': contestant.position === 1 }"
            >
                <div class="lineupAvatar">
                    <CharacterFace :character="contestant.character" reaction="neutral" />
                </div>
                <span class="lineupOrdinal">{{ contestant.ordinal }}</span>
                <span class="contestantName">{{ contestant.name }}</span>
                <span
                    v-if="contestant.seatId === mySeatId"
                    class="contestantYou"
                >(you)</span>
                <span v-if="contestant.position === 1" class="lineupFirstTag">Up first</span>
            </div>
        </div>
    </div>
</template>