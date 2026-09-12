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
| 037 | Per-player message rate limiting | done |
| **Phase 2 — Cash Builder** | | |
| 038 | Answer validation utility for open-ended questions | done |
| 039 | Server: question delivery, answer handler, pot tracking | done |
| 040 | Client: cash builder screen — question display, submission, pot | done |
| 041 | Phase 2 integration tests — full cash builder flow | done |
| 042 | Recover the game flow when the active player leaves mid-round | done |
| 043 | Rename `cashBuilderQuestionsAsked` → `cashBuilderCorrectAnswers` (truthful correct count) | done |
| 044 | Finish the seat-id rekey — players map keyed by `GamePlayer.seatId`, not `sessionId` | done |
| 045 | Null-guard `onLeave` before dereferencing `player.seatId` | done (covered by 042) |
| 046 | Remove dead CSS — `.rotate` rule and `pan-bg` keyframe | done |
| 047 | Reconcile the answer checker with ticket 038's spec — then wire `ANSWER_CHECK` | done |
| 048 | Cash builder — pot/score doesn't visibly increase during the round | done* |
| 049 | Contestant lineup intro screen before the first cash builder | done |

\* 048 closed after only proving the server patch path — the on-screen render fix never landed; see ticket 053 (reopened by user report, `bug-005`).

### Phase 3 — The Offer
| 050 | Chaser pot — lifecycle, payouts, and cap (server) | done |
| 051 | Chaser sets the high & low offers; contestant picks (server) | done |
| 052 | Offer screen — Chaser sets high/low with pot visibility; contestant picks; spectators wait | done |
| 055 | Persistent Chaser quip channel (server) | done |
| 056 | Persistent Chaser panel — box, portrait, and quip bubble across every phase (client) | done\*\*\* |
| 057 | Sync the Offer screen's auto-generated quips across clients (`bug-007`) | done |

### Follow-up bug fixes
| 053 | Cash builder — on-screen pot/count still don't increase (`bug-005`) | done\*\* |
| 054 | Random chaser — skip the ChaserSelection player-list hold, go straight to the wheel (`bug-006`) | done |
| 058 | Fix the impossible low offer when a contestant banks $0 and the team pot is $0 | backlog |
| 060 | Fix `roomFlow` test race — `phases` array misses `RolesReveal` broadcast (`bug-003`) | done |
| 061 | Recover the game when the last contestant leaves during the `Lineup` hold (`bug-004`) | done |
| 062 | Fix cash-builder answer input silently swallowing submissions (`bug-008`) | done |
| 068 | Fix `offerQuips` test flake — `waitForMessage("offerStart")` registered after the broadcast (`bug-009`) | done |

### Phase 3 follow-up — new feature
| 059 | Chaser character reveal — new phase after the first cash builder, before the first offer | done |

### Phase 4 — The board chase
| 063 | OpenTDB multiple-choice source behind the get-questions interface | done |
| 064 | Server — authoritative board-chase engine | done |
| 065 | Client — real board-chase screen (replaces the placeholder) | done |
| 066 | Phase 4 integration tests — full board-chase flow | done |
| 069 | Highlight the contestant's and Chaser's *current* board space | done |
| 070 | Lay out chase answer buttons side-by-side instead of stacked | done |
| 071 | Chase question prompt is using the wrong font | done |
| 072 | Chase lockout — strong, shared pulsing cue (background + buttons) synced from a `chaseLockoutStarted` broadcast | done |
| 073 | Chase correct/wrong answer reveal never renders (raced out by the next question) | done |

### Phase 4 review follow-ups (verified in the Phase 4 review — 211 tests green, both builds green)
| 074 | Chase stalls permanently when the MC question source fails or returns nothing (bounded retry → resolve as caught) | backlog |
| 075 | Chaser disconnect mid-game resolves the room to GameEnd, team wins (`bug-010`) | backlog |
| 076 | Chase authority-guard test gap — non-participant cannot answer; active-contestant leave mid-Chase | backlog |

