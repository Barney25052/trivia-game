/**
 * Test helper: resolve with the next `finalQuestion` for one side. Both
 * sides' questions reach every client (tickets 117 and 172), so a listener
 * registered before the Chaser Final would otherwise catch a team question
 * first. Rejects after `rejectTimeout`, like the SDK's `waitForMessage`;
 * `null` never times out, for a listener registered long before its message
 * that a test may never await (a stray rejection would fail a later test).
 */
export function waitForFinalQuestion(
    client: any,
    side: "team" | "chaser",
    rejectTimeout: number | null = 3000
): Promise<any> {
    return new Promise((resolve, reject) => {
        const timeout = rejectTimeout === null ? null : setTimeout(() => {
            unbind();
            reject(new Error(`no '${side}' finalQuestion within ${rejectTimeout}ms`));
        }, rejectTimeout);
        const unbind = client.onMessage("finalQuestion", (message: any) => {
            if (message?.side !== side) {
                return;
            }
            if (timeout !== null) {
                clearTimeout(timeout);
            }
            unbind();
            resolve(message);
        });
    });
}
