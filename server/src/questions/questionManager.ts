import { BankQuestion, pickRandom } from "./bank.js";

// Keyed by seatId — the stable per-round identity (ticket 044), never the
// ephemeral Colyseus sessionId.
export class QuestionManager {
    private usedIds = new Map<string, Set<number>>();
    private currentQuestions = new Map<string, BankQuestion>();

    initContestant(seatId: string): void {
        this.usedIds.set(seatId, new Set());
        this.currentQuestions.delete(seatId);
    }

    drawNext(bank: BankQuestion[], seatId: string): BankQuestion | null {
        const excludeIds = this.usedIds.get(seatId) ?? new Set<number>();
        try {
            const [drawn] = pickRandom(bank, 1, excludeIds);
            excludeIds.add(drawn.id);
            this.usedIds.set(seatId, excludeIds);
            this.currentQuestions.set(seatId, drawn);
            return drawn;
        } catch {
            return null;
        }
    }

    getCurrentQuestion(seatId: string): BankQuestion | undefined {
        return this.currentQuestions.get(seatId);
    }

    clearContestant(seatId: string): void {
        this.usedIds.delete(seatId);
        this.currentQuestions.delete(seatId);
    }
}
