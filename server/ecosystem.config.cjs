/**
 * Colyseus Cloud Deployment Configuration.
 * See documentation: https://docs.colyseus.io/deployment/cloud
 *
 * This app is single-process (see AGENTS.md): room-cap and other
 * process-local state (ticket 132) only bound one process, so `instances`
 * must stay 1 for self-hosted PM2. Do not restore `os.cpus().length` here
 * without first adding shared presence/driver support (ticket 152).
 *
 * This config only ever runs the production build, so it sets NODE_ENV
 * itself (ticket 166): without it the server would run in dev mode — the
 * playground exposed, no admin login, the client not served. `cwd` is this
 * directory so @colyseus/tools finds `server/.env.production` (gitignored),
 * where MONITOR_USER/MONITOR_PASS and the other secrets go.
 */

module.exports = {
  apps : [{
    name: "colyseus-app",
    script: 'build/index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: "production",
    },
    time: true,
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    wait_ready: true,
  }],
};

