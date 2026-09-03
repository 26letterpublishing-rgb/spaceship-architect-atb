const STORAGE_KEY = "sa-starship-layout-draft";
const LIBRARY_KEY = "sa-starship-library-v1";
const ACTIVE_STARSHIP_KEY = "sa-starship-active-v1";
const VIEW_STORAGE_KEY = "sa-starship-map-view";
const BUILD_VERSION = 3;
const HULL_COST = 1000;
const GRID_SIZE = 20;
const pageParameters = new URLSearchParams(location.search);
const EMBEDDED_GM_MODE = pageParameters.get("embedded") === "gm";
if (EMBEDDED_GM_MODE) document.body.classList.add("embedded-gm-starship");
const backLink = document.querySelector(".back-link");
if (backLink && pageParameters.get("campaign") && pageParameters.get("ship")) {
  backLink.textContent = "Back to Campaign";
  backLink.href = "#";
  backLink.addEventListener("click", (event) => { event.preventDefault(); history.back(); });
}
const SIC_CATALOG = {
  "en-engine-1": { name: "EN Engine 1", shortLabel: "EN 1", category: "engine", price: 1750, width: 1, height: 1, enOutput: 5, energyCost: 0, clearance: 1, ...window.SAShipMap.definition("en-engine-1"), floorplan: window.SAShipMap.definition("en-engine-1").image },
  "en-engine-2": { name: "EN Engine 2", shortLabel: "EN 2", category: "engine", price: 4550, width: 2, height: 2, enOutput: 13, energyCost: 0, clearance: 2, ...window.SAShipMap.definition("en-engine-2"), floorplan: window.SAShipMap.definition("en-engine-2").image },
  "en-engine-3": { name: "EN Engine 3", shortLabel: "EN 3", category: "engine", price: 10150, width: 3, height: 3, enOutput: 29, energyCost: 0, clearance: 3, ...window.SAShipMap.definition("en-engine-3"), floorplan: window.SAShipMap.definition("en-engine-3").image },
  "en-engine-4": { name: "EN Engine 4", shortLabel: "EN 4", category: "engine", price: 17500, width: 4, height: 4, enOutput: 50, energyCost: 0, clearance: 4, ...window.SAShipMap.definition("en-engine-4"), floorplan: window.SAShipMap.definition("en-engine-4").image },
  "en-engine-5": { name: "EN Engine 5", shortLabel: "EN 5", category: "engine", price: 26950, width: 5, height: 5, enOutput: 77, energyCost: 0, clearance: 5, ...window.SAShipMap.definition("en-engine-5"), floorplan: window.SAShipMap.definition("en-engine-5").image },
  "en-engine-6": { name: "EN Engine 6", shortLabel: "EN 6", category: "engine", price: 38500, width: 6, height: 6, enOutput: 110, energyCost: 0, clearance: 6, ...window.SAShipMap.definition("en-engine-6"), floorplan: window.SAShipMap.definition("en-engine-6").image },
  "life-support": { name: "Life Support", shortLabel: "LIFE", category: "utility", price: 1500, width: 2, height: 2, enOutput: 0, energyCost: 2, clearance: 0, ...window.SAShipMap.definition("life-support"), floorplan: window.SAShipMap.definition("life-support").image },
  "nutritional-supplement": { name: "Nut. Supplement", shortLabel: "NUT.", category: "utility", price: 850, width: 1, height: 1, enOutput: 0, energyCost: 3, clearance: 0, ...window.SAShipMap.definition("nutritional-supplement"), floorplan: window.SAShipMap.definition("nutritional-supplement").image },
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uid(prefix = "ship") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }

function loadMapView() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || "{}");
    return {
      labels: saved.labels !== false,
      highResolution: Boolean(saved.highResolution),
      combatMesh: Boolean(saved.combatMesh),
      walls: saved.walls !== false,
      stations: Boolean(saved.stations),
      mode: saved.mode === "explore" ? "explore" : "build",
      zoom: Math.max(0.5, Math.min(4, Number(saved.zoom) || 1)),
      panX: Number(saved.panX) || 0,
      panY: Number(saved.panY) || 0,
    };
  } catch { return { labels: true, highResolution: false, combatMesh: false, walls: true, stations: false, mode: "build", zoom: 1, panX: 0, panY: 0 }; }
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
      ? source.sicInventory.filter((item) => item?.id && SIC_CATALOG[item.type]).map((item) => ({
          id: String(item.id), type: item.type, pendingPurchase: Boolean(item.pendingPurchase),
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
    id: uid(), buildVersion: BUILD_VERSION, confirmedOnce: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    campaignLink: null,
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
    const library = loadStarshipLibrary();
    const activeId = localStorage.getItem(ACTIVE_STARSHIP_KEY) || "";
    const saved = library.find((ship) => ship?.id === activeId) || JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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
    return {
      ...fresh, ...identity, ...working, confirmed, buildVersion: BUILD_VERSION,
      id: String(saved.id || fresh.id), confirmedOnce: Boolean(saved.confirmedOnce),
      createdAt: saved.createdAt || fresh.createdAt, updatedAt: saved.updatedAt || fresh.updatedAt,
      campaignLink: saved.campaignLink && typeof saved.campaignLink === "object" ? saved.campaignLink : null,
    };
  } catch { return fresh; }
}

let draft = loadDraft();
let mapView = loadMapView();
const VIEW_ONLY_MODE = new URLSearchParams(location.search).get("view") === "1";
if (VIEW_ONLY_MODE) mapView.mode = "explore";
document.body.classList.toggle("view-only-starship", VIEW_ONLY_MODE);
let undoState = null;
let selectedSicId = null;
let mobilePreviewCell = null;
let validation = { errors: [], cells: new Set() };
let hullPaint = null;
let suppressGridClick = false;

const shipFields = [...document.querySelectorAll("[data-ship-field]")];
const shipGrids = [...document.querySelectorAll(".ship-grid")];
const totalSquareOutputs = [...document.querySelectorAll("[data-total-squares]")];
const constructionMessages = [...document.querySelectorAll("[data-construction-message]")];
const confirmButtons = [...document.querySelectorAll('[data-construction-action="confirm"]')];
const undoButtons = [...document.querySelectorAll('[data-construction-action="undo"]')];
const discardButtons = [...document.querySelectorAll('[data-construction-action="discard"]')];
const mobilePlacementControls = document.querySelector("#mobilePlacementControls");
const mapViewToggles = [...document.querySelectorAll("[data-map-toggle]")];
const gridModeButtons = [...document.querySelectorAll("[data-grid-mode]")];
const gridZoomButtons = [...document.querySelectorAll("[data-grid-zoom]")];
const gridZoomOutputs = [...document.querySelectorAll("[data-grid-zoom-level]")];

function loadStarshipLibrary() {
  try {
    const ships = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(ships) ? ships : [];
  } catch { return []; }
}
function saveStarshipLibrary(ships) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(ships.slice(-100))); } catch { /* Keep local recovery available. */ }
}
function storeConfirmedStarship() {
  if (!draft.confirmedOnce) return;
  const library = loadStarshipLibrary();
  const index = library.findIndex((ship) => ship?.id === draft.id);
  const saved = clone(draft);
  if (index >= 0) library[index] = saved; else library.push(saved);
  saveStarshipLibrary(library);
  localStorage.setItem(ACTIVE_STARSHIP_KEY, draft.id);
}

