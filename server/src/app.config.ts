import {
    defineServer,
    defineRoom,
    monitor,
    playground,
} from "colyseus";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Import your Room files
 */
import { TriviaRoom } from "./rooms/TriviaRoom.js";
import { appendQuestion, validateNewQuestion } from "./questions/bankAdmin.js";
import { checkBasicAuth, resolveAllowedOrigin, installQuestionsPreflightGuard } from "./httpSecurity.js";

const server = defineServer({
    /**
     * Define your room handlers:
     */
    rooms: {
        trivia: defineRoom(TriviaRoom)
    },

    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    express: (app) => {
        // Startup warnings (ticket 131): production is expected to configure
        // MONITOR_USER/MONITOR_PASS and CLIENT_ORIGIN. Warn once at boot
        // rather than staying silent — the fail-closed behavior below means
        // a missing var doesn't break anything, but it does mean nobody can
        // reach /monitor or add questions, or that /api/questions rejects
        // every cross-origin browser request, until it's set.
        if (process.env.NODE_ENV === "production") {
            if (!process.env.MONITOR_USER || !process.env.MONITOR_PASS) {
                console.warn(
                    "[app.config] MONITOR_USER/MONITOR_PASS are not both set — " +
                    "/monitor and adding questions will deny every request (503) until both are configured."
                );
            }
            if (!process.env.CLIENT_ORIGIN) {
                console.warn(
                    "[app.config] CLIENT_ORIGIN is not set — /api/questions will omit " +
                    "Access-Control-Allow-Origin, blocking cross-origin browser requests."
                );
            }
        }

        /**
         * The admin login: hand-rolled HTTP Basic Auth in production, for
         * @colyseus/monitor (ticket 131) and for adding questions (ticket
         * 163, so strangers can't write to a public server's bank). Gated
         * on NODE_ENV so local dev stays exactly as it was — no prompt.
         * Credentials come from MONITOR_USER/MONITOR_PASS; if either is
         * unset in production this fails closed (503) instead of leaving
         * the route open. The check reads process.env per request (not
         * once at setup) so it always reflects the current env. One realm
         * for both, so a browser that has logged in to one reuses the
         * login for the other.
         * Read more: https://docs.colyseus.io/tools/monitoring/#restrict-access-to-the-panel-using-a-password
         */
        const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (process.env.NODE_ENV !== "production") {
                next();
                return;
            }
            const adminUser = process.env.MONITOR_USER;
            const adminPass = process.env.MONITOR_PASS;
            if (!adminUser || !adminPass) {
                res.status(503).send("The admin login is not configured");
                return;
            }
            if (checkBasicAuth(req.headers.authorization, adminUser, adminPass)) {
                next();
                return;
            }
            res.setHeader("WWW-Authenticate", 'Basic realm="Trivia Admin"');
            res.status(401).send("Authentication required");
        };
        app.use("/monitor", requireAdminAuth, monitor());

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        // Add-question endpoint (ticket 091): the web path into the open-ended
        // bank, behind the admin login in production (ticket 163). Dev-friendly
        // CORS — the Vite client (:5173) posts cross-origin to :2567;
        // production is same-origin once the client is served from here, but
        // locked to CLIENT_ORIGIN (ticket 131) rather than "*" in case it's
        // ever hit cross-origin, e.g. from a staging client.
        const allowCrossOrigin = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
            const origin = resolveAllowedOrigin(process.env.NODE_ENV, process.env.CLIENT_ORIGIN);
            if (origin) {
                res.setHeader("Access-Control-Allow-Origin", origin);
            } else {
                // Colyseus's own core router sets a default
                // Access-Control-Allow-Origin: * on every request before
                // Express ever sees it (@colyseus/core's
                // bindRouterToTransport, router/index.ts) — not calling
                // setHeader here would silently leave that wildcard in
                // place. Remove it explicitly so an unconfigured
                // CLIENT_ORIGIN in production fails closed for real.
                res.removeHeader("Access-Control-Allow-Origin");
            }
            res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            next();
        };
        app.options("/api/questions", allowCrossOrigin, (_req, res) => {
            res.sendStatus(204);
        });
        app.post("/api/questions", allowCrossOrigin, requireAdminAuth, express.json({ limit: "50kb" }), (req, res) => {
            const result = validateNewQuestion(req.body);
            if (result.ok === false) {
                res.status(400).json({ error: result.error });
                return;
            }
            try {
                const question = appendQuestion(result.value);
                console.log(`Added question ${question.id} to the bank`);
                res.status(201).json({
                    id: question.id,
                    question: question.question,
                    answer: question.answer,
                    alternatives: question.alternatives ?? []
                });
            } catch (err) {
                console.error("Failed to append the question to the bank:", err);
                res.status(500).json({ error: "Failed to persist the question" });
            }
        });

        // Serve the built client (ticket 130): in production this process is
        // the whole deployable — no separate Vite dev server or static host.
        // Dev mode (NODE_ENV !== "production") is untouched; the client keeps
        // running via Vite on :5173. Registered last so it never shadows
        // /monitor or /api/questions above. The path is resolved from this
        // module's own compiled location (not process.cwd(), which PM2 does
        // not guarantee to be server/) so it survives the tsc build step:
        // src/app.config.ts -> build/app.config.js, two levels up from
        // build/ is the repo root, then into client/dist.
        if (process.env.NODE_ENV === "production") {
            const currentDir = path.dirname(fileURLToPath(import.meta.url));
            const clientDistPath = path.join(currentDir, "../../client/dist");
            app.use(express.static(clientDistPath));
            app.get("*", (_req, res) => {
                res.sendFile(path.join(clientDistPath, "index.html"));
            });
        }
    }

});

// Ticket 151 (bug-018): install the OPTIONS /api/questions preflight guard
// (httpSecurity.ts) right after @colyseus/core registers its own permissive
// "request" listener — which happens inside Server#listen() itself, so it
// can't be done any earlier (see installQuestionsPreflightGuard's doc
// comment for the full mechanism). Wrapping this instance's own .listen()
// — rather than only hooking production's src/index.ts — means the guard
// is also installed when @colyseus/testing's boot() calls .listen()
// directly, as it does for every integration test in server/test/.
const originalListen = server.listen.bind(server);
server.listen = async (...args: Parameters<typeof server.listen>) => {
    const result = await originalListen(...args);
    if (server.transport.server) {
        installQuestionsPreflightGuard(server.transport.server);
    }
    return result;
};

export default server;