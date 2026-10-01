# 168: Remove the web "Add questions" feature

## Goal
The user is about to host the game on a free click-to-deploy service and asked for the "Add questions" feature to go, 2026-10-01. On that kind of host the server's disk is wiped on every redeploy, so questions added through the form would not survive. Questions are written locally anyway (`server/data/questions.json` → reseed → redeploy), so the form only added an admin-gated write path to a public server.

## Scope
- Server: `server/src/questions/bankAdmin.ts` and `server/test/bankAdmin.test.ts` deleted. `app.config.ts` loses the `OPTIONS`/`POST /api/questions` routes, their CORS middleware, the `CLIENT_ORIGIN` startup warning and the `.listen()` wrapper that installed the preflight guard. `httpSecurity.ts` keeps only `checkBasicAuth` (still used by `/monitor`); `resolveAllowedOrigin` and `installQuestionsPreflightGuard` are gone. `BANK_EDIT` leaves `gameConfig.ts`, and the test-only `setBankDb` hook leaves `bank.ts` (its only caller was the deleted test).
- Client: `AddQuestionScreen.vue` deleted; the "Add questions" button and its emit leave `HomeScreen.vue`; `App.vue` loses `addQuestionMode` and the screen's routing; `API_BASE` leaves `serverUrl.ts`; the `.addQuestion*` rules, the now-unused `.field-label` selector and the `textarea` reset leave `style.css`.
- Env: `CLIENT_ORIGIN` no longer exists. `MONITOR_USER`/`MONITOR_PASS` now gate `/monitor` only.
- Docs: `README.md` (seed on every deploy, env vars, admin section), `AGENTS.md`, `GOAL.md`.
- `HUMAN_TASKS.md`: the user confirmed the contestant art is done, so the hair, face, eyes and mouth rows are `done`. `shoulders.png` and `eyes-teary.png` stay `todo`: neither file exists, and `CharacterFace` still uses its built-in fallbacks for them.
- No UI direction to sign off: this only removes a control and a screen, at the user's direct request.

## Acceptance
- `cd server && npm test` green (409 passing), including a new test that `POST /api/questions` now answers 404. `npm run build` green in both packages.
- Seen on the production build: the home screen shows only the name field, room code field, Join lobby and Create lobby; creating a lobby still works; `POST /api/questions` answers 404.
- `grep -rnE "bankAdmin|appendQuestion|AddQuestion|addQuestion|API_BASE|CLIENT_ORIGIN|resolveAllowedOrigin|PreflightGuard|BANK_EDIT|setBankDb" server/src server/test client/src` finds nothing.

## Dependencies
091–092 (the feature), 131/151/163 (its CORS and login handling), 138 (SQLite bank).
