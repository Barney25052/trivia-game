<script setup>
import { ref } from "vue";
import { API_BASE } from "../serverUrl.ts";

const emit = defineEmits(["back"]);

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
        // A live server keeps the bank behind the admin login (ticket 163).
        // The browser asks for it on the 401; these answer a cancelled login.
        if (response.status === 401) {
            errorMessage.value = "Adding questions needs the admin login.";
            return;
        }
        if (response.status === 503) {
            errorMessage.value = "Adding questions isn't set up on this server.";
            return;
        }
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
        <h2 class="lobbyTitle addQuestionTitle">Add a Question</h2>
        <p class="status-text">It goes into the question bank for the Cash Builder and the finals.</p>

        <div v-if="!addedQuestion" class="panel addQuestionPanel">
            <label class="field-label" for="add-question-prompt">Question</label>
            <input
                id="add-question-prompt"
                v-model="question"
                class="field"
                placeholder="What is the capital of Australia?"
                :maxlength="MAX_QUESTION_LENGTH"
            />
            <label class="field-label" for="add-question-answer">Answer</label>
            <input
                id="add-question-answer"
                v-model="answer"
                class="field"
                placeholder="Canberra"
                :maxlength="MAX_ANSWER_LENGTH"
            />
            <label class="field-label" for="add-question-alternatives">Also accept (one per line)</label>
            <textarea
                id="add-question-alternatives"
                v-model="alternativesText"
                class="field addQuestionTextarea"
                rows="3"
            ></textarea>
            <p class="addQuestionError">{{ errorMessage }}</p>
            <div class="homeButtonHolder">
                <button @click="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? "Adding…" : "Add question" }}</button>
                <button @click="emit('back')" class="btn btn-outline">Back</button>
            </div>
        </div>
        <div v-else class="panel addQuestionPanel">
            <p class="addQuestionSuccess">Added to the bank!</p>
            <!-- Echo back exactly what was saved, so a typo is caught now. -->
            <div class="addQuestionEcho">
                <span class="field-label">Question #{{ addedQuestion.id }}</span>
                <p class="addQuestionEchoPrompt">{{ addedQuestion.question }}</p>
                <p class="addQuestionEchoAnswer">
                    Answer: <strong>{{ addedQuestion.answer }}</strong>
                    <template v-if="addedQuestion.alternatives.length">
                        (also {{ addedQuestion.alternatives.join(", ") }})
                    </template>
                </p>
            </div>
            <div class="homeButtonHolder">
                <button @click="addAnother" class="btn btn-primary">Add another</button>
                <button @click="emit('back')" class="btn btn-outline">Back</button>
            </div>
        </div>
    </div>
</template>
