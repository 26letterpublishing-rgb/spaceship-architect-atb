const STORAGE_KEY = "sa-starship-layout-draft";
const VIEW_STORAGE_KEY = "sa-starship-map-view";
const BUILD_VERSION = 3;
const HULL_COST = 1000;
const EN_ENGINE_COST = 1750;
const GRID_SIZE = 20;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadMapView() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || "{}");
    return {
      labels: saved.labels !== false,
      highResolution: Boolean(saved.highResolution),
      combatMesh: Boolean(saved.combatMesh),
      walls: saved.walls !== false,
    };
  } catch { return { labels: true, highResolution: false, combatMesh: false, walls: true }; }
}

function constructionState(source) {
  const placements = Array.isArray(source?.placements)
    ? source.placements.filter((item) => item?.sicId && Number.isInteger(item.cell)).map((item) => ({ sicId: String(item.sicId), cell: item.cell }))
    : [];
  const placedIds = new Set(placements.map((item) => item.sicId));
  return {
    groupCredits: Number.isFinite(Number(source?.groupCredits)) ? Number(source.groupCredits) : 999999,
    gridCells: Array.isArray(source?.gridCells)
      ? [...new Set(source.gridCells.filter((value) => Number.isInteger(value) && value >= 0 && value < 400))].sort((a, b) => a - b)
      : [],
    sicInventory: Array.isArray(source?.sicInventory)
      ? source.sicInventory.filter((item) => item?.id && item.type === "en-engine-1").map((item) => ({
          id: String(item.id), type: "en-engine-1", pendingPurchase: Boolean(item.pendingPurchase),
          storage: !placedIds.has(String(item.id)) && !item.pendingPurchase ? item.storage !== false : false,
          pendingDisposition: item.pendingDisposition === "sell" || item.pendingDisposition === "destroy" ? item.pendingDisposition : "",
        }))
      : [],
    placements,
  };
}

function defaultDraft() {
  const initial = constructionState({});
  return {
    buildVersion: BUILD_VERSION,
    title: "", affiliation: "", class: "",
    reputationSelections: [5, 5, 5, 5, 5], popularity: 0,
    doorStates: {},
    crewCharacterIds: [], crewmemberNames: [],
    ...initial, confirmed: clone(initial),
  };
}

function loadDraft() {
  const fresh = defaultDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const identity = {
      title: saved.title || "", affiliation: saved.affiliation || "", class: saved.class || "",
      reputationSelections: Array.isArray(saved.reputationSelections) && saved.reputationSelections.length === 5
        ? saved.reputationSelections.map((value) => Math.max(0, Math.min(10, Number(value) || 0))) : fresh.reputationSelections,
      popularity: Math.max(0, Math.min(100, Number(saved.popularity) || 0)),
      doorStates: saved.doorStates && typeof saved.doorStates === "object" ? saved.doorStates : {},
      crewCharacterIds: Array.isArray(saved.crewCharacterIds) ? saved.crewCharacterIds.map(String) : [],
      crewmemberNames: Array.isArray(saved.crewmemberNames) ? saved.crewmemberNames.map(String) : [],
    };
    if (saved.buildVersion !== BUILD_VERSION) return { ...fresh, ...identity };
    const working = constructionState(saved);
    const confirmed = constructionState(saved.confirmed || working);
    return { ...fresh, ...identity, ...working, confirmed, buildVersion: BUILD_VERSION };
  } catch { return fresh; }
}

let draft = loadDraft();
let mapView = loadMapView();
let undoState = null;
let selectedSicId = null;
let mobilePreviewCell = null;
let validation = { errors: [], cells: new Set() };

const SIDES = [
  { name: "top", offset: -GRID_SIZE, valid: (index) => index >= GRID_SIZE },
  { name: "right", offset: 1, valid: (index) => index % GRID_SIZE < GRID_SIZE - 1 },
  { name: "bottom", offset: GRID_SIZE, valid: (index) => index < GRID_SIZE * (GRID_SIZE - 1) },
  { name: "left", offset: -1, valid: (index) => index % GRID_SIZE > 0 },
];

