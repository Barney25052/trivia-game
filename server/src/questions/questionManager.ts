import { BankQuestion, pickRandom } from "./bank.js";

// Keyed by sessionId until ticket 034 (seat IDs) lands; rekey to seatId
// as part of that migration.
export class QuestionManager {
    private usedIds = new Map<string, Set<number>>();
    private currentQuestions = new Map<string, BankQuestion>();

    initContestant(sessionId: string): void {
        this.usedIds.set(sessionId, new Set());
        this.currentQuestions.delete(sessionId);
    }

    drawNext(bank: BankQuestion[], sessionId: string): BankQuestion | null {
        const excludeIds = this.usedIds.get(sessionId) ?? new Set<number>();
        try {
            const [drawn] = pickRandom(bank, 1, excludeIds);
            excludeIds.add(drawn.id);
            this.usedIds.set(sessionId, excludeIds);
            this.currentQuestions.set(sessionId, drawn);
            return drawn;
        } catch {
            return null;
        }
    }

    getCurrentQuestion(sessionId: string): BankQuestion | undefined {
        return this.currentQuestions.get(sessionId);
    }

    clearContestant(sessionId: string): void {
        this.usedIds.delete(sessionId);
        this.currentQuestions.delete(sessionId);
    }
}
