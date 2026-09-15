# 131: Protect `/monitor` with auth; tighten `/api/questions` CORS for production

## Goal
Two dev-only-permissive spots called out by name in `AGENTS.md`'s Security section and `GOAL.md`'s Phase 6 plan ("protect `/monitor` with auth"), still open. Fine for local play; not fine the moment the server is reachable by anyone but the people at the table.

## Scope
- `server/src/app.config.ts` — `app.use("/monitor", monitor())`: add a small hand-rolled HTTP Basic Auth middleware in front of it, gated to production only (`NODE_ENV === "production"`) so local dev stays frictionless. Credentials from env vars (`MONITOR_USER`, `MONITOR_PASS`); if either is unset in production, fail closed (return 503/deny access, log a clear startup warning) rather than silently leaving the panel open. No new npm dependency needed — Basic Auth is a one-header check (`Authorization: Basic <base64>`) against a `timingSafeEqual` comparison (avoid a plain `===` string compare on the secret).
- `/api/questions`'s `allowCrossOrigin` middleware currently sets `Access-Control-Allow-Origin: *` unconditionally. In production, restrict it to a configured origin (`CLIENT_ORIGIN` env var, e.g. `https://your-deployed-host`) instead of `*`; keep the current permissive `*` behavior when `NODE_ENV !== "production"` (the Vite dev server's origin varies by machine/port, so don't hardcode `localhost:5173`).
- Document both new env vars (`MONITOR_USER`/`MONITOR_PASS`/`CLIENT_ORIGIN`) in `AGENTS.md`.

## Acceptance
- `npm test` / `npm run build` (server) green.
- Manual: with `NODE_ENV=production` and the env vars set, `GET /monitor` without credentials returns 401; with correct `Authorization: Basic` credentials it renders the panel. With `NODE_ENV` unset (dev), `/monitor` behaves exactly as today (no prompt).
- Manual: with `NODE_ENV=production` and `CLIENT_ORIGIN` set, a `POST /api/questions` from a different `Origin` is rejected by the browser (CORS header mismatch); dev mode is unaffected.

## Dependencies
None. Pairs naturally with 130 (both are production-mode `app.config.ts` changes) but neither blocks the other.
