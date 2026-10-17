const STORAGE_KEY = "sa-starship-layout-draft";
const LIBRARY_KEY = "sa-starship-library-v1";
const ACTIVE_STARSHIP_KEY = "sa-starship-active-v1";
const VIEW_STORAGE_KEY = "sa-starship-map-view";
const BUILD_VERSION = 3;
const HULL_COST = window.SAShipMap.HULL_COST;
let GRID_SIZE = 20;
const pageParameters = new URLSearchParams(location.search);
const NEW_SHIP_REQUEST = pageParameters.get("new") === "1";
const shipStorage=pageParameters.get('showcase')==='1'?sessionStorage:localStorage;
const EMBEDDED_GM_MODE = pageParameters.get("embedded") === "gm";
if (EMBEDDED_GM_MODE||pageParameters.get("embedded")==="pc") document.body.classList.add("embedded-gm-starship");
const backLink = document.querySelector(".back-link");
if(backLink&&(pageParameters.get('campaign')||pageParameters.get('roomCreate'))){
 const room=pageParameters.get('campaign')||pageParameters.get('roomCreate'),person=pageParameters.get('character')||pageParameters.get('returnCharacter');
 backLink.textContent='Back to Campaign';backLink.href=person?'character.html?'+new URLSearchParams({campaign:room,character:person,tab:'starships',...(pageParameters.get('showcase')==='1'?{showcase:'1'}:{})}):'gm.html?'+new URLSearchParams({campaign:room,tab:'starships'});
 backLink.addEventListener('click',event=>{if(pageParameters.get('embedded')&&parent!==window){event.preventDefault();parent.postMessage({type:'sa-ship-editor-exit'},location.origin);}});
}
const SIC_CATALOG = window.SASicCards.populate(document);
function cardAccent(type) {
  if (type === "life-support") return "#42e0d0";
  if (type === "nutritional-supplement") return "#e9ef4d";
  return ["#82ddff", "#b58aff", "#679dff", "#52edcb", "#ff6679", "#cc87ff", "#e9c877", "#e8f6ff"][(Number(type.match(/\d+$/)?.[0]) || 1) - 1]||'#8fffbf';
}
function previewSicCard(source) {
  const card = source.cloneNode(true);
  card.dataset.sicPreview = source.dataset.sicCard || source.dataset.sicPreview;
  card.removeAttribute("data-sic-card"); card.removeAttribute("tabindex"); card.removeAttribute("aria-label");
  card.querySelectorAll("button,[id]").forEach(node => node.matches("button") ? node.remove() : node.removeAttribute("id"));
  return card;
}

// Move the real cards into collapsible families; previews and purchase handlers keep their identities.
const market = document.querySelector(".sic-card-gallery");
const purchaseFeedback = document.createElement("p"); purchaseFeedback.dataset.purchaseFeedback = "";
purchaseFeedback.className = "sic-purchase-feedback"; purchaseFeedback.setAttribute("role", "alert"); market.before(purchaseFeedback);
for (const overlay of document.querySelectorAll('.desktop-live-stats [data-propulsion-overlay]')) { const copy=overlay.cloneNode(true);copy.classList.add('mobile-live-stats');document.querySelector('.mobility-mobile svg')?.append(copy); }
const sharedSicMarket=window.SASicMarket.create({market,catalog:SIC_CATALOG,credits:()=>draft.groupCredits-pendingCost(),purchase:purchaseSic,error:()=>purchaseFeedback.textContent,inspect:(source,trigger)=>openSicCard(source,trigger),blueprint:type=>openBlueprintPurchase(type),canBlueprint:()=>canBuyBlueprint()});
sharedSicMarket.build();
function sicCategoryHosts(items,container,typeFor,variant){return window.SASicMarket.categoryHosts(items,container,typeFor,variant,SIC_CATALOG);}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uid(prefix = "ship") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }

function loadMapView() {
  try {
    const saved = JSON.parse(shipStorage.getItem(VIEW_STORAGE_KEY) || "{}");
    return {
      labels: saved.labels !== false,
      highResolution: Boolean(saved.highResolution),
      hull: Boolean(saved.hull),
      combatMesh: Boolean(saved.combatMesh),
      walls: saved.walls !== false,
      stations: saved.stations !== false,
      mode: saved.mode === "explore" ? "explore" : "build",
      zoom: Math.max(0.5, Math.min(4, Number(saved.zoom) || 1)),
      panX: Number(saved.panX) || 0,
      panY: Number(saved.panY) || 0,
    };
  } catch { return { labels: true, highResolution: false, combatMesh: false, walls: true, stations: true, mode: "build", zoom: 1, panX: 0, panY: 0 }; }
}

