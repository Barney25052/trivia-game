import { Room, Client, CloseCode } from "colyseus";
import { Player, MyState } from "./schema/MyRoomState.js";

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyState();

  messages = {
    question: (client: Client, message: any) => {
      /**
       * Handle "yourMessageType" message.
       */
      console.log(client.sessionId, "sent a message:", message);
    },
    startGame: (client: Client, message: any) => {

      console.log(client.sessionId, "sent a message:", message);
      this.broadcast("question", {question: "What is your favourite color?", a1: "Red", a2: "Yellow", a3: "Blue", a4: "Pink"})
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
