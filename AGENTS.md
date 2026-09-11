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
- The open-ended question bank (`server/src/questions/bank.ts`, loaded from `server/data/questions.json`, 572 questions) is loaded on the server, covered by tests, and wired into the cash builder (Phase 2); wiring it into the final phases is Phase 2+. The board chase plans to pull multiple-choice questions from the same owned bank (Phase 4); nothing fetches from opentdb at runtime yet.

## Gotchas

- The template loadtest (`npm run loadtest` in `server/`) joins room `trivia`; the old template test `server/test/MyRoom.test.ts` (which referenced `my_room` and `MyRoomState.mySynchronizedProperty`) was removed in ticket 002 — it was failing and would not compile after `QuizState` was deleted.
- `GamePhase` enum is duplicated in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` — both are used; keep them identical. The old dead copy in `common/TriviaTypes.ts` was removed in ticket 001.
- Client `SERVER_URL` defaults to `ws://localhost:2567` and can be overridden via `VITE_SERVER_URL` (`client/src/App.vue`).
- Game flow: create/`joinById` room `trivia` with `{ playerName }`; first joiner is host; phases progress `Lobby → ChaserSelection → ChaserReveal → RolesReveal → Lineup → CashBuilder → Offer → Chase` (repeating per contestant) `→ TeamFinal → ChaserFinal → GameEnd`. Transitions come from the pure state machine `server/src/gameFlow.ts` (a `FlowEvent` + context → `nextPhase` + `FlowEffect[]`), which the room (`server/src/rooms/TriviaRoom.ts`) applies; timers are server-authoritative via `scheduleTimer` (`server/src/timer.ts`) with durations from `server/src/gameConfig.ts`. Host leaving disconnects the room (`onLeave`, close code 6767).
- PM2 deploy config (`server/ecosystem.config.cjs`) runs `build/index.js`, so `npm run build` is required before deploying. `@colyseus/monitor` is exposed at `/monitor`; the Colyseus playground serves at `/` except in production.
- `client/package.json` has `allowScripts` for `msgpackr-extract`; this can matter if `npm install` fails under restricted script settings.
- **`sessionId` is ephemeral**: a reload/refresh joins a *new* player — reload = forfeit the seat (rejoin as spectator or in the next round). Never build durable-identity assumptions on sessionIds in handlers, scoring, or round order. Reconnection is deferred; the only planned exception is **host-reconnect** via Colyseus `allowReconnection` (stretch goal) — today a host drop disconnects the room (close code 6767).

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

### Art assets & HUMAN_TASKS.md
- When UI work needs an art asset only a human can make (character faces, avatars, icons, chaser art), add a row to `HUMAN_TASKS.md` at the repo root — the **file name** (e.g. `character_face.png`), what it is, where it's used (screen/component), status `todo` — and reference that filename in code/UI as the asset to use.
- The user makes the art, drops it in `client/src/images/`, and crosses the row off (status `done`).
- Treat `HUMAN_TASKS.md` as the source of truth: don't invent asset names or hand-wave placeholders — check the file first, and if the asset you need is already listed as `todo`/`done`, use that filename.

### No cruft
- Every ticket removes the dead code its work orphans (old phases, schemas, exports, routes) and greps for stale names as part of its acceptance criteria.
- No template leftovers: `my-app` package metadata, unreferenced handlers/routes, legacy enum members/schema classes.

### Bug triaging
- A bug that is **within** the current ticket's scope gets fixed there (with a regression test), as usual.
- A bug that is **outside** the current ticket's scope must not be silently fixed or silently ignored: log it to `BUGS.md` at the repo root (sequential `bug-###` id, one-line title, found date + ticket, file/feature, what you saw, expected, repro steps, status `open`), then stay on the ticket.
- A follow-up session converts `open` entries into actionable tickets in `tickets/` and flips the entry to `triaged`, citing the ticket number.

### Architecture invariants (do not break)
- `gameFlow.ts` is **pure**: it takes a `FlowEvent` + context and returns `nextPhase` + `FlowEffect[]`. The room applies effects and runs timers; it never decides transitions itself.
- All tunables live in `server/src/gameConfig.ts` (durations, money, board layout, offer math). No magic numbers in room code.
- Message handlers are **authoritative and role-checked**: only the expected client may trigger an event (e.g. host starts, chaser finishes the final), only in the right phase. Reject + log otherwise.

### Security
- **Server-authoritative by default**: every inbound message/join-option is attacker-controlled input. Beyond role/phase checks, validate shape, types, and bounds (numbers in range, strings non-empty/capped, expected values) and reject + log anything malformed. Never trust client-sent values for scoring, roles, pots, positions, room options, or answer correctness.
- **Clamp room options**: `onCreate`/join options (e.g. `cashBuilderDurationMs`) come from the client — clamp them to `gameConfig` bounds instead of trusting raw values. Short-duration overrides exist for tests; keep them working but bounded.
- **Never broadcast the correct answer before reveal**: the correct MC index and accepted free-text answers must stay server-side until the moment of resolution. Anything put in the synced `GameState` schema goes to **every** client (including the Chaser) — a leak breaks the game, not just the security of it. This extends to opentdb questions in Phase 4.
- **Escape all player-controlled text**: names, answers, messages. Vue interpolates/escapes by default — never render player-controlled content with `v-html`.
- **Abuse caps**: cap active rooms and connections, and rate-limit per-player messages (matters when taunts/emotes/picks land). No unbounded loops, broadcasts, or delayed-timer chains from client input.
- **No secrets or telemetry**: nothing in code, configs, or logs; no analytics/PII. The game stores no personal data — keep it that way.

### Naming
- Rename template artifacts (`MyRoom`, `my-app`, template package metadata) out when touched — descriptive names over template ones.

### Testing
- Every new transition/rule gets a test in `server/test/*.test.ts`. Green gate per ticket: `npm test` (server) and `npm run build` in **both** packages.
- `gameFlow` transitions are unit-tested pure (no room); room integration follows the stub-handler pattern in `roomFlow.test.ts`.

### Type sharing
- `GamePhase` / `PlayerRole` are intentionally duplicated in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts`; edits must land in both and be verified by build/tests — not a manual grep.