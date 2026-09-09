# 010: Client: make SERVER_URL configurable

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