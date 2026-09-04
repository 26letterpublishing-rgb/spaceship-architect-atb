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
  const initiativePanel = document.querySelector("#initiativePanel");
  const playerPanel = document.querySelector("#playerPanel");
  const activePanel = document.querySelector("#activePanel");
  let combatState = null;
  let mode = "welcome";
  let myUnitId = "";
  let selectedUnitId = "";
  let selectedShipId = "";
  let interaction = "view";
  let preview = null;
  const mapView = { labels: true, highResolution: false, combatMesh: false, walls: true, stations: true };

  function stationAt(ship, square, mesh) {
    const sic = window.SAShipMap.buildLayout(ship?.ship || {}).footprint.get(Number(square));
    return sic?.stations?.find((station) => station.x === sic.column && station.y === sic.row && station.mesh === Number(mesh)) || null;
  }

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const bridge = () => window.SACombatBridge;
  const ships = () => combatState?.starships || [];
  const selectedShip = () => ships().find((entry) => entry.id === selectedShipId) || null;
  const selectedUnit = () => combatState?.units?.find((entry) => entry.id === selectedUnitId) || null;
  const nodeId = (square, mesh) => Number(square) * 9 + Number(mesh);
  const decodeNode = (id) => ({ square: Math.floor(id / 9), mesh: id % 9 });

  function setInlineMoveSelecting(enabled) {
    document.body.classList.toggle("inline-ship-move-selecting", enabled);
    const setImportant = (node, property, value) => node?.style.setProperty(property, value, "important");
    if (enabled) {
      setImportant(playerPanel, "display", "none");
      setImportant(activePanel, "display", "none");
      setImportant(initiativePanel, "display", "block");
      setImportant(initiativePanel, "position", "static");
      setImportant(initiativePanel, "width", "100%");
      setImportant(initiativePanel, "max-height", "none");
      setImportant(initiativePanel, "margin", "0");
      setImportant(initiativePanel, "overflow", "visible");
      setImportant(initiativePanel, "transform", "none");
    } else {
      [playerPanel, activePanel].forEach((node) => node?.style.removeProperty("display"));
      ["display", "position", "width", "max-height", "margin", "overflow", "transform"].forEach((property) => initiativePanel?.style.removeProperty(property));
    }
    if (!enabled) {
      document.querySelectorAll(".ship-combat-lane").forEach((lane) => {
        lane.classList.remove("inline-move-target");
        lane.style.removeProperty("display");
      });
    }
  }

  function clearMoveSelection() {
    preview = null;
    interaction = "view";
    setInlineMoveSelecting(false);
  }

  function footprint(ship) {
    return window.SAShipMap.buildLayout(ship?.ship || {}).footprint;
  }

  function locationFor(unit, ship = selectedShip()) {
    if (!unit?.location || unit.location.starshipId !== ship?.id || !Number.isInteger(Number(unit.location.square))) return null;
    return { square: Number(unit.location.square), mesh: Math.max(0, Math.min(8, Number(unit.location.mesh) || 0)) };
  }

  function unitIsCrew(unit, ship) {
    return Boolean(unit?.characterId && ship?.crewCharacterIds?.includes(unit.characterId));
  }

  function crossingAllowed(ship, layout, unit, fromSquare, toSquare) {
    const edge = layout.edge(fromSquare, toSquare);
    if (edge.kind === "none") return true;
    if (edge.kind !== "door") return false;
    return ship.ship.doorStates?.[edge.key] === "open" || unitIsCrew(unit, ship) || mode === "gm";
  }

  function neighbors(ship, layout, unit, node) {
    const { square, mesh } = decodeNode(node);
    if (layout.footprint.get(square)?.blocked) return [];
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
      if (layout.footprint.get(nextSquare)?.blocked) continue;
      const nextMesh = (nr < 0 ? 2 : nr > 2 ? 0 : nr) * 3 + (nc < 0 ? 2 : nc > 2 ? 0 : nc);
      if (crossingAllowed(ship, layout, unit, square, nextSquare)) result.push(nodeId(nextSquare, nextMesh));
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
    const layout = window.SAShipMap.buildLayout(ship.ship);
    const queue = [startNode];
    const parent = new Map([[startNode, null]]);
    while (queue.length) {
      const node = queue.shift();
      if (node === endNode) break;
      for (const next of neighbors(ship, layout, unit, node)) if (!parent.has(next)) { parent.set(next, node); queue.push(next); }
    }
    if (!parent.has(endNode)) return null;
    const path = [];
    for (let node = endNode; node !== startNode; node = parent.get(node)) path.push(decodeNode(node));
    path.reverse();
    let previous = start;
    return path.map((point) => {
      const crossing = point.square !== previous.square; const edge = crossing ? layout.edge(previous.square, point.square) : { kind: "none", key: "" };
      const requiresDoor = edge.kind === "door" && ship.ship.doorStates?.[edge.key] !== "open";
      previous = point;
      return requiresDoor ? { ...point, doorKey: edge.key } : point;
    });
  }

  function completeLocation(ship, point) {
    const sic = window.SAShipMap.buildLayout(ship?.ship || {}).footprint.get(point.square);
    return { environment: "starship", starshipId: ship.id, square: point.square, mesh: point.mesh, sicId: sic?.sicId || "", stationed: false, stationSlot: null, doorKey: point.doorKey || "" };
  }

  function chooseDestination(square, mesh, locked = false) {
    const unit = selectedUnit();
    const ship = selectedShip();
    if (!unit || !ship) return;
    if (!locked && preview && preview.square === square && preview.mesh === mesh) return;
    if (window.SAShipMap.buildLayout(ship.ship).footprint.get(Number(square))?.blocked) {
      preview = { square, mesh, path: [], color: "red", locked };
      confirm.disabled = true;
      status.textContent = "The engine core blocks movement through that square.";
      renderGrid();
      return;
    }
    const occupied = (combatState?.units || []).filter((entry) => entry.id !== unit.id && entry.location?.starshipId === ship.id && Number(entry.location.square) === square && Number(entry.location.mesh) === mesh).length;
    if (occupied >= 2) {
      preview = { square, mesh, path: [], color: "red", locked }; confirm.disabled = true;
      status.textContent = "That location already holds two characters."; renderGrid(); return;
    }
    if (mode === "gm" && interaction === "relocate") {
      preview = { square, mesh, path: [{ square, mesh }], color: "green", locked };
      confirm.disabled = !locked;
      status.textContent = `Relocate ${unit.characterName || "combatant"} to this location.`;
      renderGrid();
      return;
    }
    const path = findPath(unit, { square, mesh });
    const moveSpeed = Math.max(1, Number(unit.moveSpeed) || 1);
    const station = stationAt(ship, square, mesh);
    preview = { square, mesh, path, station, locked, color: path === null ? "red" : path.length <= moveSpeed ? "green" : "yellow" };
    confirm.disabled = !locked || path === null || !path.length;
    confirm.textContent = station ? "Station" : "Confirm Move";
    status.textContent = path === null ? "No legal path reaches that location." : !path.length ? "That character is already there." : locked ? station ? `${path.length} unit route selected. Station here.` : `${path.length} unit route selected. Confirm the move.` : path.length <= moveSpeed ? `${path.length} unit${path.length === 1 ? "" : "s"}: click to select.` : `${path.length} units: click to select ${Math.ceil(path.length / moveSpeed)} automatic Move actions.`;
    renderGrid();
  }

  function boundaryMarkup(ship, layout, square) {
    return window.SAShipMap.SIDES.map((side) => {
      const boundary = layout.boundary(square, side.name);
      const axis = side.name === "top" || side.name === "bottom" ? "horizontal" : "vertical";
      if (boundary.kind === "wall") return `<i class="combat-wall ${side.name} ${axis}"></i>`;
      if (boundary.kind !== "door") return "";
      const autoOpen = (combatState?.units || []).some((unit) => movementPresentation(unit)?.openDoorKeys.has(boundary.key));
      const open = ship.ship.doorStates?.[boundary.key] === "open" || autoOpen;
      return `<i class="combat-wall ${side.name} ${axis} start"></i><i class="combat-wall ${side.name} ${axis} end"></i><button type="button" class="combat-door ${side.name} ${axis} ${open ? "open" : ""}" data-combat-door="${boundary.key}" aria-label="${open ? "Close" : "Open"} door"><i></i><i></i></button>`;
    }).join("");
  }

  function pointCoordinates(point) {
    return { x: point.square % 20 + ((point.mesh % 3) + .5) / 3, y: Math.floor(point.square / 20) + (Math.floor(point.mesh / 3) + .5) / 3 };
  }

  function movementPresentation(unit) {
    const action = unit?.timedAction; const route = action?.kind === "move" && Array.isArray(action.routeSegment) ? action.routeSegment : [];
    if (!route.length || !action.startLocation) return null;
    const moveTotal = Math.max(.001, Number(action.total) - (Number(action.doorDelay) || 0)); const moveStep = moveTotal / route.length;
    let elapsed = Math.max(0, Number(action.total) - Number(action.remaining)); let current = action.startLocation; const openDoorKeys = new Set();
    for (const point of route) {
      if (point.doorKey) {
        if (elapsed <= .6) { openDoorKeys.add(point.doorKey); return { ...pointCoordinates(current), openDoorKeys }; }
        elapsed -= .6; openDoorKeys.add(point.doorKey);
      }
      if (elapsed <= moveStep) {
        const start = pointCoordinates(current); const end = pointCoordinates(point); const ratio = Math.max(0, Math.min(1, elapsed / moveStep));
        return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio, openDoorKeys };
      }
      elapsed -= moveStep; current = point; openDoorKeys.clear();
    }
    return { ...pointCoordinates(route.at(-1)), openDoorKeys };
  }

  function renderGrid() {
    const ship = selectedShip();
    if (!ship) { grid.innerHTML = ""; return; }
    const hull = new Set(ship.ship.gridCells || []);
    const footprints = footprint(ship);
    const layout = window.SAShipMap.buildLayout(ship.ship);
    const routeNodes = new Set((preview?.path || []).map((point) => `${point.square}:${point.mesh}`));
    const units = (combatState?.units || []).filter((unit) => unit.location?.starshipId === ship.id);
    grid.classList.toggle("show-labels", mapView.labels);
    grid.classList.toggle("high-resolution", mapView.highResolution);
    grid.classList.toggle("show-combat-mesh", mapView.combatMesh);
    grid.classList.toggle("show-walls", mapView.walls);
    grid.classList.toggle("show-stations", mapView.stations);
    const cellMarkup = Array.from({ length: 400 }, (_, square) => {
      const sic = footprints.get(square);
      const classes = ["combat-map-square", hull.has(square) ? "hull" : "", sic ? "sic" : "", preview?.square === square ? `preview-${preview.color}` : ""].filter(Boolean).join(" ");
      const style = sic ? `--sic-basic-color:${sic.color || "#197a6f"};${mapView.highResolution && sic.image ? window.SAShipMap.floorplanStyle(sic.type, sic.column, sic.row) : ""}` : "";
      const tokens = units.filter((unit) => Number(unit.location.square) === square && !movementPresentation(unit)).map((unit) => {
        const mesh = Math.max(0, Math.min(8, Number(unit.location.mesh) || 0));
        const left = ((mesh % 3) + .5) / 3 * 100;
        const top = (Math.floor(mesh / 3) + .5) / 3 * 100;
        return `<i class="combat-token ${unit.location.stationed ? "stationed" : ""} ${unit.id === myUnitId ? "is-self" : ""}" style="left:${left}%;top:${top}%;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
      }).join("");
      const mesh = hull.has(square) ? `<div class="combat-mesh">${Array.from({ length: 9 }, (_, index) => `<button type="button" class="${routeNodes.has(`${square}:${index}`) ? "route-node" : ""}" data-map-square="${square}" data-map-mesh="${index}" aria-label="Map location"></button>`).join("")}</div>` : "";
      const stations = mapView.stations && sic?.stations?.length ? sic.stations.filter((station) => station.x === sic.column && station.y === sic.row).map((station) => `<i class="combat-station-marker" style="left:${(((station.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(station.mesh / 3) + .5) / 3) * 100}%" title="${esc(sic.label)} station"></i>`).join("") : "";
      const destination = preview?.square === square ? `<i class="combat-map-preview-dot ${preview.color}" style="left:${(((preview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(preview.mesh / 3) + .5) / 3) * 100}%"></i>` : "";
      return `<div class="${classes}" style="${style}">${sic ? `<span class="combat-map-label">${esc(sic.label)}</span>` : ""}${mesh}${mapView.walls ? boundaryMarkup(ship, layout, square) : ""}${stations}${tokens}${destination}</div>`;
    }).join("");
    const movingMarkup = units.map((unit) => {
      const moving = movementPresentation(unit); if (!moving) return "";
      return `<i class="combat-token combat-moving-token ${unit.id === myUnitId ? "is-self" : ""}" style="left:${moving.x * 5}%;top:${moving.y * 5}%;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
    }).join("");
    grid.innerHTML = cellMarkup + movingMarkup;
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
    const inventory = new Map((ship.sicInventory || []).map((item) => [item.id, item]));
    const en = (ship.placements || []).reduce((total, placement) => total + Number(window.SAShipMap.definition(inventory.get(placement.sicId)?.type).output || 0), 0);
    const fields = [
      ["Shield", `${shield}/${shieldMax}`], ["Hull", `${hull}/${hullMax}`],
      ["Defense", statValue(record, "defenseScore", "defense")], ["Movement", statValue(record, "moveSpeed", "movement")],
      ["Detection", statValue(record, "sensorRange", "detection")], ["Security", statValue(record, "firewallLevel", "security")],
      ["EN", en], ["AU", statValue(record, "availableAu", "au")], ["Scale", statValue(record, "scaleRank", "scale")],
    ];
    stats.innerHTML = fields.map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("");
  }

  function statsMarkup(record) {
    const ship = record?.ship || {};
    const hullMax = Number(statValue(record, "maximumHullHp")) || ship.gridCells?.length || 0;
    const hull = Number(statValue(record, "currentHullHp")) || hullMax;
    const shieldMax = Number(statValue(record, "maximumShieldHp")) || 0;
    const shield = Number(statValue(record, "currentShieldHp")) || shieldMax;
    const inventory = new Map((ship.sicInventory || []).map((item) => [item.id, item]));
    const en = (ship.placements || []).reduce((total, placement) => total + Number(window.SAShipMap.definition(inventory.get(placement.sicId)?.type).output || 0), 0);
    const fields = [
      ["Shield", `${shield}/${shieldMax}`], ["Hull", `${hull}/${hullMax}`],
      ["Defense", statValue(record, "defenseScore", "defense")], ["Movement", statValue(record, "moveSpeed", "movement")],
      ["Detection", statValue(record, "sensorRange", "detection")], ["Security", statValue(record, "firewallLevel", "security")],
      ["EN", en], ["AU", statValue(record, "availableAu", "au")], ["Scale", statValue(record, "scaleRank", "scale")],
    ];
    return fields.map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("");
  }

  function inlineMapMarkup(record) {
    const ship = record.ship || {};
    const cells = ship.gridCells || [];
    if (!cells.length) return '<p class="inline-map-empty">This starship has no confirmed floorplan.</p>';
    const rows = cells.map((cell) => Math.floor(cell / 20));
    const cols = cells.map((cell) => cell % 20);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    const hull = new Set(cells);
    const footprints = footprint(record);
    const layout = window.SAShipMap.buildLayout(ship);
    const activePreview = selectedShipId === record.id ? preview : null;
    const routeNodes = new Set((activePreview?.path || []).map((point) => `${point.square}:${point.mesh}`));
    const units = (combatState?.units || []).filter((unit) => unit.location?.starshipId === record.id);
    const classes = ["combat-map-grid", "inline-combat-map-grid", mapView.labels ? "show-labels" : "", mapView.highResolution ? "high-resolution" : "", mapView.combatMesh ? "show-combat-mesh" : "", mapView.walls ? "show-walls" : "", mapView.stations ? "show-stations" : ""].filter(Boolean).join(" ");
    const squares = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minCol; column <= maxCol; column += 1) {
        const square = row * 20 + column;
        const sic = footprints.get(square);
        const cellClasses = ["combat-map-square", hull.has(square) ? "hull" : "", sic ? "sic" : "", activePreview?.square === square ? `preview-${activePreview.color}` : ""].filter(Boolean).join(" ");
        const style = sic ? `--sic-basic-color:${sic.color || "#197a6f"};${mapView.highResolution && sic.image ? window.SAShipMap.floorplanStyle(sic.type, sic.column, sic.row) : ""}` : "";
        const tokens = units.filter((unit) => Number(unit.location.square) === square && !movementPresentation(unit)).map((unit) => {
          const mesh = Math.max(0, Math.min(8, Number(unit.location.mesh) || 0));
          return `<i class="combat-token ${unit.location.stationed ? "stationed" : ""} ${unit.id === myUnitId ? "is-self" : ""}" style="left:${((mesh % 3) + .5) / 3 * 100}%;top:${(Math.floor(mesh / 3) + .5) / 3 * 100}%;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
        }).join("");
        const mesh = hull.has(square) ? `<div class="combat-mesh">${Array.from({ length: 9 }, (_, index) => `<button type="button" class="${routeNodes.has(`${square}:${index}`) ? "route-node" : ""}" data-map-square="${square}" data-map-mesh="${index}" aria-label="Map location"></button>`).join("")}</div>` : "";
        const stations = mapView.stations && sic?.stations?.length ? sic.stations.filter((station) => station.x === sic.column && station.y === sic.row).map((station) => `<i class="combat-station-marker" style="left:${(((station.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(station.mesh / 3) + .5) / 3) * 100}%" title="${esc(sic.label)} station"></i>`).join("") : "";
        const destination = activePreview?.square === square ? `<i class="combat-map-preview-dot ${activePreview.color}" style="left:${(((activePreview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(activePreview.mesh / 3) + .5) / 3) * 100}%"></i>` : "";
        squares.push(`<div class="${cellClasses}" style="${style}">${sic ? `<span class="combat-map-label">${esc(sic.label)}</span>` : ""}${mesh}${mapView.walls ? boundaryMarkup(record, layout, square) : ""}${stations}${tokens}${destination}</div>`);
      }
    }
    const moving = units.map((unit) => {
      const point = movementPresentation(unit);
      if (!point) return "";
      const left = ((point.x - minCol) / colCount) * 100;
      const top = ((point.y - minRow) / rowCount) * 100;
      return `<i class="combat-token combat-moving-token ${unit.id === myUnitId ? "is-self" : ""}" style="left:${left}%;top:${top}%;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
    }).join("");
    let line = "";
    if (activePreview?.path?.length) {
      const start = locationFor(selectedUnit(), record);
      const points = [start, ...activePreview.path].filter(Boolean).map((point) => {
        const x = point.square % 20 - minCol + ((point.mesh % 3) + .5) / 3;
        const y = Math.floor(point.square / 20) - minRow + (Math.floor(point.mesh / 3) + .5) / 3;
        return `${x},${y}`;
      }).join(" ");
      line = `<svg class="combat-move-line" viewBox="0 0 ${colCount} ${rowCount}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`;
    }
    const isSelected = selectedShipId === record.id;
    const selected = selectedUnit();
    const movingUnit = selected?.timedAction?.kind === "move" && selected.location?.starshipId === record.id;
    const station = activePreview?.station;
    const prompt = isSelected && interaction === "move" ? activePreview?.locked ? `${activePreview.path?.length || 0} unit route selected.` : "Move across the map, then click a destination." : "Live interior view";
    return `<div class="inline-map-toolbar"><span>${esc(prompt)}</span><div>${Object.entries({ labels: "Labels", highResolution: "High Res", combatMesh: "Combat Mesh", walls: "Walls", stations: "Stations" }).map(([key, label]) => `<label><input type="checkbox" data-inline-map-view="${key}" ${mapView[key] ? "checked" : ""}> ${label}</label>`).join("")}</div></div>
      <div class="inline-map-viewport"><div class="${classes}" style="--inline-cols:${colCount};--inline-rows:${rowCount}">${squares.join("")}${moving}${line}</div></div>
      <div class="inline-map-footer"><div class="combat-map-stats">${statsMarkup(record)}</div>${isSelected && interaction === "move" ? `<div class="inline-map-actions"><button type="button" data-inline-cancel-move>Cancel</button><button type="button" class="primary" data-inline-confirm-move ${activePreview?.locked && activePreview?.path?.length ? "" : "disabled"}>${station ? "Station" : "Confirm Move"}</button></div>` : movingUnit ? `<span class="inline-moving-status">${esc(selected.characterName)} is moving</span>` : ""}</div>`;
  }

  function renderInlineMaps(root = document) {
    root.querySelectorAll?.("[data-inline-ship-map]").forEach((host) => {
      const record = ships().find((entry) => entry.id === host.dataset.inlineShipMap);
      const lane = host.closest(".ship-combat-lane");
      const target = interaction === "move" && selectedShipId === record?.id;
      lane?.classList.toggle("inline-move-target", target);
      if (interaction === "move") lane?.style.setProperty("display", target ? "grid" : "none", "important");
      else lane?.style.removeProperty("display");
      if (record) host.innerHTML = inlineMapMarkup(record);
    });
  }

  function refreshInlinePreview(host) {
    const record = ships().find((entry) => entry.id === host?.dataset.inlineShipMap);
    const mapGrid = host?.querySelector(".inline-combat-map-grid");
    if (!record || !mapGrid) return;
    mapGrid.querySelectorAll(".combat-map-square.preview-green,.combat-map-square.preview-yellow,.combat-map-square.preview-red").forEach((cell) => cell.classList.remove("preview-green", "preview-yellow", "preview-red"));
    mapGrid.querySelectorAll(".combat-map-preview-dot,.combat-move-line").forEach((node) => node.remove());
    mapGrid.querySelectorAll("[data-map-square].route-node").forEach((node) => node.classList.remove("route-node"));
    const routeNodes = new Set((preview?.path || []).map((point) => `${point.square}:${point.mesh}`));
    routeNodes.forEach((key) => {
      const [square, mesh] = key.split(":");
      mapGrid.querySelector(`[data-map-square="${square}"][data-map-mesh="${mesh}"]`)?.classList.add("route-node");
    });
    if (preview) {
      const targetButton = mapGrid.querySelector(`[data-map-square="${preview.square}"][data-map-mesh="${preview.mesh}"]`);
      const targetCell = targetButton?.closest(".combat-map-square");
      targetCell?.classList.add(`preview-${preview.color}`);
      targetCell?.insertAdjacentHTML("beforeend", `<i class="combat-map-preview-dot ${preview.color}" style="left:${(((preview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(preview.mesh / 3) + .5) / 3) * 100}%"></i>`);
    }
    if (preview?.path?.length) {
      const cells = record.ship.gridCells || [];
      const rows = cells.map((cell) => Math.floor(cell / 20));
      const cols = cells.map((cell) => cell % 20);
      const minRow = Math.min(...rows), maxRow = Math.max(...rows), minCol = Math.min(...cols), maxCol = Math.max(...cols);
      const points = [locationFor(selectedUnit(), record), ...preview.path].filter(Boolean).map((point) => {
        const x = point.square % 20 - minCol + ((point.mesh % 3) + .5) / 3;
        const y = Math.floor(point.square / 20) - minRow + (Math.floor(point.mesh / 3) + .5) / 3;
        return `${x},${y}`;
      }).join(" ");
      mapGrid.insertAdjacentHTML("beforeend", `<svg class="combat-move-line" viewBox="0 0 ${maxCol - minCol + 1} ${maxRow - minRow + 1}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`);
    }
    const prompt = host.querySelector(".inline-map-toolbar>span");
    if (prompt) prompt.textContent = preview?.locked ? `${preview.path?.length || 0} unit route selected.` : "Move across the map, then click a destination.";
    const submit = host.querySelector("[data-inline-confirm-move]");
    if (submit) {
      submit.disabled = !(preview?.locked && preview?.path?.length);
      submit.textContent = preview?.station ? "Station" : "Confirm Move";
    }
  }

  function renderRoster() {
    const ship = selectedShip();
    const units = (combatState?.units || []).filter((unit) => mode === "gm" || unit.id === myUnitId || unit.location?.starshipId === ship?.id);
    roster.innerHTML = mode === "gm" ? units.map((unit) => `<button class="combat-map-person ${unit.id === selectedUnitId ? "active" : ""}" data-map-unit="${unit.id}" style="--token-color:${esc(unit.color || "#39e58f")}"><i></i><span>${esc(unit.characterName)}<small>${unit.location?.starshipId ? unit.location.starshipId === ship?.id ? `Square ${Number(unit.location.square) + 1}` : "Aboard another ship" : "Exterior / Surface"}</small></span></button>`).join("") : "";
  }

  function render() {
    const available = ships().length > 0;
    openButton?.classList.toggle("hidden", !available || !["gm", "player"].includes(mode));
    renderInlineMaps();
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
    confirm.textContent = mode === "gm" && interaction === "relocate" ? "Relocate" : preview?.station ? "Station" : "Confirm Move";
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

  function close() { dialog.classList.add("hidden"); clearMoveSelection(); }

  async function submitSelectedMove({ closeAfter = false } = {}) {
    const ship = selectedShip();
    const unit = selectedUnit();
    if (!ship || !unit || !preview?.locked || !preview?.path?.length) return;
    if (mode === "gm" && interaction === "relocate") await bridge()?.action({ action: "setCombatLocation", id: unit.id, location: completeLocation(ship, preview) });
    else await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "move", route: preview.path.map((point) => completeLocation(ship, point)), stationOnArrival: Boolean(preview.station), stationName: footprint(ship).get(Number(preview.square))?.label || "SIC", stationSlot: preview.mesh });
    clearMoveSelection();
    if (closeAfter) close();
    else renderInlineMaps();
  }

  grid.addEventListener("click", async (event) => {
    const door = event.target.closest("[data-combat-door]");
    if (door) {
      await bridge()?.action({ action: "operateCombatDoor", id: selectedUnitId, starshipId: selectedShipId, doorKey: door.dataset.combatDoor });
      return;
    }
    const cell = event.target.closest("[data-map-square]");
    if (!cell || interaction === "view") return;
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), true);
  });
  grid.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-combat-door]") || interaction === "view") return;
    const cell = event.target.closest("[data-map-square]");
    if (!cell) return;
    event.preventDefault();
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), true);
  });
  grid.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch" || interaction === "view" || preview?.locked) return;
    const cell = event.target.closest("[data-map-square]");
    if (cell) chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), false);
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
    await submitSelectedMove({ closeAfter: true });
  });
  stop.addEventListener("click", async () => { await bridge()?.action({ action: "stopTravel", id: selectedUnitId }); close(); });
  enterStation.addEventListener("click", async () => {
    const unit = selectedUnit(); const ship = selectedShip(); const station = stationAt(ship, unit?.location?.square, unit?.location?.mesh);
    if (!unit || !station) return;
    await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "enterStation", stationName: footprint(ship).get(Number(unit.location.square))?.label || "SIC", stationSlot: unit.location.mesh }); close();
  });
  leaveStation.addEventListener("click", async () => { await bridge()?.action({ action: "playerCombatAction", id: selectedUnitId, kind: "getUp" }); close(); });
  openButton?.addEventListener("click", () => {
    if (mode === "player") {
      const unit = combatState?.units?.find((entry) => entry.id === myUnitId); const characterId = unit?.characterId || "";
      if (combatState?.roomCode && characterId) {
        if (window.parent !== window) window.parent.postMessage({ type: "sa-open-character-tab", tab: "starships" }, location.origin);
        else location.href = `character.html?campaign=${encodeURIComponent(combatState.roomCode)}&character=${encodeURIComponent(characterId)}&tab=starships`;
        return;
      }
    }
    open();
  }); closeButton.addEventListener("click", close); cancel.addEventListener("click", close);
  document.addEventListener("click", (event) => {
    const inlineHost = event.target.closest?.("[data-inline-ship-map]");
    if (inlineHost) {
      const view = event.target.closest("[data-inline-map-view]");
      if (view) { mapView[view.dataset.inlineMapView] = view.checked; renderInlineMaps(); return; }
      const door = event.target.closest("[data-combat-door]");
      if (door) {
        const unit = mode === "player" ? combatState?.units?.find((entry) => entry.id === myUnitId) : selectedUnit();
        void bridge()?.action({ action: "operateCombatDoor", id: unit?.id || "", starshipId: inlineHost.dataset.inlineShipMap, doorKey: door.dataset.combatDoor });
        return;
      }
      if (event.target.closest("[data-inline-cancel-move]")) {
        clearMoveSelection(); renderInlineMaps(); return;
      }
      if (event.target.closest("[data-inline-confirm-move]")) { void submitSelectedMove(); return; }
      // Destination cells lock on pointerdown. Hover redraws the route, so relying
      // on click here can lose the click when that redraw replaces the cell.
      return;
    }
    const button = event.target.closest("[data-open-ship-map]");
    if (!button) return;
    open({ starshipId: button.dataset.openShipMap, interaction: mode === "gm" ? "relocate" : "view" });
  }, true);
  document.addEventListener("pointerover", (event) => {
    const host = event.target.closest?.("[data-inline-ship-map]");
    const cell = event.target.closest?.("[data-map-square]");
    if (!host || !cell || event.pointerType === "touch" || interaction !== "move" || preview?.locked || selectedShipId !== host.dataset.inlineShipMap) return;
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), false);
    refreshInlinePreview(host);
  });
  document.addEventListener("pointerdown", (event) => {
    const host = event.target.closest?.("[data-inline-ship-map]");
    const cell = event.target.closest?.("[data-map-square]");
    if (!host || !cell || interaction !== "move" || selectedShipId !== host.dataset.inlineShipMap) return;
    event.preventDefault();
    event.stopPropagation();
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), true);
    refreshInlinePreview(host);
  }, true);
  window.addEventListener("sa-combat-state", (event) => {
    combatState = event.detail.state;
    mode = event.detail.mode;
    myUnitId = event.detail.myUnitId;
    if (mode === "player" && interaction !== "move") selectedUnitId = myUnitId;
    else if (!selectedUnitId) selectedUnitId = mode === "player" ? myUnitId : combatState?.activeId || "";
    if (interaction === "move") {
      const unit = selectedUnit();
      const stillSelectable = unit
        && unit.id === combatState?.activeId
        && unit.location?.starshipId === selectedShipId
        && unit.timedAction?.kind !== "move";
      if (!stillSelectable) clearMoveSelection();
    }
    render();
  });
  window.SACombatMap = {
    open,
    openMove(unit) {
      selectedUnitId = unit.id;
      selectedShipId = unit.location?.starshipId || "";
      interaction = "move";
      preview = null;
      const host = document.querySelector(`[data-inline-ship-map="${CSS.escape(selectedShipId)}"]`);
      if (!host) { open({ interaction: "move", unitId: unit.id, starshipId: selectedShipId }); return; }
      setInlineMoveSelecting(true);
      renderInlineMaps();
      requestAnimationFrame(() => host.scrollIntoView({ behavior: "smooth", block: "center" }));
    },
    render,
    renderInlineMaps,
  };
})();
