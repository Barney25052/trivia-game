import { GamePhase, PlayerRole } from "../../TriviaTypes.js";
import { allPlayersReady, allPlayersVoted, tallyChaserVotes } from "./chaserSelection.js";
import { checkAnswer } from "../../questions/answerChecker.js";
import { pickOfferQuip } from "../../offerQuips.js";
import { CASH_BUILDER, CHASER_CHARACTERS, CHASER_QUIP, OFFER } from "../../gameConfig.js";

export function startGame(client: any, message: any, room: any) {
    if (!room.isHost(client)) {
        console.log(client.sessionId, "Can not start the game — only the host can!");
        return;
    }
    if (room.state.currentPhase !== GamePhase.Lobby) {
        console.log(client.sessionId, "Can not start the game outside Lobby!");
        return;
    }
    console.log(client.sessionId, "Starting game!");
    room.dispatch({ type: "startGame" });
}

export function setChaserMode(client: any, message: any, room: any) {
    if (!room.isHost(client)) {
        console.log(client.sessionId, "Can not set the chaser mode — only the host can!");
        return;
    }
    if (room.state.currentPhase !== GamePhase.Lobby) {
        console.log(client.sessionId, "Can not set the chaser mode outside Lobby!");
        return;
    }
    const mode = message?.mode;
    if (mode !== "random" && mode !== "vote") {
        console.log(client.sessionId, "Ignoring invalid chaser mode:", mode);
        return;
    }
    room.state.chaserSelectionMode = mode;
    console.log(client.sessionId, "Set chaser mode to", mode);
}

export function chaserVote(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.ChaserSelection) {
        console.log(client.sessionId, "Can not vote outside ChaserSelection!");
        return;
    }
    const voterSeatId = room.seatIdForClient(client);
    const voter = room.state.players.get(voterSeatId ?? "");
    if (!voter) {
        return;
    }
    if (voter.chaserVote !== "") {
        console.log(voterSeatId, "Already voted for the chaser!");
        return;
    }
    const target = message?.targetSeatId;
    if (typeof target !== "string" || !room.state.players.has(target)) {
        console.log(voterSeatId, "Ignoring vote for unknown player:", target);
        return;
    }
    voter.chaserVote = target;
    if (room.state.chaserSelectionMode === "vote" && allPlayersVoted(room)) {
        room.dispatch({
            type: "chaserSelectionComplete",
            chaserSeatId: tallyChaserVotes(room)
        });
    }
}

export function revealReady(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.RolesReveal) {
        console.log(client.sessionId, "Can not confirm ready outside RolesReveal!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    const player = room.state.players.get(seatId ?? "");
    if (!player) {
        return;
    }
    if (player.revealReady) {
        console.log(seatId, "Already confirmed ready for the roles reveal!");
        return;
    }
    if (player.role === PlayerRole.Chaser) {
        const characterId = message?.characterId;
        if (!characterId) {
            console.log(seatId, "Chaser must select a character before ready!");
            return;
        }
        const valid = CHASER_CHARACTERS.some((c) => c.id === characterId);
        if (!valid) {
            console.log(seatId, "Invalid chaser character ID:", characterId);
            return;
        }
        player.revealReady = true;
        player.chaserCharacterId = characterId;
        console.log(`${seatId} confirmed ready with character ${characterId} for the roles reveal`);
    } else {
        player.revealReady = true;
        console.log(`${seatId} confirmed ready for the cash builder`);
    }
    if (allPlayersReady(room)) {
        room.dispatch({ type: "revealAllReady" });
    }
}

export function setChaserLowOffer(client: any, message: any, room: any) {
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not set the low offer — only the Chaser can!");
        return;
    }
    if (room.state.currentPhase !== GamePhase.Offer) {
        console.log(client.sessionId, "Can not set the low offer outside Offer!");
        return;
    }
    if (!room.currentOffer || room.currentOffer.low !== null) {
        console.log(
            client.sessionId,
            room.currentOffer?.middle === 0
                ? "Can not set a low offer — middle is $0, there is nothing to set"
                : "Low offer already set (or offer not started)"
        );
        return;
    }
    const amount = message?.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || !Number.isInteger(amount)) {
        console.log(client.sessionId, "Ignoring malformed low offer:", amount);
        return;
    }
    if (amount % OFFER.lowStep !== 0) {
        console.log(client.sessionId, `Low offer must be a multiple of ${OFFER.lowStep}:`, amount);
        return;
    }
    if (amount >= room.currentOffer.middle) {
        console.log(client.sessionId, "Low offer must be less than the middle offer:", amount);
        return;
    }
    if (amount < 0 && -amount > room.state.teamPot) {
        console.log(client.sessionId, "Low offer would push the team pot below $0:", amount);
        return;
    }
    if (amount > 0 && amount > room.state.chaserPot) {
        console.log(client.sessionId, "Low offer exceeds the Chaser's remaining pot:", amount);
        return;
    }
    room.currentOffer.low = amount;
    console.log(`${seatId} set the low offer to ${amount}`);
    room.broadcast("offerLowSet", {
      seatId: room.state.activeContestantSeatId,
      low: amount,
      quip: pickOfferQuip("low")
    });
}

