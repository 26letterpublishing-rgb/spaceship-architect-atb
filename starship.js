const STORAGE_KEY = "sa-starship-layout-draft";
const BUILD_VERSION = 2;
const HULL_COST = 1000;
const EN_ENGINE_COST = 1750;
const GRID_SIZE = 20;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function constructionState(source) {
  return {
    groupCredits: Number.isFinite(Number(source?.groupCredits)) ? Number(source.groupCredits) : 999999,
    gridCells: Array.isArray(source?.gridCells)
      ? [...new Set(source.gridCells.filter((value) => Number.isInteger(value) && value >= 0 && value < 400))].sort((a, b) => a - b)
      : [],
    sicInventory: Array.isArray(source?.sicInventory)
      ? source.sicInventory.filter((item) => item?.id && item.type === "en-engine-1").map((item) => ({
          id: String(item.id), type: "en-engine-1", pendingPurchase: Boolean(item.pendingPurchase),
        }))
      : [],
    placements: Array.isArray(source?.placements)
      ? source.placements.filter((item) => item?.sicId && Number.isInteger(item.cell)).map((item) => ({ sicId: String(item.sicId), cell: item.cell }))
      : [],
  };
}

function defaultDraft() {
  const initial = constructionState({});
  return {
    buildVersion: BUILD_VERSION,
    title: "", affiliation: "", class: "", crew: ["", "", "", "", ""],
    reputationSelections: [5, 5, 5, 5, 5], popularity: 0,
    ...initial, confirmed: clone(initial),
  };
}

function loadDraft() {
  const fresh = defaultDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const identity = {
      title: saved.title || "", affiliation: saved.affiliation || "", class: saved.class || "",
      crew: Array.isArray(saved.crew) && saved.crew.length ? saved.crew : fresh.crew,
      reputationSelections: Array.isArray(saved.reputationSelections) && saved.reputationSelections.length === 5
        ? saved.reputationSelections.map((value) => Math.max(0, Math.min(10, Number(value) || 0))) : fresh.reputationSelections,
      popularity: Math.max(0, Math.min(100, Number(saved.popularity) || 0)),
    };
    if (saved.buildVersion !== BUILD_VERSION) return { ...fresh, ...identity };
    const working = constructionState(saved);
    const confirmed = constructionState(saved.confirmed || working);
    return { ...fresh, ...identity, ...working, confirmed, buildVersion: BUILD_VERSION };
  } catch { return fresh; }
}

let draft = loadDraft();
let undoState = null;
let selectedSicId = null;
let mobilePreviewCell = null;
let validation = { errors: [], cells: new Set() };

const shipFields = [...document.querySelectorAll("[data-ship-field]")];
const crewLists = [
  { list: document.querySelector("#crewmemberList"), mobile: false },
  { list: document.querySelector("#mobileCrewmemberList"), mobile: true },
];
const shipGrids = [...document.querySelectorAll(".ship-grid")];
const totalSquareOutputs = [...document.querySelectorAll("[data-total-squares]")];
const constructionMessage = document.querySelector("#constructionMessage");
const confirmButton = document.querySelector("#confirmConstruction");
const undoButton = document.querySelector("#undoConstruction");
const discardButton = document.querySelector("#discardConstruction");
const mobilePlacementControls = document.querySelector("#mobilePlacementControls");

