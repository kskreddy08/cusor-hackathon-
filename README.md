# Nearby — Anonymous WiFi Chat

Connect with people on the same WiFi. Anonymous names, auto-discovered rooms, open chat, friend requests, and private DMs.

## Quick start

```bash
npm run install:all
npm run dev
```

Or production (single port, best for testing on phones):

```bash
chmod +x start.sh
./start.sh
```

Open `http://localhost:3847` on your laptop. On your phone (same WiFi): `http://<laptop-ip>:3847`

## How it works

1. **Connect** — Open the app on the same network. It detects the local server automatically.
2. **Rooms popup** — Shows how many rooms are live on the network (e.g. "3 rooms live on your network").
3. **Join or create** — Pick an existing room from the list, or tap **+ Create a room**.
4. **Open chat** — Public messages for everyone in the room.
5. **People** — See who's online. Send a **+ Connect** request to add a friend.
6. **Messages** — Private 1:1 chat after they accept.

No QR codes. No manual room URLs. Rooms appear automatically when someone creates them on the network.

## Test with two devices

1. Run `./start.sh` on your laptop
2. Open `http://localhost:3847` in a browser tab
3. Open `http://<laptop-ip>:3847` on your phone (or a second browser tab)
4. On device 1: **Create a room** called "Coffee chat"
5. On device 2: the room shows up in the lobby automatically — tap **Join**
6. Chat in Open chat, send a friend request, accept, then DM

## Stack

- Node.js + Express + Socket.io (in-memory)
- React + Vite