function constructionState(source) {
  const placements = Array.isArray(source?.placements)
    ? source.placements.filter((item) => item?.sicId && Number.isInteger(item.cell)).map((item) => ({ sicId: String(item.sicId), cell: item.cell, ...(Number.isInteger(item.exteriorCell)?{exteriorCell:item.exteriorCell}:{}), ...(Array.isArray(item.mountCells)?{mountCells:item.mountCells.filter(Number.isInteger)}:{}) }))
    : [];
  const placedIds = new Set(placements.map((item) => item.sicId));
  return {
    title: String(source?.title||''), class: String(source?.class||''), affiliation: String(source?.affiliation||''),
    allowCreditDebt: source?.allowCreditDebt===true || !source?.campaignLink,
    constructionCost: Number(source?.constructionCost)||0,
    groupCredits: Number.isFinite(Number(source?.groupCredits)) ? Number(source.groupCredits) : 100000,
    zoneColumns: window.SAShipMap.gridColumns(source||{}),
    zoneRows: window.SAShipMap.gridRows(source||{}),
    originX: Number(source?.originX)||0, originY: Number(source?.originY)||0,
    thrusterDirection: [0,90,180,270].includes(source?.thrusterDirection)?source.thrusterDirection:null,
    gravityEnabled: source?.gravityEnabled!==false,
    warpFuel: window.SAShipMap.resourceCounts(source?.warpFuel,['F','D','C','B','A','S']),
    minerals: window.SAShipMap.resourceCounts(source?.minerals),
    missileAmmo: JSON.parse(JSON.stringify(source?.missileAmmo||{})),
    missileStorage: JSON.parse(JSON.stringify(source?.missileStorage||{})),
    airlocks: JSON.parse(JSON.stringify(source?.airlocks||[])),
    airlockStates: JSON.parse(JSON.stringify(source?.airlockStates||{})),
    breachState: JSON.parse(JSON.stringify(source?.breachState||null)),
    atmosphereState: JSON.parse(JSON.stringify(source?.atmosphereState||null)),
    cleanserState: JSON.parse(JSON.stringify(source?.cleanserState||null)),
    gravityFieldState: JSON.parse(JSON.stringify(source?.gravityFieldState||null)),
    cloakState: JSON.parse(JSON.stringify(source?.cloakState||null)),
    mapColor: source?.mapColor, mapHeading: source?.mapHeading, mapIcon: window.SAShipMap.shipIconId(source||{}),
    fieldState: JSON.parse(JSON.stringify(source?.fieldState||null)),
    droneState: JSON.parse(JSON.stringify(source?.droneState||null)),
    probeState: JSON.parse(JSON.stringify(source?.probeState||null)),
    fabricationState: JSON.parse(JSON.stringify(source?.fabricationState||null)),
    resourceReceipts: [...(source?.resourceReceipts||[])],
    originOffset: Number.isInteger(source?.originOffset)?source.originOffset:0,
    triangleCells: window.SAShipMap.triangleCells(source||{}),
    gridCells: Array.isArray(source?.gridCells)
      ? [...new Set(source.gridCells.filter((value) => Number.isInteger(value) && value >= 0 && value < window.SAShipMap.gridColumns(source||{}) * window.SAShipMap.gridRows(source||{})))].sort((a, b) => a - b)
      : [],
    sicInventory: Array.isArray(source?.sicInventory)
      ? source.sicInventory.filter((item) => item?.id && SIC_CATALOG[item.type]).map((item) => ({
          attachTo: item.attachTo||undefined, purchasePrice: item.purchasePrice??undefined, shopPurchased:Boolean(item.shopPurchased),pricePerHullSquare:item.pricePerHullSquare,
          id: String(item.id), type: item.type, pendingPurchase: Boolean(item.pendingPurchase),
          rotation: [0,90,180,270].includes(Number(item.rotation))?Number(item.rotation):0,
          weaponFacing: [0,90,180,270].includes(item.weaponFacing)?item.weaponFacing:undefined,
          exteriorRotation: [0,90,180,270].includes(Number(item.exteriorRotation))?Number(item.exteriorRotation):0,
          placedAt: Number(item.placedAt)||0,
          ...Object.fromEntries(['status','disabled','impaired','impairmentPoints','repairDifficulty','bootRemaining','unstable','blueprintType','printed','printedFor','salvaged','salvageSource','fortificationBasePrice'].filter(key=>item[key]!==undefined).map(key=>[key,clone(item[key])])),
          bayWidth: item.type==='docking-bay'?Math.max(2,Math.min(60,Math.floor(Number(item.bayWidth)||2))):undefined,
          bayHeight: item.type==='docking-bay'?Math.max(2,Math.min(60,Math.floor(Number(item.bayHeight)||2))):undefined,
          brigWidth: item.type==='brig'?Math.max(1,Math.min(60,Math.floor(Number(item.brigWidth)||1))):undefined,
          brigHeight: item.type==='brig'?Math.max(1,Math.min(60,Math.floor(Number(item.brigHeight)||1))):undefined,
          stationLayout: item.stationLayout === "corners-v1" ? "corners-v1" : undefined,
          storage: !placedIds.has(String(item.id)) && (item.pendingPurchase ? Boolean(item.storage) : item.storage !== false),
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
    const activeId = shipStorage.getItem(ACTIVE_STARSHIP_KEY) || "";
    // The working copy contains the latest edits, including a ship not confirmed yet.
    // A library selection always writes this key, so the older active entry is fallback only.
    let workingDraft=null;
    try{workingDraft=JSON.parse(shipStorage.getItem(STORAGE_KEY)||'null');}catch{}
    const saved=workingDraft&&typeof workingDraft==='object'&&!Array.isArray(workingDraft)&&workingDraft.id
      ? workingDraft : library.find(ship=>ship?.id===activeId)||{};
    const identity = {
      floorplanSnapshot:saved.floorplanSnapshot,
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

let draft = NEW_SHIP_REQUEST ? defaultDraft() : loadDraft();
if(NEW_SHIP_REQUEST){
  // Persist before removing the URL flag; a reload must recover this exact new ship.
  try{shipStorage.setItem(STORAGE_KEY,JSON.stringify(draft));shipStorage.removeItem(ACTIVE_STARSHIP_KEY);const url=new URL(location.href);url.searchParams.delete('new');history.replaceState(null,'',url);}catch{}
}
GRID_SIZE=window.SAShipMap.gridColumns(draft);
let mapView = {...loadMapView(),...window.SAShipMap.loadViewPreferences(loadMapView())};
if(NEW_SHIP_REQUEST)Object.assign(mapView,{mode:'build',hull:false,zoom:1,panX:0,panY:0});
window.SAShipMap.onViewPreferences(prefs=>{Object.assign(mapView,prefs);renderAll();});
const VIEW_ONLY_MODE = new URLSearchParams(location.search).get("view") === "1";
if (VIEW_ONLY_MODE) mapView.mode = "explore";
document.body.classList.toggle("view-only-starship", VIEW_ONLY_MODE);
let undoState = null;
let selectedSicId = null;
let splitPlacement = null;
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
    const ships = JSON.parse(shipStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(ships) ? ships : [];
  } catch { return []; }
}
function saveStarshipLibrary(ships) {
  try { shipStorage.setItem(LIBRARY_KEY, JSON.stringify(ships.slice(-100))); } catch { /* Keep local recovery available. */ }
}
function storeConfirmedStarship() {
  if (!draft.confirmedOnce) return;
  const library = loadStarshipLibrary();
  const index = library.findIndex((ship) => ship?.id === draft.id);
  const saved = clone(draft);
  if (index >= 0) library[index] = saved; else library.push(saved);
  saveStarshipLibrary(library);
  shipStorage.setItem(ACTIVE_STARSHIP_KEY, draft.id);
}

function saveDraft() {
  if(pageParameters.get('details')==='1')return;
  draft.updatedAt = new Date().toISOString();
  try { shipStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* Keep the editor usable in private contexts. */ }
  storeConfirmedStarship();
}
function saveMapView() {
  window.SAShipMap.saveViewPreferences(mapView);
  try { shipStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(mapView)); } catch { /* View preferences may remain session-only. */ }
}
function formatCredits(value) { return Math.round(value).toLocaleString("en-US"); }
function getWorkingState() { return {...constructionState(draft),doorStates:clone(draft.doorStates||{})}; }
function restoreWorkingState(state) {
  const restored = constructionState(state);
  draft.doorStates=state.doorStates?clone(state.doorStates):Object.fromEntries(Object.entries(draft.doorStates||{}).map(([key,value])=>[key.split(':').map(n=>window.SAShipMap.remapSquare(Number(n),draft,restored)).sort((a,b)=>a-b).join(':'),value]));
  for(const key of ['originOffset','originX','originY','zoneColumns','thrusterDirection'])draft[key]=restored[key];
  GRID_SIZE=window.SAShipMap.gridColumns(restored);splitPlacement=null;
  draft.groupCredits = restored.groupCredits;
  draft.zoneRows = restored.zoneRows;
  draft.airlocks=restored.airlocks;draft.gridCells = restored.gridCells;draft.triangleCells=restored.triangleCells;
  draft.sicInventory = restored.sicInventory;
  draft.placements = restored.placements;
}
function statesMatch(left, right) { return JSON.stringify(constructionState(left)) === JSON.stringify(constructionState(right)); }
function rememberForUndo() { undoState = getWorkingState(); }
function pendingCost() {
  const workingCells = new Set(draft.gridCells);
  const confirmedCells = new Set(draft.confirmed.gridCells.map(n=>window.SAShipMap.remapSquare(n,draft.confirmed,draft)));
  const additions = [...workingCells].filter((cell) => !confirmedCells.has(cell)).length;
  const removals = [...confirmedCells].filter((cell) => !workingCells.has(cell)).length;
  const purchases = draft.sicInventory.filter((item) => item.pendingPurchase).reduce((total, item) => total + window.SAShipMap.sicPrice(item,draft), 0);
  const sales = draft.sicInventory.filter((item) => !item.pendingPurchase && item.pendingDisposition === "sell").reduce((total, item) => total + Math.ceil(window.SAShipMap.sicPrice(item) / (item.printed?4:2)), 0);
  return ((additions - removals) * HULL_COST) + (window.SAShipMap.triangleCells(draft).length-window.SAShipMap.triangleCells(draft.confirmed).length)*300 + purchases - sales + window.SAShipMap.hullUpgradeResizeCost(draft,draft.confirmed) + Object.entries(window.SAShipMap.fortificationInstallPrices(draft,draft.confirmed)).reduce((sum,[id,price])=>sum+Math.max(0,price-(Number(draft.confirmed.sicInventory.find(i=>i.id===id)?.purchasePrice)||0)),0);
}
function selectedSic() {
  return draft.sicInventory.find((item) => item.id === selectedSicId && !item.storage && !item.pendingDisposition) || null;
}
function sicDefinition(itemOrType) {
  const base = SIC_CATALOG[typeof itemOrType === "string" ? itemOrType : itemOrType?.type] || SIC_CATALOG["en-engine-1"];
  return typeof itemOrType === "object" && itemOrType ? { ...base, ...window.SAShipMap.componentDefinition(itemOrType), name:itemOrType.type==='blueprint'?'Blueprint ('+(SIC_CATALOG[itemOrType.blueprintType]?.name||'Unknown SIC')+')':base.name, price:window.SAShipMap.sicPrice(itemOrType,itemOrType.pendingPurchase&&base.hullUpgrade?draft:undefined), threshold:window.SAShipMap.effectiveThreshold(draft,itemOrType) } : base;
}
function placementCells(placement) {
  const item=draft.sicInventory.find(i=>i.id===placement?.sicId);
  return item?window.SAShipMap.placementSquares(draft,item,placement):[];
}
function placementAt(cell) { return draft.placements.find((placement) => placementCells(placement).includes(cell)) || null; }
function placementForSic(sicId) { return draft.placements.find((placement) => placement.sicId === sicId) || null; }

function doorKey(firstCell, secondCell) {
  return [firstCell, secondCell].sort((left, right) => left - right).join(":");
}

function currentDoorOperator() {
  const parameters = new URLSearchParams(location.search);
  const requestedCharacterId = parameters.get("character") || window.SABrowserStorage.local.getItem("sa2e-active-character-v1") || "";
  try {
    const library = JSON.parse(window.SABrowserStorage.local.getItem("sa2e-character-library-v1") || "[]");
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
  wall.className = `sa-map-wall ${side} ${side === "top" || side === "bottom" ? "horizontal" : "vertical"} ${segment}`;
  wall.setAttribute("aria-hidden", "true");
  return wall;
}

function toggleDoor(key) {
  showMessage('Remote door controls are available at a Bridge station: Command → Door Adjustment.');
}

function makeDoor(index, adjacent, side) {
  const key = doorKey(index, adjacent);
  const open = draft.doorStates?.[key] === "open";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sa-map-door ${side} ${side === "top" || side === "bottom" ? "horizontal" : "vertical"}${open ? " is-open" : ""}`;
  button.dataset.doorKey = key;
  const embedded=pageParameters.has('embeddedRecord');
  const unavailable = !embedded&&(mapView.mode !== "explore" || !canOperateDoors());
  button.setAttribute("aria-disabled", String(unavailable));
  button.title = !embedded&&mapView.mode !== "explore"
    ? "Switch to Explore to operate doors"
    : unavailable
      ? "Only a listed crewmember can operate this door"
      : `${open ? "Close" : "Open"} door`;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(open));
  const first = document.createElement("span");
  const second = document.createElement("span");
  first.className = "sa-door-leaf";
  second.className = "sa-door-leaf";
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
  if (row < (draft.zoneRows||20) - 1) neighbors.push(cell + GRID_SIZE);
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
function validateSicPlacement(sicId, cell, exteriorCell=placementForSic(sicId)?.exteriorCell) {
  const item = draft.sicInventory.find((entry) => entry.id === sicId);
  if (!item) return { legal: false, reason: "That SIC is no longer available.", cells: [] };
  const definition = sicDefinition(item); const cells = placementCells({sicId,cell,exteriorCell});
  if(definition.addon){const host=window.SAShipMap.addonHost(draft,item);return {legal:Boolean(host&&host.placement.cell===cell),cells:[],reason:host?'Add-on attached.':'Choose an installed compatible host SIC.'};}
  if(definition.bridgeAddon){const legal=window.SAShipMap.bridgeAddonPlacement(draft,cell);return {legal,reason:legal?'Bridge add-on ready.':'Select an installed Bridge or Cockpit square.',cells:[]};}
  if(definition.landing||definition.multiMount){
    if(draft.placements.some(p=>p.sicId!==sicId&&draft.sicInventory.find(i=>i.id===p.sicId)?.type===item.type))return {legal:false,reason:`Only one ${definition.name} may be installed.`,cells:[]};
    if(draft.gridCells.length>definition.hullLimit)return {legal:false,reason:`${definition.name} supports at most ${definition.hullLimit} hull squares.`,cells:[]};
    if(definition.hullSystem){const legal=window.SAShipMap.hullSymmetry(draft).symmetric;return {legal,reason:legal?'Hull wings ready.':'Aerofoil requires a horizontally or vertically symmetrical hull.',cells:[]};}
    const mounts=placementForSic(sicId)?.mountCells||[];
    return {legal:window.SAShipMap.multiMountPlacement(draft,item,mounts),reason:`${definition.name} requires four separate exterior mounts, each attached to the hull.`,cells:mounts};
  }
  const expectedArea=window.SAShipMap.placementParts(item,{cell,exteriorCell}).reduce((sum,part)=>sum+part.entry.width*part.entry.height,0);
  if (cells.length !== expectedArea) return { legal: false, reason: `${definition.name} does not fit at the edge of the construction grid.`, cells };
  if (definition.edge && !window.SAShipMap.componentAtEdge(draft,cell,item)) return {legal:false,reason:`${definition.name} must be inside the ship, against an outer hull wall.`,cells};
  if (definition.bridge && draft.placements.some(p=>p.sicId !== sicId && sicDefinition(draft.sicInventory.find(i=>i.id===p.sicId)).bridge)) return {legal:false,reason:"A ship may have only one Bridge or Cockpit.",cells};
  if (definition.sensor && draft.placements.some(p=>p.sicId !== sicId && sicDefinition(draft.sicInventory.find(i=>i.id===p.sicId)).sensor)) return {legal:false,reason:"A ship may have only one installed Sensor system.",cells};
  if (definition.darkveil && draft.placements.some(p=>p.sicId !== sicId && sicDefinition(draft.sicInventory.find(i=>i.id===p.sicId)).darkveil)) return {legal:false,reason:"A ship may have only one installed Darkveil. Extra copies can remain in storage.",cells};
  if(definition.mixed){if(!window.SAShipMap.mixedPlacement(draft,item,cell,exteriorCell))return {legal:false,reason:'Place the two control-room squares inside the hull and the barrel outside an outer wall. Rotate to choose another wall.',cells};}
  else if (definition.exterior) {
    const others = draft.placements.filter(p => p.sicId !== sicId && sicDefinition(draft.sicInventory.find(i => i.id === p.sicId)).thruster);
    if (definition.thruster && others.length >= 4) return { legal: false, reason: "A ship may have at most four installed thrusters. Additional thrusters can remain in storage.", cells };
    if (!window.SAShipMap.exteriorPlacement(draft, item.type, cell, sicId)) return { legal: false, reason: "Attach this exterior SIC to an outer hull wall, outside the ship and clear of other SICs.", cells };
  } else if (cells.some((candidate) => !draft.gridCells.includes(candidate))) return { legal: false, reason: `Purchase all ${definition.width * definition.height} required hull squares first.`, cells };
  if (draft.placements.some(placement => placement.sicId !== sicId && placementCells(placement).some(candidate => cells.includes(candidate)))) return { legal: false, reason: "That area already contains a SIC.", cells };
  if (definition.category === "engine") {
    const tooClose = draft.placements.find((placement) => {
      if (placement.sicId === sicId) return false;
      const otherItem = draft.sicInventory.find((entry) => entry.id === placement.sicId);
      const otherDefinition = sicDefinition(otherItem);
      if (otherDefinition.category !== "engine") return false;
      return minimumCellDistance(cells, placementCells(placement)) < Math.max(window.SAShipMap.engineClearance(draft,item), window.SAShipMap.engineClearance(draft,otherItem)) + 1;
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
  const topologyError=window.SAShipMap.exteriorError(draft);if(topologyError)errors.push(topologyError);
  const powerError=window.SAShipPower.constructionError(draft);
  if(powerError)errors.push(powerError);
  if(draft.gridCells.length>400)errors.push('The current hull scale table supports up to 400 hull squares.');
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
    result.cells.forEach((cell) => { if (!result.legal || seenCells.has(cell)) cells.add(cell); seenCells.add(cell); });
  });
  const installedTypes = new Set(draft.placements.map((placement) => draft.sicInventory.find((item) => item.id === placement.sicId)?.type).filter(Boolean));
  if (installedTypes.has("nutritional-supplement") && !installedTypes.has("life-support")) {
    errors.push("Nutritional Supplement requires an installed Life Support SIC.");
    draft.placements.filter((placement) => draft.sicInventory.find((item) => item.id === placement.sicId)?.type === "nutritional-supplement").forEach((placement) => placementCells(placement).forEach((cell) => cells.add(cell)));
  }
  if (!draft.allowCreditDebt && pendingCost() > draft.groupCredits) errors.push("Group Credits are insufficient for these changes.");
  return { errors: [...new Set(errors)], cells };
}

function syncShipField(key, value, source) {
  draft[key] = value;
  shipFields.forEach((field) => { if (field !== source && field.dataset.shipField === key) field.value = value; });
  saveDraft(); renderConstructionControls(); renderShipIconPicker();
}
function clearPlacementPreview() {
  shipGrids.forEach((grid) => grid.querySelectorAll(".placement-preview").forEach((cell) => cell.classList.remove("placement-preview", "is-valid", "is-invalid")));
}
function selectedPlacementCandidate(cell) {
  const item=selectedSic();
  if(!item)return {legal:false,cells:[]};
  const data=sicDefinition(item);
  if(data.multiMount){
    const cells=[...(splitPlacement?.id===item.id?splitPlacement.cells||[]:[]),cell];
    const duplicate=draft.placements.some(p=>p.sicId!==item.id&&draft.sicInventory.find(i=>i.id===p.sicId)?.type===item.type);
    return {legal:!duplicate&&(!data.hullLimit||draft.gridCells.length<=data.hullLimit)&&window.SAShipMap.multiMountPlacement(draft,item,cells,false),cells,reason:duplicate?`Only one ${data.name} may be installed.`:'Choose a separate empty exterior square attached to an outer hull wall.'};
  }
  if(data.hullSystem){const result=validateSicPlacement(item.id,cell);return {...result,legal:result.legal&&draft.gridCells.includes(cell),cells:[cell]};}
  if(!sicDefinition(item).mixed)return validateSicPlacement(item.id,cell);
  if(splitPlacement?.id===item.id)return validateSicPlacement(item.id,splitPlacement.cell,cell);
  const maps=window.SAShipMap,part=maps.segmentDefinition(item,'interior'),cells=maps.rectangleCells(draft,cell,part.width,part.height);
  const outside=maps.outerSpace(draft),sides=maps.gridSides(draft);
  const legal=cells.length===part.width*part.height && cells.every(n=>draft.gridCells.includes(n)&&!placementAt(n)) && cells.some(n=>sides.some(side=>side.valid(n)&&outside.has(n+side.offset)));
  return {legal,cells,reason:legal?'Interior position selected.':'Place the two interior squares inside the hull beside an outer edge.'};
}
function previewPlacement(cellIndex, cellElement) {
  clearPlacementPreview();
  if (!selectedSic()) return;
  const result=selectedPlacementCandidate(cellIndex),grid=cellElement.closest('.ship-grid');
  result.cells.forEach(cell=>grid?.querySelector(`[data-grid-index="${cell}"]`)?.classList.add('placement-preview',result.legal?'is-valid':'is-invalid'));
}
function cancelPlacement() { selectedSicId=null;splitPlacement=null;mobilePreviewCell=null;clearPlacementPreview();renderAll(); }
function placeSelectedSic(cell) {
  const sic=selectedSic();if(!sic)return;
  const result=selectedPlacementCandidate(cell);
  if(!result.legal){showMessage(result.reason,'error');return;}
  if(sicDefinition(sic).multiMount&&result.cells.length<sicDefinition(sic).multiMount){
    splitPlacement={id:sic.id,cells:result.cells};mobilePreviewCell=null;renderAll();
    showMessage(`Hover mount ${result.cells.length} of 4 selected. Select the next exterior mount.`,'success');return;
  }
  if(sicDefinition(sic).mixed&&splitPlacement?.id!==sic.id){
    splitPlacement={id:sic.id,cell};mobilePreviewCell=null;renderAll();
    showMessage('Interior selected. Place the exterior section beside it.','success');return;
  }
  rememberForUndo();
  draft.placements=draft.placements.filter(p=>p.sicId!==sic.id);
  draft.placements.push(sicDefinition(sic).multiMount?{sicId:sic.id,cell:result.cells[0],mountCells:result.cells}:splitPlacement?.id===sic.id?{sicId:sic.id,cell:splitPlacement.cell,exteriorCell:cell}:{sicId:sic.id,cell});
  sic.placedAt=Date.now();selectedSicId=null;splitPlacement=null;mobilePreviewCell=null;
  saveDraft();renderAll();showMessage(`${sicDefinition(sic).name} placed. Confirm Changes to apply it to the ship.`,'success');
}
function removePlacedSic(placement) {
  rememberForUndo();
  const item = draft.sicInventory.find((sic) => sic.id === placement.sicId);
  if(sicDefinition(item).hullUpgrade){showMessage('Use the Hull upgrade inventory controls to refund, sell or destroy it.','error');return;}
  draft.placements = draft.placements.filter((entry) => entry.sicId !== placement.sicId);
  if (item) {item.storage = sicDefinition(item).addon?true:!item.pendingPurchase;if(sicDefinition(item).addon)delete item.attachTo;}
  saveDraft();
  showMessage(item?.pendingPurchase ? `${sicDefinition(item).name} returned to the Installation Queue.` : `${sicDefinition(item).name} moved into Storage.`);
  renderAll();
}
let triangleHullMode=false,airlockBuildMode=false,airlockOperation="add",airlockToMove=null;
function toggleHullCell(index) {
  if(airlockBuildMode){editAirlock(index);return;}
  if(triangleHullMode){toggleTriangleHull(index);return;}
  const occupied = placementAt(index);
  if (occupied) { removePlacedSic(occupied); return; }
  rememberForUndo();
  const hull = new Set(draft.gridCells);
  if(window.SAShipMap.triangleCells(draft).includes(index)){showMessage('Remove the triangle before purchasing a normal hull square here.','error');return;}
  if (hull.has(index)) hull.delete(index); else hull.add(index);
  const issue=window.SAShipMap.triangleError({...draft,gridCells:[...hull]});if(issue){showMessage(issue,'error');return;}
  draft.gridCells = [...hull].sort((a, b) => a - b);
  saveDraft(); renderAll();
}

function paintHullCell(index) {
  if (!hullPaint || hullPaint.visited.has(index) || placementAt(index)) return;
  if(window.SAShipMap.triangleCells(draft).includes(index))return;
  const proposed=new Set(draft.gridCells);if(hullPaint.mode==='add')proposed.add(index);else proposed.delete(index);
  if(window.SAShipMap.triangleError({...draft,gridCells:[...proposed]})){showMessage('Remove the supported triangle first.','error');return;}
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
  if(triangleHullMode||airlockBuildMode)return;
  if (document.body.classList.contains('ship-details-view')) return;
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
  if (document.body.classList.contains('ship-details-view')) return;
  validation = { errors: [], cells: new Set() };
  if (mapView.mode !== "build") return;
  if (!selectedSic()) { toggleHullCell(index); return; }
  if (mobile) { mobilePreviewCell = index; previewPlacement(index, cell); renderMobilePlacement(); return; }
  placeSelectedSic(index);
}
function renderGridCells() {
  const airlockCandidates=new Set(airlockBuildMode?window.SAShipMap.airlockCandidates(draft).map(a=>a.square):[]);
  const hull = new Set(draft.gridCells);
  const layout = window.SAShipMap.buildLayout(draft);
  shipGrids.forEach(grid => window.SAFloorplanSnapshot?.mount(grid,draft,{fullGrid:true}));
  const placementMap = layout.footprint;
  const placementActive = Boolean(selectedSic())&&!document.body.classList.contains('ship-details-view');
  shipGrids.forEach((grid) => {
    window.SAWarpEffects?.updateMap(linkedCampaignState?.starships?.find(s=>s.id===draft.id) || draft,grid);
    grid.classList.toggle("show-sic-labels", mapView.labels);
    grid.classList.toggle("hull-view", mapView.hull);
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
      cell.classList.remove("split-interior-preview");
      cell.classList.toggle("is-selected", hull.has(index));
      cell.classList.toggle("has-engine", definition?.category === "engine");
      cell.classList.toggle("has-sic", Boolean(placement));
      cell.classList.toggle("sic-origin", Boolean(placement && placement.cell === index));
      cell.classList.toggle("construction-error", validation.cells.has(index));
      cell.replaceChildren();
      cell.insertAdjacentHTML("beforeend", window.SAShipMap.surfaceMarkup(layout, index));
      cell.style.removeProperty('outline');cell.style.removeProperty('outline-offset');
      if(airlockCandidates.has(index)){cell.style.outline='2px solid #59dfb0';cell.style.outlineOffset='-3px';}
      cell.style.removeProperty("--sic-basic-color"); cell.style.removeProperty("--sic-floorplan"); cell.style.removeProperty("--sic-tint"); cell.style.removeProperty("--sic-bg-size"); cell.style.removeProperty("--sic-bg-x"); cell.style.removeProperty("--sic-bg-y");
      if (placement) {
        const x = occupied.column; const y = occupied.row;
        cell.style.setProperty("--sic-basic-color", definition.color || "#197a6f");
        cell.style.setProperty("--sic-floorplan", definition.mixed?'none':`url('${definition.floorplan}')`);
        cell.style.setProperty("--sic-tint", definition.tint || "linear-gradient(transparent,transparent)");
        cell.style.setProperty("--sic-bg-size", `${occupied.width * 100}% ${occupied.height * 100}%`);
        cell.style.setProperty("--sic-bg-x", occupied.width === 1 ? "50%" : `${x / (occupied.width - 1) * 100}%`);
        cell.style.setProperty("--sic-bg-y", occupied.height === 1 ? "50%" : `${y / (occupied.height - 1) * 100}%`);
        cell.dataset.sicType = item.type;
      } else delete cell.dataset.sicType;
      if (hull.has(index) && mapView.walls && !placementActive) renderCellBoundaries(cell, index, layout);
      if (placement && occupied.offset===0 && !occupied.exterior && mapView.labels) {
        const label = document.createElement("span");
        label.className = "sic-grid-label";
        label.textContent = definition.name;
        label.style.setProperty("--sic-longest",Math.max(...definition.name.split(/\s+/).map(word=>word.length)));
        label.style.setProperty("--sic-width", String(occupied.width));
        label.style.setProperty("--sic-height", String(occupied.height));
        cell.append(label);
      }
      if (placement && mapView.stations && definition?.stations?.length) {
        const originRow = Math.floor(placement.cell / GRID_SIZE); const originColumn = placement.cell % GRID_SIZE;
        const localX = index % GRID_SIZE - originColumn; const localY = Math.floor(index / GRID_SIZE) - originRow;
        occupied.stations.filter((station) => station.x === occupied.column && station.y === occupied.row).forEach((station, stationIndex) => {
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
  const placementActive = Boolean(selectedSic())&&!document.body.classList.contains('ship-details-view');
  mapViewToggles.forEach((toggle) => {
    const key = toggle.dataset.mapToggle;
    toggle.disabled = window.SAShipMap.viewDisabled(mapView, key);
    toggle.checked = Boolean(mapView[key]) && !toggle.disabled;
    const label = toggle.closest("label");
    const suspended = (key === "highResolution" || key === "walls") && placementActive && mapView[key];
    label?.classList.toggle("is-suspended", suspended);
    if (label) label.title = suspended ? "Basic placement view remains visible while placing a SIC." : "";
  });
}
function applyGridTransform() {
  shipGrids.forEach((grid) => {
    grid.style.setProperty("--cell-size",(grid.clientWidth/GRID_SIZE)+"px");
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
function fittedInteriorView(cells, columns, rows, viewport, detailed=false) {
  if(!cells.length)return {zoom:1,panX:0,panY:0};
  const xs=cells.map(n=>n%columns),ys=cells.map(n=>Math.floor(n/columns));
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const padding=detailed?1:3;
  // The grid's base tile is 5% of its viewport, including expanded 20–60-cell zones.
  const tileLimit=viewport?.width&&viewport?.height?96*20/(viewport.squareTiles?Math.min(viewport.width,viewport.height):Math.max(viewport.width,viewport.height)):6;
  if(viewport?.squareTiles){const tile=Math.min(viewport.width,viewport.height)/20;return {zoom:Math.max(.2,Math.min(6,tileLimit,.94*viewport.width/((right-left+padding)*tile),.88*viewport.height/((bottom-top+padding)*tile))),panX:50-((left+right+1)/2)/columns*100,panY:50-((top+bottom+1)/2)/rows*100};}
  return {zoom:Math.max(.2,Math.min(6,tileLimit,.94*20/(right-left+padding),.88*20/(bottom-top+padding))),
    panX:50-((left+right+1)/2)/columns*100,panY:50-((top+bottom+1)/2)/rows*100};
}
function zoomShipGrid(factor){
 const grid=enlargedShipInterior?.grid||shipGrids.find(g=>g.getClientRects().length),viewport=grid?.parentElement;if(!grid||!viewport)return;
 const box=viewport.getBoundingClientRect(),before=grid.getBoundingClientRect(),x=(box.left+box.width/2-before.left)/before.width,y=(box.top+box.height/2-before.top)/before.height;
 grid.style.transition='none';mapView.zoom=Math.max(.2,Math.min(5,mapView.zoom*factor));applyGridTransform();
 const after=grid.getBoundingClientRect();mapView.panX+=(box.left+box.width/2-after.left-x*after.width)/after.width*100;mapView.panY+=(box.top+box.height/2-after.top-y*after.height)/after.height*100;
 applyGridTransform();saveMapView();requestAnimationFrame(()=>grid.style.transition='');
}
function focusShipCharacter(){
  const own=linkedCampaignState?.ownCharacterId||pageParameters.get('character'),record=linkedCampaignState?.starships.find(s=>s.id===draft.id),loc=record?.characterLocations?.[own];
  if(!loc){fitShipToViewport();return;}
  Object.assign(mapView,{zoom:20/15,panX:50-(loc.square%GRID_SIZE+.5)/GRID_SIZE*100,panY:50-(Math.floor(loc.square/GRID_SIZE)+.5)/(draft.zoneRows||20)*100});saveMapView();applyGridTransform();
}
function fitShipToViewport() {
  const visible=[...new Set([...draft.gridCells,...window.SAShipMap.triangleCells(draft),...window.SAShipMap.buildLayout(draft).footprint.keys()])];
  const viewport=(enlargedShipInterior?.viewport||shipGrids.find(grid=>grid.getClientRects().length)?.parentElement)?.getBoundingClientRect();
  Object.assign(mapView,fittedInteriorView(visible,GRID_SIZE,draft.zoneRows||20,enlargedShipInterior&&viewport?{width:viewport.width,height:viewport.height,squareTiles:true}:viewport,Boolean(embeddedMove)||document.body.classList.contains('ship-details-view')));
  saveMapView();applyGridTransform();
}
function renderMobilePlacement() {
  if (!mobilePlacementControls) return;
  const active = Boolean(selectedSic()) && mobilePreviewCell !== null;
  mobilePlacementControls.hidden = !active;
  if (!active) return;
  const result = selectedPlacementCandidate(mobilePreviewCell);
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
    if (kind === "pending") return Boolean(item.pendingDisposition) || (item.pendingPurchase && !placement && !item.storage);
    if (item.pendingDisposition) return false;
    if (kind === "queue") return !item.pendingPurchase && !placement && !item.storage;
    if (kind === "installed") return Boolean(placement);
    return !placement && item.storage;
  }).sort((a,b)=>(Number(b.placedAt)||0)-(Number(a.placedAt)||0)||draft.sicInventory.indexOf(b)-draft.sicInventory.indexOf(a));
}

function inventoryButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button"; button.textContent = label; button.className = className || "";
  button.addEventListener("click", handler); return button;
}

function locateInstalledSic(item) {
  const placement = placementForSic(item.id);
  if (!placement) return;
  if(!document.body.classList.contains('ship-details-only'))document.querySelector('[data-starship-tab="sheet"]')?.click();
  shipGrids.forEach((grid) => {
    if (grid.offsetParent === null) return;
    const cells = (sicDefinition(item).hullSystem?draft.gridCells:placementCells(placement)).map((index) => grid.querySelector(`[data-grid-index="${index}"]`)).filter(Boolean);
    if (!cells.length) return;
    cells.forEach((cell) => cell.classList.add("located-sic"));
    if (!window.matchMedia("(max-width: 820px)").matches) cells[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setTimeout(() => cells.forEach((cell) => cell.classList.remove("located-sic")), 1800);
  });
}

function renderInventoryList(container, kind, onlyId=null) {
  container.replaceChildren();
  const [title, description] = inventoryHeadings[kind];
  const header = document.createElement("header");
  header.innerHTML = `<strong>${title}</strong><small>${description}</small>`; container.append(header);
  const recent=new Set(draft.sicInventory.slice(-3).map(i=>i.id));
  const items = inventoryGroup(kind).filter(i=>onlyId?i.id===onlyId:recent.has(i.id));
  if (!items.length) {
    const empty = document.createElement("span"); empty.className = "empty-inventory"; empty.textContent = "None"; container.append(empty); return;
  }
  const categoryHosts=sicCategoryHosts(items,container,item=>item.type,'list');
  items.forEach((item) => {
    const definition = sicDefinition(item);
    const card = document.createElement("article"); card.className = `inventory-sic inventory-${kind}`;
    const placement = placementForSic(item.id);
    const name = document.createElement("div"); name.className = "inventory-sic-name";
    const saleValue = Math.ceil(definition.price / (item.printed?4:2));
    const detail = item.pendingDisposition === "sell" ? `Sale pending · +${formatCredits(saleValue)} cr`
      : item.pendingDisposition === "destroy" ? "Destruction pending"
        : item.type==='blueprint'?'Shared by all ship printers':definition.hullUpgrade?'Attached to the whole Hull':definition.addon?(item.attachTo?'Attached to '+escapeHtml(sicDefinition(draft.sicInventory.find(i=>i.id===item.attachTo)||'').name):'Choose a host when installing'):definition.bridgeAddon?'Bridge add-on':definition.hullSystem?'Hull wings':definition.multiMount?`${placement?'4 mounts installed':'4 exterior mounts'} / ${formatCredits(definition.price)} cr`:placement ? `Grid ${Math.floor(placement.cell / GRID_SIZE) + 1}, ${placement.cell % GRID_SIZE + 1}` : `${definition.width}×${definition.height} · ${formatCredits(definition.price)} cr`;
    name.innerHTML = `<strong>${escapeHtml(definition.name)}</strong><small>${detail}</small>`;
    const actions = document.createElement("div"); actions.className = "inventory-sic-actions";
    if(definition.hullUpgrade&&!item.pendingDisposition){
      actions.append(inventoryButton('Locate Hull','locate-sic',()=>locateInstalledSic(item)));
      if(item.pendingPurchase)actions.append(inventoryButton('Refund in Full','refund-sic',()=>refundPendingSic(item)));
      else actions.append(inventoryButton(`Sell ${formatCredits(saleValue)}`,'sell-sic',()=>markSicDisposition(item,'sell')),inventoryButton('Destroy','destroy-sic',()=>markSicDisposition(item,'destroy')));
    } else if (kind === "pending" && item.pendingDisposition) {
      actions.append(inventoryButton("Keep SIC", "keep-sic", () => {
        keepSicDisposition(item);
      }));
    } else if (item.type==='blueprint'&&item.pendingPurchase) {
      actions.append(inventoryButton("Refund in Full", "refund-sic", () => refundPendingSic(item)));
    } else if (kind === "pending" || kind === "queue") {
      actions.append(inventoryButton(selectedSicId === item.id ? "Cancel Placement" : "Place", selectedSicId === item.id ? "is-selected" : "", () => {
        selectedSicId = selectedSicId === item.id ? null : item.id;splitPlacement=null;
        if (selectedSicId) mapView.mode = "build";
        mobilePreviewCell = null; clearPlacementPreview(); saveMapView(); renderAll();
      }));
      if (item.pendingPurchase) actions.append(inventoryButton("Refund in Full", "refund-sic", () => refundPendingSic(item)));
      actions.append(inventoryButton("To Storage", "store-sic", () => moveSicToStorage(item)));
    } else if (kind === "installed") {
      actions.append(inventoryButton("Locate", "locate-sic", () => locateInstalledSic(item)));
      actions.append(inventoryButton(definition.addon?'Detach to Storage':'Remove', 'store-sic', () => removePlacedSic(placement)));
      actions.append(inventoryButton(item.type === "vulnerability-fortification" ? "Purchase Duplicate (choose host)" : `Purchase Duplicate (${formatCredits(definition.price)})`, "duplicate-sic", () => purchaseSic(item.type)));
    } else {
      if(item.type!=='blueprint')actions.append(inventoryButton("Install", "install-sic", () => moveSicToQueue(item)));
      if (item.pendingPurchase) actions.append(inventoryButton("Refund in Full", "refund-sic", () => refundPendingSic(item)));
      else {
        actions.append(inventoryButton(`Sell ${formatCredits(saleValue)}`, "sell-sic", () => markSicDisposition(item, "sell")));
        actions.append(inventoryButton("Destroy", "destroy-sic", () => markSicDisposition(item, "destroy")));
      }
    }
    if(!item.pendingDisposition&&definition.mixed&&(!placement||Number.isInteger(placement.exteriorCell))){
      actions.append(inventoryButton('Rotate Interior','rotate-sic',()=>rotateSic(item,'interior')),inventoryButton('Rotate Exterior','rotate-sic',()=>rotateSic(item,'exterior')));
    }else if (!item.pendingDisposition && definition.width !== definition.height) actions.append(inventoryButton(`Rotate (${definition.width}x${definition.height})`, "rotate-sic", () => rotateSic(item)));
    if(['docking-bay','brig'].includes(item.type)&&!item.pendingDisposition){
      const brig=item.type==='brig',minimum=brig?1:2,prefix=brig?'brig':'bay',title=brig?'Brig':'Docking Bay';
      const size=document.createElement('label');size.textContent=title+' size (hull costs normally) ';size.style.display='flex';size.style.gap='6px';size.style.flexWrap='wrap';
      for(const [key,label]of [[prefix+'Width','Width'],[prefix+'Height','Height']]){const input=document.createElement('input');input.type='number';input.min=String(minimum);input.max='60';input.step='1';input.value=item[key]||minimum;input.setAttribute('aria-label',title+' '+label);input.style.width='60px';input.onchange=input.onblur=()=>{input.value=resizeSic(item.id,key,input.value);};size.append(input);}actions.append(size);
    }
    card.append(name, actions); categoryHosts.get(item).append(card);
  });
}

function resizeSic(sicId,key,rawValue) {
  const item=draft.sicInventory.find(entry=>entry.id===sicId);
  if(!item||!['brig','docking-bay'].includes(item.type)||item.pendingDisposition)return '';
  const minimum=item.type==='brig'?1:2,prefix=item.type==='brig'?'brig':'bay',previous=item[key];
  if(![prefix+'Width',prefix+'Height'].includes(key))return previous||minimum;
  const value=Number(rawValue);
  if(!Number.isInteger(value)||value<minimum||value>60){showMessage(`Room dimensions must be whole numbers from ${minimum} to 60.`,'error');return previous||minimum;}
  if(value===Number(previous||minimum))return value;
  const before=getWorkingState();item[key]=value;
  const placement=placementForSic(sicId),result=placement&&validateSicPlacement(sicId,placement.cell);
  if(result&&!result.legal){if(previous===undefined)delete item[key];else item[key]=previous;showMessage(result.reason,'error');return previous||minimum;}
  undoState=before;saveDraft();renderAll();return value;
}

function refundPendingSic(item) {
  rememberForUndo(); draft.placements = draft.placements.filter((entry) => entry.sicId !== item.id);
  draft.sicInventory = draft.sicInventory.filter((sic) => sic.id !== item.id);
  if (selectedSicId === item.id) selectedSicId = null;
  saveDraft(); showMessage(`Pending ${sicDefinition(item).name} refunded in full.`); renderAll();
}
function rotateSic(item,segment) {
  const before=getWorkingState(),key=segment==='exterior'?'exteriorRotation':'rotation',previous=item[key];
  item[key]=sicDefinition(item).mixed?(Number(item[key]||0)+90)%360:(Number(item[key])===90?0:90);
  const placement=placementForSic(item.id),result=placement&&validateSicPlacement(item.id,placement.cell,placement.exteriorCell);
  if(result&&!result.legal){item[key]=previous;showMessage(`Cannot rotate here: ${result.reason} Remove to storage to reposition it.`,'error');return;}
  if(segment==='interior'&&splitPlacement?.id===item.id)splitPlacement=null;
  undoState=before;mobilePreviewCell=null;clearPlacementPreview();saveDraft();renderAll();
}
function moveSicToStorage(item) {
  if(sicDefinition(item).hullUpgrade){showMessage('Hull upgrades cover the whole ship. Refund, sell or destroy the upgrade to remove it.','error');return;}
  rememberForUndo(); item.storage = true; if (selectedSicId === item.id) selectedSicId = null;
  saveDraft(); showMessage(`${sicDefinition(item).name} moved into Storage.`); renderAll();
}
function moveSicToQueue(item) {
  if(sicDefinition(item).hullUpgrade){rememberForUndo();item.storage=false;item.attachTo='hull';draft.placements=draft.placements.filter(p=>p.sicId!==item.id);draft.placements.push({sicId:item.id,cell:draft.gridCells[0]});saveDraft();renderAll();return;}
  if(item.type==='blueprint'){showMessage('Blueprints are already available to every printer on this ship.');return;}
  if(sicDefinition(item).probe&&draft.sicInventory.filter(i=>sicDefinition(i).probe&&i.attachTo===item.attachTo&&!i.storage&&!i.pendingDisposition&&i.status!=='destroyed'&&draft.placements.some(p=>p.sicId===i.id)).length>=4){showMessage('This Probe Launcher already holds four probes. Store or remove one first.','error');return;}
  if(sicDefinition(item).addon){purchaseAddon(item.type,item);return;}
  rememberForUndo(); item.storage = false; item.pendingDisposition = ""; selectedSicId = item.id;
  saveDraft(); showMessage(`${sicDefinition(item).name} moved to the Installation Queue. Select its hull area.`); renderAll();
}
function keepSicDisposition(item){
  rememberForUndo();item.pendingDisposition='';
  if(sicDefinition(item).hullUpgrade){item.storage=false;const host=window.SAShipMap.addonHost(draft,item);if(host&&!placementForSic(item.id))draft.placements.push({sicId:item.id,cell:host.placement.cell});}
  saveDraft();showMessage(sicDefinition(item).hullUpgrade?'The upgrade will continue covering the Hull.':'The SIC will remain in Storage.');renderAll();
}
async function markSicDisposition(item, disposition) {
  const definition = sicDefinition(item); const saleValue = Math.ceil(definition.price / (item.printed?4:2));
  const message = disposition === "sell"
    ? `Sell this ${definition.name} for ${formatCredits(saleValue)} credits when changes are confirmed?`
    : `Destroy this ${definition.name} permanently when changes are confirmed?`;
  if (!await confirmShipDecision(disposition === "sell" ? "Sell SIC" : "Destroy SIC",message,disposition === "sell" ? "Mark for Sale" : "Mark for Destruction")) return;
  rememberForUndo(); item.pendingDisposition = disposition; item.storage = true;
  saveDraft(); showMessage(disposition === "sell" ? `${definition.name} marked for sale.` : `${definition.name} marked for destruction.`); renderAll();
}

function renderInventory() {
  const linked=Boolean(linkedCampaignState),panel=document.querySelector('[data-starship-panel="sics"]');
  if(panel){panel.classList.toggle('owned-only',linked);if(linked&&!panel.querySelector('.campaign-owned-sics')){const section=document.createElement('section');section.className='campaign-owned-sics';section.innerHTML='<h2>Owned SICs</h2><p>Purchase SICs in the campaign Shop. Install, detach, or store them in Construction.</p><button data-owned-blueprints>Purchase Blueprint</button><div class="purchased-sic-grid" data-purchased-sic-gallery></div>';panel.prepend(section);section.querySelector('[data-owned-blueprints]').onclick=()=>{const dialog=document.createElement('dialog');dialog.className='ship-print-options';dialog.setAttribute('aria-label','Choose Blueprint');dialog.innerHTML='<h2>Choose Blueprint</h2><label>SIC recipe <select>'+Object.entries(SIC_CATALOG).filter(([type])=>window.SAFabrication.recipe(type)).map(([type,data])=>'<option value="'+type+'">'+escapeHtml(data.name)+'</option>').join('')+'</select></label><button data-choose>View Blueprint</button><button data-cancel>Cancel</button>';dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-choose]').onclick=()=>{const type=dialog.querySelector('select').value;dialog.close();openBlueprintPurchase(type);};dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();};}}

  document.querySelectorAll("[data-sic-list]").forEach((container) => renderInventoryList(container, container.dataset.sicList));
  const purchased = draft.sicInventory;
  document.querySelectorAll("[data-purchased-sic-gallery]").forEach((gallery) => {
    gallery.replaceChildren();
    if (!purchased.length) {
      const empty = document.createElement("span"); empty.className = "empty-inventory"; empty.textContent = "No SICs purchased yet."; gallery.append(empty); return;
    }
    const categoryHosts=sicCategoryHosts(purchased,gallery,item=>item.type,'owned');
    purchased.forEach((item, index) => {
      const definition = sicDefinition(item);
      const button = document.createElement("button");
      button.type = "button"; button.className = "purchased-sic-thumbnail"; button.dataset.openSicType = item.type; button.dataset.openSicId = item.id;
      button.style.setProperty("--card-angle", `${[ -2, 1.5, -1, 2, -.5 ][index % 5]}deg`);
      button.style.setProperty("--card-accent", cardAccent(item.type));
      const sourceCard = document.querySelector(`[data-sic-card="${CSS.escape(item.type)}"]`);
      if (sourceCard) {
        const previewCard = previewSicCard(sourceCard);decorateOwnedCard(previewCard,item);
        previewCard.classList.add("purchased-sic-card-preview");
        previewCard.removeAttribute("data-sic-card");
        previewCard.removeAttribute("tabindex");
        previewCard.setAttribute("aria-hidden", "true");
        button.replaceChildren(previewCard);
      } else {
        button.innerHTML = `<strong>${escapeHtml(definition.shortLabel)}</strong><span>${escapeHtml(definition.name)}</span>`;
      }
      button.title = `Open ${definition.name} card`;
      button.setAttribute("aria-label", `Open ${definition.name} card`);
      categoryHosts.get(item).append(button);
    });
  });
}
function renderLiveStats() {
 if(!document.querySelector('.construction-stat-preview')){
  const source=document.querySelector('.desktop-sheet > .desktop-live-stats'),art=document.querySelector('.desktop-sheet > .blueprint-source');
  if(source&&art){const preview=document.createElement('section');preview.className='construction-stat-preview';preview.setAttribute('aria-label','Live ship upgrade statistics');const svg=source.cloneNode(true);svg.setAttribute('viewBox','0 0 612 214');svg.removeAttribute('aria-hidden');svg.setAttribute('role','group');svg.setAttribute('aria-label','Ship statistics; pending changes are yellow');svg.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));const image=document.createElementNS('http://www.w3.org/2000/svg','image');image.setAttribute('href',art.src);image.setAttribute('width','612');image.setAttribute('height','792');svg.prepend(image);preview.append(svg);document.querySelector('.desktop-sheet').before(preview);}
 }

  const confirmed = constructionState(document.body.classList.contains('ship-details-view')?draft.confirmed:draft);
  const baseline=constructionState(draft.confirmed||defaultDraft());
  const baselineRecord={id:draft.id,ship:baseline},baselinePower=window.SAShipPower.output(baselineRecord,window.SAShipPower.campaignUnits(baselineRecord,linkedCampaignState?.characters));
  const baselinePropulsion=window.SAShipMap.propulsion(baseline);
  const baselineStats={credits:formatCredits(baseline.groupCredits),darkveil:window.SAShipMap.masking(baseline)-baselinePropulsion.hsm-baselinePropulsion.exhaust,hull:window.SAShipMap.hullHp(baseline),shield:window.SAShipMap.installedItems(baseline).filter(i=>sicDefinition(i).shield).reduce((n,i)=>n+sicDefinition(i).shieldHp,0),au:baselinePower.au,en:baselinePower.en,hsm:shipScaleStats(baseline.gridCells.length).hsm,masking:window.SAShipMap.masking(baseline)};
  const hull = confirmed.gridCells.length, hullHp=window.SAShipMap.hullHp(confirmed);
  let capabilities=document.querySelector('[data-ship-capabilities]');
  if(!capabilities){capabilities=document.createElement('details');capabilities.dataset.shipCapabilities='';capabilities.className='ship-capabilities';const summary=document.createElement('summary');summary.textContent='Ship Capabilities';capabilities.append(summary,document.createElement('div'));document.querySelector('[data-starship-panel="sheet"]')?.prepend(capabilities);}
  if(capabilities)capabilities.querySelector('div').innerHTML=window.SAShipMap.capabilityMarkup(confirmed);
  const installed = confirmed.placements.map((placement) => confirmed.sicInventory.find((item) => item.id === placement.sicId)).filter(Boolean);
  const linked = linkedCampaignState?.starships?.find(record => record.id === draft.id);
  const powerRecord = { ...linked, id: draft.id, ship: confirmed };
  const power = window.SAShipPower.output(powerRecord, window.SAShipPower.campaignUnits(powerRecord, linkedCampaignState?.characters));
  const enMax = power.en;
  const enAvailable = enMax - window.SAShipPower.demand(powerRecord);
  const au = power.au;
  const shields=installed.filter(item=>sicDefinition(item).shield).reduce((sum,item)=>sum+sicDefinition(item).shieldHp,0);
  document.querySelectorAll('[data-live-stat="shield"]').forEach(element=>{element.textContent=String(shields);});
  document.querySelectorAll('[data-live-stat="au"]').forEach(element => { element.textContent = String(au); });
  const scale = shipScaleStats(hull);
  const propulsion = window.SAShipMap.propulsion(confirmed);
  document.querySelectorAll('[data-live-stat="darkveil"]').forEach(element=>{element.textContent=String(window.SAShipMap.masking(confirmed)-propulsion.hsm-propulsion.exhaust);});
  document.querySelectorAll('[data-live-stat="masking"]').forEach(element => { element.textContent = String(window.SAShipMap.masking(confirmed)); });
  const locks=installed.map(sicDefinition).filter(d=>d.lockOn).sort((a,b)=>b.breakDifficulty-a.breakDifficulty),bestLock=locks[0];
  document.querySelectorAll('[data-break-lock]').forEach(e=>{e.textContent=String(bestLock?.breakDifficulty||0);});
  document.querySelectorAll('[data-lock-dice]').forEach(e=>{e.textContent=bestLock?`${bestLock.lockDice.length}D${bestLock.lockDice[0]}`:'0D0';});
  const sensors = window.SAShipMap.sensorStats(confirmed),sensorDiceText=sensors.dice.length?[...new Set(sensors.dice)].map(d=>sensors.dice.filter(n=>n===d).length+'D'+d).join(' + '):'0 dice';
  document.querySelectorAll('[data-sensor-range]').forEach(element => {element.textContent = sensors.range;});
  document.querySelectorAll('[data-firewall-level]').forEach(element=>{element.textContent=window.SAShipMap.firewallStats(draft);});
  document.querySelectorAll('[data-sensor-dice]').forEach(element => {element.textContent = sensorDiceText;});
  let sensorSummary = document.querySelector('[data-sensor-summary]');
  if (!sensorSummary) {
    sensorSummary = document.createElement('span');sensorSummary.dataset.sensorSummary='';
    document.querySelector('.construction-summary')?.append(sensorSummary);
  }
  sensorSummary.textContent = `Sensors ${sensors.range} Units / ${sensorDiceText}`;
  const oldSensors=window.SAShipMap.sensorStats(baseline);sensorSummary.classList.toggle('pending-construction-value',!document.body.classList.contains('ship-details-view')&&(sensors.range!==oldSensors.range||JSON.stringify(sensors.dice)!==JSON.stringify(oldSensors.dice)));
  document.querySelectorAll('[data-propulsion]').forEach(element => { const key = element.dataset.propulsion; element.textContent = key.startsWith('impulse') ? String(propulsion.impulses[Number(key.slice(-1))] ?? 0) : String(propulsion[key] ?? 0); });
  document.querySelectorAll("[data-propulsion-summary]").forEach(element => { element.textContent = `Impulse ${propulsion.impulses.join(" + ") || "0"} | Move ${propulsion.rawSpeed} | Evade ${propulsion.evadeCount}D${propulsion.evadeDie} | Exhaust ${propulsion.exhaust} | Masking ${window.SAShipMap.masking(confirmed)}`; });
  document.querySelectorAll('[data-live-stat="hull"]').forEach((element) => { element.textContent = String(hullHp); });
  document.querySelectorAll('[data-live-stat="en"]').forEach((element) => {
    const value = String(element.dataset.enPart === "max" ? enMax : enAvailable);
    element.textContent = value;
    element.classList.toggle('stat-attention',Number(value)<0);
    element.classList.toggle("is-long-value", value.length >= 3);
  });
  document.querySelectorAll('[data-live-stat="hsm"]').forEach((element) => { element.textContent = String(scale.hsm); });
  document.querySelectorAll('[data-live-stat="credits"], [data-group-credits]').forEach((element) => { element.textContent = formatCredits(confirmed.groupCredits); });
  document.querySelectorAll("[data-confirmed-scale]").forEach((element) => { element.value = String(scale.scale); element.textContent = String(scale.scale); });
  document.querySelectorAll('[data-live-stat]').forEach(e=>{const k=e.dataset.liveStat,old=k==='en'&&e.dataset.enPart==='available'?baselinePower.en-window.SAShipPower.demand(baselineRecord):baselineStats[k];e.classList.toggle('pending-construction-value',!document.body.classList.contains('ship-details-view')&&String(e.textContent)!==String(old));});
  const pending=!document.body.classList.contains('ship-details-view');
  document.querySelectorAll('[data-propulsion]').forEach(e=>{const k=e.dataset.propulsion,old=k.startsWith('impulse')?baselinePropulsion.impulses[Number(k.slice(-1))]??0:baselinePropulsion[k]??0;e.classList.toggle('pending-construction-value',pending&&String(e.textContent)!==String(old));});
  const oldLock=window.SAShipMap.installedItems(baseline).map(sicDefinition).filter(d=>d.lockOn).sort((a,b)=>b.breakDifficulty-a.breakDifficulty)[0];
  for(const [selector,changed]of [['[data-sensor-range]',sensors.range!==oldSensors.range],['[data-sensor-dice]',JSON.stringify(sensors.dice)!==JSON.stringify(oldSensors.dice)],['[data-firewall-level]',window.SAShipMap.firewallStats(confirmed)!==window.SAShipMap.firewallStats(baseline)],['[data-lock-dice]',JSON.stringify(bestLock?.lockDice)!==JSON.stringify(oldLock?.lockDice)],['[data-break-lock]',bestLock?.breakDifficulty!==oldLock?.breakDifficulty]])document.querySelectorAll(selector).forEach(e=>e.classList.toggle('pending-construction-value',pending&&changed));

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
    confirmButton.disabled = !changed||validation.errors.length>0||Boolean(splitPlacement);
    confirmButton.title=validation.errors.join(' ');
    confirmButton.classList.toggle("has-error", validation.errors.length > 0);
    const costLabel = cost === 0 ? "" : ` (${cost < 0 ? "+" : "-"}${formatCredits(Math.abs(cost))})`;
    confirmButton.textContent = `Confirm Changes${changed ? costLabel : ""}`;
  });
  const commandBar=document.querySelector('.construction-command-bar');
  if(commandBar){let note=commandBar.querySelector('output');if(!note){note=document.createElement('output');note.setAttribute('role','status');commandBar.append(note);}note.textContent=validation.errors[0]||'';note.hidden=!note.textContent;}
  undoButtons.forEach((button) => { button.disabled = !undoState; });
  discardButtons.forEach((button) => { button.disabled = !changed; });
}
function renderShipIconPicker(){
 const art=window.SATokenArt,selected=art.shipId(draft),color=window.SAShipMap.shipColor(draft);
 document.querySelectorAll('[data-ship-icon-options]').forEach(list=>{
  list.closest('.token-picker').style.setProperty('--token-color',color);
  const markup=art.ships.map((name,i)=>`<button type="button" data-ship-icon="${i+1}" aria-pressed="${selected===i+1}" ${VIEW_ONLY_MODE||document.body.classList.contains('ship-details-view')?'disabled':''}><img src="${art.shipImage({mapIcon:i+1})}" alt="" loading="lazy"><span>${name}</span></button>`).join('');
  if(list.innerHTML!==markup)list.innerHTML=markup;
 });
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-ship-icon]');if(!button||button.disabled)return;draft.mapIcon=Number(button.dataset.shipIcon);saveDraft();renderShipIconPicker();renderConstructionControls();});
function renderAll() {
  renderShipIconPicker();
  syncAddonPositions();

  if(splitPlacement&&(selectedSicId!==splitPlacement.id||!selectedSic()||selectedSic().storage||selectedSic().pendingDisposition))splitPlacement=null;
  buildConstructionZone();installTriangleControls();
  document.querySelectorAll('[data-thruster-direction]').forEach(e=>e.value=draft.thrusterDirection===null||draft.thrusterDirection===undefined?'':String(draft.thrusterDirection));
  renderGridCells();
  if(splitPlacement){const item=selectedSic(),part=window.SAShipMap.segmentDefinition(item,'interior'),cells=splitPlacement.cells||window.SAShipMap.rectangleCells(draft,splitPlacement.cell,part.width,part.height);for(const n of cells)for(const grid of shipGrids)grid.querySelector(`[data-grid-index="${n}"]`)?.classList.add('split-interior-preview');}
  renderMapViewControls(); renderGridNavigation(); renderInventory(); renderLiveStats(); renderMobilePlacement(); renderConstructionControls();
  drawDetailsCrew();
  renderVisibleMapControls();
  renderEmbeddedMovement();
  renderShipStores();
}

let shipStockRequest = null;
function renderShipStores(){
  let panel=document.querySelector('[data-ship-stores]');
  if(!panel){
    panel=document.createElement('section');panel.dataset.shipStores='';panel.className='ship-stores';
    panel.innerHTML='<h3>Manage Ship Supplies</h3><div data-stock-values></div><form data-fuel-buy><label>Warp fuel<select name="grade"></select></label><label>Cells<input name="quantity" type="number" min="1" max="10000" value="1"></label><button type="submit">Purchase Fuel</button></form><details data-stock-adjust><summary>Adjust Stock</summary><form><label>Resource<select name="resource"></select></label><label>Quantity<input name="quantity" type="number" min="0" step="1" value="0"></label><button type="submit">Save Quantity</button></form></details><output role="status"></output>';
    document.querySelector('.purchased-sic-shelf').before(panel);
    for(const [grade,fuel] of Object.entries(window.SAShipMap.fuelCatalog))panel.querySelector('[name="grade"]').add(new Option(`${grade}: ${(fuel.parsecs*3.26).toFixed(2)} LY / ${fuel.price.toLocaleString()} cr`,grade));
    panel.querySelector('[data-fuel-buy]').onsubmit=e=>{e.preventDefault();saveShipStock({purchaseGrade:e.target.grade.value,quantity:Number(e.target.quantity.value)});};
    panel.querySelector('[data-stock-adjust] form').onsubmit=e=>{e.preventDefault();const [kind,name]=e.target.resource.value.split(':');saveShipStock({[kind]:{[name]:Number(e.target.quantity.value)}});};
  }
  const fuel=window.SAShipMap.resourceCounts(draft.warpFuel,['F','D','C','B','A','S']),names=['Aethion','Infinium','Carmot','Dark Phaeon','Endernium','Necronium','Phaeon','Drakkonite','Mirium','Argol','Paradon','Crystilium','Ragnoron','Transphaerion','Xpidinium','Umbernium','Umbrexium','Dianium','Zennium','Ruplium','Crinium','Zeltexa','Magnesium','Iron','Dark Phazon','Phazon','Ragnaron','Transpherion','Rupium','Crixium'];
  const minerals=window.SAShipMap.resourceCounts(draft.minerals,[...new Set([...names,...Object.keys(draft.minerals||{})])]);
  const rows=entries=>entries.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${v.toLocaleString()}</dd></div>`).join('');
  const markup=''; // Stock remains on the ship sheet; retain purchase and adjustment controls below.
  const values=panel.querySelector('[data-stock-values]');if(values.dataset.stockMarkup!==markup){values.innerHTML=markup;values.dataset.stockMarkup=markup;}
  const select=panel.querySelector('[name="resource"]'),options=[...Object.keys(fuel).map(k=>[`warpFuel:${k}`,`Warp ${k}`]),...Object.keys(minerals).map(k=>[`minerals:${k}`,k])];
  const optionKey=JSON.stringify(options);if(select.dataset.options!==optionKey){const previous=select.value;select.replaceChildren();for(const [value,label] of options)select.add(new Option(label,value));if(options.some(([value])=>value===previous))select.value=previous;select.dataset.options=optionKey;}
  const readonly=pageParameters.get('details')==='1'||pageParameters.has('embeddedRecord');
  let magazines=panel.querySelector('[data-magazines]');if(!magazines){magazines=document.createElement('div');magazines.dataset.magazines='';magazines.className='stock-missiles';panel.querySelector('[data-stock-values]').after(magazines);}
  const launchers=draft.sicInventory.filter(i=>Number(window.SAShipMap.definition(i.type).capacity)>0&&window.SAShipMap.definition(i.type).missileLauncher);
  const stored=Object.entries(draft.missileStorage||{}).filter(([,n])=>n>0);
  const magazineMarkup='<h3>Ammunition Storage</h3><dl>'+ (stored.length?rows(stored.map(([id,n])=>[window.SAMissileAmmo.catalog[id]?.name||id,n])):'<div><dt>Empty</dt></div>')+'</dl><h3>Loaded Magazines</h3><div class="stock-magazine-list">'+launchers.map(i=>`<p><strong>${escapeHtml(SIC_CATALOG[i.type].name)} · ${window.SAMissileAmmo.used(draft,i.id)} / ${SIC_CATALOG[i.type].capacity}</strong><br>${Object.entries(draft.missileAmmo?.[i.id]||{}).filter(([,n])=>n>0).map(([type,n])=>`${n} ${escapeHtml(window.SAMissileAmmo.catalog[type]?.name||type)}`).join(', ')||'Empty'}</p>`).join('')+'</div>'+(!readonly?'<button type="button" data-buy-missiles>Purchase Ammunition</button>':'');
  if(magazines.innerHTML!==magazineMarkup){magazines.innerHTML=magazineMarkup;magazines.querySelector('button')?.addEventListener('click',()=>purchaseMissile('missile-1'));}
  magazines.hidden=false;
  panel.querySelector('[data-stock-adjust]').hidden=Boolean(linkedCampaignState&&linkedCampaignState.role!=='gm')||readonly;
  panel.querySelector('[data-fuel-buy]').hidden=readonly;
  panel.querySelectorAll('button').forEach(b=>b.disabled=Boolean(linkedCampaignState?.combatActive||shipStockRequest));
  // Replace the printed placeholder fuel quantities without changing the sheet artwork.
  for(const svg of document.querySelectorAll('.desktop-live-stats,.fuel-mobile svg')){
    let group=svg.querySelector('[data-fuel-overlay]');if(!group){group=document.createElementNS('http://www.w3.org/2000/svg','g');group.dataset.fuelOverlay='';svg.append(group);}
    group.innerHTML='<rect x="476" y="51" width="121" height="101" fill="#101010" stroke="#ccc"/><rect x="476" y="51" width="121" height="14" fill="#ccc"/><text x="482" y="61" fill="#000" font-size="8" text-anchor="start">FTL FUEL</text><text x="577" y="61" fill="#000" font-size="7" text-anchor="middle">QTY</text>'+Object.entries(fuel).map(([grade,count],i)=>`<text x="482" y="${76+i*14}" fill="white" font-size="7" text-anchor="start">WARP ${grade}</text><text x="577" y="${76+i*14}" fill="white" font-size="8" text-anchor="middle">${count}</text>`).join('');
  }
  for(const svg of document.querySelectorAll('.desktop-live-stats,.minerals-mobile svg')){
    let group=svg.querySelector('[data-mineral-overlay]');if(!group){group=document.createElementNS('http://www.w3.org/2000/svg','g');group.dataset.mineralOverlay='';svg.append(group);}
    const rowHeight=252/names.length;
    group.innerHTML='<rect x="8" y="378" width="138" height="273" fill="#101010" stroke="#ccc"/><rect x="8" y="378" width="138" height="14" fill="#ccc"/><text x="12" y="388" fill="#000" font-size="8" text-anchor="start">MINERAL</text><text x="124" y="388" fill="#000" font-size="7" text-anchor="middle">QTY</text>'+names.map((name,i)=>`<path d="M8 ${393+(i+1)*rowHeight}h138" stroke="#777" stroke-width=".4"/><text x="12" y="${393+(i+.5)*rowHeight}" dominant-baseline="central" fill="white" font-size="6.2" text-anchor="start">${escapeHtml(name.toUpperCase())}</text><text x="124" y="${393+(i+.5)*rowHeight}" dominant-baseline="central" fill="white" font-size="6.5" text-anchor="middle">${minerals[name]}</text>`).join('');
  }
  const weapons=window.SAShipMap.installedItems(draft).filter(i=>{const d=window.SAShipMap.definition(i.type);return d.weapon||d.planetaryCleanser||d.blackHoleGun;});
  for(const svg of document.querySelectorAll('.desktop-live-stats,.weapons-mobile svg')){
    let group=svg.querySelector('[data-weapon-summary]');if(!group){group=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');group.dataset.weaponSummary='';group.setAttribute('x','8');group.setAttribute('y','651');group.setAttribute('width','305');group.setAttribute('height','130');svg.append(group);}
    const weaponMarkup=`<div xmlns="http://www.w3.org/1999/xhtml" class="sheet-weapon-summary"><strong>WEAPON SYSTEMS</strong>${weapons.length?weapons.map(i=>{const d=window.SAShipMap.definition(i.type),family=d.weaponFamily||'rapid-laser';let damage=d.planetaryCleanser?'20,000D12':d.blackHoleGun?'Black hole':d.phazonTorpedo?'3D10 ×2':d.missileLauncher?'Loaded ammunition':family==='ballistic-rail-cannon'?'6D6':`${d.damageCount||4}D${d.damageDie||4}${d.damageBonus?' + '+d.damageBonus:''}`;let note=d.planetaryCleanser?'Charges for 120 active seconds.':d.blackHoleGun?'Consumes one Dark Phazon; intensity uses AU.':d.phazonTorpedo?'Consumes 1 Phazon; Lock-On required; range 24.':d.missileLauncher?'Fires loaded ammunition; reload at its station.':d.devastation?'Charge before firing; cooldown follows.':d.noShieldDamage?'Hull only; consumes Iron.':d.requiresLock?'Requires a target lock.':d.shieldPiercing?'Bypasses shields.':'Manual or locked fire.';return `<p><b>${escapeHtml(d.name||i.type)}</b> — ${damage}<br/>${note}${d.fireAu?' '+d.fireAu+' AU to fire.':''}</p>`;}).join(''):'<p>No installed weapons.</p>'}</div>`;
    if(group.dataset.summaryMarkup!==weaponMarkup){const scroll=group.firstElementChild?.scrollTop||0;group.innerHTML=weaponMarkup;group.dataset.summaryMarkup=weaponMarkup;if(group.firstElementChild)group.firstElementChild.scrollTop=scroll;}
  }
}
function purchaseMissile(type){
  const launchers=draft.sicInventory.filter(i=>window.SAShipMap.definition(i.type).missileLauncher&&draft.placements.some(p=>p.sicId===i.id));
  let host=document;try{while(host.defaultView.frameElement&&!host.defaultView.frameElement.hasAttribute('data-explore-perspective'))host=host.defaultView.parent.document;}catch{}
  const view=host.createElement('dialog');view.className='missile-load-dialog';view.setAttribute('aria-label','Purchase Ammunition');
  view.style.cssText='width:520px;max-width:95vw;background:#08141c;color:white;padding:24px;border:2px solid #d4ae64';
  view.innerHTML=`<h2>Purchase Ammunition</h2><form><label hidden>Launcher<select name="launcher" aria-label="Missile launcher">${launchers.map((i,n)=>`<option value="${escapeHtml(i.id)}">${escapeHtml(SIC_CATALOG[i.type].name)} #${n+1}</option>`).join('')}</select></label><label>Ammunition<select name="ammunition" aria-label="Ammunition">${Object.values(window.SAMissileAmmo.catalog).map(a=>`<option value="${a.id}" ${a.id===type?'selected':''}>${a.name} / ${a.price} credits</option>`).join('')}</select></label><label>Quantity<input name="quantity" aria-label="Missile quantity" type="number" min="1" step="1" value="1" required></label><p data-space></p><button type="submit" >Purchase Ammunition</button><button type="button" data-close>Close</button><p role="status"></p></form>`;
  const purchaseDraft=draft;let submitting=false;
  const form=view.querySelector('form');for(const label of form.querySelectorAll('label'))label.style.cssText='display:grid;gap:6px;margin:12px 0';
  function update(){form.quantity.max=10000;view.querySelector('[data-space]').textContent=`Available launchers fill automatically; surplus stays in storage. Reload at the launcher during play. Group Credits ${draft.groupCredits.toLocaleString()}`;form.querySelector('[type=submit]').disabled=submitting||Boolean(shipStockRequest)||draft!==purchaseDraft||Boolean(linkedCampaignState?.combatActive);if(draft!==purchaseDraft)view.querySelector('[role=status]').textContent='The selected ship changed. Close this window and reopen Ammunition for the current ship.';}
  form.onchange=update;form.onsubmit=async e=>{e.preventDefault();if(submitting||shipStockRequest||draft!==purchaseDraft)return;submitting=true;update();try{const result=await saveShipStock({purchaseMissile:form.ammunition.value,launcherId:form.launcher.value,quantity:Number(form.quantity.value)});view.querySelector('[role=status]').textContent=result.message;}finally{submitting=false;update();}};
  view.querySelector('[data-close]').onclick=()=>view.close();view.onclose=()=>view.remove();host.body.append(view);view.showModal();update();
}
async function saveShipStock(change){
  const output=document.querySelector('[data-ship-stores] output');
  if(shipStockRequest)return {ok:false,message:'A stock update is already in progress. Please wait.'};
  const target=draft,shipId=target.id,shipName=target.title||'the previous ship',request={id:uid('stock')};
  shipStockRequest=request;
  if(output)output.textContent='Updating ship stores...';
  document.querySelectorAll('[data-ship-stores] button').forEach(button=>button.disabled=true);
  try{
    if(pageParameters.get('details')==='1'||pageParameters.has('embeddedRecord'))throw Error('Open Edit Ship to manage its stores.');
    if(linkedCampaignState?.combatActive)throw Error('You cannot manage ship stores in combat.');
    if(!statesMatch(target,target.confirmed))throw Error('Confirm or discard construction changes before managing stores.');
    const code=target.campaignLink?.roomCode||linkedCampaignState?.code;
    if(code){
      const credentials=activeCampaignCredentials(code),result=await campaignApi('/api/campaign/starship/resources',{code,...credentials,starshipId:shipId,requestId:request.id,...change});
      if(draft!==target||draft.id!==shipId||(draft.campaignLink?.roomCode||linkedCampaignState?.code)!==code){const message='Stores updated for '+shipName+'. Reopen that ship to see its latest stores.';if(output)output.textContent=message;return {ok:true,message,stale:true};}
      linkedCampaignState=result.campaign;
      for(const key of ['warpFuel','minerals','missileAmmo','missileStorage','groupCredits','resourceReceipts'])target[key]=clone(result.starship.ship[key]??(key==='groupCredits'?0:key==='resourceReceipts'?[]:{}));
    }else if(change.purchaseMissile){
      window.SAMissileAmmo.purchase(target,change.purchaseMissile,change.quantity,window.SAShipMap.definition);
    }else if(change.purchaseGrade){
      const fuel=window.SAShipMap.fuelCatalog[change.purchaseGrade],count=change.quantity;
      if(!fuel)throw Error('Choose a valid warp fuel grade.');
      if(!Number.isInteger(count)||count<1||count>10000)throw Error('Enter a whole quantity from 1 to 10000.');
      if(!target.allowCreditDebt&&target.groupCredits<fuel.price*count)throw Error('Not enough Group Credits.');
      target.groupCredits-=fuel.price*count;target.warpFuel||={};target.warpFuel[change.purchaseGrade]=(target.warpFuel[change.purchaseGrade]||0)+count;
    }else for(const kind of ['warpFuel','minerals'])if(change[kind]){
      if(Object.values(change[kind]).some(n=>!Number.isInteger(n)||n<0||n>1000000))throw Error('Enter a nonnegative whole quantity.');
      target[kind]={...target[kind],...change[kind]};
    }
    // Resource purchases must not confirm layout edits made while the request was pending.
    target.confirmed={...target.confirmed};
    for(const key of ['warpFuel','minerals','missileAmmo','missileStorage','groupCredits','resourceReceipts'])if(target[key]!==undefined)target.confirmed[key]=clone(target[key]);
    saveDraft();renderAll();const message='Ship stores updated.';if(output)output.textContent=message;return {ok:true,message};
  }catch(error){if(output)output.textContent=error.message;return {ok:false,message:error.message};}
  finally{if(shipStockRequest===request)shipStockRequest=null;renderShipStores();}
}

shipFields.forEach((field) => {
  const key = field.dataset.shipField; field.value = draft[key] || (field.type==='color'?window.SAShipMap.shipColor(draft):"");
  field.addEventListener("input", () => syncShipField(key, field.value, field));
});
function buildConstructionZone(){shipGrids.forEach((grid) => {
  const mobile = grid.classList.contains("mobile-grid");
  const fragment = document.createDocumentFragment();
  GRID_SIZE=window.SAShipMap.gridColumns(draft);
  const count=window.SAShipMap.gridRows(draft)*GRID_SIZE;
  const cells=[...grid.querySelectorAll(':scope > .ship-grid-cell')];
  for(const cell of cells.slice(count))cell.remove();
  for (let index = Math.min(cells.length,count); index < count; index += 1) {
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
  grid.style.setProperty('grid-template-columns',`repeat(${GRID_SIZE},1fr)`,'important');
  grid.style.setProperty('width',`${GRID_SIZE*5}%`,'important');grid.style.setProperty('left',`${(20-GRID_SIZE)*2.5}%`,'important');grid.style.right='auto';
  grid.style.setProperty('grid-template-rows',`repeat(${draft.zoneRows||20},1fr)`,'important');
  grid.style.setProperty('height',`${(draft.zoneRows||20)*5}%`,'important');
  grid.style.top=`${(20-(draft.zoneRows||20))*2.5}%`;
});resizeEnlargedShipInterior();}
buildConstructionZone();
function resizeConstruction(columns,rows,dx,dy){
  if(linkedCampaignState?.combatActive){showMessage('Resize or center the construction zone outside combat.','error');return;}
  rememberForUndo();draft=window.SAShipMap.resizeZone(draft,columns,rows,dx,dy);GRID_SIZE=columns;splitPlacement=null;saveDraft();renderAll();fitShipToViewport();
}
for(const toolbar of document.querySelectorAll('.construction-summary')){
  const expand=document.createElement('button'),center=document.createElement('button');
  expand.type=center.type='button';expand.textContent='Expand Zone +2 Each Side';center.textContent='Center Ship in Construction Zone';
  expand.onclick=()=>{const cols=window.SAShipMap.gridColumns(draft),rows=window.SAShipMap.gridRows(draft);if(cols+4>60||rows+4>60){showMessage('Maximum construction zone: 60 columns by 60 rows.');return;}resizeConstruction(cols+4,rows+4,2,2);};
  center.onclick=()=>{
    const cells=[...new Set([...draft.gridCells,...window.SAShipMap.buildLayout(draft).footprint.keys()])];if(!cells.length)return;
    const cols=window.SAShipMap.gridColumns(draft),rows=window.SAShipMap.gridRows(draft),xs=cells.map(n=>n%cols),ys=cells.map(n=>Math.floor(n/cols));
    resizeConstruction(cols,rows,Math.floor((cols-Math.max(...xs)-Math.min(...xs)-1)/2),Math.floor((rows-Math.max(...ys)-Math.min(...ys)-1)/2));
  };
  const direction=document.createElement('label');direction.textContent='All Thrusters ';
  const select=document.createElement('select');select.dataset.thrusterDirection='';select.setAttribute('aria-label','All thrusters direction');
  select.innerHTML='<option value="">Follow hull edge</option><option value="90">Exhaust left</option><option value="270">Exhaust right</option><option value="180">Exhaust up</option><option value="0">Exhaust down</option>';
  select.onchange=()=>{rememberForUndo();draft.thrusterDirection=select.value===''?null:Number(select.value);saveDraft();renderAll();};direction.append(select);
  const controls=document.createElement('div');controls.className='construction-zone-controls';const weapons=document.createElement('label');weapons.textContent='All Weapons ';const facing=document.createElement('select');facing.setAttribute('aria-label','All weapons direction');facing.innerHTML='<option value="">Choose facing</option><option value="0">Up</option><option value="90">Right</option><option value="180">Down</option><option value="270">Left</option>';weapons.append(facing);
  facing.onchange=()=>{
    if(facing.value==='')return;rememberForUndo();const skipped=[];
    for(const item of draft.sicInventory.filter(i=>window.SAShipMap.definition(i.type).weapon)){
      const d=window.SAShipMap.definition(item.type),placement=placementForSic(item.id),key=d.mixed?'exteriorRotation':'rotation',old=item[key],originalPlacement=placement?{...placement}:null;
      const restore=()=>{if(old===undefined)delete item[key];else item[key]=old;if(placement){for(const name of Object.keys(placement))delete placement[name];Object.assign(placement,originalPlacement);}};
      if(d.mixed&&placement&&!Number.isInteger(placement.exteriorCell)){
        const cells=[...window.SAShipMap.buildLayout(draft).footprint].filter(([,c])=>c.sicId===item.id),inside=cells.filter(([,c])=>!c.exterior),outside=cells.filter(([,c])=>c.exterior);
        const signature=entries=>JSON.stringify(entries.map(([square,c])=>[square,c.stations.filter(s=>s.x===c.column&&s.y===c.row).map(s=>s.mesh)]).sort((a,b)=>a[0]-b[0]));
        placement.cell=Math.min(...inside.map(([n])=>n));placement.exteriorCell=Math.min(...outside.map(([n])=>n));
        if(signature(inside)!==signature([...window.SAShipMap.buildLayout(draft).footprint].filter(([,c])=>c.sicId===item.id&&!c.exterior))){restore();skipped.push(d.name);continue;}
      }
      item[key]=Number(facing.value);const result=placement&&validateSicPlacement(item.id,placement.cell,placement.exteriorCell);
      if(result&&!result.legal){restore();skipped.push(d.name);}else if(!d.mixed)item.weaponFacing=Number(facing.value);
    }
    saveDraft();renderAll();showMessage(skipped.length?'Kept original facing: '+skipped.join(', '):'Weapon facing updated.');facing.value='';
  };controls.append(expand,center,direction,weapons);toolbar.append(controls);
}
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
  zoomShipGrid(action==="in"?1.25:.8);
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
  let panGesture = null, suppressPanClick=false;
  grid.addEventListener("click",event=>{if(suppressPanClick){event.preventDefault();event.stopImmediatePropagation();}},true);
  grid.addEventListener("pointerdown", (event) => {

    if (event.button!==0 || (mapView.mode !== "explore" && !document.body.classList.contains("ship-details-view")) || event.target.closest(".sa-map-door,button,input,select")) return;
    panGesture = { x: event.clientX, y: event.clientY, panX: mapView.panX, panY: mapView.panY, moved:false };

  });
  grid.addEventListener("pointermove", (event) => {
    if (!panGesture) return;
    if(!panGesture.moved&&Math.hypot(event.clientX-panGesture.x,event.clientY-panGesture.y)<6)return;
    if(!panGesture.moved){grid.setPointerCapture?.(event.pointerId);grid.classList.add("is-panning");}
    panGesture.moved=true;suppressPanClick=true;
    const rect = grid.getBoundingClientRect();
    mapView.panX = panGesture.panX + ((event.clientX - panGesture.x) / rect.width * 100);
    mapView.panY = panGesture.panY + ((event.clientY - panGesture.y) / rect.height * 100);
    applyGridTransform();
  });
  const finishPan = () => {
    if (!panGesture) return;
    panGesture = null; grid.classList.remove("is-panning"); saveMapView();setTimeout(()=>suppressPanClick=false,0);
  };
  grid.addEventListener("pointerup", finishPan);
  grid.addEventListener("pointercancel", finishPan);
});
function clearPurchaseFeedback(){const feedback=document.querySelector('[data-purchase-feedback]');if(feedback){feedback.textContent='';delete feedback.dataset.tone;}}
function showSicPurchaseFeedback(message,tone='error',localFeedback){
  showMessage(message,tone);const feedback=document.querySelector('[data-purchase-feedback]');if(feedback){feedback.textContent=message;feedback.dataset.tone=tone;}if(localFeedback)localFeedback.textContent=message;
}
function rejectSicPurchase(message,localFeedback){
  showSicPurchaseFeedback(message,'error',localFeedback);return false;
}
function purchaseSic(type) {
  if(typeof linkedCampaignState!=='undefined'&&linkedCampaignState&&!SIC_CATALOG[type]?.fuel&&SIC_CATALOG[type]?.category!=='missile-ammo'){showMessage('Purchase SICs in the campaign Shop tab. Unused SICs can be claimed from shared storage there.');return false;}
  if(type==='blueprint')return rejectSicPurchase('Choose Buy blueprint on the SIC you want to craft.');
  clearPurchaseFeedback();
  if(SIC_CATALOG[type]?.addon)return purchaseAddon(type);
  if(SIC_CATALOG[type]?.category==='missile-ammo'){purchaseMissile(type);return true;}
  const definition = SIC_CATALOG[type]; if (!definition) return false;
  if(definition.fuel){saveShipStock({purchaseGrade:definition.grade,quantity:1});document.querySelector('[data-starship-tab="sheet"]')?.click();document.querySelector('[data-ship-stores]')?.scrollIntoView({block:'center'});return;}
  if (!draft.allowCreditDebt && pendingCost() + definition.price > draft.groupCredits) return rejectSicPurchase(`Not enough Group Credits to purchase ${definition.name}.`);
  if(definition.hullLimit&&draft.gridCells.length>definition.hullLimit)return rejectSicPurchase(`${definition.name} cannot be purchased for a ship larger than ${definition.hullLimit} hull squares.`);
  rememberForUndo();
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  draft.sicInventory.push({ id, type, rotation: 0, stationLayout: "corners-v1", pendingPurchase: true, storage: false, pendingDisposition: "" });
  selectedSicId = id; mapView.mode = "build"; saveDraft(); saveMapView();
  document.querySelector('[data-starship-tab="sheet"]')?.click();
  showMessage(definition.exterior ? `${definition.name}: select empty space attached to an outer hull wall.` : `${definition.name} added to pending purchases. Select its ${definition.width}×${definition.height} hull area to install it.`, "success"); renderAll();
  if(definition.multiMount)showMessage(`${definition.name}: select four separate exterior squares attached to the hull. All four mounts share this one SIC purchase.`);
  if(definition.bridgeAddon)showMessage('Select an installed Bridge or Cockpit square to attach '+definition.name+'. It does not occupy additional hull space.');
  else if(definition.hullSystem)showMessage('Decent (Aerofoil): the hull must mirror horizontally or vertically; internal equipment need not match. Select any hull square to install the wings. Runway landing requires Move 5+.');
  return true;
}
document.querySelectorAll("[data-purchase-sic]").forEach((button) => button.addEventListener("click", () => purchaseSic(button.dataset.purchaseSic)));
function undoConstruction() {
  if (!undoState) return;
  const current = getWorkingState(); restoreWorkingState(undoState); undoState = current;
  selectedSicId = null; mobilePreviewCell = null; validation = { errors: [], cells: new Set() };
  saveDraft(); showMessage("The last construction decision was undone."); renderAll();
}
async function discardConstruction() {
  if(!await confirmShipDecision('Discard Changes','Discard all unconfirmed purchases and layout changes? The last confirmed ship will be restored.','Discard Changes'))return;
  rememberForUndo(); restoreWorkingState(draft.confirmed);
  selectedSicId = null; mobilePreviewCell = null; validation = { errors: [], cells: new Set() };
  saveDraft(); showMessage("All unconfirmed construction changes were discarded."); renderAll();
}
let confirmingConstruction=false;
async function confirmConstruction() {
  if(confirmingConstruction)return;
  const before=clone(draft);
  if(splitPlacement){showMessage('Place the exterior section or cancel placement before confirming.','error');return;}
  const airlockError=window.SAShipMap.ensureAirlocks(draft);
  validation = inspectConstruction();
  if(airlockError)validation.errors.push(airlockError);
  if (validation.errors.length) {
    showMessage(validation.errors.join(" "), "error"); renderGridCells(); renderConstructionControls(); return;
  }
  const cost = pendingCost();
  draft.groupCredits -= cost;
  const destroyedIds=draft.sicInventory.filter(item=>item.pendingDisposition==="destroy").map(item=>item.id);
  const removedIds = new Set(draft.sicInventory.filter((item) => item.pendingDisposition).map((item) => item.id));
  draft.placements = draft.placements.filter((placement) => !removedIds.has(placement.sicId));
  draft.sicInventory = draft.sicInventory.filter((item) => !item.pendingDisposition);
  draft.sicInventory.forEach((item) => {
    if(SIC_CATALOG[item.type]?.hullUpgrade)item.purchasePrice=window.SAShipMap.sicPrice(item,draft);
    item.pendingPurchase = false; item.pendingDisposition = "";
    item.storage = !placementForSic(item.id);
  });
  draft.constructionCost=draft.gridCells.length*HULL_COST+window.SAShipMap.triangleCells(draft).length*300+draft.sicInventory.reduce((sum,item)=>sum+window.SAShipMap.sicPrice(item,draft),0);
  draft.confirmed = constructionState(draft);
  draft.confirmedOnce = true;
  undoState = null; selectedSicId = null; mobilePreviewCell = null;
  mapView.mode = "explore";
  confirmingConstruction=true;confirmButtons.forEach(b=>b.disabled=true);
  try{draft.floorplanSnapshot=await window.SAFloorplanSnapshot.compile(draft);await syncLinkedStarship(true,destroyedIds);}catch(error){draft=before;showMessage('Changes were not confirmed: '+error.message,'error');renderConstructionControls();return;}finally{confirmingConstruction=false;}
  saveDraft(); saveMapView();
  showMessage(`Construction confirmed. ${cost < 0 ? `${formatCredits(Math.abs(cost))} credits refunded.` : `${formatCredits(cost)} credits spent.`}`, "success");
  renderSavedStarships(); renderCampaignLink(); renderAll();
  if(!draft.campaignLink&&!VIEW_ONLY_MODE){for(const target of [document.querySelector('#exportStarship'),document.querySelector('[data-starship-campaign-code]')]){target?.classList.add('ship-workflow-highlight');target?.addEventListener('click',()=>target.classList.remove('ship-workflow-highlight'),{once:true});}}
}
undoButtons.forEach((button) => button.addEventListener("click", undoConstruction));
discardButtons.forEach((button) => button.addEventListener("click", discardConstruction));
confirmButtons.forEach((button) => button.addEventListener("click", confirmConstruction));
document.querySelectorAll("[data-starship-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.starshipTab;
    document.body.classList.toggle('ship-details-view',target==='details');
    document.querySelectorAll("[data-starship-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
    document.querySelectorAll("[data-starship-panel]").forEach((panel) => {
      const active = panel.dataset.starshipPanel === (target==='details'?'sheet':target); panel.classList.toggle("is-active", active); panel.hidden = !active;
    });
    renderAll();
    if(target==='sheet'||target==='details')requestAnimationFrame(fitShipToViewport);
  });
});

const savedStarshipSelect = document.querySelector("#savedStarshipSelect");
const starshipSaveState = document.querySelector("#starshipSaveState");
const importStarshipFile = document.querySelector("#importStarshipFile");
const linkStarshipForms = [...document.querySelectorAll("[data-link-starship-form]")];
let linkedCampaignState = null;

function applyDraftToUi() {
  document.querySelectorAll(".ship-workflow-highlight").forEach(element => element.classList.remove("ship-workflow-highlight"));
  shipFields.forEach((field) => { field.value = draft[field.dataset.shipField] || (field.type==='color'?window.SAShipMap.shipColor(draft):""); });
  popularityInputs.forEach((input) => { input.value = String(draft.popularity || 0); });
  selectedSicId = null; mobilePreviewCell = null; undoState = null;
  renderReputationSelections(); renderSavedStarships(); renderAll(); renderCampaignLink();
  requestAnimationFrame(fitShipToViewport);
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
let shipDecisionPending = false;
function confirmShipDecision(title, message, actionLabel) {
  if(shipDecisionPending)return Promise.resolve(false);
  shipDecisionPending=true;
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='ship-print-options ship-decision-dialog';dialog.setAttribute('aria-label',title);
    const heading=document.createElement('h2');heading.textContent=title;
    const description=document.createElement('p');description.textContent=message;
    const form=document.createElement('form');form.method='dialog';
    const cancel=document.createElement('button');cancel.type='submit';cancel.value='cancel';cancel.textContent='Cancel';
    const proceed=document.createElement('button');proceed.type='submit';proceed.value='confirm';proceed.textContent=actionLabel;
    form.append(cancel,proceed);dialog.append(heading,description,form);
    dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();shipDecisionPending=false;resolve(accepted);},{once:true});
    document.body.append(dialog);dialog.showModal();cancel.focus();
  });
}
async function startNewStarship() {
  if (!await confirmShipDecision('New Starship', 'Start a fresh starship? The current unconfirmed work will be replaced. Confirmed starships remain saved.', 'Start New Ship')) return;
  shipStorage.removeItem(ACTIVE_STARSHIP_KEY);
  resetNewShipMapView();
  draft = defaultDraft(); saveDraft(); applyDraftToUi();
}
function resetNewShipMapView() {
  Object.assign(mapView, { mode: "build", hull: false, zoom: 1, panX: 0, panY: 0 });
  saveMapView();
}
function loadSavedStarship(id) {
  const selected = loadStarshipLibrary().find((ship) => ship?.id === id);
  if (!selected) return;
  draft = clone(selected); shipStorage.setItem(ACTIVE_STARSHIP_KEY, draft.id); saveDraft(); applyDraftToUi();
}
function duplicateStarship() {
  if (!draft.confirmedOnce) return;
  const now = new Date().toISOString();
  draft = { ...clone(draft), id: uid(), title: `${draft.title || "Untitled Starship"} Copy`, campaignLink: null, createdAt: now, updatedAt: now };
  saveDraft(); applyDraftToUi();
}
function exportStarship() {
  if (!draft.confirmedOnce) return;
  const portable=clone(draft);delete portable.campaignLink;delete portable.crewCharacterIds;delete portable.crewmemberNames;
  const payload = { format: "spaceship-architect-2e-starship", version: 1, exportedAt: new Date().toISOString(), starship: portable };
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
async function deleteStarship() {
  if (!draft.confirmedOnce || !await confirmShipDecision('Delete Local Starship',`Delete ${draft.title || "this starship"} from this device? This removes its local saved copy. Export it first if you need a backup.`,'Delete Local Copy')) return;
  const library = loadStarshipLibrary().filter((ship) => ship.id !== draft.id); saveStarshipLibrary(library);
  shipStorage.removeItem(ACTIVE_STARSHIP_KEY); draft = defaultDraft(); saveDraft(); applyDraftToUi();
}
function activeCampaignCredentials(code) {
  const operator = pageParameters.get("character")?{id:pageParameters.get("character")}:currentDoorOperator();
  const characterToken = operator?.id ? localStorage.getItem(`sa-character-token-${code}-${operator.id}`) || sessionStorage.getItem(`sa-character-token-${code}-${operator.id}`) || "" : "";
  const gmToken = localStorage.getItem(`sa-gm-token-${code}`) || sessionStorage.getItem(`sa-gm-token-${code}`) || "";
  return pageParameters.get("embedded")==="pc"?{token:characterToken,characterId:operator?.id||""}:{ token: gmToken || characterToken || localStorage.getItem("sa-room-player-"+code) || "", characterId: gmToken ? "" : operator?.id || "" };
}
async function campaignApi(path, body = null, method = "POST") {
  if(pageParameters.get('details')==='1'&&method!=='GET'&&path!=='/api/campaign/starship/details'&&path!=='/api/campaign/reputation')throw new Error('Open Edit Ship to make changes.');
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
  if(linkedCampaignState?.combatActive&&linkedCampaignState.role!=='gm'&&!document.body.classList.contains('ship-details-view')){
    document.body.classList.add('ship-details-view');
    showMessage('you cannot perform this action in combat','error');
    if(parent!==window)parent.postMessage({type:'sa-ship-editor-exit',message:'you cannot perform this action in combat'},location.origin);
  }
  const latest=linkedCampaignState?.starships?.find(s=>s.id===draft.id);
  if(latest && !confirmingConstruction && draft.campaignLink && (latest.buildRevision||0)!==(draft.campaignLink.buildRevision||0)){
    draft={...draft,...clone(latest.ship),confirmed:constructionState(latest.ship),campaignLink:{...draft.campaignLink,buildRevision:latest.buildRevision||0}};selectedSicId=null;undoState=null;saveDraft();document.body.classList.add("ship-details-view");applyDraftToUi();renderAll();showMessage("Another crew member confirmed changes. Your editor has closed and the latest ship is displayed. Reopen Upgrade to edit again.","error");if(parent!==window)parent.postMessage({type:"sa-ship-editor-exit",message:"Another crew member confirmed ship changes. Your editor has closed; reopen Upgrade to edit the latest ship."},location.origin);
  }
  renderCampaignLink();
  renderLiveStats();
}
function campaignMessage(message, tone = "") {
  document.querySelectorAll("[data-starship-campaign-message]").forEach((output) => { output.textContent = message; output.dataset.tone = tone; });
}
function renderCampaignLink() {
  for(const grid of document.querySelectorAll(".ship-grid"))window.SAWarpEffects?.updateMap(linkedCampaignState?.starships?.find(s=>s.id===draft.id)||draft,grid);
  document.querySelectorAll(".sic-buy-blueprint,[data-owned-blueprints]").forEach(b=>b.hidden=!canBuyBlueprint());
  const linked = draft.campaignLink;
  if (linked) document.querySelectorAll(".ship-workflow-highlight").forEach(element => element.classList.remove("ship-workflow-highlight"));
  const records = linkedCampaignState?.characters || [];
  const credentials = linked ? activeCampaignCredentials(linked.roomCode) : null;
  document.body.classList.toggle("has-linked-crew-access", Boolean(linked && credentials?.token));
  const currentRecord=linkedCampaignState?.starships?.find(ship=>ship.id===draft.id);
  const selected = new Set(currentRecord?.crewCharacterIds || draft.crewCharacterIds || []);
  document.querySelectorAll('[data-assigned-crew]').forEach(n=>{const names=records.filter(r=>selected.has(r.id)).map(r=>r.character?.identity?.characterName||'Unnamed Character').concat((linkedCampaignState?.npcRoster||[]).filter(u=>currentRecord?.crewNpcUnitIds?.includes(u.id)).map(u=>u.characterName));n.innerHTML=names.length?names.map(name=>'<div>'+escapeHtml(name)+'</div>').join(''):'<small>No assigned crew.</small>';});
  const npcSelected = new Set(linkedCampaignState?.starships?.find(ship => ship.id === draft.id)?.crewNpcUnitIds || []);
  linkStarshipForms.forEach((form) => { form.hidden = Boolean(linked); });
  document.querySelectorAll("[data-starship-campaign-status]").forEach((status) => { status.hidden = !linked; });
  document.querySelectorAll("[data-save-starship-crew]").forEach((button) => { button.hidden = !linked || linkedCampaignState?.role !== "gm"; });
  if (!linked) {
    document.querySelectorAll("[data-link-starship]").forEach((button) => { button.disabled = false; button.title = draft.confirmedOnce ? "" : "Confirm Ship First"; });
    document.querySelectorAll("[data-starship-crew-list]").forEach((list) => { list.innerHTML = '<span class="empty-inventory">Link this ship to assign crew.</span>'; });
    return;
  }
  document.querySelectorAll("[data-linked-campaign-name]").forEach((node) => { node.textContent = linkedCampaignState?.name || linked.campaignName || "Campaign"; });
  document.querySelectorAll("[data-linked-campaign-code]").forEach((node) => { node.textContent = linked.roomCode; });
  document.querySelectorAll("[data-linked-control-type]").forEach((node) => { node.textContent = linked.controlType === "gm" ? "GM Controlled" : "PC Controlled"; });
  const overview = (id, npc = false, fallback = null) => window.SACrewOverview.markup(window.SACrewOverview.details(id, npc, linkedCampaignState?.combatShipIds ? (linkedCampaignState.starships||[]).filter(s=>linkedCampaignState.combatShipIds.includes(s.id)) : linkedCampaignState?.starships || [], linkedCampaignState?.crewLocations || [], fallback));
  const markup = records.length ? records.map((record) => `<label class="starship-crew-option"><input type="checkbox" data-starship-crew="${escapeHtml(record.id)}" ${linkedCampaignState?.role !== "gm" ? "disabled" : ""} value="${escapeHtml(record.id)}" ${selected.has(record.id) ? "checked" : ""}/><span>${escapeHtml(record.character?.identity?.characterName || "Unnamed Character")}</span></label>`).join("") : linkedCampaignState ? "<p>No characters have joined this campaign yet.</p>" : "<p>Campaign characters could not be loaded. Reopen this ship from the GM Starships tab.</p>";
  const npcMarkup = linkedCampaignState?.role === "gm" ? `<h4>NPC Crew</h4>${(linkedCampaignState.npcRoster || []).map(unit => `<label class="starship-crew-option"><input type="checkbox" data-npc-crew data-starship-npc-crew="${escapeHtml(unit.id)}" value="${escapeHtml(unit.id)}" ${npcSelected.has(unit.id) ? "checked" : ""}/><span>${escapeHtml(unit.characterName)}</span></label>`).join("") || "<p>Add an NPC in Encounter Control to make it available here.</p>"}` : "";
  document.querySelectorAll("[data-starship-crew-list]").forEach((list) => { window.SALiveDOM.render(list, markup + npcMarkup); });
}
async function linkStarship(event) {
  event.preventDefault();
  if (!draft.confirmedOnce || !statesMatch(draft, draft.confirmed)) { campaignMessage("Confirm Ship First", "error"); return; }
  const form = event.currentTarget; const code = form.querySelector("[data-starship-campaign-code]").value.trim().toUpperCase();
  try {
    if(!EMBEDDED_GM_MODE&&await window.SARoomV03?.importIntoRoom(code,"ship",draft))return;
    const result = await campaignApi("/api/campaign/starship/link", { code, ...activeCampaignCredentials(code), controlType: form.querySelector("[data-starship-control-type]").value, starship: draft });
    draft.campaignLink = { roomCode: code, campaignName: result.campaignName, controlType: result.starship.controlType, accessKey: result.accessKey };
    draft.crewCharacterIds = []; saveDraft(); linkedCampaignState = null; await refreshLinkedCampaign(); campaignMessage("Starship linked successfully.");
  } catch (error) { campaignMessage(error.message, "error"); }
}
async function syncLinkedStarship(strict=false,destroyedIds=[]) {
  if (!draft.campaignLink?.roomCode || !draft.confirmedOnce) return;
  const link = draft.campaignLink; const credentials = activeCampaignCredentials(link.roomCode);
  try { const result=await campaignApi("/api/campaign/starship/save", { code: link.roomCode, token: credentials.token, characterId: credentials.characterId, accessKey: link.accessKey, buildRevision:link.buildRevision||0, destroyedIds, starship: draft }); link.buildRevision=result.starship.buildRevision||0; }
  catch (error) { if(strict)throw error;campaignMessage(`Saved locally. Campaign sync needs attention: ${error.message}`, "error"); }
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
  if (!draft.campaignLink || !await confirmShipDecision("Unlink Starship", "Unlink this starship? It will remain saved on this device and campaign crew assignments will be cleared.", "Unlink Starship")) return;
  const credentials = activeCampaignCredentials(draft.campaignLink.roomCode);
  try { await campaignApi("/api/campaign/starship/unlink", { code: draft.campaignLink.roomCode, token: credentials.token, accessKey: draft.campaignLink.accessKey, starshipId: draft.id }); }
  catch (error) { campaignMessage(error.message, "error"); return; }
  draft.campaignLink = null; draft.crewCharacterIds = []; draft.crewmemberNames = []; linkedCampaignState = null; saveDraft(); renderCampaignLink();
}));
document.querySelectorAll("[data-save-starship-crew]").forEach((button) => button.addEventListener("click", async () => {
  if (!draft.campaignLink) return;
  const tools = button.closest("[data-crew-campaign-tools]");
  const crewCharacterIds = [...tools.querySelectorAll("[data-starship-crew-list] input:checked:not([data-npc-crew])")].map(input => input.value);
  const crewNpcUnitIds = [...tools.querySelectorAll("[data-npc-crew]:checked")].map(input => input.value);
  const credentials = activeCampaignCredentials(draft.campaignLink.roomCode);
  try {
    const result = await campaignApi("/api/campaign/starship/crew", { code: draft.campaignLink.roomCode, token: credentials.token, characterId: credentials.characterId, starshipId: draft.id, crewCharacterIds, crewNpcUnitIds });
    button.classList.remove('assignments-dirty');draft.crewCharacterIds = result.starship.crewCharacterIds; saveDraft(); campaignMessage("Crew assignments saved."); await refreshLinkedCampaign();
  } catch (error) { campaignMessage(error.message, "error"); }
}));