const shipFields = [...document.querySelectorAll("[data-ship-field]")];
const shipGrids = [...document.querySelectorAll(".ship-grid")];
const totalSquareOutputs = [...document.querySelectorAll("[data-total-squares]")];
const constructionMessages = [...document.querySelectorAll("[data-construction-message]")];
const confirmButtons = [...document.querySelectorAll('[data-construction-action="confirm"]')];
const undoButtons = [...document.querySelectorAll('[data-construction-action="undo"]')];
const discardButtons = [...document.querySelectorAll('[data-construction-action="discard"]')];
const mobilePlacementControls = document.querySelector("#mobilePlacementControls");
const mapViewToggles = [...document.querySelectorAll("[data-map-toggle]")];

function saveDraft() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* Keep the editor usable in private contexts. */ }
}
function saveMapView() {
  try { localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(mapView)); } catch { /* View preferences may remain session-only. */ }
}
function formatCredits(value) { return Math.round(value).toLocaleString("en-US"); }
function getWorkingState() { return constructionState(draft); }
function restoreWorkingState(state) {
  const restored = constructionState(state);
  draft.groupCredits = restored.groupCredits;
  draft.gridCells = restored.gridCells;
  draft.sicInventory = restored.sicInventory;
  draft.placements = restored.placements;
}
function statesMatch(left, right) { return JSON.stringify(constructionState(left)) === JSON.stringify(constructionState(right)); }
function rememberForUndo() { undoState = getWorkingState(); }
function pendingCost() {
  const workingCells = new Set(draft.gridCells);
  const confirmedCells = new Set(draft.confirmed.gridCells);
  const additions = [...workingCells].filter((cell) => !confirmedCells.has(cell)).length;
  const removals = [...confirmedCells].filter((cell) => !workingCells.has(cell)).length;
  const engines = draft.sicInventory.filter((item) => item.pendingPurchase).length;
  const soldEngines = draft.sicInventory.filter((item) => !item.pendingPurchase && item.pendingDisposition === "sell").length;
  return ((additions - removals) * HULL_COST) + (engines * EN_ENGINE_COST) - (soldEngines * Math.ceil(EN_ENGINE_COST / 2));
}
function selectedSic() {
  return draft.sicInventory.find((item) => item.id === selectedSicId && !item.storage && !item.pendingDisposition) || null;
}
function placementAt(cell) { return draft.placements.find((placement) => placement.cell === cell) || null; }
function placementForSic(sicId) { return draft.placements.find((placement) => placement.sicId === sicId) || null; }

function doorKey(firstCell, secondCell) {
  return [firstCell, secondCell].sort((left, right) => left - right).join(":");
}

function currentDoorOperator() {
  const parameters = new URLSearchParams(location.search);
  const requestedCharacterId = parameters.get("character") || localStorage.getItem("sa2e-active-character-v1") || "";
  try {
    const library = JSON.parse(localStorage.getItem("sa2e-character-library-v1") || "[]");
    const character = Array.isArray(library) ? library.find((entry) => entry?.id === requestedCharacterId) : null;
    return character ? { id: character.id, name: String(character.identity?.characterName || "").trim() } : null;
  } catch { return null; }
}

function canOperateDoors() {
  const parameters = new URLSearchParams(location.search);
  const operator = currentDoorOperator();
  const crewIds = Array.isArray(draft.crewCharacterIds) ? draft.crewCharacterIds : [];
  const crewNames = Array.isArray(draft.crewmemberNames) ? draft.crewmemberNames.map((name) => String(name).trim().toLowerCase()) : [];
  if (!parameters.has("character")) return true;
  if (!operator) return false;
  return crewIds.includes(operator.id) || crewNames.includes(operator.name.toLowerCase());
}

function makeWall(side, segment = "full") {
  const wall = document.createElement("span");
  wall.className = `sic-wall sic-wall-${side} sic-wall-${segment}`;
  wall.setAttribute("aria-hidden", "true");
  return wall;
}

function toggleDoor(key) {
  if (!canOperateDoors()) {
    showMessage("Only a listed crewmember can operate this door.", "error");
    return;
  }
  draft.doorStates ||= {};
  draft.doorStates[key] = draft.doorStates[key] === "open" ? "closed" : "open";
  saveDraft();
  renderGridCells();
}

