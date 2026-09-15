import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";

/**
 * Constant-time string comparison via fixed-length SHA-256 digests. Hashing
 * first means both inputs compare as equal-length buffers, so a plain
 * `timingSafeEqual` can be used even when the attacker-supplied string is a
 * different length than the secret — neither the digest length nor an
 * early exit can leak how much of the secret has been guessed.
 */
function timingSafeStringsEqual(a: string, b: string): boolean {
    const digestA = createHash("sha256").update(a, "utf8").digest();
    const digestB = createHash("sha256").update(b, "utf8").digest();
    return timingSafeEqual(digestA, digestB);
}

/**
 * Checks an `Authorization: Basic <base64>` header against expected
 * credentials. Used to gate `/monitor` in production (ticket 131). Returns
 * false (never throws) for any malformed input — missing header, wrong
 * scheme, invalid base64, or a decoded value with no `:` separator.
 */
export function checkBasicAuth(
    authorizationHeader: string | undefined,
    expectedUser: string,
    expectedPass: string
): boolean {
    if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
        return false;
    }
    let decoded: string;
    try {
        decoded = Buffer.from(authorizationHeader.slice("Basic ".length), "base64").toString("utf8");
    } catch {
        return false;
    }
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
        return false;
    }
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    return timingSafeStringsEqual(user, expectedUser) && timingSafeStringsEqual(pass, expectedPass);
}

/**
 * Resolves the `Access-Control-Allow-Origin` value for `/api/questions`
 * (ticket 131): permissive (`*`) outside production, since the Vite dev
 * server's origin varies by machine/port. In production it locks to the
 * configured `CLIENT_ORIGIN`, or `null` when that is unset/blank — callers
 * must omit the header in that case rather than fall back to a wildcard.
 */
export function resolveAllowedOrigin(
    nodeEnv: string | undefined,
    clientOrigin: string | undefined
): string | null {
    if (nodeEnv !== "production") {
        return "*";
    }
    const trimmed = clientOrigin?.trim();
    return trimmed ? trimmed : null;
}

type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Ticket 151 (bug-018): `@colyseus/core`'s own router
 * (`bindRouterToTransport` in `@colyseus/core/build/router/index.mjs`,
 * installed from inside `Server#listen()`) registers a
 * `server.prependListener("request", ...)` that intercepts and fully
 * answers **every** `OPTIONS` request on **any** path before Express (and
 * therefore this app's own `/api/questions` CORS logic in app.config.ts)
 * ever runs. It writes `Access-Control-Allow-Origin: <the request's own
 * Origin> || "*"` unconditionally and calls `res.end()` — bypassing
 * `resolveAllowedOrigin`'s production origin check for exactly the request
 * (the real preflight) that decides whether a browser sends the POST at
 * all. Confirmed live against the installed `@colyseus/core@0.17.49`: with
 * `CLIENT_ORIGIN` configured in production, a preflight from an arbitrary
 * `Origin` still got that origin reflected back.
 *
 * `@colyseus/core` does not expose any config to disable or override this
 * per-route — `matchMaker.controller.getCorsHeaders` can be overwritten,
 * but it receives only headers (no path), so overriding it can't be scoped
 * to `/api/questions` without also changing behavior for `/monitor` and
 * the matchmaking/WebSocket routes, which this ticket must not touch.
 *
 * Node's `http.Server` "request" event invokes *every* registered listener
 * for a given request — there is no DOM-style stopPropagation — so simply
 * adding another listener alongside Colyseus's would not preempt it; both
 * would race to write a response. Instead this removes Colyseus's
 * installed listener and installs a wrapper in its place: `OPTIONS
 * /api/questions` is answered directly, right here, with the same
 * origin-checked headers `allowCrossOrigin` applies to the real response,
 * and never reaches the captured listener. Every other request — including
 * `/monitor` and the WebSocket transport's own upgrade/OPTIONS handling —
 * is passed to that captured listener unchanged.
 *
 * Must be called only after the server is already listening: Colyseus
 * installs its listener inside that same `Server#listen()` call, so
 * calling this any earlier would find nothing to wrap (see app.config.ts,
 * which wraps the exported `Server` instance's `.listen()` so this runs
 * regardless of whether production's `index.ts` or `@colyseus/testing`'s
 * `boot()` — in tests — is what actually calls it).
 */
export function installQuestionsPreflightGuard(server: HttpServer): void {
    const requestListeners = server.listeners("request") as RequestListener[];
    if (requestListeners.length !== 1) {
        // @colyseus/core's listener wiring changed underneath us (version
        // bump, different transport, etc). Fail loudly at boot rather than
        // silently leaving the CORS bypass in place.
        throw new Error(
            `[httpSecurity] Expected exactly one "request" listener on the HTTP server before installing the ` +
            `/api/questions preflight guard (found ${requestListeners.length}). @colyseus/core's ` +
            `bindRouterToTransport() wiring may have changed — re-check it before adjusting this guard.`
        );
    }
    const colyseusListener = requestListeners[0];
    server.removeListener("request", colyseusListener);
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (req.method === "OPTIONS" && pathname === "/api/questions") {
            const origin = resolveAllowedOrigin(process.env.NODE_ENV, process.env.CLIENT_ORIGIN);
            if (origin) {
                res.setHeader("Access-Control-Allow-Origin", origin);
            }
            res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            res.writeHead(204);
            res.end();
            return;
        }
        colyseusListener(req, res);
    });
}
