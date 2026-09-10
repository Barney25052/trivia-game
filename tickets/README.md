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
| 011 | Stale test/loadtest cleanup + green baseline | backlog |

Status values: `backlog`, `in-progress`, `done`.

Conventions in play (see `AGENTS.md`): server tests live in `server/test/*.test.ts` (picked up by `npm test`); no lint config — verify with `npm run build` on each package.