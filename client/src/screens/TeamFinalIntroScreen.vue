<script setup>
// Ticket 122: a short holding screen between the last Chase resolving and
// the real Team Final starting — mirrors ContestantLineupScreen.vue's
// pattern closely (a plain list, no interaction, auto-forwarding whenever
// the server's phase timer flips GamePhase away from TeamFinalIntro).
//
// Everyone plays the Team Final, caught contestants included (GOAL.md's
// final-round rules) — only the head start counts survivors, one point each
// (server/src/rooms/handlers/effects.ts startFinalTeam). So every contestant
// is shown, each marked by whether they're bringing a point.
import { computed } from "vue";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps(["contestants", "mySeatId"]);

const headStart = computed(() => props.contestants.filter((contestant) => contestant.madeItBack).length);
</script>

<template>
    <div class="lineupScreen">
        <h2 class="lineupTitle">On to the Team Final!</h2>
        <p class="status-text lineupSubtitle">Everyone's back to answer as one team. Each player who made it back is worth a point.</p>
        <div class="cf-hud">
            <span>HEAD START <b>{{ headStart }}</b></span>
        </div>
        <div class="lineupList">
            <div
                v-for="contestant in contestants"
                :key="contestant.seatId"
                class="lineupCard"
            >
                <div class="board-portrait-circle lineupAvatar">
                    <CharacterFace :character="contestant.character" :reaction="contestant.madeItBack ? 'smile' : 'neutral'" />
                </div>
                <span class="contestantName">{{ contestant.name }}</span>
                <span class="chip" :class="contestant.madeItBack ? 'chip-green' : 'chip-red'">
                    {{ contestant.madeItBack ? "+1 point" : "Caught" }}
                </span>
                <span v-if="contestant.seatId === mySeatId" class="chip chip-blue">You</span>
            </div>
        </div>
    </div>
</template>
