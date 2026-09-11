<script setup>
import { computed } from "vue";
import face1 from "../assets/images/face-1.png";
import face2 from "../assets/images/face-2.png";
import face3 from "../assets/images/face-3.png";

const props = defineProps(["contestants", "mySeatId"]);

const faceImages = [face1, face2, face3];

const lineup = computed(() =>
    props.contestants.map((contestant, index) => {
        const position = index + 1;
        return {
            ...contestant,
            position,
            ordinal: ordinal(position),
            face: faceImages[index % faceImages.length]
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
                <img :src="contestant.face" class="lineupAvatar" :alt="contestant.name" />
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