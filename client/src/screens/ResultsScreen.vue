<script setup>
import { ref } from "vue";
defineProps(["isHost", "answer"]);
const emit = defineEmits(["nextQuestion"]);
</script>

<template>
    <div class = "results">
        <h3 class = "correctAnswer">The correct answer was <u>{{ answer }}</u></h3>
        <button class = "startButton" v-if="isHost" @click="emit('nextQuestion')">Next question</button>
    </div>
</template>