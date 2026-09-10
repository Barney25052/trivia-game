export function pickRandomChaser(room: any): string {
    const sessionIds = [...room.state.players.keys()];
    return sessionIds[Math.floor(Math.random() * sessionIds.length)];
}

export function tallyChaserVotes(room: any): string {
    const votes = new Map<string, number>();
    for (const player of room.state.players.values()) {
      if (player.chaserVote !== "") {
        votes.set(player.chaserVote, (votes.get(player.chaserVote) ?? 0) + 1);
      }
    }
    const counted = [...votes.entries()];
    if (counted.length === 0) {
      return pickRandomChaser(room);
    }
    const most = Math.max(...counted.map(([, count]) => count));
    const leaders = counted.filter(([, count]) => count === most).map(([sessionId]) => sessionId);
    return leaders[Math.floor(Math.random() * leaders.length)];
}

export function allPlayersVoted(room: any): boolean {
    if (room.state.players.size === 0) {
      return false;
    }
    for (const player of room.state.players.values()) {
      if (player.chaserVote === "") {
        return false;
      }
    }
    return true;
}

export function allPlayersReady(room: any): boolean {
    if (room.state.players.size === 0) {
      return false;
    }
    for (const player of room.state.players.values()) {
      if (!player.revealReady) {
        return false;
      }
    }
    return true;
}