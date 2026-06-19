const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";
const PUBLIC_DIR = __dirname;

const rooms = new Map();
const clients = new Map();

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function createRoom() {
  let code = roomCode();
  while (rooms.has(code)) code = roomCode();
  const room = {
    roomCode: code,
    running: false,
    pausedForTurn: false,
    resumeAfterTurn: false,
    activeId: null,
    activeSource: null,
    commandDeadline: null,
    commandTotal: 0,
    commandExpired: false,
    holdPaused: false,
    holdStartedAt: null,
    commandHeldRemaining: null,
    lastInterruptedId: null,
    lastInterruptedAt: 0,
    lastTick: Date.now(),
    threshold: 100,
    units: [],
    log: [],
  };
  rooms.set(code, room);
  clients.set(code, new Set());
  pushLog(room, `Room ${code} created.`);
  return room;
}

function getRoom(code) {
  return rooms.get(String(code || "").trim().toUpperCase());
}

function publicState(room) {
  const command = commandState(room);
  return {
    roomCode: room.roomCode,
    running: room.running,
    pausedForTurn: room.pausedForTurn,
    activeId: room.activeId,
    activeSource: room.activeSource,
    command,
    holdPaused: room.holdPaused,
    lastInterruptedId: room.lastInterruptedId,
    lastInterruptedAt: room.lastInterruptedAt,
    threshold: room.threshold,
    units: room.units,
    log: room.log.slice(-30),
  };
}

function pushLog(room, text) {
  room.log.push({ id: id(), at: new Date().toLocaleTimeString(), text });
  room.log = room.log.slice(-80);
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  const data = publicState(room);
  for (const res of clients.get(room.roomCode) || []) sendEvent(res, "state", data);
}

function normalizeSpeed(value) {
  if (value === null || value === undefined || value === "") return null;
  return Math.max(1, Math.min(100, Number(value) || 1));
}

function normalizeCommandWindow(value) {
  if (value === null || value === undefined || value === "") return null;
  return Math.max(1, Math.min(999, Math.round(Number(value) || 1)));
}

function normalizeTeam(value) {
  return value === "pc" ? "pc" : "npc";
}

function normalizeActorType(value) {
  return value === "ship" ? "ship" : "character";
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#39e58f";
}

function needsSetup(unit) {
  return !unit.speed || (unit.team === "pc" && unit.actorType === "character" && !unit.commandWindow);
}

function canStartClock(room) {
  return room.units.length > 0 && !room.units.some(needsSetup);
}

function tieCompare(a, b) {
  if (a.actorType !== b.actorType) return a.actorType === "character" ? -1 : 1;
  if (a.actorType === "character" && a.team !== b.team) return a.team === "pc" ? -1 : 1;
  if ((a.speed || 0) !== (b.speed || 0)) return (b.speed || 0) - (a.speed || 0);
  return a.tieSeed - b.tieSeed;
}

function findReadyUnit(room, excludeId = null) {
  return room.units.filter((unit) => unit.id !== excludeId && unit.atb >= room.threshold).sort((a, b) => tieCompare(a, b))[0];
}

function nextTurnSource(room, previousSource = null) {
  if (room.resumeAfterTurn) return "clock";
  if (previousSource === "step") return "step";
  return "manual";
}

function commandState(room) {
  if (!room.activeId || !room.commandTotal) return null;
  const remaining = room.holdPaused && room.commandHeldRemaining !== null
    ? room.commandHeldRemaining
    : room.commandExpired || !room.commandDeadline
    ? 0
    : Math.max(0, (room.commandDeadline - Date.now()) / 1000);
  return {
    unitId: room.activeId,
    total: room.commandTotal,
    remaining,
    expired: room.commandExpired,
  };
}

function clearActiveCommand(room) {
  room.activeSource = null;
  room.commandDeadline = null;
  room.commandTotal = 0;
  room.commandExpired = false;
  room.holdPaused = false;
  room.holdStartedAt = null;
  room.commandHeldRemaining = null;
}

