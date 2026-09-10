# REVIEWERS.md

End-of-phase reviewer playbook for this repo. Point a fresh agent here and name the phase:

> "You are a reviewer. Read `REVIEWERS.md` and follow it as your process. We're finishing <phase>. Complete the review."

The reviewer is the last gate before a phase is called done. It does **NOT** implement the phase's tickets; it verifies what was claimed for the phase, flags what is wrong or missing, creates tickets for follow-ups, keeps `GOAL.md` / `tickets/README.md` honest, records things the human should weigh in on in `TO_REVIEW.md`, and surfaces risks for the user to decide on.

## Ground rules — read first

- `AGENTS.md` is the source of truth for conventions, invariants, and the green gate. **Obey it; this file is process on top of it.**
- `GOAL.md` "Current state" + "Plan" = what the project claims. `tickets/README.md` = what tickets claim. Your job: find where the **code disagrees with the claims**.
- **Evidence over assertion.** A "done" ticket or a checked box proves nothing until you see it in code and in a passing command.
- Never silently fix, silently log, or silently ignore a bug. Triage every finding (step 5). User preference: findings become **tickets**, not `BUGS.md` entries (`BUGS.md` is only for bugs an implementer finds mid-ticket).
- **Two outboxes, don't blur them**: objective problems (bugs, broken invariants, user-visible defects) → tickets, with a fix owner and a phase. Subjective judgment calls the human may want to steer — architecture direction, design smells, anything that "looks a little weird" — → **`TO_REVIEW.md`**, not a ticket. If in doubt about which bucket, it's a TO_REVIEW item: the user can always turn it into a ticket themselves.
- UI work: never implement a UI change without the user's sign-off (per `AGENTS.md`). Flag, ticket, and discuss instead.
- Be authoritative and specific: cite `file:line` for every finding. We review the work, not the person — no padding, no praise, a cold audit.

## Process

### 1. Orient

- Read `AGENTS.md`, `GOAL.md`, `tickets/README.md`, `BUGS.md`, `HUMAN_TASKS.md`, `TO_REVIEW.md`.
- `git log --oneline -20` and `git status` — know what landed since the last review.
- State the phase being reviewed and its scope from `GOAL.md` "Plan". List every bullet/ticket claimed done or in-progress for that phase.

### 2. Verify — commands over claims

For every claimed deliverable in the phase:

- **Green gate**: `cd server && npm test`, `cd server && npm run build`, `cd client && npm run build`. Record exact counts/results.
- Confirm the feature exists **in code and is reachable** (handler registered, route wired, state-machine transition present, screen rendered from `App.vue`). Grep by name, then read the surrounding context — not just the match.
- Check each done ticket's **acceptance criteria**, not just its title.

### 3. Audit the invariants (AGENTS.md "Architecture invariants" + "Security")

Walk each one explicitly; record pass/fail with evidence:

- `gameFlow.ts` is **pure** (no room calls, no I/O); the room applies effects and never decides transitions.
- All tunables live in `gameConfig`; no magic numbers in room code.
- Handlers are **authoritative + role-checked + phase-checked**; validate shape/types/bounds; reject + log.
- Room/join options are **clamped** to `gameConfig` bounds, not trusted.
- `GamePhase` / `PlayerRole` parity between `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts`.
- **No correct-answer leak**: the correct MC index / free-text answers never live in synced state before reveal.
- Player-controlled text is escaped (no `v-html`).
- `sessionId` is ephemeral — no durable-identity assumptions in handlers, scoring, or round order.
- Timers cancellable; no unbounded client-driven loops, broadcasts, or timer chains (abuse caps, rate limits).
- No secrets or telemetry in code, configs, or logs.

### 4. No-cruft sweep

- Template leftovers: `MyRoom`, `my-app`, dead phases / enum members / schema classes, unreferenced handlers/routes.
- Dead CSS in `client/src/style.css` (hand-maintained — no commented-out or orphaned rules).
- Stale imports, unused variables (builds catch some — read the diffs anyway).
- **Stale docs**: anything in `GOAL.md` / `AGENTS.md` / tickets that contradicts what you verified.

### 5. Triage — severity + disposition

**Severity:**

- **Blocker** — breaks the game, a build, or the test suite; or a real security hole. Must be fixed or explicitly decided before the phase is called done.
- **Major** — violates a documented invariant, or a user-visible defect. Ticket now.
- **Minor** — polish, legibility, small refactors. Ticket (backlog) and continue.
- **Nit** — style/naming trivia. Mention in the report only; don't ticket.

**Disposition:**

- In-scope for the phase → create a ticket (or rarely fix it — never UI without sign-off).
- Out-of-scope → create a ticket noting which future phase owns it.
- Product decision / open question → raise it in the report for discussion; don't ticket it as a bug.

### 6. Architecture & design flags → `TO_REVIEW.md`

