# 037: Per-player message rate limiting

## Goal
AGENTS.md Security states "rate-limit per-player messages (matters when taunts/emotes/picks land)." Today all message handlers are fire-and-forget with no throttling — fine for the current low message volume, but the taunt/emote stretches (which send small messages at high frequency) would be an open invitation to spam and to hammering other players' render loops. Add a thin per-client rate limiter at the message layer before the social channels land.

## Scope
- `server/src/rooms/TriviaRoom.ts`: add a lightweight per-client timestamp tracker (a `Map<string, number[]>` of recent message timestamps keyed by sessionId).
- Define a config constant in `server/src/gameConfig.ts`: `RATE_LIMIT: { maxMessages: number, windowMs: number }` (e.g. `{ maxMessages: 20, windowMs: 10_000 }` — generous for gameplay, tight enough to prevent abuse).
- Before each `onMessage` handler executes, check the tracker. If the client has exceeded the limit in the window, reject the message (send an error message back, log, do not process).
- Clean up the tracker on `onLeave` to avoid memory leaks.
- This is a server-only change — no client impact.

## Acceptance
- `cd server && npm test` passes.
- `cd server && npm run build` passes.
- A new test in `server/test/` asserts that exceeding the rate limit causes subsequent messages to be rejected (does not crash, returns an error).
- `gameConfig.ts` has the `RATE_LIMIT` constant; no magic numbers in room code.

## Dependencies
- None. Low priority — can be done at any point before the social channel features land.
