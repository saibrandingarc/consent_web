'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
process.chdir(root);

const port = String(process.env.PORT || 8080);
process.env.PORT = port;
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

function findStandaloneServer(dir) {
  const candidates = [
    path.join(dir, '.next', 'standalone', 'server.js'),
    path.join(dir, '.next', 'standalone', 'consent_web', 'server.js'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  const standaloneDir = path.join(dir, '.next', 'standalone');
  if (!fs.existsSync(standaloneDir)) return null;
  const stack = [standaloneDir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      if (name === 'server.js' && fs.statSync(full).isFile()) return full;
      if (fs.statSync(full).isDirectory() && name !== 'node_modules') stack.push(full);
    }
  }
  return null;
}

const standalone = findStandaloneServer(root);
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const buildId = path.join(root, '.next', 'BUILD_ID');

let args;
let cwd = root;
if (standalone) {
  args = [standalone];
  cwd = path.dirname(standalone);
} else if (fs.existsSync(buildId) && fs.existsSync(nextBin)) {
  args = [nextBin, 'start', '-H', '0.0.0.0', '-p', port];
} else {
  console.error(
    'No production Next build in this folder. Expected .next/standalone/server.js or .next/BUILD_ID. cwd=' +
      root,
  );
  process.exit(1);
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
