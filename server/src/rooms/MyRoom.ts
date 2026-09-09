import { Room, Client, CloseCode } from "colyseus";
import { ArraySchema } from "@colyseus/schema"
import { GamePlayer, Question, QuestionInstance, GameState } from "./schema/GameState.js";
import { GamePhase, PlayerRole } from "../TriviaTypes.js";
import { randomInt } from "crypto";

interface RawQuestion {
  difficulty: string
  category: string
  question: string
  correct_answer: string
  incorrect_answers: Array<string>
}

interface TriviaAPIResponse {
  response_code: number
  results : Array<RawQuestion>
}

export class MyRoom extends Room {
  maxClients = 4;
  state = new GameState();
  currentQuestion = new QuestionInstance();
  questions = new Array<Question>();
  answered = new Map<string, boolean>();

  pickAndSendQuestion() {
    if(this.state.activeRound == 5) {
      this.state.currentPhase = GamePhase.GameEnd;
      return;
    }
    this.state.activeRound += 1;
    var question = this.questions[this.state.activeRound-1]
    this.currentQuestion.question = question;
    this.currentQuestion.playersAnswered =  0;
    console.log("Correct answers", this.currentQuestion.question.correctIndex, this.currentQuestion.question.options[this.currentQuestion.question.correctIndex]);

    this.answered = new Map<string, boolean>();
    for (const sessionId of this.state.players.keys()) {
      this.answered.set(sessionId, false);
    }

    this.broadcast("question", {question: question.text, options: question.options});
    this.state.currentPhase = GamePhase.Question
  }

  convertJSONToQuestion(question : RawQuestion) : Question {
    const newQuestion = new Question()
    newQuestion.text = decodeURIComponent(question.question);
    
    const answers : string[] = question.incorrect_answers
    answers.push(question.correct_answer)

    for (let i = 0; i < answers.length-1; i++) {
      const j = randomInt(answers.length - i) + i
      const temp = answers[i]
      answers[i] = answers[j]
      answers[j] = temp
    }

    newQuestion.options = new ArraySchema<string>(...answers.map(answer => decodeURIComponent(answer)));
    newQuestion.correctIndex = answers.findIndex(a => a === question.correct_answer);
    return newQuestion;
  }

  async requestQuestions(numberOfRounds : Number) {
    const response = await fetch(`https://opentdb.com/api.php?amount=${numberOfRounds}&type=multiple&encode=url3986`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data : TriviaAPIResponse = await response.json()
    data.results.forEach(rawQuestion => {
      this.questions.push(this.convertJSONToQuestion(rawQuestion));  
    });
  }

  messages = {
    nextQuestion: (client: Client, message: any) => {
      console.log("Next question!");
      this.pickAndSendQuestion();
    },

    startGame: async (client: Client, message: any) => {
      if(this.state.currentPhase != GamePhase.Lobby) {
        console.log(client.sessionId, "Can not start Quiz when not in Lobby!");
        return;
      }
      console.log(client.sessionId, "Starting quiz!");
      await this.requestQuestions(5);
      this.pickAndSendQuestion();
    },

    answer: (client: Client, message: any) => {
      if (this.state.currentPhase !== GamePhase.Question) return;

      this.answered.set(client.sessionId, true);
      const player = this.state.players.get(client.sessionId);

      if(message.optionIndex == this.currentQuestion.question.correctIndex) {
        player.score += 1;
      }
      console.log(client.sessionId, message.optionIndex === this.currentQuestion.question.correctIndex);
      const allAnswered = Array.from(this.answered.values()).every(v => v === true);
      if (allAnswered) {
        let question = this.questions[this.state.activeRound-1]
        this.broadcast("answerReveal", { answer: question.options[question.correctIndex] });
        this.state.currentPhase = GamePhase.Answer;
      }
    }
  }

  onCreate (options: any) {
    /**
     * Called when a new room is created.
     */
  }

  onJoin (client: Client, options: any) {
    var newPlayer = new GamePlayer();
    newPlayer.name = options.playerName;
    newPlayer.sessionId = client.sessionId;
    newPlayer.role = PlayerRole.Contestant;
    if(this.state.players.size == 0) {
      newPlayer.isHost = true;
    }
    this.state.players.set(client.sessionId, newPlayer);
    this.state.contestantsOrder.push(client.sessionId);
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
