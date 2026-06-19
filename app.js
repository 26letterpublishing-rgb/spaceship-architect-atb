let state = null;
let mode = localStorage.getItem("sa-atb-mode") || "welcome";
let currentRoomCode = localStorage.getItem("sa-atb-room-code") || "";
let myUnitId = localStorage.getItem("sa-atb-unit-id") || "";
let alertsEnabled = localStorage.getItem("sa-atb-alerts") === "on";
let gmSoundsMuted = localStorage.getItem("sa-atb-gm-muted") === "on";
let lastNotifiedActiveId = "";
let audioContext = null;

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
const speedRating = document.querySelector("#speedRating");
const playerColor = document.querySelector("#playerColor");
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
const gmColor = document.querySelector("#gmColor");
const gmTeam = document.querySelector("#gmTeam");
const gmActorType = document.querySelector("#gmActorType");
const unitList = document.querySelector("#unitList");
const initiativePanel = document.querySelector("#initiativePanel");
const logPanel = document.querySelector("#logPanel");
const readyCount = document.querySelector("#readyCount");
const clockState = document.querySelector("#clockState");
const playerClock = document.querySelector("#playerClock");
const myCharacter = document.querySelector("#myCharacter");
const myTurnBanner = document.querySelector("#myTurnBanner");
const playerEndTurn = document.querySelector("#playerEndTurn");
const enableAlerts = document.querySelector("#enableAlerts");
const playerColorControl = document.querySelector("#playerColorControl");
const playerColorEdit = document.querySelector("#playerColorEdit");
const myUnitCard = document.querySelector("#myUnitCard");
const activePanel = document.querySelector("#activePanel");
const activeKicker = document.querySelector("#activeKicker");
const activeTitle = document.querySelector("#activeTitle");
const activeMeta = document.querySelector("#activeMeta");
const logList = document.querySelector("#logList");
const turnDialog = document.querySelector("#turnDialog");
const activeName = document.querySelector("#activeName");
const activeOwner = document.querySelector("#activeOwner");
const completeTurn = document.querySelector("#completeTurn");
let events = null;

function pct(unit) {
  if (!state) return 0;
  return Math.min(100, (unit.atb / state.threshold) * 100);
}

function formatSpeed(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function estimateTurn(unit) {
  if (!state || unit.atb >= state.threshold) return "Ready";
  if (!state.running || state.pausedForTurn) return "Clock paused";
  const seconds = Math.max(0, (state.threshold - unit.atb) / unit.speed);
  if (seconds < 1) return "acts in <1 sec";
  return `acts in ~${Math.ceil(seconds)} sec`;
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
  return `--bar-color:${color}; --bar-rgb:${rgb.r}, ${rgb.g}, ${rgb.b};`;
}

function setConnected(isConnected, message) {
  connectionStatus.classList.toggle("connected", isConnected);
  connectionStatus.classList.toggle("disconnected", !isConnected);
  connectionStatus.textContent = isConnected
    ? "Connected."
    : message || "Cannot reach the ATB room server. Start the server launcher, then refresh this page.";
}

async function action(payload, soundName = "tap") {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, roomCode: currentRoomCode }),
  });
  if (!response.ok) {
    setConnected(false, "Room not found. Return to the welcome screen and rejoin.");
    return state;
  }
  state = await response.json();
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
  });
}

function unitCard(unit, { gm = false } = {}) {
  const ready = unit.atb >= state.threshold;
  const atbPercent = Math.min(100, unit.atb);
  const close = atbPercent >= 80 && !ready;
  const speed = formatSpeed(unit.speed);
  const side = unit.team === "pc" ? "PC" : "NPC";
  const type = unit.actorType === "ship" ? "Ship" : "Character";
  return `
    <article class="unit-card ${ready ? "ready" : ""} ${close ? "close-ready" : ""}" data-unit-id="${unit.id}" style="${barStyle(unit)}">
      <div class="unit-top">
        <div>
          <div class="unit-name">${escapeHtml(unit.characterName)}</div>
          <div class="unit-owner">${escapeHtml(unit.playerName)} - ${side} ${type} - Speed ${speed}%/sec</div>
        </div>
        <div class="unit-readout">
          <strong>${Math.floor(atbPercent)}%</strong>
          <span>${escapeHtml(estimateTurn(unit))}</span>
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
                  <input data-action="speed" data-id="${unit.id}" type="number" min="1" max="100" step="0.5" value="${speed}" />
                </label>
                <label class="color-edit">
                  Color
                  <input data-action="color" data-id="${unit.id}" type="color" value="${escapeHtml(unit.color || "#39e58f")}" />
                </label>
                <button class="mini" data-action="nudge" data-id="${unit.id}">+5%</button>
                <button class="mini danger" data-action="remove" data-id="${unit.id}">Remove</button>
              </div>`
            : ""
        }
      </div>
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

  unitList.innerHTML = sorted.map((unit) => unitCard(unit, { gm: mode === "gm" })).join("");

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

