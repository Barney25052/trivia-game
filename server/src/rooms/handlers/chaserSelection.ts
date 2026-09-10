/* Chaser selection helpers */
export const pickRandomChaser = (players: any): string => {
    const sessionIds = [...players.keys()];
    return sessionIds[Math.floor(Math.random() * sessionIds.length)];
};

export const tallyVotes = (players: any): string => {
    const votes = new Map();
    for (const p of players.values()) {
        if (p.chaserVote) {
            votes.set(p.chaserVote, (votes.get(p.chaserVote) ?? 0) + 1);
        }
    }
    const counted = [...votes.entries()];
    if (counted.length === 0) {
        return pickRandomChaser(players);
    }
    const most = Math.max(...counted.map(([, count]) => count));
    const leaders = counted.filter(([, count]) => count === most).map(([id]) => id);
    return leaders[Math.floor(Math.random() * leaders.length)];
};