export function pickRandomChaser(room: any): string {
    const seatIds = [...room.state.players.keys()];
    return seatIds[Math.floor(Math.random() * seatIds.length)];
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
    const leaders = counted.filter(([, count]) => count === most).map(([seatId]) => seatId);
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