<script setup>
import { ref } from "vue";
defineProps(["myPlayer", "currentQuestion", "haveIAnswered"]);
const emit = defineEmits(["answerSubmitted"]);

function selectAnswer(index) {
  emit('answerSubmitted', index)
}
</script>

<template>
    <div class='question'>
      <h2>{{currentQuestion.question}}</h2>
      <div v-if="!haveIAnswered">
      <button
        v-for="(option, index) in currentQuestion.options"
        :key="index"
        @click="selectAnswer(index)"
      >
        {{ option }}
      </button>
      </div>
      <h3 v-else>Answered!</h3>
    </div>
</template>