function makeDoor(index, adjacent, side) {
  const key = doorKey(index, adjacent);
  const open = draft.doorStates?.[key] === "open";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sic-door sic-door-${side}${open ? " is-open" : ""}`;
  button.dataset.doorKey = key;
  button.disabled = !canOperateDoors();
  button.title = button.disabled ? "Only a listed crewmember can operate this door" : `${open ? "Close" : "Open"} door`;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(open));
  const first = document.createElement("span");
  const second = document.createElement("span");
  first.className = "door-panel door-panel-first";
  second.className = "door-panel door-panel-second";
  button.append(first, second);
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", (event) => { event.stopPropagation(); toggleDoor(key); });
  return button;
}

function renderEngineBoundaries(cell, index, hull) {
  SIDES.forEach((side) => {
    const adjacent = index + side.offset;
    if (!side.valid(index) || !hull.has(adjacent)) {
      cell.append(makeWall(side.name));
      return;
    }
    cell.append(makeWall(side.name, "start"), makeWall(side.name, "end"), makeDoor(index, adjacent, side.name));
  });
}

function shipScaleStats(squareCount) {
  const count = Number(squareCount) || 0;
  if (count < 4) return { hsm: "--", scale: "--" };
  const rows = [
    [4, 4, 20, 1], [5, 5, 19, 1], [6, 6, 18, 1], [7, 7, 17, 1], [8, 8, 16, 1],
    [9, 9, 15, 1], [10, 10, 14, 1], [11, 11, 13, 1], [12, 12, 12, 1], [13, 13, 11, 1],
    [14, 14, 10, 1], [15, 16, 9, 1], [17, 18, 8, 1], [19, 20, 7, 1], [21, 23, 6, 1],
    [24, 26, 5, 1], [27, 30, 4, 2], [31, 34, 3, 2], [35, 40, 2, 2], [41, 50, 1, 2],
    [51, 70, 0, 3], [71, 90, -1, 3], [91, 100, -2, 3], [101, 120, -3, 4], [121, 150, -4, 4],
    [151, 200, -5, 4], [201, 250, -6, 5], [251, 300, -7, 5], [301, 350, -8, 5], [351, 400, -9, 5],
  ];
  const match = rows.find(([minimum, maximum]) => count >= minimum && count <= maximum);
  if (match) return { hsm: match[2], scale: match[3] };
  return { hsm: -10 - Math.floor((count - 401) / 50), scale: 5 };
}
function orthogonalNeighbors(cell) {
  const row = Math.floor(cell / GRID_SIZE);
  const column = cell % GRID_SIZE;
  const neighbors = [];
  if (row > 0) neighbors.push(cell - GRID_SIZE);
  if (row < GRID_SIZE - 1) neighbors.push(cell + GRID_SIZE);
  if (column > 0) neighbors.push(cell - 1);
  if (column < GRID_SIZE - 1) neighbors.push(cell + 1);
  return neighbors;
}
function isLegalEnginePlacement(sicId, cell) {
  if (!draft.gridCells.includes(cell)) return { legal: false, reason: "Purchase this hull square first." };
  const occupant = placementAt(cell);
  if (occupant && occupant.sicId !== sicId) return { legal: false, reason: "That hull square already contains a SIC." };
  const touchingEngine = draft.placements.some((placement) => placement.sicId !== sicId && orthogonalNeighbors(cell).includes(placement.cell));
  if (touchingEngine) return { legal: false, reason: "Engines require one clear horizontal or vertical square between them." };
  return { legal: true, reason: "Legal EN Engine 1 placement." };
}
function disconnectedHullCells() {
  if (draft.gridCells.length < 2) return [];
  const hull = new Set(draft.gridCells);
  const visited = new Set([draft.gridCells[0]]);
  const queue = [draft.gridCells[0]];
  while (queue.length) {
    const cell = queue.shift();
    orthogonalNeighbors(cell).forEach((neighbor) => {
      if (hull.has(neighbor) && !visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
    });
  }
  return draft.gridCells.filter((cell) => !visited.has(cell));
}
function inspectConstruction() {
  const errors = [];
  const cells = new Set();
  const disconnected = disconnectedHullCells();
  if (disconnected.length) {
    errors.push("Every hull square must connect horizontally or vertically to the rest of the ship.");
    disconnected.forEach((cell) => cells.add(cell));
  }
  const seenCells = new Set();
  draft.placements.forEach((placement) => {
    if (!draft.gridCells.includes(placement.cell)) { errors.push("A SIC is installed outside the purchased hull."); cells.add(placement.cell); }
    if (seenCells.has(placement.cell)) { errors.push("Two SICs occupy the same hull square."); cells.add(placement.cell); }
    seenCells.add(placement.cell);
  });
  for (let index = 0; index < draft.placements.length; index += 1) {
    for (let other = index + 1; other < draft.placements.length; other += 1) {
      const left = draft.placements[index].cell;
      const right = draft.placements[other].cell;
      if (orthogonalNeighbors(left).includes(right)) {
        errors.push("EN Engines cannot touch horizontally or vertically."); cells.add(left); cells.add(right);
      }
    }
  }
  if (pendingCost() > draft.groupCredits) errors.push("Group Credits are insufficient for these changes.");
  return { errors: [...new Set(errors)], cells };
}

function syncShipField(key, value, source) {
  draft[key] = value;
  shipFields.forEach((field) => { if (field !== source && field.dataset.shipField === key) field.value = value; });
  saveDraft();
}
function clearPlacementPreview() {
  shipGrids.forEach((grid) => grid.querySelectorAll(".placement-preview").forEach((cell) => cell.classList.remove("placement-preview", "is-valid", "is-invalid")));
}
function previewPlacement(cellIndex, cellElement) {
  clearPlacementPreview();
  if (!selectedSic()) return;
  const result = isLegalEnginePlacement(selectedSicId, cellIndex);
  cellElement.classList.add("placement-preview", result.legal ? "is-valid" : "is-invalid");
}
function cancelPlacement() { selectedSicId = null; mobilePreviewCell = null; clearPlacementPreview(); renderAll(); }
function placeSelectedSic(cell) {
  const sic = selectedSic();
  if (!sic) return;
  const result = isLegalEnginePlacement(sic.id, cell);
  if (!result.legal) { showMessage(result.reason, "error"); return; }
  rememberForUndo();
  draft.placements = draft.placements.filter((placement) => placement.sicId !== sic.id);
  draft.placements.push({ sicId: sic.id, cell });
  selectedSicId = null; mobilePreviewCell = null;
  saveDraft();
  showMessage("EN Engine 1 placed. Confirm Changes to apply it to the ship.", "success");
  renderAll();
}
function removePlacedSic(placement) {
  rememberForUndo();
  const item = draft.sicInventory.find((sic) => sic.id === placement.sicId);
  draft.placements = draft.placements.filter((entry) => entry.sicId !== placement.sicId);
  if (item) item.storage = !item.pendingPurchase;
  saveDraft();
  showMessage(item?.pendingPurchase ? "EN Engine 1 returned to the Installation Queue." : "EN Engine 1 moved into Storage.");
  renderAll();
}
function toggleHullCell(index) {
  const occupied = placementAt(index);
  if (occupied) { removePlacedSic(occupied); return; }
  rememberForUndo();
  const hull = new Set(draft.gridCells);
  if (hull.has(index)) hull.delete(index); else hull.add(index);
  draft.gridCells = [...hull].sort((a, b) => a - b);
  saveDraft(); renderAll();
}
function handleGridClick(index, cell, mobile) {
  validation = { errors: [], cells: new Set() };
  if (!selectedSic()) { toggleHullCell(index); return; }
  if (mobile) { mobilePreviewCell = index; previewPlacement(index, cell); renderMobilePlacement(); return; }
  placeSelectedSic(index);
}
function renderGridCells() {
  const hull = new Set(draft.gridCells);
  const placementMap = new Map(draft.placements.map((placement) => [placement.cell, placement]));
  const placementActive = Boolean(selectedSic());
  shipGrids.forEach((grid) => {
    grid.classList.toggle("show-sic-labels", mapView.labels);
    grid.classList.toggle("high-resolution", mapView.highResolution && !placementActive);
    grid.classList.toggle("combat-mesh", mapView.combatMesh);
    grid.classList.toggle("show-walls", mapView.walls && !placementActive);
    grid.classList.toggle("placement-active", placementActive);
    grid.querySelectorAll(".ship-grid-cell").forEach((cell) => {
      const index = Number(cell.dataset.gridIndex);
      const placement = placementMap.get(index);
      cell.classList.toggle("is-selected", hull.has(index));
      cell.classList.toggle("has-engine", Boolean(placement));
      cell.classList.toggle("construction-error", validation.cells.has(index));
      cell.replaceChildren();
      if (placement && mapView.walls && !placementActive) renderEngineBoundaries(cell, index, hull);
      if (placement && mapView.labels) {
        const label = document.createElement("span");
        label.className = "sic-grid-label";
        label.textContent = "EN 1";
        cell.append(label);
      }
      cell.setAttribute("aria-pressed", String(hull.has(index)));
      cell.setAttribute("aria-label", placement ? `Ship grid square ${index + 1}, EN Engine 1` : `Ship grid square ${index + 1}`);
    });
  });
  totalSquareOutputs.forEach((output) => { output.value = String(hull.size); output.textContent = String(hull.size); });
}

function renderMapViewControls() {
  const placementActive = Boolean(selectedSic());
  mapViewToggles.forEach((toggle) => {
    const key = toggle.dataset.mapToggle;
    toggle.checked = Boolean(mapView[key]);
    const label = toggle.closest("label");
    const suspended = (key === "highResolution" || key === "walls") && placementActive && mapView[key];
    label?.classList.toggle("is-suspended", suspended);
    if (label) label.title = suspended ? "Basic placement view remains visible while placing a SIC." : "";
  });
}
function renderMobilePlacement() {
  if (!mobilePlacementControls) return;
  const active = Boolean(selectedSic()) && mobilePreviewCell !== null;
  mobilePlacementControls.hidden = !active;
  if (!active) return;
  const result = isLegalEnginePlacement(selectedSicId, mobilePreviewCell);
  mobilePlacementControls.dataset.valid = String(result.legal);
  mobilePlacementControls.querySelector("[data-mobile-placement-message]").textContent = result.reason;
  mobilePlacementControls.querySelector("[data-mobile-place]").disabled = !result.legal;
}
const inventoryHeadings = {
  pending: ["Pending Purchases", "New SICs awaiting confirmation."],
  queue: ["Installation Queue", "Select a SIC, then choose its hull square."],
  installed: ["Installed", "Operational SICs currently inside the ship."],
  storage: ["Storage", "Owned SICs currently kept off the ship."],
};

function inventoryGroup(kind) {
  return draft.sicInventory.filter((item) => {
    const placement = placementForSic(item.id);
    if (kind === "pending") return Boolean(item.pendingDisposition) || (item.pendingPurchase && !placement);
    if (item.pendingDisposition) return false;
    if (kind === "queue") return !item.pendingPurchase && !placement && !item.storage;
    if (kind === "installed") return Boolean(placement);
    return !placement && item.storage && !item.pendingPurchase;
  });
}

function inventoryButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button"; button.textContent = label; button.className = className || "";
  button.addEventListener("click", handler); return button;
}

function locateInstalledSic(item) {
  const placement = placementForSic(item.id);
  if (!placement) return;
  shipGrids.forEach((grid) => {
    if (grid.offsetParent === null) return;
    const cell = grid.querySelector(`[data-grid-index="${placement.cell}"]`);
    if (!cell) return;
    cell.classList.add("located-sic");
    cell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setTimeout(() => cell.classList.remove("located-sic"), 1800);
  });
}

function renderInventoryList(container, kind) {
  container.replaceChildren();
  const [title, description] = inventoryHeadings[kind];
  const header = document.createElement("header");
  header.innerHTML = `<strong>${title}</strong><small>${description}</small>`; container.append(header);
  const items = inventoryGroup(kind);
  if (!items.length) {
    const empty = document.createElement("span"); empty.className = "empty-inventory"; empty.textContent = "None"; container.append(empty); return;
  }
  items.forEach((item) => {
    const card = document.createElement("article"); card.className = `inventory-sic inventory-${kind}`;
    const placement = placementForSic(item.id);
    const name = document.createElement("div"); name.className = "inventory-sic-name";
    const detail = item.pendingDisposition === "sell" ? "Sale pending · +875 cr"
      : item.pendingDisposition === "destroy" ? "Destruction pending"
        : placement ? `Grid ${Math.floor(placement.cell / GRID_SIZE) + 1}, ${placement.cell % GRID_SIZE + 1}` : `1 square · ${formatCredits(EN_ENGINE_COST)} cr`;
    name.innerHTML = `<strong>EN Engine 1</strong><small>${detail}</small>`;
    const actions = document.createElement("div"); actions.className = "inventory-sic-actions";
    if (kind === "pending" && item.pendingDisposition) {
      actions.append(inventoryButton("Keep SIC", "keep-sic", () => {
        rememberForUndo(); item.pendingDisposition = ""; saveDraft(); showMessage("The SIC will remain in Storage."); renderAll();
      }));
    } else if (kind === "pending" || kind === "queue") {
      actions.append(inventoryButton(selectedSicId === item.id ? "Cancel Placement" : "Place", selectedSicId === item.id ? "is-selected" : "", () => {
        selectedSicId = selectedSicId === item.id ? null : item.id; mobilePreviewCell = null; clearPlacementPreview(); renderAll();
      }));
      if (item.pendingPurchase) actions.append(inventoryButton("Refund in Full", "refund-sic", () => refundPendingSic(item)));
      else actions.append(inventoryButton("To Storage", "store-sic", () => moveSicToStorage(item)));
    } else if (kind === "installed") {
      actions.append(inventoryButton("Locate", "locate-sic", () => locateInstalledSic(item)));
      actions.append(inventoryButton("Remove", "store-sic", () => removePlacedSic(placement)));
    } else {
      actions.append(inventoryButton("Install", "install-sic", () => moveSicToQueue(item)));
      actions.append(inventoryButton("Sell 875", "sell-sic", () => markSicDisposition(item, "sell")));
      actions.append(inventoryButton("Destroy", "destroy-sic", () => markSicDisposition(item, "destroy")));
    }
    card.append(name, actions); container.append(card);
  });
}

function refundPendingSic(item) {
  rememberForUndo(); draft.placements = draft.placements.filter((entry) => entry.sicId !== item.id);
  draft.sicInventory = draft.sicInventory.filter((sic) => sic.id !== item.id);
  if (selectedSicId === item.id) selectedSicId = null;
  saveDraft(); showMessage("Pending EN Engine 1 refunded in full."); renderAll();
}
function moveSicToStorage(item) {
  rememberForUndo(); item.storage = true; if (selectedSicId === item.id) selectedSicId = null;
  saveDraft(); showMessage("EN Engine 1 moved into Storage."); renderAll();
}
function moveSicToQueue(item) {
  rememberForUndo(); item.storage = false; item.pendingDisposition = ""; selectedSicId = item.id;
  saveDraft(); showMessage("EN Engine 1 moved to the Installation Queue. Select a hull square."); renderAll();
}
function markSicDisposition(item, disposition) {
  const message = disposition === "sell"
    ? "Sell this EN Engine 1 for 875 credits when changes are confirmed?"
    : "Destroy this EN Engine 1 permanently when changes are confirmed?";
  if (!window.confirm(message)) return;
  rememberForUndo(); item.pendingDisposition = disposition; item.storage = true;
  saveDraft(); showMessage(disposition === "sell" ? "EN Engine 1 marked for sale." : "EN Engine 1 marked for destruction."); renderAll();
}

function renderInventory() {
  document.querySelectorAll("[data-sic-list]").forEach((container) => renderInventoryList(container, container.dataset.sicList));
}
function renderLiveStats() {
  const confirmed = constructionState(draft.confirmed);
  const hull = confirmed.gridCells.length;
  const en = confirmed.placements.length * 5;
  const scale = shipScaleStats(hull);
  document.querySelectorAll('[data-live-stat="hull"]').forEach((element) => { element.textContent = String(hull); });
  document.querySelectorAll('[data-live-stat="en"]').forEach((element) => { element.textContent = String(en); });
  document.querySelectorAll('[data-live-stat="hsm"]').forEach((element) => { element.textContent = String(scale.hsm); });
  document.querySelectorAll('[data-live-stat="credits"], [data-group-credits]').forEach((element) => { element.textContent = formatCredits(confirmed.groupCredits); });
  document.querySelectorAll("[data-confirmed-scale]").forEach((element) => { element.value = String(scale.scale); element.textContent = String(scale.scale); });
}
function showMessage(message, tone = "info") {
  constructionMessages.forEach((element) => { element.textContent = message; element.dataset.tone = tone; });
}
function renderConstructionControls() {
  validation = inspectConstruction();
  const cost = pendingCost();
  document.querySelectorAll("[data-pending-total]").forEach((element) => {
    element.textContent = cost < 0 ? `${formatCredits(Math.abs(cost))} refund` : formatCredits(cost);
  });
  const workingScale = shipScaleStats(draft.gridCells.length);
  document.querySelectorAll("[data-working-hsm]").forEach((element) => { element.textContent = String(workingScale.hsm); });
  document.querySelectorAll("[data-working-scale]").forEach((element) => { element.textContent = String(workingScale.scale); });
  const changed = !statesMatch(draft, draft.confirmed);
  confirmButtons.forEach((confirmButton) => {
    confirmButton.disabled = !changed;
    confirmButton.classList.toggle("has-error", validation.errors.length > 0);
    const costLabel = cost === 0 ? "" : ` (${cost < 0 ? "+" : "-"}${formatCredits(Math.abs(cost))})`;
    confirmButton.textContent = validation.errors.length ? "ERROR" : `Confirm Changes${changed ? costLabel : ""}`;
  });
  undoButtons.forEach((button) => { button.disabled = !undoState; });
  discardButtons.forEach((button) => { button.disabled = !changed; });
}
function renderAll() {
  renderGridCells(); renderMapViewControls(); renderInventory(); renderLiveStats(); renderMobilePlacement(); renderConstructionControls();
}

shipFields.forEach((field) => {
  const key = field.dataset.shipField; field.value = draft[key] || "";
  field.addEventListener("input", () => syncShipField(key, field.value, field));
});
shipGrids.forEach((grid) => {
  const mobile = grid.classList.contains("mobile-grid");
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 400; index += 1) {
    const cell = document.createElement("span");
    cell.className = "ship-grid-cell"; cell.dataset.gridIndex = String(index); cell.tabIndex = 0;
    cell.setAttribute("role", "gridcell"); cell.setAttribute("aria-label", `Ship grid square ${index + 1}`);
    cell.addEventListener("pointerenter", () => { if (!mobile && selectedSic()) previewPlacement(index, cell); });
    cell.addEventListener("pointerleave", () => { if (!mobile) clearPlacementPreview(); });
    cell.addEventListener("click", () => handleGridClick(index, cell, mobile));
    cell.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); handleGridClick(index, cell, mobile);
    });
    fragment.append(cell);
  }
  grid.append(fragment);
});
document.querySelector("[data-mobile-place]")?.addEventListener("click", () => { if (mobilePreviewCell !== null) placeSelectedSic(mobilePreviewCell); });
document.querySelectorAll("[data-cancel-placement]").forEach((button) => button.addEventListener("click", cancelPlacement));
mapViewToggles.forEach((toggle) => toggle.addEventListener("change", () => {
  mapView[toggle.dataset.mapToggle] = toggle.checked;
  saveMapView(); renderAll();
}));
document.querySelector("#purchaseEnEngine")?.addEventListener("click", () => {
  rememberForUndo();
  const id = `en-engine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  draft.sicInventory.push({ id, type: "en-engine-1", pendingPurchase: true, storage: false, pendingDisposition: "" });
  selectedSicId = id; saveDraft();
  document.querySelector('[data-starship-tab="sheet"]')?.click();
  showMessage("EN Engine 1 added to pending purchases. Select a hull square to install it.", "success"); renderAll();
});
function undoConstruction() {
  if (!undoState) return;
  const current = getWorkingState(); restoreWorkingState(undoState); undoState = current;
  selectedSicId = null; mobilePreviewCell = null; validation = { errors: [], cells: new Set() };
  saveDraft(); showMessage("The last construction decision was undone."); renderAll();
}
function discardConstruction() {
  rememberForUndo(); restoreWorkingState(draft.confirmed);
  selectedSicId = null; mobilePreviewCell = null; validation = { errors: [], cells: new Set() };
  saveDraft(); showMessage("All unconfirmed construction changes were discarded."); renderAll();
}
function confirmConstruction() {
  validation = inspectConstruction();
  if (validation.errors.length) {
    showMessage(validation.errors.join(" "), "error"); renderGridCells(); renderConstructionControls(); return;
  }
  const cost = pendingCost();
  draft.groupCredits -= cost;
  const removedIds = new Set(draft.sicInventory.filter((item) => item.pendingDisposition).map((item) => item.id));
  draft.placements = draft.placements.filter((placement) => !removedIds.has(placement.sicId));
  draft.sicInventory = draft.sicInventory.filter((item) => !item.pendingDisposition);
  draft.sicInventory.forEach((item) => {
    item.pendingPurchase = false; item.pendingDisposition = "";
    item.storage = !placementForSic(item.id);
  });
  draft.confirmed = constructionState(draft);
  undoState = null; selectedSicId = null; mobilePreviewCell = null;
  saveDraft();
  showMessage(`Construction confirmed. ${cost < 0 ? `${formatCredits(Math.abs(cost))} credits refunded.` : `${formatCredits(cost)} credits spent.`}`, "success");
  renderAll();
}
undoButtons.forEach((button) => button.addEventListener("click", undoConstruction));
discardButtons.forEach((button) => button.addEventListener("click", discardConstruction));
confirmButtons.forEach((button) => button.addEventListener("click", confirmConstruction));
document.querySelectorAll("[data-starship-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.starshipTab;
    document.querySelectorAll("[data-starship-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    document.querySelectorAll("[data-starship-panel]").forEach((panel) => {
      const active = panel.dataset.starshipPanel === target; panel.classList.toggle("is-active", active); panel.hidden = !active;
    });
  });
});

