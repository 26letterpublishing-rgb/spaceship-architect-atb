let state = null;
let mode = localStorage.getItem("sa-atb-mode") || "welcome";
let currentRoomCode = (localStorage.getItem("sa-atb-room-code") || "").trim().toUpperCase();
let myUnitId = localStorage.getItem("sa-atb-unit-id") || "";
let alertsEnabled = localStorage.getItem("sa-atb-alerts") === "on";
let gmSoundsMuted = localStorage.getItem("sa-atb-gm-muted") === "on";
let lastNotifiedActiveId = "";
let lastCommandWarningKey = "";
let lastInterruptedNotice = "";
let lastHandledDelayRequest = "";
let audioContext = null;
let events = null;
const KEEP_ALIVE_MS = 30000;
const diceColumns = ["D4", "D6", "D8", "D10", "D12"];
const pcBuild = {
  perception: [1, 1, 0, 0],
  intellect: [1, 1, 0, 0],
};

function forgetSavedRoom() {
  currentRoomCode = "";
  myUnitId = "";
  state = null;
  if (events) {
    events.close();
    events = null;
  }
  localStorage.removeItem("sa-atb-room-code");
  localStorage.removeItem("sa-atb-unit-id");
}

function returnToWelcome(message = "") {
  forgetSavedRoom();
  mode = "welcome";
  localStorage.setItem("sa-atb-mode", mode);
  render();
  if (message) setConnected(false, message);
}

if (!/^[A-Z0-9]{4}$/.test(currentRoomCode)) {
  forgetSavedRoom();
}

if (!currentRoomCode && mode !== "welcome" && mode !== "roomJoin") {
  mode = "welcome";
  localStorage.setItem("sa-atb-mode", mode);
}

const roomCode = document.querySelector("#roomCode");
const connectionStatus = document.querySelector("#connectionStatus");
const welcomePanel = document.querySelector("#welcomePanel");
const createRoom = document.querySelector("#createRoom");
const showJoinRoom = document.querySelector("#showJoinRoom");
const roomJoinPanel = document.querySelector("#roomJoinPanel");
const joinRoomCode = document.querySelector("#joinRoomCode");
const confirmJoinRoom = document.querySelector("#confirmJoinRoom");
const backToWelcome = document.querySelector("#backToWelcome");
const topbar = document.querySelector("#topbar");
const joinPanel = document.querySelector("#joinPanel");
const gmPanel = document.querySelector("#gmPanel");
const playerPanel = document.querySelector("#playerPanel");
const playerName = document.querySelector("#playerName");
const characterName = document.querySelector("#characterName");
const playerColor = document.querySelector("#playerColor");
const perceptionDiceGrid = document.querySelector("#perceptionDiceGrid");
const intellectDiceGrid = document.querySelector("#intellectDiceGrid");
const awarenessSkill = document.querySelector("#awarenessSkill");
const reflexSkill = document.querySelector("#reflexSkill");
const calculatedSpeed = document.querySelector("#calculatedSpeed");
const calculatedCommand = document.querySelector("#calculatedCommand");
const joinPlayer = document.querySelector("#joinPlayer");
const openGm = document.querySelector("#openGm");
const rejoinBlock = document.querySelector("#rejoinBlock");
const rejoinSelect = document.querySelector("#rejoinSelect");
const rejoinPlayer = document.querySelector("#rejoinPlayer");
const toggleRun = document.querySelector("#toggleRun");
const stepTick = document.querySelector("#stepTick");
const resetAll = document.querySelector("#resetAll");
const clearEncounter = document.querySelector("#clearEncounter");
const gmMuteSound = document.querySelector("#gmMuteSound");
const gmAddUnit = document.querySelector("#gmAddUnit");
const gmPlayerName = document.querySelector("#gmPlayerName");
const gmCharacterName = document.querySelector("#gmCharacterName");
const gmSpeedRating = document.querySelector("#gmSpeedRating");
const gmCommandWindow = document.querySelector("#gmCommandWindow");
const gmCommandWindowWrap = document.querySelector("#gmCommandWindowWrap");
const gmColor = document.querySelector("#gmColor");
const gmTeam = document.querySelector("#gmTeam");
const unitList = document.querySelector("#unitList");
const initiativePanel = document.querySelector("#initiativePanel");
const logPanel = document.querySelector("#logPanel");
const readyCount = document.querySelector("#readyCount");
const clockState = document.querySelector("#clockState");
const playerClock = document.querySelector("#playerClock");
const myCharacter = document.querySelector("#myCharacter");
const myTurnBanner = document.querySelector("#myTurnBanner");
const playerTurnTitle = document.querySelector("#playerTurnTitle");
const playerTurnActions = document.querySelector("#playerTurnActions");
const playerEndTurn = document.querySelector("#playerEndTurn");
const playerDelayTimer = document.querySelector("#playerDelayTimer");
const playerDelayedAction = document.querySelector("#playerDelayedAction");
const playerRoomCode = document.querySelector("#playerRoomCode");
const playerCommandDial = document.querySelector("#playerCommandDial");
const playerCommandTime = document.querySelector("#playerCommandTime");
const playerCommandStatus = document.querySelector("#playerCommandStatus");
const enableAlerts = document.querySelector("#enableAlerts");
const leaveRoom = document.querySelector("#leaveRoom");
const playerColorControl = document.querySelector("#playerColorControl");
const playerColorEdit = document.querySelector("#playerColorEdit");
const myUnitCard = document.querySelector("#myUnitCard");
const activePanel = document.querySelector("#activePanel");
const activeKicker = document.querySelector("#activeKicker");
const activeTitle = document.querySelector("#activeTitle");
const activeMeta = document.querySelector("#activeMeta");
const logList = document.querySelector("#logList");
const turnDialog = document.querySelector("#turnDialog");
const turnDialogKicker = document.querySelector("#turnDialogKicker");
const activeName = document.querySelector("#activeName");
const activeOwner = document.querySelector("#activeOwner");
const completeTurn = document.querySelector("#completeTurn");
const gmDelayTimer = document.querySelector("#gmDelayTimer");
const gmDelayedAction = document.querySelector("#gmDelayedAction");
const gmPanicPause = document.querySelector("#gmPanicPause");

