import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { executeCommand } from "./commands.js";
import {
  getStateSnapshot,
  markPromptDone,
  markPromptRunning,
  setConnectedClients,
} from "./state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "../public")));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const clients = new Set();

function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, at: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function updateClientCount() {
  setConnectedClients(clients.size);
  broadcast("clients", { count: clients.size });
}

wss.on("connection", (ws) => {
  clients.add(ws);
  updateClientCount();
  ws.send(JSON.stringify({ event: "state", data: getStateSnapshot() }));

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ event: "error", data: { error: "Invalid JSON" } }));
      return;
    }

    if (msg.type === "command" && typeof msg.input === "string") {
      const result = await executeCommand(msg.input, {
        host: msg.host ?? "localhost",
        port: PORT,
      });
      broadcast("command", result);

      if (result.entry?.id) {
        processPrompt(result.entry.id, result.entry.prompt, result.entry.mode);
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    updateClientCount();
  });
});

async function processPrompt(id, prompt, mode) {
  markPromptRunning(id);
  broadcast("prompt", { id, status: "running", prompt, mode });

  // Simulated agent response for hackathon demo; swap with real Cursor integration.
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

  const result = {
    summary: `Processed in ${mode} mode`,
    response: `[${mode.toUpperCase()}] Received: "${prompt.slice(0, 200)}${prompt.length > 200 ? "…" : ""}"`,
    note: "Connect to Cursor via CDP or cloud agent API for live execution.",
  };

  const done = markPromptDone(id, result);
  broadcast("prompt", { id, status: "done", ...done });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cursor-remote-control" });
});

app.get("/api/status", (_req, res) => {
  res.json(getStateSnapshot());
});

app.post("/api/command", async (req, res) => {
  const input = req.body?.input ?? req.body?.command;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ ok: false, error: "Missing input string" });
  }

  const hostHeader = req.headers.host?.split(":")[0] ?? "localhost";
  const result = await executeCommand(input, { host: hostHeader, port: PORT });
  broadcast("command", result);

  if (result.entry?.id) {
    processPrompt(result.entry.id, result.entry.prompt, result.entry.mode);
  }

  res.json(result);
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Cursor Remote Control running at http://${HOST}:${PORT}`);
  console.log(`Try: curl -X POST http://localhost:${PORT}/api/command -H 'Content-Type: application/json' -d '{"input":"/remote-control"}'`);
});
