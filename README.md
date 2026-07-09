# Nearby — Anonymous WiFi Chat

## Start (use this every time)

```bash
npm run install:all   # first time only
chmod +x start.sh
./start.sh
```

**Keep the terminal open.**

| Device | URL |
|--------|-----|
| Laptop | `http://localhost:3847` |
| Phone (same WiFi) | `http://192.168.x.x:3847` from terminal output |

**Never use `localhost` on your phone.**

---

## Test on laptop only (2 tabs)

1. Tab 1 → `http://localhost:3847` → **+ Create a room** → "Coffee chat"
2. Tab 2 → same URL → **Join** Coffee chat
3. Tab 1 → Open chat → type "Hello"
4. Tab 2 → People → **+ Connect** → Tab 1 Accept → Messages

---

## Test on phone

1. Run `./start.sh` on laptop
2. Copy the `http://192.168.x.x:3847` URL from terminal (or tap **Copy** in the app)
3. Paste in phone Safari/Chrome — **same WiFi**, mobile data off
4. Join the same room as laptop

### Still broken?

- Use `./start.sh` not `npm run dev` for phone
- Try phone hotspot: laptop + phone on hotspot, run `./start.sh` again
- Mac firewall: allow Node.js incoming connections
- Some café WiFi blocks device-to-device traffic

---

## Verify server works

```bash
node scripts/test.mjs
```

Should print: `PASS: all smoke tests OK`
