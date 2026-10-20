# 171: Keep a dropped player's seat and reconnect them

## Goal
Direct user request, 2026-10-20: "Sometimes people get kicked from the lobby with no feedback and have to restart lobby", and in a 1v1 the caught contestant was sent back to the home screen instead of playing the final. Neither reproduces on a steady connection: a caught 1v1 contestant reaches the Team Final with a working buzzer (played live against a bot). Both match a dropped WebSocket, such as a phone switching apps to share the room code, a network blip or a Render restart. The server never allowed reconnection, so a drop removed the seat at once, and a dropped host closed the room for everyone.

## Scope
- Server: `TriviaRoom.onDrop` keeps the seat with `allowReconnection` for `RECONNECTION.lobbyGraceSeconds` (120) in the Lobby and `RECONNECTION.gameGraceSeconds` (30) once the game has started; `onLeave` (existing forfeit and cleanup) only runs if they don't come back. A synced `GamePlayer.connected` flag is false while the seat waits. `startGame` refuses to start while anyone is reconnecting.
- `onReconnect` re-sends what the player missed while away: the live Cash Builder or chase question, the offer, the final-round question and buzz, and the result once the game has ended (`resendLiveContext` in `handlers/reconnect.ts`).
- Host-left close code moves from 4001 to `ROOM_SETTINGS.hostLeftCloseCode` (4100). 4001 is Colyseus's own `SERVER_SHUTDOWN`, so a server restart used to tell players "The host left".
- Client: the SDK's automatic reconnection retries long enough to cover the lobby window; a "Reconnecting…" banner while it does; the lobby dims a waiting seat and tags it "Reconnecting", and the start hint names who it's waiting for. The home screen says why you're back: host left, server restarted, or "You were away too long, so you lost your seat".
- AGENTS.md: the `sessionId` gotcha now describes the reconnection window. A reload is still a consented leave (ticket 153), so it still forfeits the seat.
- UI direction signed off by the user in chat (banner plus dimmed seat).

## Acceptance
- New `server/test/reconnect.test.ts`: a dropped player keeps their seat and comes back on the same seat; a dropped host doesn't close the room; a seat that isn't reclaimed in time is removed through the usual `onLeave` path; `startGame` waits for a reconnecting player; a reconnecting active contestant gets the live Cash Builder question again; a consented host leave closes the room with 4100.
- `cd server && npm test` green; `npm run build` green in both packages.
- Seen live: dropping a lobby player's socket shows the banner on their screen and the dimmed seat on the host's, and they come back on the same seat.

## Dependencies
153 (consented leave on unload), 164 (late joins refused).
