const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3847;
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const rooms = new Map();
const usersById = new Map();
const friendships = new Map();
const dmMessages = new Map();

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function isIPv4(cfg) {
  return cfg.family === 'IPv4' || cfg.family === 4;
}

function isPrivateIP(ip) {
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    return second >= 16 && second <= 31;
  }
  return false;
}

function getLocalIPs() {
  const ips = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const cfg of iface) {
      if (isIPv4(cfg) && !cfg.internal) ips.push(cfg.address);
    }
  }
  return ips.sort((a, b) => {
    const score = (ip) => (isPrivateIP(ip) ? 0 : 1);
    return score(a) - score(b);
  });
}

function getOrCreateRoom(roomId, displayName) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      displayName: displayName || roomId,
      openMessages: [],
      users: new Map(),
      createdAt: Date.now(),
    });
  } else if (displayName) {
    const room = rooms.get(roomId);
    room.displayName = displayName;
  }
  return rooms.get(roomId);
}

function listRooms() {
  const now = Date.now();
  return Array.from(rooms.values())
    .filter((r) => r.users.size > 0 || now - r.createdAt < 60 * 60 * 1000)
    .map((r) => ({
      id: r.id,
      name: r.displayName,
      userCount: r.users.size,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.userCount - a.userCount || b.createdAt - a.createdAt);
}

function broadcastRoomsList() {
  const list = listRooms();
  io.emit('rooms-list', { rooms: list, count: list.length });
}

function friendKey(roomId, a, b) {
  const [x, y] = [a, b].sort();
  return `${roomId}::${x}::${y}`;
}

function parseFriendKey(key) {
  const parts = key.split('::');
  return { roomId: parts[0], a: parts[1], b: parts[2] };
}

function roomUserList(room) {
  return Array.from(room.users.values()).map((u) => ({
    id: u.id,
    displayName: u.displayName,
    color: u.color,
  }));
}

function getFriendsForUser(roomId, userId) {
  const friends = [];
  for (const [key, rel] of friendships) {
    const parsed = parseFriendKey(key);
    if (parsed.roomId !== roomId) continue;
    if (rel.status === 'accepted' && (parsed.a === userId || parsed.b === userId)) {
      friends.push(parsed.a === userId ? parsed.b : parsed.a);
    }
  }
  return friends;
}

function getPendingRequests(roomId, userId) {
  const incoming = [];
  const outgoing = [];
  for (const [key, rel] of friendships) {
    const parsed = parseFriendKey(key);
    if (parsed.roomId !== roomId || rel.status !== 'pending') continue;
    if (rel.to === userId) incoming.push({ from: rel.from, intro: rel.intro || '' });
    if (rel.from === userId) outgoing.push({ to: rel.to, intro: rel.intro || '' });
  }
  return { incoming, outgoing };
}

function serializeRoomState(roomId, room, userId) {
  const { incoming, outgoing } = getPendingRequests(roomId, userId);
  const friends = getFriendsForUser(roomId, userId);
  const dms = {};
  for (const fid of friends) {
    const key = friendKey(roomId, userId, fid);
    dms[fid] = dmMessages.get(key) || [];
  }
  return {
    users: roomUserList(room),
    openMessages: room.openMessages.slice(-100),
    friends,
    friendRequests: { incoming, outgoing },
    dms,
  };
}

function emitStateToUser(socket, roomId, room, userId) {
  if (socket) socket.emit('state', serializeRoomState(roomId, room, userId));
}

function syncRoom(roomId, room) {
  for (const u of room.users.values()) {
    emitStateToUser(io.sockets.sockets.get(u.socketId), roomId, room, u.id);
  }
}

function leaveCurrentRoom(socket, user, roomId) {
  const room = rooms.get(roomId);
  if (!room || !user) return;

  room.users.delete(socket.id);
  usersById.delete(user.id);

  room.openMessages.push({
    id: uuidv4(),
    type: 'system',
    text: `${user.displayName} left`,
    at: Date.now(),
  });

  socket.leave(roomId);
  syncRoom(roomId, room);
  broadcastRoomsList();
}

io.on('connection', (socket) => {
  let currentUser = null;
  let currentRoomId = null;

  socket.emit('rooms-list', { rooms: listRooms(), count: listRooms().length });

  socket.on('join', ({ roomId, displayName, roomLabel }) => {
    if (!roomId || !displayName?.trim()) {
      socket.emit('error', { message: 'Room and display name are required.' });
      return;
    }

    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 32);
    const cleanName = displayName.trim().slice(0, 24);
    const label = (roomLabel || roomId).trim().slice(0, 32);

    if (currentUser && currentRoomId) {
      leaveCurrentRoom(socket, currentUser, currentRoomId);
      currentUser = null;
      currentRoomId = null;
    }

    const room = getOrCreateRoom(cleanRoom, label);
    const user = {
      id: uuidv4(),
      socketId: socket.id,
      displayName: cleanName,
      color: pickColor(),
      joinedAt: Date.now(),
    };

    currentUser = user;
    currentRoomId = cleanRoom;
    room.users.set(socket.id, user);
    usersById.set(user.id, { socketId: socket.id, roomId: cleanRoom, ...user });

    socket.join(cleanRoom);

    room.openMessages.push({
      id: uuidv4(),
      type: 'system',
      text: `${cleanName} joined the room`,
      at: Date.now(),
    });

    socket.emit('joined', { userId: user.id, roomId: cleanRoom, roomName: label });
    syncRoom(cleanRoom, room);
    broadcastRoomsList();
  });

  socket.on('leave-room', () => {
    if (!currentUser || !currentRoomId) return;
    leaveCurrentRoom(socket, currentUser, currentRoomId);
    currentUser = null;
    currentRoomId = null;
    socket.emit('left-room');
    socket.emit('rooms-list', { rooms: listRooms(), count: listRooms().length });
  });

  socket.on('open-message', ({ text }) => {
    if (!currentUser || !text?.trim()) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const msg = {
      id: uuidv4(),
      type: 'chat',
      from: currentUser.id,
      fromName: currentUser.displayName,
      color: currentUser.color,
      text: text.trim().slice(0, 500),
      at: Date.now(),
    };
    room.openMessages.push(msg);
    if (room.openMessages.length > 200) room.openMessages.shift();

    io.to(currentRoomId).emit('open-message', msg);
  });

  socket.on('friend-request', ({ toUserId, intro }) => {
    if (!currentUser || !toUserId || toUserId === currentUser.id) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const target = Array.from(room.users.values()).find((u) => u.id === toUserId);
    if (!target) return;

    const key = friendKey(currentRoomId, currentUser.id, toUserId);
    const existing = friendships.get(key);
    if (existing?.status === 'accepted' || existing?.status === 'pending') return;

    friendships.set(key, {
      status: 'pending',
      from: currentUser.id,
      to: toUserId,
      intro: (intro || '').trim().slice(0, 200),
    });

    syncRoom(currentRoomId, room);
  });

  socket.on('friend-respond', ({ fromUserId, accept }) => {
    if (!currentUser || !fromUserId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const key = friendKey(currentRoomId, currentUser.id, fromUserId);
    const rel = friendships.get(key);
    if (!rel || rel.status !== 'pending' || rel.to !== currentUser.id) return;

    if (accept) {
      rel.status = 'accepted';
      friendships.set(key, rel);
      if (!dmMessages.has(key)) dmMessages.set(key, []);
    } else {
      friendships.delete(key);
    }

    syncRoom(currentRoomId, room);
  });

  socket.on('dm-message', ({ toUserId, text }) => {
    if (!currentUser || !toUserId || !text?.trim()) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const friends = getFriendsForUser(currentRoomId, currentUser.id);
    if (!friends.includes(toUserId)) return;

    const key = friendKey(currentRoomId, currentUser.id, toUserId);
    const msg = {
      id: uuidv4(),
      from: currentUser.id,
      text: text.trim().slice(0, 500),
      at: Date.now(),
    };
    if (!dmMessages.has(key)) dmMessages.set(key, []);
    const list = dmMessages.get(key);
    list.push(msg);
    if (list.length > 200) list.shift();

    syncRoom(currentRoomId, room);
  });

  socket.on('disconnect', () => {
    if (!currentUser || !currentRoomId) return;
    leaveCurrentRoom(socket, currentUser, currentRoomId);
    currentUser = null;
    currentRoomId = null;
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: listRooms().length });
});

app.get('/api/rooms', (_req, res) => {
  const roomsList = listRooms();
  res.json({ rooms: roomsList, count: roomsList.length });
});

app.get('/api/info', (_req, res) => {
  const ips = getLocalIPs();
  const phoneUrls = ips.map((ip) => `http://${ip}:${PORT}`);
  res.json({
    port: PORT,
    ips,
    phoneUrls,
    joinUrl: `http://localhost:${PORT}`,
    phoneHint: phoneUrls[0]
      ? `On your phone (same WiFi), open: ${phoneUrls[0]}`
      : 'Connect phone to the same WiFi, then use your laptop IP with port 3847',
  });
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║  Nearby is running!                          ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');
  console.log(`  LAPTOP (this computer):  http://localhost:${PORT}`);
  if (ips.length) {
    console.log('\n  PHONE (same WiFi) — type this in Safari/Chrome:');
    ips.forEach((ip) => console.log(`  → http://${ip}:${PORT}`));
  } else {
    console.log('\n  PHONE: could not detect WiFi IP automatically.');
    console.log('  Mac: System Settings → Wi-Fi → Details → IP Address');
    console.log('  Windows: cmd → ipconfig → IPv4 Address');
    console.log(`  Then open: http://YOUR-IP:${PORT}`);
  }
  console.log('\n  ⚠  Do NOT use "localhost" on your phone.');
  console.log('  ⚠  Use ./start.sh (not npm run dev) for phone testing.');
  console.log('  Keep this terminal open.\n');
});
