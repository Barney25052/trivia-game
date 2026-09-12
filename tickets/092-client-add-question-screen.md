# 092: Client — "Add questions" home entry + Add Question screen — UI SIGN-OFF REQUIRED

## Goal
A self-serve way to grow the open-ended question bank from the game: on the home page, a link that takes you to a screen with a question, an answer, and alternative answers; submitting appends it to `server/data/questions.json` via 091's endpoint.

## Proposed direction (for sign-off)
- **What the player does**: on `HomeScreen` (the join/create page, `client/src/screens/HomeScreen.vue`) a quiet **"Add questions"** link/button sits under the join/create buttons. Clicking it swaps to a new `AddQuestionScreen` (routed locally in `App.vue` like `home`, no Colyseus room involved). The screen has:
  - a **question** input,
  - an **answer** input,
  - an **alternative answers** input — a multiline textarea, one alternative per line (server normalises to an array),
  - **Submit** and **Back** buttons.
- **On submit**: `fetch` 091's endpoint with the http base derived from `SERVER_URL` (`"ws://localhost:2567"` → `"http://localhost:2567"`, see `App.vue:20`). On success show an inline confirmation (with the new question's id) and offer "Add another" / "Back"; on a `400` show the server's validation message inline under the inputs.
- **Visual**: reuse the `home` / `homeInputs` / `joinButton`-family look; new classes only for the add screen, all in `style.css` (kebab-case, no new art assets). No `v-html` anywhere — everything is plain text interpolation.
- **Server plug**: plain `fetch` only; never a Colyseus message.

## Scope
- `client/src/screens/AddQuestionScreen.vue` (new), `client/src/screens/HomeScreen.vue` (entry point + emit), `client/src/App.vue` (screen flag/routing for the add view), `client/src/style.css`.
- Not in scope: 091's endpoint, editing/deleting existing questions, making the add screen a room-based feature, auth.

## Acceptance
- Manual (server + client dev): home shows the add-questions entry; the add screen submits a full question → success message and the row appears in `server/data/questions.json`; submitting an empty question shows the server error; Back returns home; join/create still work.
- `cd client && npm run build` passes.
- Depends on 091 so the POST has somewhere to land.

## Dependencies
- 091 (server endpoint).