function saveDraft() {
  draft.updatedAt = new Date().toISOString();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* Keep the editor usable in private contexts. */ }
  storeConfirmedStarship();
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
  const purchases = draft.sicInventory.filter((item) => item.pendingPurchase).reduce((total, item) => total + SIC_CATALOG[item.type].price, 0);
  const sales = draft.sicInventory.filter((item) => !item.pendingPurchase && item.pendingDisposition === "sell").reduce((total, item) => total + Math.ceil(SIC_CATALOG[item.type].price / 2), 0);
  return ((additions - removals) * HULL_COST) + purchases - sales;
}
function selectedSic() {
  return draft.sicInventory.find((item) => item.id === selectedSicId && !item.storage && !item.pendingDisposition) || null;
}
function sicDefinition(itemOrType) { return SIC_CATALOG[typeof itemOrType === "string" ? itemOrType : itemOrType?.type] || SIC_CATALOG["en-engine-1"]; }
function placementCells(placement) {
  const item = draft.sicInventory.find((entry) => entry.id === placement?.sicId);
  const definition = sicDefinition(item);
  const row = Math.floor(placement.cell / GRID_SIZE); const column = placement.cell % GRID_SIZE;
  const cells = [];
  for (let y = 0; y < definition.height; y += 1) for (let x = 0; x < definition.width; x += 1) {
    if (row + y >= GRID_SIZE || column + x >= GRID_SIZE) return [];
    cells.push(placement.cell + (y * GRID_SIZE) + x);
  }
  return cells;
}
function placementAt(cell) { return draft.placements.find((placement) => placementCells(placement).includes(cell)) || null; }
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
    return character ? {
      id: character.id,
      name: String(character.identity?.characterName || "").trim(),
      campaignCode: String(character.campaignLink?.roomCode || "").trim(),
      campaignStatus: String(character.campaignLink?.status || "unlinked"),
    } : null;
  } catch { return null; }
}

function canOperateDoors() {
  const parameters = new URLSearchParams(location.search);
  const operator = currentDoorOperator();
  const crewIds = Array.isArray(draft.crewCharacterIds) ? draft.crewCharacterIds : [];
  const crewNames = Array.isArray(draft.crewmemberNames) ? draft.crewmemberNames.map((name) => String(name).trim().toLowerCase()) : [];
  const campaignCode = String(parameters.get("campaign") || draft.campaignLink?.roomCode || "").trim();
  if (!campaignCode) return true;
  if (localStorage.getItem(`sa-gm-token-${campaignCode}`)) return true;
  if (!crewIds.length && !crewNames.length && draft.campaignLink?.accessKey) return true;
  if (!operator) return false;
  return crewIds.includes(operator.id) || crewNames.includes(operator.name.toLowerCase());
}

function makeWall(side, segment = "full") {
  const wall = document.createElement("span");
  wall.className = `sic-wall sic-wall-${side} sic-wall-${segment}`;
  wall.setAttribute("aria-hidden", "true");
  wall.style.backgroundColor = "#f8fbff";
  wall.style.boxShadow = "0 0 0 1px #000, inset 0 0 0 1px #000, 0 0 3px rgba(255,255,255,.88)";
  return wall;
}

function toggleDoor(key) {
  if (mapView.mode !== "explore") {
    showMessage("Switch to Explore to operate doors.", "error");
    return;
  }
  if (!canOperateDoors()) {
    showMessage("Only a listed crewmember can operate this door.", "error");
    return;
  }
  draft.doorStates ||= {};
  draft.doorStates[key] = draft.doorStates[key] === "open" ? "closed" : "open";
  saveDraft();
  const open = draft.doorStates[key] === "open";
  document.querySelectorAll(`[data-door-key="${key}"]`).forEach((door) => {
    door.classList.toggle("is-open", open);
    door.title = `${open ? "Close" : "Open"} door`;
    door.setAttribute("aria-label", door.title);
    door.setAttribute("aria-pressed", String(open));
  });
}

