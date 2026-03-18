const { spawn } = require('child_process');

process.env.EXPO_OVERRIDE_METRO_CONFIG = './metro.config.js';

const expoBin = require.resolve('expo/bin/cli');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [expoBin, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
