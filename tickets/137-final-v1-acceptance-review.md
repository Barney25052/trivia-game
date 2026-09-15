# 137: Final v1 acceptance review

## Goal
Once Phase 6 hardening (130–132) and the last visual-redesign follow-ups (129, 133–136) land, run a proper end-to-end review of the *whole* project against `GOAL.md`, before calling the base game "done" — the same rigor `REVIEWERS.md` already applied per-phase, but for the project as a whole now that every phase (0–6) plus the visual redesign arc is claimed complete.

## Scope
Follow `REVIEWERS.md`'s process directly: "You are a reviewer. Read `REVIEWERS.md` and follow it as your process. We're finishing the whole base game (Phases 0–6). Complete the review."
- Full green gate: `server/npm test`, `server/npm run build`, `client/npm run build`.
- Walk every invariant in `AGENTS.md`'s "Architecture invariants" and "Security" sections against current code, not past review findings — things drift.
- No-cruft sweep across the whole repo, not just the last few tickets: template leftovers (`server/package.json`'s `your-organization/trivia-game` placeholder `bugs`/`homepage` URLs are a known one), dead CSS, stale `BUGS.md` entries that should be `triaged`, stale `TO_REVIEW.md` entries that should be `decided` or re-raised.
- Confirm every `GOAL.md` "Plan" checkbox through Phase 6 is either genuinely checked or explicitly re-scoped/parked, and that "Current state" reflects reality.
- Play a full game start-to-finish manually (or via the existing e2e test coverage plus one live playthrough) and confirm nothing in the actual experience contradicts what the tickets claim.

## Acceptance
- A full `REVIEWERS.md`-format report: verdict, verified commands + results, findings by severity, tickets created for anything found, `TO_REVIEW.md` entries for anything needing the user's judgment call.
- `tickets/README.md` and `GOAL.md` updated to match what was actually verified.

## Dependencies
- 130, 131, 132 (Phase 6 hardening), 129, 133, 134, 135, 136 (remaining visual redesign) — run this once those have landed, not before. If the user wants to skip or defer any of them, re-scope this review's dependency list accordingly rather than blocking indefinitely.
