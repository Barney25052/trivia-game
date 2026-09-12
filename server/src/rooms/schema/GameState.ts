import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { GamePhase, PlayerRole } from "../../TriviaTypes.js";
import { BOARD, CHASER_POT, CHASER_SELECTION } from "../../gameConfig.js";

export class GamePlayer extends Schema {
    @type("string") name: string = "";
    @type("string") seatId: string = "";
    @type("string") role: PlayerRole = PlayerRole.Contestant;
    @type("number") cashBuilderMoney: number = 0;
    @type("uint16") cashBuilderCorrectAnswers: number = 0;
    @type("number") boardPos: number = BOARD.escapeSpace;
    @type("boolean") isEliminated: boolean = false;
    @type("boolean") madeItBack: boolean = false;
    @type("boolean") isHost: boolean = false;
    @type("string") chaserVote: string = "";
    @type("boolean") revealReady: boolean = false;
    @type("string") seatState: string = "waiting";
    @type("string") chaserCharacterId: string = "";
    @type("string") character: string = "";
}

export class GameState extends Schema {
    @type({ map: GamePlayer }) players = new MapSchema<GamePlayer>();
    @type("string") currentPhase: GamePhase = GamePhase.Lobby;
    @type("string") chaserSelectionMode: string = CHASER_SELECTION.defaultMode;
    @type("string") chaserSeatId: string = "";
    @type("number") chaserPot: number = CHASER_POT.initial;
    @type("number") teamPot: number = 0;
    @type("string") activeContestantSeatId: string = "";
    @type("number") activeRound: number = 0;
    @type("number") teamScore: number = 0;
    @type("number") chaserScore: number = 0;
    /** The dollar amount the active contestant is playing for in the current
     * Chase — set from the chosen offer tier (ticket 065) so every client
     * (not just the one who picked it) can display it on the board. */
    @type("number") chaseWagerAmount: number = 0;
    @type(["string"]) contestantsOrder = new ArraySchema<string>();
}