function saveDraft() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* Keep the editor usable in private contexts. */ }
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
  return ((additions - removals) * HULL_COST) + (engines * EN_ENGINE_COST);
}
function selectedSic() { return draft.sicInventory.find((item) => item.id === selectedSicId) || null; }
function placementAt(cell) { return draft.placements.find((placement) => placement.cell === cell) || null; }
function placementForSic(sicId) { return draft.placements.find((placement) => placement.sicId === sicId) || null; }
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
function focusCrewmember(index) {
  requestAnimationFrame(() => crewLists.forEach(({ list }) => {
    const input = list?.querySelector(`[data-crew-index="${index}"]`);
    if (input && input.offsetParent !== null) { list.scrollTop = list.scrollHeight; input.focus({ preventScroll: true }); }
  }));
}
function renderCrewList(list, mobile) {
  if (!list) return;
  list.replaceChildren();
  list.classList.toggle("has-overflow", draft.crew.length > 9);
  if (!mobile) list.style.gridTemplateRows = draft.crew.length <= 9 ? `repeat(${draft.crew.length}, 1fr)` : "";
  draft.crew.forEach((name, index) => {
    const row = document.createElement("div");
    row.className = mobile ? "mobile-crewmember-row" : "crewmember-row";
    const input = document.createElement("input");
    input.type = "text"; input.value = name; input.placeholder = `Crewmember ${index + 1}`;
    input.dataset.crewIndex = String(index); input.setAttribute("aria-label", `Crewmember ${index + 1}`);
    input.addEventListener("input", () => {
      draft.crew[index] = input.value;
      crewLists.forEach(({ list: otherList }) => {
        const other = otherList?.querySelector(`[data-crew-index="${index}"]`);
        if (other && other !== input) other.value = input.value;
      });
      saveDraft();
    });
    row.append(input);
    if (draft.crew.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button"; remove.textContent = "-"; remove.title = "Remove crewmember";
      remove.addEventListener("click", () => { draft.crew.splice(index, 1); saveDraft(); renderCrew(); });
      row.append(remove);
    }
    list.append(row);
  });
}
function renderCrew() { crewLists.forEach(({ list, mobile }) => renderCrewList(list, mobile)); }

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
  if (item?.pendingPurchase) draft.sicInventory = draft.sicInventory.filter((sic) => sic.id !== item.id);
  saveDraft();
  showMessage(item?.pendingPurchase ? "Unconfirmed SIC purchase removed." : "SIC returned to uninstalled inventory.");
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
  shipGrids.forEach((grid) => grid.querySelectorAll(".ship-grid-cell").forEach((cell) => {
    const index = Number(cell.dataset.gridIndex);
    const placement = placementMap.get(index);
    cell.classList.toggle("is-selected", hull.has(index));
    cell.classList.toggle("has-engine", Boolean(placement));
    cell.classList.toggle("construction-error", validation.cells.has(index));
    cell.textContent = placement ? "EN 1" : "";
    cell.setAttribute("aria-pressed", String(hull.has(index)));
  }));
  totalSquareOutputs.forEach((output) => { output.value = String(hull.size); output.textContent = String(hull.size); });
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
function renderInventory() {
  const container = document.querySelector("#uninstalledSics");
  if (!container) return;
  container.replaceChildren();
  const uninstalled = draft.sicInventory.filter((item) => !placementForSic(item.id));
  const heading = document.createElement("strong"); heading.textContent = "Uninstalled SICs"; container.append(heading);
  if (!uninstalled.length) {
    const empty = document.createElement("span"); empty.className = "empty-inventory";
    empty.textContent = "Purchase a SIC, then select it here for placement."; container.append(empty); return;
  }
  uninstalled.forEach((item) => {
    const wrapper = document.createElement("span"); wrapper.className = "inventory-sic";
    const select = document.createElement("button"); select.type = "button";
    select.className = selectedSicId === item.id ? "is-selected" : "";
    select.textContent = `EN Engine 1${item.pendingPurchase ? " (Pending)" : ""}`;
    select.addEventListener("click", () => {
      selectedSicId = selectedSicId === item.id ? null : item.id;
      mobilePreviewCell = null; clearPlacementPreview(); renderAll();
    });
    wrapper.append(select);
    if (item.pendingPurchase) {
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-pending-sic";
      remove.textContent = "×"; remove.title = "Cancel this unconfirmed SIC purchase";
      remove.addEventListener("click", () => {
        rememberForUndo(); draft.sicInventory = draft.sicInventory.filter((sic) => sic.id !== item.id);
        if (selectedSicId === item.id) selectedSicId = null;
        saveDraft(); renderAll();
      });
      wrapper.append(remove);
    }
    container.append(wrapper);
  });
}
function renderLiveStats() {
  const confirmed = constructionState(draft.confirmed);
  const hull = confirmed.gridCells.length;
  const en = confirmed.placements.length * 5;
  document.querySelectorAll('[data-live-stat="hull"]').forEach((element) => { element.textContent = String(hull); });
  document.querySelectorAll('[data-live-stat="en"]').forEach((element) => { element.textContent = String(en); });
  document.querySelectorAll('[data-live-stat="credits"], [data-group-credits]').forEach((element) => { element.textContent = formatCredits(confirmed.groupCredits); });
}
function showMessage(message, tone = "info") {
  if (!constructionMessage) return;
  constructionMessage.textContent = message; constructionMessage.dataset.tone = tone;
}
function renderConstructionControls() {
  validation = inspectConstruction();
  const cost = pendingCost();
  document.querySelectorAll("[data-pending-total]").forEach((element) => {
    element.textContent = cost < 0 ? `${formatCredits(Math.abs(cost))} refund` : formatCredits(cost);
  });
  const changed = !statesMatch(draft, draft.confirmed);
  if (confirmButton) {
    confirmButton.disabled = !changed;
    confirmButton.classList.toggle("has-error", validation.errors.length > 0);
    const costLabel = cost === 0 ? "" : ` (${cost < 0 ? "+" : "-"}${formatCredits(Math.abs(cost))})`;
    confirmButton.textContent = validation.errors.length ? "ERROR" : `Confirm Changes${changed ? costLabel : ""}`;
  }
  if (undoButton) undoButton.disabled = !undoState;
  if (discardButton) discardButton.disabled = !changed;
}
function renderAll() {
  renderCrew(); renderGridCells(); renderInventory(); renderLiveStats(); renderMobilePlacement(); renderConstructionControls();
}

