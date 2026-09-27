# 162: The client connects to the host that served it in production

## Goal
Pre-upload blocker found 2026-09-27. The client only knew one server: `import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567"`, in both `App.vue` and `AddQuestionScreen.vue`. Ticket 130 made the server serve the built client itself, but a production build made without `VITE_SERVER_URL` still pointed every player's browser at `localhost:2567`, i.e. at their own machine. Reproduced with the production build on port 8080: the page loaded from `:8080` but sent its matchmaking request to `http://localhost:2567` (it only "worked" because a dev server happened to be running there).

## Scope
- New `client/src/serverUrl.ts`: `SERVER_URL` is `VITE_SERVER_URL` when set; otherwise a production build uses the page's own host, with `wss://` when the page came over `https://` (so it works behind a TLS proxy with no build flags); dev keeps `ws://localhost:2567`. `API_BASE` is the same server over HTTP(S).
- `App.vue` and `AddQuestionScreen.vue` import from it instead of each deriving their own.
- `client/.env.example`: the variable is now commented out with an example, since copying the old file to `.env` would hard-wire a production build to localhost again.
- No visual change.

## Acceptance
- `cd client && npm run build` green; `localhost:2567` no longer appears in the production bundle.
- Production build served on `:8080` (`server-prod` in `.claude/launch.json`): creating a lobby sends `POST http://localhost:8080/matchmake/create/trivia` (200) and the lobby opens.

## Dependencies
130.
