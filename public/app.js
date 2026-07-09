const feed = document.getElementById("feed");
const input = document.getElementById("input");
const composer = document.getElementById("composer");
const statusBadge = document.getElementById("status-badge");
const statMode = document.getElementById("stat-mode");
const statModel = document.getElementById("stat-model");
const statClients = document.getElementById("stat-clients");
const statQueue = document.getElementById("stat-queue");
const modeChips = document.getElementById("mode-chips");

let currentMode = "agent";
let ws;
let reconnectTimer;

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    statusBadge.textContent = "connected";
    statusBadge.className = "badge badge-on";
  };

  ws.onclose = () => {
    statusBadge.textContent = "reconnecting";
    statusBadge.className = "badge badge-off";
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 2000);
  };

  ws.onmessage = (ev) => {
    const { event, data } = JSON.parse(ev.data);
    if (event === "state") updateStats(data);
    if (event === "clients") statClients.textContent = data.count;
    if (event === "command") appendEvent("command", data);
    if (event === "prompt") appendEvent("prompt", data);
  };
}

function updateStats(state) {
  statMode.textContent = state.mode;
  statModel.textContent = state.model;
  statClients.textContent = state.connectedClients;
  statQueue.textContent = state.promptQueue?.length ?? 0;
  currentMode = state.mode;
  modeChips.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.mode === state.mode);
  });
  if (state.remoteControlEnabled) {
    statusBadge.textContent = "remote on";
    statusBadge.className = "badge badge-on";
  }
}

function appendEvent(type, data) {
  const empty = feed.querySelector(".feed-empty");
  if (empty) empty.remove();

  const el = document.createElement("article");
  const isErr = data.ok === false || data.error;
  const isRunning = data.status === "running";
  el.className = `event ${isErr ? "err" : isRunning ? "running" : "ok"}`;

  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let body = "";

  if (type === "command") {
    body = data.message ?? data.error ?? JSON.stringify(data, null, 2);
    if (data.entry) body += `\n\nQueued: ${data.entry.prompt}`;
  } else if (type === "prompt") {
    body = data.status === "running"
      ? `Running: ${data.prompt}`
      : data.result?.response ?? `Done: ${data.prompt}`;
  }

  el.innerHTML = `
    <div class="event-meta">
      <span class="event-type">${type}${data.command ? ` ${data.command}` : ""}</span>
      <span class="event-time">${time}</span>
    </div>
    <div class="event-body">${escapeHtml(body)}</div>
  `;
  feed.prepend(el);

  while (feed.children.length > 50) feed.lastChild.remove();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function send(inputStr) {
  const trimmed = inputStr.trim();
  if (!trimmed) return;

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "command", input: trimmed, host: location.hostname }));
  } else {
    fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: trimmed }),
    })
      .then((r) => r.json())
      .then((data) => appendEvent("command", data));
  }

  input.value = "";
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  let cmd = input.value.trim();
  if (cmd && !cmd.startsWith("/")) cmd = `/${currentMode} ${cmd}`;
  send(cmd);
});

document.querySelectorAll("[data-cmd]").forEach((btn) => {
  btn.addEventListener("click", () => send(btn.dataset.cmd));
});

modeChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  send(`/mode ${chip.dataset.mode}`);
});

connect();

const params = new URLSearchParams(location.search);
if (params.get("cmd")) send(params.get("cmd"));
