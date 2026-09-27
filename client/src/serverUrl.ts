// Where the game server is (ticket 162). VITE_SERVER_URL wins when set.
// Otherwise a production build talks to the host that served it — the server
// serves the built client itself (ticket 130) — using wss:// when the page
// came over https://, so it works behind a TLS proxy with no build flags.
// Dev falls back to the local server.
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL
    ?? (import.meta.env.PROD
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
        : "ws://localhost:2567");

/** The same server over HTTP(S), for plain requests: ws → http, wss → https. */
export const API_BASE = SERVER_URL.replace(/^ws/, "http");
