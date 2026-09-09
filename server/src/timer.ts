export interface TimerRoom {
    clock: {
        setTimeout(handler: () => void, time: number): { clear(): void };
    };
}

export interface TimerHandle {
    cancel(): void;
}

/**
 * Schedule a server-authoritative callback using the room's clock.
 *
 * Stick the callback on the Colyseus room clock so it is automatically
 * cleared when the room disposes (Colyseus clears `room.clock` during
 * disposal), and give callers a handle to cancel it early. The internal
 * `cancelled` guard makes a fired callback idempotent against a racing
 * `cancel()`.
 */
export function scheduleTimer(room: TimerRoom, delayMs: number, onFire: () => void): TimerHandle {
    let cancelled = false;

    const delayed = room.clock.setTimeout(() => {
        if (!cancelled) {
            onFire();
        }
    }, delayMs);

    return {
        cancel: () => {
            cancelled = true;
            delayed.clear();
        }
    };
}