'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
process.chdir(root);

const port = String(process.env.PORT || 8080);
process.env.PORT = port;
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

const standalone = path.join(root, '.next', 'standalone', 'server.js');
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

let args;
let cwd = root;
if (fs.existsSync(standalone)) {
  args = [standalone];
  cwd = path.dirname(standalone);
} else {
  args = [nextBin, 'start', '-H', '0.0.0.0', '-p', port];
}

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
  cwd,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