function usesCommandWindow(unit, source) {
  return source === "clock" && unit?.team === "pc" && unit?.actorType === "character" && unit?.commandWindow;
}

function pauseForReadyUnit(room, unit, source = "clock") {
  if (!unit || room.pausedForTurn) return;
  room.pausedForTurn = true;
  room.running = false;
  room.activeId = unit.id;
  room.activeSource = source;
  room.commandExpired = false;
  room.holdPaused = false;
  room.holdStartedAt = null;
  if (usesCommandWindow(unit, source)) {
    room.commandTotal = unit.commandWindow;
    room.commandDeadline = Date.now() + unit.commandWindow * 1000;
  } else {
    room.commandTotal = 0;
    room.commandDeadline = null;
  }
  pushLog(room, `${unit.characterName} is ready.`);
}

function interruptActiveTurn(room) {
  const interrupted = room.units.find((unit) => unit.id === room.activeId);
  if (interrupted) {
    interrupted.atb = Math.max(0, interrupted.atb - room.threshold);
    room.lastInterruptedId = interrupted.id;
    room.lastInterruptedAt = Date.now();
    pushLog(room, `${interrupted.characterName}'s turn was interrupted.`);
  }
  room.activeId = null;
  room.pausedForTurn = false;
  clearActiveCommand(room);
}

function moveToNextTurnOrClock(room, previousSource = null) {
  const ready = findReadyUnit(room);
  if (ready) {
    pauseForReadyUnit(room, ready, nextTurnSource(room, previousSource));
  } else if (room.resumeAfterTurn && canStartClock(room)) {
    room.running = true;
    room.lastTick = Date.now();
  } else {
    room.running = false;
    room.lastTick = Date.now();
  }
}

function addProgress(room, seconds, { slow = false, skipId = null } = {}) {
  const multiplier = slow ? 0.2 : 1;
  for (const unit of room.units) {
    if (unit.id === skipId || !unit.speed) continue;
    if (unit.atb < room.threshold) unit.atb += unit.speed * seconds * multiplier;
  }
}

function advanceSeconds(room, seconds = 1, { exact = false, source = "clock" } = {}) {
  if (room.pausedForTurn || room.holdPaused) return;

  const interruptedId = room.commandExpired ? room.activeId : null;

  if (!exact) {
    addProgress(room, seconds, { slow: Boolean(interruptedId), skipId: interruptedId });
    const ready = findReadyUnit(room, interruptedId);
    if (ready) {
      if (interruptedId) interruptActiveTurn(room);
      pauseForReadyUnit(room, ready, source);
    }
    return;
  }

  const alreadyReady = findReadyUnit(room, interruptedId);
  if (alreadyReady) {
    if (interruptedId) interruptActiveTurn(room);
    pauseForReadyUnit(room, alreadyReady, source);
    return;
  }

  const times = room.units
    .filter((unit) => unit.speed > 0 && unit.id !== interruptedId)
    .map((unit) => Math.max(0, (room.threshold - unit.atb) / (unit.speed * (interruptedId ? 0.2 : 1))));
  if (!times.length) return;

  const nextReadyIn = Math.min(...times);
  if (nextReadyIn <= seconds) {
    addProgress(room, nextReadyIn, { slow: Boolean(interruptedId), skipId: interruptedId });
    if (interruptedId) interruptActiveTurn(room);
    pauseForReadyUnit(room, findReadyUnit(room), source);
  } else {
    addProgress(room, seconds, { slow: Boolean(interruptedId), skipId: interruptedId });
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.pausedForTurn && room.commandDeadline && !room.holdPaused) {
      if (Date.now() >= room.commandDeadline) {
        const unit = room.units.find((entry) => entry.id === room.activeId);
        room.pausedForTurn = false;
        room.running = true;
        room.commandExpired = true;
        room.commandDeadline = null;
        room.lastTick = Date.now();
        if (unit) pushLog(room, `${unit.characterName}'s Command Window expired.`);
      }
      broadcast(room);
      continue;
    }
    if (!room.running || room.pausedForTurn || room.holdPaused) continue;
    const now = Date.now();
    const elapsed = now - room.lastTick;
    if (elapsed < 80) continue;
    room.lastTick = now;
    advanceSeconds(room, elapsed / 1000, { exact: true, source: "clock" });
    broadcast(room);
  }
}, 100);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
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

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleCreateRoom(req, res) {
  try {
    await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Bad JSON" });
    return;
  }
  const room = createRoom();
  sendJson(res, 200, publicState(room));
  broadcast(room);
}

