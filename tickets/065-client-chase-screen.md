# 065: Client — real board-chase screen (Phase 4)

## Goal
Replace the placeholder `ChaseScreen.vue` (`client/src/screens/ChaseScreen.vue` — currently three fake "Option 1/2/3" buttons that emit a self-reported `chaseResult(false)` with no real question) with the real head-to-head UI once 064 lands the authoritative engine.

## Scope
- **UI sign-off first (AGENTS.md rule) — stop and present the intended screen before writing markup**: how the board renders (reuse the existing `board`/`boardSpace`/`playerSpace`/`chaserSpace` CSS classes as a starting point, per the current placeholder), how the MC options are shown to the answering side(s), how the 5-second lockout countdown is visualized, how a spectator/non-participant view differs, and how catch/escape resolution is presented before the phase transitions away.
- `client/src/screens/ChaseScreen.vue` rebuild: render the real MC question (from 064's broadcast) to both the active contestant and the Chaser, submit answers via the new message, show the lockout countdown once either side has answered, animate board position changes as `boardPos` updates arrive in synced state, and clearly surface catch/escape outcomes.
- `client/src/App.vue`: wire the new chase-answer message send, and make sure the MC question payload's filtering follows the same "never show the Chaser's correct-index" pattern already established for cash-builder questions (`currentRoundQuestion` filter, per `TO_REVIEW.md` item 13 — worth reading before starting, since this ticket is exactly the case that item flagged).
- `client/src/style.css`: extend the existing board styles as needed (4-space indent, no `<style scoped>`, reuse kebab-case class conventions).

## Acceptance
- `cd client && npm run build` passes.
- Manual 2+ browser check through a full chase round: both sides see and answer their own MC question, the lockout window behaves correctly, board positions animate, and catch/escape both display and hand off to the next phase correctly.

## Dependencies
- Depends on 064 (server board-chase engine) for the real message contract.
