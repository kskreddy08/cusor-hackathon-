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
});

// roomId -> { openMessages: [], users: Map<socketId, user> }
const rooms = new Map();

// userId -> { socketId, roomId, displayName, color }
const usersById = new Map();

// friendship: `${minId}:${maxId}` -> 'pending' | 'accepted' (scoped per room in key)
function friendKey(roomId, a, b) {
  const [x, y] = [a, b].sort();
  return `${roomId}:${x}:${y}`;
}

const friendships = new Map(); // friendKey -> { status, from, to, intro? }
const dmMessages = new Map(); // friendKey -> [{ id, from, text, at }]

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getLocalIPs() {
  const ips = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) ips.push(cfg.address);
    }
  }
  return ips;
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { openMessages: [], users: new Map() });
  }
  return rooms.get(roomId);
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
    if (!key.startsWith(roomId + ':')) continue;
    const parts = key.split(':');
    const a = parts[1];
    const b = parts[2];
    if (rel.status === 'accepted' && (a === userId || b === userId)) {
      const otherId = a === userId ? b : a;
      friends.push(otherId);
    }
  }
  return friends;
}

function getPendingRequests(roomId, userId) {
  const incoming = [];
  const outgoing = [];
  for (const [key, rel] of friendships) {
    if (!key.startsWith(roomId + ':')) continue;
    if (rel.status !== 'pending') continue;
    if (rel.to === userId) incoming.push({ from: rel.from, intro: rel.intro || '' });
    if (rel.from === userId) outgoing.push({ to: rel.to, intro: rel.intro || '' });
  }
  return { incoming, outgoing };
}

function dmKeyFor(roomId, a, b) {
  return friendKey(roomId, a, b);
}

function serializeRoomState(roomId, room, userId) {
  const { incoming, outgoing } = getPendingRequests(roomId, userId);
  const friends = getFriendsForUser(roomId, userId);
  const dms = {};
  for (const fid of friends) {
    const key = dmKeyFor(roomId, userId, fid);
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

function broadcastRoom(roomId, room, event, payload) {
  for (const u of room.users.values()) {
    io.to(u.socketId).emit(event, payload);
  }
}

function emitStateToUser(socket, roomId, room, userId) {
  socket.emit('state', serializeRoomState(roomId, room, userId));
}

io.on('connection', (socket) => {
  let currentUser = null;
  let currentRoomId = null;

  socket.on('join', ({ roomId, displayName }) => {
    if (!roomId || !displayName?.trim()) {
      socket.emit('error', { message: 'Room and display name are required.' });
      return;
    }

    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 32);
    const cleanName = displayName.trim().slice(0, 24);

    if (currentUser) {
      const oldRoom = rooms.get(currentRoomId);
      if (oldRoom) {
        oldRoom.users.delete(socket.id);
        broadcastRoom(currentRoomId, oldRoom, 'user-left', { id: currentUser.id });
        for (const u of oldRoom.users.values()) {
          emitStateToUser(io.sockets.sockets.get(u.socketId), currentRoomId, oldRoom, u.id);
        }
      }
    }

    const room = getOrCreateRoom(cleanRoom);
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

    socket.emit('joined', { userId: user.id, roomId: cleanRoom });

    for (const u of room.users.values()) {
      emitStateToUser(io.sockets.sockets.get(u.socketId), cleanRoom, room, u.id);
    }
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

    broadcastRoom(currentRoomId, room, 'open-message', msg);
  });

  socket.on('friend-request', ({ toUserId, intro }) => {
    if (!currentUser || !toUserId || toUserId === currentUser.id) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const target = Array.from(room.users.values()).find((u) => u.id === toUserId);
    if (!target) return;

    const key = friendKey(currentRoomId, currentUser.id, toUserId);
    const existing = friendships.get(key);
    if (existing?.status === 'accepted') return;
    if (existing?.status === 'pending') return;

    friendships.set(key, {
      status: 'pending',
      from: currentUser.id,
      to: toUserId,
      intro: (intro || '').trim().slice(0, 200),
    });

    for (const u of room.users.values()) {
      emitStateToUser(io.sockets.sockets.get(u.socketId), currentRoomId, room, u.id);
    }
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

    for (const u of room.users.values()) {
      emitStateToUser(io.sockets.sockets.get(u.socketId), currentRoomId, room, u.id);
    }
  });

  socket.on('dm-message', ({ toUserId, text }) => {
    if (!currentUser || !toUserId || !text?.trim()) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const friends = getFriendsForUser(currentRoomId, currentUser.id);
    if (!friends.includes(toUserId)) return;

    const key = dmKeyFor(currentRoomId, currentUser.id, toUserId);
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

    const recipient = usersById.get(toUserId);
    if (recipient?.roomId === currentRoomId) {
      io.to(recipient.socketId).emit('dm-message', { withUserId: currentUser.id, message: msg });
      emitStateToUser(io.sockets.sockets.get(recipient.socketId), currentRoomId, room, toUserId);
    }
    socket.emit('dm-message', { withUserId: toUserId, message: msg });
    emitStateToUser(socket, currentRoomId, room, currentUser.id);
  });

  socket.on('disconnect', () => {
    if (!currentUser || !currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.users.delete(socket.id);
    usersById.delete(currentUser.id);

    room.openMessages.push({
      id: uuidv4(),
      type: 'system',
      text: `${currentUser.displayName} left`,
      at: Date.now(),
    });

    for (const u of room.users.values()) {
      emitStateToUser(io.sockets.sockets.get(u.socketId), currentRoomId, room, u.id);
    }

    if (room.users.size === 0) {
      // Keep room data briefly; clean stale friendships keys optional
    }
  });
});

app.get('/api/info', (_req, res) => {
  res.json({
    port: PORT,
    ips: getLocalIPs(),
    joinUrl: `http://localhost:${PORT}`,
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
  console.log(`\n  Nearby Chat running on port ${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`  Network: http://${ip}:${PORT}`));
  console.log('\n  Share the network URL with anyone on the same WiFi.\n');
});
