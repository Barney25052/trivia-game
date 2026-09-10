# AGENTS.md

Multiplayer trivia game built on Colyseus. Two independent npm projects — there is **no root `package.json`**, no workspaces, no formatter/linter tooling (style rules are documented — see "Code requirements"). Install and run commands from each subdirectory. Default working branch is `dev`.

## Layout & commands

- `server/` — Colyseus 0.17 + Express + TypeScript (ESM, `NodeNext`). Entry: `src/index.ts` → `src/app.config.ts`. Room registered as `trivia` (`app.config.ts`).
  - `npm start` — run dev server with hot reload on port 2567 (`tsx watch`)
  - `npm test` — mocha via tsx (`test/**.test.ts`, `--exit`, 15s timeout)
  - `npm run build` — `rimraf build && tsc -p tsconfig.build.json` (build output goes to `build/`, used by PM2 deployment)
- `client/` — Vue 3 (`<script setup>`) + Vite + Colyseus SDK. Entry: `src/main.ts` → `src/App.vue`.
  - `npm run dev` — Vite dev server
  - `npm run build` — `vue-tsc -b && vite build` (this is the typecheck step; there is no separate typecheck script)
- `api-test.py` — root-level scratch script for testing the opentdb.com API; not part of the app.
- The open-ended question bank (`server/src/questions/bank.ts`, 45 questions) is loaded on the server and covered by tests; wiring it into the cash-builder/final phases is Phase 2+. The board chase plans to pull multiple-choice questions from opentdb (Phase 4); nothing fetches from opentdb at runtime yet.

## Gotchas

- The template loadtest (`npm run loadtest` in `server/`) joins room `trivia`; the old template test `server/test/MyRoom.test.ts` (which referenced `my_room` and `MyRoomState.mySynchronizedProperty`) was removed in ticket 002 — it was failing and would not compile after `QuizState` was deleted.
- `GamePhase` enum is duplicated in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` — both are used; keep them identical. The old dead copy in `common/TriviaTypes.ts` was removed in ticket 001.
- Client `SERVER_URL` defaults to `ws://localhost:2567` and can be overridden via `VITE_SERVER_URL` (`client/src/App.vue`).
- Game flow: create/`joinById` room `trivia` with `{ playerName }`; first joiner is host; phases progress `Lobby → CashBuilder → Offer → Chase` (repeating per contestant) `→ TeamFinal → ChaserFinal → GameEnd`. Transitions come from the pure state machine `server/src/gameFlow.ts` (a `FlowEvent` + context → `nextPhase` + `FlowEffect[]`), which the room (`server/src/rooms/MyRoom.ts`) applies; timers are server-authoritative via `scheduleTimer` (`server/src/timer.ts`) with durations from `server/src/gameConfig.ts`. Host leaving disconnects the room (`onLeave`, close code 6767).
- PM2 deploy config (`server/ecosystem.config.cjs`) runs `build/index.js`, so `npm run build` is required before deploying. `@colyseus/monitor` is exposed at `/monitor`; the Colyseus playground serves at `/` except in production.
- `client/package.json` has `allowScripts` for `msgpackr-extract`; this can matter if `npm install` fails under restricted script settings.

## Code requirements

Documented standards — there is no formatter or linter; conventions are enforced by review, tests, and the build.

### Formatting & style
- Indent **4 spaces** in both packages; double quotes; semicolons.
- No unused imports; prefer explicit types over `any` (Colyseus message params are the allowed exception).
- Keep files small and focused; prefer pure modules that return data over fat classes.

### UI work & design direction
- Any ticket that touches the UI (new/changed screens, layout, CSS, components, interactions, on-screen copy) must **stop and present the intended direction to the user before implementing**: what screen(s), what the player does on them, the visual approach, and how it plugs into the server flow. Get sign-off, then code.
- Don't assume the "obvious" UI build for a ticket — look & feel is evolving and the user wants to steer it. When a ticket has both UI and non-UI scope, surface the UI part separately.

### CSS & styling
- All styling lives in `client/src/style.css` (imported once in `main.ts`). Components only attach class names — no `<style scoped>`, no inline `style=` unless truly necessary.
- **Human-readable first**: the user edits this file by hand. Reuse existing classes (`lobby`, `lobbyTitle`, `playerName`, `startButton`, `roomCode`, `answerButton`, ...) before adding new ones; name new classes kebab-case with an obvious purpose; group related declarations.
- Formatting: 4-space indent, one declaration per line, trailing semicolons, lowercase hex (`#ffffff`), `transparent` instead of the `#0000` shorthand, sizes as `0` not `0px`. No commented-out dead rules.
- Prefer CSS custom properties in a `:root` block for palette/typography when a color or family repeats — don't copy hex values between rules.
- Respect the existing look (gradient bg, "Luckiest Guy" font, animations in style.css) when adding screens; read `style.css` first, and update it in the same ticket when a screen needs styles.

### No cruft
- Every ticket removes the dead code its work orphans (old phases, schemas, exports, routes) and greps for stale names as part of its acceptance criteria.
- No template leftovers: `my-app` package metadata, unreferenced handlers/routes, legacy enum members/schema classes.

### Architecture invariants (do not break)
- `gameFlow.ts` is **pure**: it takes a `FlowEvent` + context and returns `nextPhase` + `FlowEffect[]`. The room applies effects and runs timers; it never decides transitions itself.
- All tunables live in `server/src/gameConfig.ts` (durations, money, board layout, offer math). No magic numbers in room code.
- Message handlers are **authoritative and role-checked**: only the expected client may trigger an event (e.g. host starts, chaser finishes the final), only in the right phase. Reject + log otherwise.

### Naming
- Rename template artifacts (`MyRoom`, `my-app`, template package metadata) out when touched — descriptive names over template ones.

### Testing
- Every new transition/rule gets a test in `server/test/*.test.ts`. Green gate per ticket: `npm test` (server) and `npm run build` in **both** packages.
- `gameFlow` transitions are unit-tested pure (no room); room integration follows the stub-handler pattern in `roomFlow.test.ts`.

### Type sharing
- `GamePhase` / `PlayerRole` are intentionally duplicated in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts`; edits must land in both and be verified by build/tests — not a manual grep.