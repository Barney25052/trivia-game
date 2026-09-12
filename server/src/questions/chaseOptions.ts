import { randomInt } from "node:crypto";
import { McQuestion } from "./opentdb.js";

function shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        [items[i], items[j]] = [items[j], items[i]];
    }
}

/** Narrows a `McQuestion`'s options down to `optionCount` for display — always
 * keeps the correct answer, drops the rest at random, and reshuffles so the
 * correct answer's position in the shown list isn't predictable from the
 * source order. `correctIndex` in the result indexes into the returned
 * `options`, not the original question's. */
export function pickChaseOptions(
    question: McQuestion,
    optionCount: number
): { options: string[]; correctIndex: number } {
    const count = Math.min(Math.max(optionCount, 1), question.options.length);
    const correctAnswer = question.options[question.correctIndex];
    const incorrect = question.options.filter((_, index) => index !== question.correctIndex);
    shuffle(incorrect);
    const options = [correctAnswer, ...incorrect.slice(0, count - 1)];
    shuffle(options);
    return { options, correctIndex: options.indexOf(correctAnswer) };
}