const sicCards = [...document.querySelectorAll("[data-sic-card]")];
let cardHost = document;
try { while(cardHost.defaultView.frameElement&&!cardHost.defaultView.frameElement.hasAttribute('data-explore-perspective')) cardHost = cardHost.defaultView.parent.document; } catch {}
if (cardHost !== document && !cardHost.querySelector("link[data-sic-cards-style]")) {
  const style = cardHost.createElement("link"); style.rel = "stylesheet"; style.dataset.sicCardsStyle = "";
  style.href = new URL("sic-cards.css?v=20260910-cockpit-1", location.href).href; cardHost.head.append(style);
}
const sicCardDialog = cardHost === document ? document.querySelector("#sicCardDialog") : cardHost.createElement("dialog");
if (cardHost !== document) { sicCardDialog.innerHTML = '<button type="button" data-close-sic-card>Back</button><div data-sic-card-dialog-body></div>'; cardHost.body.append(sicCardDialog); }
sicCardDialog.className = "sic-card-dialog sic-inspection";
sicCardDialog.setAttribute("aria-label", "SIC card details");
sicCardDialog.querySelector("[data-close-sic-card]").textContent = "Back";
sicCardDialog.querySelector("[data-close-sic-card]").setAttribute("aria-label", "Back to cards");
let inspectedTrigger = null, closingCard = false;
let activeFamilyDialog = null;
let disposeFamilyDialog = null;
function attachFloorplanPreview(card,type,container) {
  const d=SIC_CATALOG[type],art=card.querySelector('.sic-poker-art');
  if(!art||!d?.image||(!d.floorplanPreview&&(!d.width||!d.height||d.hullSystem)))return;
  let popup;
  const hide=()=>{popup?.remove();popup=null;};
  art.addEventListener('pointerenter',()=>{
    const previewDocument=container.ownerDocument;
    hide();popup=previewDocument.createElement('aside');popup.className='sic-floorplan-preview';
    const installation=Boolean(d.floorplanPreview),label=installation?'installation preview':'floorplan';
    const size=installation?(d.addon==='hull'?'Whole-hull coating · no floor space':'Inside its Shield · no extra floor space'):d.mixed?`${d.width} × ${d.exteriorRows} EXT + ${d.interiorWidth||d.width} × ${d.interiorRows||d.height-d.exteriorRows} EDG`:`${d.width} × ${d.height}${d.exterior?' EXT':''}`;
    popup.innerHTML=`<strong>${escapeHtml(d.name)} ${label}</strong>${d.mixed&&d.sprite?`<img class="sic-preview-exterior" src="${escapeHtml(d.sprite)}" alt="${escapeHtml(d.name)} exterior">`:''}<img src="${escapeHtml(d.floorplanPreview||d.image)}" alt="${escapeHtml(d.name)} ${label}"><small>${escapeHtml(size)}</small>`;
    container.append(popup);const r=art.getBoundingClientRect(),w=previewDocument.defaultView.innerWidth,h=previewDocument.defaultView.innerHeight;
    popup.style.left=`${Math.max(8,Math.min(w-248,r.left-248))}px`;popup.style.top=`${Math.max(8,Math.min(h-popup.offsetHeight-8,r.top))}px`;
  });
  art.addEventListener('pointerleave',hide);art.addEventListener('pointerdown',hide);
}
market.querySelectorAll('[data-sic-card]').forEach(card=>attachFloorplanPreview(card,card.dataset.sicCard,document.body));
function openSicFamily(family,items,trigger){return sharedSicMarket.openFamily(family,items,trigger);}

