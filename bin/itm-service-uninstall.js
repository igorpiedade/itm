#!/usr/bin/env node

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptPath = path.resolve(__dirname, 'uninstall-systemd.sh');
const result = spawnSync(scriptPath, process.argv.slice(2), {
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
