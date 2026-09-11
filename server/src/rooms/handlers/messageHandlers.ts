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
    const voter = room.state.players.get(client.sessionId);
    if (!voter) {
        return;
    }
    if (voter.chaserVote !== "") {
        console.log(client.sessionId, "Already voted for the chaser!");
        return;
    }
    const target = message?.targetSessionId;
    if (typeof target !== "string" || !room.state.players.has(target)) {
        console.log(client.sessionId, "Ignoring vote for unknown player:", target);
        return;
    }
    voter.chaserVote = target;
    if (room.state.chaserSelectionMode === "vote" && allPlayersVoted(room)) {
        room.dispatch({
            type: "chaserSelectionComplete",
            chaserSessionId: tallyChaserVotes(room)
        });
    }
}

export function revealReady(client: any, message: any, room: any) {
    if (room.state.currentPhase !== GamePhase.RolesReveal) {
        console.log(client.sessionId, "Can not confirm ready outside RolesReveal!");
        return;
    }
    const player = room.state.players.get(client.sessionId);
    if (!player) {
        return;
    }
    if (player.revealReady) {
        console.log(client.sessionId, "Already confirmed ready for the roles reveal!");
        return;
    }
    if (player.role === PlayerRole.Chaser) {
        const characterId = message?.characterId;
        if (!characterId) {
            console.log(client.sessionId, "Chaser must select a character before ready!");
            return;
        }
        const valid = CHASER_CHARACTERS.some((c) => c.id === characterId);
        if (!valid) {
            console.log(client.sessionId, "Invalid chaser character ID:", characterId);
            return;
        }
        player.revealReady = true;
        player.chaserCharacterId = characterId;
        console.log(`${client.sessionId} confirmed ready with character ${characterId} for the roles reveal`);
    } else {
        player.revealReady = true;
        console.log(`${client.sessionId} confirmed ready for the cash builder`);
    }
    // Only check if Chaser is ready (non-Chasers are always "ready" once they connect)
    const chaser = [...room.state.players.values()].find((p) => p.role === PlayerRole.Chaser);
    if (!chaser || chaser.revealReady) {
        const allReady = [...room.state.players.values()].every(
            (p) => p.revealReady === true
        );
        if (allReady) {
            room.dispatch({ type: "revealAllReady" });
        }
    }
}

export function offerChoice(client: any, message: any, room: any) {
    if (client.sessionId !== room.state.activeContestantSessionId) {
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
    if (client.sessionId !== room.state.activeContestantSessionId) {
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
    if (client.sessionId !== room.state.chaserSessionId) {
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
    if (client.sessionId !== room.state.activeContestantSessionId) {
        console.log(client.sessionId, "Can not submit an answer — not the active contestant!");
        return;
    }
    if (typeof message?.answer !== "string" || typeof message?.questionId !== "number") {
        console.log(client.sessionId, "Ignoring malformed submitAnswer payload:", message);
        return;
    }
    const currentQuestion = room.questionManager.getCurrentQuestion(client.sessionId);
    if (!currentQuestion || currentQuestion.id !== message.questionId) {
        console.log(client.sessionId, "Answer does not match the current question");
        return;
    }

    const player = room.state.players.get(client.sessionId);
    if (!player) {
        return;
    }

    if (checkAnswer(message.answer, [currentQuestion.answer, ...(currentQuestion.alternatives ?? [])])) {
        player.cashBuilderMoney += CASH_BUILDER.rewardPerCorrect;
        player.cashBuilderQuestionsAsked += 1;
    }

    const nextQuestion = room.questionManager.drawNext(room.questionBank, client.sessionId);
    if (nextQuestion) {
        room.broadcastQuestion(
            room.state.activeRound,
            client.sessionId,
            "open",
            nextQuestion.id,
            nextQuestion.question,
            nextQuestion.category
        );
    } else {
        room.broadcast("question", null);
    }
}
