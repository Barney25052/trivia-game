<script setup>
// Ticket 122: a short holding screen between the last Chase resolving and
// the real Team Final starting — mirrors ContestantLineupScreen.vue's
// pattern closely (a plain list, no interaction, auto-forwarding whenever
// the server's phase timer flips GamePhase away from TeamFinalIntro).
import { computed } from "vue";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps(["contestants", "mySeatId"]);

const survivors = computed(() => props.contestants.filter((contestant) => contestant.madeItBack));
</script>

<template>
    <div class="lineupScreen">
        <h2 class="lineupTitle">Onto the Team Final!</h2>
        <p class="playerName">Time to answer as one team.</p>
        <div class="lineupList">
            <div
                v-for="contestant in survivors"
                :key="contestant.seatId"
                class="lineupCard"
            >
                <div class="lineupAvatar">
                    <CharacterFace :character="contestant.character" reaction="neutral" />
                </div>
                <span class="contestantName">{{ contestant.name }}</span>
                <span
                    v-if="contestant.seatId === mySeatId"
                    class="contestantYou"
                >(you)</span>
            </div>
        </div>
    </div>
</template>
