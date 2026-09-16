import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { GamePhase, PlayerRole } from "../../TriviaTypes.js";
import { BOARD, CASH_BUILDER, CHASER_ABILITIES, CHASER_POT, CHASER_SELECTION } from "../../gameConfig.js";

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
    /** Resumable Chaser-final clock (ticket 094), mirrored into synced state
     * (ticket 105) so every client can render the real running/paused status
     * and true remaining time instead of a client-only guess (bug-013) — see
     * `TriviaRoom.syncChaserFinalClockState`. */
    @type("boolean") chaserFinalClockRunning: boolean = false;
    @type("number") chaserFinalRemainingMs: number = 0;
    /** The room's actual (possibly clamped/overridden) cash-builder duration
     * (ticket 112, fixing bug-015) — set once in TriviaRoom.onCreate from the
     * already-clamped `room.cashBuilderDurationMs`, so CashBuilderScreen.vue
     * can start its "Time left" display from the real configured duration
     * instead of a hardcoded guess. Doesn't change mid-game, so unlike the
     * Chaser-final clock (ticket 105) this needs no running/paused pair. */
    @type("number") cashBuilderDurationMs: number = CASH_BUILDER.durationMs;
    /** Chaser ability-use counters/flags (ticket 140) — synced because these
     * aren't hidden info, same reasoning as the Chaser pot being public.
     * Defaults come from CHASER_ABILITIES (ticket 139); tickets 141/142 spend
     * them on the actual per-ability effects. There is one Chaser per room
     * for the whole game, so these are only ever set once at construction —
     * no mid-game reset needed. */
    @type("uint8") fiftyFiftyUsesRemaining: number = CHASER_ABILITIES.fiftyFifty.usesPerGame;
    @type("uint8") skipUsesRemaining: number = CHASER_ABILITIES.skip.usesPerGame;
    @type("uint8") pushbackImmunityUsesRemaining: number = CHASER_ABILITIES.pushbackImmunity.usesPerGame;
    /** Once-per-table-round active-ability flags — reset to false whenever a
     * new contestant's Chase starts (the `startChase` effect in effects.ts,
     * alongside where boardPos is set for the new round). */
    @type("boolean") doubleTimeUsedThisTableRound: boolean = false;
    @type("boolean") reRackUsedThisTableRound: boolean = false;
    @type("boolean") jumbleUsedThisTableRound: boolean = false;
    /** Transient: true from Double Time's activation until the next chase
     * question resolves (consumed either way) — reset in
     * TriviaRoom.resolveChaseQuestion and startNextChaseQuestion/
     * clearChaseAnswerTimer so it never survives past the question it was
     * armed for. */
    @type("boolean") doubleTimeArmed: boolean = false;
    /** Maggie's Silence passive (ticket 144): the seatId that scored the most
     * recent team-final correct answer — that seat can't buzz in again on the
     * very next question while Maggie is the Chaser (enforced in buzzIn).
     * Tracked unconditionally by submitFinalAnswer's correct branch for every
     * Chaser character (cheap), reset to "" by startFinalTeam so a fresh team
     * final never starts with anyone silenced. Spans across questions —
     * separate from the per-question buzz lock (currentFinalTeamBuzzer /
     * finalTeamQuestionResolved), which advanceFinalTeamQuestion still owns. */
    @type("string") lastTeamFinalCorrectSeatId: string = "";
}