function pct(unit) {
  if (!state) return 0;
  return Math.min(100, (unit.atb / state.threshold) * 100);
}

function formatSpeed(value) {
  if (!value) return "Unset";
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function estimateTurn(unit) {
  if (!unit.speed) return "Awaiting GM values";
  if (unit.delay) return `${delayText(unit.delay)} - ${formatSeconds(delaySeconds(unit.delay))}`;
  if (!state || unit.atb >= state.threshold) return "Ready";
  if (!state.running || state.pausedForTurn) return "Clock paused";
  const seconds = Math.max(0, (state.threshold - unit.atb) / unit.speed);
  if (seconds < 1) return "acts in <1 sec";
  return `acts in ~${Math.ceil(seconds)} sec`;
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function clampSkill(value) {
  return Math.max(0, Math.min(20, Math.floor(Number(value) || 0)));
}

function purchasedBoxes(rows) {
  return rows.reduce((total, count) => total + count, 0);
}

function calculatedPcStats() {
  const perceptionBoxes = purchasedBoxes(pcBuild.perception);
  const intellectBoxes = purchasedBoxes(pcBuild.intellect);
  const awareness = clampSkill(awarenessSkill.value);
  const reflex = clampSkill(reflexSkill.value);
  return {
    speed: Math.max(1, intellectBoxes + reflex),
    commandWindow: Math.max(1, perceptionBoxes * 10 + awareness * 60),
  };
}

function renderDiceGrid(statName, grid) {
  const rows = pcBuild[statName];
  grid.innerHTML = rows
    .map((filled, rowIndex) => {
      const cells = diceColumns
        .map((die, dieIndex) => {
          const count = dieIndex + 1;
          const isFilled = filled >= count;
          return `<button type="button" class="die-cell ${isFilled ? "filled" : ""}" data-stat="${statName}" data-row="${rowIndex}" data-count="${count}">${die}</button>`;
        })
        .join("");
      return `<div class="die-row">${cells}</div>`;
    })
    .join("");
}

function renderPcBuilder() {
  renderDiceGrid("perception", perceptionDiceGrid);
  renderDiceGrid("intellect", intellectDiceGrid);
  const stats = calculatedPcStats();
  calculatedSpeed.textContent = String(stats.speed);
  calculatedCommand.textContent = `${stats.commandWindow} sec`;
}

function commandFor(unit) {
  return state?.command?.unitId === unit?.id ? state.command : null;
}

function commandPercent(command) {
  if (!command || !command.total) return 0;
  return Math.max(0, Math.min(100, (command.remaining / command.total) * 100));
}

function delayPercent(delay) {
  if (!delay || !delay.total) return 0;
  return Math.max(0, Math.min(100, (delay.remaining / delay.total) * 100));
}

function delaySeconds(delay) {
  if (!delay || !delay.rate) return 0;
  return Math.max(0, delay.remaining / delay.rate);
}

function delayText(delay) {
  if (!delay) return "";
  if (delay.kind === "action") return `Delayed Action: ${delay.label}`;
  return "Delay Time";
}

function hexToRgb(hex) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#39e58f";
  const value = Number.parseInt(clean.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function barStyle(unit) {
  const color = unit.color || "#39e58f";
  const rgb = hexToRgb(color);
  const flareLeft = Math.max(8, Math.min(96, pct(unit)));
  return `--bar-color:${color}; --bar-rgb:${rgb.r}, ${rgb.g}, ${rgb.b}; --own-flare-left:${flareLeft}%;`;
}

function setConnected(isConnected, message) {
  connectionStatus.classList.toggle("connected", isConnected);
  connectionStatus.classList.toggle("disconnected", !isConnected);
  connectionStatus.textContent = isConnected
    ? "Connected."
    : message || "Cannot reach the ATB room server. Start the server launcher, then refresh this page.";
}

async function action(payload, soundName = "tap") {
  let response;
  try {
    response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, roomCode: currentRoomCode }),
    });
  } catch {
    setConnected(false, "Cannot reach the ATB room server. Check the connection, then try again.");
    return state;
  }
  if (!response.ok) {
    if (response.status === 404) {
      returnToWelcome("That room expired. Create or join a new room.");
    } else {
      setConnected(false, "The ATB room server rejected that action. Try again.");
    }
    return state;
  }
  try {
    state = await response.json();
  } catch {
    setConnected(false, "The ATB room server sent an unreadable response. Try again.");
    return state;
  }
  if (mode === "gm") playGmSound(soundName);
  render();
  return state;
}

