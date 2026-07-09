# Nearby — Same WiFi Chat

**One universal link. Tap it on any WiFi — see live rooms on that network.**

## How it works

```
1. One person on a WiFi runs ./start.sh (hosts for that network)
2. Share the universal link with everyone on the same WiFi
3. They tap the link → app scans the network → shows live rooms → join or create
4. Different WiFi = different rooms (café ≠ home ≠ office)
```

## The universal link (share everywhere)

**Live now:**

```
https://nearby-chat-weld.vercel.app
```

One URL for the whole world. When someone opens it:

1. A lightweight page loads (hosted in the cloud)
2. It scans **their current WiFi** for a Nearby host
3. Redirects to the local server (`http://192.168.x.x:3847`)
4. They see **only rooms on that WiFi**

No login. No app install. No QR codes.

**Important:** Someone on each WiFi must run `./start.sh` first. The link finds the host automatically — but only on the network where a host is running.

## Start hosting

```bash
npm run install:all
chmod +x start.sh
./start.sh
```

The terminal prints the universal link to copy and share.

### Direct link (same WiFi only)

If mDNS works on your network:

```
http://nearby.local:3847
```

## Deploy the universal link yourself

Host the static client on Vercel, Netlify, or GitHub Pages:

```bash
npm run build:universal
# Deploy client/dist — set UNIVERSAL_LINK env to your deployed URL when running ./start.sh
```

On Vercel, connect this GitHub repo — `vercel.json` is already configured. After deploy, set `UNIVERSAL_LINK` to your Vercel URL when running `./start.sh`.

GitHub Pages deploys automatically on push to `main` via `.github/workflows/deploy-universal.yml`.

## Test

```bash
npm test
npm run test:ui
```
