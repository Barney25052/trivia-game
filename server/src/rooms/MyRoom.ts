import { Room, Client, CloseCode } from "colyseus";
import { ArraySchema, MapSchema } from "@colyseus/schema"
import { Player, Question, QuestionInstance, QuizState } from "./schema/MyRoomState.js";
import { GamePhase } from "../TriviaTypes.js";

export class MyRoom extends Room {
  maxClients = 4;
  state = new QuizState();
  currentQuestion = new QuestionInstance();

  pickAndSendQuestion() {
    var question = new Question()
    question.text = "What is your favourite colour?"
    question.options = new ArraySchema<string>("Red", "Yellow", "Blue", "Pink");
    question.correctIndex = 2;
    this.currentQuestion.question = question;
    this.currentQuestion.playersAnswered =  0;

    this.state.answered = new MapSchema<boolean>();
    for (const sessionId of this.state.players.keys()) {
      this.state.answered.set(sessionId, false);
    }

    this.broadcast("question", {question: question.text, options: question.options});
    this.state.currentState = GamePhase.Question
  }

  messages = {
    nextQuestion: (client: Client, message: any) => {
      console.log("Next question!");
      this.pickAndSendQuestion();
    },

    startGame: (client: Client, message: any) => {
      if(this.state.currentState != GamePhase.Lobby) {
        console.log(client.sessionId, "Can not start Quiz when not in Lobby!");
        return;
      }
      console.log(client.sessionId, "Starting quiz!");
      this.pickAndSendQuestion();
    },

    answer: (client: Client, message: any) => {
      if (this.state.currentState !== GamePhase.Question) return;

      this.state.answered.set(client.sessionId, true);
      const player = this.state.players.get(client.sessionId);

      if(message.optionIndex == this.currentQuestion.question.correctIndex) {
        player.score += 1;
      }
      console.log(client.sessionId, message.optionIndex === this.currentQuestion.question.correctIndex);
      const allAnswered = Array.from(this.state.answered.values()).every(v => v === true);
      if (allAnswered) {
        this.state.currentState = GamePhase.Answer;
      }
    }
  }

  onCreate (options: any) {
    /**
     * Called when a new room is created.
     */
  }

  onJoin (client: Client, options: any) {
    var newPlayer = new Player();
    newPlayer.name = options.playerName;
    if(this.state.players.size == 0) {
      newPlayer.isHost = true;
    }
    this.state.players.set(client.sessionId, newPlayer);
    console.log("Client joined room", this.roomId);
    console.log(options)
  }

  onLeave (client: Client, code: CloseCode) {
    if(this.state.players.get(client.sessionId).isHost) {
      this.disconnect(6767)
    }
    this.state.players.delete(client.sessionId);
    console.log("Client left room", this.roomId)
  }

  onDispose() {
    /**
     * Called when the room is disposed.
     */
    console.log("room", this.roomId, "disposing...");
  }

}
