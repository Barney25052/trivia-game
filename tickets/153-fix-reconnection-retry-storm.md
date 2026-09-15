# 153: Fix reconnection retry storm on page reload/navigate-away while connected (`bug-020`)

## Goal
`AGENTS.md` documents `sessionId` as ephemeral and reload as an intentional "forfeit the seat" — a reload should just drop the connection cleanly. Instead, reloading or navigating away from an active room connection leaves the Colyseus client repeatedly attempting reconnection handshakes that each immediately fail (~15 failed `WebSocket connection ... failed` errors plus a final `net::ERR_CONNECTION_REFUSED` observed in one manual repro), before settling. Found during ticket 133's manual verification (unrelated to that ticket's HomeScreen.vue scope).

## What you saw
1. Join or create a lobby (client connects via the Colyseus SDK, `client.create`/`client.joinById`).
2. Reload the page (or navigate away) while still connected.
3. Watch the browser console — a burst of repeated `WebSocket connection ... failed` errors for a `reconnectionToken`-based URL, before finally giving up.

## Expected
A page unload/reload should tear down the room connection cleanly with no retry storm — consistent with the documented "reload = forfeit the seat" model (a fresh reload joins as a *new* player; there's no reconnection story here except the separate, not-yet-built host-reconnect stretch goal).

## Investigation starting points
- `client/src/App.vue` — how the Colyseus `Room` instance is created/held, and whether there's any `beforeunload`/`onUnmounted` cleanup calling `room.leave()`/removing listeners before the page actually unloads.
- The Colyseus JS SDK's default reconnection behavior on an unexpected close — check whether the SDK auto-attempts reconnection using a `reconnectionToken` unless explicitly told not to (e.g. an option on `client.create`/`joinById`, or needing an explicit `room.leave()` call before unload to signal "this is intentional, don't reconnect").
- Confirm this is purely client-side SDK/reconnection-attempt noise (as observed) and not evidence of a server-side issue — the server's own `onLeave`/disconnect handling (AGENTS.md: "Host leaving disconnects the room... close code 6767") should already be correct per existing tests; this ticket is about the client not thrashing on its way out.

## Acceptance
- Reproduce the repro steps above before your fix (confirm the retry storm exists) and after (confirm it's gone or reduced to a single clean disconnect, no repeated failed reconnection attempts).
- `cd client && npm run build` passes.
- `cd server && npm test` unaffected (this is client-side only unless investigation proves otherwise).

## Dependencies
None.
