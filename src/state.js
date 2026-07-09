const state = {
  remoteControlEnabled: false,
  mode: "agent",
  model: "default",
  connectedClients: 0,
  lastCommand: null,
  promptQueue: [],
  history: [],
  startedAt: null,
};

export function getStateSnapshot() {
  return {
    remoteControlEnabled: state.remoteControlEnabled,
    mode: state.mode,
    model: state.model,
    connectedClients: state.connectedClients,
    lastCommand: state.lastCommand,
    promptQueue: state.promptQueue.map(({ id, prompt, mode, status, createdAt }) => ({
      id,
      prompt,
      mode,
      status,
      createdAt,
    })),
    history: state.history.slice(0, 20),
    startedAt: state.startedAt,
  };
}

export function enableRemoteControl() {
  state.remoteControlEnabled = true;
  state.startedAt = state.startedAt ?? new Date().toISOString();
  return getStateSnapshot();
}

export function disableRemoteControl() {
  state.remoteControlEnabled = false;
  return getStateSnapshot();
}

export function setMode(mode) {
  const allowed = ["agent", "plan", "ask", "debug"];
  if (!allowed.includes(mode)) {
    throw new Error(`Invalid mode. Use one of: ${allowed.join(", ")}`);
  }
  state.mode = mode;
  return getStateSnapshot();
}

export function setModel(model) {
  state.model = model;
  return getStateSnapshot();
}

export function enqueuePrompt(prompt, mode = state.mode) {
  const entry = {
    id: crypto.randomUUID(),
    prompt,
    mode,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  state.promptQueue.push(entry);
  state.history.unshift({ type: "prompt", ...entry });
  if (state.history.length > 100) state.history.pop();
  return entry;
}

export function markPromptRunning(id) {
  const entry = state.promptQueue.find((p) => p.id === id);
  if (entry) entry.status = "running";
  return entry;
}

export function markPromptDone(id, result) {
  const idx = state.promptQueue.findIndex((p) => p.id === id);
  if (idx !== -1) {
    const entry = state.promptQueue[idx];
    entry.status = "done";
    entry.result = result;
    entry.completedAt = new Date().toISOString();
    state.promptQueue.splice(idx, 1);
    state.history.unshift({ type: "result", ...entry });
    if (state.history.length > 100) state.history.pop();
    return entry;
  }
  return null;
}

export function recordCommand(command, args, result) {
  const safeResult = result
    ? {
        ok: result.ok,
        message: result.message,
        error: result.error,
        mode: result.mode,
        model: result.model,
        entry: result.entry,
      }
    : null;
  state.lastCommand = {
    command,
    args,
    result: safeResult,
    at: new Date().toISOString(),
  };
  state.history.unshift({ type: "command", ...state.lastCommand });
  if (state.history.length > 100) state.history.pop();
  return state.lastCommand;
}

export function setConnectedClients(count) {
  state.connectedClients = count;
}