function setMode(next) {
  mode = next;
  localStorage.setItem("sa-atb-mode", mode);
  render();
}

function setRoom(nextState) {
  state = nextState;
  currentRoomCode = state.roomCode;
  localStorage.setItem("sa-atb-room-code", currentRoomCode);
  connectEvents();
}

function connectEvents() {
  if (events) events.close();
  if (!currentRoomCode) return;
  events = new EventSource(`/events?room=${encodeURIComponent(currentRoomCode)}`);
  events.addEventListener("state", (event) => {
    setConnected(true);
    state = JSON.parse(event.data);
    render();
  });
  events.addEventListener("error", () => {
    setConnected(false, "Cannot reach this ATB room. It may have expired or the server may be waking up.");
    verifySavedRoomStillExists();
  });
}

async function verifySavedRoomStillExists() {
  if (!currentRoomCode || mode === "welcome" || mode === "roomJoin") return;
  try {
    const response = await fetch(`/api/state?room=${encodeURIComponent(currentRoomCode)}`);
    if (response.status === 404) {
      returnToWelcome("That room expired. Create or join a new room.");
      return;
    }
    if (response.ok && !events) {
      setRoom(await response.json());
      render();
    }
  } catch {
    // Keep the current screen during brief network wake-ups; the visible warning is enough.
  }
}

