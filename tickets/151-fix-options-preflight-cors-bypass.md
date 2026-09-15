# 151: Fix `/api/questions` OPTIONS preflight bypassing CORS origin checks (`bug-018`)

## Goal
Ticket 131 restricted `/api/questions`'s actual `POST` response to a configured `CLIENT_ORIGIN` in production, but the **OPTIONS preflight** for that same endpoint never reaches the app's own CORS logic at all — so a browser's preflight always succeeds regardless of origin, and the state-changing `POST` still executes server-side before the browser (correctly) discards the unreadable response. Close that gap.

## Root cause (confirmed during ticket 131's verification)
`@colyseus/core`'s `bindRouterToTransport` (`node_modules/@colyseus/core/src/router/index.ts`) installs a `server.prependListener("request", ...)` that intercepts and fully answers **every** `OPTIONS` request on **any** path before Express (and therefore this app's own routes/middleware) ever runs — it writes a default `Access-Control-Allow-Origin: <the request's own Origin> || "*"` header and calls `res.end()` directly. This makes the app's `app.options("/api/questions", allowCrossOrigin, ...)` route (ticket 091) and `allowCrossOrigin`'s origin logic (ticket 131) dead code for real preflight requests — confirmed live: with `CLIENT_ORIGIN=https://trivia.example.com` configured in production, `curl -X OPTIONS http://localhost:2567/api/questions -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: POST"` returns `Access-Control-Allow-Origin: https://evil.example.com` — the attacker's own origin reflected back, not blocked and not the configured origin.

## Impact
Browsers still correctly block a cross-origin page's JS from *reading* the actual `POST /api/questions` response body (ticket 131's origin check on the real response is unaffected and does work) — but since preflight always succeeds, the browser still *sends* the real POST, and the server executes it (appending a row to the question bank) before the response is discarded client-side. A CSRF-adjacent gap: any origin can trigger a real write, it just can't read the result.

## Scope
- `server/src/app.config.ts` / wherever the Colyseus `Server`/transport is constructed — find a way to make the app's own CORS policy win for `/api/questions` specifically despite Colyseus core's `prependListener` running first. Options to evaluate (pick whichever is cleanest against the installed `@colyseus/core` version, documenting why):
  - A `server.prependListener("request", ...)` registered *before* Colyseus's own (if listener order is controllable at the point this app constructs its `http.Server`/`Server` instance) that intercepts `OPTIONS /api/questions` specifically, answers it directly with the correct origin-checked headers, and stops propagation before Colyseus's listener runs.
  - Investigate whether `@colyseus/core` exposes any config to disable/override its default CORS behavior (check its docs/types for the installed version) before reaching for a raw listener hack.
  - Whatever the mechanism, it must not change `/monitor`'s or the WebSocket transport's own OPTIONS/CORS behavior — scope the fix to `/api/questions` only.
- Add a regression test (integration-level, since this is really an HTTP/listener-ordering behavior, not something the pure `allowCrossOrigin` unit tests would catch) that boots the real server and asserts an `OPTIONS /api/questions` preflight from a disallowed `Origin` in production mode does **not** return that origin (or `*`) in `Access-Control-Allow-Origin`.

## Acceptance
- `cd server && npm test && npm run build` green.
- Manual: with `NODE_ENV=production` and `CLIENT_ORIGIN` set, `curl -X OPTIONS http://localhost:2567/api/questions -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: POST"` no longer reflects `https://evil.example.com` (or `*`) back.
- Confirm `/monitor` and the WebSocket transport's own CORS/OPTIONS handling are unchanged.

## Dependencies
131 (done) — this is its direct follow-up, found during that ticket's own manual verification.
