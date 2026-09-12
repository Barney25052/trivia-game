import {
    defineServer,
    defineRoom,
    monitor,
    playground,
} from "colyseus";
import express from "express";
import { readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Import your Room files
 */
import { TriviaRoom } from "./rooms/TriviaRoom.js";
import { loadBank, QUESTIONS_PATH } from "./questions/bank.js";
import { appendQuestion, validateNewQuestion } from "./questions/bankAdmin.js";

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
        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitoring/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        // Add-question endpoint (ticket 091): the web path into the open-ended
        // bank. Dev-friendly CORS — the Vite client (:5173) posts cross-origin to
        // :2567; production is same-origin once the client is served from here.
        const allowCrossOrigin = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            next();
        };
        app.options("/api/questions", allowCrossOrigin, (_req, res) => {
            res.sendStatus(204);
        });
        app.post("/api/questions", allowCrossOrigin, express.json({ limit: "50kb" }), (req, res) => {
            const result = validateNewQuestion(req.body);
            if (result.ok === false) {
                res.status(400).json({ error: result.error });
                return;
            }
            try {
                const bank = loadBank();
                const { bank: nextBank, question } = appendQuestion(bank, result.value);
                const json = JSON.stringify({ questions: nextBank }, null, 2);
                // The bank file is authored with CRLF line endings — write it
                // back the same way so appending one row does not reformat the
                // whole file. Atomic: write a temp file, then rename over.
                const usesCrlf = readFileSync(QUESTIONS_PATH, "utf8").includes("\r\n");
                const tmpPath = `${QUESTIONS_PATH}.tmp`;
                writeFileSync(tmpPath, usesCrlf ? json.replace(/\n/g, "\r\n") : json, "utf8");
                renameSync(tmpPath, QUESTIONS_PATH);
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
    }

});

export default server;