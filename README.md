# Nearby — Anonymous WiFi Chat

## Phone not working? Use this:

```bash
npm run install:all
chmod +x start-phone.sh
./start-phone.sh
```

It prints a link like `https://xxxx.loca.lt` — **open that on your phone**.  
Works on any network. WiFi/mobile data both fine. No localhost.

---

## Laptop only (same WiFi)

```bash
chmod +x start.sh
./start.sh
```

- Laptop: `http://localhost:3847`
- Phone (same WiFi): `http://192.168.x.x:3847` from terminal

---

## How to know it's working

On the app home screen you should see:
- **App ✓**
- **Live chat ✓**

Both green = working. Create a room on laptop, join on phone.

---

## Test alone (2 tabs)

1. `./start.sh`
2. Two tabs at `http://localhost:3847`
3. Tab 1 create room, Tab 2 join, chat

---

## Verify

```bash
npm test
```
