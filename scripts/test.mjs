/**
 * Quick smoke test for Nearby server + socket flows.
 * Run: node scripts/test.mjs  (server must be running)
 */
import { io } from 'socket.io-client';

const BASE = process.env.BASE || 'http://localhost:3847';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
if (!health.ok) fail('health check');

const a = io(BASE, { transports: ['websocket'] });
await new Promise((r, j) => {
  a.on('connect', r);
  a.on('connect_error', j);
  setTimeout(() => j(new Error('timeout')), 5000);
});

let joinedA = false;
a.on('joined', () => { joinedA = true; });
a.emit('join', { roomId: 'test-room', displayName: 'TesterA', roomLabel: 'Test Room' });
await new Promise((r) => setTimeout(r, 500));
if (!joinedA) fail('user A join');

const rooms = await fetch(`${BASE}/api/rooms`).then((r) => r.json());
if (!rooms.rooms.some((x) => x.id === 'test-room')) fail('room not listed');

const b = io(BASE, { transports: ['websocket'] });
await new Promise((r) => b.on('connect', r));
b.emit('join', { roomId: 'test-room', displayName: 'TesterB', roomLabel: 'Test Room' });
await new Promise((r) => setTimeout(r, 500));

let gotMessage = false;
b.on('open-message', (m) => {
  if (m.text === 'hello from test') gotMessage = true;
});
a.emit('open-message', { text: 'hello from test' });
await new Promise((r) => setTimeout(r, 500));
if (!gotMessage) fail('open message not received');

a.disconnect();
b.disconnect();

console.log('PASS: all smoke tests OK');