function openSicCard(sicCard, trigger = sicCard) {
  if (!sicCard || sicCardDialog.open) return;
  inspectedTrigger = trigger;
  const cloneCard = previewSicCard(sicCard);
  const installedItem = draft.sicInventory.find(item => item.id === trigger?.dataset.openSicId);
  if(!installedItem){const type=sicCard.dataset.sicCard||sicCard.dataset.sicPreview,d=SIC_CATALOG[type];return window.SACardInspector.open(sicCard,{document:cardHost,trigger,title:d?.name,purchase:VIEW_ONLY_MODE?null:()=>{const ok=purchaseSic(type);if(ok)sharedSicMarket.dispose();return ok;},blueprint:canBuyBlueprint()&&!VIEW_ONLY_MODE&&window.SAFabrication.recipe(type)?()=>openBlueprintPurchase(type):null,preview:d&&(d.shipControl||d.shield||d.sensor||d.weapon||d.lockOn||d.utility||d.hacking)?()=>window.SACardInspector.previewConsole(type,cardHost):null});}

  if(canBuyBlueprint()&&!installedItem&&window.SAFabrication.recipe(cloneCard.dataset.sicPreview)&&!VIEW_ONLY_MODE){const buy=cardHost.createElement("button");buy.className="sic-buy-blueprint";buy.textContent="Buy blueprint";buy.onclick=()=>openBlueprintPurchase(cloneCard.dataset.sicPreview);sicCardDialog._blueprintAction=buy;}
  if (installedItem) {
    decorateOwnedCard(cloneCard,installedItem);
    const locate = cardHost.createElement("button"); locate.type = "button"; locate.className = "sic-inspector-locate"; locate.textContent = "Locate";
    locate.disabled = !placementForSic(installedItem.id); locate.title = locate.disabled ? "This SIC is not installed" : "Locate this installed SIC";
    locate.addEventListener("click", async () => { await closeSicCard(); locateInstalledSic(installedItem); });
    cloneCard.append(locate);
  }
  sicCardDialog.style.setProperty("--card-accent", cardAccent(cloneCard.dataset.sicPreview));
  const body=sicCardDialog.querySelector("[data-sic-card-dialog-body]");body.replaceChildren(cloneCard);
  const tools=cardHost.createElement('aside');tools.className='sic-inspector-tools';if(sicCardDialog._blueprintAction){tools.append(sicCardDialog._blueprintAction);delete sicCardDialog._blueprintAction;}body.prepend(tools);
  const definition=SIC_CATALOG[cloneCard.dataset.sicPreview];
  if(definition&&(definition.shipControl||definition.shield||definition.sensor||definition.weapon||definition.lockOn||definition.utility||definition.hacking)){
    const preview=cardHost.createElement('button');preview.textContent='Preview Console';preview.style.cssText='background:#586570;color:#fff;border:1px solid #becbd0';
    preview.onclick=async()=>{
      if(preview.disabled)return;preview.disabled=true;preview.textContent='Loading Console…';
      try{
        // Preview dialogs are mounted in this document, outside their hidden
        // combat iframe. Load the shared console skin here before opening it.
        await Promise.all(['ship-navigation-ui.css','space-map.css','health-display.css','combat-workspace.css','combat-actions.css','console-common.css'].map(name=>{
          const href=new URL(name,location.href).href;
          if([...cardHost.styleSheets].some(sheet=>sheet.href?.split('?')[0]===href))return;
          return new Promise((resolve,reject)=>{const link=cardHost.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=()=>{link.remove();reject(new Error('Console styles could not load. Click to retry.'));};cardHost.head.append(link);});
        }));
        if(!preview.isConnected||!sicCardDialog.open)return;
        const frame=cardHost.createElement('iframe');frame.title='Static console preview';frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';frame.src='index.html?catalogPreview='+encodeURIComponent(cloneCard.dataset.sicPreview);cardHost.body.append(frame);
        preview.title='';
      }catch(error){preview.title=error.message;preview.textContent='Retry Console';}
      finally{preview.disabled=false;if(preview.textContent!=='Retry Console')preview.textContent='Preview Console';}
    };tools.prepend(preview);
  }
  sicCardDialog.classList.remove("is-zoomed");sicCardDialog.style.removeProperty("--inspection-width");
  let cardZoom=1;
  body.onwheel=event=>{
    if(!event.target.closest('[data-sic-preview]'))return;
    event.preventDefault();
    const maxZoom=Math.max(.65,(cardHost.defaultView.innerWidth-(tools.childElementCount?172:48))/350);
    cardZoom=Math.max(.65,Math.min(maxZoom,cardZoom+(event.deltaY<0?.2:-.2)));
    cloneCard.style.zoom=cardZoom;
    sicCardDialog.classList.add("is-zoomed");
    sicCardDialog.style.setProperty("--inspection-width",`${350*cardZoom+(tools.childElementCount?170:46)}px`);
  };
  if(installedItem&&!VIEW_ONLY_MODE&&!document.body.classList.contains("ship-details-view")){const panel=cardHost.createElement("aside");panel.className="sic-context-actions";const kind=Object.keys(inventoryHeadings).find(k=>inventoryGroup(k).some(i=>i.id===installedItem.id));if(kind){renderInventoryList(panel,kind,installedItem.id);panel.addEventListener("click",e=>{if(e.target.closest("button"))closeSicCard();});body.append(panel);}}
  sicCardDialog.showModal();
  if (!cardHost.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches) sicCardDialog.animate([{ opacity: 0, transform: "translateY(35px) scale(.72) rotate(-4deg)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(.16,1,.3,1)" });
}
function closeSicCard() {
  // Never await an animation to release a modal: background frames can suspend it.
  closingCard = false;
  for(const animation of sicCardDialog.getAnimations())animation.cancel();
  if(sicCardDialog.open)sicCardDialog.close();
  if(inspectedTrigger?.isConnected)inspectedTrigger.focus({preventScroll:true});
}
sicCards.forEach((sicCard) => {
  sicCard.addEventListener("click", () => openSicCard(sicCard));
  sicCard.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSicCard(sicCard); } });
});
document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-open-sic-type]");
  if (!trigger) return;
  openSicCard(document.querySelector(`[data-sic-card="${CSS.escape(trigger.dataset.openSicType)}"]`), trigger);
});
sicCardDialog.querySelector("[data-close-sic-card]").addEventListener("click", closeSicCard);
sicCardDialog.addEventListener("click", (event) => { if (event.target === sicCardDialog) closeSicCard(); });
sicCardDialog.addEventListener("cancel", event => { event.preventDefault(); closeSicCard(); });
window.addEventListener("pagehide", () => { sharedSicMarket.dispose(); disposeFamilyDialog?.(); if (cardHost !== document) sicCardDialog.remove(); });