async function keepRoomAwake() {
  if (mode !== "gm" || !currentRoomCode) return;
  try {
    const response = await fetch(`/api/keep-alive?room=${encodeURIComponent(currentRoomCode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.status === 404) {
      returnToWelcome("That room expired. Create or join a new room.");
      return;
    }
    if (!response.ok) {
      setConnected(false, "Trying to keep the ATB room awake...");
      return;
    }
    state = await response.json();
    setConnected(true);
    render();
  } catch {
    setConnected(false, "Trying to keep the ATB room awake...");
  }
}

function unitCard(unit, { gm = false, player = false } = {}) {
  const delayed = Boolean(unit.delay);
  const ready = unit.atb >= state.threshold && !delayed;
  const atbPercent = Math.min(100, unit.atb);
  const close = atbPercent >= 80 && !ready && !delayed;
  const own = player && unit.id === myUnitId;
  const speed = formatSpeed(unit.speed);
  const command = commandFor(unit);
  const speedInputValue = unit.speed ? formatSpeed(unit.speed) : "";
  const commandLabel = unit.team === "pc"
    ? `${unit.commandWindow || "Unset"} sec Command`
    : "No Command Window";
  const setupMissing = !unit.speed || (unit.team === "pc" && !unit.commandWindow);
  const side = unit.team === "pc" ? "PC" : "NPC";
  const type = "Character";
  return `
    <article class="unit-card ${ready ? "ready" : ""} ${close ? "close-ready" : ""} ${delayed ? "delayed" : ""} ${own ? "own-unit" : ""}" data-unit-id="${unit.id}" style="${barStyle(unit)}">
      <div class="unit-top">
        <div>
          <div class="unit-name">${escapeHtml(unit.characterName)}</div>
          <div class="unit-owner">${escapeHtml(unit.playerName)} - ${side} ${type}${player ? "" : ` - Speed ${speed}${unit.speed ? "%/sec" : ""} - ${escapeHtml(commandLabel)}`}</div>
        </div>
        <div class="unit-readout">
          <strong>${Math.floor(atbPercent)}%</strong>
          <span>${delayed ? "Delayed" : player ? (ready ? "Ready" : "Charging") : escapeHtml(estimateTurn(unit))}</span>
        </div>
        ${
          gm
            ? `<div class="unit-actions">
                <label class="name-edit">
                  Name
                  <input data-action="name" data-id="${unit.id}" value="${escapeHtml(unit.characterName)}" />
                </label>
                <label class="speed-edit">
                  Speed
                  <input data-action="speed" data-id="${unit.id}" type="number" min="1" max="100" step="0.5" value="${speedInputValue}" />
                </label>
                ${
                  unit.team === "pc"
                    ? `<label class="command-edit">
                        Command
                        <input data-action="commandWindow" data-id="${unit.id}" type="number" min="1" max="999" step="1" value="${unit.commandWindow || ""}" />
                      </label>`
                    : ""
                }
                <label class="color-edit">
                  Color
                  <input data-action="color" data-id="${unit.id}" type="color" value="${escapeHtml(unit.color || "#39e58f")}" />
                </label>
                <button class="mini" data-action="delayTimer" data-id="${unit.id}">Delay Timer</button>
                <button class="mini" data-action="delayedAction" data-id="${unit.id}">Delayed Action</button>
                <button class="mini" data-action="nudge" data-id="${unit.id}">+5%</button>
                <button class="mini danger" data-action="remove" data-id="${unit.id}">Remove</button>
              </div>`
            : ""
        }
      </div>
      ${
        command
          ? `<div class="command-bar ${command.expired ? "expired" : ""}">
              <div class="command-bar-fill" style="width:${command.expired ? 0 : commandPercent(command)}%"></div>
              <span>${command.expired ? "Interruption pending" : `${formatSeconds(command.remaining)} Command Window`}</span>
            </div>`
          : setupMissing && gm
            ? `<div class="setup-warning">Awaiting GM-entered Speed${unit.team === "pc" ? " and Command Window" : ""}.</div>`
            : ""
      }
      ${
        unit.delay
          ? `<div class="delay-bar ${unit.delay.kind === "action" ? "action-delay" : ""}">
              <div class="delay-bar-fill" style="width:${delayPercent(unit.delay)}%"></div>
              <span>${escapeHtml(delayText(unit.delay))} - ${formatSeconds(delaySeconds(unit.delay))}</span>
            </div>`
          : ""
      }
      <div class="meter"><div class="fill" style="width:${pct(unit)}%"></div></div>
    </article>
  `;
}

function renderUnitList(sorted) {
  const previousPositions = new Map(
    [...unitList.querySelectorAll(".unit-card[data-unit-id]")].map((card) => [
      card.dataset.unitId,
      card.getBoundingClientRect(),
    ]),
  );

  unitList.innerHTML = sorted.map((unit) => unitCard(unit, { gm: mode === "gm", player: mode === "player" })).join("");

  const cards = [...unitList.querySelectorAll(".unit-card[data-unit-id]")];
  for (const card of cards) {
    const previous = previousPositions.get(card.dataset.unitId);
    if (!previous) continue;
    const current = card.getBoundingClientRect();
    const deltaY = previous.top - current.top;
    if (Math.abs(deltaY) < 1) continue;
    card.classList.add("is-moving");
    card.style.transform = `translateY(${deltaY}px)`;
    card.style.transition = "none";
  }

  requestAnimationFrame(() => {
    for (const card of cards) {
      if (!card.classList.contains("is-moving")) continue;
      card.style.transition = "";
      card.style.transform = "";
      card.addEventListener(
        "transitionend",
        () => {
          card.classList.remove("is-moving");
        },
        { once: true },
      );
    }
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

function statusText() {
  if (!state) return "Connecting";
  if (state.pausedForTurn) return "Turn Paused";
  return state.running ? "Clock Engaged" : "Waiting for GM";
}

function activeUnit() {
  return state?.units.find((unit) => unit.id === state.activeId) || null;
}

function unitRoleText(unit) {
  if (!unit) return "";
  const side = unit.team === "pc" ? "PC" : "NPC";
  return `${unit.playerName} - ${side} Character`;
}

function renderActivePanel() {
  const active = activeUnit();
  const activeAction = state.activeAction;
  activePanel.classList.toggle("turn-live", Boolean(active || activeAction));
  activePanel.classList.toggle("own-turn", Boolean(active) && active.id === myUnitId);
  activePanel.classList.toggle("other-turn", Boolean(activeAction) || (Boolean(active) && active.id !== myUnitId));
  activePanel.classList.toggle("clock-running", state.running && !state.pausedForTurn);

  if (mode === "player") {
    const mine = state.units.find((unit) => unit.id === myUnitId);
    activeKicker.textContent = "Player Signal";
    if (activeAction) {
      activeTitle.textContent = `Resolve Action: ${activeAction.label}`;
      activeMeta.textContent = `${activeAction.characterName} - ${activeAction.playerName}`;
    } else if (active && active.id === myUnitId) {
      activeTitle.textContent = "YOUR TURN";
      activeMeta.textContent = `${active.characterName} - ${unitRoleText(active)}`;
    } else if (active) {
      activeTitle.textContent = `${active.characterName}'s turn`;
      activeMeta.textContent = unitRoleText(active);
    } else if (mine) {
      activeTitle.textContent = state.running ? "ATB clock engaged" : "Waiting for GM";
      activeMeta.textContent = estimateTurn(mine);
    } else {
      activeTitle.textContent = "Join or reclaim a character";
      activeMeta.textContent = "No character linked";
    }
    return;
  }

  if (activeAction) {
    activeKicker.textContent = "Delayed Action";
    activeTitle.textContent = `Resolve Action: ${activeAction.label}`;
    activeMeta.textContent = `${activeAction.characterName} - ${activeAction.playerName}`;
    return;
  }

  if (active) {
    activeKicker.textContent = "Active Turn";
    activeTitle.textContent = active.characterName;
    const command = commandFor(active);
    activeMeta.textContent = command
      ? `${unitRoleText(active)} - ${command.expired ? "interruption pending" : `${formatSeconds(command.remaining)} Command Window`}`
      : `${unitRoleText(active)} - Speed ${formatSpeed(active.speed)}%/sec`;
    return;
  }

  if (state.running) {
    const next = [...state.units]
      .filter((unit) => !unit.delay && unit.atb < state.threshold)
      .sort((a, b) => (state.threshold - a.atb) / a.speed - (state.threshold - b.atb) / b.speed)[0];
    activeKicker.textContent = "Clock Engaged";
    activeTitle.textContent = next ? `${next.characterName} is next` : "Awaiting participants";
    activeMeta.textContent = next ? estimateTurn(next) : "Add characters to begin";
    return;
  }

  activeKicker.textContent = "Clock Status";
  activeTitle.textContent = state.units.length ? "Waiting for GM to engage clock" : "Waiting for characters to join";
  activeMeta.textContent = state.units.length ? `${state.units.length} participant(s) standing by` : "No active turn";
}

function renderRejoinOptions() {
  const options = state.units.filter((unit) => unit.controlledBy === "player");
  rejoinBlock.classList.toggle("hidden", mode !== "join" || options.length === 0);
  rejoinSelect.innerHTML = options
    .map((unit) => `<option value="${unit.id}">${escapeHtml(unit.characterName)} - ${escapeHtml(unit.playerName)}</option>`)
    .join("");
}

