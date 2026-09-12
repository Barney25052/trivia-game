import { OFFER_QUIPS } from "./gameConfig.js";

export type OfferQuipStage = keyof typeof OFFER_QUIPS;

/** Pick one line for a given offer stage. The server is the single picker, so
 * whichever line it chooses reaches every client via the same broadcast. */
export function pickOfferQuip(stage: OfferQuipStage): string {
    const pool = OFFER_QUIPS[stage];
    return pool[Math.floor(Math.random() * pool.length)];
}