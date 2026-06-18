const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";
const PUBLIC_DIR = __dirname;

const state = {
  roomCode: "SA-" + Math.floor(1000 + Math.random() * 9000),
  running: false,
  pausedForTurn: false,
  activeId: null,
  lastTick: Date.now(),
  threshold: 10,
  units: [],
  log: [],
};

const clients = new Set();

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function publicState() {
  return {
    roomCode: state.roomCode,
    running: state.running,
    pausedForTurn: state.pausedForTurn,
    activeId: state.activeId,
    threshold: state.threshold,
    units: state.units,
    log: state.log.slice(-30),
  };
}

function pushLog(text) {
  state.log.push({ id: id(), at: new Date().toLocaleTimeString(), text });
  state.log = state.log.slice(-80);
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast() {
  const data = publicState();
  for (const res of clients) sendEvent(res, "state", data);
}

function findReadyUnit() {
  return state.units
    .filter((unit) => unit.atb >= state.threshold)
    .sort((a, b) => b.atb - a.atb || b.speed - a.speed || a.characterName.localeCompare(b.characterName))[0];
}

function pauseForReadyUnit(unit) {
  if (!unit || state.pausedForTurn) return;
  state.pausedForTurn = true;
  state.running = false;
  state.activeId = unit.id;
  unit.atb = state.threshold;
  pushLog(`${unit.characterName} is ready.`);
}

function advanceTicks(ticks = 1) {
  if (state.pausedForTurn) return;
  for (let i = 0; i < ticks; i += 1) {
    for (const unit of state.units) {
      if (unit.atb < state.threshold) {
        unit.atb = Math.min(state.threshold, unit.atb + unit.speed);
      }
    }
    const ready = findReadyUnit();
    if (ready) {
      pauseForReadyUnit(ready);
      break;
    }
  }
}

setInterval(() => {
  if (!state.running || state.pausedForTurn) return;
  const now = Date.now();
  const elapsed = now - state.lastTick;
  if (elapsed < 1000) return;
  const ticks = Math.floor(elapsed / 1000);
  state.lastTick += ticks * 1000;
  advanceTicks(ticks);
  broadcast();
}, 200);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.join(PUBLIC_DIR, filePath);
  if (!absolute.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(absolute, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(absolute), "Cache-Control": "no-store" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleAction(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400);
    res.end("Bad JSON");
    return;
  }

  const action = body.action;
  if (action === "join" || action === "addUnit") {
    const playerName = String(body.playerName || "Player").trim().slice(0, 40);
    const characterName = String(body.characterName || "Character").trim().slice(0, 40);
    const speed = Math.max(1, Math.min(20, Math.floor(Number(body.speed) || 1)));
    const unit = {
      id: id(),
      playerName,
      characterName,
      speed,
      atb: 0,
      controlledBy: body.controlledBy || "player",
    };
    state.units.push(unit);
    pushLog(`${characterName} joined at Speed ${speed}.`);
  }

  if (action === "removeUnit") {
    const unit = state.units.find((entry) => entry.id === body.id);
    state.units = state.units.filter((entry) => entry.id !== body.id);
    if (state.activeId === body.id) {
      state.activeId = null;
      state.pausedForTurn = false;
    }
    if (unit) pushLog(`${unit.characterName} removed.`);
  }

  if (action === "setRunning") {
    state.running = Boolean(body.running) && !state.pausedForTurn;
    state.lastTick = Date.now();
    pushLog(state.running ? "Clock started." : "Clock paused.");
  }

  if (action === "step") {
    advanceTicks(1);
    pushLog("GM advanced one tick.");
  }

  if (action === "reset") {
    for (const unit of state.units) unit.atb = 0;
    state.running = false;
    state.pausedForTurn = false;
    state.activeId = null;
    state.lastTick = Date.now();
    pushLog("Encounter reset.");
  }

  if (action === "completeTurn") {
    const unit = state.units.find((entry) => entry.id === state.activeId);
    if (unit) {
      unit.atb = 0;
      pushLog(`${unit.characterName}'s turn completed.`);
    }
    state.pausedForTurn = false;
    state.activeId = null;
    const ready = findReadyUnit();
    if (ready) pauseForReadyUnit(ready);
  }

  if (action === "nudge") {
    const unit = state.units.find((entry) => entry.id === body.id);
    if (unit && !state.pausedForTurn) {
      unit.atb = Math.min(state.threshold, unit.atb + Math.max(1, Number(body.amount) || 1));
      if (unit.atb >= state.threshold) pauseForReadyUnit(unit);
    }
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(publicState()));
  broadcast();
}

const server = http.createServer((req, res) => {
  if (req.url === "/ping" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Spaceship Architect ATB server is reachable.");
    return;
  }

  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    clients.add(res);
    sendEvent(res, "state", publicState());
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.url === "/api/action" && req.method === "POST") {
    handleAction(req, res);
    return;
  }

  if (req.url === "/api/state" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(publicState()));
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  console.log(`Spaceship Architect ATB multiplayer running`);
  console.log(`Local:   http://127.0.0.1:${PORT}`);
  for (const address of addresses) console.log(`Phone:   http://${address}:${PORT}`);
  console.log(`Room:    ${state.roomCode}`);
});
