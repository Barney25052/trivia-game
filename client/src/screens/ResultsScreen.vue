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
// (feedback_visual_direction.md). Every correct answer counts: the Cash
// Builder's plus the final round's (Team Final answers and steals, ticket
// 160). Ties keep players.value's own stable order.
function correctAnswers(player) {
    return player.cashBuilderCorrectAnswers + (player.finalCorrectAnswers ?? 0);
}
const rankedContestants = computed(() =>
    props.players
        .filter((p) => p.role === PlayerRole.Contestant)
        .slice()
        .sort((a, b) => correctAnswers(b) - correctAnswers(a))
);
// Competition ranking ("1, 1, 3"): tied players share a place, and the gold
// top-score card only goes to a real top score, not to whoever happens to be
// listed first when everyone scored nothing.
const places = computed(() => rankedContestants.value.map((player) =>
    1 + rankedContestants.value.filter((other) => correctAnswers(other) > correctAnswers(player)).length
));
const survivorCount = computed(() => rankedContestants.value.filter((p) => p.madeItBack).length);
const potText = computed(() => "$" + props.teamPot.toLocaleString("en-US"));

function formatAmount(amount) {
    const abs = Math.abs(amount).toLocaleString("en-US");
    return amount < 0 ? `-$${abs}` : `$${abs}`;
}
</script>

<template>
    <div class="resultsScreen">
        <h2 class="lobbyTitle">Game Over</h2>
        <div
            class="resultsBanner"
            :class="chaserWon ? 'resultsBanner-chaserWin' : 'resultsBanner-teamWin'"
        >
            {{ chaserWon ? "The Chaser wins!" : "The team wins!" }}
        </div>

        <div class="cf-hud resultsHud">
            <span>TEAM <b>{{ teamScore }}</b></span>
            <span>CHASER <b>{{ chaserScore }}</b></span>
            <span>MADE IT BACK <b>{{ survivorCount }}/{{ rankedContestants.length }}</b></span>
        </div>

        <div class="moneyPlaque resultsPotPlaque" :class="{ 'resultsPotPlaque-lost': chaserWon }">
            <span class="who">{{ chaserWon ? "Team pot, lost" : "Team pot, won" }}</span>
            <span class="amount">{{ potText }}</span>
        </div>

        <div class="resultsList">
            <div
                v-for="(player, index) in rankedContestants"
                :key="player.seatId"
                class="lineupCard resultsCard"
                :class="{
                    'resultsCard-topScore': places[index] === 1 && correctAnswers(player) > 0,
                    'resultsCard-caught': !player.madeItBack
                }"
            >
                <span class="lineupOrdinal">{{ places[index] }}</span>
                <div class="board-portrait-circle lineupAvatar">
                    <CharacterFace :character="player.character" :reaction="player.madeItBack && !chaserWon ? 'smile' : 'frown'" />
                </div>
                <span class="contestantName">{{ player.name }}</span>
                <!-- What they actually brought back to the pot (the offer
                     they escaped with), not what they built in the Cash
                     Builder; nothing if they were caught, and struck through
                     like the pot if the Chaser won it. -->
                <span
                    class="resultsPlayerMoney"
                    :class="{
                        'resultsPlayerMoney-negative': player.madeItBack && player.bankedAmount < 0,
                        'resultsPlayerMoney-lost': player.madeItBack && chaserWon
                    }"
                >{{ player.madeItBack ? formatAmount(player.bankedAmount) : "$0" }}</span>
                <span class="resultsStat">{{ correctAnswers(player) }} correct</span>
                <span class="chip" :class="player.madeItBack ? 'chip-green' : 'chip-red'">
                    {{ player.madeItBack ? "Made it back" : "Caught" }}
                </span>
            </div>
        </div>

        <button @click="emit('leave')" class="btn btn-primary resultsMenuButton">Back to menu</button>
    </div>
</template>