export function setChaserHighOffer(client: any, message: any, room: any) {
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not set the high offer — only the Chaser can!");
        return;
    }
    if (room.state.currentPhase !== GamePhase.Offer) {
        console.log(client.sessionId, "Can not set the high offer outside Offer!");
        return;
    }
    if (!room.currentOffer || room.currentOffer.low === null) {
        console.log(client.sessionId, "Must set the low offer before the high offer");
        return;
    }
    if (room.currentOffer.high !== null) {
        console.log(client.sessionId, "High offer already set");
        return;
    }
    const amount = message?.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || !Number.isInteger(amount)) {
        console.log(client.sessionId, "Ignoring malformed high offer:", amount);
        return;
    }
    if (amount % OFFER.highStep !== 0) {
        console.log(client.sessionId, `High offer must be a multiple of ${OFFER.highStep}:`, amount);
        return;
    }
    if (amount <= room.currentOffer.middle) {
        console.log(client.sessionId, "High offer must be more than the middle offer:", amount);
        return;
    }
    if (amount > room.state.chaserPot) {
        console.log(client.sessionId, "High offer exceeds the Chaser's remaining pot:", amount);
        return;
    }
    console.log(`${seatId} set the high offer to ${amount}`);
    room.dispatch({ type: "chaserOffersSet", low: room.currentOffer.low, high: amount });
}

export function offerChoice(client: any, message: any, room: any) {
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.activeContestantSeatId) {
        console.log(client.sessionId, "Can not choose an offer — not the active contestant!");
        return;
    }
    if (room.state.currentPhase !== GamePhase.Offer) {
        console.log(client.sessionId, "Can not choose an offer outside Offer!");
        return;
    }
    if (!room.currentOffer || room.currentOffer.low === null || room.currentOffer.high === null) {
        console.log(client.sessionId, "Can not choose an offer — the Chaser hasn't set low/high yet!");
        return;
    }
    const offer = message?.offer;
    if (offer !== "low" && offer !== "middle" && offer !== "high") {
        console.log(client.sessionId, "Ignoring invalid offer choice:", message?.offer);
        return;
    }
    room.currentOfferAmount = room.currentOffer[offer as "low" | "middle" | "high"];
    room.state.chaseWagerAmount = room.currentOfferAmount;
    room.dispatch({ type: "contestantChoice", offer });
}

/** Server-authoritative board-chase answer (ticket 064): both the active
 * contestant and the Chaser submit their pick for the same MC question via
 * this message — the room resolves correctness and board movement itself,
 * never trusting a client-sent result. */
