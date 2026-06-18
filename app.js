let state = null;
let mode = localStorage.getItem("sa-atb-mode") || "join";
let myUnitId = localStorage.getItem("sa-atb-unit-id") || "";

const roomCode = document.querySelector("#roomCode");
const connectionStatus = document.querySelector("#connectionStatus");
const joinPanel = document.querySelector("#joinPanel");
const gmPanel = document.querySelector("#gmPanel");
const playerPanel = document.querySelector("#playerPanel");
const playerName = document.querySelector("#playerName");
const characterName = document.querySelector("#characterName");
const speedRating = document.querySelector("#speedRating");
const joinPlayer = document.querySelector("#joinPlayer");
const openGm = document.querySelector("#openGm");
const toggleRun = document.querySelector("#toggleRun");
const stepTick = document.querySelector("#stepTick");
const resetAll = document.querySelector("#resetAll");
const gmAddUnit = document.querySelector("#gmAddUnit");
const gmPlayerName = document.querySelector("#gmPlayerName");
const gmCharacterName = document.querySelector("#gmCharacterName");
const gmSpeedRating = document.querySelector("#gmSpeedRating");
const unitList = document.querySelector("#unitList");
const readyCount = document.querySelector("#readyCount");
const clockState = document.querySelector("#clockState");
const playerClock = document.querySelector("#playerClock");
const myCharacter = document.querySelector("#myCharacter");
const myTurnBanner = document.querySelector("#myTurnBanner");
const myUnitCard = document.querySelector("#myUnitCard");
const logList = document.querySelector("#logList");
const turnDialog = document.querySelector("#turnDialog");
const activeName = document.querySelector("#activeName");
const activeOwner = document.querySelector("#activeOwner");
const completeTurn = document.querySelector("#completeTurn");

function pct(unit) {
  if (!state) return 0;
  return Math.min(100, (unit.atb / state.threshold) * 100);
}

function setConnected(isConnected) {
  connectionStatus.classList.toggle("connected", isConnected);
  connectionStatus.classList.toggle("disconnected", !isConnected);
  connectionStatus.textContent = isConnected
    ? "Connected."
    : "Cannot reach the ATB room server. Start the server launcher, then refresh this page.";
}

async function action(payload) {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state = await response.json();
  render();
  return state;
}

function setMode(next) {
  mode = next;
  localStorage.setItem("sa-atb-mode", mode);
  render();
}

function unitCard(unit, { gm = false } = {}) {
  const ready = unit.atb >= state.threshold;
  return `
    <article class="unit-card ${ready ? "ready" : ""}">
      <div class="unit-top">
        <div>
          <div class="unit-name">${escapeHtml(unit.characterName)}</div>
          <div class="unit-owner">${escapeHtml(unit.playerName)} - Speed ${unit.speed}</div>
        </div>
        <div>${Math.floor(unit.atb)}/${state.threshold}</div>
        ${
          gm
            ? `<div class="unit-actions">
                <button class="mini" data-action="nudge" data-id="${unit.id}">+1 Tick</button>
                <button class="mini danger" data-action="remove" data-id="${unit.id}">Remove</button>
              </div>`
            : ""
        }
      </div>
      <div class="meter"><div class="fill" style="width:${pct(unit)}%"></div></div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

function statusText() {
  if (!state) return "Connecting";
  if (state.pausedForTurn) return "Turn Paused";
  return state.running ? "Running" : "Paused";
}

function notifyTurnIfNeeded() {
  if (!state) return;
  const active = state.units.find((unit) => unit.id === state.activeId);
  if (!active) {
    if (turnDialog.open) turnDialog.close();
    return;
  }

  if (mode === "gm") {
    activeName.textContent = active.characterName;
    activeOwner.textContent = active.playerName;
    if (!turnDialog.open) turnDialog.showModal();
  }

  if (mode === "player" && active.id === myUnitId) {
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    tryBeep();
  }
}

function tryBeep() {
  try {
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = 660;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.14);
  } catch {
    // Phone browsers may block audio until a tap. The turn banner still works.
  }
}

function render() {
  if (!state) return;

  roomCode.textContent = state.roomCode;
  joinPanel.classList.toggle("hidden", mode !== "join");
  gmPanel.classList.toggle("hidden", mode !== "gm");
  playerPanel.classList.toggle("hidden", mode !== "player");

  const ready = state.units.filter((unit) => unit.atb >= state.threshold);
  readyCount.textContent = `${ready.length} Ready`;
  clockState.textContent = statusText();
  playerClock.textContent = statusText();
  toggleRun.textContent = state.running ? "Pause" : "Start";

  const sorted = [...state.units].sort((a, b) => b.atb - a.atb || b.speed - a.speed);
  unitList.innerHTML = sorted.map((unit) => unitCard(unit, { gm: mode === "gm" })).join("");

  const mine = state.units.find((unit) => unit.id === myUnitId);
  if (mine) {
    myCharacter.textContent = mine.characterName;
    myUnitCard.innerHTML = unitCard(mine);
    myTurnBanner.classList.toggle("hidden", state.activeId !== mine.id);
  } else if (mode === "player") {
    myCharacter.textContent = "Not Connected";
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
    controlledBy: "player",
  });
  const unit = next.units[next.units.length - 1];
  myUnitId = unit.id;
  localStorage.setItem("sa-atb-unit-id", myUnitId);
  setMode("player");
});

openGm.addEventListener("click", () => setMode("gm"));

toggleRun.addEventListener("click", () => action({ action: "setRunning", running: !state.running }));
stepTick.addEventListener("click", () => action({ action: "step" }));
resetAll.addEventListener("click", () => action({ action: "reset" }));
completeTurn.addEventListener("click", () => action({ action: "completeTurn" }));

gmAddUnit.addEventListener("click", () => {
  action({
    action: "addUnit",
    playerName: gmPlayerName.value || "GM",
    characterName: gmCharacterName.value || "NPC",
    speed: gmSpeedRating.value || 5,
    controlledBy: "gm",
  });
  gmCharacterName.value = "";
});

unitList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || mode !== "gm") return;
  const id = button.dataset.id;
  if (button.dataset.action === "remove") action({ action: "removeUnit", id });
  if (button.dataset.action === "nudge") action({ action: "nudge", id, amount: 1 });
});

const events = new EventSource("/events");
events.addEventListener("state", (event) => {
  setConnected(true);
  state = JSON.parse(event.data);
  render();
});
events.addEventListener("error", () => {
  setConnected(false);
});