const reputationValues = ["+5", "+4", "+3", "+2", "+1", "0", "+1", "+2", "+3", "+4", "+5"];
const reputationNames = [["Benevolent", "Ruthless"], ["Virtuous", "Treacherous"], ["Civil", "Savage"], ["Powerful", "Weak"], ["Cunning", "Exploitable"]];
function renderReputationSelections() {
  document.querySelectorAll(".reputation-position").forEach((position) => {
    const selected = draft.reputationSelections[Number(position.dataset.row)] === Number(position.dataset.index);
    position.setAttribute("aria-disabled",String(!canEditReputation()));position.setAttribute("tabindex",canEditReputation()?"0":"-1");
    position.classList.toggle("selected", selected); position.setAttribute("aria-pressed", String(selected));
    position.querySelectorAll("circle, text").forEach((element) => element.classList.toggle("selected", selected));
  });
}
let reputationSaveQueue=Promise.resolve();
function canEditReputation(){return linkedCampaignState?.role==='gm';}
function persistReputation(){
 if(!canEditReputation())return;const values=[...draft.reputationSelections],popularity=draft.popularity||0,shipId=draft.id,code=linkedCampaignState.code,credentials=activeCampaignCredentials(code),receipt=crypto.randomUUID();
 reputationSaveQueue=reputationSaveQueue.catch(()=>{}).then(async()=>{try{await campaignApi('/api/campaign/reputation',{code,...credentials,shipId,kind:'edit',values,popularity,receipt});}catch(error){showMessage(error.message,'error');throw error;}});void reputationSaveQueue.catch(()=>{});
}
function chooseReputation(rowIndex, index) { if(!canEditReputation())return;draft.reputationSelections[rowIndex] = index; renderReputationSelections(); saveDraft();persistReputation(); }
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
  if (value === ""||!canEditReputation()) return;
  draft.popularity = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  popularityInputs.forEach((input) => { if (input !== source) input.value = String(draft.popularity); }); saveDraft();persistReputation();
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
  if(parameters.has('embeddedRecord')){
    const value=await new Promise((resolve,reject)=>{
      let attempts=0;const request=()=>{if(++attempts>20){clearInterval(timer);window.removeEventListener('message',receive);reject(Error('Ship details could not be loaded. Reopen the Starships tab.'));return;}parent.postMessage({type:'sa-ship-detail-ready'},location.origin);};
      const receive=event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='sa-ship-detail-data')return;clearInterval(timer);window.removeEventListener('message',receive);resolve(event.data);};
      window.addEventListener('message',receive);const timer=setInterval(request,500);request();
    });
    draft={...defaultDraft(),...clone(value.record.ship),id:value.record.id,title:value.record.title,confirmed:constructionState(value.record.ship),confirmedOnce:true,campaignLink:null};linkedCampaignState=value.campaign;const index=linkedCampaignState.starships.findIndex(s=>s.id===value.record.id);if(index>=0)linkedCampaignState.starships[index]=value.record;
  } else if (NEW_SHIP_REQUEST) {
    resetNewShipMapView();
    if (campaignCode) document.querySelectorAll("[data-starship-campaign-code]").forEach((input) => { input.value = campaignCode; });
    saveDraft();
  } else if (requestedShipId && campaignCode) {
    const credentials = activeCampaignCredentials(campaignCode);
    try {
      await campaignApi('/api/campaign/starship/details',{code:campaignCode,token:credentials.token,ids:[requestedShipId]});
      const state = await campaignApi(`/api/campaign/state?code=${encodeURIComponent(campaignCode)}&token=${encodeURIComponent(credentials.token)}`, null, "GET");
      const record = (state.starships || []).find((entry) => entry.id === requestedShipId);
      if (record) {
        draft = {
          ...defaultDraft(), ...clone(record.ship), id: record.id, title: record.title || record.ship.title,
          confirmed: constructionState(record.ship),
          confirmedOnce: true, crewCharacterIds: clone(record.crewCharacterIds || []),
          campaignLink: { buildRevision:record.buildRevision||0, roomCode: campaignCode, campaignName: state.name, controlType: record.controlType, accessKey: draft.campaignLink?.accessKey || "" },
        };
        for(const key of ['warpFuel','minerals','missileAmmo','missileStorage','groupCredits','resourceReceipts'])if(record.ship[key]!==undefined){draft[key]=clone(record.ship[key]);draft.confirmed[key]=clone(record.ship[key]);}
        linkedCampaignState = state; saveDraft();
      }
    } catch (error) { campaignMessage(error.message, "error"); }
  }
  applyDraftToUi();renderReputationSelections();popularityInputs.forEach(input=>input.disabled=!canEditReputation());
  if (!draft.campaignLink && campaignCode) document.querySelectorAll("[data-starship-campaign-code]").forEach((input) => { input.value = campaignCode; });
  if (draft.campaignLink) await refreshLinkedCampaign();
  if(parameters.get('embedded')==='pc'){
    const notify=()=>parent.postMessage({type:'sa-character-sheet-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().bottom+scrollY)+48},location.origin);
    new ResizeObserver(notify).observe(document.body);notify();
  }
  if(parameters.get('details')==='1'){
    document.querySelector('[data-starship-tab="details"]')?.click();
    document.querySelectorAll('[data-starship-tab]').forEach(b=>b.hidden=true);
    document.querySelectorAll('input,textarea,select').forEach(e=>{if(!e.matches('[data-map-toggle],[data-map-display]')&&!(canEditReputation()&&e.matches('[data-reputation-popularity]')))e.disabled=true;});
    document.body.classList.add('ship-details-only');
    const readOnlyStyle=document.createElement('style');readOnlyStyle.textContent='.ship-details-only .starship-tabs,.ship-details-only .starship-library{display:none!important}';document.head.append(readOnlyStyle);
    const notify=()=>parent.postMessage({type:'sa-character-sheet-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().bottom+scrollY)+48},location.origin);
    new ResizeObserver(notify).observe(document.body);notify();
  }
}
initializeStarshipPage().catch(error=>{const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=error.message;document.querySelector('main').replaceChildren(message);}).finally(()=>{window.SAViewReady?.();if(pageParameters.has('embeddedRecord'))parent.postMessage({type:'sa-ship-map-ready'},location.origin);});
const shipPrintButton=document.createElement('button');shipPrintButton.type='button';shipPrintButton.textContent='Print Starship';shipPrintButton.className='ship-print-button';shipPrintButton.onclick=()=>window.SAShipPrint.open(draft,draft.title);document.querySelector('.starship-tabs').append(shipPrintButton);
function drawDetailsCrew(){
  if(!new URLSearchParams(location.search).has('embeddedRecord'))return;
  const record=linkedCampaignState?.starships.find(s=>s.id===draft.id);
  for(const grid of shipGrids){const viewport=grid.closest('[data-grid-viewport]')||grid.parentElement;viewport.classList.toggle('planet-landed-interior',Boolean(record?.surfaceTerrain));if(record?.surfaceTerrain)viewport.style.setProperty('--planet-ground',`url("${window.SAPlanetTerrain.texture(record.surfaceTerrain)}")`);else viewport.style.removeProperty('--planet-ground');}
  const away=record?.surfaceAwayCharacterIds?.includes(linkedCampaignState?.ownCharacterId||pageParameters.get('character'));
  for(const grid of shipGrids)for(const door of grid.querySelectorAll('[data-door-key]')){door.disabled=!!away;door.setAttribute('aria-disabled',String(!!away));}
  const walkingDoors=new Set([...Object.values(record?.characterWalks||{}).flatMap(job=>window.SAShipWalking.sample(job,Date.now()+(record.walkClockOffset||0)).openDoorKeys||[]),...Object.values(record?.motion||{}).flatMap(point=>point.openDoorKeys||[])]);
  for(const grid of shipGrids){for(const door of grid.querySelectorAll('[data-walk-door]'))if(!walkingDoors.has(door.dataset.doorKey)){door.classList.toggle('is-open',record?.ship?.doorStates?.[door.dataset.doorKey]==='open');delete door.dataset.walkDoor;}for(const key of walkingDoors)for(const door of grid.querySelectorAll(`[data-door-key="${CSS.escape(key)}"]`)){door.dataset.walkDoor='';door.classList.add('is-open');}}
  document.querySelectorAll('.ship-detail-crew[data-crew-id]').forEach(e=>{if(!record?.characterLocations?.[e.dataset.crewId])e.remove();});
  const aiStations=record?.aiStations||Object.values(record?.ship?.crewRoomState?.rooms||{}).filter(d=>d.enabled!==false&&d.automationMode&&d.automationMode!=='off'&&d.automationSeat).map(d=>({id:'ship-ai-'+record.id,name:d.name||'Ship AI',location:d.automationSeat}));
  document.querySelectorAll('.ship-detail-ai').forEach(e=>{if(!aiStations.some(a=>a.id===e.dataset.aiUnitId))e.remove();});
  for(const ai of aiStations)for(const grid of shipGrids){const cell=grid.querySelector(`[data-grid-index="${ai.location.square}"]`);if(!cell)continue;const marker=grid.querySelector(`[data-ai-unit-id="${CSS.escape(ai.id)}"]`)||document.createElement('i');marker.className='ship-detail-crew ship-detail-ai';marker.dataset.aiUnitId=ai.id;marker.dataset.shipAi='true';marker.title=ai.name+' (bridge station)';marker.style.left=`${(ai.location.mesh%3+.5)/3*100}%`;marker.style.top=`${(Math.floor(ai.location.mesh/3)+.5)/3*100}%`;if(marker.parentElement!==cell)cell.append(marker);}
  for(const [id,loc] of Object.entries(record?.characterLocations||{}))for(const grid of shipGrids){
    const cell=grid.querySelector(`[data-grid-index="${loc.square}"]`);if(!cell)continue;
    const person=linkedCampaignState.characters.find(c=>c.id===id),occupant=record.interiorOccupants?.find(u=>u.id===id),marker=grid.querySelector(`[data-crew-id="${CSS.escape(id)}"]`)||document.createElement('i'),mesh=Number(loc.mesh??4),motion=record.characterWalks?.[id]?window.SAShipWalking.sample(record.characterWalks[id],Date.now()+(record.walkClockOffset||0)):record.motion?.[id];
    marker.className='ship-detail-crew crew-token'+(motion?' player-ship-moving-token':loc.stationed?' stationed':'');marker.dataset.crewId=id;const tokenInfo=window.SATokenArt.character(occupant||person||{});marker.dataset.tokenRace=tokenInfo.race;marker.dataset.tokenVariant=String(tokenInfo.variant);marker.dataset.fallen=String(Number(record.crewHealth?.[id]??occupant?.currentHp??person?.character?.health?.current)>-1&&Number(record.crewHealth?.[id]??occupant?.currentHp??person?.character?.health?.current)<=0);marker.style.setProperty('--token-color',record.crewColors?.[id]||occupant?.color||person?.character?.presentation?.atbColor||'#39e58f');
    if(!marker.querySelector('.crew-figure'))marker.textContent=(person?.character.identity?.characterName||'?').slice(0,1);
    marker.title=(occupant?.name||person?.character.identity?.characterName||'Crew')+(loc.stationed?' (stationed)':'');
    marker.dataset.walking=String(Boolean(motion?.walking));
    if(motion){marker.style.left=`${motion.x/GRID_SIZE*100}%`;marker.style.top=`${motion.y/(draft.zoneRows||20)*100}%`;marker.style.setProperty('--crew-heading',`${motion.heading}deg`);if(marker.parentElement!==grid)grid.append(marker);}
    else{marker.style.left=`${((mesh%3)+.5)/3*100}%`;marker.style.top=`${(Math.floor(mesh/3)+.5)/3*100}%`;if(marker.parentElement!==cell)cell.append(marker);}
  }
  for(const grid of shipGrids)window.SACrewTokens?.decorate(grid);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='sa-ship-detail-update'||!pageParameters.has('embeddedRecord'))return;
  const record=event.data.record;if(!linkedCampaignState||!record||record.id!==draft.id)return;
  const rosterChanged=JSON.stringify(linkedCampaignState.characters)!==JSON.stringify(event.data.characters||linkedCampaignState.characters)||JSON.stringify(linkedCampaignState.starships.find(s=>s.id===draft.id)?.crewCharacterIds)!==JSON.stringify(record.crewCharacterIds)||JSON.stringify(linkedCampaignState.npcRoster)!==JSON.stringify(event.data.npcRoster||linkedCampaignState.npcRoster);
  if(Array.isArray(event.data.characters))linkedCampaignState.characters=event.data.characters;
  if(Array.isArray(event.data.npcRoster))linkedCampaignState.npcRoster=event.data.npcRoster;
  linkedCampaignState.combatShipIds=event.data.combatShipIds??null;
  const index=linkedCampaignState.starships.findIndex(s=>s.id===draft.id),previous=linkedCampaignState.starships[index];
  if(index>=0)linkedCampaignState.starships[index]=record;
  if(JSON.stringify(previous?.ship)!==JSON.stringify(record.ship)){
    draft={...draft,...clone(record.ship),title:record.title,confirmed:constructionState(record.ship),campaignLink:null};
    shipFields.forEach(field=>{field.value=draft[field.dataset.shipField]||(field.type==='color'?window.SAShipMap.shipColor(draft):'');});renderAll();
  }else{if(rosterChanged)renderCampaignLink();drawDetailsCrew();renderEmbeddedMovement();}
});
function renderVisibleMapControls(){
  for(const grid of shipGrids){
    const panel=enlargedShipInterior?.grid===grid?enlargedShipInterior.controlHost:grid.closest('.desktop-sheet')||grid.closest('.mobile-grid-panel')||grid.parentElement;
    let toolbar=panel.querySelector('.ship-map-display-controls');
    if(!toolbar){
      toolbar=document.querySelector('[data-map-view-controls]').cloneNode(true);toolbar.classList.add('ship-map-display-controls');toolbar.removeAttribute('data-map-view-controls');toolbar.setAttribute('aria-label','Map View');
      toolbar.querySelectorAll('[data-map-toggle]').forEach(input=>{input.dataset.mapDisplay=input.dataset.mapToggle;delete input.dataset.mapToggle;});
      toolbar.addEventListener('pointerdown',event=>event.stopPropagation());
      toolbar.addEventListener('change',event=>{const key=event.target.dataset.mapDisplay;if(!key)return;mapView[key]=event.target.checked;saveMapView();renderAll();if(pageParameters.has('embeddedRecord'))parent.postMessage({type:'sa-ship-map-view',key,value:mapView[key]},location.origin);});
      if(panel.matches('.desktop-sheet'))toolbar.classList.add('desktop-map-display');
      panel.prepend(toolbar);
    }
    toolbar.hidden=!document.body.classList.contains('ship-details-view');
    toolbar.querySelectorAll('[data-map-display]').forEach(input=>{const key=input.dataset.mapDisplay;input.disabled=window.SAShipMap.viewDisabled(mapView,key);input.checked=Boolean(mapView[key])&&!input.disabled;input.closest('label').title=input.disabled?'Hidden while Hull view is active. Turn Hull off to restore your interior settings.':'';});
  }
}
var embeddedMove=null;
function renderEmbeddedMovement(){
  if(!pageParameters.has('embeddedRecord'))return;
  for(const grid of shipGrids){
    const controlHost=enlargedShipInterior?.grid===grid?enlargedShipInterior.controlHost:grid.closest('.desktop-sheet')||grid.closest('.mobile-grid-panel');
    let controls=enlargedShipInterior?.grid===grid?enlargedShipInterior.controls:controlHost.querySelector('.embedded-move-controls');
    if(!controls){controls=document.createElement('div');controls.className='embedded-move-controls';controls.innerHTML='<button type="button" data-action="begin">Move</button><button type="button" data-action="confirm">Confirm</button><button type="button" data-action="cancel">Cancel</button><output role="status"></output>';controlHost.append(controls);controls.onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action)parent.postMessage({type:'sa-ship-map-action',action},location.origin);};

      grid.addEventListener('pointermove',e=>{
        if(!embeddedMove||embeddedMove.submitting||embeddedMove.locked||grid.classList.contains('is-panning'))return;
        const cell=e.target.closest('[data-grid-index]');if(!cell)return;
        const r=cell.getBoundingClientRect(),square=Number(cell.dataset.gridIndex);
        if(!draft.gridCells.includes(square))return;
        const mesh=Math.max(0,Math.min(2,Math.floor((e.clientY-r.top)/r.height*3)))*3+Math.max(0,Math.min(2,Math.floor((e.clientX-r.left)/r.width*3)));
        parent.postMessage({type:'sa-ship-map-destination',square,mesh,preview:true},location.origin);
      });
      grid.addEventListener('click',e=>{if(!embeddedMove||embeddedMove.submitting)return;const cell=e.target.closest('[data-grid-index]');if(!cell)return;const r=cell.getBoundingClientRect(),square=Number(cell.dataset.gridIndex);if(!draft.gridCells.includes(square))return;const x=Math.max(0,Math.min(2,Math.floor((e.clientX-r.left)/r.width*3))),y=Math.max(0,Math.min(2,Math.floor((e.clientY-r.top)/r.height*3)));e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'sa-ship-map-destination',square,mesh:y*3+x},location.origin);},true);
    }

    if(!controls.querySelector('[data-action=console]')){
      for(const [action,label] of [['console','Toggle Console'],['diagnostics','System Repairs and Diagnostics'],['keyboard','WASD / Arrow Keys: Off'],['power','SIC Power']]){
        const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;controls.append(button);
      }
    }
    controls.classList.toggle('is-selecting',Boolean(embeddedMove));
    const boarding=linkedCampaignState?.starships.find(s=>s.id===draft.id)?.ship.airlockDocking?.links?.some(l=>l.ready&&l.square===embeddedMove?.destination);
    const boardingButton=controls.querySelector('[data-action=confirm]');boardingButton.textContent=boarding?'Board other ship':'Confirm';boardingButton.classList.toggle('airlock-board-button',Boolean(boarding));
    for(const action of ['console','diagnostics'])controls.querySelector(`[data-action=${action}]`).disabled=Boolean(embeddedMove);
    const own=linkedCampaignState?.ownCharacterId||pageParameters.get('character'),loc=linkedCampaignState?.starships.find(s=>s.id===draft.id)?.characterLocations?.[own];
    const away=linkedCampaignState?.starships.find(s=>s.id===draft.id)?.surfaceAwayCharacterIds?.includes(own);
    controls.querySelector('[data-action=begin]').disabled=Boolean(away||embeddedMove?.submitting);controls.querySelector('[data-action=keyboard]').disabled=Boolean(away||embeddedMove?.submitting);
    const walking=Boolean(linkedCampaignState?.starships.find(s=>s.id===draft.id)?.characterWalks?.[own]);
    controls.querySelector('[data-action=begin]').textContent=walking?'Stop Walking':'Move';
    const seat=loc&&window.SAShipMap.buildLayout(draft).footprint.get(Number(loc.square));
    const onSeat=embeddedStationState?.seated??seat?.stations.some(s=>s.x===seat.column&&s.y===seat.row&&s.mesh===Number(loc.mesh));
    controls.querySelector('[data-action=console]').disabled=Boolean(embeddedMove)||!(embeddedStationState?.consoleEnabled??(onSeat&&seat?.item?.status!=='destroyed'));
    controls.querySelector('[data-action=power]').disabled=!onSeat||embeddedStationState?.combat;
    controls.querySelector('[data-action=keyboard]').textContent='WASD / Arrow Keys: '+(embeddedKeyboardMode?'On':'Off');
    controls.querySelector('[data-action=keyboard]').hidden=Boolean(embeddedStationState?.combat);
    const ready=embeddedMove?.locked&&!embeddedMove.invalid&&(embeddedMove.path?.length||embeddedMove.sameSquareMove);
    controls.querySelector('[data-action=begin]').hidden=Boolean(embeddedMove);
    for(const key of ['confirm','cancel'])controls.querySelector(`[data-action=${key}]`).hidden=!embeddedMove;
    controls.querySelector('[data-action=confirm]').disabled=!ready||embeddedMove?.submitting;
    controls.querySelector('[data-action=cancel]').disabled=Boolean(embeddedMove?.submitting&&embeddedMove?.combatUnitId);
    controls.querySelector('[data-action=confirm]').textContent=boarding?'Board other ship':embeddedMove?.station?'Station':'Confirm Move';
    controls.querySelector('output').textContent=embeddedMove?(embeddedMove.submitting?'Moving...':embeddedMove.message):'';
    let stationSelect=controls.querySelector('[data-embedded-station]');
    if(!stationSelect){stationSelect=document.createElement('select');stationSelect.dataset.embeddedStation='';stationSelect.setAttribute('aria-label','Choose a station');controls.insertBefore(stationSelect,controls.querySelector('output'));stationSelect.onchange=()=>{if(!stationSelect.value||!embeddedMove||embeddedMove.submitting)return;const [square,mesh]=stationSelect.value.split(':').map(Number);parent.postMessage({type:'sa-ship-map-destination',square,mesh},location.origin);};}
    stationSelect.hidden=!embeddedMove;stationSelect.disabled=Boolean(embeddedMove?.submitting);
    if(away){for(const b of controls.querySelectorAll('button,select'))b.disabled=true;controls.querySelector('output').textContent='Party away from ship. Ask the GM to move your marker to the ship’s hex to board.';}
    if(embeddedMove){
      const layout=window.SAShipMap.buildLayout(draft),record=linkedCampaignState?.starships.find(s=>s.id===draft.id),own=linkedCampaignState?.ownCharacterId;
      const choices=['<option value="">Go to station…</option>'],seatCounts=new Map();
      for(const [square,sic] of layout.footprint)for(const station of sic.stations||[]){if(station.x!==sic.column||station.y!==sic.row)continue;const seat=(seatCounts.get(sic.label)||0)+1;seatCounts.set(sic.label,seat);const occupied=Object.entries(record?.characterLocations||{}).some(([id,loc])=>id!==own&&loc.square===square&&loc.mesh===station.mesh);choices.push(`<option value="${square}:${station.mesh}" ${occupied?'disabled':''}>${escapeHtml(sic.label)} — station ${seat}${occupied?' (occupied)':''}</option>`);}
      const markup=choices.join('');if(stationSelect.dataset.options!==markup){stationSelect.innerHTML=markup;stationSelect.dataset.options=markup;}
      stationSelect.value=embeddedMove.station?`${embeddedMove.destination}:${embeddedMove.destinationMesh}`:'';
    }
    grid.querySelector('.embedded-move-route')?.remove();grid.querySelectorAll('.embedded-move-target').forEach(e=>e.classList.remove('embedded-move-target'));
    if(!embeddedMove||embeddedMove.destination===null||embeddedMove.invalid)continue;
    const route=[embeddedMove.start,...(embeddedMove.path.length?embeddedMove.path:[embeddedMove.destination])],svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('embedded-move-route');svg.setAttribute('viewBox',`0 0 ${GRID_SIZE} ${draft.zoneRows||20}`);svg.setAttribute('preserveAspectRatio','none');
    const precise=embeddedMove.meshRoute?.length?[{square:embeddedMove.start,mesh:embeddedMove.startMesh},...embeddedMove.meshRoute]:route.map((n,i)=>({square:n,mesh:i===0?embeddedMove.startMesh:i===route.length-1?embeddedMove.destinationMesh:4}));
    const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',precise.map(({square:n,mesh})=>`${n%GRID_SIZE+((mesh%3)+.5)/3},${Math.floor(n/GRID_SIZE)+(Math.floor(mesh/3)+.5)/3}`).join(' '));svg.append(line);grid.append(svg);grid.querySelector(`[data-grid-index="${embeddedMove.destination}"]`)?.classList.add('embedded-move-target');
  }
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='sa-ship-move-preview'||!pageParameters.has('embeddedRecord'))return;
  const beginningMove=!embeddedMove&&event.data.move;
  embeddedMove=event.data.move;let changed=false;
  if(beginningMove&&!embeddedKeyboardMode)requestAnimationFrame(focusShipCharacter);
  for(const key of ['labels','walls','stations','highResolution','combatMesh','hull'])if(typeof event.data.view?.[key]==='boolean'&&mapView[key]!==event.data.view[key]){mapView[key]=event.data.view[key];changed=true;}
  if(changed)renderAll();else renderEmbeddedMovement();
});
window.SAEmbeddedShipMovement={async animate(id,start,startMesh,route,endMesh,moveSpeed=3,control={}){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const steps=route.map((p,i)=>typeof p==='object'?p:{square:p,mesh:i===route.length-1?endMesh:4});route=steps.map(p=>p.square);
  const grid=shipGrids.find(g=>g.getBoundingClientRect().width>0),token=grid?.querySelector(`[data-crew-id="${CSS.escape(id)}"]`);if(!token)return;
  const ghost=token.cloneNode(true);ghost.classList.add('ship-detail-crew','player-ship-moving-token');ghost.removeAttribute('data-crew-id');ghost.dataset.walking=String(window.SAShipMap.gravityEnabled(draft));grid.append(ghost);token.style.opacity='0';
  const pos=(n,m)=>({left:`${(n%GRID_SIZE+((m%3)+.5)/3)/GRID_SIZE*100}%`,top:`${(Math.floor(n/GRID_SIZE)+(Math.floor(m/3)+.5)/3)/(draft.zoneRows||20)*100}%`});Object.assign(ghost.style,pos(start,startMesh));
  try{for(let i=0;i<route.length;i++){
    if(control.cancelled)break;
    const key=doorKey(i?route[i-1]:start,route[i]),doors=[...grid.querySelectorAll(`[data-door-key="${key}"]`)],closed=doors.length&&draft.doorStates?.[key]!=='open';
    if(closed){ghost.dataset.walking='false';doors.forEach(d=>d.classList.add('is-open'));await new Promise(r=>setTimeout(r,600));}
    if(control.cancelled){doors.forEach(d=>d.classList.remove('is-open'));break;}
    const to=pos(route[i],steps[i].mesh),dx=parseFloat(to.left)-parseFloat(ghost.style.left),dy=(parseFloat(to.top)-parseFloat(ghost.style.top))*(draft.zoneRows||20)/GRID_SIZE;ghost.style.setProperty('--crew-heading',`${Math.atan2(dy,dx)*180/Math.PI+90}deg`);
    const duration=window.SAShipMap.walkingMilliseconds({square:i?route[i-1]:start,mesh:i?steps[i-1].mesh:startMesh},{square:route[i],mesh:steps[i].mesh},moveSpeed,GRID_SIZE);
    const a=ghost.animate([{left:ghost.style.left,top:ghost.style.top},to],{duration,fill:'forwards',easing:'linear'});
    const fromSquare=i?route[i-1]:start,fromMesh=i?steps[i-1].mesh:startMesh,toMesh=steps[i].mesh;
    const ax=fromSquare%GRID_SIZE*3+fromMesh%3,ay=Math.floor(fromSquare/GRID_SIZE)*3+Math.floor(fromMesh/3),bx=route[i]%GRID_SIZE*3+toMesh%3,by=Math.floor(route[i]/GRID_SIZE)*3+Math.floor(toMesh/3);
    control.onProgress=f=>{const x=Math.round(ax+(bx-ax)*f),y=Math.round(ay+(by-ay)*f);control.position={square:Math.floor(y/3)*GRID_SIZE+Math.floor(x/3),mesh:y%3*3+x%3};};
    try{await window.SAShipMap.playWalkingAnimation(a,duration,()=>window.SAShipMap.gravityEnabled(draft),walking=>{ghost.dataset.walking=String(walking);},control);}finally{a.cancel();}Object.assign(ghost.style,to);
    if(closed)doors.forEach(d=>d.classList.remove('is-open'));
  }}finally{control.cleanup=()=>{ghost.remove();token.style.opacity='';};if(!control.keepArrivalGhost)control.cleanup();}
}};
window.SAStarshipEditor={hasChanges:()=>!statesMatch(draft,draft.confirmed)||Boolean(splitPlacement)};

