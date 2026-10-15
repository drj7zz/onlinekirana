 // One command to run the whole stack locally: API :5000, storefront :5173,
// partner portal :5174. Output is prefixed per service, and Ctrl+C stops all three.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const services = [
  { name: 'server  ', cwd: 'server', port: 5000, args: ['run', 'dev'] },
  { name: 'client  ', cwd: 'client', port: 5173, args: ['run', 'dev'] },
  { name: 'partners', cwd: 'partners', port: 5174, args: ['run', 'dev'] },
];

const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
  setTimeout(() => process.exit(code), 200);
}

for (const svc of services) {
  const cwd = path.join(root, svc.cwd);
  if (!existsSync(path.join(cwd, 'node_modules'))) {
    console.error(`[${svc.name.trim()}] node_modules missing — run: npm run install:all`);
    stopAll(1);
    break;
  }
  const child = spawn(npm, svc.args, { cwd, shell: process.platform === 'win32' });
  const write = (stream) => (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim()) stream.write(`[${svc.name}] ${line}\n`);
    }
  };
  child.stdout.on('data', write(process.stdout));
  child.stderr.on('data', write(process.stderr));
  child.on('exit', (code) => {
    console.log(`[${svc.name}] exited with code ${code}`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

console.log('Starting Online Kirana:');
for (const svc of services) console.log(`  ${svc.name.trim()} → http://localhost:${svc.port}`);
console.log('Press Ctrl+C to stop everything.\n');
