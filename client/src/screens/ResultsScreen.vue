<script setup>
import { ref } from "vue";
defineProps(["isHost", "answer"]);
const emit = defineEmits(["nextQuestion"]);
</script>

<template>
    <h3>The correct answer was {{ answer }}</h3>
    <button v-if="isHost" @click="emit('nextQuestion')">Next question</button>
</template>