# 163: Adding questions needs the admin login in production

## Goal
Pre-upload blocker found 2026-09-27. `POST /api/questions` writes straight into the live question bank, and in production it was only guarded by CORS (ticket 131), which browsers enforce but `curl` and scripts ignore. On a public server anyone could have added questions (including offensive ones) that every later game draws from. Confirmed against the production build: an unauthenticated POST reached validation.

## Scope
- `server/src/app.config.ts`: the `/monitor` Basic Auth guard (ticket 131) becomes `requireAdminAuth` and also guards `POST /api/questions`, after the CORS headers and before body parsing. Same credentials (`MONITOR_USER`/`MONITOR_PASS`), same fail-closed behaviour (503 when unset), one realm (`Trivia Admin`) so a browser that has logged in to either reuses the login for the other. Dev (`NODE_ENV !== "production"`) is unchanged: no login. The startup warning mentions adding questions too.
- `client/src/screens/AddQuestionScreen.vue`: on a 401 (login cancelled) it says "Adding questions needs the admin login."; on a 503 "Adding questions isn't set up on this server." Before, those non-JSON responses fell through to "Could not reach the server". The browser itself asks for the login on the 401 challenge.
- Kept as is: the Home screen's "Add questions" link (it now leads to a login-gated form on a live server).

## Acceptance
- `cd server && npm test` green, including the new "POST /api/questions admin login (production gate, ticket 163)" block in `test/httpSecurity.test.ts` (dev open; production 503 unconfigured, 401 + challenge without or with wrong credentials, validation reached with them). The two existing production CORS tests now log in, since posting needs it.
- Production build on `:8080` with no admin login configured: the form shows "Adding questions isn't set up on this server." and nothing is written.
- `npm run build` green in both packages.

## Dependencies
131.
