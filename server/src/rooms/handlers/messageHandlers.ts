import { GamePhase, PlayerRole } from "../../TriviaTypes.js";
import { allPlayersReady, allPlayersVoted, tallyChaserVotes } from "./chaserSelection.js";
import { checkAnswer } from "../../questions/answerChecker.js";
import { CASH_BUILDER, CHASER_CHARACTERS } from "../../gameConfig.js";

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
    const offer = message?.offer;
    if (offer !== "low" && offer !== "middle" && offer !== "high") {
        console.log(client.sessionId, "Ignoring invalid offer choice:", message?.offer);
        return;
    }
    if (room.currentOffer) {
        room.currentOfferAmount = room.currentOffer[offer as "low" | "middle" | "high"];
    }
    room.dispatch({ type: "contestantChoice", offer });
}

export function chaseResult(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.Chase) {
        console.log(client.sessionId, "Can not send a chase result outside Chase!");
        return;
    }
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.activeContestantSeatId) {
        console.log(client.sessionId, "Can not send a chase result — not the active contestant!");
        return;
    }
    if (message?.escaped === true) {
        room.dispatch({ type: "chaseEscape" });
    } else {
        room.dispatch({ type: "chaseCaught" });
    }
}

export function finalChaserScore(client: any, message: any, room: any) {
    const seatId = room.seatIdForClient(client);
    if (seatId !== room.state.chaserSeatId) {
        console.log(client.sessionId, "Can not finish the final — only the Chaser can!");
        return;
    }
    if (room.state.currentPhase !== GamePhase.ChaserFinal) {
        console.log(client.sessionId, "Can not finish the final outside ChaserFinal!");
        return;
    }
    room.dispatch({ type: "finalChaserReachedScore" });
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
                nextQuestion.question,
                nextQuestion.category
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
