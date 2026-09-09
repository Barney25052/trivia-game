import { ColyseusTestServer, boot } from "@colyseus/testing";
import { after } from "mocha";
import appConfig from "../src/app.config.js";

/**
 * Only ONE `@colyseus/testing` `boot()` per mocha process works — a second
 * boot in the same process fails with ERR_HTTP_HEADERS_SENT + "Room
 * connection closed (1006)" because the WS transport resolves rooms through
 * a process-global matchMaker and the HTTP server is already listening.
 *
 * All suites share the single server returned here; a root-level `after()`
 * shuts it down once the whole process finishes.
 */
let serverPromise: Promise<ColyseusTestServer<typeof appConfig>> | undefined;

export function getTestServer(): Promise<ColyseusTestServer<typeof appConfig>> {
  if (!serverPromise) {
    serverPromise = boot(appConfig);
  }
  return serverPromise;
}

export async function cleanup(): Promise<void> {
  const server = await getTestServer();
  await server.cleanup();
}

after(async () => {
  if (serverPromise) {
    const server = await serverPromise;
    await server.shutdown();
  }
});