async function handleAction(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Bad JSON" });
    return;
  }

  const room = getRoom(body.roomCode);
  if (!room) {
    sendJson(res, 404, { error: "Room not found" });
    return;
  }

  const action = body.action;
  if (action === "join" || action === "addUnit") {
    const playerName = String(body.playerName || "Player").trim().slice(0, 40);
    const characterName = String(body.characterName || "Character").trim().slice(0, 40);
    const speed = normalizeSpeed(body.speed);
    const commandWindow = normalizeCommandWindow(body.commandWindow);
    const unit = {
      id: id(),
      playerName,
      characterName,
      speed,
      commandWindow,
      atb: 0,
      controlledBy: body.controlledBy || "player",
      team: normalizeTeam(body.team || (body.controlledBy === "player" ? "pc" : "npc")),
      actorType: normalizeActorType(body.actorType),
      color: normalizeColor(body.color),
      tieSeed: Math.random(),
    };
    room.units.push(unit);
    const setupText = needsSetup(unit) ? "awaiting GM setup" : `Speed ${speed}`;
    pushLog(room, `${characterName} joined (${setupText}).`);
  }

  if (action === "removeUnit") {
    const unit = room.units.find((entry) => entry.id === body.id);
    const wasActive = room.activeId === body.id;
    const previousSource = room.activeSource;
    room.units = room.units.filter((entry) => entry.id !== body.id);
    if (wasActive) {
      room.activeId = null;
      room.pausedForTurn = false;
      clearActiveCommand(room);
      moveToNextTurnOrClock(room, previousSource);
    }
    if (unit) pushLog(room, `${unit.characterName} removed from combat.`);
  }

  if (action === "setRunning") {
    const wantsRunning = Boolean(body.running);
    if (room.pausedForTurn && room.commandDeadline) {
      if (!room.holdPaused) {
        room.holdPaused = true;
        room.holdStartedAt = Date.now();
        room.commandHeldRemaining = Math.max(0, (room.commandDeadline - Date.now()) / 1000);
        pushLog(room, "All timers paused.");
      } else if (wantsRunning) {
        room.commandDeadline = Date.now() + Math.max(0, room.commandHeldRemaining || 0) * 1000;
        room.holdPaused = false;
        room.holdStartedAt = null;
        room.commandHeldRemaining = null;
        pushLog(room, "All timers resumed.");
      }
    } else if (room.pausedForTurn && room.activeId) {
      room.holdPaused = !room.holdPaused;
      room.holdStartedAt = room.holdPaused ? Date.now() : null;
      pushLog(room, room.holdPaused ? "All timers paused." : "All timers resumed.");
    } else if (wantsRunning && !room.pausedForTurn) {
      if (!canStartClock(room)) {
        pushLog(room, "Clock cannot start until every participant has GM-entered values.");
      } else {
        room.running = true;
        room.resumeAfterTurn = true;
        pushLog(room, "Clock started.");
      }
    } else {
      room.running = false;
      room.resumeAfterTurn = false;
      room.holdPaused = false;
      room.holdStartedAt = null;
      room.commandHeldRemaining = null;
      pushLog(room, "Clock paused.");
    }
    room.lastTick = Date.now();
  }

  if (action === "setSpeed") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      const oldSpeed = unit.speed;
      unit.speed = normalizeSpeed(body.speed);
      pushLog(room, `${unit.characterName}'s Speed changed from ${oldSpeed} to ${unit.speed}.`);
    }
  }

  if (action === "setCommandWindow") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      const oldWindow = unit.commandWindow;
      unit.commandWindow = normalizeCommandWindow(body.commandWindow);
      pushLog(room, `${unit.characterName}'s Command Window changed from ${oldWindow || "unset"} to ${unit.commandWindow} seconds.`);
    }
  }

  if (action === "setName") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      const oldName = unit.characterName;
      unit.characterName = String(body.characterName || unit.characterName).trim().slice(0, 40) || unit.characterName;
      pushLog(room, `${oldName} renamed to ${unit.characterName}.`);
    }
  }

  if (action === "setColor") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      unit.color = normalizeColor(body.color);
      pushLog(room, `${unit.characterName}'s ATB color changed.`);
    }
  }

  if (action === "step") {
    if (room.activeId || room.pausedForTurn) {
      pushLog(room, "Resolve the active turn before stepping the clock.");
      sendJson(res, 200, publicState(room));
      broadcast(room);
      return;
    }
    room.resumeAfterTurn = false;
    clearActiveCommand(room);
    advanceSeconds(room, 1, { source: "step" });
    pushLog(room, "GM advanced one second.");
  }

  if (action === "reset") {
    for (const unit of room.units) unit.atb = 0;
    room.running = false;
    room.pausedForTurn = false;
    room.resumeAfterTurn = false;
    room.activeId = null;
    clearActiveCommand(room);
    room.lastInterruptedId = null;
    room.lastInterruptedAt = 0;
    room.lastTick = Date.now();
    pushLog(room, "Encounter reset.");
  }

  if (action === "clearEncounter") {
    room.units = [];
    room.running = false;
    room.pausedForTurn = false;
    room.resumeAfterTurn = false;
    room.activeId = null;
    clearActiveCommand(room);
    room.lastInterruptedId = null;
    room.lastInterruptedAt = 0;
    room.lastTick = Date.now();
    pushLog(room, "Encounter cleared.");
  }

  if (action === "completeTurn") {
    if (body.id && body.id !== room.activeId) {
      sendJson(res, 200, publicState(room));
      return;
    }
    const previousSource = room.activeSource;
    const unit = room.units.find((entry) => entry.id === room.activeId);
    if (unit) {
      unit.atb = Math.max(0, unit.atb - room.threshold);
      pushLog(room, `${unit.characterName}'s turn completed.`);
    }
    room.pausedForTurn = false;
    room.activeId = null;
    clearActiveCommand(room);
    moveToNextTurnOrClock(room, previousSource);
  }

  if (action === "nudge") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit && !room.pausedForTurn) {
      unit.atb = Math.min(room.threshold, unit.atb + Math.max(1, Number(body.amount) || 1));
      if (unit.atb >= room.threshold) {
        if (room.commandExpired && room.activeId) interruptActiveTurn(room);
        pauseForReadyUnit(room, unit, room.resumeAfterTurn ? "clock" : "manual");
      }
    }
  }

  sendJson(res, 200, publicState(room));
  broadcast(room);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/ping" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Spaceship Architect ATB server is reachable.");
    return;
  }

  if (url.pathname === "/api/create-room" && req.method === "POST") {
    handleCreateRoom(req, res);
    return;
  }

  if (url.pathname === "/api/action" && req.method === "POST") {
    handleAction(req, res);
    return;
  }

  if (url.pathname === "/api/state" && req.method === "GET") {
    const room = getRoom(url.searchParams.get("room"));
    if (!room) {
      sendJson(res, 404, { error: "Room not found" });
      return;
    }
    sendJson(res, 200, publicState(room));
    return;
  }

  if (url.pathname === "/events") {
    const room = getRoom(url.searchParams.get("room"));
    if (!room) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Room not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const roomClients = clients.get(room.roomCode) || new Set();
    clients.set(room.roomCode, roomClients);
    roomClients.add(res);
    sendEvent(res, "state", publicState(room));
    req.on("close", () => roomClients.delete(res));
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
  console.log("Spaceship Architect ATB multiplayer running");
  console.log(`Local:   http://127.0.0.1:${PORT}`);
  for (const address of addresses) console.log(`Phone:   http://${address}:${PORT}`);
});