function notifyTurnIfNeeded() {
  if (!state) return;
  if (state.activeAction) {
    if (mode === "gm") {
      turnDialogKicker.textContent = "Delayed Action";
      activeName.textContent = `Resolve Action: ${state.activeAction.label}`;
      activeOwner.textContent = `${state.activeAction.characterName} - ${state.activeAction.playerName}`;
      completeTurn.textContent = "Action Resolved";
      gmDelayTimer.classList.add("hidden");
      gmDelayedAction.classList.add("hidden");
      if (!turnDialog.open) turnDialog.show();
    } else if (turnDialog.open) {
      turnDialog.close();
    }
    lastNotifiedActiveId = "";
    lastCommandWarningKey = "";
    return;
  }
  const active = state.units.find((unit) => unit.id === state.activeId);
  if (!active) {
    if (turnDialog.open) turnDialog.close();
    lastNotifiedActiveId = "";
    lastCommandWarningKey = "";
    return;
  }

  if (mode === "gm") {
    turnDialogKicker.textContent = "Turn Ready";
    activeName.textContent = active.characterName;
    activeOwner.textContent = active.playerName;
    completeTurn.textContent = "Action Resolved";
    gmDelayTimer.classList.remove("hidden");
    gmDelayedAction.classList.remove("hidden");
    if (!turnDialog.open) turnDialog.show();
  }

  if (mode === "player" && active.id === myUnitId && alertsEnabled && lastNotifiedActiveId !== active.id) {
    lastNotifiedActiveId = active.id;
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    playTurnDing();
  }

  notifyCommandWindowIfNeeded(active);
}

function notifyInterruptionIfNeeded() {
  if (mode !== "player" || !state?.lastInterruptedId) return;
  if (state.lastInterruptedId !== myUnitId) return;
  const key = `${state.lastInterruptedId}:${state.lastInterruptedAt || ""}`;
  if (lastInterruptedNotice === key) return;
  lastInterruptedNotice = key;
  if (navigator.vibrate) navigator.vibrate([280, 90, 280, 90, 420]);
  playInterruptedBuzz();
}

function notifyCommandWindowIfNeeded(active) {
  if (mode !== "player" || active.id !== myUnitId || !alertsEnabled) return;
  const command = commandFor(active);
  if (!command || command.expired) return;
  const remaining = Math.ceil(command.remaining);
  const warningSecond = remaining <= 10 && remaining > 5 ? 10 : remaining <= 5 && remaining >= 1 ? remaining : null;
  if (!warningSecond) return;
  const key = `${active.id}:${warningSecond}`;
  if (lastCommandWarningKey === key) return;
  lastCommandWarningKey = key;
  if (navigator.vibrate) navigator.vibrate(warningSecond <= 5 ? [120, 60, 120, 60, 120] : [220, 100, 220]);
  playWarningDing(warningSecond <= 5);
}

function ensureAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!audioContext) audioContext = new Context();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, start, duration, gainValue = 0.04, type = "square") {
  const audio = ensureAudio();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audio.currentTime + start);
  gain.gain.setValueAtTime(0, audio.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainValue, audio.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.02);
}

function playGmSound(name = "tap") {
  if (gmSoundsMuted) return;
  try {
    if (name === "start") {
      tone(220, 0, 0.07, 0.035, "sawtooth");
      tone(440, 0.08, 0.08, 0.04, "square");
      return;
    }
    if (name === "danger") {
      tone(160, 0, 0.12, 0.05, "sawtooth");
      tone(110, 0.12, 0.12, 0.04, "sawtooth");
      return;
    }
    if (name === "resolve") {
      tone(520, 0, 0.06, 0.035, "triangle");
      tone(760, 0.06, 0.08, 0.035, "triangle");
      return;
    }
    tone(680, 0, 0.045, 0.025, "square");
    tone(920, 0.045, 0.045, 0.02, "square");
  } catch {
    // Browsers may block audio until the first tap.
  }
}

function playTurnDing() {
  try {
    tone(880, 0, 0.22, 0.28, "sine");
    tone(1320, 0.12, 0.28, 0.24, "sine");
    tone(1760, 0.28, 0.2, 0.18, "triangle");
  } catch {
    // The visual turn banner still works if audio is blocked.
  }
}

function playWarningDing(urgent = false) {
  try {
    if (urgent) {
      tone(620, 0, 0.12, 0.28, "square");
      tone(620, 0.18, 0.12, 0.28, "square");
      tone(420, 0.36, 0.16, 0.24, "sawtooth");
      return;
    }
    tone(520, 0, 0.2, 0.24, "triangle");
    tone(780, 0.12, 0.24, 0.24, "triangle");
    tone(1040, 0.28, 0.2, 0.18, "sine");
  } catch {
    // Visual warning remains visible if audio is blocked.
  }
}

function playInterruptedBuzz() {
  try {
    tone(240, 0, 0.2, 0.48, "sawtooth");
    tone(180, 0.18, 0.22, 0.46, "square");
    tone(120, 0.4, 0.36, 0.42, "sawtooth");
  } catch {
    // The visual interruption still appears in the combat log if audio is blocked.
  }
}

