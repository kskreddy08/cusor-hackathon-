# Nearby — Same WiFi Chat

Anonymous chat for **anyone on the same WiFi**. One person hosts, everyone else joins.

## How it works

```
Person A (laptop)  →  runs ./start.sh  →  becomes the host
Person B (phone)   →  opens http://nearby.local:3847  →  sees all rooms
Person C (tablet)  →  same link  →  joins a room  →  chats
```

- **Auto-discovers** the host on your WiFi (scans network)
- **Rooms** show up for everyone automatically
- **Create** or **join** a room, chat openly, add friends, DM privately

## Start (one person hosts)

```bash
npm run install:all
chmod +x start.sh
./start.sh
```

## Everyone else on same WiFi

Open in browser (phone, laptop, tablet):

```
http://nearby.local:3847
```

Or use the IP address printed in the terminal.

**Rules:**
- Same WiFi network
- Do NOT use `localhost` on phones
- Host keeps terminal open

## First time on phone

1. Connect to the **same WiFi**
2. Open Safari/Chrome
3. Type: `http://nearby.local:3847`
4. App scans WiFi → shows rooms → join or create

## Test alone

Two tabs at `http://localhost:3847` — create room in one, join in other.

## Verify

```bash
npm test
```
