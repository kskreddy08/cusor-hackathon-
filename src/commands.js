import {
  enableRemoteControl,
  disableRemoteControl,
  enqueuePrompt,
  getStateSnapshot,
  recordCommand,
  setMode,
  setModel,
} from "./state.js";

function helpText() {
  return {
    message: "Available commands",
    commands: [
      { cmd: "/remote-control", desc: "Enable remote control session" },
      { cmd: "/stop", desc: "Disable remote control session" },
      { cmd: "/status", desc: "Show connection and agent status" },
      { cmd: "/agent <prompt>", desc: "Send a prompt in Agent mode" },
      { cmd: "/plan <prompt>", desc: "Send a prompt in Plan mode" },
      { cmd: "/mode [agent|plan|ask|debug]", desc: "Show or switch mode" },
      { cmd: "/model [name]", desc: "Show or set model" },
      { cmd: "/history [N]", desc: "Show last N events (default 20)" },
      { cmd: "/help", desc: "Show this help" },
    ],
  };
}

export function parseSlashCommand(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { command: "prompt", args: [trimmed] };
  }

  const match = trimmed.match(/^(\/\S+)(?:\s+(.*))?$/s);
  if (!match) return { command: "/help", args: [] };

  const command = match[1].toLowerCase();
  const rest = (match[2] ?? "").trim();
  const args = rest ? [rest] : [];
  return { command, args };
}

export async function executeCommand(input, { host, port } = {}) {
  const { command, args } = parseSlashCommand(input);

  try {
    let result;

    switch (command) {
      case "/remote-control": {
        const s = enableRemoteControl();
        result = {
          ok: true,
          message: "Remote control enabled",
          dashboardUrl: host ? `http://${host}:${port}` : null,
          state: s,
        };
        break;
      }
      case "/stop": {
        const s = disableRemoteControl();
        result = { ok: true, message: "Remote control disabled", state: s };
        break;
      }
      case "/status": {
        const s = getStateSnapshot();
        result = {
          ok: true,
          remoteControl: s.remoteControlEnabled ? "enabled" : "disabled",
          mode: s.mode,
          model: s.model,
          connectedClients: s.connectedClients,
          queuedPrompts: s.promptQueue.length,
          uptimeSince: s.startedAt,
          lastCommand: s.lastCommand,
        };
        break;
      }
      case "/agent": {
        if (!args[0]) throw new Error("Usage: /agent <prompt>");
        const entry = enqueuePrompt(args[0], "agent");
        result = { ok: true, message: "Prompt queued", entry };
        break;
      }
      case "/plan": {
        if (!args[0]) throw new Error("Usage: /plan <prompt>");
        const entry = enqueuePrompt(args[0], "plan");
        result = { ok: true, message: "Prompt queued", entry };
        break;
      }
      case "/mode": {
        if (!args[0]) {
          result = { ok: true, mode: getStateSnapshot().mode };
        } else {
          const mode = args[0].toLowerCase();
          const s = setMode(mode);
          result = { ok: true, message: `Mode set to ${mode}`, state: s };
        }
        break;
      }
      case "/model": {
        if (!args[0]) {
          result = { ok: true, model: getStateSnapshot().model };
        } else {
          const s = setModel(args[0]);
          result = { ok: true, message: `Model set to ${args[0]}`, state: s };
        }
        break;
      }
      case "/history": {
        const n = args[0] ? parseInt(args[0], 10) : 20;
        const limit = Number.isFinite(n) ? Math.min(n, 100) : 20;
        result = { ok: true, history: getStateSnapshot().history.slice(0, limit) };
        break;
      }
      case "/help":
      default: {
        if (command !== "/help" && command !== "prompt") {
          result = { ok: false, error: `Unknown command: ${command}`, ...helpText() };
        } else if (command === "prompt" && args[0]) {
          const entry = enqueuePrompt(args[0]);
          result = { ok: true, message: "Prompt queued", entry };
        } else {
          result = { ok: true, ...helpText() };
        }
        break;
      }
    }

    recordCommand(command, args, result);
    return { command, args, ...result };
  } catch (err) {
    const result = { ok: false, error: err.message };
    recordCommand(command, args, result);
    return { command, args, ...result };
  }
}