function renderActivePanel() {
  const active = state.units.find((unit) => unit.id === state.activeId);
  activePanel.classList.toggle("turn-live", Boolean(active) && (mode !== "player" || active.id === myUnitId));
  activePanel.classList.toggle("clock-running", state.running && !state.pausedForTurn);

  if (mode === "player") {
    const mine = state.units.find((unit) => unit.id === myUnitId);
    activeKicker.textContent = "Player Signal";
    if (active && active.id === myUnitId) {
      activeTitle.textContent = "Your turn is active";
      activeMeta.textContent = "Resolve your action";
    } else if (mine) {
      activeTitle.textContent = state.running ? "Awaiting turn signal" : "Waiting for GM";
      activeMeta.textContent = estimateTurn(mine);
    } else {
      activeTitle.textContent = "Join or reclaim a character";
      activeMeta.textContent = "No character linked";
    }
    return;
  }

  if (active) {
    const side = active.team === "pc" ? "PC" : "NPC";
    const type = active.actorType === "ship" ? "Ship" : "Character";
    activeKicker.textContent = "Active Turn";
    activeTitle.textContent = active.characterName;
    activeMeta.textContent = `${active.playerName} - ${side} ${type} - Speed ${formatSpeed(active.speed)}%/sec`;
    return;
  }

  if (state.running) {
    const next = [...state.units]
      .filter((unit) => unit.atb < state.threshold)
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
  const active = state.units.find((unit) => unit.id === state.activeId);
  if (!active) {
    if (turnDialog.open) turnDialog.close();
    lastNotifiedActiveId = "";
    return;
  }

  if (mode === "gm") {
    activeName.textContent = active.characterName;
    activeOwner.textContent = active.playerName;
    if (!turnDialog.open) turnDialog.showModal();
  }

  if (mode === "player" && active.id === myUnitId && alertsEnabled && lastNotifiedActiveId !== active.id) {
    lastNotifiedActiveId = active.id;
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    playTurnDing();
  }
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
    tone(880, 0, 0.16, 0.13, "sine");
    tone(1320, 0.12, 0.22, 0.1, "sine");
  } catch {
    // The visual turn banner still works if audio is blocked.
  }
}

function render() {
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

  if (!state) {
    roomCode.textContent = currentRoomCode || "----";
    activePanel.classList.add("hidden");
    unitList.innerHTML = "";
    logList.innerHTML = "";
    return;
  }

  roomCode.textContent = state.roomCode;
  activePanel.classList.toggle("hidden", mode === "welcome" || mode === "roomJoin" || mode === "join");

  const ready = state.units.filter((unit) => unit.atb >= state.threshold);
  readyCount.textContent = `${ready.length} Ready`;
  clockState.textContent = statusText();
  playerClock.textContent = statusText();
  toggleRun.textContent = state.running ? "Pause Clock" : "Engage Clock";
  enableAlerts.textContent = alertsEnabled ? "Sound / Vibration Enabled" : "Enable Sound / Vibration";
  gmMuteSound.textContent = gmSoundsMuted ? "Unmute Sounds" : "Mute Sounds";
  renderActivePanel();
  renderRejoinOptions();

  const sorted =
    mode === "player"
      ? state.units.filter((unit) => unit.id === myUnitId)
      : [...state.units].sort((a, b) => b.atb - a.atb || b.speed - a.speed);
  renderUnitList(sorted);

  const mine = state.units.find((unit) => unit.id === myUnitId);
  if (mine) {
    myCharacter.textContent = mine.characterName;
    playerColorControl.classList.remove("hidden");
    playerColorEdit.value = mine.color || "#39e58f";
    myUnitCard.innerHTML = unitCard(mine);
    myTurnBanner.classList.toggle("hidden", state.activeId !== mine.id);
  } else if (mode === "player") {
    myCharacter.textContent = "Not Connected";
    playerColorControl.classList.add("hidden");
    myUnitCard.innerHTML = "";
    myTurnBanner.classList.add("hidden");
  }

  logList.innerHTML = state.log
    .slice()
    .reverse()
    .map((entry) => `<div><strong>${escapeHtml(entry.at)}</strong> ${escapeHtml(entry.text)}</div>`)
    .join("");

  if (!state.pausedForTurn && turnDialog.open) turnDialog.close();
  notifyTurnIfNeeded();
}

