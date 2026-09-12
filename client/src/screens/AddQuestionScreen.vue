<script setup>
import { ref } from "vue";

const emit = defineEmits(["back"]);

// No Colyseus room is involved on this screen (ticket 092), so it derives its
// own http base instead of taking SERVER_URL as a prop — same derivation as
// App.vue:20, just widened to also cover the wss:// case correctly (a plain
// /^ws/ replace would turn "wss://" into "httpss://").
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
const API_BASE = SERVER_URL.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");

// Mirrors server/src/gameConfig.ts BANK_EDIT — duplicated client-side the same
// way OfferScreen mirrors OFFER (no shared module between the two npm
// projects, see AGENTS.md gotchas). Used only for maxlength hints; the server
// remains the source of truth and re-validates on submit.
const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 100;

const question = ref("");
const answer = ref("");
const alternativesText = ref("");
const errorMessage = ref("");
const submitting = ref(false);
const addedQuestion = ref(null);

function resetForm() {
    question.value = "";
    answer.value = "";
    alternativesText.value = "";
    errorMessage.value = "";
}

function addAnother() {
    addedQuestion.value = null;
    resetForm();
}

async function submit() {
    if (submitting.value) return;
    errorMessage.value = "";
    submitting.value = true;
    const alternatives = alternativesText.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    try {
        const response = await fetch(`${API_BASE}/api/questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: question.value,
                answer: answer.value,
                alternatives
            })
        });
        const body = await response.json();
        if (!response.ok) {
            errorMessage.value = body.error ?? "Failed to add the question.";
            return;
        }
        addedQuestion.value = body;
    } catch (e) {
        console.error("Failed to add question:", e);
        errorMessage.value = "Could not reach the server. Please try again.";
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="home">
        <h2 class="lobbyTitle">Add a Question</h2>
        <div class="homeInputs" v-if="!addedQuestion">
            <input v-model="question" placeholder="Question" :maxlength="MAX_QUESTION_LENGTH" />
            <input v-model="answer" placeholder="Answer" :maxlength="MAX_ANSWER_LENGTH" />
            <textarea
                v-model="alternativesText"
                class="addQuestionTextarea"
                placeholder="Alternative answers (one per line)"
                rows="4"
            ></textarea>
            <p v-if="errorMessage" class="addQuestionError">{{ errorMessage }}</p>
            <div class="homeButtonHolder">
                <button @click="submit" class="joinButton" :disabled="submitting">Submit</button>
                <button @click="emit('back')" class="createButton">Back</button>
            </div>
        </div>
        <div class="homeInputs" v-else>
            <p class="addQuestionSuccess">Added question #{{ addedQuestion.id }}.</p>
            <div class="homeButtonHolder">
                <button @click="addAnother" class="joinButton">Add another</button>
                <button @click="emit('back')" class="createButton">Back</button>
            </div>
        </div>
    </div>
</template>
