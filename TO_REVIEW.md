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

13. WHAT: The Phase 2 question broadcast is sent to ALL clients with a `targetSessionId`, and the client filters it out for non-targets (`client/src/App.vue` `currentRoundQuestion`).
    WHERE: server/src/rooms/TriviaRoom.ts:95-106 (`broadcastQuestion`), server/src/rooms/handlers/effects.ts:80-90, client/src/App.vue:64-68
    WHY: This is the ticket-030 "ghost scoreboard" seam (the board chase's MC `correctIndex` and the final's answers must NEVER reach the Chaser). Today a client renders the prompt only for the matching target, so it works — but the sensitivity live in the *client's* filter. A future UI regression (forgetting the `currentRoundQuestion` filter, rendering a shared ref) would leak the active contestant's question to the Chaser. The final-round answers that both sides must not see each other's are server-gated by NOT broadcasting at all — worth deciding whether the cash-builder question should be server-targeted too (`targetSeatId` channel) to keep one consistent rule.
    STATUS: open

15. WHAT: `server/src/rooms/handlers/messageHandlers.ts` is 306 lines and mixes every phase's message handlers in one file (lobby/vote, roles-reveal ready, offer low/high, chase result, final score, chaser quip, cash-builder answer) — well past the ~150-200 line comfort zone `REVIEWERS.md` flags.
    WHERE: server/src/rooms/handlers/messageHandlers.ts:1-306
    WHY: Ticket 031 already split dispatch/effects/handlers out of `TriviaRoom.ts` once; `messageHandlers.ts` is now the file absorbing all new growth instead. Phase 4 (ticket 064) adds a whole new chase-answer handler with real lockout-timer logic — landing that on top of this file pushes it well past 400 lines and further mixes concerns (lobby setup vs. live gameplay scoring). Worth deciding whether to split by phase (e.g. `handlers/lobby.ts`, `handlers/offer.ts`, `handlers/chase.ts`) before 064 lands, rather than after it's even bigger.
    STATUS: open

**Phase 4 review** (verified: 211 tests green, both builds green) — append by reviewers. Items that are clear bugs/invariants went to tickets 074–076; the judgment calls below were baked into tickets 077–083 with default policies that are easy to flip, but the user should confirm each.

16. WHAT: Final-round prompt delivery is per-side targeted `client.send(...)`, not broadcast+client-filter — the opposite rule from the cash-builder question (TO_REVIEW #13, still open). The ticket assumes the strict rule ("never on the wire to the wrong side") holds for the final round specifically, and that the cash-builder broadcast+filter stays as-is until #13 is decided.
    WHERE: tickets/077-final-round-question-delivery.md, server/src/rooms/TriviaRoom.ts:141-151 (`broadcastQuestion`), client/src/App.vue (currentRoundQuestion filter)
    WHY: The final round is the highest-stakes secrecy moment (Chaser vs team, score is everything); a client-filter leak there would be a real unfairness. But it makes the final round's wire pattern different from the cash builder's — two delivery models in one app. Decide once, then #13 can collapse the cash builder in.
    STATUS: open

17. WHAT: Team-final answer model — the ticket's default is "the first submitted answer resolves the question" (correct → +1, wrong → no change, stream advances either way), the same no-penalty advance as the cash builder.
    WHERE: tickets/078-final-round-team-answers.md
    WHY: The show's team huddles then gives one spoken answer, so first-answer-advances is faithful — but an alternative product take is "the team keeps answering the same question until someone gets it right" (multi-player persists against a hard question). It's roughly a one-line change; the user should pick before 078 is implemented.
    STATUS: decided
    DECISION: **Buzz-in** chosen by the user (2026-09-12): the team must buzz in (button or **space**) to take a question, only the first to buzz types the answer, then reveal → next question; the Chaser answers **directly with no buzz**. Follow-up clarification (same day): the team's steal in the Chaser round is **not** buzz-in — a Chaser miss opens a **20-second window** and the **first submitted answer is taken even if it's wrong**. GOAL.md rules + tickets 077/078/079/080/081/082 updated to match; the "keep answering until correct" alternative is dead.

18. WHAT: Chaser-final edge rules baked into 079 as defaults: push-back floors `chaserScore` at 0 (no negative), and a Chaser reaching *exactly* `teamScore` wins ("reaches/passes" ⇒ `>=`).
    WHERE: tickets/079-final-round-chaser-engine.md
    WHY: Consequences, not bugs — a negative chaser score is meaningless display and a strict `>` would change the show's "reaches/passes" wording into "beats". Both are cheap to flip if the user wants otherwise.
    STATUS: decided
    DECISION: Decided by the user (2026-09-12). A correct steal **pushes the Chaser back** (`chaserScore - 1`) while `chaserScore > 0`, **but if the Chaser sits at 0 the steal instead raises the team's target by 1** (`teamScore + 1`) so the steal always has teeth. The game ends the moment the Chaser **reaches** `teamScore` (`>=` — a tie counts as caught) — no further questions, no need to exceed it. Tickets 079/082 and GOAL.md's final-round rules updated to match.

19. WHAT: Chase recovery policy when the MC source keeps failing — 074's default is "bounded retries, then resolve the round as caught" (the Chaser "wins" a broken API, the flow never hangs).
    WHERE: tickets/074-chase-stalls-on-question-source-failure.md
    WHY: An alternative is "abort the whole room to GameEnd" on source failure — arguably more honest, but it kills a friends' game on a network blip. The chosen default keeps the room alive; weigh it once.
    STATUS: decided
    DECISION: Decided by the user (2026-09-12). OpenTDB failure → bounded retries, then **fall back to a small local ~100-question MC backup pool in the same JSON format** (new ticket 090) drawn through the same get-questions interface; only if the backup itself is exhausted does the round resolve as caught (last resort, no hang). Ticket 074 + GOAL.md "Question bank" section updated to match.

20. WHAT: Chaser-leave policy — 075's default is "game over, team wins" the moment a selected Chaser disconnects (mirrors host-leave, no promotion mechanic).
    WHERE: tickets/075-chaser-leave-mid-game-recovery.md
    WHY: Promoting a remaining contestant to Chaser mid-room would preserve the game but conflicts with the chaser-character and chaser-pot identity the seat already carries, and would need offer/chase re-wiring — a real feature, not a fix. Parked unless wanted.
    STATUS: decided
    DECISION: Decided by the user (2026-09-12): keep the default — a Chaser disconnect ends the game with the team winning. Ticket 075 is unchanged; promotion is parked.