var liveDroneMarkers=[];
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='sa-drone-map'||event.data.shipId!==draft.id)return;
 liveDroneMarkers=event.data.drones;window.SADroneMap?.update(shipGrids,draft,liveDroneMarkers);
});

function toggleTriangleHull(cell){
  const triangles=window.SAShipMap.triangleCells(draft),removing=triangles.includes(cell);
  const next={...draft,triangleCells:removing?triangles.filter(n=>n!==cell):[...triangles,cell]};
  const error=window.SAShipMap.triangleError(next)||window.SAShipMap.exteriorError(next);
  if(error){showMessage(error,'error');return;}
  if(!removing&&!draft.allowCreditDebt&&pendingCost()+300>draft.groupCredits){showMessage('Not enough credits for a triangular hull square.','error');return;}
  rememberForUndo();draft.triangleCells=next.triangleCells;saveDraft();renderAll();
  showMessage(removing?'Triangle removed: 300 credits returned on confirmation.':'Triangular hull added: 300 credits, +1 Hull HP; no extra ship size.');
}
function installTriangleControls(){
  if(VIEW_ONLY_MODE||document.body.classList.contains('ship-details-view'))return;
  for(const host of document.querySelectorAll('.construction-zone-controls')){
    if(host.querySelector('[data-triangle-hull]'))continue;
    const tools=document.createElement('span');tools.className='airlock-builder-tools';tools.innerHTML='<strong>Airlocks</strong> <button type="button" data-airlock-action="add">Add</button> <button type="button" data-airlock-action="move">Reposition</button> <button type="button" data-airlock-action="remove">Remove</button> <button type="button" data-airlock-action="cancel">Done / Cancel</button>';host.append(tools);
    tools.onclick=e=>{const button=e.target.closest('[data-airlock-action]');if(!button)return;airlockOperation=button.dataset.airlockAction;airlockToMove=null;airlockBuildMode=airlockOperation!=='cancel';triangleHullMode=false;cancelPlacement();mapView.mode='build';renderAll();showMessage(airlockOperation==='move'?'Click the airlock to move, then a highlighted empty outer hull square.':airlockOperation==='remove'?'Click an airlock to remove it. Every ship must retain at least one.':airlockOperation==='add'?'Click a highlighted outer hull square to place an airlock.':'Airlock editing closed.');};
    const label=document.createElement('label');label.innerHTML='<input type="checkbox" data-triangle-hull> Triangle Hull — 300 credits';host.append(label);
    label.querySelector('input').onchange=e=>{triangleHullMode=e.target.checked;airlockBuildMode=false;document.querySelectorAll('[data-airlock-build]').forEach(n=>n.checked=false);cancelPlacement();mapView.mode='build';document.querySelectorAll('[data-triangle-hull]').forEach(i=>i.checked=triangleHullMode);renderAll();};
  }
  for(const grid of shipGrids){if(grid.dataset.trianglePreview)return;grid.dataset.trianglePreview='true';
    grid.addEventListener('pointermove',e=>{grid.querySelectorAll('.sa-hull-triangle.is-preview').forEach(n=>n.remove());if(!triangleHullMode||mapView.mode!=='build'||selectedSic())return;const cell=e.target.closest('[data-grid-index]');if(!cell)return;const n=Number(cell.dataset.gridIndex);if(window.SAShipMap.triangleCells(draft).includes(n))return;const next={...draft,triangleCells:[...window.SAShipMap.triangleCells(draft),n]};if(!window.SAShipMap.triangleError(next)&&!window.SAShipMap.exteriorError(next))cell.insertAdjacentHTML('beforeend',window.SAShipMap.triangleMarkup(draft,n,true));});
    grid.addEventListener('pointerleave',()=>grid.querySelectorAll('.sa-hull-triangle.is-preview').forEach(n=>n.remove()));
  }
}
function purchaseHullUpgrade(type){
  const definition=SIC_CATALOG[type],price=window.SAShipMap.hullSections(draft)*definition.hullSquarePrice;
  if(!draft.gridCells.length)return rejectSicPurchase('Build the Hull before purchasing a Hull upgrade.');
  if(draft.sicInventory.some(item=>item.type===type&&!item.pendingDisposition))return rejectSicPurchase(`Only one ${definition.name} per ship.`);
  if(!Number.isSafeInteger(price)||!draft.allowCreditDebt&&pendingCost()+price>draft.groupCredits)return rejectSicPurchase(`Not enough Group Credits. ${definition.name} costs ${formatCredits(price)} for the whole Hull.`);
  rememberForUndo();const id=uid(type);draft.sicInventory.push({id,type,attachTo:'hull',purchasePrice:price,pendingPurchase:true,storage:false});draft.placements.push({sicId:id,cell:draft.gridCells[0]});
  clearPurchaseFeedback();saveDraft();renderAll();showSicPurchaseFeedback(`${definition.name} covers all ${window.SAShipMap.hullSections(draft)} Hull sections. Confirm Changes to finish.`,'success');return true;
}
function purchaseAddon(type,storedItem=null){
  if(SIC_CATALOG[type]?.hullUpgrade)return purchaseHullUpgrade(type);
  const def=SIC_CATALOG[type],hosts=draft.placements.map(p=>draft.sicInventory.find(i=>i.id===p.sicId)).filter(i=>i&&!i.storage&&!i.pendingDisposition&&(!sicDefinition(i).addon||def.addon==='probe-module'&&sicDefinition(i).probe)&&(def.addon==='probe-module'?sicDefinition(i).probe&&window.SAShipMap.addonHost(draft,i):def.addon==='any'?Number(sicDefinition(i).threshold)>0:def.addon==='weapon'?(sicDefinition(i).weapon||sicDefinition(i).missileLauncher||sicDefinition(i).planetaryCleanser||sicDefinition(i).blackHoleGun):def.addon==='science'?i.type==='science-lab':def.addon==='engine'?sicDefinition(i).engine:def.addon==='shield'?sicDefinition(i).shield:def.addon==='probe'?sicDefinition(i).probeLauncher:sicDefinition(i).bridge));
  if(!hosts.length)return rejectSicPurchase('Install a compatible host SIC before purchasing '+def.name+'.');
  const dialog=cardHost.createElement('dialog');dialog.className='ship-print-options';dialog.setAttribute('aria-label','Attach '+def.name);
  dialog.innerHTML='<h2>'+escapeHtml(def.name)+'</h2><label>Attach to SIC<select data-addon-host>'+hosts.map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(sicDefinition(i).name)} (${escapeHtml(i.id.slice(-5))})</option>`).join('')+'</select></label><p data-addon-price></p><p role="alert"></p><button type="button" data-addon-buy>Purchase and Attach</button><button type="button" data-addon-cancel>Cancel</button>';
  if(storedItem){dialog.querySelector('[data-addon-buy]').textContent='Install stored SIC';if(type==='vulnerability-fortification'&&storedItem.shopPurchased)dialog.querySelector('[role=alert]').textContent='Stacked fortification may add an installation charge to Pending Total. Confirm Changes reviews the total before spending.';}
  const host=()=>draft.sicInventory.find(i=>i.id===dialog.querySelector('select').value),cost=()=>storedItem?0:type==='vulnerability-fortification'?500*2**draft.sicInventory.filter(i=>i.type===type&&i.attachTo===host().id&&!i.pendingDisposition).length:def.price;
  const price=()=>dialog.querySelector('[data-addon-price]').textContent=cost().toLocaleString()+' credits';dialog.querySelector('select').onchange=()=>{clearPurchaseFeedback();dialog.querySelector('[role=alert]').textContent='';price();};price();
  dialog.querySelector('[data-addon-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('[data-addon-buy]').onclick=()=>{const parent=host(),price=cost(),alert=dialog.querySelector('[role=alert]');if(def.probe&&draft.sicInventory.filter(i=>sicDefinition(i).probe&&i.attachTo===parent.id&&!i.storage&&!i.pendingDisposition&&i.status!=='destroyed').length>=4)return rejectSicPurchase('This Probe Launcher already holds four probes. Store or remove one first.',alert);if(def.shieldRecovery&&draft.sicInventory.some(i=>i.type===type&&i.attachTo===parent.id&&!i.pendingDisposition))return rejectSicPurchase('This Shield already has this recovery add-on.',alert);if(def.staticShield&&draft.sicInventory.some(i=>i.type===type&&i.attachTo===parent.id&&!i.pendingDisposition))return rejectSicPurchase('This Shield already has Static Shields.',alert);if(type==='power-core-damper'&&draft.sicInventory.some(i=>i.type===type&&i.attachTo===parent.id&&!i.pendingDisposition))return rejectSicPurchase('This Engine already has a Power Core Damper.',alert);if(!Number.isSafeInteger(price)||!draft.allowCreditDebt&&pendingCost()+price>draft.groupCredits)return rejectSicPurchase('Not enough Group Credits.',alert);rememberForUndo();const id=storedItem?.id||uid(type),placement=placementForSic(parent.id);if(storedItem){storedItem.attachTo=parent.id;storedItem.storage=false;storedItem.pendingDisposition='';draft.placements=draft.placements.filter(p=>p.sicId!==id);}else draft.sicInventory.push({id,type,attachTo:parent.id,purchasePrice:price,pendingPurchase:true,storage:false});draft.placements.push({sicId:id,cell:placement.cell});clearPurchaseFeedback();saveDraft();renderAll();showSicPurchaseFeedback(def.name+' attached to '+sicDefinition(parent).name+'. Confirm Changes to finish.','success');dialog.close();return true;};
  dialog.onclose=()=>dialog.remove();cardHost.body.append(dialog);dialog.showModal();return true;
}
installTriangleControls();

function syncAddonPositions(){for(const p of [...draft.placements]){const item=draft.sicInventory.find(i=>i.id===p.sicId);if(!item||!sicDefinition(item).addon)continue;const host=window.SAShipMap.addonHost(draft,item);if(host)p.cell=host.placement.cell;else{draft.placements=draft.placements.filter(a=>a!==p);item.storage=true;}}}

function decorateOwnedCard(card,item){
 if(item.type==='blueprint'){const title=card.querySelector('h3');if(title)title.textContent='Blueprint ('+(SIC_CATALOG[item.blueprintType]?.name||'Unknown SIC')+')';}
 if(item.printed){const rules=card.querySelector('.sic-poker-rules');if(rules)rules.insertAdjacentHTML('beforeend','<small>3D printed · resale 25% · '+(item.printedFor?'Licensed to this ship':'Open licence until installed')+'</small>');}
 const threshold=card.querySelector('footer span:last-child');if(threshold&&Number(window.SAShipMap.definition(item.type).threshold)>0)threshold.innerHTML='<small>Damage Threshold</small>'+window.SAShipMap.effectiveThreshold(draft,item);
 if(item.shopPurchased||item.type==='vulnerability-fortification'||SIC_CATALOG[item.type]?.hullUpgrade){const price=card.querySelector('.sic-poker-heading strong');if(price)price.textContent='Price: '+sicDefinition(item).price.toLocaleString();}
}

// Expand the live interior rather than copying a picture; routes, doors and confirmation stay connected.
var enlargedShipInterior=null;
function resizeEnlargedShipInterior(){
  const view=enlargedShipInterior;if(!view)return;
  const box=view.viewport.getBoundingClientRect(),tile=Math.min(box.width,box.height)/20,rows=draft.zoneRows||20;
  if(!(tile>0))return;
  for(const [key,value]of Object.entries({width:GRID_SIZE*tile,height:rows*tile,left:(box.width-GRID_SIZE*tile)/2,top:(box.height-rows*tile)/2}))view.grid.style.setProperty(key,value+'px','important');
  view.grid.style.setProperty('--cell-size',tile+'px');
}
async function enlargeShipInterior(viewport,source){
  if(enlargedShipInterior)return;
  let owner=window;try{while(owner.parent!==owner&&owner.parent.document)owner=owner.parent;}catch{}
  const doc=owner.document,shell=doc.createElement('dialog'),host=doc.createElement('div');
  shell.setAttribute('aria-label','Enlarged starship interior');
  shell.style.cssText='position:fixed;inset:8px;width:calc(100vw - 16px);height:calc(100dvh - 16px);max-width:none;max-height:none;margin:auto;padding:0;border:1px solid #70cce0;background:#06151e;color:#eefaff;overflow:hidden';
  host.style.cssText='width:100%;height:100%';shell.append(host);
  const shadow=host.attachShadow({mode:'open'});
  const links=[...document.querySelectorAll('link[rel="stylesheet"]')].filter(link=>/starship\.css|ship-pass2\.css|ship-map-presentation\.css|crew-tokens\.css/.test(link.href));
  const loading=links.map(link=>new Promise(resolve=>{const copy=doc.createElement('link');copy.rel='stylesheet';copy.href=link.href;copy.onload=resolve;copy.onerror=resolve;shadow.append(copy);}));
  const style=doc.createElement('style');style.textContent=`
    :host{display:block;height:100%;font:14px Arial;color:#eefaff}.enlarged-body{margin:0;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#06151e;color:#eefaff}
    .interior-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px;border-bottom:1px solid #407787}.interior-header strong{font:700 16px Arial}.interior-header nav{display:flex;gap:8px;flex-wrap:wrap}
    .interior-header button{min-height:36px;padding:7px 12px;border:1px solid #76bbcb;border-radius:4px;background:#14313f;color:#f0fbff;font:700 13px Arial}
    .interior-stage{display:grid;place-items:stretch;min-height:0;overflow:hidden;padding:6px}.interior-stage>[data-grid-viewport]{display:block!important;position:relative!important;inset:auto!important;width:100%!important;max-width:none!important;height:100%!important;min-height:0!important;aspect-ratio:auto;border:1px solid #486b7c;overflow:hidden}
    .interior-stage .ship-grid{position:absolute}.interior-stage .grid-toolbar{display:none!important}.interior-stage .sic-grid-label{font:700 11px Arial;white-space:normal;text-align:center}
    .interior-actions:empty{display:none}.interior-actions>.embedded-move-controls{position:static!important;display:flex!important;flex-flow:row wrap!important;align-items:center;justify-content:center;width:100%!important;margin:0;padding:8px;box-sizing:border-box}
    .interior-actions>.embedded-move-controls button{width:auto!important;flex:0 1 auto!important;min-height:38px;grid-column:auto!important}.interior-actions>.embedded-move-controls output{flex:1 0 100%;text-align:center}.interior-actions select{min-height:36px;max-width:280px;color:#ecfaff;background:#11323e}
    .crew-token{background:transparent!important;border:0!important;box-shadow:none!important;color:var(--token-color,#50dfff)!important;min-width:24px;min-height:24px}
  `;shadow.append(style);
  const body=doc.createElement('body');body.className='enlarged-body';body.innerHTML='<header class="interior-header"><strong></strong><nav><button type="button" data-large-zoom="out" aria-label="Zoom out">−</button><button type="button" data-large-zoom="in" aria-label="Zoom in">+</button><button type="button" data-large-zoom="fit">Fit Ship</button><button type="button" data-large-zoom="focus">Enlarge / Character</button><button type="button" data-large-close>Back</button></nav></header><main class="interior-stage"></main><footer class="interior-actions"></footer>';
  body.querySelector('strong').textContent=draft.title||'Starship Interior';shadow.append(body);doc.body.append(shell);
  const grid=viewport.querySelector('.ship-grid'),controlHost=grid.closest('.desktop-sheet')||grid.closest('.mobile-grid-panel'),controls=controlHost?.querySelector('.embedded-move-controls');
  const marker=document.createComment('interior viewport'),controlMarker=document.createComment('interior actions');
  viewport.before(marker);if(controls)controls.before(controlMarker);
  enlargedShipInterior={shell,viewport,grid,controlHost,controls,source,marker,controlMarker,geometry:Object.fromEntries(['width','height','left','top'].map(k=>[k,grid.style.getPropertyValue(k)])),view:{zoom:mapView.zoom,panX:mapView.panX,panY:mapView.panY}};
  body.querySelector('.interior-stage').append(viewport);if(controls)body.querySelector('.interior-actions').append(controls);
  const resize=resizeEnlargedShipInterior;
  const observer=new ResizeObserver(resize);observer.observe(body.querySelector('.interior-stage'));enlargedShipInterior.observer=observer;
  shell.addEventListener('cancel',e=>{e.preventDefault();closeEnlargedShipInterior();});
  shell.addEventListener('keydown',e=>{if(embeddedKeyboardMode&&!e.target.closest('input,select,textarea')&&['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();parent.postMessage({type:'sa-ship-map-key',key:e.key},location.origin);}});
  shell.addEventListener('pointerup',finishHullPaint);shell.addEventListener('pointercancel',finishHullPaint);
  body.querySelector('[data-large-close]').onclick=closeEnlargedShipInterior;
  body.querySelectorAll('[data-large-zoom]').forEach(button=>button.onclick=()=>{const action=button.dataset.largeZoom;if(action==='fit')fitShipToViewport();else if(action==='focus')focusShipCharacter();else zoomShipGrid(action==='in'?1.25:.8);});
  shell.showModal();resize();
  await Promise.race([Promise.all(loading),new Promise(resolve=>owner.setTimeout(resolve,2500))]);
  if(enlargedShipInterior?.shell===shell){resize();fitShipToViewport();window.SACrewTokens?.decorate(grid);}
}
function closeEnlargedShipInterior(){
  const value=enlargedShipInterior;if(!value)return;enlargedShipInterior=null;
  value.observer.disconnect();value.marker.replaceWith(value.viewport);if(value.controls)value.controlMarker.replaceWith(value.controls);
  for(const [key,v]of Object.entries(value.geometry))value.grid.style.setProperty(key,v,'important');Object.assign(mapView,value.view);saveMapView();applyGridTransform();value.shell.close();value.shell.remove();value.source?.focus({preventScroll:true});
}
for(const viewport of document.querySelectorAll('[data-grid-viewport]')){
  const panel=viewport.closest('.mobile-grid-panel'),toolbar=viewport.querySelector('.grid-zoom-controls')||panel?.querySelector('.grid-zoom-controls');
  if(!toolbar)continue;const button=document.createElement('button');button.type='button';button.textContent='Enlarge Map';button.setAttribute('aria-label','Enlarge ship interior');button.onclick=()=>enlargeShipInterior(viewport,button);toolbar.append(button);const focus=document.createElement('button');focus.type='button';focus.textContent='Enlarge / Character';focus.onclick=focusShipCharacter;toolbar.append(focus);
}
window.addEventListener('pagehide',closeEnlargedShipInterior);

// Poll only linked editors; confirmed changes invalidate another open draft.
setInterval(()=>{if(draft.campaignLink&&!confirmingConstruction&&!document.hidden)refreshLinkedCampaign();},3000);

if(pageParameters.get("campaign")&&pageParameters.get("details")!=="1"&&!VIEW_ONLY_MODE){const cancel=document.createElement("button");cancel.textContent="Cancel Upgrade";cancel.className="cancel-upgrade";cancel.onclick=async()=>{cancel.disabled=true;try{await refreshLinkedCampaign();const saved=linkedCampaignState?.starships.find(s=>s.id===draft.id);if(!saved){showMessage("Cannot reload the confirmed ship while disconnected. Reconnect and cancel again.","error");return;}draft={...defaultDraft(),...clone(saved.ship),id:saved.id,title:saved.title,confirmed:constructionState(saved.ship),confirmedOnce:true,campaignLink:{...draft.campaignLink,buildRevision:saved.buildRevision||0}};selectedSicId=null;undoState=null;splitPlacement=null;saveDraft();document.body.classList.add("ship-details-view");applyDraftToUi();showMessage("Upgrade canceled. No pending purchases were spent.");if(parent!==window)parent.postMessage({type:"sa-ship-editor-exit",message:"Upgrade canceled. No pending purchases were spent."},location.origin);}finally{cancel.disabled=false;}};document.querySelector("main")?.prepend(cancel);}

var embeddedKeyboardMode=false,embeddedStationState=null;window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='sa-keyboard-mode'){embeddedKeyboardMode=!!e.data.enabled;embeddedStationState=e.data;renderEmbeddedMovement();document.body.classList.toggle('keyboard-movement-active',embeddedKeyboardMode);}});
if(pageParameters.has('embeddedRecord'))document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,select,textarea,[contenteditable=true]'))return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key.length===1?e.key.toLowerCase():e.key)){if(embeddedKeyboardMode)e.preventDefault();parent.postMessage({type:'sa-ship-map-key',key:e.key},location.origin);}});

if(pageParameters.get('roomCreate')){const back=backLink;if(back){back.href=pageParameters.get('returnCharacter')?'character.html?campaign='+encodeURIComponent(pageParameters.get('roomCreate'))+'&character='+encodeURIComponent(pageParameters.get('returnCharacter'))+'&tab=starships'+(pageParameters.get('showcase')==='1'?'&showcase=1':''):'room.html?campaign='+encodeURIComponent(pageParameters.get('roomCreate'));back.textContent='Back to Campaign';}for(const form of linkStarshipForms){const input=form.querySelector('input');if(input)input.value=pageParameters.get('roomCreate');}}

function canBuyBlueprint(){return linkedCampaignState?(linkedCampaignState.starships||[]).some(s=>s.controlType==='pc'&&s.ship?.sicInventory?.some(i=>i.type==='3d-printer'&&!i.pendingPurchase&&!i.pendingDisposition)) : draft.sicInventory.some(i=>i.type==='3d-printer'&&!i.pendingPurchase&&!i.pendingDisposition);}
function openBlueprintPurchase(type){
 if(!canBuyBlueprint()){showMessage('A PC ship must own a 3D Printer before buying blueprints.','error');return;}

 const recipe=window.SAFabrication.recipe(type);if(!recipe)return;const dialog=cardHost.createElement('dialog');dialog.className='ship-print-options blueprint-purchase';dialog.setAttribute('aria-label','Blueprint ('+recipe.name+')');const source=document.querySelector('[data-sic-card="blueprint"]'),card=previewSicCard(source);card.querySelector('h3').textContent='Blueprint ('+recipe.name+')';dialog.append(card);const message=cardHost.createElement('p');message.setAttribute('role','alert');dialog.append(message);const buy=cardHost.createElement('button');buy.textContent='Buy Blueprint — 1,000 credits';const cancel=cardHost.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();buy.onclick=()=>{if(draft.sicInventory.some(i=>i.type==='blueprint'&&i.blueprintType===type&&!i.pendingDisposition)){message.textContent='This ship already owns that blueprint.';return;}if(!draft.allowCreditDebt&&pendingCost()+1000>draft.groupCredits){message.textContent='Not enough Group Credits.';return;}rememberForUndo();draft.sicInventory.push({id:uid('blueprint'),type:'blueprint',blueprintType:type,pendingPurchase:true,storage:true});saveDraft();renderAll();showSicPurchaseFeedback('Blueprint ('+recipe.name+') purchased. Confirm Changes to finish.','success');dialog.close();};dialog.append(buy,cancel);dialog.onclose=()=>dialog.remove();cardHost.body.append(dialog);dialog.showModal();
}
for(const item of market.querySelectorAll('.sic-market-item')){const type=item.querySelector('[data-sic-card]')?.dataset.sicCard;if(!window.SAFabrication.recipe(type))continue;const buy=document.createElement('button');buy.className='sic-buy-blueprint';buy.hidden=!canBuyBlueprint();buy.textContent='Buy blueprint';buy.type='button';buy.onclick=e=>{e.stopPropagation();openBlueprintPurchase(type);};item.append(buy);}

function editAirlock(square){
 const old=(draft.airlocks||[]).find(a=>a.square===square),candidate=window.SAShipMap.airlockCandidates(draft).find(a=>a.square===square);
 if(airlockOperation==='move'&&!airlockToMove){if(!old){showMessage('Select an existing airlock first.','error');return;}airlockToMove=old.id;showMessage('Now choose a highlighted empty outer hull square.');return;}
 if(airlockOperation==='remove'){if(!old)return;rememberForUndo();draft.airlocks=draft.airlocks.filter(a=>a!==old);window.SAShipMap.ensureAirlocks(draft);}
 else{if(old||!candidate){showMessage('Choose a highlighted blank outside hull square.','error');return;}rememberForUndo();if(airlockToMove)draft.airlocks=draft.airlocks.filter(a=>a.id!==airlockToMove);draft.airlocks=[...(draft.airlocks||[]),{id:airlockToMove||crypto.randomUUID(),...candidate}];airlockToMove=null;}
 saveDraft();renderAll();showMessage('Airlock layout updated. Confirm Changes to save the ship.');
}

document.addEventListener('change',event=>{
 if(!event.target.matches('[data-starship-crew],[data-starship-npc-crew]'))return;
 const host=event.target.closest('[data-crew-campaign-tools],.gm-starship-card')||event.target.parentElement.parentElement.parentElement.parentElement;
 for(const button of host.querySelectorAll('[data-save-starship-crew]'))button.classList.add('assignments-dirty');
});

// Interpolate saved walking routes without rebuilding the ship or sending frame updates.
setInterval(()=>{if(window.SAExploreSession?.active()===false||document.hidden||!window.frameElement?.getClientRects().length)return;const record=linkedCampaignState?.starships?.find(s=>s.id===draft.id);if(Object.keys(record?.characterWalks||{}).length)drawDetailsCrew();},33);
