import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { GamePhase } from "../../TriviaTypes.js"

export class MyRoomState extends Schema {

  @type("string") mySynchronizedProperty: string = "Hello world";

}

export class Player extends Schema {
  @type("string") name : string = "PlayerName"
  @type("boolean") isHost : boolean = false
  @type("number") score : number = 0
}

export class Question extends Schema {
  @type("string") text = "";
  @type(["string"]) options = new ArraySchema<string>();
  @type("number") correctIndex = -1;
}

export class QuestionInstance extends Schema {
  @type(Question) question : Question = new Question();
  @type("number") playersAnswered : number = 0; 
}

export class QuizState extends Schema {
  @type({map : Player}) players = new MapSchema<Player>();
  @type("string") currentState : GamePhase = GamePhase.Lobby
  @type({ map: "boolean" }) answered = new MapSchema<boolean>();
  @type("number") currentRound : number = 0;
}

