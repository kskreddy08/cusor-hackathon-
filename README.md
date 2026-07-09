# Nearby — Same WiFi Chat

Everyone on the **same WiFi** sees the same rooms. Join or create, then chat.

## Start (one person hosts)

```bash
npm run install:all
chmod +x start.sh
./start.sh
```

`./start-phone.sh` does the same thing (no tunnel).

## Everyone on same WiFi opens

```
http://nearby.local:3847
```

Or the `http://192.168.x.x:3847` address from the terminal.

## What users see

1. List of **live rooms** on this WiFi
2. Tap **Join** on any room
3. Or tap **+ Create a room**
4. Chat in **Open chat**, add friends in **People**, DM in **Messages**

## Do NOT use

- `localhost` on phone
- `loca.lt` / tunnel links (causes bad gateway)
- Vercel / cloud hosting

## Test alone

Two browser tabs at `http://localhost:3847`.
