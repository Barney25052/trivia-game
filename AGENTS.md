# AGENTS.md

Multiplayer trivia game built on Colyseus. Two independent npm projects — there is **no root `package.json`**, no workspaces, no lint/format config. Install and run commands from each subdirectory. Default working branch is `dev`.

## Layout & commands

- `server/` — Colyseus 0.17 + Express + TypeScript (ESM, `NodeNext`). Entry: `src/index.ts` → `src/app.config.ts`. Room registered as `trivia` (`app.config.ts`).
  - `npm start` — run dev server with hot reload on port 2567 (`tsx watch`)
  - `npm test` — mocha via tsx (`test/**.test.ts`, `--exit`, 15s timeout)
  - `npm run build` — `rimraf build && tsc -p tsconfig.build.json` (build output goes to `build/`, used by PM2 deployment)
- `client/` — Vue 3 (`<script setup>`) + Vite + Colyseus SDK. Entry: `src/main.ts` → `src/App.vue`.
  - `npm run dev` — Vite dev server
  - `npm run build` — `vue-tsc -b && vite build` (this is the typecheck step; there is no separate typecheck script)
- `api-test.py` — root-level scratch script for testing the opentdb.com API; not part of the app.
- Server fetches questions **live from opentdb.com** (`encode=url3986`) when `startGame` is received; answers are `decodeURIComponent`'d on the server. Running the game requires network access to opentdb.

## Gotchas

- Template leftovers you'll still hit: `npm run loadtest` references room name `my_room`, but the only registered room is `trivia`. The old template test `server/test/MyRoom.test.ts` (which referenced `my_room` and `MyRoomState.mySynchronizedProperty`) was removed in ticket 002 — it was failing and would not compile after `QuizState` was deleted. Ticket 011 finishes the loadtest cleanup.
- `GamePhase` enum is duplicated in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` — both are used; keep them identical. The old dead copy in `common/TriviaTypes.ts` was removed in ticket 001.
- Client hardcodes the server URL `ws://localhost:2567` in `client/src/App.vue` (`SERVER_URL`).
- Game flow: create/`joinById` room `trivia` with `{ playerName }`; first joiner is host; host sends `startGame` → 5 questions; phases progress `Lobby → Question → Answer → GameEnd` via `QuizState` schema (`server/src/rooms/schema/MyRoomState.ts`). Host leaving disconnects the room (`onLeave`, close code 6767).
- PM2 deploy config (`server/ecosystem.config.cjs`) runs `build/index.js`, so `npm run build` is required before deploying. `@colyseus/monitor` is exposed at `/monitor`; the Colyseus playground serves at `/` except in production.
- `client/package.json` has `allowScripts` for `msgpackr-extract`; this can matter if `npm install` fails under restricted script settings.