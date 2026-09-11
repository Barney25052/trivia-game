import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { GamePhase, PlayerRole } from "../../TriviaTypes.js";
import { BOARD, CHASER_POT, CHASER_SELECTION } from "../../gameConfig.js";

export class GamePlayer extends Schema {
    @type("string") name: string = "";
    @type("string") sessionId: string = "";
    @type("string") seatId: string = "";
    @type("string") role: PlayerRole = PlayerRole.Contestant;
    @type("number") cashBuilderMoney: number = 0;
    @type("uint16") cashBuilderQuestionsAsked: number = 0;
    @type("number") boardPos: number = BOARD.escapeSpace;
    @type("boolean") isEliminated: boolean = false;
    @type("boolean") madeItBack: boolean = false;
    @type("boolean") isHost: boolean = false;
    @type("string") chaserVote: string = "";
    @type("boolean") revealReady: boolean = false;
    @type("number") score: number = 0;
    @type("string") seatState: string = "waiting";
    @type("string") chaserCharacterId: string = "";
}

export class GameState extends Schema {
    @type({ map: GamePlayer }) players = new MapSchema<GamePlayer>();
    @type("string") currentPhase: GamePhase = GamePhase.Lobby;
    @type("string") chaserSelectionMode: string = CHASER_SELECTION.defaultMode;
    @type("string") chaserSessionId: string = "";
    @type("number") chaserPot: number = CHASER_POT.initial;
    @type("number") teamPot: number = 0;
    @type("string") activeContestantSessionId: string = "";
    @type("number") activeRound: number = 0;
    @type("number") teamScore: number = 0;
    @type(["string"]) contestantsOrder = new ArraySchema<string>();
}