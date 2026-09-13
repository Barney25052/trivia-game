# 115: Visual design system foundation (type, colour, base components) — UI SIGN-OFF REQUIRED

## Goal
Land the shared design-system pieces that tickets 116–119 all depend on. This ticket is the output of an extended live design conversation between the user and Claude, iterated entirely against a published mockup artifact rather than the running app:

**Mockup (source of truth for exact values/spacing/motion): [Big Baws Style Guide](https://claude.ai/code/artifact/2a6fa4c0-9f17-45e2-8283-d108489051dc)**

Read the mockup's own HTML/CSS directly for precise values — this ticket summarizes the decisions and cites the values that matter, but the mockup is normative where they conflict. Per AGENTS.md's UI rule, this direction was reached through direct back-and-forth with the user (many rounds of "show me → here's what's wrong → fix it"), not proposed cold — treat it as agreed, not as a fresh proposal to re-litigate. If anything here seems ambiguous once you're in the real code, check the mockup section referenced before guessing.

## Why this exists
The app had drifted from its own best screen (the Chaser character-picker in `RolesRevealScreen.vue` — one accent colour, pixel art that reads at a glance, hover reveals colour) toward generic Roboto/soft-shadow/pill-button chrome everywhere else. This ticket (and 116–119) bring the rest of the app up to that screen's standard rather than redesigning it.

## Type system
- `client/index.html` already loads "Luckiest Guy" and "VT323" via Google Fonts (next to Roboto) but neither is wired into `style.css` — leftover from an earlier abandoned attempt. Add "Rubik" (weights 400/500/600/700/800) to the same Google Fonts link.
- Three roles, used consistently everywhere below and in 116–119:
  - **Luckiest Guy** — titles, big numbers, outcome banners (`CAUGHT!`, `ESCAPED!`, screen titles).
  - **VT323** — HUD/pixel bits: timers, room codes, board-space numbers/wagers, countdown digits. Pairs naturally with `image-rendering: pixelated` art.
  - **Rubik** — replaces Roboto everywhere else: buttons, inputs, body copy, questions, names.
- Update the global `h1,h2,h3,h4` and all the individual `font-family: "Roboto", sans-serif;` declarations in `style.css` (there are ~30) to the appropriate one of the three above per the role, not a blanket find-replace — a button label is Rubik, a big score is Luckiest Guy, a timer is VT323.

## Colour tokens
Add to `style.css`'s `:root` (alongside the existing `--chaser-red-*`/`--contestant-blue-glow`/etc. tokens — reuse those names/values where they already exist rather than duplicating; the mockup's token names below are what the mockup itself uses and may not match 1:1):
- `--chaser-deep: #5c0a0a` and `--chaser-edge: #ff6a3d` — for the Chaser Final tension-fill (116/117).
- `--ink-chase: #2a1418` / `--ink-chase-raised: #38191d` — a red-shifted dark ground, same darkness as the existing page navy (`--color-bg-page` / mockup's `--ink: #1c2733`) but hue-rotated toward maroon. **This is a real system decision**: Chase-centric screens (Chase, Chaser Final) sit on this ground; team-centric screens (Lobby, Cash Builder, Team Final, Results) keep the existing navy. The Chase screen itself (116) splits both — see that ticket.
- `--success-green: #31c31e` — matches the existing `--color-green` exactly, used specifically for "a steal just succeeded" (117), distinct from gold (see below).
- Gold (existing `--color-gold`) is reserved for "an opportunity is currently live" (a steal in progress, prize amounts) — not reused for success/correctness, which stays green everywhere per the app's existing convention (Cash Builder's flash, Chase board's correct highlight).

## Base components (add to `style.css`, reusable across 116–119)

**Chunky buttons.** Flat fill + thick dark border + hard offset shadow, replacing today's fully-rounded pill + soft blurred shadow (`button` base rule and its variants). Two families, both already prototyped in the mockup (sections 01–03):
- *Flat press* (`.btn-primary`/`.btn-outline` in the mockup) — for ordinary buttons (Join Lobby, Save, etc.): `border: 3px solid #06202b`, `box-shadow: 4px 4px 0 <deep-color>`, hover lifts (`translate(-2px,-2px)`, bigger shadow), active presses in (`translate(2px,2px)`, smaller shadow).
- *Raised 3D press* — for one-off "physical button" moments (Team Final's buzzer, Lobby's start button, per-answer buttons on the Chase board): a solid *bottom lip* via a second box-shadow (`box-shadow: 0 Npx 0 <deep-color>, 0 (N+4)px Mpx rgba(0,0,0,0.4-0.5)`) reads as the button's own thickness; pressing moves the button down `translateY(N)` into that lip instead of just scaling. See mockup's `.buzzer-btn`, `.lobby-start-btn`, `.answer-btn` for exact values (they differ per button — buzzer is circular at 150px, board answer buttons are pill-shaped at ~140px min-width).
- **Persistent-pressed variant**: the Chase board's answer buttons need a `.picked` state that applies the *same* collapsed/pushed-in visual permanently (not springing back on mouseup) once an answer is chosen, plus `.dimmed`/`:disabled` on the other options — see mockup section 11's `.answer-btn.picked`/`.dimmed`.

**Frame-free circular portraits.** Replace the rounded-square `.frame` boxes used for character faces/Chaser icons in board/table contexts with plain circles, no border/outline: `border-radius: 50%; overflow: hidden;` cropping the content edge-to-edge (`object-fit: cover` for the Chaser's raster icon so it reads as a close portrait, not a small icon with padding). See mockup's `.board-portrait-circle`. **Exception**: don't remove the box behind characters in "card" contexts (the Results podium, ID-card style summaries) — only in board/table/cutscene contexts where a floating box looks like clutter, per the specific rounds that established this (Caught/Escaped cutscenes, the Chase board, Team Final's table, the Lobby).

**Money display ("prize plaque").** One shared look for every place a cash amount appears (Cash Builder pot, Team Final pot, Chaser's pot, wager badges) instead of each screen inventing its own: gold-bordered white plaque (`border: 4px solid var(--color-gold)`, white fill, big Luckiest-Guy amount) — see mockup's `.moneyPlaque`. Team Final's pot is a special case: it's embedded directly into the physical table (118), not a separate floating plaque.

**Room code as a ticket, not a pill.** Small punched side-notches (two circles cut into the badge's left/right edges via `::before`/`::after`) and a dashed divider before the copy icon, VT323 digits. See mockup's `.ticket-badge`. Used today in `LobbyScreen.vue`'s `.roomCode` (119) and could extend to `HomeScreen.vue`'s join flow if that screen gets picked up later (not in scope here).

**Open-ended answer box** (`.open-question-box` in the mockup). One component — prompt + a chunky input + a chunky Submit button — reused and re-accented per context rather than four bespoke panels: red border for "your own turn," gold for "an opportunity is live" (a steal), blue for "the team is acting," and the bare/neutral variant (`rgba(255,255,255,0.15)` border, matching an empty/unfilled slot elsewhere) for a default/no-special-meaning state. Used in 117 and 118.

**Particle burst + wobble reaction.** Two small motion primitives, both explicitly *event-triggered only* — never ambient/looping (this was an explicit, repeated user constraint: "subtle, not distracting"):
- **Burst**: a handful of small glyphs (`"$"` for money, `"★"` for a triumphant/escape moment) fly out from a point and fade — see mockup's `burst()`/`sparkle()` JS functions. Used for a correct answer (a bigger burst + a screen-local colour wipe + the amount ticking up from old to new value) and for "escaped" (a star trail). **Not** used for a Lobby poke or a Chase board pick — those got this treatment in mockup iteration and it was explicitly removed both times; don't re-add without being asked again.
- **Wobble reaction**: clicking/triggering a character's bust makes the *head* wobble (rotate, pivoting near the neck) and the *eyes* squeeze shut a beat later — **not** a whole-body squash-and-stretch. This explicitly supersedes the existing `.lobbyBustInner.poked`/`lobby-bust-poke` whole-bust scale animation in today's `style.css` — the user tried the rigid whole-body version first and rejected it in favour of independent per-part motion. Reusable everywhere a face/character appears (poking a Lobby seat, a Team Final buzz, a Steal answer).

  **Implementation gotcha found the hard way, worth reading before you port this into `CharacterFace.vue`**: the wobble's rotation needs `.head { position: absolute; inset: 0; transform-origin: 50% 88%; }` on the wrapper div that groups the face/hair/eyes/mouth layers. If that wrapper isn't positioned, it's invisible at rest (its absolutely-positioned children resolve percentages against the next positioned ancestor up instead, which happens to be the same size — so it looks fine until animated) but the moment `transform` starts animating on it, CSS makes even a `position: static` element become a containing block for its own absolutely-positioned descendants — so mid-animation the face parts briefly jump to resolve against the wrapper's own near-zero-size box and appear to vanish. Make sure whatever markup structure `CharacterFace.vue` ends up using for "the thing that wobbles" has this positioning from the start, not scoped to only one specific class that some usages forget to add.

Respect `prefers-reduced-motion` for all of the above (disable animations/transitions, not just slow them) — the mockup does this throughout; mirror the pattern.

## Scope
- `client/src/style.css` — all of the above tokens/components.
- `client/index.html` — add Rubik to the Google Fonts link.
- No `.vue` template changes in this ticket — that's 116–119, which depend on this one landing first.

## Acceptance
- `cd client && npm run build` passes.
- Visually spot-check the new button/plaque/ticket-badge/frame styles render correctly somewhere reachable (they won't be wired into real screens until 116–119) — a temporary test page or Storybook-style scratch route is fine, delete it before merging.
- No visual regression on screens not touched by this ticket (this ticket only adds tokens/classes, doesn't remove or rename existing ones still in use).

## Dependencies
- None. This is the prerequisite for 116, 117, 118, 119.
- Supersedes/closes out ticket 067's discussion phase — see that ticket's updated note.
