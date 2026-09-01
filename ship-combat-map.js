(function () {
  const dialog = document.querySelector("#combatMapDialog");
  const openButton = document.querySelector("#openCombatMap");
  const closeButton = document.querySelector("#closeCombatMap");
  const shipSelect = document.querySelector("#combatMapShip");
  const title = document.querySelector("#combatMapTitle");
  const status = document.querySelector("#combatMapStatus");
  const roster = document.querySelector("#combatMapRoster");
  const grid = document.querySelector("#combatMapGrid");
  const confirm = document.querySelector("#confirmCombatMove");
  const cancel = document.querySelector("#cancelCombatMove");
  const stop = document.querySelector("#stopCombatTravel");
  const enterStation = document.querySelector("#enterCombatStation");
  const leaveStation = document.querySelector("#leaveCombatStation");
  const panButtons = [...document.querySelectorAll("[data-combat-map-pan]")];
  const viewInputs = [...document.querySelectorAll("[data-combat-map-view]")];
  const stats = document.querySelector("#combatMapStats");
  const SIC = {
    "en-engine-1": { width: 1, height: 1, label: "EN 1", image: "en-engine-1-floor-plan.png", output: 5, stations: [{ x: 0, y: 0, mesh: 1 }] },
    "en-engine-2": { width: 2, height: 2, label: "EN 2", image: "en-engine-2-floor-plan.png", output: 13, stations: [{ x: 0, y: 0, mesh: 1 }, { x: 1, y: 1, mesh: 7 }] },
    "en-engine-3": { width: 3, height: 3, label: "EN 3", image: "en-engine-3-floor-plan.png", output: 29, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 1, y: 2, mesh: 7 }] },
    "en-engine-4": { width: 4, height: 4, label: "EN 4", image: "en-engine-4-floor-plan.png", output: 50, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 3, y: 1, mesh: 5 }, { x: 1, y: 3, mesh: 7 }] },
    "en-engine-5": { width: 5, height: 5, label: "EN 5", image: "en-engine-5-floor-plan.png", output: 77, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 4, y: 2, mesh: 5 }, { x: 2, y: 4, mesh: 7 }] },
    "en-engine-6": { width: 6, height: 6, label: "EN 6", image: "en-engine-6-floor-plan.png", output: 110, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 5, y: 2, mesh: 5 }, { x: 3, y: 5, mesh: 7 }, { x: 0, y: 3, mesh: 3 }] },
    "life-support": { width: 2, height: 2, label: "LIFE", image: "life-support-floor-plan.png?v=20260831" },
    "nutritional-supplement": { width: 1, height: 1, label: "NUT.", image: "nutritional-supplement-floor-plan.png?v=20260831" },
  };
  let combatState = null;
  let mode = "welcome";
  let myUnitId = "";
  let selectedUnitId = "";
  let selectedShipId = "";
  let interaction = "view";
  let preview = null;
  const mapView = { labels: true, highResolution: false, combatMesh: false, walls: true, stations: false };

  function stationAt(ship, square, mesh) {
    const sic = footprint(ship).get(Number(square));
    return sic?.stations?.find((station) => station.x === sic.col && station.y === sic.row && station.mesh === Number(mesh)) || null;
  }

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const bridge = () => window.SACombatBridge;
  const ships = () => combatState?.starships || [];
  const selectedShip = () => ships().find((entry) => entry.id === selectedShipId) || null;
  const selectedUnit = () => combatState?.units?.find((entry) => entry.id === selectedUnitId) || null;
  const doorKey = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y).join(":");
  const nodeId = (square, mesh) => Number(square) * 9 + Number(mesh);
  const decodeNode = (id) => ({ square: Math.floor(id / 9), mesh: id % 9 });

  function inventoryType(ship, sicId) {
    return ship?.ship?.sicInventory?.find((entry) => entry.id === sicId)?.type || "";
  }

  function footprint(ship) {
    const map = new Map();
    for (const placement of ship?.ship?.placements || []) {
      const type = inventoryType(ship, placement.sicId);
      const def = SIC[type] || { width: 1, height: 1, label: type || "SIC", image: "" };
      const originRow = Math.floor(Number(placement.cell) / 20);
      const originCol = Number(placement.cell) % 20;
      for (let row = 0; row < def.height; row += 1) for (let col = 0; col < def.width; col += 1) {
        const cell = (originRow + row) * 20 + originCol + col;
        map.set(cell, { ...def, sicId: placement.sicId, type, origin: Number(placement.cell), row, col });
      }
    }
    return map;
  }

  function locationFor(unit, ship = selectedShip()) {
    if (!unit?.location || unit.location.starshipId !== ship?.id || !Number.isInteger(Number(unit.location.square))) return null;
    return { square: Number(unit.location.square), mesh: Math.max(0, Math.min(8, Number(unit.location.mesh) || 0)) };
  }

  function crossingAllowed(ship, footprints, fromSquare, toSquare, fromMesh, toMesh) {
    const fromSic = footprints.get(fromSquare)?.sicId || "";
    const toSic = footprints.get(toSquare)?.sicId || "";
    if (fromSic === toSic) return true;
    if (!fromSic && !toSic) return true;
    const delta = toSquare - fromSquare;
    const row = Math.floor(fromMesh / 3);
    const col = fromMesh % 3;
    const centered = Math.abs(delta) === 20 ? col === 1 : row === 1;
    return centered && ship.ship.doorStates?.[doorKey(fromSquare, toSquare)] === "open";
  }

  function neighbors(ship, footprints, node) {
    const { square, mesh } = decodeNode(node);
    const row = Math.floor(mesh / 3);
    const col = mesh % 3;
    const result = [];
    const local = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of local) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) { result.push(nodeId(square, nr * 3 + nc)); continue; }
      const squareRow = Math.floor(square / 20);
      const squareCol = square % 20;
      const nextRow = squareRow + (nr < 0 ? -1 : nr > 2 ? 1 : 0);
      const nextCol = squareCol + (nc < 0 ? -1 : nc > 2 ? 1 : 0);
      if (nextRow < 0 || nextRow >= 20 || nextCol < 0 || nextCol >= 20) continue;
      const nextSquare = nextRow * 20 + nextCol;
      if (!ship.ship.gridCells.includes(nextSquare)) continue;
      const nextMesh = (nr < 0 ? 2 : nr > 2 ? 0 : nr) * 3 + (nc < 0 ? 2 : nc > 2 ? 0 : nc);
      if (crossingAllowed(ship, footprints, square, nextSquare, mesh, nextMesh)) result.push(nodeId(nextSquare, nextMesh));
    }
    return result;
  }

  function findPath(unit, destination) {
    const ship = selectedShip();
    const start = locationFor(unit, ship);
    if (!ship || !start || !ship.ship.gridCells.includes(destination.square)) return [];
    const startNode = nodeId(start.square, start.mesh);
    const endNode = nodeId(destination.square, destination.mesh);
    if (startNode === endNode) return [];
    const footprints = footprint(ship);
    const queue = [startNode];
    const parent = new Map([[startNode, null]]);
    while (queue.length) {
      const node = queue.shift();
      if (node === endNode) break;
      for (const next of neighbors(ship, footprints, node)) if (!parent.has(next)) { parent.set(next, node); queue.push(next); }
    }
    if (!parent.has(endNode)) return null;
    const path = [];
    for (let node = endNode; node !== startNode; node = parent.get(node)) path.push(decodeNode(node));
    return path.reverse();
  }

  function completeLocation(ship, point) {
    const sic = footprint(ship).get(point.square);
    return { environment: "starship", starshipId: ship.id, square: point.square, mesh: point.mesh, sicId: sic?.sicId || "", stationed: false, stationSlot: null };
  }

  function chooseDestination(square, mesh) {
    const unit = selectedUnit();
    const ship = selectedShip();
    if (!unit || !ship) return;
    const occupied = (combatState?.units || []).filter((entry) => entry.id !== unit.id && entry.location?.starshipId === ship.id && Number(entry.location.square) === square && Number(entry.location.mesh) === mesh).length;
    if (occupied >= 2) {
      preview = { square, mesh, path: [], color: "red" }; confirm.disabled = true;
      status.textContent = "That location already holds two characters."; renderGrid(); return;
    }
    if (mode === "gm" && interaction === "relocate") {
      preview = { square, mesh, path: [{ square, mesh }], color: "green" };
      confirm.disabled = false;
      status.textContent = `Relocate ${unit.characterName || "combatant"} to this location.`;
      renderGrid();
      return;
    }
    const path = findPath(unit, { square, mesh });
    const moveSpeed = Math.max(1, Number(unit.moveSpeed) || 1);
    preview = { square, mesh, path, color: path === null ? "red" : path.length <= moveSpeed ? "green" : "yellow" };
    confirm.disabled = path === null || !path.length;
    status.textContent = path === null ? "No legal path reaches that location." : !path.length ? "That character is already there." : path.length <= moveSpeed ? `${path.length} unit${path.length === 1 ? "" : "s"}: one Move action.` : `${path.length} units: ${Math.ceil(path.length / moveSpeed)} automatic Move actions.`;
    renderGrid();
  }

  function doorMarkup(ship, footprints, square) {
    // Each shared doorway has one control; duplicate controls blocked map clicks.
    const directions = [[20, "bottom", "horizontal"], [1, "right", "vertical"]];
    return directions.flatMap(([delta, side, axis]) => {
      const other = square + delta;
      if (!ship.ship.gridCells.includes(other)) return [];
      if (Math.abs(delta) === 1 && Math.floor(square / 20) !== Math.floor(other / 20)) return [];
      const a = footprints.get(square)?.sicId || "";
      const b = footprints.get(other)?.sicId || "";
      if (a === b || (!a && !b)) return [];
      const first = footprints.get(square); const second = footprints.get(other);
      const firstCentered = !first || (axis === "horizontal" ? first.col === Math.floor((first.width - 1) / 2) : first.row === Math.floor((first.height - 1) / 2));
      const secondCentered = !second || (axis === "horizontal" ? second.col === Math.floor((second.width - 1) / 2) : second.row === Math.floor((second.height - 1) / 2));
      if (!firstCentered || !secondCentered) return [];
      const key = doorKey(square, other);
      const open = ship.ship.doorStates?.[key] === "open";
      return [`<button type="button" class="combat-door ${side} ${axis} ${open ? "open" : ""}" data-combat-door="${key}" aria-label="${open ? "Close" : "Open"} door"></button>`];
    }).join("");
  }

  function renderGrid() {
    const ship = selectedShip();
    if (!ship) { grid.innerHTML = ""; return; }
    const hull = new Set(ship.ship.gridCells || []);
    const footprints = footprint(ship);
    const routeNodes = new Set((preview?.path || []).map((point) => `${point.square}:${point.mesh}`));
    const units = (combatState?.units || []).filter((unit) => unit.location?.starshipId === ship.id);
    grid.classList.toggle("show-labels", mapView.labels);
    grid.classList.toggle("high-resolution", mapView.highResolution);
    grid.classList.toggle("show-combat-mesh", mapView.combatMesh);
    grid.classList.toggle("show-walls", mapView.walls);
    grid.classList.toggle("show-stations", mapView.stations);
    grid.innerHTML = Array.from({ length: 400 }, (_, square) => {
      const sic = footprints.get(square);
      const classes = ["combat-map-square", hull.has(square) ? "hull" : "", sic ? "sic" : "", preview?.square === square ? `preview-${preview.color}` : ""].filter(Boolean).join(" ");
      const style = mapView.highResolution && sic?.image ? `background-image:url('${sic.image}');background-size:${sic.width * 100}% ${sic.height * 100}%;background-position:${sic.width > 1 ? (sic.col / (sic.width - 1)) * 100 : 50}% ${sic.height > 1 ? (sic.row / (sic.height - 1)) * 100 : 50}%` : "";
      const tokens = units.filter((unit) => Number(unit.location.square) === square).map((unit) => {
        const mesh = Math.max(0, Math.min(8, Number(unit.location.mesh) || 0));
        const left = ((mesh % 3) + .5) / 3 * 100;
        const top = (Math.floor(mesh / 3) + .5) / 3 * 100;
        return `<i class="combat-token ${unit.location.stationed ? "stationed" : ""} ${unit.id === myUnitId ? "is-self" : ""}" style="left:${left}%;top:${top}%;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
      }).join("");
      const mesh = hull.has(square) ? `<div class="combat-mesh">${Array.from({ length: 9 }, (_, index) => `<button type="button" class="${routeNodes.has(`${square}:${index}`) ? "route-node" : ""}" data-map-square="${square}" data-map-mesh="${index}" aria-label="Map location"></button>`).join("")}</div>` : "";
      const stations = mapView.stations && sic?.stations?.length ? sic.stations.filter((station) => station.x === sic.col && station.y === sic.row).map((station) => `<i class="combat-station-marker" style="left:${(((station.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(station.mesh / 3) + .5) / 3) * 100}%" title="${esc(sic.label)} station"></i>`).join("") : "";
      const destination = preview?.square === square ? `<i class="combat-map-preview-dot ${preview.color}" style="left:${(((preview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(preview.mesh / 3) + .5) / 3) * 100}%"></i>` : "";
      return `<div class="${classes}" style="${style}">${sic ? `<span class="combat-map-label">${esc(sic.label)}</span>` : ""}${mesh}${mapView.walls ? doorMarkup(ship, footprints, square) : ""}${stations}${tokens}${destination}</div>`;
    }).join("");
    if (preview?.path?.length) {
      const start = locationFor(selectedUnit(), ship);
      const points = [start, ...preview.path].filter(Boolean).map((point) => {
        const column = point.square % 20; const row = Math.floor(point.square / 20);
        return `${column + ((point.mesh % 3) + .5) / 3},${row + (Math.floor(point.mesh / 3) + .5) / 3}`;
      }).join(" ");
      grid.insertAdjacentHTML("beforeend", `<svg class="combat-move-line" viewBox="0 0 20 20" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`);
    }
  }

  function statValue(ship, ...keys) {
    for (const key of keys) {
      const value = ship?.[key] ?? ship?.ship?.[key] ?? ship?.ship?.confirmed?.[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return 0;
  }

  function renderStats() {
    const record = selectedShip();
    if (!stats || !record) { if (stats) stats.innerHTML = ""; return; }
    const ship = record.ship || {};
    const hullMax = Number(statValue(record, "maximumHullHp")) || ship.gridCells?.length || 0;
    const hull = Number(statValue(record, "currentHullHp")) || hullMax;
    const shieldMax = Number(statValue(record, "maximumShieldHp")) || 0;
    const shield = Number(statValue(record, "currentShieldHp")) || shieldMax;
    const en = (ship.placements || []).reduce((total, placement) => total + Number(SIC[inventoryType(record, placement.sicId)]?.output || 0), 0);
    const fields = [
      ["Shield", `${shield}/${shieldMax}`], ["Hull", `${hull}/${hullMax}`],
      ["Defense", statValue(record, "defenseScore", "defense")], ["Movement", statValue(record, "moveSpeed", "movement")],
      ["Detection", statValue(record, "sensorRange", "detection")], ["Security", statValue(record, "firewallLevel", "security")],
      ["EN", en], ["AU", statValue(record, "availableAu", "au")], ["Scale", statValue(record, "scaleRank", "scale")],
    ];
    stats.innerHTML = fields.map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("");
  }

  function renderRoster() {
    const ship = selectedShip();
    const units = (combatState?.units || []).filter((unit) => mode === "gm" || unit.id === myUnitId || unit.location?.starshipId === ship?.id);
    roster.innerHTML = mode === "gm" ? units.map((unit) => `<button class="combat-map-person ${unit.id === selectedUnitId ? "active" : ""}" data-map-unit="${unit.id}" style="--token-color:${esc(unit.color || "#39e58f")}"><i></i><span>${esc(unit.characterName)}<small>${unit.location?.starshipId ? unit.location.starshipId === ship?.id ? `Square ${Number(unit.location.square) + 1}` : "Aboard another ship" : "Exterior / Surface"}</small></span></button>`).join("") : "";
  }

  function render() {
    const available = ships().length > 0;
    openButton?.classList.toggle("hidden", !available || !["gm", "player"].includes(mode));
    if (dialog.classList.contains("hidden")) return;
    const unit = selectedUnit();
    const ship = selectedShip();
    title.textContent = ship?.title || "Starship Interior";
    renderRoster();
    renderGrid();
    renderStats();
    stop.hidden = unit?.timedAction?.kind !== "move";
    leaveStation.hidden = !unit?.location?.stationed || combatState?.activeId !== unit?.id;
    const station = unit?.location ? stationAt(ship, unit.location.square, unit.location.mesh) : null;
    enterStation.hidden = Boolean(unit?.location?.stationed || !station || combatState?.activeId !== unit?.id);
    confirm.textContent = mode === "gm" && interaction === "relocate" ? "Relocate" : "Confirm Move";
  }

  function open(options = {}) {
    const preferred = options.unitId || (mode === "player" ? myUnitId : combatState?.activeId) || combatState?.units?.[0]?.id || "";
    selectedUnitId = preferred;
    interaction = options.interaction || (mode === "gm" ? "relocate" : "view");
    const unit = selectedUnit();
    selectedShipId = options.starshipId || unit?.location?.starshipId || ships()[0]?.id || "";
    shipSelect.innerHTML = ships().map((ship) => `<option value="${esc(ship.id)}">${esc(ship.title)}</option>`).join("");
    shipSelect.value = selectedShipId;
    preview = null;
    confirm.disabled = true;
    cancel.textContent = interaction === "view" ? "Close" : "Cancel";
    status.textContent = interaction === "move" ? "Choose a destination." : mode === "gm" ? "Select a combatant, then choose a square to relocate them." : "View current locations and operate accessible doors.";
    dialog.classList.remove("hidden");
    render();
    requestAnimationFrame(fitShip);
  }

  function fitShip() {
    const ship = selectedShip();
    const viewport = grid.parentElement;
    const cells = ship?.ship?.gridCells || [];
    if (!viewport || !cells.length) return;
    const rows = cells.map((cell) => Math.floor(cell / 20));
    const cols = cells.map((cell) => cell % 20);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);
    const cellSize = Math.max(20, Math.min(72, Math.floor(Math.min((viewport.clientWidth - 36) / (maxCol - minCol + 1), (viewport.clientHeight - 36) / (maxRow - minRow + 1)))));
    grid.style.setProperty("--cell-size", `${cellSize}px`);
    viewport.scrollLeft = Math.max(0, minCol * cellSize - (viewport.clientWidth - (maxCol - minCol + 1) * cellSize) / 2 + 20);
    viewport.scrollTop = Math.max(0, minRow * cellSize - (viewport.clientHeight - (maxRow - minRow + 1) * cellSize) / 2 + 20);
  }

  function close() { dialog.classList.add("hidden"); preview = null; }

  grid.addEventListener("click", async (event) => {
    const door = event.target.closest("[data-combat-door]");
    if (door) {
      await bridge()?.action({ action: "operateCombatDoor", id: selectedUnitId, starshipId: selectedShipId, doorKey: door.dataset.combatDoor });
      return;
    }
    const cell = event.target.closest("[data-map-square]");
    if (!cell || interaction === "view") return;
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh));
  });
  roster.addEventListener("click", (event) => { const button = event.target.closest("[data-map-unit]"); if (button) { selectedUnitId = button.dataset.mapUnit; preview = null; confirm.disabled = true; render(); } });
  shipSelect.addEventListener("change", () => { selectedShipId = shipSelect.value; preview = null; confirm.disabled = true; render(); requestAnimationFrame(fitShip); });
  panButtons.forEach((button) => button.addEventListener("click", () => {
    const viewport = grid.parentElement;
    const amount = Math.max(70, Math.round(Math.min(viewport.clientWidth, viewport.clientHeight) * .42));
    const direction = button.dataset.combatMapPan;
    viewport.scrollBy({ left: direction === "left" ? -amount : direction === "right" ? amount : 0, top: direction === "up" ? -amount : direction === "down" ? amount : 0, behavior: "smooth" });
  }));
  viewInputs.forEach((input) => input.addEventListener("change", () => {
    mapView[input.dataset.combatMapView] = input.checked;
    renderGrid();
  }));
  confirm.addEventListener("click", async () => {
    const ship = selectedShip();
    const unit = selectedUnit();
    if (!ship || !unit || !preview?.path?.length) return;
    if (mode === "gm" && interaction === "relocate") await bridge()?.action({ action: "setCombatLocation", id: unit.id, location: completeLocation(ship, preview) });
    else await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "move", route: preview.path.map((point) => completeLocation(ship, point)) });
    close();
  });
  stop.addEventListener("click", async () => { await bridge()?.action({ action: "stopTravel", id: selectedUnitId }); close(); });
  enterStation.addEventListener("click", async () => {
    const unit = selectedUnit(); const ship = selectedShip(); const station = stationAt(ship, unit?.location?.square, unit?.location?.mesh);
    if (!unit || !station) return;
    await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "enterStation", stationName: footprint(ship).get(Number(unit.location.square))?.label || "SIC", stationSlot: unit.location.mesh }); close();
  });
  leaveStation.addEventListener("click", async () => { await bridge()?.action({ action: "playerCombatAction", id: selectedUnitId, kind: "getUp" }); close(); });
  openButton?.addEventListener("click", () => open()); closeButton.addEventListener("click", close); cancel.addEventListener("click", close);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-ship-map]");
    if (!button) return;
    open({ starshipId: button.dataset.openShipMap, interaction: mode === "gm" ? "relocate" : "view" });
  });
  window.addEventListener("sa-combat-state", (event) => { combatState = event.detail.state; mode = event.detail.mode; myUnitId = event.detail.myUnitId; if (!selectedUnitId) selectedUnitId = mode === "player" ? myUnitId : combatState?.activeId || ""; render(); });
  window.SACombatMap = { open, openMove(unit) { open({ interaction: "move", unitId: unit.id, starshipId: unit.location?.starshipId }); }, render };
})();