export function submitChaseAnswer(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.Chase) {
        console.log(client.sessionId, "Can not submit a chase answer outside Chase!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    const isContestant = seatId === room.state.activeContestantSeatId;
    const isChaser = seatId === room.state.chaserSeatId;
    if (!isContestant && !isChaser) {
        console.log(client.sessionId, "Can not submit a chase answer — not in this chase!");
        return;
    }
    if (
        typeof message?.questionId !== "string" ||
        typeof message?.answerIndex !== "number" ||
        !Number.isInteger(message.answerIndex)
    ) {
        console.log(client.sessionId, "Ignoring malformed chase answer:", message);
        return;
    }
    const question = room.currentChaseQuestion;
    if (!question || question.id !== message.questionId) {
        console.log(client.sessionId, "Chase answer does not match the current question");
        return;
    }
    if (message.answerIndex < 0 || message.answerIndex >= question.optionCount) {
        console.log(client.sessionId, "Chase answer index out of range:", message.answerIndex);
        return;
    }
    const role: "contestant" | "chaser" = isContestant ? "contestant" : "chaser";
    if (role in room.chaseAnswers) {
        console.log(client.sessionId, "Already answered this chase question");
        return;
    }
    const wasFirstAnswer = Object.keys(room.chaseAnswers).length === 0;
    room.chaseAnswers[role] = message.answerIndex;
    console.log(`${seatId} (${role}) answered chase question ${question.id}`);

    if (Object.keys(room.chaseAnswers).length === 2) {
        room.resolveChaseQuestion();
    } else if (wasFirstAnswer) {
        // Kick off the lockout countdown everywhere at once (ticket 072): both
        // sides must see "the clock is running" from the same signal, so the
        // pulse and countdown are synced from this broadcast — not from each
        // client's own submission. Deliberately carries no role or answer
        // index, so the side still deciding never learns who answered or what
        // they picked (AGENTS.md "never broadcast before reveal").
        room.broadcast("chaseLockoutStarted", {
            questionId: question.id,
            windowMs: room.chaseAnswerWindowMs
        });
        room.chaseAnswerTimer = room.scheduleTimer(room.chaseAnswerWindowMs, () => {
            room.resolveChaseQuestion();
        });
    }
}

/** First non-Chaser to buzz wins the right to answer the current team-final
 * question (ticket 078) — only their `submitFinalAnswer` is then accepted. */
export function buzzIn(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.TeamFinal) {
        console.log(client.sessionId, "Can not buzz in outside TeamFinal!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    if (!seatId || seatId === room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not buzz in — the Chaser does not buzz!");
        return;
    }
    const currentQuestion = room.finalRoundQuestions.getCurrentQuestion("team");
    if (
        !currentQuestion ||
        typeof message?.questionId !== "number" ||
        currentQuestion.id !== message.questionId
    ) {
        console.log(client.sessionId, "Buzz does not match the current team question");
        return;
    }
    if (room.currentFinalTeamBuzzer !== null) {
        console.log(client.sessionId, "Someone already buzzed in for this question");
        return;
    }
    room.currentFinalTeamBuzzer = seatId;
    console.log(`${seatId} buzzed in first for team question ${currentQuestion.id}`);
    room.broadcast("finalBuzz", { questionId: currentQuestion.id, seatId });
}

/** Only the seat that won the buzz may answer the current team-final question
 * (ticket 078). Correct advances immediately; wrong holds for the reveal
 * window before the next question opens a fresh buzz. */
