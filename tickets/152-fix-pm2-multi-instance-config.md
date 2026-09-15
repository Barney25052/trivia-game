# 152: Fix `ecosystem.config.cjs` multi-instance PM2 config contradicting the single-process assumption (`bug-019`)

## Goal
`server/ecosystem.config.cjs` sets `instances: os.cpus().length` under `exec_mode: "fork"` — the stock Colyseus Cloud template default (see its own header comment, "Colyseus Cloud Deployment Configuration"). But `AGENTS.md`'s gotchas and ticket 132 (concurrent-room cap) both explicitly assume **one process**: "this is a single-process app (PM2 `exec_mode: fork`), so an in-memory counter is correct." On a multi-core self-hosted machine, `os.cpus().length` forks multiple independent processes of the same app, each binding the same `PORT` with no reverse-proxy/load-balancer or shared presence/driver in front of them — found live during ticket 132's implementation.

## The actual decision needed (flag for the user, don't just guess)
This config's own header comment says it's the Colyseus Cloud template — Colyseus Cloud's hosted platform may provide its own port/LB handling around multi-instance PM2 that makes `os.cpus().length` correct *there*, in a way a raw self-hosted `pm2 start ecosystem.config.cjs` (the command AGENTS.md documents today) does not replicate. Two real options:
1. **Single instance** (`instances: 1`), matching every single-process assumption already baked into the app (ticket 132's in-memory room-cap counter, any other process-local state) and AGENTS.md's documented self-hosted PM2 deploy story.
2. **Keep multi-instance**, but then the app needs real support for it: a shared Colyseus `presence`/`driver` (e.g. Redis) so matchmaking works across processes, per-instance port assignment + a reverse proxy in front, and every process-local abuse guard (ticket 132's room cap, rate limiting) converted to use the shared presence store instead of an in-process counter — a substantially bigger change than this ticket's likely scope.

Given AGENTS.md and ticket 132 already committed to the single-process model, the default fix here is **option 1** unless the user says they're specifically deploying to Colyseus Cloud (in which case defer to its own docs/tooling rather than hand-rolling multi-instance support).

## Scope
- `server/ecosystem.config.cjs` — set `instances: 1` (drop the `os` import if nothing else uses it), unless the user confirms Colyseus Cloud is the actual deploy target, in which case leave a comment explaining why multi-instance is intentional there and that self-hosted PM2 users should override it.
- `AGENTS.md` — the PM2 deploy bullet should say explicitly that this is a single-instance config and why (ties back to ticket 132's in-memory counter and any other process-local state), so a future change to `ecosystem.config.cjs` doesn't quietly reintroduce this.

## Acceptance
- `cd server && npm run build` still green (no code changes expected beyond the config file, this is a deploy-config-only ticket).
- `pm2 start ecosystem.config.cjs` (or a manual read of the resulting config) shows exactly one instance.
- AGENTS.md updated to state the single-instance invariant explicitly.

## Dependencies
132 (done) — this is its direct follow-up, found during that ticket's own review.
