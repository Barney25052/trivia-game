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
import { checkBasicAuth } from "./httpSecurity.js";

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
        // Startup warning (ticket 131): production is expected to configure
        // MONITOR_USER/MONITOR_PASS. Warn once at boot rather than staying
        // silent — the fail-closed behavior below means a missing var
        // doesn't break the game, but nobody can reach /monitor until both
        // are set.
        if (process.env.NODE_ENV === "production") {
            if (!process.env.MONITOR_USER || !process.env.MONITOR_PASS) {
                console.warn(
                    "[app.config] MONITOR_USER/MONITOR_PASS are not both set — " +
                    "/monitor will deny every request (503) until both are configured."
                );
            }
        }

        /**
         * The admin login: hand-rolled HTTP Basic Auth in production, for
         * @colyseus/monitor (ticket 131). Gated on NODE_ENV so local dev
         * stays exactly as it was — no prompt. Credentials come from
         * MONITOR_USER/MONITOR_PASS; if either is unset in production this
         * fails closed (503) instead of leaving the route open. The check
         * reads process.env per request (not once at setup) so it always
         * reflects the current env.
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

        // Serve the built client (ticket 130): in production this process is
        // the whole deployable — no separate Vite dev server or static host.
        // Dev mode (NODE_ENV !== "production") is untouched; the client keeps
        // running via Vite on :5173. Registered last so it never shadows
        // /monitor above. The path is resolved from this
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

export default server;