import { Client } from "colyseus";
import { GamePhase } from "../../TriviaTypes.js";
import { BankQuestion } from "../../questions/bank.js";
import { CHASER_CHARACTERS } from "../../gameConfig.js";

/** The `finalQuestion` payload for either side (ticket 077) — never an answer. */
export function finalQuestionPayload(side: "team" | "chaser", question: BankQuestion | null) {
    return {
        side,
        questionId: question?.id ?? null,
        prompt: question?.question ?? null,
    };
}

/**
 * Ticket 171: everything a player missed while their connection was down.
 * The synced state comes back on its own when they reconnect, but questions,
 * offers and the result travel as messages, and a broadcast skips a dropped
 * client. Re-sends, to that one client, only what is live right now — never
 * an answer that's still in play. Two things aren't re-sent: an open steal
 * window (it is 10-20s long and has almost always closed by the time a
 * player is back) and the Cash Builder's get-ready countdown.
 */
export function resendLiveContext(room: any, client: Client): void {
    const phase: GamePhase = room.state.currentPhase;
    client.send("phase", { phase });

    switch (phase) {
        case GamePhase.CashBuilder: {
            const seatId = room.state.activeContestantSeatId;
            const question: BankQuestion | undefined = room.questionManager.getCurrentQuestion(seatId);
            if (question) {
                client.send("question", {
                    round: room.state.activeRound,
                    targetSeatId: seatId,
                    kind: "open",
                    prompt: question.question,
                    questionId: question.id,
                });
            }
            break;
        }

        case GamePhase.Offer: {
            const offer = room.currentOffer;
            if (!offer) {
                break;
            }
            const chaserCharId = room.state.players.get(room.state.chaserSeatId)?.chaserCharacterId ?? "";
            const chaserChar = CHASER_CHARACTERS.find((c) => c.id === chaserCharId);
            const character = {
                chaserCharacterId: chaserCharId,
                chaserCharacterName: chaserChar?.name ?? "",
                chaserCharacterPassive: chaserChar?.passive ?? [],
                chaserCharacterActive: chaserChar?.active ?? [],
            };
            const seatId = room.state.activeContestantSeatId;
            // An empty quip: the Chaser's bubble isn't replayed on a rejoin.
            if (offer.high !== null) {
                client.send("offer", { seatId, offers: offer, middleVoided: offer.middleVoided, ...character, quip: "" });
            } else {
                client.send("offerStart", {
                    seatId,
                    middle: offer.middle,
                    low: offer.low,
                    middleVoided: offer.middleVoided,
                    ...character,
                    quip: "",
                });
            }
            break;
        }

        case GamePhase.Chase: {
            const question = room.currentChaseQuestion;
            if (question) {
                client.send("question", {
                    round: room.state.activeRound,
                    targetSeatId: room.state.activeContestantSeatId,
                    kind: "mc",
                    prompt: question.prompt,
                    options: question.options,
                    questionId: question.id,
                });
            }
            break;
        }

        case GamePhase.TeamFinal: {
            const question: BankQuestion | null = room.finalRoundQuestions.getCurrentQuestion("team");
            client.send("finalQuestion", finalQuestionPayload("team", question));
            if (question && room.currentFinalTeamBuzzer !== null) {
                client.send("finalBuzz", { questionId: question.id, seatId: room.currentFinalTeamBuzzer });
            }
            break;
        }

        case GamePhase.ChaserFinal: {
            const question: BankQuestion | null = room.finalRoundQuestions.getCurrentQuestion("chaser");
            client.send("finalQuestion", finalQuestionPayload("chaser", question));
            break;
        }

        case GamePhase.GameEnd: {
            if (room.gameWinner !== null) {
                client.send("endGame", { winner: room.gameWinner });
            }
            break;
        }
    }
}
