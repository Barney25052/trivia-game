# 130: Deployment — serve the built client from the server process

## Goal
One deployable process. `server/ecosystem.config.cjs` already runs `build/index.js` under PM2, but nothing serves the built client — today you still need Vite's dev server or a separate static host. This ticket makes `npm run build` (client) + `npm run build` (server) + `pm2 start ecosystem.config.cjs` (or `NODE_ENV=production node build/index.js`) the whole production story.

## Scope
- `server/src/app.config.ts` — inside the existing `express: (app) => {...}` block, when `process.env.NODE_ENV === "production"`, `express.static(...)` the built client (`client/dist`) and add a catch-all GET fallback to `client/dist/index.html` for anything not already matched by `/monitor` or `/api/*` (the app has no client-side router today — a plain index fallback is enough, don't add routing infrastructure that doesn't exist yet).
- Resolve the client `dist` path relative to the server's own file location (`import.meta.url` / `fileURLToPath`, not `process.cwd()`, since PM2's cwd may not be `server/`) — e.g. `../../client/dist` from `build/app.config.js` once compiled. Verify the relative path survives the `tsc` build step (compiled output layout differs from `src/`).
- Update `AGENTS.md`'s "Layout & commands" with the production build order (client build must exist before the server starts in production mode) and the new invariant that `server/src/app.config.ts` now reads from `../client/dist`.
- Don't touch the dev flow: `NODE_ENV !== "production"` keeps using the Vite dev server on :5173 exactly as today; the playground route's existing `NODE_ENV` guard is the precedent to copy.

## Real behavior this ticket should NOT change
Room logic, the `/api/questions` endpoint, `/monitor`, dev-mode behavior.

## Acceptance
- `cd client && npm run build`, then `cd server && npm run build`.
- `cd server && NODE_ENV=production node build/index.js` (or via the PowerShell equivalent) serves the client at `http://localhost:2567/` — a full game plays end-to-end (Lobby → chaser pick → cash builder → offer → chase → final → results) against this single process, no Vite dev server running.
- `npm test` (server) still green — the new static/catch-all route must not shadow `/monitor` or `/api/questions`.

## Dependencies
None.
