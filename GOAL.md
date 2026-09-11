# GOAL.md

Living document for the project's goal and plan. Any agent session should treat this as the source of truth for *what* we're building and *where* we are. Update it as the project evolves.

## Goal

Build an online **asymmetric trivia game** inspired by *The Chase*: one player is the **Chaser**, the rest are **Contestants**. Each contestant builds a cash pot, then races the Chaser on a money board — and the team finishes with a group final round against the clock.

Current tech foundation (to be extended):
- **Server**: Colyseus 0.17 (TypeScript) in `server/` — authoritative state, timers, and scoring.
- **Client**: Vue 3 + Vite + Colyseus SDK in `client/`.
- **Questions**: both open-ended and multiple-choice come from **our own question bank** (no opentdb at runtime — see "Question bank" below).

## Game rules

### Lobby
- One player is chosen as the **Chaser** — options: **random** or **team vote**.
- Everyone else is a **Contestant**.

### Cash builder (per contestant)
- Contestant gets **60 seconds** to answer as many **open-ended** questions as possible (they type answers). Every correct answer adds **$1000** to their pot. Questions keep coming until the clock hits zero — **no penalty for a wrong answer or a pass** (officially "free" — guessing and skipping don't hurt you).

### The offer (per contestant)
- The Chaser offers **high**, **middle** (= what the contestant made in the cash builder), or **lower**.
- **Chaser pot mechanic**: the Chaser has a **pot they may offer from**. It starts at **$50k**, and **+$30k is added after every round**. Any money a player takes home is **removed from the Chaser's pot**. This forces the Chaser to ration offers across all contestants. (High/low are shaped by this, e.g. multiples of the middle — exact multipliers configurable, to decide.)
- The contestant picks which offer to play for.
- **The offer sets how far from home you start** (risk/reward is the whole point): the closer to home you start, the fewer correct answers you need to escape, but the less money you play for. Middle (what you built) starts mid-board, **high** starts closer to the Chaser (further from home — riskier), **low** starts closer to home (safer). A low offer can be **$0** (or even negative on the show) — the Chaser limiting their exposure.

### The board chase (head-to-head)
- Board has **7 spaces** (1–7). Lower offer starts the contestant on **space 4**, middle on **space 5**, high on **space 6**.
- The **Chaser starts off the board at space 8**; first correct answer moves them to **space 7**, then they move **down** the board.
- Contestant **wins by reaching space 0** (off the board). Chaser **catches** the contestant by reaching their space — contestant is **out**.
- Questions are **multiple-choice with 3 options**. No timer until either side answers; then the **other side gets a 5-second window** (lockout countdown) to answer.
- **Both sides can advance on the same question**: if the first answer is correct, the other side may still answer within the 5s window, and a correct answer moves each side one space. (Wrong answers advance nobody — a correct answer must arrive within the window.)
- Surviving the board adds the chosen offer to a **team pot**.

Repeat cash builder + offer + chase for every contestant.

**Play is strictly turn-based, one contestant at a time.** The contestants take turns in a fixed order: only the active contestant plays their cash builder → offer → chase; every other contestant waits (they're spectators at the table — see the social/dead-player features). No two contestants ever play at the same time. The only round where everyone answers at once is the **team final** ("answering as a group" below). The **Chaser** is not idle — they're active in *every* contestant's round (making offers, then answering the chase questions head-to-head) — but contestants never overlap each other.

### Final round (team vs Chaser)
- The **team** gets **2 minutes** of open-ended questions, answering as a group. Every correct answer is **+1**.
- The team starts with **X points, where X = the number of contestants who made it back**.
- **Two parallel question sets**: the team and Chaser answer **different** sets — the team draws one set, the Chaser gets the other (both drawn from the same bank, same difficulty). Neither side sees the other's questions.
- **Eliminated players rejoin for this round**: everyone — including contestants who were caught — answers in the team's group round. X is unchanged and still only counts survivors; eliminated players just add their answers to the 2-minute tally.
- **If no one made it back** (X = 0), the team still plays the Final for a nominal pot — everyone answers, the Chaser is just X ahead where X=0 until the team catches up.
- Then the **Chaser** gets **2 minutes** of open-ended questions:
  - Correct answer → Chaser **+1**.
  - Wrong answer → the team gets a chance to answer; if they're right they **push the Chaser back** one.
- If the Chaser **reaches/passes the team's score** → Chaser wins. If the Chaser **runs out of time first** → the team wins.

### Question bank
- **Open-ended** questions (cash builder + final) come from a **custom free-text question bank** we maintain (a `server/data/questions.json`-style file loaded by the server; server checks typed answers — see the **lenient** policy under Open questions #2, decided).
- **Multiple-choice** (board chase) comes from the **same owned bank** (Phase 4 extends the format to MC: `options[]` + server-held `correctIndex`; show 3 of 4 options). **Use opentdb at runtime for multiple choice only** — decided; a local bank removes an external dependency and keeps the correct index server-only until reveal. The loader sits behind a thin get-questions interface so the source can swap later.
- **Storage**: file-based (JSON) for now. If a DB is ever warranted (large curated set, admin editing, stats), **SQLite** is the planned path — a single file, zero ops, PM2-friendly, and the JSON stays the seed/export format. Not decided, parked with the question-bank-editor stretch goal.

### Compared to the TV show (reference)
This game is adapted from the UK show *The Chase* (ITV), per official documents/discussions:

| Aspect (official show) | Here |
| --- | --- |
| Cash builder: 60s, answer as many as possible, £1,000 per correct; **no penalty for wrong/pass** | Same, typed open-ended, $1000 each, no penalty |
| ~7-step money board; the higher/lower you play for, the closer to / further from the Chaser you start (middle = 5 correct to reach home, high = 6, low = 4) | Board spaces 1–7, escape at 0; low=4, middle=5, high=6 — **identical reach-home counts** |
| Lower offer can be near-$0 (or negative) if the Chaser limits exposure | Same idea (our low can reach $0) |
| Head-to-head: first to answer right forces the other into a **5-second lockout** | Same 5s window |
| Final: survivors (only) answer as a team vs Chaser for an equal share of the prize fund | All players rejoin the group round; X = survivors only; fund split among survivors' team pot |
| Team picks **two categories**, Chaser gets the other | Two parallel open-ended sets from the same bank; team picks, Chaser gets the other — neither sees theirs |

Deliberate differences we keep: the Chaser is a **player** (not a pro/host), so a **Chaser pot** bounds offers; open-ended typed answers (not spoken); eliminated players rejoin the final; MC comes from our own bank (3 options shown).

## Current state

- The room is mid-refactor from a *simpler* trivia game to the asymmetric rules above (tickets 001–025 across Phase 0/1 + follow-up). The foundation and phase wiring are in place; the game is not yet playable end-to-end.
- Working today (server): create/join `trivia` room; first-joiner-is-host; `GameState`/`GamePlayer` schema synced (roles, board, chaser pot, team pot); server game-config constants + `PlayerRole`; cancellable room-clock timers (`src/timer.ts`); open-ended question bank (572 questions) with loader, non-repeating random picker, and a lenient/fuzzy answer checker (`src/questions/answerChecker.ts`); a **pure `gameFlow` state machine** whose `FlowEffect`s the room applies. `npm test` is green (**132** tests).
- The room (tickets 007–008, 013) dispatches real `gameFlow` transitions: `startGame` → authoritative **chaser selection** (random or vote, host-driven) → cash builder → offer → chase, repeating per non-chaser contestant, then team final → chaser final → game end, with server-authoritative timers wired. Client has screens for the new phases (ticket 009) and `SERVER_URL` is configurable via `VITE_SERVER_URL` (ticket 010).
- **Phase 1 (lobby & chaser selection) is done**: authoritative **chaser selection** in **random** and **vote** modes (013) plus the client screens — mode pick + vote buttons (014); role badges, a static rules panel, and a chaser-identity reveal when selection resolves (015); server-side player-name validation on join (016). Tickets 017 (deterministic `roomFlow` e2e) and 018 (TriviaTypes parity) also landed.
- **Phase 1 follow-up (tickets 019–025) is done**: random chaser wheel animation (019), lobby polish with settings rail (020), roles-reveal as a gated phase with ready vote + get-ready cooldown (021 + 022), authority/phase guards on offer/chase/final handlers (023), room-option clamping (024), and explicit random default (025). Reviewed and verified (see `REVIEWERS.md` review). Three follow-up tickets created: 026 (drop the synced `GamePlayer.sessionId` field), 027 (remove template cruft + dead CSS), 028 (clear the chaser-wheel overlay on leave).
- **Phase 2 — Cash Builder is done** (38–41, reviewed): `checkAnswer` + `QuestionManager` per-contestant, non-repeating draws from the bank (572 questions, 286 with `alternatives`); the `startCashBuilder` effect broadcasts the first `"question"` (`{ round, targetSeatId, kind, questionId, prompt, category }` — never the answer), and an authoritative `submitAnswer` handler (phase + role + shape + questionId-guarded) checks answers, adds **$1000** per correct answer to `cashBuilderMoney` (synced), and delivers the next question until the timer expires or the bank is exhausted (`question: null`). The earned pot feeds the offer math (low = half, middle = pot, high = double). The client cash-builder **screen is real**: the active contestant sees the category/prompt, submits typed answers, and watches the pot grow with a flash; spectators see the active player, pot, and timer but never the question (filtered in `App.vue` `currentRoundQuestion`). Server e2e integration tests cover the full round, authority guards, and bank exhaustion. Phase 2 review follow-ups: tickets 042–048 (active-player-leave freeze, `cashBuilderCorrectAnswers` naming, seat-id rekey completion, `onLeave` null-guard, dead CSS, answer-checker spec drift, cash-builder pot not updating visibly) — see `tickets/README.md`.
- **Seat-id identity (034 + 044) is done**: game logic (the players map, `contestantsOrder`, `chaserSeatId`, `activeContestantSeatId`, question targeting, offers, chaser votes) is keyed by a stable room-local **seat id** (`seat-N`), not the connection-scoped sessionId. `GamePlayer.sessionId` is dropped from the schema; clients learn their seat id via a `whoami` → `seatId` handshake. The sessionId survives only as a server-side translation map (`sessionIdToSeatId`, cleaned up on leave) and for per-connection rate limiting/logs.
- NOT done yet (Phase 2+): the MC board-chase isn't implemented (Phase 4 — comes from our own bank, opentdb dropped by decision), and the chase/final screens are placeholders; pot/score fields exist but nothing plays through them yet.
- Ticket 012 (done) removed template/legacy cruft: `MyRoom` → `TriviaRoom`, dropped the dead `Question`/`Answer` game phases and `Question`/`QuestionInstance` schema classes, and renamed the server package to `trivia-server`.

## Plan

Evolve this list as we work. Check items off / reorder as priorities change.

### Phase 0 — Foundation for the new game
Granular agent tasks for this phase live in `tickets/` (001–012, tracked in `tickets/README.md`).
- [x] Rewrite game state schema for asymmetric play (roles, board, Chaser pot, team pot, round state machine)
- [x] Build the free-text open-ended question bank (data + server loader)
- [x] Add server-authoritative timers (cash-builder 60s, final 120s, chase 5s)
- [x] Restructure client screens for the new flow; unify/clean `GamePhase` (012)

### Phase 1 — Lobby & chaser selection
Granular agent tasks live in `tickets/` (013–016, tracked in `tickets/README.md`).
- [x] Player setup (names, room code) — 016 (UI exists; server-side validation)
- [x] Chaser selection with **random** and **vote** options — 013 (server) + 014 (client)
- [x] Show roles to all players — 015 (the static "How to Play" rules panel was removed by product decision in 020; roles reveal stays)

### Phase 1 follow-up — polish & hardening (tickets 019–025)
Found on the first playthrough + security review; tracked as tickets and verified in the end-of-phase review:
- [x] Random chaser mode: cycle through names until the Chaser settles — 019 (client)
- [x] Lobby polish: readable names, settings panel to the side, "How to Play" removed — 020 (client)
- [x] Roles reveal becomes a real phase baked into the flow (`ChaserSelection → RolesReveal → CashBuilder`) with an all-ready vote + "get ready" cooldown — 021 (server) + 022 (client)
- [x] Authority/phase guards on the offer/chase/final handlers — 023 (server)
- [x] Clamp room-option duration overrides to gameConfig bounds — 024 (server)
- [x] Make "random" the explicit default chaser mode (state stores `"random"`, not the silent `""` that broke 019's wheel) — 025 (server + client)

### Phase 2 — Cash builder
- [x] Server-side question delivery + answer checking, $1000 per correct answer (039)
- [x] Earned pot feeds the offer math automatically (startOffer reads `cashBuilderMoney`)
- [x] Client cash-builder screen: question display, answer submission, pot display (040)
- [x] Phase 2 e2e integration tests — full cash builder flow (041)

### Phase 3 — The offer
- [ ] Chaser get to pick the high and low offers based on the medium offer (what the current player earned). Low offer must be lower, high offer must be higher. Low offers can be negative as long as the player pot does not go below $0. The chaser can only offer as much as is in their pot.
- [ ] Chaser pot starts at $50k, **+$30k per round** - randomized per game; offers draw from and payout against it
- [ ] Chaser picks high/middle (= cash-builder total)/lower; contestant chooses
- [ ] High/low multiplier strategy visible to the Chaser (pot remaining)

### Phase 4 — The board chase
- [ ] Extend the question bank to multiple-choice (`options[]` + server-held `correctIndex`, loaded like the open-ended bank) — no opentdb at runtime
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
- [ ] Graceful question-bank failure handling (missing/corrupt data — no runtime external dependency to fail)
- [ ] Deployment: PM2 build + serving client from the server; protect `/monitor` with auth; TLS/wss behind a reverse proxy; cap rooms/connections/message rate (see AGENTS.md "Security")
- [ ] Handler authority + room-option clamping (tickets 023–024), plus abuse caps above

### Stretch goals
- [ ] **Chaser special abilities** (toggle-able in settings): e.g. once-per-round 50/50, others to discuss
- [ ] **Chaser characters**: the Chaser player picks *which Chaser* they want to be from a roster (each with their own name/identity/ability and — like the show — contestants don't see which Chaser they're facing until the reveal, i.e. when they walk out at the offer stage). Different chasers have different abilities.
- [ ] **At-the-table faces (all players)**: a corner panel of the **all** players' faces reacting to the moment — smile when a contestant gets a question right, eeeek/:( when they're about to get caught — a cheer layer for the people actually in the game. Server only broadcasts what happened; faces never affect outcomes.
- [ ] Non choosing players can react to the offer to influence the choosing player with emojis indicating, high, medium and low.
- [ ] **Pickable 2D avatars**: players pick a little 2D "funny guy" character when they join; avatars sit at the table (in the faces panel above), on the dead-player bench, and next to the active player/Chaser. Flat 2D art style — explicitly not 3D — to make the game feel social. Contestants pick their own avatar; distinct from the Chaser-character roster (above) which only the Chaser chooses. (Character art the user must draw is tracked in `HUMAN_TASKS.md`.)
- [ ] **All-player: taunt bar** — eliminated and non-eliminated players blast quick emotes/taunts at the active player or the Chaser ("OOH!", "BOO!", skull, laugh) through the same corner/bench panel. Pure banter, zero game impact.
- [ ] **Dead-player: prediction pool** — eliminated players gamble *candy points* (fun-only currency) on offer picks, escape-vs-caught, and the final winner; the results screen shows a "most candy earned" leaderboard for bragging rights. Effect-free stakes that keep the bench invested in every round.
- [ ] **Dead-player: ghost scoreboard** — eliminated (and waiting) players keep answering live questions anyway; their picks accumulate into a personal ghost score, and a board shows how well you'd have done vs everyone else. Counts for nothing; pure bragging rights. (MC questions → pick an option; open-ended ones → they can type too.)
- [ ] **Question-bank editor**: an admin panel or a small standalone Python program (matches the `api-test.py` precedent at repo root) with an easy interface for adding/editing open-ended *and* multiple-choice questions in `server/data/questions.json` instead of hand-editing the JSON. Useful extras: duplicate-id/empty-field validation, category browsing, and a quick "answer matches?" preview. If storage moves to SQLite later, the JSON stays the seed/export format.
- [ ] **Deferred, officials-tier (revisit when the base game is fun)**: human **judge panel** for lenient open-ended answers (possibly all open-ended rounds) and crowd **boosters/curses**. Both would give eliminated players *real* power; parked on flow/balance grounds for now. (The judge panel also ties into open question #2.)
- [ ] **Host reconnection**: if the host's connection drops mid-game, let them reconnect within a grace window (e.g. Colyseus `allowReconnection` + a "host left, waiting…" state) instead of kicking everyone. Regular player reload = **forfeit seat** (rejoin as spectator / next round) — we deliberately keep identities `sessionId`-ephemeral and add no durable player accounts.

## Open questions

Things we discussed but haven't locked down yet. When you decide, move the answer into the rules above: 
2. ~~Open-ended answer checking: exact-match vs lenient (misspellings, case, "an/a")~~ → **answered (lenient single-edit)**: after normalising (trim, collapse whitespace, lowercase, drop filler words), a typed answer passes if it is **one edit** from the canonical answer (substitution, insertion, deletion or transposition — `"Xars"` → `"Mars"`) **or** within an **edit-distance ratio of 0.3** of the longer answer (forgiving multi-typo sentences, still rejecting clearly different answers like `"Earth"` vs `"Mars"`). Tunables live in `ANSWER_CHECK` in `server/src/gameConfig.ts` and are consumed by `checkAnswer`. Decided with ticket 047.
3. ~~What to give **eliminated contestants** to do during the game~~ → **answered (audience-first)**: taunt bar, prediction pool, ghost scoreboard, and final-round rejoin (see Stretch goals + Final round rules). Still open: how much flavor to layer on each.
4. Chaser abilities list to start with (50/50 confirmed as a candidate; others to discuss).
5. **Chaser characters**: roster size, who the Chaser pick happens (before reveal), and how the reveal ties into the show's drama.