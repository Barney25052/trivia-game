import assert from "assert";
import { nextExpression, Expression } from "../src/reactions.js";
import { REACTION } from "../src/gameConfig.js";

describe("reactions (ticket 103)", () => {
    it("a correct answer always smiles, regardless of streak", () => {
        assert.strictEqual(nextExpression("neutral", true, 0), "smile");
        assert.strictEqual(nextExpression("neutral", true, 5), "smile");
        assert.strictEqual(nextExpression("teary", true, 99), "smile");
    });

    it("a single wrong answer frowns", () => {
        assert.strictEqual(nextExpression("neutral", false, 1), "frown");
    });

    it("two wrong answers in a row goes teary, at the configured threshold", () => {
        assert.strictEqual(REACTION.wrongStreakTear, 2, "sanity check against the ticket's stated default");
        assert.strictEqual(nextExpression("neutral", false, REACTION.wrongStreakTear - 1), "frown");
        assert.strictEqual(nextExpression("neutral", false, REACTION.wrongStreakTear), "teary");
    });

    it("a streak already beyond the threshold stays teary", () => {
        assert.strictEqual(nextExpression("teary", false, REACTION.wrongStreakTear + 3), "teary");
    });

    it("a wrong answer with a reset (0) streak frowns, not tears", () => {
        assert.strictEqual(nextExpression("neutral", false, 0), "frown");
    });

    it("`prev` does not influence the outcome — every prior expression yields the same result for the same correct/streak pair", () => {
        const priors: Expression[] = ["neutral", "smile", "frown", "teary"];
        for (const prev of priors) {
            assert.strictEqual(nextExpression(prev, true, 0), "smile");
            assert.strictEqual(nextExpression(prev, false, 1), "frown");
            assert.strictEqual(nextExpression(prev, false, REACTION.wrongStreakTear), "teary");
        }
    });
});
