# 169: Render Blueprint for free click-to-deploy hosting

## Goal
The user chose a free, click-to-deploy host with the host's own address, 2026-10-01. Render's free web service is the one that fits: it runs a long-lived Node process, passes WebSockets through, gives an HTTPS `onrender.com` address and deploys from GitHub. A `render.yaml` at the repo root makes the whole setup one step in the dashboard instead of hand-typed build and start commands.

## Scope
- `render.yaml` (new, repo root): one free `web` service, `runtime: node`, `branch: main`, `region: frankfurt`, Node pinned to 24.19.0 (the version the project is developed on). The build command builds the client, builds the server and seeds the question bank; the start command is `cd server && node build/index.js` with `NODE_ENV=production`.
- The seed runs in the build, not at start: the free plan's disk is reset on every restart or spin-down, and only what the build produced comes back. Nothing writes to the bank at runtime since ticket 168, so this is safe.
- `README.md` → Deploying gains a "Render" section ahead of the self-hosted runbook. `AGENTS.md` notes the file.
- No application code changes.

## Acceptance
- A fresh clone of `main` with `NODE_ENV=production` set runs the Blueprint's build command to the end (client build, server build, 1183 questions seeded) and the start command serves `/` (200), keeps `/monitor` shut (503 with no login configured) and creates a `trivia` room.
- Every relative import in `client/src` and `server/src` (131 checked) resolves to a committed file with the exact same letter case, as a Linux host needs.
- The live deploy itself is the user's step (it needs their Render account) and is checked afterwards.

## Dependencies
130 (server serves the client), 162 (client finds the host that served it), 168 (no runtime writes to the bank).
