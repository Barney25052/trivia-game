<script setup>
import { computed } from "vue";
import { PlayerRole } from "../TriviaTypes.ts";
import CharacterFace from "../components/CharacterFace.vue";

const props = defineProps({
    winner: { type: String, default: null },
    players: { type: Array, default: () => [] },
    teamScore: { type: Number, default: 0 },
    chaserScore: { type: Number, default: 0 },
    teamPot: { type: Number, default: 0 }
});
const emit = defineEmits(["leave"]);

const chaserWon = computed(() => props.winner === "chaser");
// Ticket 124: ranked by correct answers — the quiz part of the game — not
// survival or turn order, per the design conversation's own confirmed call
// (feedback_visual_direction.md). Ties keep players.value's own stable order.
const rankedContestants = computed(() =>
    props.players
        .filter((p) => p.role === PlayerRole.Contestant)
        .slice()
        .sort((a, b) => b.cashBuilderCorrectAnswers - a.cashBuilderCorrectAnswers)
);
const survivorCount = computed(() => rankedContestants.value.filter((p) => p.madeItBack).length);
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
        <p class="playerName">{{ survivorCount }} of {{ rankedContestants.length }} made it back</p>

        <div class="moneyPlaque resultsPotPlaque">
            <span class="who">Team pot</span>
            <span class="amount">{{ potText }}</span>
        </div>

        <div class="lineupList">
            <div
                v-for="(player, index) in rankedContestants"
                :key="player.seatId"
                class="lineupCard"
                :class="{ 'resultsCard-topScore': index === 0, 'resultsCard-caught': !player.madeItBack }"
            >
                <span class="lineupOrdinal">{{ index + 1 }}</span>
                <div class="lineupAvatar">
                    <CharacterFace :character="player.character" reaction="neutral" />
                </div>
                <span class="contestantName">{{ player.name }}</span>
                <span class="resultsPlayerMoney">${{ player.cashBuilderMoney.toLocaleString("en-US") }}</span>
                <span :class="player.madeItBack ? 'resultsStatus-back' : 'resultsStatus-caught'">
                    {{ player.madeItBack ? "made it back" : "caught" }}
                </span>
            </div>
        </div>

        <button @click="emit('leave')" class="btn btn-primary nextButton">Main Menu</button>
    </div>
</template>
