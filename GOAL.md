# GOAL.md

Living document for the project's goal and plan. Any agent session should treat this as the source of truth for *what* we're building and *where* we are. Update it as the project evolves.

## Goal

Build an online **asymmetric trivia game** inspired by *The Chase*: one player is the **Chaser**, the rest are **Contestants**. Each contestant builds a cash pot, then races the Chaser on a money board — and the team finishes with a group final round against the clock.

Current tech foundation (to be extended):
- **Server**: Colyseus 0.17 (TypeScript) in `server/` — authoritative state, timers, and scoring.
- **Client**: Vue 3 + Vite + Colyseus SDK in `client/`.
- **Questions**: multiple-choice from opentdb.com; **open-ended from a custom free-text question bank** we own (see "Question bank" below).

## Game rules

### Lobby
- One player is chosen as the **Chaser** — options: **random** or **team vote**.
- Everyone else is a **Contestant**.

### Cash builder (per contestant)
- Contestant gets **60 seconds** to answer as many **open-ended** questions as possible (they type answers). Every correct answer adds **$1000** to their pot.

### The offer (per contestant)
- The Chaser offers **high**, **middle** (= what the contestant made in the cash builder), or **lower**.
- **Chaser pot mechanic**: the Chaser has a **pot they may offer from**. It starts at **$50k**, and **+$30k is added after every round**. Any money a player takes home is **removed from the Chaser's pot**. This forces the Chaser to ration offers across all contestants. (High/low are shaped by this, e.g. multiples of the middle — exact multipliers configurable, to decide.)
- The contestant picks which offer to play for.

### The board chase (head-to-head)
- Board has **7 spaces** (1–7). Lower offer starts the contestant on **space 4**, middle on **space 5**, high on **space 6**.
- The **Chaser starts off the board at space 8**; first correct answer moves them to **space 7**, then they move **down** the board.
- Contestant **wins by reaching space 0** (off the board). Chaser **catches** the contestant by reaching their space — contestant is **out**.
- Questions are **multiple-choice with 3 options**. No timer until either side answers; then the **other side gets a 5-second timer** to answer.
- **Both sides can advance on the same question**: if the first answer is correct, the other side may still answer within 5s, and a correct answer moves each side one space. (Wrong answers advance nobody.)
- Surviving the board adds the chosen offer to a **team pot**.

Repeat cash builder + offer + chase for every contestant.

### Final round (team vs Chaser)
- The **team** gets **2 minutes** of open-ended questions, answering as a group. Every correct answer is **+1**.
- The team starts with **X points, where X = the number of contestants who made it back**.
- Then the **Chaser** gets **2 minutes** of open-ended questions:
  - Correct answer → Chaser **+1**.
  - Wrong answer → the team gets a chance to answer; if they're right they **push the Chaser back** one.
- If the Chaser **reaches/passes the team's score** → Chaser wins. If the Chaser **runs out of time first** → the team wins.

### Question bank
- **Open-ended** questions (cash builder + final) come from a **custom free-text question bank** we maintain (e.g. a JSON file loaded by the server; server checks typed answers — decide whether answers are exact-match or lenient later).
- **Multiple-choice** (board chase) comes from opentdb (`type=multiple` gives 4 options — we'll show 3 of them; server picks the correct-index).

## Current state

- The repo is mid-refactor from a *simpler* trivia game to the asymmetric rules above (tickets 001–011 in Phase 0). The foundation is in place; the game flow is not yet rebuilt.
- Working today (server): create/join `trivia` room by name or code; first-joiner-is-host; `GameState`/`GamePlayer` schema synced (roles, board, chaser pot, team pot); server game-config constants + `PlayerRole`; cancellable room-clock timers; open-ended question bank (45 free-text questions) with loader + non-repeating random picker. `npm test` is green (20 tests).
- NOT done yet: the room still runs a thin legacy 5-question flow adapted onto `GameState` (opentdb multiple-choice, Lobby → Question → Answer → GameEnd). It must be replaced by the `gameFlow` state machine + timers (tickets 007–008) and the client screens rebuilt (ticket 009).
- Client hardcodes `ws://localhost:2567` (ticket 010); template leftovers remain in `npm run loadtest` (`my_room`, ticket 011).

## Plan

Evolve this list as we work. Check items off / reorder as priorities change.

### Phase 0 — Foundation for the new game
Granular agent tasks for this phase live in `tickets/` (001–011, tracked in `tickets/README.md`).
- [ ] Rewrite game state schema for asymmetric play (roles, board, Chaser pot, team pot, round state machine)
- [ ] Build the free-text open-ended question bank (data + server loader)
- [ ] Add server-authoritative timers (cash-builder 60s, final 120s, chase 5s)
- [ ] Restructure client screens for the new flow; unify/clean `GamePhase`

### Phase 1 — Lobby & chaser selection
- [ ] Player setup (names, room code)
- [ ] Chaser selection with **random** and **vote** options
- [ ] Show roles + rules to all players

### Phase 2 — Cash builder
- [ ] 60-second open-ended question round (typed answers from the question bank)
- [ ] Server-side answer checking, $1000 per correct answer
- [ ] Pot display + transition to offer

### Phase 3 — The offer
- [ ] Chaser pot starts at $50k, **+$30k per round**; offers draw from and payout against it
- [ ] Chaser picks high/middle (= cash-builder total)/lower; contestant chooses
- [ ] High/low multiplier strategy visible to the Chaser (pot remaining)

### Phase 4 — The board chase
- [ ] 7-space board; contestant starts 4/5/6 per offer; Chaser starts at 8 (off board, first correct → 7)
- [ ] 3-option MC questions; 5-second timer once one side answers
- [ ] **Both sides may advance on a correct answer** in the same question
- [ ] Catch = Chaser reaches contestant's space (out); escape = space 0 (offer → team pot)

### Phase 5 — Final round
- [ ] Team: 2-min open-ended group round starting at X (survivors count)
- [ ] Chaser: 2-min round with push-back on wrong answers
- [ ] Win/lose resolution (chaser catch-up vs timeout)

### Phase 6 — Hardening & config
- [ ] Configurable values (durations, money, offer multipliers), SERVER_URL not hardcoded
- [ ] Fix/remove stale tests; real server tests for the state machine
- [ ] Graceful opentdb/question-bank failure handling
- [ ] Deployment: PM2 build + serving client from the server

### Stretch goals
- [ ] **Chaser special abilities** (toggle-able in settings): e.g. once-per-round 50/50, others to discuss
- [ ] **Chaser characters**: the Chaser player picks *which Chaser* they want to be from a roster (each with their own name/identity/ability and — like the show — contestants don't see which Chaser they're facing until the reveal, i.e. when they walk out at the offer stage). Not concrete yet; idea only.
- [ ] **Something to do for eliminated contestants** during the game (idea TBD — see Open questions)

## Open questions

Things we discussed but haven't locked down yet. When you decide, move the answer into the rules above:
1. High/lower offer **multipliers** relative to the middle (and how strictly they're constrained by the Chaser's pot).
2. Open-ended answer checking: exact-match vs lenient (misspellings, case, "an/a").
3. What to give **eliminated contestants** to do during the game.
4. Chaser abilities list to start with (50/50 confirmed as a candidate; others to discuss).
5. **Chaser characters**: roster size, who the Chaser pick happens (before reveal), and how the reveal ties into the show's drama.