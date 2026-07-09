/**
 * Full flow tests for Nearby — run while server is up.
 */
import { io } from 'socket.io-client';

const BASE = process.env.BASE || 'http://localhost:3847';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function connect() {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ['polling', 'websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 8000);
  });
}

function once(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function waitForState(socket, pred, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('state wait timeout')), ms);
    const handler = (s) => {
      if (pred(s)) {
        clearTimeout(t);
        socket.off('state', handler);
        resolve(s);
      }
    };
    socket.on('state', handler);
  });
}

// --- health & rooms API ---
const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
if (!health.ok) fail('health check');

const info = await fetch(`${BASE}/api/info`).then((r) => r.json());
if (!info.lanUrl) fail('api/info missing lanUrl');

// --- user A creates room ---
const a = await connect();
const aJoinPromise = once(a, 'joined');
const aStatePromise = waitForState(a, (s) => s.users.length >= 1);
a.emit('join', { roomId: 'e2e-room', displayName: 'Alice', roomLabel: 'E2E Room' });
const aJoined = await aJoinPromise;
if (!aJoined.userId) fail('A join failed');
await aStatePromise;

const apiRooms = await fetch(`${BASE}/api/rooms`).then((r) => r.json());
const room = apiRooms.rooms.find((r) => r.id === 'e2e-room');
if (!room || room.userCount < 1) fail('room not in API after join');

// --- user B joins ---
const b = await connect();
const bJoinPromise = once(b, 'joined');
const bStatePromise = waitForState(b, (s) => s.users.some((u) => u.displayName === 'Alice'));
b.emit('join', { roomId: 'e2e-room', displayName: 'Bob', roomLabel: 'E2E Room' });
await bJoinPromise;
const bState = await bStatePromise;
if (!bState.users.some((u) => u.displayName === 'Alice')) fail('B cannot see Alice');

// --- open chat ---
let bGotChat = false;
b.on('open-message', (m) => { if (m.text === 'hello e2e') bGotChat = true; });
a.emit('open-message', { text: 'hello e2e' });
await wait(600);
if (!bGotChat) fail('open chat message not received');

// --- friend request + DM ---
const aUser = bState.users.find((u) => u.displayName === 'Alice');
b.emit('friend-request', { toUserId: aUser.id, intro: 'lets chat' });
const aState = await waitForState(a, (s) => s.friendRequests.incoming.length > 0);
if (!aState.friendRequests.incoming.length) fail('friend request not received');

a.emit('friend-respond', { fromUserId: aState.friendRequests.incoming[0].from, accept: true });
await waitForState(b, (s) => s.friends.length > 0);

const bobId = bState.users.find((u) => u.displayName === 'Bob')?.id;
a.emit('dm-message', { toUserId: bobId, text: 'private hi' });
const bState2 = await waitForState(b, (s) => {
  const msgs = s.dms?.[aUser.id] || [];
  return msgs.some((m) => m.text === 'private hi');
});
const dmMsgs = bState2.dms?.[aUser.id] || [];
if (!dmMsgs.some((m) => m.text === 'private hi')) fail('DM not received');

// --- leave room ---
a.emit('leave-room');
await once(a, 'left-room');

a.disconnect();
b.disconnect();

console.log('PASS: full e2e tests OK');
