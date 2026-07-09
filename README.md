# Cursor Remote Control

Mobile-friendly remote control for Cursor agents. Send slash commands from your phone, monitor status in real time, and queue prompts — all through a lightweight web dashboard.

Built for the Cursor hackathon.

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:3847** on your phone (same Wi‑Fi) or desktop.

## Slash commands

| Command | Description |
|---------|-------------|
| `/remote-control` | Enable remote control session |
| `/stop` | Disable remote control |
| `/status` | Connection and agent status |
| `/agent <prompt>` | Queue a prompt in Agent mode |
| `/plan <prompt>` | Queue a prompt in Plan mode |
| `/mode [agent\|plan\|ask\|debug]` | Show or switch mode |
| `/model [name]` | Show or set model |
| `/history [N]` | Last N events (default 20) |
| `/help` | List commands |

## API

**Health check**

```bash
curl http://localhost:3847/api/health
```

**Send a command**

```bash
curl -X POST http://localhost:3847/api/command \
  -H 'Content-Type: application/json' \
  -d '{"input":"/remote-control"}'
```

**Get status**

```bash
curl http://localhost:3847/api/status
```

## Architecture

```
Phone browser ──WebSocket/REST──► Relay server ──► Prompt queue
                                        │
                                        ▼
                              Cursor agent (CDP / cloud API)
```

The relay server handles slash commands, broadcasts state over WebSocket, and queues prompts. The demo simulates agent responses; wire in Cursor CDP (`--remote-debugging-port=9222`) or the cloud agent API for live execution.

## Remote access

- **Same network:** use your machine's LAN IP, e.g. `http://192.168.1.42:3847`
- **Tailscale / VPN:** use the Tailscale hostname
- **Deep link:** `http://localhost:3847/?cmd=/remote-control`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3847` | Server port |
| `HOST` | `0.0.0.0` | Bind address |

## License

MIT
