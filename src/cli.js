const path = require('node:path');
const { spawnSync } = require('node:child_process');

const helpText = `Usage:
  itm                      Start fan monitor daemon in foreground
  itm start                Start fan monitor daemon in foreground
  itm service-install      Install/enable systemd service
  itm service-uninstall    Disable/remove systemd service
  itm help                 Show this help

Examples:
  itm
  sudo itm service-install
  sudo itm service-uninstall --remove-app-dir
`;

const runScript = (scriptName, args) => {
  const scriptPath = path.resolve(__dirname, '..', 'bin', scriptName);
  const result = spawnSync(scriptPath, args, {
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
};

const run = () => {
  const command = process.argv[2] || 'start';
  const extraArgs = process.argv.slice(3);

  switch (command) {
    case 'start':
      require('./index');
      return;
    case 'service-install':
      runScript('install-systemd.sh', extraArgs);
      return;
    case 'service-uninstall':
      runScript('uninstall-systemd.sh', extraArgs);
      return;
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(helpText);
      return;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${helpText}`);
      process.exit(1);
  }
};

module.exports = {
  run
};
