#!/usr/bin/env node
/**
 * Starts Nearby + a public tunnel so phones work even when WiFi blocks devices.
 * Usage: node scripts/start-with-tunnel.mjs
 */
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import localtunnel from 'localtunnel';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PORT = 3847;
const tunnelFile = join(root, 'tunnel-url.txt');

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`);
      if (res.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error('Server did not start');
}

try {
  unlinkSync(tunnelFile);
} catch {}

console.log('\n  📡 Starting Nearby with phone tunnel...\n');

const server = spawn('node', ['server/index.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit',
});

server.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

try {
  await waitForServer();
  const tunnel = await localtunnel({ port: PORT });
  writeFileSync(tunnelFile, tunnel.url);
  process.env.TUNNEL_URL = tunnel.url;

  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║  PHONE LINK READY (works on any network!)    ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`\n  → ${tunnel.url}\n`);
  console.log('  Open that URL on your phone. Same WiFi NOT required.');
  console.log('  Keep this terminal open.\n');

  tunnel.on('close', () => {
    console.log('  Tunnel closed. Restart ./start-phone.sh');
  });
} catch (err) {
  console.error('  Failed to start tunnel:', err.message);
  console.error('  Try ./start.sh for same-WiFi only.\n');
}

process.on('SIGINT', () => {
  try {
    unlinkSync(tunnelFile);
  } catch {}
  server.kill();
  process.exit();
});
