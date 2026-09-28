  // Boots the build server, waits for it, then hands off to the browser check.
// Usage: node scripts/qa-ui.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const server = spawn('C:\\Program Files\\nodejs\\node.exe', ['scripts\\serveBuild.cjs', '4173'], {
  cwd: process.cwd(),
  stdio: 'ignore',
  detached: false,
});

const cleanup = () => { try { server.kill(); } catch { } };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

// wait for the port to answer
for (let i = 0; i < 30; i += 1) {
  try {
    const r = await fetch('http://127.0.0.1:4173/api/health');
    if (r.ok) break;
  } catch { /* not up yet */ }
  await sleep(300);
}
console.log('build server ready');
await sleep(500);

// hand the port to the browser runner, then clean up on the way out
const url = process.argv[2] || 'http://127.0.0.1:4173/';
const args = [
  'C:\\Users\\girid\\.codegpt\\skills\\browser-automation\\browser.mjs',
  url,
  ...process.argv.slice(3),
];
const browser = spawn('C:\\Program Files\\nodejs\\node.exe', args, { stdio: 'inherit' });
const code = await new Promise((res) => browser.on('exit', res));
cleanup();
process.exit(code ?? 0);
