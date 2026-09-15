/**
 * Colyseus Cloud Deployment Configuration.
 * See documentation: https://docs.colyseus.io/deployment/cloud
 *
 * This app is single-process (see AGENTS.md): room-cap and other
 * process-local state (ticket 132) only bound one process, so `instances`
 * must stay 1 for self-hosted PM2. Do not restore `os.cpus().length` here
 * without first adding shared presence/driver support (ticket 152).
 */

module.exports = {
  apps : [{
    name: "colyseus-app",
    script: 'build/index.js',
    time: true,
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    wait_ready: true,
  }],
};

