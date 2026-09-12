# GOAL.md

Living document for the project's goal and plan. Any agent session should treat this as the source of truth for *what* we're building and *where* we are. Update it as the project evolves.

## Goal

Build an online **asymmetric trivia game** inspired by *The Chase*: one player is the **Chaser**, the rest are **Contestants**. Each contestant builds a cash pot, then races the Chaser on a money board — and the team finishes with a **buzz-in final round** against the clock.

Current tech foundation (to be extended):
- **Server**: Colyseus 0.17 (TypeScript) in `server/` — authoritative state, timers, and scoring.
- **Client**: Vue 3 + Vite + Colyseus SDK in `client/`.
- **Questions**: **open-ended** questions come from **our own question bank**; **multiple-choice** questions come from the **OpenTDB API at runtime** (see "Question bank" below).

## Game rules

### Lobby
- One player is chosen as the **Chaser** — options: **random** or **team vote**.
- Everyone else is a **Contestant**.

### Cash builder (per contestant)
- Contestant gets **60 seconds** to answer as many **open-ended** questions as possible (they type answers). Every correct answer adds **$1000** to their pot. Questions keep coming until the clock hits zero — **no penalty for a wrong answer or a pass** (officially "free" — guessing and skipping don't hurt you).

### The offer (per contestant)
- The Chaser offers **high**, **middle** (= what the contestant made in the cash builder), or **lower**.
- **Chaser pot mechanic**: the Chaser has a **pot they may offer from**. It starts at **$50k**, and **+$30k is added after every round**. Any money a player takes home is **removed from the Chaser's pot**. This forces the Chaser to ration offers across all contestants.
- **Chaser types the amounts (decided, ticket 051)**: no auto-computed multipliers — the Chaser is shown the middle first, types a low offer (revealed), then types a high offer (revealed), then the contestant picks. High must be a **multiple of $1,000** and strictly more than middle; low must be a **multiple of $100** and strictly less than middle. Both are capped by the Chaser's remaining pot. Tunables (`OFFER.lowStep` / `OFFER.highStep`) live in `server/src/gameConfig.ts`.
- **Negative low offers (decided, ticket 051)**: allowed, as long as they don't push the **team pot** below $0 — i.e. `low >= -teamPot` at the moment the offer is set. A low offer can be as low as (negative) the current team pot, or as high as $0.
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

**Play is strictly turn-based, one contestant at a time.** The contestants take turns in a fixed order: only the active contestant plays their cash builder → offer → chase; every other contestant waits (they're spectators at the table — see the social/dead-player features). No two contestants ever play at the same time. The only round where everyone is in the action at once is the **team final** — but even there only *one* contestant answers at a time: **buzz-in** (below). The **Chaser** is not idle — they're active in *every* contestant's round (making offers, then answering the chase questions head-to-head) — but contestants never overlap each other.

### Final round (team vs Chaser)
- The **team** gets **2 minutes** of open-ended questions. **Buzz-in answering**: a question is shown to all non-Chaser players; the first to **buzz in** (an on-screen button, or pressing **space**) wins the right to answer it — and only that contestant can type the answer. A correct answer is **+1** and the next question drops; a wrong answer shows the correct one and moves on (no penalty — the same free-answer policy as the cash builder). If nobody buzzes, the question stays up until a buzz arrives or the clock runs out; the 2-minute timer is the only bound on the round.
- The team starts with **X points, where X = the number of contestants who made it back**.
- **Two parallel question sets**: the team and Chaser answer **different** sets — the team draws one set, the Chaser gets the other (both drawn from the same bank, same difficulty). Neither side sees the other's questions.
- **Eliminated players rejoin for this round**: everyone — including contestants who were caught — can buzz in during the team round. X is unchanged and still only counts survivors; eliminated players just add their buzz-in answers to the 2-minute tally.
- **If no one made it back** (X = 0), the team still plays the Final for a nominal pot — everyone buzzes in, the Chaser is just X ahead where X=0 until the team catches up.
- Then the **Chaser** gets **2 minutes** of open-ended questions — the Chaser answers **directly, with no buzz-in** (the prompt is shown and they just type, like the cash builder):
  - Correct answer → Chaser **+1**.
  - Wrong answer → the team gets a **20-second steal window — no buzz-in**: the missed question opens up to all contestants, anyone can type an answer, and the **first submitted answer is taken, even if it's wrong**. A correct steal **pushes the Chaser back** one; a wrong one — or nobody answering in time — just moves the Chaser on (the visible correct answer is shown, the same free-answer policy as the cash builder).
- If the Chaser **reaches/passes the team's score** → Chaser wins. If the Chaser **runs out of time first** → the team wins.

### Question bank
- **Open-ended** questions (cash builder + final) come from a **custom free-text question bank** we maintain (a `server/data/questions.json`-style file loaded by the server; server checks typed answers — see the **lenient** policy under Open questions #2, decided).
- **Multiple-choice** (board chase) comes from the **OpenTDB API at runtime** — decided. In Phase 4 the board chase drops our bank entirely for MC and draws `type=multiple` questions from OpenTDB instead, showing **3 of 4 options** with the **server holding the correct index until the moment of resolution** (the AGENTS.md "never broadcast the correct answer before reveal" invariant). The fetch sits behind a thin get-questions interface so the source can swap later.
- **Storage**: file-based (JSON) for now — applies to the **open-ended bank only** (MC comes from OpenTDB at runtime and is never stored locally). If a DB is ever warranted (large curated set, admin editing, stats), **SQLite** is the planned path — a single file, zero ops, PM2-friendly, and the JSON stays the seed/export format. Not decided, parked with the question-bank-editor stretch goal.
- **No category support (decided)**: the `category` field the bank JSON still carries is **legacy and unused** — it is ignored by the loader and present nowhere in the code (`BankQuestion` has no `category`; the `"question"` payload has no `category`; the client never renders it). It stays in `server/data/questions.json` for historical reasons only and must not be reintroduced into types, payloads, or UI. Question-bank tooling (e.g. the editor stretch goal) should skip it.

### Compared to the TV show (reference)
This game is adapted from the UK show *The Chase* (ITV), per official documents/discussions:

| Aspect (official show) | Here |
| --- | --- |
| Cash builder: 60s, answer as many as possible, £1,000 per correct; **no penalty for wrong/pass** | Same, typed open-ended, $1000 each, no penalty |
| ~7-step money board; the higher/lower you play for, the closer to / further from the Chaser you start (middle = 5 correct to reach home, high = 6, low = 4) | Board spaces 1–7, escape at 0; low=4, middle=5, high=6 — **identical reach-home counts** |
| Lower offer can be near-$0 (or negative) if the Chaser limits exposure | Same idea (our low can reach $0) |
| Head-to-head: first to answer right forces the other into a **5-second lockout** | Same 5s window |
| Final: survivors (only) answer as a team vs Chaser for an equal share of the prize fund | All players rejoin; X = survivors only; team answers by **buzz-in** (button or space), Chaser types directly with **no buzz**; fund split among survivors' team pot |
| Team picks **two categories**, Chaser gets the other | Two parallel open-ended sets from the same bank; team picks, Chaser gets the other — neither sees theirs |

Deliberate differences we keep: the Chaser is a **player** (not a pro/host), so a **Chaser pot** bounds offers; open-ended typed answers (not spoken) — the team side of the final is **buzz-in** (first to buzz owns the question); eliminated players rejoin the final; MC comes from OpenTDB (3 options shown).

## Current state

- The room is mid-refactor from a *simpler* trivia game to the asymmetric rules above (tickets 001–025 across Phase 0/1 + follow-up). The foundation and phase wiring are in place; the game is not yet playable end-to-end.
- Working today (server): create/join `trivia` room; first-joiner-is-host; `GameState`/`GamePlayer` schema synced (roles, board, chaser pot, team pot); server game-config constants + `PlayerRole`; cancellable room-clock timers (`src/timer.ts`); open-ended question bank (572 questions) with loader, non-repeating random picker, and a lenient/fuzzy answer checker (`src/questions/answerChecker.ts`); a **pure `gameFlow` state machine** whose `FlowEffect`s the room applies. `npm test` is green (**168** tests, verified in the Phase 3 review).
- The room (tickets 007–008, 013) dispatches real `gameFlow` transitions: `startGame` → authoritative **chaser selection** (random or vote, host-driven) → cash builder → offer → chase, repeating per non-chaser contestant, then team final → chaser final → game end, with server-authoritative timers wired. Client has screens for the new phases (ticket 009) and `SERVER_URL` is configurable via `VITE_SERVER_URL` (ticket 010).
- **Phase 1 (lobby & chaser selection) is done**: authoritative **chaser selection** in **random** and **vote** modes (013) plus the client screens — mode pick + vote buttons (014); role badges, a static rules panel, and a chaser-identity reveal when selection resolves (015); server-side player-name validation on join (016). Tickets 017 (deterministic `roomFlow` e2e) and 018 (TriviaTypes parity) also landed.
- **Phase 1 follow-up (tickets 019–025) is done**: random chaser wheel animation (019), lobby polish with settings rail (020), roles-reveal as a gated phase with ready vote + get-ready cooldown (021 + 022), authority/phase guards on offer/chase/final handlers (023), room-option clamping (024), and explicit random default (025). Reviewed and verified (see `REVIEWERS.md` review). Three follow-up tickets created: 026 (drop the synced `GamePlayer.sessionId` field), 027 (remove template cruft + dead CSS), 028 (clear the chaser-wheel overlay on leave).
- **Phase 2 — Cash Builder is done** (38–41, reviewed): `checkAnswer` + `QuestionManager` per-contestant, non-repeating draws from the bank (572 questions, 286 with `alternatives`); the `startCashBuilder` effect broadcasts the first `"question"` (`{ round, targetSeatId, kind, questionId, prompt }` — never the answer), and an authoritative `submitAnswer` handler (phase + role + shape + questionId-guarded) checks answers, adds **$1000** per correct answer to `cashBuilderMoney` (synced), and delivers the next question until the timer expires or the bank is exhausted (`question: null`). The earned pot feeds the offer's middle amount (see Phase 3 for how low/high are now set). The client cash-builder **screen is real**: the active contestant sees the prompt, submits typed answers, and watches the pot grow with a flash; spectators see the active player, pot, and timer but never the question (filtered in `App.vue` `currentRoundQuestion`). Server e2e integration tests cover the full round, authority guards, and bank exhaustion. Phase 2 review follow-ups: tickets 042–048 (active-player-leave freeze, `cashBuilderCorrectAnswers` naming, seat-id rekey completion, `onLeave` null-guard, dead CSS, answer-checker spec drift, cash-builder pot not updating visibly) — see `tickets/README.md`.
- **Seat-id identity (034 + 044) is done**: game logic (the players map, `contestantsOrder`, `chaserSeatId`, `activeContestantSeatId`, question targeting, offers, chaser votes) is keyed by a stable room-local **seat id** (`seat-N`), not the connection-scoped sessionId. `GamePlayer.sessionId` is dropped from the schema; clients learn their seat id via a `whoami` → `seatId` handshake. The sessionId survives only as a server-side translation map (`sessionIdToSeatId`, cleaned up on leave) and for per-connection rate limiting/logs.
- **Lineup interstitial (049) is done**: after the roles-reveal ready gate, the room holds a new `Lineup` phase (`revealAllReady → Lineup → CashBuilder`) that lists the contestants in turn order (1st, 2nd, 3rd…, face placeholders for now) for `LINEUP.durationMs` (~7s, clamped via `lineupDurationMs` room option), then auto-advances to contestant 1's get-ready cooldown + cash builder. `GamePhase.Lineup` added to both `TriviaTypes.ts` copies, with a pure `gameFlow` transition test + a roomFlow hold test.
- **Phase 3 — Chaser pot + offer-setting (050–051, server) is done**: `chaserPot` is a live budget (`CHASER_POT.initial`/`perRound` in `gameConfig.ts`) that grows $30k after every round and is debited by the escape payout, floored at $0 (050). The Offer phase is now a real two-step round (051): `startOffer` broadcasts `"offerStart"` with just the middle amount; the Chaser then calls `setChaserLowOffer` (multiple of $100, < middle, and if negative no more than the current team pot) — broadcasting `"offerLowSet"` — then `setChaserHighOffer` (multiple of $1,000, > middle, ≤ the Chaser's remaining pot), which dispatches the new `chaserOffersSet` gameFlow effect and broadcasts the final `"offer"` with all three tiers. `offerChoice` now rejects until both are set. No more auto-computed low/half-high/double math.
- **Phase 3 — Offer screen client UI (052) and persistent Chaser presence (055–056) are done**, reviewed. Two follow-ups found in review: an **impossible low-offer softlock** when a contestant banks $0 in the cash builder while the team pot is still $0 (ticket 058, blocker — no legal low offer exists under the current validation, confirmed in code); and a new **Chaser character reveal phase** (ticket 059, product ask) between the first cash builder and the first offer, giving the already-picked character (036) its own reveal beat instead of only showing up inline on the Offer screen. Ticket 057 (sync the Offer screen's auto-quips across clients, `bug-007`) remains backlog.
- **Phase 4 — The board chase is done** (063–066 + polish 069–073, reviewed): the OpenTDB runtime MC source (063, `server/src/questions/opentdb.ts` — fetch/validate/HTML-decode a `type=multiple` batch into a server-held `McQuestion` shape behind the get-questions interface, bounded timeout/retry, pooled session-token source); the **authoritative chase engine** (064 — 7-space board, contestant starts 4/5/6 per offer, Chaser starts at 8 off-board then moves down, escape at space 0, catch when the Chaser reaches the contestant's space, 3-option MC questions with the **correct index held server-side** until resolution, 5s lockout once a side answers, **both sides advance on a correct answer**, wager amount synced for display); the **real client chase screen** (065 with 069–071 polish); the lockout pulse + sync (072) and the answer-reveal hold that stops the next question racing the reveal away (073). Phase 4 integration tests are green (066) and the whole suite sits at **211 passing** (verified in the Phase 4 review). Review follow-ups: 074 (chase hang if the MC source fails — bounded retry then resolve as caught), 075 (Chaser disconnect mid-game resolves to GameEnd, `bug-010`), 076 (chase non-participant guard test gap).
- NOT done yet: the **final round (Phase 5, tickets 077–083)**. The `gameFlow` skeleton is wired (`TeamFinal`/`ChaserFinal`/`GameEnd`, `startFinalTeam` sets `teamScore = survivors`, `startFinalChaser`, `endGame` broadcasts) but there is no question delivery, no answer handling, no `chaserScore`, no steal/push-back — and `TeamFinalScreen.vue`/`ChaserFinalScreen.vue`/`ResultsScreen.vue` are placeholders (the results screen reads the never-written `GamePlayer.score`). The 064-era "Chaser Final" placeholder button (`finalChaserScore`, App.vue) is replaced in 079/081.
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
- [x] Chaser pot lifecycle (server): grows $30k/round, debited on escape, floored at $0 (050)
- [x] Chaser types the high and low offers based on the middle (what the current player earned); low < middle < high, both capped by the Chaser's remaining pot; negative low allowed down to -teamPot (server, 051) — see "The offer" rules above
- [x] Client: offer screen for the Chaser to type low/high and the contestant to pick (052)
- [x] Persistent Chaser panel (box, portrait, quip bubble) across Offer/Chase/ChaserFinal (055–056)
- [ ] Fix the impossible low offer when middle is $0 and the team pot is $0 (058, blocker found in Phase 3 review)
- [ ] Chaser character reveal — new phase after the first cash builder, before the first offer (059)
- [x] Sync the Offer screen's auto-quips across clients (057, `bug-007`)
- [ ] High/low multiplier strategy visible to the Chaser (pot remaining)

### Phase 4 — The board chase
Granular agent tasks drafted in the Phase 3 review, tracked in `tickets/README.md` (063–066).
- [x] Multiple-choice questions from the **OpenTDB API at runtime** behind the get-questions interface (063): fetch/validate/HTML-decode `type=multiple` responses into a server-held `McQuestion` shape (`options[]` + `correctIndex`, never sent to clients — the "show 3 of 4" drop remains 064's job), with bounded timeout/retry and a pooled session-token source so the free API is hit once per batch, not per question.
- [x] 7-space board; contestant starts 4/5/6 per offer; Chaser starts at 8 (off board, first correct → 7) (064)
- [x] 3-option MC questions; 5-second timer once one side answers (064)
- [x] **Both sides may advance on a correct answer** in the same question (064)
- [x] Catch = Chaser reaches contestant's space (out); escape = space 0 (offer → team pot) (064)
- [x] Real client chase screen replacing the current placeholder (065)
- [x] Phase 4 integration tests (066)
- [x] Phase 4 polish verified in review: board current-space highlighting (069), side-by-side answer buttons (070), prompt font (071), synced lockout pulse (072), answer-reveal hold so the reveal actually renders (073)
- [ ] Chase must not hang when the MC source fails or returns nothing — bounded retry, then resolve as caught (074)

### Phase 5 — Final round
Granular agent tasks drafted in the Phase 4 review, tracked in `tickets/README.md` (077–083).
- [ ] Server: per-side final-round question delivery — team and Chaser streams from the same bank, non-repeating, never broadcast to the wrong side, answers never on the wire (077)
- [ ] Team: 2-min open-ended **buzz-in** round starting at X (survivors count); first to buzz owns the question, a correct answer bumps `teamScore + 1` (078)
- [ ] Chaser: 2-min round — Chaser answers **directly, no buzz**; correct answers chase the target; a wrong answer opens a **20s team steal — first submitted answer wins (no buzz), correct steals push the Chaser back** (079) — win/lose resolution on reach ("reaches/passes") vs timeout
- [ ] Client: real Team Final screen — buzz button + space, buzzer types the answer (080, UI sign-off); Chaser Final screen — Chaser types with no buzz, plus steal prompts (081, UI sign-off)
- [ ] Phase 5 integration tests (082)
- [ ] Game-end results from real scores; drop the dead `GamePlayer.score` (083, UI sign-off)

### Phase 6 — Hardening & config
- [ ] Configurable values (durations, money, offer multipliers), SERVER_URL not hardcoded
- [ ] Fix/remove stale tests; real server tests for the state machine
- [ ] Graceful question-source failure handling: missing/corrupt local bank data (as today), plus bounded OpenTDB fetch behavior (timeout/retry/fallback) so the chase can't hard-fail on a network blip
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
- [ ] **Question-bank editor**: an admin panel or a small standalone Python program (matches the `api-test.py` precedent at repo root) with an easy interface for adding/editing **open-ended** questions in `server/data/questions.json` instead of hand-editing the JSON. No MC editor — multiple-choice comes from OpenTDB, not our bank. Useful extras: duplicate-id/empty-field validation and a quick "answer matches?" preview. If storage moves to SQLite later, the JSON stays the seed/export format.
- [ ] **Deferred, officials-tier (revisit when the base game is fun)**: human **judge panel** for lenient open-ended answers (possibly all open-ended rounds) and crowd **boosters/curses**. Both would give eliminated players *real* power; parked on flow/balance grounds for now. (The judge panel also ties into open question #2.)
- [ ] **Host reconnection**: if the host's connection drops mid-game, let them reconnect within a grace window (e.g. Colyseus `allowReconnection` + a "host left, waiting…" state) instead of kicking everyone. Regular player reload = **forfeit seat** (rejoin as spectator / next round) — we deliberately keep identities `sessionId`-ephemeral and add no durable player accounts.

## Open questions

Things we discussed but haven't locked down yet. When you decide, move the answer into the rules above: 
2. ~~Open-ended answer checking: exact-match vs lenient (misspellings, case, "an/a")~~ → **answered (lenient single-edit)**: after normalising (trim, collapse whitespace, lowercase, drop filler words), a typed answer passes if it is **one edit** from the canonical answer (substitution, insertion, deletion or transposition — `"Xars"` → `"Mars"`) **or** within an **edit-distance ratio of 0.3** of the longer answer (forgiving multi-typo sentences, still rejecting clearly different answers like `"Earth"` vs `"Mars"`). Tunables live in `ANSWER_CHECK` in `server/src/gameConfig.ts` and are consumed by `checkAnswer`. Decided with ticket 047.
3. ~~What to give **eliminated contestants** to do during the game~~ → **answered (audience-first)**: taunt bar, prediction pool, ghost scoreboard, and final-round rejoin (see Stretch goals + Final round rules). Still open: how much flavor to layer on each.
4. Chaser abilities list to start with (50/50 confirmed as a candidate; others to discuss).
5. **Chaser characters**: roster size, who the Chaser pick happens (before reveal), and how the reveal ties into the show's drama.