Separate from triaging bugs, actively hunt for things the **human** should look over — judgment calls with lasting impact. Append any you find to `TO_REVIEW.md` at the repo root (create it if missing) with `file:line` and a plain-English "why it matters".

Put in `TO_REVIEW.md`:

- **Architecture direction with lasting impact** — anything shaping the project for the long term: package boundaries and coupling between server/client, the shape of `gameFlow`/schema as it grows, storage choices (file → SQLite → server), new runtime dependencies, how state/documentation is shared, anything where a wrong turn now is expensive to unwind later.
- **Code smells pointing at a bigger decision** — duplicated logic blocks that should be a shared util; a file quietly becoming "everything" (growing past ~150–200 lines, mixed concerns); hand-rolled patterns a library or helper would serve; patterns the reviewer suspects will bite later.
- **Anything that looks a little weird even if it passes** — surprising overrides, odd invariants, pre-existing quirks the reviewer doesn't want to silently carry on, or a place where the code is going in a direction the user never signed off on.

Do **NOT** put in `TO_REVIEW.md`:

- Clear bugs or broken invariants → those are tickets (step 5).
- Style trivia → report only.

Format (append, don't rewrite; reviewers never mark entries `decided` — only the human does):

```
| Where | What | Why it matters | Status |
|-------|------|----------------|--------|
| server/src/*.ts:NN | One-line description | Lasting impact / direction to watch | open |
```

The human reads `TO_REVIEW.md` at phase end along with your report. Their decision becomes one of: a GOAL/rules update, a ticket, or parked (status flipped to `decided` with a note). Keep the list short and high-signal — a long dump is noise.

### 7. Update the source of truth

- Flip rows in `tickets/README.md` to `done` **only after you verified them**.
- Append the tickets you triaged to the tracker as `backlog`.
- Append fresh entries to `TO_REVIEW.md` for the human (step 6) — the file IS part of the source of truth, not a suggestion box.
- Refresh `GOAL.md` "Current state" and check off phase bullets that are genuinely complete. Keep it honest — a phase is done only when the review says it is.

### 8. Report & discuss

Deliver, in order:

- **Phase verdict** — DONE / DONE-WITH-FOLLOW-UPS / NOT-DONE, in one line.
- **Verified** — what you ran and what passed (exact test counts, build results).
- **Findings** — blocker/major/minor, each with `file:line`, what you saw vs. what you expected.
- **Tickets created** — numbers + one-line titles.
- **Risks & discussion** — the radar below plus anything you observed. The user wants to *discuss* these: end with the 2–3 most important open questions, framed as decisions, not just problems.

## Future-issues radar (always be watching)

- **Code drift vs docs** — GOAL/tickets say one thing, code another. Watch for it every review.
- **Test quality** — do new tests assert real behavior, or just not-crash? Flag "happy-path-only" tests for state-machine and scoring logic.
- **Erosion under cheap models** — as the codebase grows: oversized files (flag >~150–200 lines), duplicated logic blocks (copy-pasted handlers), type-parity slips, drift from AGENTS.md conventions.
- **Context burden** — every agent re-reads everything. Flag when AGENTS.md / GOAL.md start costing more than they save; recommend pruning.
- **Security accumulation** — each new phase adds inbound messages (answers, votes, picks, offers). Each must land with role/phase guards; verify the message list doesn't grow faster than the guards.
- **Deferred debt** — parked items (offer math in the room, placeholder screens, unclamped options) must stay visible in GOAL so they resurface instead of rotting.
- **Timing/authority** — client-side countdowns vs server-authoritative timers. Flag anywhere a client value could diverge from the server's.

## Report template

```
# Phase <N> review — <date>

Verdict: DONE / DONE-WITH-FOLLOW-UPS / NOT-DONE
Scope reviewed: <phases/bullets/tickets>

## Verified
- server: npm test (<N> passing), npm run build OK
- client: npm run build OK
- <per-ticket evidence, 1-2 lines each>

## Findings
- [BLOCKER] <file:line> — what you saw — expected
- [MAJOR] ...
- [MINOR] ...

## Tickets created
- ### — one-liner (status backlog)

## To review (your call)
- <entry added to TO_REVIEW.md — where + why it matters>
- <…>

## Risks & discussion
- <2-3 items framed as decisions, not just problems>
```

## Do / Don't

- **DO** cite `file:line` for every finding. **DO** verify before believing. **DO** prefer tickets over `BUGS.md`. **DO** update the tracker, GOAL, and `TO_REVIEW.md` so the next reader isn't misled.
- **DON'T** implement phase features. **DON'T** change UI without sign-off. **DON'T** put subjective architecture flags in tickets when they belong in `TO_REVIEW.md`. **DON'T** mark `TO_REVIEW.md` entries `decided` yourself — that's the human's call. **DON'T** take any single claim on faith — run the commands. **DON'T** pad the report with praise; it's an audit.