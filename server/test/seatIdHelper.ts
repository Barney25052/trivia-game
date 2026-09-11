/**
 * Test helper: resolve the room-local seat id for a connected test client.
 * The players map, contestantsOrder, chaserSeatId and activeContestantSeatId
 * are all keyed by seat id (ticket 044); a client's Colyseus sessionId is
 * connection-scoped and never touches game logic.
 */
export function seatIdOf(room: any, client: { sessionId: string }): string {
    const seatId = room.seatIdForSessionId(client.sessionId);
    if (!seatId) {
        throw new Error(`no seat registered for sessionId ${client.sessionId}`);
    }
    return seatId;
}