export function submitFinalAnswer(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.TeamFinal) {
        console.log(client.sessionId, "Can not submit a final answer outside TeamFinal!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    if (!seatId || seatId === room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not submit a final answer — the Chaser does not answer for the team!");
        return;
    }
    if (typeof message?.answer !== "string" || typeof message?.questionId !== "number") {
        console.log(client.sessionId, "Ignoring malformed submitFinalAnswer payload:", message);
        return;
    }
    const currentQuestion = room.finalRoundQuestions.getCurrentQuestion("team");
    if (!currentQuestion || currentQuestion.id !== message.questionId) {
        console.log(client.sessionId, "Final answer does not match the current team question");
        return;
    }
    if (room.finalTeamQuestionResolved || room.currentFinalTeamBuzzer !== seatId) {
        console.log(client.sessionId, "Can not submit a final answer — not the current buzzer");
        return;
    }

    room.finalTeamQuestionResolved = true;
    const isCorrect = checkAnswer(message.answer, [currentQuestion.answer, ...(currentQuestion.alternatives ?? [])]);
    if (isCorrect) {
        room.state.teamScore += 1;
    }
    client.send("answerResult", {
        correct: isCorrect,
        correctAnswer: currentQuestion.answer,
        questionId: currentQuestion.id
    });

    if (isCorrect) {
        room.advanceFinalTeamQuestion();
    } else {
        room.scheduleTimer(room.finalWrongAnswerRevealMs, () => room.advanceFinalTeamQuestion());
    }
}

/** The Chaser answers directly, no buzz-in (ticket 079). Correct advances the
 * target or wins outright on reach; wrong opens a steal window for the team. */
export function submitFinalChaserAnswer(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.ChaserFinal) {
        console.log(client.sessionId, "Can not submit a chaser final answer outside ChaserFinal!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not submit a chaser final answer — only the Chaser can!");
        return;
    }
    if (typeof message?.answer !== "string" || typeof message?.questionId !== "number") {
        console.log(client.sessionId, "Ignoring malformed submitFinalChaserAnswer payload:", message);
        return;
    }
    const currentQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
    if (!currentQuestion || currentQuestion.id !== message.questionId) {
        console.log(client.sessionId, "Chaser final answer does not match the current question");
        return;
    }
    if (room.finalChaserQuestionResolved) {
        console.log(client.sessionId, "Already answered this chaser final question");
        return;
    }

    room.finalChaserQuestionResolved = true;
    const isCorrect = checkAnswer(message.answer, [currentQuestion.answer, ...(currentQuestion.alternatives ?? [])]);
    client.send("answerResult", {
        correct: isCorrect,
        correctAnswer: currentQuestion.answer,
        questionId: currentQuestion.id
    });

    if (isCorrect) {
        room.state.chaserScore += 1;
        console.log(`Chaser answered correctly — chaserScore ${room.state.chaserScore}/${room.state.teamScore}`);
        if (room.state.chaserScore >= room.state.teamScore) {
            room.dispatch({ type: "finalChaserReachedScore" });
            return;
        }
        room.advanceFinalChaserQuestion();
        return;
    }

    console.log("Chaser answered incorrectly — opening the steal window for the team");
    room.finalStealActive = true;
    room.sendToTeam("finalSteal", {
        questionId: currentQuestion.id,
        prompt: currentQuestion.question,
        windowMs: room.stealWindowMs
    });
    room.finalStealTimer = room.scheduleTimer(room.stealWindowMs, () => {
        room.finalStealTimer = null;
        if (!room.finalStealActive || room.state.currentPhase !== GamePhase.ChaserFinal) {
            return;
        }
        room.finalStealActive = false;
        console.log("Steal window expired unclaimed — the Chaser advances");
        room.advanceFinalChaserQuestion();
    });
}

/** The first non-Chaser to submit resolves the steal, correct or wrong — no
 * buzz gate (ticket 079). A correct steal pushes the Chaser back while above
 * 0, or raises the team's target once the Chaser is already at 0. */
