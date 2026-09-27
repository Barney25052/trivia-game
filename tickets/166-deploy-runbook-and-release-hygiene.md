# 166: Deploy runbook, PM2 production env, READMEs and dependency advisories

## Goal
Pre-upload pass, 2026-09-27: whoever deploys or opens the GitHub repo should find what they need, and a plain `pm2 start` must actually run production. Before this, both READMEs were untouched framework templates ("Welcome to Colyseus!", the Vue + Vite starter), there was no deploy runbook, and GOAL.md's last hardening item (TLS/wss) was waiting on documentation.

## Scope
- New root `README.md`: what the game is; running it locally (install, seed, dev servers); the green-gate checks; **deploying** (build order, first-deploy-only seeding and its warning, `server/.env.production` for the admin login, PM2 or plain node, one instance only, HTTPS via any TLS proxy with a Caddy example); the admin routes; pointers to the project docs.
- Removed `server/README.md` and `client/README.md` (template leftovers, per AGENTS.md "No cruft").
- `server/ecosystem.config.cjs`: sets `NODE_ENV=production` and `cwd: __dirname`. It only ever runs the production build, but without `NODE_ENV` a plain `pm2 start ecosystem.config.cjs` ran in dev mode: the Colyseus playground exposed, `/monitor` and adding questions without a login, and the client not served. `cwd` lets `@colyseus/tools` find `server/.env.production`.
- `server/package.json` `engines.node`: `>= 22.0.0`. `@colyseus/core` 0.17 requires Node 22, so the old `>= 20.9.0` was wrong.
- Dependencies: `npm update express body-parser qs` in `server/` (lockfile only) moves `qs` to 6.16.0, fixing a moderate DoS advisory (GHSA-4mjr-xmp4-gh2g, and GHSA-x5fp-wj9c-mxmx) that any request's query string could reach through Express. `npm audit --omit=dev` still lists 8 low/moderate advisories, all under `colyseus` → `@colyseus/auth` (`grant`, `request-oauth`, `uuid`, `elliptic`, `jwk-to-pem`). This app never mounts the auth routes, and npm's only offered fix is a breaking downgrade to Colyseus 0.15, so they're left alone. The client has none.
- `.claude/launch.json`: a `server-prod` config that runs the production build on :8080 (env set through `--import`; a `node -e` launcher breaks Colyseus's transport lookup) for checking a deploy locally.
- Docs: AGENTS.md (deploy pointer, `.env.production`, the admin login covering adding questions, the seeding warning, the new `SERVER_URL` rule, the stale 813-row count now 1183, the stale `api-test.py` and "nothing fetches from opentdb yet" lines); GOAL.md (TLS/wss item done as documented, readiness pass recorded).

## Acceptance
- `cd server && npm test` and `npm run build` in both packages green.
- `cd server && npm audit --omit=dev`: no advisory outside `@colyseus/auth`.
- The production build on :8080 serves the client and plays through the checks in tickets 162–165.

## Dependencies
162, 163 (the runbook describes them).