const sicCard = document.querySelector(".sic-poker-card");
const sicCardDialog = document.querySelector("#sicCardDialog");
function openSicCard() {
  if (!sicCard || !sicCardDialog) return;
  const cloneCard = sicCard.cloneNode(true); cloneCard.removeAttribute("tabindex");
  sicCardDialog.querySelector("[data-sic-card-dialog-body]").replaceChildren(cloneCard);
  if (typeof sicCardDialog.showModal === "function") sicCardDialog.showModal();
}
sicCard?.addEventListener("click", openSicCard);
sicCard?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSicCard(); } });
document.querySelector("[data-close-sic-card]")?.addEventListener("click", () => sicCardDialog?.close());
sicCardDialog?.addEventListener("click", (event) => { if (event.target === sicCardDialog) sicCardDialog.close(); });

const reputationValues = ["+5", "+4", "+3", "+2", "+1", "0", "+1", "+2", "+3", "+4", "+5"];
const reputationNames = [["Benevolent", "Ruthless"], ["Virtuous", "Treacherous"], ["Civil", "Savage"], ["Powerful", "Weak"], ["Cunning", "Exploitable"]];
function renderReputationSelections() {
  document.querySelectorAll(".reputation-position").forEach((position) => {
    const selected = draft.reputationSelections[Number(position.dataset.row)] === Number(position.dataset.index);
    position.classList.toggle("selected", selected); position.setAttribute("aria-pressed", String(selected));
    position.querySelectorAll("circle, text").forEach((element) => element.classList.toggle("selected", selected));
  });
}
function chooseReputation(rowIndex, index) { draft.reputationSelections[rowIndex] = index; renderReputationSelections(); saveDraft(); }
document.querySelectorAll(".reputation-chart").forEach((chart) => {
  chart.querySelectorAll(".reputation-row > g").forEach((track, rowIndex) => {
    const isDesktopTrack = chart.classList.contains("desktop-reputation-chart");
    reputationValues.forEach((value, index) => {
      const position = document.createElementNS("http://www.w3.org/2000/svg", "g");
      position.classList.add("reputation-position"); position.dataset.row = String(rowIndex); position.dataset.index = String(index);
      position.setAttribute("transform", `translate(${index * 29} 0)`); position.setAttribute("role", "button"); position.setAttribute("tabindex", "0");
      const [leftName, rightName] = reputationNames[rowIndex];
      position.setAttribute("aria-label", `${index < 5 ? leftName : index > 5 ? rightName : "Neutral"} ${value}`);
      position.addEventListener("click", () => chooseReputation(rowIndex, index));
      position.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault(); chooseReputation(rowIndex, index);
      });
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "0"); circle.setAttribute("cy", "0"); circle.setAttribute("r", isDesktopTrack ? "9.5" : "11.5"); position.append(circle);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "0"); label.setAttribute("y", "3"); label.textContent = value; position.append(label); track.append(position);
    });
  });
});
const popularityInputs = [...document.querySelectorAll("[data-reputation-popularity]")];
function syncPopularity(value, source) {
  if (value === "") return;
  draft.popularity = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  popularityInputs.forEach((input) => { if (input !== source) input.value = String(draft.popularity); }); saveDraft();
}
popularityInputs.forEach((input) => {
  input.value = String(draft.popularity);
  input.addEventListener("input", () => syncPopularity(input.value, input));
  input.addEventListener("change", () => {
    input.value = String(Math.max(0, Math.min(100, Math.round(Number(input.value) || 0)))); syncPopularity(input.value, input);
  });
});

renderReputationSelections();
renderAll();
