import { MapSchema, Schema, type } from "@colyseus/schema";

export class MyRoomState extends Schema {

  @type("string") mySynchronizedProperty: string = "Hello world";

}

export class Player extends Schema {
  @type("string") name : string = "PlayerName"
  @type("boolean") isHost : boolean = false
}

export class MyState extends Schema {
  @type({map : Player}) players = new MapSchema<Player>();
}