### Phase 5 — The final round
| 077 | Server — final-round question delivery for the team and Chaser streams (per-side, non-repeating) | backlog |
| 078 | Server — team answers (`submitFinalAnswer`, group model, `teamScore + 1`) | backlog |
| 079 | Server — Chaser answer engine: `chaserScore`, win on reach, steal/push-back (floor 0), remove placeholder `finalChaserScore` | backlog |
| 080 | Client — real Team Final screen (UI sign-off required) | backlog |
| 081 | Client — real Chaser Final screen incl. steal prompt (UI sign-off required) | backlog |
| 082 | Phase 5 integration tests — full final round e2e on the server | backlog |
| 083 | Game-end results screen from real scores + drop dead `GamePlayer.score` (UI sign-off required) | backlog |

### Whole-app polish
| 067 | Full layout/design pass across all screens once every phase is implemented (discussion, not a solo build) | backlog |

\*\*\* 056: scope was narrowed with the user before implementation (per AGENTS.md's UI sign-off rule) from "always there, every phase" to **only the phases where the Chaser and a contestant are face-to-face**: Offer, Chase, and the Chaser Final — not Lobby, Chaser Selection/Reveal, Roles Reveal, Lineup, Cash Builder, or Team Final. Placement is inline on the left side of each of those three screens (matching where the box already sat in Offer, per ticket 052) rather than a global fixed-position overlay, so `ChaserPanel.vue` is instantiated once per "table" screen instead of a single App-level mount; quip display state (`chaserQuipText`/`chaserQuipKey`) is still centralized in `App.vue` and passed down, with each screen able to feed it local auto-quips (`@auto-quip`) alongside the real `chaserQuip` broadcast from ticket 055. `OfferScreen.vue`'s inline chaser box/portrait/bubble markup was extracted into the shared component as scoped. Verified manually with two browser clients through a full round (Lobby → chaser pick → Offer, incl. a live Chaser-typed quip arriving on the other client → Chase → Team Final (panel correctly absent) → Chaser Final); found and logged an unrelated pre-existing bug in the process (`bug-008`, `CashBuilderScreen.vue` answer input).

\*\* 053: root cause was in `client/src/App.vue` — `activeContestantMoney`/`activeContestantCorrectAnswers` were computed from `activeContestant.value` (itself a computed). The active contestant's Colyseus schema instance keeps the same object identity across state patches (only its properties mutate), so Vue's computed never saw the *reference* change and never re-fired the downstream computeds, even though `players.value` (a plain ref, reassigned to a fresh array on every patch) was updating correctly. Fixed by having each derived computed read `players.value.find(...)` directly instead of chaining through `activeContestant`. Also added the wrong-answer flash/reveal from the ticket's scope: server now sends a per-client `answerResult` message (`correct`, `correctAnswer`) on every `submitAnswer`, and holds the next question for `wrongAnswerRevealMs` (2.5s default, room-configurable, see `CASH_BUILDER.wrongAnswerRevealMs` in `gameConfig.ts`) on a wrong answer so the contestant can read the correct answer while the screen flashes red; a correct answer flashes green immediately. No Vue test harness exists, so this was verified manually via two browser SDK clients (see `server/test/cashBuilderFlow.test.ts` for the automated server-side coverage of `answerResult` and the reveal delay) — to re-verify by hand: start `server` + `client` dev, join two browsers, answer correctly (pot/count should update on both the active player's and the spectator's screen instantly) and answer wrong (screen should flash red and show "Correct answer: …" for ~2.5s before the next question, with input disabled during that window).

Status values: `backlog`, `in-progress`, `done`.

Conventions in play (see `AGENTS.md`): server tests live in `server/test/*.test.ts` (picked up by `npm test`); no lint config — verify with `npm run build` on each package.