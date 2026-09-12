<script setup>
import { computed } from "vue";
import { PlayerRole } from "../TriviaTypes.ts";

const props = defineProps({
    winner: { type: String, default: null },
    players: { type: Array, default: () => [] },
    teamScore: { type: Number, default: 0 },
    chaserScore: { type: Number, default: 0 },
    teamPot: { type: Number, default: 0 }
});
const emit = defineEmits(["leave"]);

const chaserWon = computed(() => props.winner === "chaser");
const contestants = computed(() => props.players.filter((p) => p.role === PlayerRole.Contestant));
const survivorCount = computed(() => contestants.value.filter((p) => p.madeItBack).length);
const potText = computed(() => "$" + props.teamPot.toLocaleString("en-US"));
</script>

<template>
    <div class="lobby">
        <h2 class="lobbyTitle">Game Over</h2>
        <div
            class="resultsBanner"
            :class="chaserWon ? 'resultsBanner-chaserWin' : 'resultsBanner-teamWin'"
        >
            {{ chaserWon ? "The Chaser caught you" : "The team made it back" }}
        </div>
        <p class="playerName">Team {{ teamScore }} — Chaser {{ chaserScore }}</p>
        <p class="playerName">{{ survivorCount }} of {{ contestants.length }} made it back</p>
        <div class="teamFinalPotBox">
            <span class="teamFinalPotAmount">{{ potText }}</span>
        </div>
        <div class="resultsPlayerList">
            <div v-for="player in contestants" :key="player.seatId">
                <p class="playerName resultsPlayerRow">
                    {{ player.name }} — ${{ player.cashBuilderMoney.toLocaleString("en-US") }}
                    <span :class="player.madeItBack ? 'resultsStatus-back' : 'resultsStatus-caught'">
                        {{ player.madeItBack ? "made it back" : "caught" }}
                    </span>
                </p>
            </div>
        </div>
        <button @click="emit('leave')" class="nextButton">Main Menu</button>
    </div>
</template>
