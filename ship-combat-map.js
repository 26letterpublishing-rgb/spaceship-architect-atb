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
  const SIC = {
    "en-engine-1": { width: 1, height: 1, label: "EN 1", image: "en-engine-1-floor-plan.png" },
    "en-engine-2": { width: 2, height: 2, label: "EN 2", image: "en-engine-2-floor-plan.png" },
    "life-support": { width: 2, height: 2, label: "LIFE", image: "life-support-floor-plan.png" },
  };
  let combatState = null;
  let mode = "welcome";
  let myUnitId = "";
  let selectedUnitId = "";
  let selectedShipId = "";
  let interaction = "view";
  let preview = null;

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
    grid.innerHTML = Array.from({ length: 400 }, (_, square) => {
      const sic = footprints.get(square);
      const classes = ["combat-map-square", hull.has(square) ? "hull" : "", sic ? "sic" : "", preview?.square === square ? `preview-${preview.color}` : ""].filter(Boolean).join(" ");
      const style = sic?.image ? `background-image:url('${sic.image}');background-size:${sic.width * 100}% ${sic.height * 100}%;background-position:${sic.width > 1 ? (sic.col / (sic.width - 1)) * 100 : 50}% ${sic.height > 1 ? (sic.row / (sic.height - 1)) * 100 : 50}%` : "";
      const tokens = units.filter((unit) => Number(unit.location.square) === square).map((unit) => {
        const mesh = Math.max(0, Math.min(8, Number(unit.location.mesh) || 0));
        const left = ((mesh % 3) + .5) / 3 * 100;
        const top = (Math.floor(mesh / 3) + .5) / 3 * 100;
        return `<i class="combat-token ${unit.location.stationed ? "stationed" : ""}" style="left:${left}%;top:${top}%;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
      }).join("");
      const mesh = hull.has(square) ? `<div class="combat-mesh">${Array.from({ length: 9 }, (_, index) => `<button type="button" class="${routeNodes.has(`${square}:${index}`) ? "route-node" : ""}" data-map-square="${square}" data-map-mesh="${index}" aria-label="Map location"></button>`).join("")}</div>` : "";
      const destination = preview?.square === square ? `<i class="combat-map-preview-dot ${preview.color}" style="left:${(((preview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(preview.mesh / 3) + .5) / 3) * 100}%"></i>` : "";
      return `<div class="${classes}" style="${style}">${sic ? `<span class="combat-map-label">${esc(sic.label)}</span>` : ""}${mesh}${doorMarkup(ship, footprints, square)}${tokens}${destination}</div>`;
    }).join("");
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
    stop.hidden = unit?.timedAction?.kind !== "move";
    leaveStation.hidden = !unit?.location?.stationed || combatState?.activeId !== unit?.id;
    enterStation.hidden = Boolean(unit?.location?.stationed || !unit?.location?.sicId || combatState?.activeId !== unit?.id);
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
  confirm.addEventListener("click", async () => {
    const ship = selectedShip();
    const unit = selectedUnit();
    if (!ship || !unit || !preview?.path?.length) return;
    if (mode === "gm" && interaction === "relocate") await bridge()?.action({ action: "setCombatLocation", id: unit.id, location: completeLocation(ship, preview) });
    else await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "move", route: preview.path.map((point) => completeLocation(ship, point)) });
    close();
  });
  stop.addEventListener("click", async () => { await bridge()?.action({ action: "stopTravel", id: selectedUnitId }); close(); });
  enterStation.addEventListener("click", async () => { const unit = selectedUnit(); await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "enterStation", stationName: footprint(selectedShip()).get(Number(unit.location.square))?.label || "SIC" }); close(); });
  leaveStation.addEventListener("click", async () => { await bridge()?.action({ action: "playerCombatAction", id: selectedUnitId, kind: "getUp" }); close(); });
  openButton?.addEventListener("click", () => open()); closeButton.addEventListener("click", close); cancel.addEventListener("click", close);
  window.addEventListener("sa-combat-state", (event) => { combatState = event.detail.state; mode = event.detail.mode; myUnitId = event.detail.myUnitId; if (!selectedUnitId) selectedUnitId = mode === "player" ? myUnitId : combatState?.activeId || ""; render(); });
  window.SACombatMap = { open, openMove(unit) { open({ interaction: "move", unitId: unit.id, starshipId: unit.location?.starshipId }); }, render };
})();