function makeDoor(index, adjacent, side) {
  const key = doorKey(index, adjacent);
  const open = draft.doorStates?.[key] === "open";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sic-door sic-door-${side}${open ? " is-open" : ""}`;
  button.dataset.doorKey = key;
  const unavailable = mapView.mode !== "explore" || !canOperateDoors();
  button.setAttribute("aria-disabled", String(unavailable));
  button.title = mapView.mode !== "explore"
    ? "Switch to Explore to operate doors"
    : unavailable
      ? "Only a listed crewmember can operate this door"
      : `${open ? "Close" : "Open"} door`;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(open));
  const first = document.createElement("span");
  const second = document.createElement("span");
  first.className = "door-panel door-panel-first";
  second.className = "door-panel door-panel-second";
  [first, second].forEach((panel) => {
    panel.style.backgroundColor = "#7f8b95";
    panel.style.borderColor = "#050709";
    panel.style.boxShadow = "inset 0 0 0 1px #b8c2ca";
  });
  button.append(first, second);
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  let touchHandled = false;
  button.addEventListener("pointerup", (event) => {
    event.stopPropagation();
    if (event.pointerType !== "touch") return;
    touchHandled = true;
    toggleDoor(key);
    setTimeout(() => { touchHandled = false; }, 450);
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!touchHandled) toggleDoor(key);
  });
  return button;
}

function renderCellBoundaries(cell, index, layout) {
  window.SAShipMap.SIDES.forEach((side) => {
    const boundary = layout.boundary(index, side.name);
    if (boundary.kind === "wall") cell.append(makeWall(side.name));
    if (boundary.kind === "door") cell.append(makeWall(side.name, "start"), makeWall(side.name, "end"), makeDoor(index, index + side.offset, side.name));
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
function candidateCells(sicId, cell) {
  const item = draft.sicInventory.find((entry) => entry.id === sicId);
  if (!item) return [];
  return placementCells({ sicId, cell });
}
function minimumCellDistance(leftCells, rightCells) {
  let minimum = Infinity;
  leftCells.forEach((left) => rightCells.forEach((right) => {
    const distance = Math.abs(Math.floor(left / GRID_SIZE) - Math.floor(right / GRID_SIZE)) + Math.abs((left % GRID_SIZE) - (right % GRID_SIZE));
    minimum = Math.min(minimum, distance);
  }));
  return minimum;
}
function validateSicPlacement(sicId, cell) {
  const item = draft.sicInventory.find((entry) => entry.id === sicId);
  if (!item) return { legal: false, reason: "That SIC is no longer available.", cells: [] };
  const definition = sicDefinition(item); const cells = candidateCells(sicId, cell);
  if (cells.length !== definition.width * definition.height) return { legal: false, reason: `${definition.name} does not fit at the edge of the construction grid.`, cells };
  if (cells.some((candidate) => !draft.gridCells.includes(candidate))) return { legal: false, reason: `Purchase all ${definition.width * definition.height} required hull squares first.`, cells };
  if (cells.some((candidate) => { const occupant = placementAt(candidate); return occupant && occupant.sicId !== sicId; })) return { legal: false, reason: "That area already contains a SIC.", cells };
  if (definition.category === "engine") {
    const tooClose = draft.placements.find((placement) => {
      if (placement.sicId === sicId) return false;
      const otherItem = draft.sicInventory.find((entry) => entry.id === placement.sicId);
      const otherDefinition = sicDefinition(otherItem);
      if (otherDefinition.category !== "engine") return false;
      return minimumCellDistance(cells, placementCells(placement)) < Math.max(definition.clearance, otherDefinition.clearance) + 1;
    });
    if (tooClose) return { legal: false, reason: `${definition.name} requires ${definition.clearance} clear grid square${definition.clearance === 1 ? "" : "s"} from another Engine.`, cells };
  }
  return { legal: true, reason: `Legal ${definition.name} placement.`, cells };
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
    const result = validateSicPlacement(placement.sicId, placement.cell);
    if (!result.legal) errors.push(result.reason);
    result.cells.forEach((cell) => { if (!draft.gridCells.includes(cell) || seenCells.has(cell)) cells.add(cell); seenCells.add(cell); });
  });
  const installedTypes = new Set(draft.placements.map((placement) => draft.sicInventory.find((item) => item.id === placement.sicId)?.type).filter(Boolean));
  if (installedTypes.has("nutritional-supplement") && !installedTypes.has("life-support")) {
    errors.push("Nutritional Supplement requires an installed Life Support SIC.");
    draft.placements.filter((placement) => draft.sicInventory.find((item) => item.id === placement.sicId)?.type === "nutritional-supplement").forEach((placement) => placementCells(placement).forEach((cell) => cells.add(cell)));
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
  const result = validateSicPlacement(selectedSicId, cellIndex);
  const grid = cellElement.closest(".ship-grid");
  result.cells.forEach((cell) => grid?.querySelector(`[data-grid-index="${cell}"]`)?.classList.add("placement-preview", result.legal ? "is-valid" : "is-invalid"));
}
function cancelPlacement() { selectedSicId = null; mobilePreviewCell = null; clearPlacementPreview(); renderAll(); }
function placeSelectedSic(cell) {
  const sic = selectedSic();
  if (!sic) return;
  const result = validateSicPlacement(sic.id, cell);
  if (!result.legal) { showMessage(result.reason, "error"); return; }
  rememberForUndo();
  draft.placements = draft.placements.filter((placement) => placement.sicId !== sic.id);
  draft.placements.push({ sicId: sic.id, cell });
  selectedSicId = null; mobilePreviewCell = null;
  saveDraft();
  showMessage(`${sicDefinition(sic).name} placed. Confirm Changes to apply it to the ship.`, "success");
  renderAll();
}
function removePlacedSic(placement) {
  rememberForUndo();
  const item = draft.sicInventory.find((sic) => sic.id === placement.sicId);
  draft.placements = draft.placements.filter((entry) => entry.sicId !== placement.sicId);
  if (item) item.storage = !item.pendingPurchase;
  saveDraft();
  showMessage(item?.pendingPurchase ? `${sicDefinition(item).name} returned to the Installation Queue.` : `${sicDefinition(item).name} moved into Storage.`);
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

function paintHullCell(index) {
  if (!hullPaint || hullPaint.visited.has(index) || placementAt(index)) return;
  hullPaint.visited.add(index);
  const hull = new Set(draft.gridCells);
  if (hullPaint.mode === "add") hull.add(index); else hull.delete(index);
  draft.gridCells = [...hull].sort((a, b) => a - b);
  shipGrids.forEach((grid) => {
    const cell = grid.querySelector(`[data-grid-index="${index}"]`);
    cell?.classList.toggle("is-selected", hullPaint.mode === "add");
    cell?.setAttribute("aria-pressed", String(hullPaint.mode === "add"));
  });
  totalSquareOutputs.forEach((output) => { output.value = String(hull.size); output.textContent = String(hull.size); });
}

function beginHullPaint(index, event) {
  if (window.matchMedia("(max-width: 820px)").matches || mapView.mode !== "build" || selectedSic() || placementAt(index)) return;
  event.preventDefault();
  rememberForUndo();
  hullPaint = { pointerId: event.pointerId, mode: draft.gridCells.includes(index) ? "remove" : "add", visited: new Set() };
  suppressGridClick = true;
  paintHullCell(index);
}

function finishHullPaint() {
  if (!hullPaint) return;
  hullPaint = null;
  setTimeout(() => { suppressGridClick = false; }, 0);
  validation = { errors: [], cells: new Set() };
  saveDraft();
  renderAll();
}
function handleGridClick(index, cell, mobile) {
  validation = { errors: [], cells: new Set() };
  if (mapView.mode !== "build") return;
  if (!selectedSic()) { toggleHullCell(index); return; }
  if (mobile) { mobilePreviewCell = index; previewPlacement(index, cell); renderMobilePlacement(); return; }
  placeSelectedSic(index);
}
function renderGridCells() {
  const hull = new Set(draft.gridCells);
  const layout = window.SAShipMap.buildLayout(draft);
  const placementMap = layout.footprint;
  const placementActive = Boolean(selectedSic());
  shipGrids.forEach((grid) => {
    grid.classList.toggle("show-sic-labels", mapView.labels);
    grid.classList.toggle("high-resolution", mapView.highResolution && !placementActive);
    grid.classList.toggle("combat-mesh", mapView.combatMesh);
    grid.classList.toggle("show-walls", mapView.walls && !placementActive);
    grid.classList.toggle("placement-active", placementActive);
    grid.classList.toggle("build-mode", mapView.mode === "build");
    grid.classList.toggle("explore-mode", mapView.mode === "explore");
    grid.querySelectorAll(".ship-grid-cell").forEach((cell) => {
      const index = Number(cell.dataset.gridIndex);
      const occupied = placementMap.get(index); const placement = occupied?.placement || null;
      const item = placement ? draft.sicInventory.find((entry) => entry.id === placement.sicId) : null;
      const definition = item ? sicDefinition(item) : null;
      cell.classList.toggle("is-selected", hull.has(index));
      cell.classList.toggle("has-engine", definition?.category === "engine");
      cell.classList.toggle("has-sic", Boolean(placement));
      cell.classList.toggle("sic-origin", Boolean(placement && placement.cell === index));
      cell.classList.toggle("construction-error", validation.cells.has(index));
      cell.replaceChildren();
      cell.style.removeProperty("--sic-basic-color"); cell.style.removeProperty("--sic-floorplan"); cell.style.removeProperty("--sic-tint"); cell.style.removeProperty("--sic-bg-size"); cell.style.removeProperty("--sic-bg-x"); cell.style.removeProperty("--sic-bg-y");
      if (placement) {
        const x = occupied.offset % definition.width; const y = Math.floor(occupied.offset / definition.width);
        cell.style.setProperty("--sic-basic-color", definition.color || "#197a6f");
        cell.style.setProperty("--sic-floorplan", `url('${definition.floorplan}')`);
        cell.style.setProperty("--sic-tint", definition.tint || "linear-gradient(transparent,transparent)");
        cell.style.setProperty("--sic-bg-size", `${definition.width * 100}% ${definition.height * 100}%`);
        cell.style.setProperty("--sic-bg-x", definition.width === 1 ? "50%" : `${x / (definition.width - 1) * 100}%`);
        cell.style.setProperty("--sic-bg-y", definition.height === 1 ? "50%" : `${y / (definition.height - 1) * 100}%`);
        cell.dataset.sicType = item.type;
      } else delete cell.dataset.sicType;
      if (hull.has(index) && mapView.walls && !placementActive) renderCellBoundaries(cell, index, layout);
      if (placement && placement.cell === index && mapView.labels) {
        const label = document.createElement("span");
        label.className = "sic-grid-label";
        label.textContent = definition.shortLabel;
        label.style.setProperty("--sic-width", String(definition.width));
        label.style.setProperty("--sic-height", String(definition.height));
        cell.append(label);
      }
      if (placement && mapView.stations && definition?.stations?.length) {
        const originRow = Math.floor(placement.cell / GRID_SIZE); const originColumn = placement.cell % GRID_SIZE;
        const localX = index % GRID_SIZE - originColumn; const localY = Math.floor(index / GRID_SIZE) - originRow;
        definition.stations.filter((station) => station.x === localX && station.y === localY).forEach((station, stationIndex) => {
          const marker = document.createElement("span");
          marker.className = "sic-station-marker";
          marker.dataset.mesh = String(station.mesh);
          marker.title = `${definition.name} station ${stationIndex + 1}`;
          marker.setAttribute("aria-label", marker.title);
          cell.append(marker);
        });
      }
      cell.setAttribute("aria-pressed", String(hull.has(index)));
      cell.setAttribute("aria-label", placement ? `Ship grid square ${index + 1}, ${definition.name}` : `Ship grid square ${index + 1}`);
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
function applyGridTransform() {
  shipGrids.forEach((grid) => {
    grid.style.transform = `scale(${mapView.zoom}) translate(${mapView.panX}%, ${mapView.panY}%)`;
    grid.classList.toggle("is-zoomed", mapView.zoom > 1.001);
  });
  gridZoomOutputs.forEach((output) => { output.textContent = `${Math.round(mapView.zoom * 100)}%`; });
}
function renderGridNavigation() {
  gridModeButtons.forEach((button) => {
    const active = button.dataset.gridMode === mapView.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  applyGridTransform();
}
function fitShipToViewport() {
  if (!draft.gridCells.length) {
    mapView.zoom = 1; mapView.panX = 0; mapView.panY = 0;
  } else {
    const rows = draft.gridCells.map((cell) => Math.floor(cell / GRID_SIZE));
    const columns = draft.gridCells.map((cell) => cell % GRID_SIZE);
    const minRow = Math.min(...rows); const maxRow = Math.max(...rows);
    const minColumn = Math.min(...columns); const maxColumn = Math.max(...columns);
    const span = Math.max(maxRow - minRow + 1, maxColumn - minColumn + 1);
    mapView.zoom = Math.max(1, Math.min(4, 18 / span));
    mapView.panX = 50 - (((minColumn + maxColumn + 1) / 2) / GRID_SIZE * 100);
    mapView.panY = 50 - (((minRow + maxRow + 1) / 2) / GRID_SIZE * 100);
  }
  saveMapView(); applyGridTransform();
}
function renderMobilePlacement() {
  if (!mobilePlacementControls) return;
  const active = Boolean(selectedSic()) && mobilePreviewCell !== null;
  mobilePlacementControls.hidden = !active;
  if (!active) return;
  const result = validateSicPlacement(selectedSicId, mobilePreviewCell);
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
    const cells = placementCells(placement).map((index) => grid.querySelector(`[data-grid-index="${index}"]`)).filter(Boolean);
    if (!cells.length) return;
    cells.forEach((cell) => cell.classList.add("located-sic"));
    if (!window.matchMedia("(max-width: 820px)").matches) cells[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setTimeout(() => cells.forEach((cell) => cell.classList.remove("located-sic")), 1800);
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
    const definition = sicDefinition(item);
    const card = document.createElement("article"); card.className = `inventory-sic inventory-${kind}`;
    const placement = placementForSic(item.id);
    const name = document.createElement("div"); name.className = "inventory-sic-name";
    const saleValue = Math.ceil(definition.price / 2);
    const detail = item.pendingDisposition === "sell" ? `Sale pending · +${formatCredits(saleValue)} cr`
      : item.pendingDisposition === "destroy" ? "Destruction pending"
        : placement ? `Grid ${Math.floor(placement.cell / GRID_SIZE) + 1}, ${placement.cell % GRID_SIZE + 1}` : `${definition.width}×${definition.height} · ${formatCredits(definition.price)} cr`;
    name.innerHTML = `<strong>${escapeHtml(definition.name)}</strong><small>${detail}</small>`;
    const actions = document.createElement("div"); actions.className = "inventory-sic-actions";
    if (kind === "pending" && item.pendingDisposition) {
      actions.append(inventoryButton("Keep SIC", "keep-sic", () => {
        rememberForUndo(); item.pendingDisposition = ""; saveDraft(); showMessage("The SIC will remain in Storage."); renderAll();
      }));
    } else if (kind === "pending" || kind === "queue") {
      actions.append(inventoryButton(selectedSicId === item.id ? "Cancel Placement" : "Place", selectedSicId === item.id ? "is-selected" : "", () => {
        selectedSicId = selectedSicId === item.id ? null : item.id;
        if (selectedSicId) mapView.mode = "build";
        mobilePreviewCell = null; clearPlacementPreview(); saveMapView(); renderAll();
      }));
      if (item.pendingPurchase) actions.append(inventoryButton("Refund in Full", "refund-sic", () => refundPendingSic(item)));
      else actions.append(inventoryButton("To Storage", "store-sic", () => moveSicToStorage(item)));
    } else if (kind === "installed") {
      actions.append(inventoryButton("Locate", "locate-sic", () => locateInstalledSic(item)));
      actions.append(inventoryButton("Remove", "store-sic", () => removePlacedSic(placement)));
    } else {
      actions.append(inventoryButton("Install", "install-sic", () => moveSicToQueue(item)));
      actions.append(inventoryButton(`Sell ${formatCredits(saleValue)}`, "sell-sic", () => markSicDisposition(item, "sell")));
      actions.append(inventoryButton("Destroy", "destroy-sic", () => markSicDisposition(item, "destroy")));
    }
    card.append(name, actions); container.append(card);
  });
}

function refundPendingSic(item) {
  rememberForUndo(); draft.placements = draft.placements.filter((entry) => entry.sicId !== item.id);
  draft.sicInventory = draft.sicInventory.filter((sic) => sic.id !== item.id);
  if (selectedSicId === item.id) selectedSicId = null;
  saveDraft(); showMessage(`Pending ${sicDefinition(item).name} refunded in full.`); renderAll();
}
function moveSicToStorage(item) {
  rememberForUndo(); item.storage = true; if (selectedSicId === item.id) selectedSicId = null;
  saveDraft(); showMessage(`${sicDefinition(item).name} moved into Storage.`); renderAll();
}
function moveSicToQueue(item) {
  rememberForUndo(); item.storage = false; item.pendingDisposition = ""; selectedSicId = item.id;
  saveDraft(); showMessage(`${sicDefinition(item).name} moved to the Installation Queue. Select its hull area.`); renderAll();
}
function markSicDisposition(item, disposition) {
  const definition = sicDefinition(item); const saleValue = Math.ceil(definition.price / 2);
  const message = disposition === "sell"
    ? `Sell this ${definition.name} for ${formatCredits(saleValue)} credits when changes are confirmed?`
    : `Destroy this ${definition.name} permanently when changes are confirmed?`;
  if (!window.confirm(message)) return;
  rememberForUndo(); item.pendingDisposition = disposition; item.storage = true;
  saveDraft(); showMessage(disposition === "sell" ? `${definition.name} marked for sale.` : `${definition.name} marked for destruction.`); renderAll();
}

function renderInventory() {
  document.querySelectorAll("[data-sic-list]").forEach((container) => renderInventoryList(container, container.dataset.sicList));
  const purchased = draft.sicInventory.filter((item) => !item.pendingDisposition);
  document.querySelectorAll("[data-purchased-sic-gallery]").forEach((gallery) => {
    gallery.replaceChildren();
    if (!purchased.length) {
      const empty = document.createElement("span"); empty.className = "empty-inventory"; empty.textContent = "No SICs purchased yet."; gallery.append(empty); return;
    }
    purchased.forEach((item) => {
      const definition = sicDefinition(item);
      const button = document.createElement("button");
      button.type = "button"; button.className = "purchased-sic-thumbnail"; button.dataset.openSicType = item.type;
      button.innerHTML = `<img src="${escapeHtml(definition.floorplan)}" alt="" /><span>${escapeHtml(definition.shortLabel)}</span>`;
      button.title = `Open ${definition.name} card`;
      gallery.append(button);
    });
  });
}
function renderLiveStats() {
  const confirmed = constructionState(draft.confirmed);
  const hull = confirmed.gridCells.length;
  const installed = confirmed.placements.map((placement) => confirmed.sicInventory.find((item) => item.id === placement.sicId)).filter(Boolean);
  const enMax = installed.reduce((total, item) => total + sicDefinition(item).enOutput, 0);
  const enAvailable = enMax - installed.reduce((total, item) => total + sicDefinition(item).energyCost, 0);
  const scale = shipScaleStats(hull);
  document.querySelectorAll('[data-live-stat="hull"]').forEach((element) => { element.textContent = String(hull); });
  document.querySelectorAll('[data-live-stat="en"]').forEach((element) => {
    const value = String(element.dataset.enPart === "max" ? enMax : enAvailable);
    element.textContent = value;
    element.classList.toggle("is-long-value", value.length >= 3);
  });
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
  renderGridCells(); renderMapViewControls(); renderGridNavigation(); renderInventory(); renderLiveStats(); renderMobilePlacement(); renderConstructionControls();
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
    cell.addEventListener("pointerdown", (event) => beginHullPaint(index, event));
    cell.addEventListener("pointerenter", (event) => {
      if (!mobile && hullPaint && event.buttons === 1) paintHullCell(index);
    });
    cell.addEventListener("pointerleave", () => { if (!mobile) clearPlacementPreview(); });
    cell.addEventListener("click", () => {
      if (suppressGridClick) { suppressGridClick = false; return; }
      handleGridClick(index, cell, mobile);
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); handleGridClick(index, cell, mobile);
    });
    fragment.append(cell);
  }
  grid.append(fragment);
});
window.addEventListener("pointerup", finishHullPaint);
window.addEventListener("pointercancel", finishHullPaint);
document.querySelector("[data-mobile-place]")?.addEventListener("click", () => { if (mobilePreviewCell !== null) placeSelectedSic(mobilePreviewCell); });
document.querySelectorAll("[data-cancel-placement]").forEach((button) => button.addEventListener("click", cancelPlacement));
mapViewToggles.forEach((toggle) => toggle.addEventListener("change", () => {
  mapView[toggle.dataset.mapToggle] = toggle.checked;
  saveMapView(); renderAll();
}));
gridModeButtons.forEach((button) => button.addEventListener("click", () => {
  mapView.mode = button.dataset.gridMode === "explore" ? "explore" : "build";
  saveMapView();
  if (mapView.mode === "explore") cancelPlacement();
  else renderAll();
}));
gridZoomButtons.forEach((button) => button.addEventListener("click", () => {
  const action = button.dataset.gridZoom;
  if (action === "fit") { fitShipToViewport(); return; }
  const change = action === "in" ? 0.25 : -0.25;
  mapView.zoom = Math.max(0.5, Math.min(4, Math.round((mapView.zoom + change) * 100) / 100));
  if (mapView.zoom <= 1) { mapView.panX = 0; mapView.panY = 0; }
  saveMapView(); applyGridTransform();
}));
document.querySelectorAll("[data-grid-pan]").forEach((button) => button.addEventListener("click", () => {
  const step = 8 / Math.max(0.5, mapView.zoom);
  const direction = button.dataset.gridPan;
  if (direction === "left") mapView.panX += step;
  if (direction === "right") mapView.panX -= step;
  if (direction === "up") mapView.panY += step;
  if (direction === "down") mapView.panY -= step;
  saveMapView(); applyGridTransform();
}));
shipGrids.forEach((grid) => {
  let panGesture = null;
  grid.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 820px)").matches) return;
    if (mapView.mode !== "explore" || event.target.closest(".sic-door")) return;
    panGesture = { x: event.clientX, y: event.clientY, panX: mapView.panX, panY: mapView.panY };
    grid.setPointerCapture?.(event.pointerId);
    grid.classList.add("is-panning");
  });
  grid.addEventListener("pointermove", (event) => {
    if (!panGesture) return;
    const rect = grid.getBoundingClientRect();
    mapView.panX = panGesture.panX + ((event.clientX - panGesture.x) / rect.width * 100 / mapView.zoom);
    mapView.panY = panGesture.panY + ((event.clientY - panGesture.y) / rect.height * 100 / mapView.zoom);
    applyGridTransform();
  });
  const finishPan = () => {
    if (!panGesture) return;
    panGesture = null; grid.classList.remove("is-panning"); saveMapView();
  };
  grid.addEventListener("pointerup", finishPan);
  grid.addEventListener("pointercancel", finishPan);
});
function purchaseSic(type) {
  const definition = SIC_CATALOG[type]; if (!definition) return;
  rememberForUndo();
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  draft.sicInventory.push({ id, type, pendingPurchase: true, storage: false, pendingDisposition: "" });
  selectedSicId = id; mapView.mode = "build"; saveDraft(); saveMapView();
  document.querySelector('[data-starship-tab="sheet"]')?.click();
  showMessage(`${definition.name} added to pending purchases. Select its ${definition.width}×${definition.height} hull area to install it.`, "success"); renderAll();
}
document.querySelectorAll("[data-purchase-sic]").forEach((button) => button.addEventListener("click", () => purchaseSic(button.dataset.purchaseSic)));
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
  draft.confirmedOnce = true;
  undoState = null; selectedSicId = null; mobilePreviewCell = null;
  mapView.mode = "explore";
  saveDraft(); saveMapView(); syncLinkedStarship();
  showMessage(`Construction confirmed. ${cost < 0 ? `${formatCredits(Math.abs(cost))} credits refunded.` : `${formatCredits(cost)} credits spent.`}`, "success");
  renderSavedStarships(); renderCampaignLink(); renderAll();
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

const savedStarshipSelect = document.querySelector("#savedStarshipSelect");
const starshipSaveState = document.querySelector("#starshipSaveState");
const importStarshipFile = document.querySelector("#importStarshipFile");
const linkStarshipForms = [...document.querySelectorAll("[data-link-starship-form]")];
let linkedCampaignState = null;

function applyDraftToUi() {
  shipFields.forEach((field) => { field.value = draft[field.dataset.shipField] || ""; });
  popularityInputs.forEach((input) => { input.value = String(draft.popularity || 0); });
  selectedSicId = null; mobilePreviewCell = null; undoState = null;
  renderReputationSelections(); renderSavedStarships(); renderAll(); renderCampaignLink();
  if (draft.confirmedOnce) requestAnimationFrame(fitShipToViewport);
}
function renderSavedStarships() {
  if (!savedStarshipSelect) return;
  const library = loadStarshipLibrary();
  savedStarshipSelect.replaceChildren();
  if (!draft.confirmedOnce) {
    const option = document.createElement("option"); option.value = ""; option.textContent = `Unconfirmed Draft${draft.title ? `: ${draft.title}` : ""}`; savedStarshipSelect.append(option);
  }
  library.forEach((ship) => { const option = document.createElement("option"); option.value = String(ship.id || ""); option.textContent = ship.title || "Untitled Starship"; savedStarshipSelect.append(option); });
  savedStarshipSelect.value = draft.confirmedOnce ? draft.id : "";
  starshipSaveState.textContent = draft.confirmedOnce ? "Saved Locally" : "Recoverable Draft";
  document.querySelector("#duplicateStarship").disabled = !draft.confirmedOnce;
  document.querySelector("#exportStarship").disabled = !draft.confirmedOnce;
  document.querySelector("#deleteStarship").disabled = !draft.confirmedOnce;
}
function startNewStarship() {
  if (!window.confirm("Start a fresh starship? The current unconfirmed work will be replaced. Confirmed starships remain saved.")) return;
  localStorage.removeItem(ACTIVE_STARSHIP_KEY);
  draft = defaultDraft(); saveDraft(); applyDraftToUi();
}
function loadSavedStarship(id) {
  const selected = loadStarshipLibrary().find((ship) => ship?.id === id);
  if (!selected) return;
  draft = clone(selected); localStorage.setItem(ACTIVE_STARSHIP_KEY, draft.id); saveDraft(); applyDraftToUi();
}
function duplicateStarship() {
  if (!draft.confirmedOnce) return;
  const now = new Date().toISOString();
  draft = { ...clone(draft), id: uid(), title: `${draft.title || "Untitled Starship"} Copy`, campaignLink: null, createdAt: now, updatedAt: now };
  saveDraft(); applyDraftToUi();
}
function exportStarship() {
  if (!draft.confirmedOnce) return;
  const payload = { format: "spaceship-architect-2e-starship", version: 1, exportedAt: new Date().toISOString(), starship: clone(draft) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `${(draft.title || "starship").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.sa2ship`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importStarship(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const imported = payload?.format === "spaceship-architect-2e-starship" ? payload.starship : payload;
    if (!imported?.confirmedOnce || !Array.isArray(imported.gridCells)) throw new Error("That file is not a confirmed Spaceship Architect starship.");
    const fresh = defaultDraft();
    draft = { ...fresh, ...clone(imported), id: uid(), campaignLink: null, title: `${imported.title || "Imported Starship"}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveDraft(); applyDraftToUi();
  } catch (error) { window.alert(error.message || "The starship file could not be imported."); }
  importStarshipFile.value = "";
}
function deleteStarship() {
  if (!draft.confirmedOnce || !window.confirm(`Delete ${draft.title || "this starship"} from this device?`)) return;
  const library = loadStarshipLibrary().filter((ship) => ship.id !== draft.id); saveStarshipLibrary(library);
  localStorage.removeItem(ACTIVE_STARSHIP_KEY); draft = defaultDraft(); saveDraft(); applyDraftToUi();
}
function activeCampaignCredentials(code) {
  const operator = currentDoorOperator();
  const characterToken = operator?.id ? localStorage.getItem(`sa-character-token-${code}-${operator.id}`) || "" : "";
  const gmToken = localStorage.getItem(`sa-gm-token-${code}`) || "";
  return { token: gmToken || characterToken, characterId: gmToken ? "" : operator?.id || "" };
}
async function campaignApi(path, body = null, method = "POST") {
  const response = await fetch(path, { method, headers: body === null ? undefined : { "Content-Type": "application/json" }, body: body === null ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The campaign server rejected that request.");
  return payload;
}
async function refreshLinkedCampaign() {
  if (!draft.campaignLink?.roomCode) { linkedCampaignState = null; renderCampaignLink(); return; }
  const code = draft.campaignLink.roomCode;
  const credentials = activeCampaignCredentials(code);
  try { linkedCampaignState = await campaignApi(`/api/campaign/state?code=${encodeURIComponent(code)}&token=${encodeURIComponent(credentials.token)}`, null, "GET"); }
  catch { linkedCampaignState = null; }
  renderCampaignLink();
}
function campaignMessage(message, tone = "") {
  document.querySelectorAll("[data-starship-campaign-message]").forEach((output) => { output.textContent = message; output.dataset.tone = tone; });
}
function renderCampaignLink() {
  const linked = draft.campaignLink;
  const records = linkedCampaignState?.characters || [];
  const selected = new Set(draft.crewCharacterIds || []);
  linkStarshipForms.forEach((form) => { form.hidden = Boolean(linked); });
  document.querySelectorAll("[data-starship-campaign-status]").forEach((status) => { status.hidden = !linked; });
  document.querySelectorAll("[data-save-starship-crew]").forEach((button) => { button.hidden = !linked; });
  if (!linked) {
    document.querySelectorAll("[data-link-starship]").forEach((button) => { button.disabled = false; button.title = draft.confirmedOnce ? "" : "Confirm Ship First"; });
    document.querySelectorAll("[data-starship-crew-list]").forEach((list) => { list.innerHTML = '<span class="empty-inventory">Link this ship to assign crew.</span>'; });
    return;
  }
  document.querySelectorAll("[data-linked-campaign-name]").forEach((node) => { node.textContent = linkedCampaignState?.name || linked.campaignName || "Campaign"; });
  document.querySelectorAll("[data-linked-campaign-code]").forEach((node) => { node.textContent = linked.roomCode; });
  document.querySelectorAll("[data-linked-control-type]").forEach((node) => { node.textContent = linked.controlType === "gm" ? "GM Controlled" : "PC Controlled"; });
  const markup = records.length ? records.map((record) => `<label class="starship-crew-option"><input type="checkbox" value="${escapeHtml(record.id)}" ${selected.has(record.id) ? "checked" : ""}/><span>${escapeHtml(record.character?.identity?.characterName || "Unnamed Character")}</span></label>`).join("") : "<p>Open this campaign as a player or GM to manage its crew.</p>";
  document.querySelectorAll("[data-starship-crew-list]").forEach((list) => { list.innerHTML = markup; });
}
async function linkStarship(event) {
  event.preventDefault();
  if (!draft.confirmedOnce || !statesMatch(draft, draft.confirmed)) { campaignMessage("Confirm Ship First", "error"); return; }
  const form = event.currentTarget; const code = form.querySelector("[data-starship-campaign-code]").value.trim().toUpperCase();
  try {
    const result = await campaignApi("/api/campaign/starship/link", { code, controlType: form.querySelector("[data-starship-control-type]").value, starship: draft });
    draft.campaignLink = { roomCode: code, campaignName: result.campaignName, controlType: result.starship.controlType, accessKey: result.accessKey };
    draft.crewCharacterIds = []; saveDraft(); linkedCampaignState = null; await refreshLinkedCampaign(); campaignMessage("Starship linked successfully.");
  } catch (error) { campaignMessage(error.message, "error"); }
}
async function syncLinkedStarship() {
  if (!draft.campaignLink?.roomCode || !draft.confirmedOnce) return;
  const link = draft.campaignLink; const credentials = activeCampaignCredentials(link.roomCode);
  try { await campaignApi("/api/campaign/starship/save", { code: link.roomCode, token: credentials.token, characterId: credentials.characterId, accessKey: link.accessKey, starship: draft }); }
  catch (error) { campaignMessage(`Saved locally. Campaign sync needs attention: ${error.message}`, "error"); }
}

savedStarshipSelect?.addEventListener("change", () => { if (savedStarshipSelect.value) loadSavedStarship(savedStarshipSelect.value); });
document.querySelector("#newStarship")?.addEventListener("click", startNewStarship);
document.querySelector("#duplicateStarship")?.addEventListener("click", duplicateStarship);
document.querySelector("#exportStarship")?.addEventListener("click", exportStarship);
document.querySelector("#deleteStarship")?.addEventListener("click", deleteStarship);
importStarshipFile?.addEventListener("change", () => importStarship(importStarshipFile.files?.[0]));
linkStarshipForms.forEach((form) => form.addEventListener("submit", linkStarship));
document.querySelectorAll("[data-unlink-starship]").forEach((button) => button.addEventListener("click", async () => {
  if (!draft.confirmedOnce || !statesMatch(draft, draft.confirmed)) { campaignMessage("Confirm Ship First", "error"); return; }
  if (!draft.campaignLink || !window.confirm("Unlink this starship? It will remain saved on this device and campaign crew assignments will be cleared.")) return;
  const credentials = activeCampaignCredentials(draft.campaignLink.roomCode);
  try { await campaignApi("/api/campaign/starship/unlink", { code: draft.campaignLink.roomCode, token: credentials.token, accessKey: draft.campaignLink.accessKey, starshipId: draft.id }); }
  catch (error) { campaignMessage(error.message, "error"); return; }
  draft.campaignLink = null; draft.crewCharacterIds = []; draft.crewmemberNames = []; linkedCampaignState = null; saveDraft(); renderCampaignLink();
}));
document.querySelectorAll("[data-save-starship-crew]").forEach((button) => button.addEventListener("click", async () => {
  if (!draft.campaignLink) return;
  const crewCharacterIds = [...button.closest("[data-crew-campaign-tools]").querySelectorAll("[data-starship-crew-list] input:checked")].map((input) => input.value);
  const credentials = activeCampaignCredentials(draft.campaignLink.roomCode);
  try {
    const result = await campaignApi("/api/campaign/starship/crew", { code: draft.campaignLink.roomCode, token: credentials.token, characterId: credentials.characterId, starshipId: draft.id, crewCharacterIds });
    draft.crewCharacterIds = result.starship.crewCharacterIds; saveDraft(); campaignMessage("Crew assignments saved."); await refreshLinkedCampaign();
  } catch (error) { campaignMessage(error.message, "error"); }
}));

const sicCards = [...document.querySelectorAll(".sic-poker-card")];
const sicCardDialog = document.querySelector("#sicCardDialog");
function openSicCard(sicCard) {
  if (!sicCard || !sicCardDialog) return;
  const cloneCard = sicCard.cloneNode(true); cloneCard.removeAttribute("tabindex");
  sicCardDialog.querySelector("[data-sic-card-dialog-body]").replaceChildren(cloneCard);
  if (typeof sicCardDialog.showModal === "function") sicCardDialog.showModal();
}
sicCards.forEach((sicCard) => {
  sicCard.addEventListener("click", () => openSicCard(sicCard));
  sicCard.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSicCard(sicCard); } });
});
document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-open-sic-type]");
  if (!trigger) return;
  openSicCard(document.querySelector(`[data-sic-card="${CSS.escape(trigger.dataset.openSicType)}"]`));
});
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
async function initializeStarshipPage() {
  const parameters = new URLSearchParams(location.search);
  const requestedShipId = parameters.get("ship") || "";
  const campaignCode = (parameters.get("campaign") || "").toUpperCase();
  if (parameters.get("new") === "1") {
    localStorage.removeItem(ACTIVE_STARSHIP_KEY);
    draft = defaultDraft();
    if (campaignCode) document.querySelectorAll("[data-starship-campaign-code]").forEach((input) => { input.value = campaignCode; });
    saveDraft();
  } else if (requestedShipId && campaignCode) {
    const credentials = activeCampaignCredentials(campaignCode);
    try {
      const state = await campaignApi(`/api/campaign/state?code=${encodeURIComponent(campaignCode)}&token=${encodeURIComponent(credentials.token)}`, null, "GET");
      const record = (state.starships || []).find((entry) => entry.id === requestedShipId);
      if (record) {
        draft = {
          ...defaultDraft(), ...clone(record.ship), id: record.id, title: record.title || record.ship.title,
          confirmedOnce: true, crewCharacterIds: clone(record.crewCharacterIds || []),
          campaignLink: { roomCode: campaignCode, campaignName: state.name, controlType: record.controlType, accessKey: draft.campaignLink?.accessKey || "" },
        };
        linkedCampaignState = state; saveDraft();
      }
    } catch (error) { campaignMessage(error.message, "error"); }
  }
  applyDraftToUi();
  if (!draft.campaignLink && campaignCode) document.querySelectorAll("[data-starship-campaign-code]").forEach((input) => { input.value = campaignCode; });
  if (draft.campaignLink) await refreshLinkedCampaign();
}
initializeStarshipPage();
