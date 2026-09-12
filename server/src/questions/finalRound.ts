import { BankQuestion, pickRandom } from "./bank.js";

export type FinalRoundSide = "team" | "chaser";

/**
 * Two parallel, non-repeating open-ended question streams for the final
 * round (ticket 077): the team and the Chaser each draw from the same shared
 * bank, but a **single** used-id set is shared across both sides so neither
 * stream can ever hand out a question the other side already saw or is about
 * to see. Mirrors QuestionManager's draw pattern (cash builder), but with one
 * exclusion set instead of one per contestant.
 */
export class FinalRoundQuestions {
    private usedIds = new Set<number>();
    private currentQuestions: Record<FinalRoundSide, BankQuestion | null> = {
        team: null,
        chaser: null
    };

    /** Draws the next question for `side`, excluding every id either side has
     * already been served. Returns null (bank exhausted) instead of throwing —
     * callers treat that as "no more questions for this side". */
    drawNext(bank: BankQuestion[], side: FinalRoundSide): BankQuestion | null {
        try {
            const [drawn] = pickRandom(bank, 1, this.usedIds);
            this.usedIds.add(drawn.id);
            this.currentQuestions[side] = drawn;
            return drawn;
        } catch {
            this.currentQuestions[side] = null;
            return null;
        }
    }

    getCurrentQuestion(side: FinalRoundSide): BankQuestion | null {
        return this.currentQuestions[side];
    }
}
