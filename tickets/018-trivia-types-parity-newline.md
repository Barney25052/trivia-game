# 018: TriviaTypes.ts trailing-newline parity (server vs client)

## Goal

AGENTS.md requires `GamePhase` / `PlayerRole` in `server/src/TriviaTypes.ts` and `client/src/TriviaTypes.ts` to stay identical. The enum bodies are identical, but the two files differ by a single trailing newline, so whole-file `diff`/parity checks always report a delta — and a real divergence could hide behind that noise.

## Scope / Reproduction

- Run `diff server/src/TriviaTypes.ts client/src/TriviaTypes.ts` from the repo root:

  ```
  15c15
  < }
  \ No newline at end of file
  ---
  > }
  ```

- `server/src/TriviaTypes.ts` has no final newline; `client/src/TriviaTypes.ts` does. The `GamePhase` and `PlayerRole` enum blocks themselves are byte-identical.
- Found while verifying ticket 015's client `PlayerRole` addition via extract + diff; both packages build clean and the wire values are unaffected — purely a file-level parity/cosmetic issue.
- Decide on the normalization to standardize (e.g. add the trailing newline to the server file and keep both aligned) and, when touching these files later, verify with a whole-file `diff` rather than block extraction.

## Acceptance

- `diff server/src/TriviaTypes.ts client/src/TriviaTypes.ts` → no output (files byte-identical).
- `cd server && npm run build` and `cd client && npm run build` — clean.

## Dependencies

- None.