joinPlayer.addEventListener("click", async () => {
  const next = await action({
    action: "join",
    playerName: playerName.value || "Player",
    characterName: characterName.value || "Character",
    speed: speedRating.value || 5,
    color: playerColor.value,
    controlledBy: "player",
    team: "pc",
    actorType: "character",
  });
  const unit = next.units[next.units.length - 1];
  myUnitId = unit.id;
  localStorage.setItem("sa-atb-unit-id", myUnitId);
  setMode("player");
});

createRoom.addEventListener("click", async () => {
  const response = await fetch("/api/create-room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
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
  const response = await fetch(`/api/state?room=${encodeURIComponent(code)}`);
  if (!response.ok) {
    setConnected(false, "Room not found. Check the four-character room code.");
    return;
  }
  setRoom(await response.json());
  setMode("join");
});
openGm.addEventListener("click", () => setMode("welcome"));
rejoinPlayer.addEventListener("click", () => {
  myUnitId = rejoinSelect.value;
  localStorage.setItem("sa-atb-unit-id", myUnitId);
  setMode("player");
});

toggleRun.addEventListener("click", () => action({ action: "setRunning", running: !state.running }, state.running ? "tap" : "start"));
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
playerEndTurn.addEventListener("click", () => {
  if (state && state.activeId === myUnitId) action({ action: "completeTurn", id: myUnitId });
});
enableAlerts.addEventListener("click", () => {
  alertsEnabled = true;
  localStorage.setItem("sa-atb-alerts", "on");
  playTurnDing();
  render();
});
playerColorEdit.addEventListener("change", () => {
  if (myUnitId) action({ action: "setColor", id: myUnitId, color: playerColorEdit.value });
});

gmAddUnit.addEventListener("click", () => {
  action({
    action: "addUnit",
    playerName: gmPlayerName.value || "GM",
    characterName: gmCharacterName.value || "NPC",
    speed: gmSpeedRating.value || 5,
    color: gmColor.value,
    controlledBy: "gm",
    team: gmTeam.value,
    actorType: gmActorType.value,
  });
  gmCharacterName.value = "";
});

unitList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || mode !== "gm") return;
  const id = button.dataset.id;
  if (button.dataset.action === "remove") action({ action: "removeUnit", id }, "danger");
  if (button.dataset.action === "nudge") action({ action: "nudge", id, amount: 5 }, "tap");
});

unitList.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-action]");
  if (!input || mode !== "gm") return;
  if (input.dataset.action === "speed") action({ action: "setSpeed", id: input.dataset.id, speed: input.value }, "tap");
  if (input.dataset.action === "name") action({ action: "setName", id: input.dataset.id, characterName: input.value }, "tap");
  if (input.dataset.action === "color") action({ action: "setColor", id: input.dataset.id, color: input.value }, "tap");
});

if (currentRoomCode && mode !== "welcome" && mode !== "roomJoin") {
  fetch(`/api/state?room=${encodeURIComponent(currentRoomCode)}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((nextState) => {
      if (!nextState) {
        mode = "welcome";
        localStorage.setItem("sa-atb-mode", mode);
        render();
        return;
      }
      setRoom(nextState);
      render();
    })
    .catch(() => render());
} else {
  render();
}
