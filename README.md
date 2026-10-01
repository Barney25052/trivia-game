# Big Baws Trivia

An online multiplayer trivia game inspired by *The Chase*. One player is the **Chaser**, everyone else is a **Contestant**. Each contestant builds a cash pot against the clock, takes an offer from the Chaser, then races them down a money board. The survivors finish with a buzz-in final round against the Chaser's own run.

- `server/`: [Colyseus](https://colyseus.io) 0.17 + Express + TypeScript. It holds all game state, timers and scoring.
- `client/`: Vue 3 + Vite + the Colyseus SDK.
- Typed-answer questions come from the project's own bank (`server/data/questions.json`, loaded into SQLite). Multiple-choice questions come from the [Open Trivia Database](https://opentdb.com) at runtime, with a local backup set.

The two packages are separate npm projects, with no root `package.json`.

## Running it locally

Needs Node.js 22 or newer.

```bash
cd server
npm install
npx tsx scripts/seedQuestionsDb.ts   # builds data/questions.db from data/questions.json
npm start                            # game server on :2567, reloads on change
```

```bash
cd client
npm install
npm run dev                          # http://localhost:5173
```

Open the client in two or more browser windows: one creates a lobby, the others join it with the 4-letter room code.

Re-run the seed script whenever `server/data/questions.json` changes. It replaces the database's contents with the file's.

## Checks

```bash
cd server && npm test        # mocha suite
cd server && npm run build   # tsc
cd client && npm run build   # vue-tsc typecheck + Vite build
```

All three must pass for every change (see [AGENTS.md](AGENTS.md)).

## Deploying

In production one Node process serves everything: the built client, the game server and the admin routes.

1. **Build**, client first (the server serves `client/dist`):

   ```bash
   cd client && npm ci && npm run build
   cd ../server && npm ci && npm run build
   ```

2. **Seed the question bank** on every deploy:

   ```bash
   cd server && npx tsx scripts/seedQuestionsDb.ts
   ```

   The database is built from `server/data/questions.json` and nothing writes to it while the game runs, so reseeding is always safe. To add questions, edit `questions.json` and deploy again.

3. **Configure** `server/.env.production` (gitignored; loaded automatically when `NODE_ENV=production`), or set the same variables in the host's environment settings. All of them are optional:

   ```bash
   MONITOR_USER=choose-a-username   # the admin login, for /monitor
   MONITOR_PASS=choose-a-long-password
   PORT=2567                        # 2567 by default; most hosts set this themselves
   ```

   Without `MONITOR_USER`/`MONITOR_PASS`, `/monitor` stays shut (503) and the server says so at startup. The game itself is unaffected.

4. **Start** with PM2 from `server/`:

   ```bash
   pm2 start ecosystem.config.cjs
   ```

   The PM2 config sets `NODE_ENV=production` itself. Without PM2: `NODE_ENV=production node build/index.js`. Keep it to **one instance**: room caps and other state live in the process (see the comment in `ecosystem.config.cjs`).

5. **Put HTTPS in front** with any TLS reverse proxy that passes WebSockets through. With [Caddy](https://caddyserver.com), for example:

   ```
   trivia.example.com {
       reverse_proxy localhost:2567
   }
   ```

   The client connects back to whichever host served it, over `wss://` when the page came over `https://`, so no client build settings are needed. Set `VITE_SERVER_URL` at build time only to point the client at a different server.

### Admin

- `/monitor`: the Colyseus room monitor. It asks for the admin login in production; in development it needs none.

## Project docs

- [GOAL.md](GOAL.md): the game rules, the plan and decisions made along the way.
- [AGENTS.md](AGENTS.md): repo conventions, commands and gotchas.
- [tickets/](tickets/README.md): the work log, one ticket per change.
- [BUGS.md](BUGS.md): bugs found and where they went.
- [HUMAN_TASKS.md](HUMAN_TASKS.md): hand-drawn art still to make. The game falls back to placeholders until it lands.