shipFields.forEach((field) => {
  const key = field.dataset.shipField; field.value = draft[key] || "";
  field.addEventListener("input", () => syncShipField(key, field.value, field));
});
function addCrewmember() {
  const index = draft.crew.length; draft.crew.push(""); saveDraft(); renderCrew(); focusCrewmember(index);
}
document.querySelector("#addCrewmember")?.addEventListener("click", addCrewmember);
document.querySelector("#addMobileCrewmember")?.addEventListener("click", addCrewmember);

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
document.querySelector("#purchaseEnEngine")?.addEventListener("click", () => {
  rememberForUndo();
  const id = `en-engine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  draft.sicInventory.push({ id, type: "en-engine-1", pendingPurchase: true });
  selectedSicId = id; saveDraft();
  document.querySelector('[data-starship-tab="sheet"]')?.click();
  showMessage("EN Engine 1 added to pending purchases. Select a hull square to install it.", "success"); renderAll();
});
undoButton?.addEventListener("click", () => {
  if (!undoState) return;
  const current = getWorkingState(); restoreWorkingState(undoState); undoState = current;
  selectedSicId = null; mobilePreviewCell = null; validation = { errors: [], cells: new Set() };
  saveDraft(); showMessage("The last construction decision was undone."); renderAll();
});
discardButton?.addEventListener("click", () => {
  rememberForUndo(); restoreWorkingState(draft.confirmed);
  selectedSicId = null; mobilePreviewCell = null; validation = { errors: [], cells: new Set() };
  saveDraft(); showMessage("All unconfirmed construction changes were discarded."); renderAll();
});
confirmButton?.addEventListener("click", () => {
  validation = inspectConstruction();
  if (validation.errors.length) {
    showMessage(validation.errors.join(" "), "error"); renderGridCells(); renderConstructionControls(); return;
  }
  const cost = pendingCost();
  draft.groupCredits -= cost;
  draft.sicInventory.forEach((item) => { item.pendingPurchase = false; });
  draft.confirmed = constructionState(draft);
  undoState = null; selectedSicId = null; mobilePreviewCell = null;
  saveDraft();
  showMessage(`Construction confirmed. ${cost < 0 ? `${formatCredits(Math.abs(cost))} credits refunded.` : `${formatCredits(cost)} credits spent.`}`, "success");
  renderAll();
});
document.querySelectorAll("[data-starship-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.starshipTab;
    document.querySelectorAll("[data-starship-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    document.querySelectorAll("[data-starship-panel]").forEach((panel) => {
      const active = panel.dataset.starshipPanel === target; panel.classList.toggle("is-active", active); panel.hidden = !active;
    });
  });
});

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
