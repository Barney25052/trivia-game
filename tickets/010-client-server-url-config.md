# 010: Client: make SERVER_URL configurable

> Updated after 001–006: unchanged requirement. `client/src/env.d.ts` (added in 001) + `"types": ["vite/client"]` are already in place, so `import.meta.env.VITE_SERVER_URL` type-checks without extra setup. Root `.gitignore` ignores `.env*` files, so the new `.env.example` is safe.

## Goal

Stop hardcoding `ws://localhost:2567` so the client can point at a deployed server.

## Scope

- In `client/src/App.vue`: replace the hardcoded `SERVER_URL` const with Vite env: `import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567"` as the dev fallback.
- Add `.env.example` in `client/` documenting `VITE_SERVER_URL`.
- Keep the dev fallback so `npm run dev` works with no env file.

## Acceptance

- `grep -n "ws://localhost:2567" client/src` shows the fallback only (no bare hardcode left).
- `cd client && npm run build` passes.

## Dependencies

None.