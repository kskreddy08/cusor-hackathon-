# Nearby — Anonymous WiFi Chat

Connect with people on the same WiFi. Anonymous names, open room chat, friend requests, and private DMs.

## Quick start (3 minutes)

```bash
npm run install:all
npm run dev
```

- **Server** runs on `http://0.0.0.0:3847`
- **Client** runs on `http://localhost:5173` (proxies to server)

Open the client on your laptop, then on your phone (same WiFi) open:

```
http://<your-laptop-ip>:5173
```

Use the **same room name** on every device (e.g. `cafe-wifi`).

## Production (single port)

```bash
npm run install:all
npm run build
npm start
```

Everything runs on port **3847**. Share `http://<your-ip>:3847` with anyone on the network.

## How it works

1. **Join** — Pick a room name (your WiFi / venue) and an anonymous display name.
2. **Open chat** — Public messages visible to everyone in the room.
3. **People** — See who's online. Tap **+ Connect** to send a friend request (optional intro).
4. **Messages** — After they accept, private 1:1 chat unlocks.

## Same WiFi notes

- One device should run the server (`npm run dev` or `npm start`).
- Everyone connects to that machine's **local IP** on the same network.
- Some guest/café WiFi blocks device-to-device traffic (AP isolation). If that happens, use a phone hotspot instead.

## Stack

- **Server:** Node.js, Express, Socket.io
- **Client:** React, Vite

No accounts, no database — session data lives in memory (resets when server restarts).
