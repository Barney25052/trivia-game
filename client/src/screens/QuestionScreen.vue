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
      <div v-if="!haveIAnswered">
        <h2 class="questionText">{{currentQuestion.question}}</h2>
        <div class = "answers">
          <button
            class = "answerButton"
            v-for="(option, index) in currentQuestion.options"
            :key="index"
            @click="selectAnswer(index)"
          >
            {{ option }}
          </button>
        </div>
      </div>
      <h3 v-else class ="waiting">Waiting for other players...</h3>
    </div>
</template>