export function submitFinalStealAnswer(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.ChaserFinal) {
        console.log(client.sessionId, "Can not submit a steal answer outside ChaserFinal!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    if (!seatId || seatId === room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not submit a steal answer — the Chaser can not steal from itself!");
        return;
    }
    if (!room.finalStealActive) {
        console.log(client.sessionId, "No steal window is open (already resolved or expired)");
        return;
    }
    if (typeof message?.answer !== "string" || typeof message?.questionId !== "number") {
        console.log(client.sessionId, "Ignoring malformed submitFinalStealAnswer payload:", message);
        return;
    }
    const currentQuestion = room.finalRoundQuestions.getCurrentQuestion("chaser");
    if (!currentQuestion || currentQuestion.id !== message.questionId) {
        console.log(client.sessionId, "Steal answer does not match the current chaser question");
        return;
    }

    // First submission wins and closes the window immediately, right or wrong.
    room.finalStealActive = false;
    if (room.finalStealTimer !== null) {
        room.finalStealTimer.cancel();
        room.finalStealTimer = null;
    }

    const isCorrect = checkAnswer(message.answer, [currentQuestion.answer, ...(currentQuestion.alternatives ?? [])]);
    let pushedBack = false;
    if (isCorrect) {
        if (room.state.chaserScore > 0) {
            room.state.chaserScore -= 1;
            pushedBack = true;
        } else {
            room.state.teamScore += 1;
        }
    }
    console.log(
        `${seatId} attempted the steal: ${isCorrect ? "correct" : "wrong"}` +
        (isCorrect ? ` (${pushedBack ? "chaser pushed back" : "team target raised"})` : "")
    );
    client.send("answerResult", {
        correct: isCorrect,
        correctAnswer: currentQuestion.answer,
        questionId: currentQuestion.id
    });
    if (isCorrect) {
        room.sendToTeam("finalStealResolved", { pushedBack });
    }
    room.advanceFinalChaserQuestion();
}

export function sendChaserQuip(client: any, message: any, room: any) {
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not send a chaser quip — only the Chaser can!");
        return;
    }
    const text = typeof message?.text === "string" ? message.text.trim() : "";
    if (text.length === 0 || text.length > CHASER_QUIP.maxLength) {
        console.log(client.sessionId, "Ignoring malformed chaser quip:", message?.text);
        return;
    }
    room.broadcast("chaserQuip", { text, at: Date.now() });
}

export function submitAnswer(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.CashBuilder) {
        console.log(client.sessionId, "Can not submit an answer outside CashBuilder!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.activeContestantSeatId) {
        console.log(client.sessionId, "Can not submit an answer — not the active contestant!");
        return;
    }
    if (typeof message?.answer !== "string" || typeof message?.questionId !== "number") {
        console.log(client.sessionId, "Ignoring malformed submitAnswer payload:", message);
        return;
    }
    const currentQuestion = room.questionManager.getCurrentQuestion(seatId);
    if (!currentQuestion || currentQuestion.id !== message.questionId) {
        console.log(client.sessionId, "Answer does not match the current question");
        return;
    }

    const player = room.state.players.get(seatId);
    if (!player) {
        return;
    }

    const isCorrect = checkAnswer(message.answer, [currentQuestion.answer, ...(currentQuestion.alternatives ?? [])]);
    if (isCorrect) {
        player.cashBuilderMoney += CASH_BUILDER.rewardPerCorrect;
        player.cashBuilderCorrectAnswers += 1;
    }

    client.send("answerResult", {
        correct: isCorrect,
        correctAnswer: currentQuestion.answer,
        questionId: currentQuestion.id
    });

    const advanceQuestion = () => {
        const nextQuestion = room.questionManager.drawNext(room.questionBank, seatId);
        if (nextQuestion) {
            room.broadcastQuestion(
                room.state.activeRound,
                seatId,
                "open",
                nextQuestion.id,
                nextQuestion.question
            );
        } else {
            room.broadcast("question", null);
        }
    };

    if (isCorrect) {
        advanceQuestion();
    } else {
        room.scheduleTimer(room.wrongAnswerRevealMs, advanceQuestion);
    }
}
