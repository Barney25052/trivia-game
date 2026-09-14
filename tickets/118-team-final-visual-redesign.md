# 118: Team Final visual redesign — UI SIGN-OFF REQUIRED

## Goal
Redesign `TeamFinalScreen.vue`/its `style.css` rules to match the mockup's "The Team Final" (**[Big Baws Style Guide, section 13](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)**).

## Depends on
Ticket 115 (foundation). This ticket introduces the shared "speech bubble" and "physical table" patterns that 117's Steal screen also reuses — build this one first if sequencing matters, or coordinate the component names with 117.

## Agreed direction

**Ground**: plain existing page navy throughout — the Chaser isn't on screen during this phase at all, so no chase-tinted ground here (contrast with 116/117).

**A real table, not a row of floating heads.** User's own sketch (people in a row, a horizontal line, the pot in a box below it) drove this: contestants stand *behind* a physical table slab — pull the seat row down (or the slab up) so the bottom of each bust's shoulders tucks behind the slab's top edge, giving a "standing behind the table" read. The slab itself uses the same "raised 3D block" trick as 115's buttons (a solid bottom-lip box-shadow) rather than a flat rectangle.
- **The team pot moves into the table itself** — no separate floating plaque for this screen; the amount (Luckiest-Guy or VT323, mockup uses ~52px pixel-font gold) is centered directly on the slab's front face.
- Contestants are frame-free circles (115) standing on/behind the slab, names in bold Rubik at ~19px (bigger than today's small label).
- **No background box behind the contestants** — tried with one first, removed it; float free, same rule as 116's cutscenes.

**The buzzer — the first "press this" moment anywhere in the game.** A big circular button (raised 3D press per 115) for buzzing in, replacing today's plain `.teamFinalBuzzButton`. **Space bar also buzzes — this is already real, existing behavior** (`handleSpace` in `TeamFinalScreen.vue`, gated on focus not being in the input) — no new logic needed here, just make sure the visual buzzer doesn't get built in a way that duplicates or conflicts with the existing keydown handler.

**On buzzing**, three things happen together, all reusing 115's primitives rather than new bespoke effects:
1. The buzzer's head wobbles + eyes squeeze (115's reaction) — **do not** use a whole-body squash; this was explicitly tried and rejected earlier in the same design conversation for a different screen, the rule carries here too.
2. The table slab itself lights up (border colour + glow) so "someone's answering" reads at the whole-table level, not just on one seat.
3. Submitting their answer pops a **speech bubble** over their seat with what they typed — a new shared component (`.speech-bubble`, white rounded bubble with a tail, matching the visual language of the app's existing `chaserPanelBubble` family conceptually, but check whether it makes sense to literally reuse/extend `chaserPanelBubble`'s CSS rather than adding a parallel one — the mockup built a fresh one because its own scratch CSS didn't have the real component available, the real app does).

**A "spotlight" effect (a light cone dropping onto the buzzing seat, borrowed from `ChaserCharacterRevealScreen`'s `.ccrSpotlightBeam` technique) was tried and explicitly abandoned** — don't implement it. Table-lighting + head-wobble carry the "someone's answering" signal on their own.

**Wrong-answer state**: today's `teamFinalQuestionArea-wrong` is a pale-pink card (`--color-danger-pale`) that clashes with the dark theme — replace with a dark panel + thick red border + Luckiest-Guy "✗ WRONG!" label (the same shared "wrong panel" component 117's Chaser Final also uses — build it once).

**Target visualization**: today's compact `finalTargetRow` strip moves to a **full-bleed background layer** — a set of full-height vertical bars spanning the entire scene behind everything else, one bar per point of `teamScore` (confirmed: `chaserScore` is always 0 during this phase, so these bars never "fill in" a colour the way 117's target boxes do during the Chaser's round — they only ever grow in count). Submitting a correct answer should visibly animate a new bar rising up from the bottom into place (not just appearing) and the on-screen score number ticking up, so scoring reads as an event.
- **Important scoping note for whoever implements this**: the mockup is a documentation page with many sections stacked vertically, so its version of "full-bleed" is scoped to that one demo's own container as a stand-in. In the real single-screen app, this should genuinely be `position: fixed` to the true viewport (or at minimum the full game-screen container), not scoped to some inner wrapper — don't copy the mockup's scoping literally, copy its *visual intent*.

## Real behavior this ticket should NOT change
- `buzz()`/`submit()`/`handleSpace()` logic, `finalBuzzSeatId` handling, the buzz-winner-only input gating, `answerResult`/screen-flash timing, `targetBoxes` computation. Only presentation, plus the new bubble/table-light/bar-rise visual events layered on top of existing state changes (no new server messages needed — everything driving these effects is already client-visible state).

## Scope
- `client/src/screens/TeamFinalScreen.vue` — template changes for the table/slab structure, buzzer markup, speech-bubble element, full-bleed target bars.
- `client/src/style.css` — corresponding rules; likely extending/reusing `chaserPanelBubble` for the speech bubble rather than duplicating it (check first).

## Acceptance
- Manual playthrough of a full Team Final round (at least one correct buzz-and-answer, one wrong answer) with the user watching live, per AGENTS.md.
- Confirm space-bar buzzing still works and isn't double-triggered by any new click handler on the visual buzzer.
- `cd client && npm run build` passes.

## Dependencies
- 115 (design system foundation) must land first.
