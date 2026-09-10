import {
    defineServer,
    defineRoom,
    monitor,
    playground,
    createRouter,
} from "colyseus";

/**
 * Import your Room files
 */
import { TriviaRoom } from "./rooms/TriviaRoom.js";

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
    }

});

export default server;