function enablePlayerAlerts({ testSound = false } = {}) {
  alertsEnabled = true;
  localStorage.setItem("sa-atb-alerts", "on");
  ensureAudio();
  if (testSound) playTurnDing();
}

function render() {
  if (!currentRoomCode && mode !== "welcome" && mode !== "roomJoin") {
    mode = "welcome";
    localStorage.setItem("sa-atb-mode", mode);
  }

  welcomePanel.classList.toggle("hidden", mode !== "welcome");
  roomJoinPanel.classList.toggle("hidden", mode !== "roomJoin");
  joinPanel.classList.toggle("hidden", mode !== "join");
  gmPanel.classList.toggle("hidden", mode !== "gm");
  playerPanel.classList.toggle("hidden", mode !== "player");
  topbar.classList.toggle("hidden", mode === "welcome");
  connectionStatus.classList.toggle("hidden", mode === "welcome");
  initiativePanel.classList.toggle("hidden", mode === "welcome" || mode === "roomJoin" || mode === "join");
  logPanel.classList.toggle("hidden", mode === "welcome" || mode === "roomJoin" || mode === "join" || mode === "player");
  document.body.classList.toggle("welcome-mode", mode === "welcome");
  document.body.classList.toggle("player-mode", mode === "player");
  document.body.classList.toggle("clock-active", Boolean(state?.running) && !state?.pausedForTurn && !state?.holdPaused);
  renderPcBuilder();

  if (!state) {
    roomCode.textContent = currentRoomCode || "----";
    playerRoomCode.textContent = currentRoomCode || "----";
    activePanel.classList.add("hidden");
    unitList.innerHTML = "";
    logList.innerHTML = "";
    gmPanicPause.classList.add("hidden");
    return;
  }

  roomCode.textContent = state.roomCode;
  playerRoomCode.textContent = state.roomCode;
  activePanel.classList.toggle("hidden", mode === "welcome" || mode === "roomJoin" || mode === "join");

  const ready = state.units.filter((unit) => unit.atb >= state.threshold && !unit.delay);
  readyCount.textContent = `${ready.length} Ready`;
  clockState.textContent = statusText();
  playerClock.textContent = statusText();
  toggleRun.textContent = state.running ? "Pause Clock" : "Engage Clock";
  if (state.pausedForTurn && state.command && !state.command.expired) toggleRun.textContent = state.holdPaused ? "Resume Timers" : "Pause All";
  const canResumeEverything = state.holdPaused || (!state.running && Boolean(state.activeId) && !state.pausedForTurn);
  gmPanicPause.classList.toggle("hidden", mode !== "gm");
  gmPanicPause.classList.toggle("paused", canResumeEverything);
  gmPanicPause.textContent = canResumeEverything ? "Resume Everything" : "Pause Everything";
  enableAlerts.textContent = alertsEnabled ? "Sound / Vibration Enabled" : "Enable Sound / Vibration";
  gmMuteSound.textContent = gmSoundsMuted ? "Unmute Sounds" : "Mute Sounds";
  renderActivePanel();
  renderRejoinOptions();
  const active = activeUnit();
  const mine = state.units.find((unit) => unit.id === myUnitId);
  const showMineOverlay = mode === "player" && Boolean(mine) && (active?.id === myUnitId || (Boolean(mine.delay) && !state.activeAction));
  document.body.classList.toggle("own-turn-active", showMineOverlay);
  document.body.classList.toggle("other-turn-active", mode === "player" && (Boolean(state.activeAction) || (Boolean(active) && active.id !== myUnitId)));

  const sorted =
    mode === "player"
      ? [...state.units].sort((a, b) => b.atb - a.atb || (b.speed || 0) - (a.speed || 0))
      : [...state.units].sort((a, b) => b.atb - a.atb || (b.speed || 0) - (a.speed || 0));
  renderUnitList(sorted);
  syncGmCommandWindowVisibility();

  if (mine) {
    myCharacter.textContent = mine.characterName;
    playerColorControl.classList.remove("hidden");
    playerColorEdit.value = mine.color || "#39e58f";
    myUnitCard.innerHTML = "";
    myTurnBanner.classList.toggle("hidden", !showMineOverlay);
    renderPlayerCommand(mine);
  } else if (mode === "player") {
    myCharacter.textContent = "Not Connected";
    playerColorControl.classList.add("hidden");
    myUnitCard.innerHTML = "";
    myTurnBanner.classList.add("hidden");
    renderPlayerCommand(null);
  }

  logList.innerHTML = state.log
    .slice()
    .reverse()
    .map((entry) => `<div><strong>${escapeHtml(entry.at)}</strong> ${escapeHtml(entry.text)}</div>`)
    .join("");

  if (!state.pausedForTurn && turnDialog.open) turnDialog.close();
  notifyTurnIfNeeded();
  notifyInterruptionIfNeeded();
  queueGmDelayRequestPrompt();
}

