export function checkAnswer(playerAnswer: string, canonicalAnswer: string): boolean {
    const normalise = (ans: string) => ans.trim().toLowerCase().replace(/\s+/g, " ");
    return normalise(playerAnswer) === normalise(canonicalAnswer);
}