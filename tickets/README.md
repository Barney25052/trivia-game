# Tickets

Granular, agent-sized work items. One ticket = one task = one agent session (or one small PR).

## Rules

- **One ticket per agent**: a ticket must fit in a single working session. If it can't, split it.
- **Don't edit tickets you're not working on** (leave a note if you must).
- Each ticket has verifiable **Acceptance criteria** — run the listed commands to prove it's done.
- **Dependencies** order the queue. A ticket whose dependencies are incomplete is not ready to start.
- When you start/finish a ticket, move its row in the status table below.

## Ticket template

```
# ###: Title
## Goal            — what this buys the project (1-2 lines)
## Scope           — files touched, what to do, what NOT to do
## Acceptance      — commands to run + expected result
## Dependencies    — ticket numbers that must be done first
```

## Status

| # | Title | Status |
|---|-------|--------|
| 001 | Remove dead `GamePhase` copy in `common/` | done |
| 002 | Server game-config constants + role enum | done |
| 003 | Cancellable room timer utility | done |
| 004 | Open-ended question bank: seed data | done |
| 005 | Question bank loader + random picker | done |
| 006 | New asymmetric game state schema | done |
| 007 | Pure game-flow state transition function | done |
| 008 | Rewire room to new state, phases, timers | done |
| 009 | Client: new phase screens + flow | done |
| 010 | Client: make SERVER_URL configurable | done |
| 011 | Stale test/loadtest cleanup + green baseline | done |
| 012 | De-template legacy cruft (`MyRoom` → `TriviaRoom`, dead phases/schema) | done |
| 013 | Server: authoritative chaser selection (random + vote) | done |
| 014 | Client: chaser-selection screens (mode pick + votes) | done |
| 015 | Client: show roles + rules to all players | done |
| 016 | Harden player setup (server-side name validation) | done |
| 017 | Fix flaky `roomFlow` end-to-end test (server) | done |
| 018 | TriviaTypes.ts trailing-newline parity (server vs client) | done |
| 019 | Chaser selection: random-mode animation (client) | done |
| 020 | Lobby screen polish — readable names, settings to the side, drop "How to Play" | done |
| 021 | Server: roles-reveal ready gate + cash-builder cooldown | done |
| 022 | Client: roles-reveal ready vote + get-ready countdown (depends 021) | done |
| 023 | Authority + phase guards on offer/chase/final handlers (server) | done |
| 024 | Clamp room-option duration overrides to gameConfig bounds (server) | done |
| 025 | Make "random" the explicit default chaser-selection mode (kills the silent `""`) | done |
| 026 | Drop the synced GamePlayer.sessionId field — use map keys for identity | done |
| 027 | Remove template cruft and dead CSS | done |
| 028 | Clear the chaser-wheel overlay on leave/disconnect | done |
| 029 | Move maxClients into gameConfig; remove raw join-options log | done |
| 030 | Add per-round question event schema + first-class seat/spectator axis | done |
| 031 | Extract TriviaRoom handler dispatch into a handlers module | done |
| 032 | Normalise GamePhase.GameEnd value to camelCase | done |
| 033 | Move chaser wheel overlay into its own screen in the phase flow | done |
| 034 | Rekey players map with seat ID — stop leaking sessionIds to clients (absorbs 026) | done |
| 035 | Shared type definitions for server→client message payloads | done |
| 036 | Chaser character picker during roles-reveal, identity revealed at offer stage | done |
| 037 | Per-player message rate limiting | backlog |
| **Phase 2 — Cash Builder** | | |
| 038 | Answer validation utility for open-ended questions | done |
| 039 | Server: question delivery, answer handler, pot tracking | done |
| 040 | Client: cash builder screen — question display, submission, pot | backlog |
| 041 | Phase 2 integration tests — full cash builder flow | backlog |

Status values: `backlog`, `in-progress`, `done`.

Conventions in play (see `AGENTS.md`): server tests live in `server/test/*.test.ts` (picked up by `npm test`); no lint config — verify with `npm run build` on each package.