function renderPlayerCommand(mine) {
  const command = commandFor(mine);
  const isMyTurn = mine && state.activeId === mine.id;
  const delay = mine?.delay || null;
  const hasPendingDelayRequest = Boolean(state.delayRequest && state.delayRequest.unitId === mine?.id);
  playerTurnTitle.textContent = delay && !isMyTurn ? "DELAY TIME" : "YOUR TURN";
  playerTurnActions.classList.toggle("hidden", Boolean(delay) && !isMyTurn);
  playerDelayTimer.disabled = hasPendingDelayRequest;
  playerDelayedAction.disabled = hasPendingDelayRequest;
  playerEndTurn.disabled = hasPendingDelayRequest;

  if (delay && !isMyTurn) {
    playerCommandDial.classList.remove("hidden");
    playerCommandDial.style.setProperty("--command-percent", `${delayPercent(delay)}%`);
    playerCommandTime.textContent = formatSeconds(delaySeconds(delay));
    playerCommandStatus.textContent = delayText(delay);
    return;
  }

  playerCommandDial.classList.toggle("hidden", !isMyTurn || !command);
  if (!isMyTurn) {
    playerCommandStatus.textContent = "Resolve your action, then end your turn.";
    return;
  }
  if (hasPendingDelayRequest) {
    playerCommandStatus.textContent = "Waiting for GM to set the delay.";
    return;
  }
  if (!command) {
    playerCommandStatus.textContent = state.activeSource === "step"
      ? "Manual step turn. No Command Window limit."
      : "Resolve your action, then end your turn.";
    return;
  }
  const percent = command.expired ? 0 : commandPercent(command);
  playerCommandDial.style.setProperty("--command-percent", `${percent}%`);
  playerCommandTime.textContent = formatSeconds(command.remaining);
  playerCommandStatus.textContent = command.expired
    ? "Your action is about to be interrupted!"
    : command.remaining <= 10
      ? "Time is almost up!"
      : "Resolve your action before your Command Window closes.";
}

function syncGmCommandWindowVisibility() {
  gmCommandWindowWrap.classList.toggle("hidden", gmTeam.value !== "pc");
}

function promptForDelay(unit, kind) {
  if (!unit) return null;
  let label = "";
  if (kind === "action") {
    label = prompt(`Name the delayed action for ${unit.characterName}:`, "Delayed Action");
    if (label === null) return null;
  }
  const rateText = prompt(`Enter Delay Time rating for ${unit.characterName}.\n100 is about 1 second. 1 is about 100 seconds.`, "12");
  if (rateText === null) return null;
  const rate = Number(rateText);
  if (!Number.isFinite(rate) || rate <= 0) {
    alert("Delay Time must be a number from 1 to 100.");
    return null;
  }
  return {
    kind,
    label,
    rate,
  };
}

async function startDelayWithPrompt(unitId, kind) {
  const unit = state?.units.find((entry) => entry.id === unitId);
  const delay = promptForDelay(unit, kind);
  if (!delay) return false;
  await action({
    action: "startDelay",
    id: unitId,
    kind: delay.kind,
    label: delay.label,
    rate: delay.rate,
  }, delay.kind === "action" ? "start" : "tap");
  return true;
}

function queueGmDelayRequestPrompt() {
  if (mode !== "gm" || !state?.delayRequest) return;
  if (lastHandledDelayRequest === state.delayRequest.id) return;
  lastHandledDelayRequest = state.delayRequest.id;
  setTimeout(async () => {
    if (mode !== "gm" || !state?.delayRequest || lastHandledDelayRequest !== state.delayRequest.id) return;
    const request = state.delayRequest;
    const started = await startDelayWithPrompt(request.unitId, request.kind);
    if (!started && state?.delayRequest?.id === request.id) {
      action({ action: "cancelDelayRequest" }, "tap");
    }
  }, 0);
}

joinPlayer.addEventListener("click", async () => {
  enablePlayerAlerts();
  const pcStats = calculatedPcStats();
  const next = await action({
    action: "join",
    playerName: playerName.value || "Player",
    characterName: characterName.value || "Character",
    speed: pcStats.speed,
    commandWindow: pcStats.commandWindow,
    color: playerColor.value,
    controlledBy: "player",
    team: "pc",
    actorType: "character",
  });
  if (!next) return;
  const unit = next.units[next.units.length - 1];
  myUnitId = unit.id;
  localStorage.setItem("sa-atb-unit-id", myUnitId);
  setMode("player");
});

