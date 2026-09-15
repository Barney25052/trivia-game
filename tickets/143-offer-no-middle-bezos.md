# 143: Server — Offer-phase passive: No Middle (Bezos)

## Goal
Bezos's passive: when he's the Chaser, every offer he sets voids the middle tier entirely — the contestant can only be offered (and pick) low or high, never the safe middle ground.

## Scope
- `server/src/rooms/handlers/effects.ts`: `startOffer` and `chaserOffersSet` already broadcast `offerStart`/`offer` with the offer amounts. Add a server-computed `middleVoided: boolean` field to both broadcasts — `true` when `chaserCharacterId === "bezos"`, computed the same way those handlers already look up the Chaser's character. The internal `middle` number (the contestant's actual cash-builder take) is **not removed** — it still exists and still bounds low (`< middle`) and high (`> middle`) exactly as today, per the existing `OFFER` rules. Only its use as a *pickable tier* is voided. Do not change `startOffer`'s existing `$0`-middle pre-fill logic (ticket 058) — that's an unrelated edge case and must keep working the same whether or not No Middle is active.
- `server/src/rooms/handlers/messageHandlers.ts`: `offerChoice` must reject `offer === "middle"` when `middleVoided` is true for the current offer (store `middleVoided` alongside `room.currentOffer` when `startOffer` sets it up, the same way `low`/`middle`/`high` are already tracked there) — server-authoritative per AGENTS.md, never trust the client to simply not send it.
- No change to `setChaserLowOffer`/`setChaserHighOffer` — Bezos still sets low/high the same way; only the contestant's choice is restricted.

## Acceptance
- `cd server && npm test` and `npm run build` pass.
- Tests cover: with Bezos as Chaser, `offerChoice` with `"middle"` is rejected (logged, no state change) while `"low"`/`"high"` still work normally; with any other character as Chaser, `"middle"` still works exactly as before; the `$0`-middle pre-fill path (ticket 058) still behaves identically regardless of `middleVoided`; the broadcast payloads carry `middleVoided` correctly for both Bezos and non-Bezos chasers.

## Dependencies
139 (roster/character id lookup). Independent of 140–142.
