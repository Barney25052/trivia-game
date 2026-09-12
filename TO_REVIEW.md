# TO_REVIEW.md

Judgment calls a human should look over. End-of-phase reviewers append architecture directions, design smells, and "this looks a little weird" items here that they don't want to silently carry forward. Clear bugs and broken invariants go to **tickets**, not here.

- **Where**: repo-relative path + `file:line` (or a short string to grep).
- **What**: one-line description.
- **Why it matters**: the lasting impact or direction to watch.
- **Status**: `open` (reviewer-added, awaiting you) or `decided` (you've read it — add a note: GOAL update, ticket number, or parked).

Append, don't rewrite. Keep entries short, specific, and high-signal — a long dump is noise. Human readable!!!

Add entries like so:

1.  WHAT:
    WHERE: 
    WHY:
    STATUS: 
    DECISION: For human to fill out

----------- DECIDED -------------------

All items reviewed. Closed items (#3, #4) deleted; open items converted to tickets.

1.  WHAT: TriviaRoom.ts is 477 lines and growing — handler dispatch, effect application, chaser-selection helpers, reveal-ready logic, and message handlers all in one file.
    WHERE: server/src/rooms/TriviaRoom.ts:1-477
    WHY: Passing the ~150–200 line comfort zone. As Phase 2–5 add real question handling, chase logic, and final-round scoring, this file will balloon further. Worth deciding now whether to extract helpers (e.g. a `handlers/` module or an effect-applicator) before the next phase makes it harder to split.
    STATUS: decided
    DECISION: Create a handlers module and pull some functionality into that. → Ticket 031.

2.  WHAT: GamePhase.GameEnd has value `"gameend"` while all other enum values use camelCase (`"finalTeam"`, `"finalChaser"`, `"chaserSelection"`, etc.).
    WHERE: server/src/TriviaTypes.ts:10, client/src/TriviaTypes.ts:10
    WHY: Works today because App.vue maps via the enum, but any string comparison with `"gameEnd"` (camelCase) would silently fail. Minor now, but the inconsistency could bite when Phase 2+ adds more string-based routing or logging. Worth a quick normalise while the enum is small.
    STATUS: decided
    DECISION: Change to gameEnd. → Ticket 032.

5.  WHAT: The chaser wheel is a full-screen fixed overlay (`wheelOverlay`, z-index 10) that can sit on top of the RolesReveal phase screen during its ~5s landing animation.
    WHERE: client/src/App.vue:59-66,200-205,258-263, client/src/screens/ChaserWheelScreen.vue:120-133, client/src/style.css (`.wheelOverlay`, `.wheelViewport`)
    WHY: Ticket 022's acceptance required "nothing in the app is ever drawn on top of the active phase screen" (all-overlay removal), yet 019 re-introduced an overlay — deliberately, as the wheel IS the reveal moment. The wheel covering RolesReveal for ~5s after the chaser resolves is likely fine as a product choice, but it quietly reverses 022's blanket rule. Decide whether "overlay only ever over ChaserSelection, always cleared the moment landing completes" is the standing rule, and document it so future phases don't re-add overlays again. Also feeds ticket 028 (wheel not cleared on leave).
    STATUS: decided
    DECISION: Move wheelOverlay to its own screen in the flow. → Ticket 033.

6.  WHAT: Whether players' sessionIds should be hidden from other clients at all — the `players` MapSchema keys ARE the Colyseus sessionIds, so they're broadcast to every client regardless of the `GamePlayer.sessionId` field ticket 026 drops.
    WHERE: server/src/rooms/schema/GameState.ts:20, server/src/rooms/TriviaRoom.ts:454 (map keyed by client.sessionId)
    WHY: Full hiding would require rekeying the players map with a non-session per-player id (a "seat id") and translating every handler lookup — a cross-cutting change before any of it is a real risk (sessionIds are opaque tokens, no reconnection exists yet). Ticket 026 de-dups the field but not the map keys. Decide now whether hiding matters at all, so it's either done deliberately or dropped deliberately rather than half-done.
    STATUS: decided
    DECISION: Rekey the map with seatId, hide sessionIds from clients. → Combined into Ticket 034 (absorbs ticket 026).

7.  WHAT: A "seat id" distinct from Colyseus sessionId — needed for host-reconnect, spectator-rejoin, avatars, predictions/taunts, chaser-character reveal. Today sessionId IS the map key and every handler/flow identifier.
    WHERE: server/src/rooms/TriviaRoom.ts:454 (map key), gameFlow.ts (all events carry sessionId), GameState.ts:26 (`activeContestantSessionId`), server/src/rooms/schema/GameState.ts:13 (`chaserVote` stores a sessionId)
    WHY: The host-reconnect stretch explicitly says "we deliberately keep identities sessionId-ephemeral" — but the *spectator-rejoin* stretch ("rejoin as spectator / next round") needs a stable seat keyed player-to-round. Every social stretch (taunt targeting, vote targeting, prediction attribution) references players by sessionId today. If we never want durable identity, no change needed. But the moment a player reloads and rejoins mid-room, the price of retrofitting a stable seat id goes up the more handlers were written against sessionId. Decide the identity model before Phase 2 wires `cashBuilderMoney`/scoring, which will hard-reference it.
    STATUS: decided
    DECISION: Introduce seatId, combined with #6 into Ticket 034.

8.  WHAT: The game model assumes "one contestant plays the turn; everyone else waits" — but the dead-player stretches (ghost scoreboard/answers, prediction pool, taunt bar) need every non-active player answering/predicting/reacting inside each round.
    WHERE: server/src/gameFlow.ts:161-163 (round advance only considers the active contestant), TriviaRoom.ts:221-231 (only the active player's cash builder gets a timer/question channel), GameState.ts (no per-player per-round answer/ghost storage)
    WHY: This is the single biggest fork the stretches introduce. Today the room sends one question at a time to one player; the ghost scoreboard wants "the same question fan(s) out to everyone, answers stored per player but counted for nobody." That's a different message/broadcast shape (`question` channel with a target vs an everyone channel), a different schema (per-player ghost picks), and different gameFlow effects. Cheap now (before Phase 2 defines the "this player is answering X" message) to decide whether the per-question broadcast always carries a `targetSessionId` that the client remarks on ("only the active contestant's answer counts") or whether we build a separate ghost channel up front. Do NOT let Phase 2 bake in a "single recipient question message" without a decision here.
    STATUS: decided
    DECISION: Architecture changes done via Ticket 030 (per-round question event + seat axis).

9.  WHAT: Type sharing between server and client is currently only two duplicated enums (TriviaTypes.ts). The `question`/`offer`/`getReady` broadcast payloads are inferred (the client `onMessage` handlers take `any`).
    WHERE: client/src/App.vue:100-130 (onMessage("offer"/"getReady"/"phase") with untyped payloads), server/src/rooms/TriviaRoom.ts:204-250 (broadcast payload shapes)
    WHY: TriviaTypes is duplicated by design and kept in parity by tests, but the *message payloads* are the highest-drift surface (a renamed field in a server broadcast silently breaks the client). As payload shapes multiply (question, offer, getReady, endGame, plus future social channels), the hand-maintained-duplication approach doesn't scale. Options: a committed shared JSON-schema / .d.ts, an `@colyseus/command`-style contract, or a lightweight hand-shared types module imported by both (with a parity test like the enum). Decide the policy before Phase 2 defines the question payload — it's the cheapest point to commit.
    STATUS: decided
    DECISION: Create a shared `common/MessageTypes.ts` imported by both server and client. → Ticket 035.

10. WHAT: `GamePlayer` carries overlapping/partially-dead seat state — `isEliminated`, `madeItBack`, `boardPos`, `score`, `cashBuilderMoney` — with no single "what is this seat right now" primitive. The dead-player + spectator stretches want one axis (`active | waiting | eliminated | spectator`) plus per-seat earnings.
    WHERE: server/src/rooms/schema/GameState.ts:9-16
    WHY: `isEliminated` (caught) and `madeItBack` (survived) are the only writers today; `boardPos`/`score` are dead. The final-round rules (eliminated players rejoin) already blur these. Replacing the booleans with a single `seatState` string now is cheap; retrofitting once scores/boards/prediction-currency land on top is a migration. Ticket 030 proposes the seam but explicitly does NOT migrate the booleans without sign-off — that's your call, and the earlier you decide, the cheaper it is.
    STATUS: decided
    DECISION: Combine into Ticket 030 (seat axis). Do the migration now while the schema is cheap to change.

11. WHAT: Chaser-character reveal is currently positioned at `ChaserSelection → RolesReveal` (who the *player* Chaser is), but the stretch goal says the character identity is revealed later, at the offer stage, and is chosen before reveal.
    WHERE: server/src/gameFlow.ts:92-107 (chaserSelectionComplete → RolesReveal), client/src/screens/ChaserSelectionScreen.vue / ChaserWheelScreen.vue
    WHY: If the "Chaser roster" lands, there's a second identity (character) that is deliberately hidden until the offer. That means schema (`chaserCharacterId` on the chaser player or the state), a message flow (chaser picks character before reveal, broadcast only later), and a reveal moment that is NOT the current roles-reveal. Decide now whether roles-reveal stays "you are the Chaser" (a person) or becomes "and here's your character" picker, so Phase 1's reveal wiring isn't reworked. If the roster is a far-off stretch, at least note it so nobody assumes RolesReveal is final.
    STATUS: decided
    DECISION: In roles-reveal, the Chaser picks their character (this is their ready button). Character identity is NOT revealed to contestants until the first offer round. → Ticket 036.

12. WHAT: No per-player message rate limiting / abuse caps, and the room's message handlers are all fire-and-forget — fine today, but the taunt/emote stretches send lots of small messages per player per round.
    WHERE: server/src/rooms/TriviaRoom.ts:309-435 (messages map, no throttling)
    WHY: AGENTS.md Security says "cap active rooms and connections, and rate-limit per-player messages (matters when taunts/emotes/picks land)." The social stretches are exactly that "when". Cheapest now is to add a thin per-client `scheduleTimer`-backed or timestamp-based throttle at the messages layer (or just document the plan). Without it, the taunt/emote feature is an invitation to be spammed (and to spam other players' render loops). Decide the throttle shape before the social channel lands.
    STATUS: decided
    DECISION: Low priority — game is for friends, not large-scale. Add a thin per-client timestamp throttle before social channels land. → Ticket 037.

13. WHAT: The Phase 2 question broadcast is sent to ALL clients with a `targetSessionId`, and the client filters it out for non-targets (`client/src/App.vue` `currentRoundQuestion`).
    WHERE: server/src/rooms/TriviaRoom.ts:95-106 (`broadcastQuestion`), server/src/rooms/handlers/effects.ts:80-90, client/src/App.vue:64-68
    WHY: This is the ticket-030 "ghost scoreboard" seam (the board chase's MC `correctIndex` and the final's answers must NEVER reach the Chaser). Today a client renders the prompt only for the matching target, so it works — but the sensitivity live in the *client's* filter. A future UI regression (forgetting the `currentRoundQuestion` filter, rendering a shared ref) would leak the active contestant's question to the Chaser. The final-round answers that both sides must not see each other's are server-gated by NOT broadcasting at all — worth deciding whether the cash-builder question should be server-targeted too (`targetSeatId` channel) to keep one consistent rule.
    STATUS: open

14. WHAT: Answer-checker leniency is a product decision hiding in code: `checkAnswer("Tihs is a porly writen snetnece", "this is a poorly written sentence") === true`, and any pair within a 0.3 edit-distance ratio passes as long as it is not a single-position edit.
    WHERE: server/src/questions/answerChecker.ts:1-86 (FILLER_WORDS + MAX_DISTANCE_RATIO + matchesSingle), server/src/gameConfig.ts:89-92 (`ANSWER_CHECK`, currently unused)
    WHY: This is GOAL.md open question #2 ("exact-match vs lenient") answered implicitly by the implementer: filler words are stripped, transpositions pass, single substitutions fail, multi-edit smudges pass. It directly shapes the cash-builder difficulty and how wrong a "right" can be. Since Phase 4 (final rounds + MC) reuses the same checker, flip this into an explicit decision (ticket 047 tracks the reconciliation); the artifacts go in `ANSWER_CHECK` or the docstring, not in the code's assumptions.
    STATUS: decided
    DECISION: Lenient single-edit policy chosen — `checkAnswer` now consumes `ANSWER_CHECK` (normaliseWhitespace, caseInsensitive, allowSingleEdit, editDistanceRatio); GOAL.md open question #2 answered. → Ticket 047.

15. WHAT: `server/src/rooms/handlers/messageHandlers.ts` is 306 lines and mixes every phase's message handlers in one file (lobby/vote, roles-reveal ready, offer low/high, chase result, final score, chaser quip, cash-builder answer) — well past the ~150-200 line comfort zone `REVIEWERS.md` flags.
    WHERE: server/src/rooms/handlers/messageHandlers.ts:1-306
    WHY: Ticket 031 already split dispatch/effects/handlers out of `TriviaRoom.ts` once; `messageHandlers.ts` is now the file absorbing all new growth instead. Phase 4 (ticket 064) adds a whole new chase-answer handler with real lockout-timer logic — landing that on top of this file pushes it well past 400 lines and further mixes concerns (lobby setup vs. live gameplay scoring). Worth deciding whether to split by phase (e.g. `handlers/lobby.ts`, `handlers/offer.ts`, `handlers/chase.ts`) before 064 lands, rather than after it's even bigger.
    STATUS: open