createRoom.addEventListener("click", async () => {
  let response;
  try {
    response = await fetch("/api/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    setConnected(false, "Cannot reach the ATB room server. Try again in a moment.");
    return;
  }
  if (!response.ok) {
    setConnected(false, "Could not create a room. Try again in a moment.");
    return;
  }
  setRoom(await response.json());
  myUnitId = "";
  localStorage.removeItem("sa-atb-unit-id");
  setMode("gm");
});

showJoinRoom.addEventListener("click", () => setMode("roomJoin"));
backToWelcome.addEventListener("click", () => setMode("welcome"));
joinRoomCode.addEventListener("input", () => {
  joinRoomCode.value = joinRoomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
});
confirmJoinRoom.addEventListener("click", async () => {
  const code = joinRoomCode.value.trim().toUpperCase();
  if (!code) return;
  let response;
  try {
    response = await fetch(`/api/state?room=${encodeURIComponent(code)}`);
  } catch {
    setConnected(false, "Cannot reach the ATB room server. Check the room code or try again.");
    return;
  }
  if (!response.ok) {
    setConnected(false, "Room not found. Check the four-character room code.");
    return;
  }
  setRoom(await response.json());
  setMode("join");
});
openGm.addEventListener("click", () => setMode("welcome"));
rejoinPlayer.addEventListener("click", () => {
  enablePlayerAlerts();
  myUnitId = rejoinSelect.value;
  localStorage.setItem("sa-atb-unit-id", myUnitId);
  setMode("player");
});

toggleRun.addEventListener("click", () => action({ action: "setRunning", running: !state.running }, state.running ? "tap" : "start"));
gmPanicPause.addEventListener("click", () => {
  if (!state) return;
  const wantsRunning = Boolean(state.holdPaused || (!state.running && state.activeId));
  action({ action: "setRunning", running: wantsRunning }, state.holdPaused ? "start" : "tap");
});
stepTick.addEventListener("click", () => action({ action: "step" }, "tap"));
resetAll.addEventListener("click", () => action({ action: "reset" }, "danger"));
gmMuteSound.addEventListener("click", () => {
  gmSoundsMuted = !gmSoundsMuted;
  localStorage.setItem("sa-atb-gm-muted", gmSoundsMuted ? "on" : "off");
  playGmSound("tap");
  render();
});
clearEncounter.addEventListener("click", () => {
  if (confirm("Clear every character from this encounter?")) action({ action: "clearEncounter" }, "danger");
});
completeTurn.addEventListener("click", () => action({ action: "completeTurn" }, "resolve"));
gmDelayTimer.addEventListener("click", () => {
  const active = activeUnit();
  if (active) startDelayWithPrompt(active.id, "timer");
});
gmDelayedAction.addEventListener("click", () => {
  const active = activeUnit();
  if (active) startDelayWithPrompt(active.id, "action");
});
playerEndTurn.addEventListener("click", () => {
  if (state && state.activeId === myUnitId) action({ action: "completeTurn", id: myUnitId });
});
playerDelayTimer.addEventListener("click", () => {
  if (state && state.activeId === myUnitId) action({ action: "requestDelay", id: myUnitId, kind: "timer" }, "tap");
});
playerDelayedAction.addEventListener("click", () => {
  if (state && state.activeId === myUnitId) action({ action: "requestDelay", id: myUnitId, kind: "action" }, "tap");
});
enableAlerts.addEventListener("click", () => {
  enablePlayerAlerts({ testSound: true });
  render();
});
leaveRoom.addEventListener("click", () => {
  returnToWelcome("Left the room. Create or join a room when ready.");
});
playerColorEdit.addEventListener("change", () => {
  if (myUnitId) action({ action: "setColor", id: myUnitId, color: playerColorEdit.value });
});

joinPanel.addEventListener("click", (event) => {
  const button = event.target.closest(".die-cell");
  if (!button) return;
  const stat = button.dataset.stat;
  const row = Number(button.dataset.row);
  const count = Number(button.dataset.count);
  if (!pcBuild[stat] || !Number.isInteger(row)) return;
  pcBuild[stat][row] = pcBuild[stat][row] === count ? 0 : count;
  renderPcBuilder();
});

awarenessSkill.addEventListener("input", renderPcBuilder);
reflexSkill.addEventListener("input", renderPcBuilder);

gmAddUnit.addEventListener("click", () => {
  action({
    action: "addUnit",
    playerName: gmPlayerName.value || "GM",
    characterName: gmCharacterName.value || "NPC",
    speed: gmSpeedRating.value || 5,
    commandWindow: gmTeam.value === "pc" ? gmCommandWindow.value || 30 : null,
    color: gmColor.value,
    controlledBy: "gm",
    team: gmTeam.value,
    actorType: "character",
  });
  gmCharacterName.value = "";
});

gmTeam.addEventListener("change", () => {
  syncGmCommandWindowVisibility();
});

unitList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || mode !== "gm") return;
  const id = button.dataset.id;
  if (button.dataset.action === "remove") action({ action: "removeUnit", id }, "danger");
  if (button.dataset.action === "nudge") action({ action: "nudge", id, amount: 5 }, "tap");
  if (button.dataset.action === "delayTimer") startDelayWithPrompt(id, "timer");
  if (button.dataset.action === "delayedAction") startDelayWithPrompt(id, "action");
});

unitList.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-action]");
  if (!input || mode !== "gm") return;
  if (input.dataset.action === "speed") action({ action: "setSpeed", id: input.dataset.id, speed: input.value }, "tap");
  if (input.dataset.action === "commandWindow") action({ action: "setCommandWindow", id: input.dataset.id, commandWindow: input.value }, "tap");
  if (input.dataset.action === "name") action({ action: "setName", id: input.dataset.id, characterName: input.value }, "tap");
  if (input.dataset.action === "color") action({ action: "setColor", id: input.dataset.id, color: input.value }, "tap");
});

setInterval(keepRoomAwake, KEEP_ALIVE_MS);

if (currentRoomCode && mode !== "welcome" && mode !== "roomJoin") {
  fetch(`/api/state?room=${encodeURIComponent(currentRoomCode)}`)
    .then((response) => {
      if (response.status === 404) return { expired: true };
      return response.ok ? response.json() : null;
    })
    .then((nextState) => {
      if (nextState?.expired) {
        returnToWelcome("That room expired. Create or join a new room.");
        return;
      }
      if (!nextState) {
        returnToWelcome("Could not reconnect to the old room. Create or join a new room.");
        return;
      }
      setRoom(nextState);
      render();
    })
    .catch(() => returnToWelcome("Could not reconnect to the old room. Create or join a new room."));
} else {
  render();
}
