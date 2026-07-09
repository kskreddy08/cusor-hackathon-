# Nearby — Same WiFi Chat

**One open link. Everyone on the same WiFi sees the same live rooms.**

## How it works

```
1. One person runs ./start.sh (hosts for this WiFi)
2. Share the link: http://nearby.local:3847
3. Anyone on SAME WiFi opens link → sees live rooms → joins or creates
4. Different WiFi = different rooms (isolated per network)
```

## Start hosting

```bash
npm run install:all
chmod +x start.sh
./start.sh
```

## The open link (share on your WiFi)

```
http://nearby.local:3847
```

No login. No app install. Tap link → see rooms → join.

**Important:** This link only shows rooms for **your current WiFi**. People on other networks see their own rooms, not yours.

## Test

```bash
npm test
npm run test:ui
```
