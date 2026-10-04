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
  const leaveStation = document.querySelector("#leaveCombatStation");
  const panButtons = [...document.querySelectorAll("[data-combat-map-pan]")];
  const viewInputs = [...document.querySelectorAll("[data-combat-map-view]")];
  const stats = document.querySelector("#combatMapStats");
  const initiativePanel = document.querySelector("#initiativePanel");
  const playerPanel = document.querySelector("#playerPanel");
  const activePanel = document.querySelector("#activePanel");
  const turnDialog = document.querySelector("#turnDialog");
  let combatState = null;
  let mode = "welcome";
  let myUnitId = "";
  let selectedUnitId = "";
  let selectedShipId = "";
  let interaction = "view";
  let preview = null;
  let moveSubmitting = false;
  let moveError = "";
  let expandedMap = null;
  let moveViewportOwner = null;
  let moveViewportResize = null;
  const layouts=new WeakMap();
  function layoutFor(ship){
    if(!layouts.has(ship))layouts.set(ship,window.SAShipMap.buildLayout(ship));
    return layouts.get(ship);
  }
  const mapView = {...window.SAShipMap.loadViewPreferences(),hull:false};
  window.SAShipMap.onViewPreferences(prefs=>{Object.assign(mapView,prefs);renderInlineMaps(document,true);});

  function stationAt(ship, square, mesh) {
    const sic = layoutFor(ship?.ship || {}).footprint.get(Number(square));
    return sic?.stations?.find((station) => station.x === sic.column && station.y === sic.row && station.mesh === Number(mesh)) || null;
  }

  function reservedStationDestination(unit) {
    if (unit?.timedAction?.kind !== "move" || !unit.timedAction.stationOnArrival) return null;
    if (Array.isArray(unit.travelRoute) && unit.travelRoute.length) return unit.travelRoute.at(-1);
    return unit.timedAction.destination || null;
  }

  function stationDestinationOccupied(ship, square, mesh, unitId = selectedUnitId) {
    return (combatState?.units || []).some((entry) => {
      if (entry.id === unitId) return false;
      const reserved = reservedStationDestination(entry);
      if (reserved) {
        return reserved.starshipId === ship?.id
          && Number(reserved.square) === Number(square)
          && Number(reserved.mesh) === Number(mesh);
      }
      return entry.location?.starshipId === ship?.id
        && Number(entry.location.square) === Number(square)
        && Number(entry.location.mesh) === Number(mesh);
    });
  }

  function stationOccupant(ship, square, mesh) {
    return (combatState?.units || []).find((entry) => entry.location?.starshipId === ship?.id
      && Number(entry.location.square) === Number(square)
      && Number(entry.location.mesh) === Number(mesh)) || null;
  }

  function stationMarkers(ship, sic, square) {
    if (!sic?.stations?.length) return "";
    return sic.stations
      .filter((station) => station.x === sic.column && station.y === sic.row)
      .map((station) => {
        const occupant = stationOccupant(ship, square, station.mesh);
        if (!mapView.stations && !occupant) return "";
        const name = occupant?.characterName || "";
        const label = occupant ? `${name} stationed at ${sic.label}` : `${sic.label} station`;
        return `<i data-fallen="${Boolean(occupant&&Number(occupant.currentHp)<=0)}" data-ship-ai="${Boolean(occupant?.shipAi)}" class="combat-station-marker ${occupant ? "occupied" : ""}" style="left:${(((station.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(station.mesh / 3) + .5) / 3) * 100}%;${occupant ? `--token-color:${esc(occupant.color || "#39e58f")}` : ""}" title="${esc(label)}" aria-label="${esc(label)}">${occupant ? `<span>${esc(name.slice(0, 1).toUpperCase())}</span>` : ""}</i>`;
      }).join("");
  }

  function tokenShift(units, unit) {
    const occupants = units.filter((entry) => !movementPresentation(entry)
      && Number(entry.location?.square) === Number(unit.location?.square)
      && Number(entry.location?.mesh) === Number(unit.location?.mesh))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    if (occupants.length < 2) return 0;
    return occupants.findIndex((entry) => entry.id === unit.id) === 0 ? -7 : 7;
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
      setImportant(turnDialog, "display", "none");
      setImportant(initiativePanel, "display", "block");
      setImportant(initiativePanel, "position", "static");
      setImportant(initiativePanel, "width", "100%");
      setImportant(initiativePanel, "max-height", "none");
      setImportant(initiativePanel, "margin", "0");
      setImportant(initiativePanel, "overflow", "visible");
      setImportant(initiativePanel, "transform", "none");
    } else {
      [playerPanel, activePanel, turnDialog].forEach((node) => node?.style.removeProperty("display"));
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
    moveViewportOwner?.removeEventListener('resize',moveViewportResize);
    moveViewportOwner=null;moveViewportResize=null;
    document.querySelectorAll('[data-inline-ship-map]').forEach(host=>host.style.removeProperty('--movement-map-height'));
    closeExpandedMap();
    preview = null;
    moveSubmitting = false;
    moveError = "";
    interaction = "view";
    setInlineMoveSelecting(false);
  }

  function requestAppRender() {
    bridge()?.requestRender?.();
  }

  function footprint(ship) {
    return layoutFor(ship?.ship || {}).footprint;
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

  function neighbors(ship, layout, unit, node, rowLimit) {
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
      const columns=layout.columns;
      const squareRow = Math.floor(square / columns);
      const squareCol = square % columns;
      const nextRow = squareRow + (nr < 0 ? -1 : nr > 2 ? 1 : 0);
      const nextCol = squareCol + (nc < 0 ? -1 : nc > 2 ? 1 : 0);
      if (nextRow < 0 || nextRow >= rowLimit || nextCol < 0 || nextCol >= columns) continue;
      const nextSquare = nextRow * columns + nextCol;
      if (!ship.ship.gridCells.includes(nextSquare)) continue;
      if (layout.footprint.get(nextSquare)?.blocked) continue;
      const nextMesh = (nr < 0 ? 2 : nr > 2 ? 0 : nr) * 3 + (nc < 0 ? 2 : nc > 2 ? 0 : nc);
      if (!window.SAShipMap.meshStepAllowed(layout,{square,mesh},{square:nextSquare,mesh:nextMesh})) continue;
      if (crossingAllowed(ship, layout, unit, square, nextSquare)) result.push(nodeId(nextSquare, nextMesh));
    }
    return result;
  }

  function findPath(unit, destination, ship = selectedShip()) {
    const start = locationFor(unit, ship);
    if (!ship || !start || !ship.ship.gridCells.includes(destination.square)) return [];
    const startNode = nodeId(start.square, start.mesh);
    const endNode = nodeId(destination.square, destination.mesh);
    if (startNode === endNode) return [];
    const layout = layoutFor(ship.ship);
    const queue = [startNode];
    const rowLimit=window.SAShipMap.gridRows(ship);
    const parent = new Map([[startNode, null]]);
    while (queue.length) {
      const node = queue.shift();
      if (node === endNode) break;
      for (const next of neighbors(ship, layout, unit, node, rowLimit)) if (!parent.has(next)) { parent.set(next, node); queue.push(next); }
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
    const sic = layoutFor(ship?.ship || {}).footprint.get(point.square);
    return { environment: "starship", starshipId: ship.id, square: point.square, mesh: point.mesh, sicId: sic?.sicId || "", stationed: false, stationSlot: null, doorKey: point.doorKey || "" };
  }

  function chooseDestination(square, mesh, locked = false) {
    const unit = selectedUnit();
    const ship = selectedShip();
    if (!unit || !ship) return;
    if(moveSubmitting)return;
    moveError='';
    if (!locked && preview && preview.square === square && preview.mesh === mesh) return;
    if (layoutFor(ship.ship).footprint.get(Number(square))?.blocked) {
      preview = { square, mesh, path: [], color: "red", locked };
      confirm.disabled = true;
      status.textContent = "The engine core blocks movement through that square.";
      renderGrid();
      return;
    }
    const station = stationAt(ship, square, mesh);
    const occupied = (combatState?.units || []).filter((entry) => entry.id !== unit.id && entry.location?.starshipId === ship.id && Number(entry.location.square) === square && Number(entry.location.mesh) === mesh).length;
    if (station && stationDestinationOccupied(ship, square, mesh, unit.id)) {
      moveError='That station is already occupied.';
      preview = { square, mesh, path: [], station, color: "red", locked };
      confirm.disabled = true;
      status.textContent = "That station is already occupied.";
      renderGrid();
      return;
    }
    if (occupied >= 2) {
      moveError='That location already holds two characters.';
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
    const moveSpeed = Math.max(1, Number(unit.moveSpeed) || 1)*(window.SAShipMap.gravityEnabled(ships().find(s=>s.id===unit.location?.starshipId))?1:.5);
    preview = { square, mesh, path, station, locked, color: path === null ? "red" : path.length <= moveSpeed ? "green" : "yellow" };
    confirm.disabled = !locked || path === null || !path.length;
    confirm.textContent = station ? "Station" : "Confirm Move";
    status.textContent = path === null ? "No legal path reaches that location." : !path.length ? "That character is already there." : locked ? station ? `${path.length} unit route selected. Station here.` : `${path.length} unit route selected. Confirm the move.` : path.length <= moveSpeed ? `${path.length} unit${path.length === 1 ? "" : "s"}: click to select.` : `${path.length} units: click to select ${Math.ceil(path.length / moveSpeed)} automatic Move actions.`;
    renderGrid();
  }

  function boundaryMarkup(ship, layout, square) {
    return window.SAShipMap.boundaryMarkup(layout, square, {
      isOpen: (key) => ship.ship.doorStates?.[key] === "open"
        || (combatState?.units || []).some((unit) => movementPresentation(unit)?.openDoorKeys.has(key)),
      doorAttributes: (key) => ({ "data-combat-door": key, title: (ship.ship.doorDamage?.[key]>=3?"Broken open":"Door — "+(ship.ship.doorDamage?.[key]||0)+"/3 breach points")+". Attack through Fire Gun or Melee; threshold 40 for Brig cell doors, otherwise 10." }),
    });
  }

  function pointCoordinates(point,columns=20) {
    return { x: point.square % columns + ((point.mesh % 3) + .5) / 3, y: Math.floor(point.square / columns) + (Math.floor(point.mesh / 3) + .5) / 3 };
  }

  function movementPresentation(unit) {
    if(unit?.carriedBy){const carrier=(combatState?.units||[]).find(u=>u.id===unit.carriedBy&&!u.carriedBy);if(carrier){const moving=movementPresentation(carrier);if(moving)return {...moving,x:moving.x+.15,walking:false};}}
    const columns=window.SAShipMap.gridColumns(ships().find(s=>s.id===unit?.location?.starshipId));
    const coords=point=>pointCoordinates(point,columns);
    const action = unit?.timedAction; const route = action?.kind === "move" && Array.isArray(action.routeSegment) ? action.routeSegment : [];
    if (!route.length || !action.startLocation) return null;
    const moveTotal = Math.max(.001, Number(action.total) - (Number(action.doorDelay) || 0)); const moveStep = moveTotal / route.length;
    let elapsed = Math.max(0, Number(action.total) - Number(action.remaining)); let current = action.startLocation; const openDoorKeys = new Set();
    let heading=0;
    for (const point of route) {
      const from=coords(current),to=coords(point);heading=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI+90;
      if (point.doorKey) {
        if (elapsed <= .6) { openDoorKeys.add(point.doorKey); return { ...coords(current), openDoorKeys,heading,walking:false }; }
        elapsed -= .6; openDoorKeys.add(point.doorKey);
      }
      if (elapsed <= moveStep) {
        const start = coords(current); const end = coords(point); const ratio = Math.max(0, Math.min(1, elapsed / moveStep));
        return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio, openDoorKeys,heading,walking:window.SAShipMap.gravityEnabled(ships().find(s=>s.id===unit.location?.starshipId)) };
      }
      elapsed -= moveStep; current = point; openDoorKeys.clear();
    }
    return { ...coords(route.at(-1)), openDoorKeys,heading,walking:false };
  }

  function renderGrid() {
    const ship = selectedShip();
    if (!ship) { grid.innerHTML = ""; return; }
    const hull = new Set(ship.ship.gridCells || []);
    const footprints = footprint(ship);
    const layout = layoutFor(ship.ship);
    const routeNodes = new Set((preview?.path || []).map((point) => `${point.square}:${point.mesh}`));
    const units = (combatState?.units || []).filter((unit) => unit.location?.starshipId === ship.id);
    grid.classList.toggle("show-labels", mapView.labels);
    grid.classList.toggle("hull-view", mapView.hull);
    viewInputs.forEach(input => { const key=input.dataset.combatMapView; input.disabled=window.SAShipMap.viewDisabled(mapView,key); input.checked=Boolean(mapView[key])&&!input.disabled; });
    grid.classList.toggle("high-resolution", mapView.highResolution);
    grid.classList.toggle("show-combat-mesh", mapView.combatMesh);
    grid.classList.toggle("show-walls", mapView.walls);
    grid.classList.toggle("show-stations", mapView.stations);
    const columns=layout.columns,rows=layout.rows;
    grid.style.gridTemplateColumns=`repeat(${columns},var(--cell-size))`;grid.style.width="max-content";grid.style.gridTemplateRows=`repeat(${rows},var(--cell-size))`;grid.style.aspectRatio=`${columns} / ${rows}`;
    const cellMarkup = Array.from({ length: rows*columns }, (_, square) => {
      const sic = footprints.get(square);
      const classes = ["combat-map-square", hull.has(square) ? "hull" : "", sic ? "sic" : "", preview?.square === square ? `preview-${preview.color}` : ""].filter(Boolean).join(" ");
      const style = sic ? `--sic-basic-color:${sic.color || "#197a6f"};${mapView.highResolution && sic.image ? window.SAShipMap.floorplanStyle(sic.type, sic.column, sic.row,sic) : ""}` : "";
      const tokens = units.filter((unit) => Number(unit.location.square) === square && !stationAt(ship, square, unit.location.mesh) && !movementPresentation(unit)).map((unit) => {
        const mesh = Math.max(0, Math.min(8, Number(unit.location.mesh) || 0));
        const left = ((mesh % 3) + .5) / 3 * 100;
        const top = (Math.floor(mesh / 3) + .5) / 3 * 100;
        return `<i data-fallen="${Number(unit.currentHp)<=0}" data-security-droid="${Boolean(unit.securityDroid)}" data-ship-ai="${Boolean(unit.shipAi)}" class="combat-token ${unit.location.stationed ? "stationed" : ""} ${unit.id === myUnitId ? "is-self" : ""}" style="left:${left}%;top:${top}%;--token-offset-x:${tokenShift(units, unit)}px;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
      }).join("");
      const mesh = hull.has(square) ? `<div class="combat-mesh">${Array.from({ length: 9 }, (_, index) => {
        const occupiedStation = stationAt(ship, square, index) && stationDestinationOccupied(ship, square, index);
        return `<button type="button" class="${routeNodes.has(`${square}:${index}`) ? "route-node " : ""}${occupiedStation ? "station-occupied" : ""}" data-map-square="${square}" data-map-mesh="${index}" aria-label="${occupiedStation ? "Station occupied" : "Map location"}"></button>`;
      }).join("")}</div>` : "";
      const stations = stationMarkers(ship, sic, square);
      const destination = preview?.square === square ? `<i class="combat-map-preview-dot ${preview.color}" style="left:${(((preview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(preview.mesh / 3) + .5) / 3) * 100}%"></i>` : "";
      return `<div class="${classes}" title="${esc(sic?.label||'')}" style="${style}">${window.SAShipMap.surfaceMarkup(layout,square)}${sic&&sic.column===0&&sic.row===0 ? `<span class="combat-map-label" title="${esc(sic.label)}" style="width:${sic.width*100}%;height:${sic.height*100}%;--sic-width:${sic.width};--sic-height:${sic.height};--sic-words:${String(sic.label).trim().split(/\s+/).length};--sic-longest:${Math.max(...String(sic.label).split(/\s+/).map(word=>word.length))};inset:0">${esc(sic.label)}</span>` : ""}${mesh}${mapView.walls ? boundaryMarkup(ship, layout, square) : ""}${stations}${tokens}${destination}</div>`;
    }).join("");
    const movingMarkup = units.map((unit) => {
      const moving = movementPresentation(unit); if (!moving) return "";
      return `<i data-security-droid="${Boolean(unit.securityDroid)}" class="combat-token combat-moving-token ${unit.id === myUnitId ? "is-self" : ""}" data-walking="${moving.walking}" style="left:${moving.x / columns * 100}%;top:${moving.y / rows * 100}%;--crew-heading:${moving.heading}deg;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
    }).join("");
    grid.innerHTML = cellMarkup + movingMarkup;
    window.SAFloorplanSnapshot?.mount(grid,ship,{fullGrid:true});
    if (preview?.path?.length) {
      const start = locationFor(selectedUnit(), ship);
      const points = [start, ...preview.path].filter(Boolean).map((point) => {
        const column = point.square % columns; const row = Math.floor(point.square / columns);
        return `${column + ((point.mesh % 3) + .5) / 3},${row + (Math.floor(point.mesh / 3) + .5) / 3}`;
      }).join(" ");
      grid.insertAdjacentHTML("beforeend", `<svg class="combat-move-line" viewBox="0 0 ${columns} ${rows}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`);
    }
  }

  function statValue(ship, ...keys) {
    if (keys.includes("moveSpeed")) return window.SAShipMap.propulsion(ship).moveSpeed;
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
    const hull = Number(record.currentHullHp ?? ship.currentHullHp ?? ship.confirmed?.currentHullHp ?? hullMax);
    const shieldMax = Number(statValue(record, "maximumShieldHp")) || 0;
    const shield = Number(record.currentShieldHp ?? ship.currentShieldHp ?? ship.confirmed?.currentShieldHp ?? shieldMax);
    const power = window.SAShipPower.output(record, combatState?.units || []);
    const fields = [
      ["Shield", `${shield}/${shieldMax}`], ["Hull", `${hull}/${hullMax}`],
      ["Defense", statValue(record, "defenseScore", "defense")], ["Movement", statValue(record, "moveSpeed", "movement")],
      ["Detection", window.SAShipMap.sensorStats(record).range], ["Security", window.SAShipMap.firewallStats(record)],
      ["EN", power.en], ["AU", record.auState ? `${record.auState.current}/${record.auState.maximum}` : power.au], ["Scale", statValue(record, "scaleRank", "scale")],
    ];
    stats.innerHTML = fields.map(([label, value]) => `<span><small>${label}</small><strong>${label === "Hull" ? window.SAHealthDisplay.hull(record, mode === "gm") : label === "Shield" ? window.SAHealthDisplay.shields(record, mode === "gm") : esc(value)}</strong></span>`).join("");
  }

  function statsMarkup(record) {
    const ship = record?.ship || {};
    const hullMax = Number(statValue(record, "maximumHullHp")) || ship.gridCells?.length || 0;
    const hull = Number(record.currentHullHp ?? ship.currentHullHp ?? ship.confirmed?.currentHullHp ?? hullMax);
    const shieldMax = Number(statValue(record, "maximumShieldHp")) || 0;
    const shield = Number(record.currentShieldHp ?? ship.currentShieldHp ?? ship.confirmed?.currentShieldHp ?? shieldMax);
    const power = window.SAShipPower.output(record, combatState?.units || []);
    const fields = [
      ["Shield", `${shield}/${shieldMax}`], ["Hull", `${hull}/${hullMax}`],
      ["Defense", statValue(record, "defenseScore", "defense")], ["Movement", statValue(record, "moveSpeed", "movement")],
      ["Detection", window.SAShipMap.sensorStats(record).range], ["Security", window.SAShipMap.firewallStats(record)],
      ["EN", power.en], ["AU", record.auState ? `${record.auState.current}/${record.auState.maximum}` : power.au], ["Scale", statValue(record, "scaleRank", "scale")],
    ];
    return fields.map(([label, value]) => `<span><small>${label}</small><strong>${label === "Hull" ? window.SAHealthDisplay.hull(record, mode === "gm") : label === "Shield" ? window.SAHealthDisplay.shields(record, mode === "gm") : esc(value)}</strong></span>`).join("");
  }

  function stationChoiceMarkup(record, unit) {
    if (!unit) return '';
    const choices=[],seatCounts=new Map();
    for (const [square,sic] of footprint(record)) {
      for (const station of sic.stations || []) {
        if(station.x!==sic.column||station.y!==sic.row)continue;
        const occupied=stationDestinationOccupied(record,square,station.mesh,unit.id);
        const here=Number(unit.location?.square)===square&&Number(unit.location?.mesh)===station.mesh;
        const seat=(seatCounts.get(sic.label)||0)+1;seatCounts.set(sic.label,seat);
        choices.push(`<option value="${square}:${station.mesh}" ${occupied||here?'disabled':''}>${esc(sic.label)} — station ${seat}${occupied?' (occupied)':here?' (current)':''}</option>`);
      }
    }
    return choices.length?`<label class="interior-station-choice">Go to station <select data-interior-station aria-label="Choose a station"><option value="">Choose a station…</option>${choices.join('')}</select></label>`:'';
  }

  function inlineMapMarkup(record) {
    const ship = record.ship || {};
    const columns=window.SAShipMap.gridColumns(record);
    const cells = [...new Set([...(ship.gridCells || []), ...window.SAShipMap.triangleCells(ship), ...layoutFor(ship).footprint.keys()])];
    if (!cells.length) return '<p class="inline-map-empty">This starship has no confirmed floorplan.</p>';
    const rows = cells.map((cell) => Math.floor(cell / columns));
    const cols = cells.map((cell) => cell % columns);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    const hull = new Set(ship.gridCells || []);
    const hullRows = [...hull].map(cell => Math.floor(cell / columns));
    const hullCols = [...hull].map(cell => cell % columns);
    const hullBounds = hull.size ? {
      column: Math.min(...hullCols) - minCol, row: Math.min(...hullRows) - minRow,
      columns: Math.max(...hullCols) - Math.min(...hullCols) + 1,
      rows: Math.max(...hullRows) - Math.min(...hullRows) + 1
    } : { column: 0, row: 0, columns: colCount, rows: rowCount };
    const footprints = footprint(record);
    const layout = layoutFor(ship);
    const activePreview = selectedShipId === record.id ? preview : null;
    const routeNodes = new Set((activePreview?.path || []).map((point) => `${point.square}:${point.mesh}`));
    const units = (combatState?.units || []).filter((unit) => unit.location?.starshipId === record.id);
    const classes = ["combat-map-grid", "inline-combat-map-grid", interaction === "move" && selectedShipId === record.id ? "interior-selecting" : "", mapView.hull ? "hull-view" : "", mapView.labels ? "show-labels" : "", mapView.highResolution ? "high-resolution" : "", mapView.combatMesh ? "show-combat-mesh" : "", mapView.walls ? "show-walls" : "", mapView.stations ? "show-stations" : ""].filter(Boolean).join(" ");
    const squares = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minCol; column <= maxCol; column += 1) {
        const square = row * columns + column;
        const sic = footprints.get(square);
        const cellClasses = ["combat-map-square", hull.has(square) ? "hull" : "", sic ? "sic" : "", activePreview?.square === square ? `preview-${activePreview.color}` : ""].filter(Boolean).join(" ");
        const style = sic ? `--sic-basic-color:${sic.color || "#197a6f"};${mapView.highResolution && sic.image ? window.SAShipMap.floorplanStyle(sic.type, sic.column, sic.row,sic) : ""}` : "";
        const tokens = units.filter((unit) => Number(unit.location.square) === square && !stationAt(record, square, unit.location.mesh) && !movementPresentation(unit)).map((unit) => {
          const mesh = Math.max(0, Math.min(8, Number(unit.location.mesh) || 0));
          return `<i data-fallen="${Number(unit.currentHp)<=0}" data-security-droid="${Boolean(unit.securityDroid)}" data-ship-ai="${Boolean(unit.shipAi)}" class="combat-token ${unit.location.stationed ? "stationed" : ""} ${unit.id === myUnitId ? "is-self" : ""}" style="left:${((mesh % 3) + .5) / 3 * 100}%;top:${(Math.floor(mesh / 3) + .5) / 3 * 100}%;--token-offset-x:${tokenShift(units, unit)}px;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
        }).join("");
        const mesh = hull.has(square) ? `<div class="combat-mesh">${Array.from({ length: 9 }, (_, index) => {
          const occupiedStation = stationAt(record, square, index) && stationDestinationOccupied(record, square, index);
          return `<button type="button" class="${routeNodes.has(`${square}:${index}`) ? "route-node " : ""}${occupiedStation ? "station-occupied" : ""}" data-map-square="${square}" data-map-mesh="${index}" aria-label="${occupiedStation ? "Station occupied" : "Map location"}"></button>`;
        }).join("")}</div>` : "";
        const stations = stationMarkers(record, sic, square);
        const destination = activePreview?.square === square ? `<i class="combat-map-preview-dot ${activePreview.color}" style="left:${(((activePreview.mesh % 3) + .5) / 3) * 100}%;top:${((Math.floor(activePreview.mesh / 3) + .5) / 3) * 100}%"></i>` : "";
        squares.push(`<div class="${cellClasses}" title="${esc(sic?.label||'')}" data-inline-square="${square}" style="${style}">${window.SAShipMap.surfaceMarkup(layout,square)}${sic&&sic.column===0&&sic.row===0 ? `<span class="combat-map-label" title="${esc(sic.label)}" style="width:${sic.width*100}%;height:${sic.height*100}%;--sic-width:${sic.width};--sic-height:${sic.height};--sic-words:${String(sic.label).trim().split(/\s+/).length};--sic-longest:${Math.max(...String(sic.label).split(/\s+/).map(word=>word.length))};inset:0">${esc(sic.label)}</span>` : ""}${mesh}${mapView.walls ? boundaryMarkup(record, layout, square) : ""}${stations}${tokens}${destination}</div>`);
      }
    }
    const moving = units.map((unit) => {
      const point = movementPresentation(unit);
      if (!point) return "";
      const left = ((point.x - minCol) / colCount) * 100;
      const top = ((point.y - minRow) / rowCount) * 100;
      return `<i data-security-droid="${Boolean(unit.securityDroid)}" class="combat-token combat-moving-token ${unit.id === myUnitId ? "is-self" : ""}" data-walking="${point.walking}" style="left:${left}%;top:${top}%;--crew-heading:${point.heading}deg;--token-color:${esc(unit.color || "#39e58f")}" title="${esc(unit.characterName)}"><span>${esc((unit.characterName || "?").slice(0, 1).toUpperCase())}</span></i>`;
    }).join("");
    let line = "";
    if (activePreview?.path?.length) {
      const start = locationFor(selectedUnit(), record);
      const points = [start, ...activePreview.path].filter(Boolean).map((point) => {
        const x = point.square % columns - minCol + ((point.mesh % 3) + .5) / 3;
        const y = Math.floor(point.square / columns) - minRow + (Math.floor(point.mesh / 3) + .5) / 3;
        return `${x},${y}`;
      }).join(" ");
      line = `<svg class="combat-move-line" viewBox="0 0 ${colCount} ${rowCount}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`;
    }
    const isSelected = selectedShipId === record.id;
    const selected = selectedUnit();
    const movingUnit = selected?.timedAction?.kind === "move" && selected.location?.starshipId === record.id;
    const station = activePreview?.station;
    const prompt = isSelected && interaction === "move"
      ? moveSubmitting ? "Starting movement..." : moveError || (activePreview?.locked ? `${activePreview.path?.length || 0} unit route selected.` : "Point to preview a route; click to select. Or choose a station below.")
      : "Live interior view";
    return `<div class="inline-map-toolbar"><span>${esc(prompt)}</span><div>${window.SAShipMap.viewControls(mapView,'data-inline-map-view')}</div>${isSelected&&interaction==='move'?stationChoiceMarkup(record,selected):''}</div>
      <div class="inline-map-viewport"><div class="${classes}" data-hull-column="${hullBounds.column}" data-hull-row="${hullBounds.row}" data-hull-columns="${hullBounds.columns}" data-hull-rows="${hullBounds.rows}" style="--inline-cols:${colCount};--inline-rows:${rowCount};--preview-cell-size:${inlineZoom.get(record.id)||72}px">${squares.join("")}${moving}${line}</div></div>
      <div class="inline-map-footer">${isSelected && interaction === "move" ? `<div class="inline-map-actions"><button type="button" data-inline-cancel-move ${moveSubmitting ? "disabled" : ""}>Cancel</button><button type="button" class="primary" data-inline-confirm-move ${activePreview?.locked && activePreview?.path?.length && !moveSubmitting ? "" : "disabled"} aria-busy="${moveSubmitting}">${moveSubmitting ? "Starting..." : station ? "Station" : "Confirm Move"}</button></div>` : movingUnit ? `<span class="inline-moving-status">${esc(selected.characterName)} is moving</span>` : ""}<div class="inline-map-zoom"><button type="button" data-preview-zoom="-1" aria-label="Zoom out interior" title="Zoom out interior">&#8722;</button><button type="button" data-preview-zoom="1" aria-label="Zoom in interior" title="Zoom in interior">+</button><button type="button" data-interior-fit title="Fit Ship" aria-label="Fit Ship">Fit Ship</button><button type="button" data-interior-focus title="Zoom to character">Enlarge</button><button type="button" data-expand-interior title="Enlarge ship interior" aria-label="Enlarge ship interior">&#x26F6;</button></div><div class="combat-map-stats">${statsMarkup(record)}</div></div>`;
  }

  const inlineMarkupCache = new WeakMap();
  const inlineStateCache = new WeakMap();
  const inlineStatsCache = new WeakMap();
  function interiorStateKey(record) {
    const ship=record.ship||{};
    // AU/ATB/gravity clocks must not rebuild thousands of unchanged map cells.
    const atmosphere=Object.entries(ship.atmosphereState?.cells||{}).map(([cell,o2])=>[cell,Math.ceil(o2-1e-7)]);
    const crew=(combatState?.units||[]).filter(u=>u.location?.starshipId===record.id).map(u=>[u.id,u.characterName,u.color,u.shipAi,u.location,u.timedAction,u.travelRoute,u.defeatedAt]);
    return JSON.stringify([ship.gridCells,ship.triangleCells,ship.zoneColumns,ship.zoneRows,ship.placements,ship.sicInventory,ship.doorStates,ship.airlocks,ship.airlockStates,ship.breachState,ship.thrusterDirection,atmosphere,ship.fieldState?.systems,ship.fieldState?.docking,record.characterLocations,crew,mode,mapView,selectedShipId,selectedUnitId,myUnitId,interaction,preview,inlineZoom.get(record.id),moveSubmitting,moveError]);
  }
  const inlineZoom = new Map();
  const fitObservers=new Map();
  const manualInlineViews=new WeakSet();
  function fitInline(host){
    const viewport=host.querySelector('.inline-map-viewport'),grid=host.querySelector('.inline-combat-map-grid');
    if(!viewport?.clientWidth||!viewport.clientHeight||!grid)return;
    // Crew can only move on normal hull. Long exterior weapons should not shrink its click targets.
    const moving=interaction==='move'&&selectedShipId===host.dataset.inlineShipMap;
    const cols=Number(moving&&grid.dataset.hullColumns||grid.style.getPropertyValue('--inline-cols')),
      rows=Number(moving&&grid.dataset.hullRows||grid.style.getPropertyValue('--inline-rows'));
    const size=Math.max(1,Math.min(96,(viewport.clientWidth-32)/cols,(viewport.clientHeight-32)/rows));
    if(host===expandedMap?.host){expandedMap.cellSize=size;expandedMap.dialog.style.setProperty('--expanded-cell-size',size+'px');}
    else{inlineZoom.set(host.dataset.inlineShipMap,size);grid.style.setProperty('--preview-cell-size',size+'px');}
    manualInlineViews.delete(host);viewport.scrollLeft=0;viewport.scrollTop=0;
    if(moving){
      const gridRect=grid.getBoundingClientRect(),viewRect=viewport.getBoundingClientRect();
      viewport.scrollLeft=Math.max(0,gridRect.left-viewRect.left+(Number(grid.dataset.hullColumn||0)+cols/2)*size-viewport.clientWidth/2);
      viewport.scrollTop=Math.max(0,gridRect.top-viewRect.top+(Number(grid.dataset.hullRow||0)+rows/2)*size-viewport.clientHeight/2);
    }
  }
  function watchFit(host){
    for(const [node,observer] of fitObservers)if(!node.isConnected){observer.disconnect();fitObservers.delete(node);}
    if(fitObservers.has(host))return;
    let width=0,height=0;
    const observer=new ResizeObserver(()=>{
      const viewport=host.querySelector('.inline-map-viewport');
      const w=viewport?.clientWidth||0,h=viewport?.clientHeight||0;
      if(w&&h&&(w!==width||h!==height)&&(!manualInlineViews.has(host)||!width||!height))fitInline(host);
      width=w;height=h;
    });
    fitObservers.set(host,observer);observer.observe(host);
    requestAnimationFrame(()=>fitInline(host));
  }

  function movementCanvasHeight(screenHeight, obstruction, toolbarHeight, footerHeight) {
    return Math.max(200,Math.min(620,screenHeight-obstruction-toolbarHeight-footerHeight-28));
  }
  function movementScreen(host) {
    let owner=window,top=host.getBoundingClientRect().top,obstruction=0;
    for(;;){
      let barHeight=0;
      for(const bar of owner.document.querySelectorAll('#globalCharacterHud,.gm-adjustment-bar,.showcase-toolbar')){
        if(!bar.getClientRects().length)continue;
        const style=owner.getComputedStyle(bar);
        if(['sticky','fixed'].includes(style.position)&&style.top!=='auto')barHeight=Math.max(barHeight,(parseFloat(style.top)||0)+bar.getBoundingClientRect().height);
      }
      obstruction+=barHeight;
      let frame;try{frame=owner.frameElement;}catch{}
      if(!frame)break;
      top+=frame.getBoundingClientRect().top+frame.clientTop;owner=owner.parent;
    }
    return {owner,top,obstruction:obstruction+8};
  }
  function fitMoveToScreen(host,scroll=false) {
    if(!host?.isConnected||interaction!=='move')return;
    const screen=movementScreen(host),toolbar=host.querySelector('.inline-map-toolbar'),footer=host.querySelector('.inline-map-footer');
    const height=movementCanvasHeight(screen.owner.innerHeight,screen.obstruction,toolbar?.getBoundingClientRect().height||0,footer?.getBoundingClientRect().height||0);
    host.style.setProperty('--movement-map-height',height+'px');
    fitInline(host);
    if(scroll){
      // scrollIntoView alone can stop at a tall iframe; finish in its actual outer viewport.
      host.scrollIntoView({behavior:'instant',block:'start'});
      const next=movementScreen(host);next.owner.scrollBy({top:next.top-next.obstruction,left:0,behavior:'instant'});
    }
  }

  function closeExpandedMap() {
    if (!expandedMap) return;
    const previous = expandedMap;
    expandedMap = null;
    previous.dialog.close();
    previous.dialog.remove();
    previous.source?.focus({ preventScroll: true });
    renderInlineMaps();
  }

  function centerInterior(host) {
    const candidates=[selectedUnit(),combatState?.units?.find(u=>u.id===myUnitId),combatState?.units?.find(u=>u.id===combatState.activeId)];
    const unit=candidates.find(u=>u?.location?.starshipId===host?.dataset.inlineShipMap);
    const viewport = host?.querySelector(".inline-map-viewport");
    if(unit?.location?.starshipId!==host?.dataset.inlineShipMap)return;
    const cell = host?.querySelector(`[data-map-square="${Number(unit?.location?.square)}"][data-map-mesh="${Number(unit?.location?.mesh)}"]`);
    if (!viewport || !cell) return;
    const target = cell.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
    viewport.scrollLeft += target.left - bounds.left - viewport.clientWidth / 2 + target.width / 2;
    viewport.scrollTop += target.top - bounds.top - viewport.clientHeight / 2 + target.height / 2;
  }

  function zoomInterior(host,factor,focus=false){
    const viewport=host.querySelector('.inline-map-viewport'),grid=host.querySelector('.inline-combat-map-grid');if(!viewport||!grid)return;
    const old=host===expandedMap?.host?expandedMap.cellSize:inlineZoom.get(host.dataset.inlineShipMap)||72;
    const x=(viewport.scrollLeft+viewport.clientWidth/2)/old,y=(viewport.scrollTop+viewport.clientHeight/2)/old;
    const size=Math.max(6,Math.min(viewport.clientWidth/4,focus?viewport.clientWidth/15:old*factor));
    manualInlineViews.add(host);
    if(host===expandedMap?.host){expandedMap.cellSize=size;expandedMap.dialog.style.setProperty('--expanded-cell-size',size+'px');}
    else{inlineZoom.set(host.dataset.inlineShipMap,size);grid.style.setProperty('--preview-cell-size',size+'px');}
    viewport.scrollLeft=x*size-viewport.clientWidth/2;viewport.scrollTop=y*size-viewport.clientHeight/2;
    if(focus)centerInterior(host);
  }
  let interiorLoading=false;
  async function expandInterior(host, source) {
    if(interiorLoading)return;
    interiorLoading=true;
    closeExpandedMap();
    let owner = window;
    try { while (owner.parent !== owner && owner.parent.document) owner = owner.parent; } catch (_) { /* Use the highest same-origin viewport. */ }
    const doc = owner.document;
    source.disabled=true;source.setAttribute('aria-busy','true');
    try {
      // A hosted stylesheet can arrive much later than its dialog markup.
      await Promise.all([...document.querySelectorAll('link[rel="stylesheet"][href*="ship-combat-map.css"],link[rel="stylesheet"][href*="ship-map-presentation.css"],link[rel="stylesheet"][href*="ship-floorplan-snapshot.css"]')].map(link=>{
        const existing=[...doc.querySelectorAll('link[rel="stylesheet"]')].find(candidate=>candidate.href===link.href);
        if(existing?.sheet)return Promise.resolve();
        return new Promise((resolve,reject)=>{
          const copy=existing||doc.createElement('link');
          const finish=error=>{owner.clearTimeout(timer);copy.removeEventListener('load',loaded);copy.removeEventListener('error',failed);if(error){if(copy!==link)copy.remove();reject(error);}else resolve();};
          const loaded=()=>finish(),failed=()=>finish(new Error('The ship interior could not load. Please try again.'));
          const timer=owner.setTimeout(failed,15000);
          copy.addEventListener('load',loaded,{once:true});copy.addEventListener('error',failed,{once:true});
          if(!existing){copy.rel='stylesheet';copy.href=link.href;copy.dataset.interiorMapStyles='';doc.head.append(copy);}
        });
      }));
    } catch(error) {owner.alert(error.message);return;}
    finally {interiorLoading=false;source.disabled=false;source.removeAttribute('aria-busy');}
    if(!host.isConnected)return;
    const shell = doc.createElement("dialog");
    shell.className = "expanded-interior-dialog";
    const record = ships().find((entry) => entry.id === host.dataset.inlineShipMap);
    shell.innerHTML = `<header><strong>${esc(record?.title || "Starship Interior")}</strong><div><button type="button" data-interior-zoom="-1" aria-label="Zoom out">&#8722;</button><button type="button" data-interior-zoom="1" aria-label="Zoom in">+</button><button type="button" data-interior-fit>Fit Ship</button><button type="button" data-interior-center>Enlarge / Character</button><button type="button" data-interior-back>Back</button></div></header><section data-inline-ship-map="${esc(host.dataset.inlineShipMap)}"></section>`;
    const mapHost = shell.querySelector("[data-inline-ship-map]");
    expandedMap = { dialog: shell, host: mapHost, source, cellSize: 96 };
    shell.addEventListener("cancel", (event) => { event.preventDefault(); closeExpandedMap(); });
    shell.addEventListener("click", (event) => {
      if (event.target.closest("[data-interior-back]")) return closeExpandedMap();
      const zoom = event.target.closest("[data-interior-zoom]");
      if (zoom && expandedMap) {
        zoomInterior(mapHost,Number(zoom.dataset.interiorZoom)>0?1.25:.8);
      }
      if (event.target.closest("[data-interior-center]")) zoomInterior(mapHost,1,true);
      if (event.target.closest("[data-interior-fit]")) fitInline(mapHost);
    });
    if (doc !== document) {
      shell.addEventListener("click", handleInlineClick, true);
      shell.addEventListener("pointerover", handleInlineHover);
      shell.addEventListener("click", handleInlinePointer, true);
    }
    doc.body.append(shell);
    renderInlineMaps(shell);
    shell.addEventListener('change',handleInteriorStation);
    shell.showModal();
    owner.requestAnimationFrame(() => fitInline(mapHost));
  }

  window.addEventListener("pagehide", closeExpandedMap);

  function renderInlineMaps(root = document, force = false) {
    if (root === document && expandedMap) renderInlineMaps(expandedMap.dialog, force);
    root.querySelectorAll?.("[data-inline-ship-map]").forEach((host) => {
      const record = ships().find((entry) => entry.id === host.dataset.inlineShipMap);
      const lane = host.closest(".ship-combat-lane");
      const target = interaction === "move" && selectedShipId === record?.id;
      lane?.classList.toggle("inline-move-target", target);
      if (!record) return;
      if (target && !force && host.querySelector("[data-inline-confirm-move]")) {
        refreshInlinePreview(host);
        return;
      }
      watchFit(host);
      const stateKey=interiorStateKey(record);
      if(!force && inlineStateCache.get(host)===stateKey){
        const stats=statsMarkup(record),node=host.querySelector('.combat-map-stats');
        if(node&&inlineStatsCache.get(host)!==stats){node.innerHTML=stats;inlineStatsCache.set(host,stats);}
        window.SADroneMap?.update(host.querySelectorAll('.inline-combat-map-grid'),record.ship,window.SAShipTargets.drones(combatState).filter(d=>d.targetId===record.id));
        return;
      }
      const markup = inlineMapMarkup(record);
      if (inlineMarkupCache.get(host) !== markup) {
        const oldViewport=host.querySelector(".inline-map-viewport"),scroll=oldViewport?{left:oldViewport.scrollLeft,top:oldViewport.scrollTop}:null;
        host.innerHTML = markup;
        if(scroll){const nextViewport=host.querySelector(".inline-map-viewport");if(nextViewport){nextViewport.scrollLeft=scroll.left;nextViewport.scrollTop=scroll.top;}}
        inlineMarkupCache.set(host, markup);
      }
      inlineStateCache.set(host,stateKey);
      inlineStatsCache.set(host,statsMarkup(record));
      window.SAFloorplanSnapshot?.mount(host.querySelector('.inline-combat-map-grid'),record);
      window.SADroneMap?.update(host.querySelectorAll('.inline-combat-map-grid'),record.ship,window.SAShipTargets.drones(combatState).filter(d=>d.targetId===record.id));
    });
  }

  function refreshInlinePreview(host) {
    if(host?.dataset.inlineShipMap!==selectedShipId)return;
    if (expandedMap && host !== expandedMap.host) refreshInlinePreview(expandedMap.host);
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
      const columns=window.SAShipMap.gridColumns(record);
    const cells = [...new Set([...(record.ship.gridCells || []), ...window.SAShipMap.triangleCells(record.ship), ...layoutFor(record.ship).footprint.keys()])];
      const rows = cells.map((cell) => Math.floor(cell / columns));
      const cols = cells.map((cell) => cell % columns);
      const minRow = Math.min(...rows), maxRow = Math.max(...rows), minCol = Math.min(...cols), maxCol = Math.max(...cols);
      const points = [locationFor(selectedUnit(), record), ...preview.path].filter(Boolean).map((point) => {
        const x = point.square % columns - minCol + ((point.mesh % 3) + .5) / 3;
        const y = Math.floor(point.square / columns) - minRow + (Math.floor(point.mesh / 3) + .5) / 3;
        return `${x},${y}`;
      }).join(" ");
      mapGrid.insertAdjacentHTML("beforeend", `<svg class="combat-move-line" viewBox="0 0 ${maxCol - minCol + 1} ${maxRow - minRow + 1}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`);
    }
    const prompt = host.querySelector(".inline-map-toolbar>span");
    if (prompt) prompt.textContent = moveSubmitting ? "Starting movement..." : moveError || (preview?.locked ? `${preview.path?.length || 0} unit route selected.` : "Point to preview a route; click to select. Or choose a station below.");
    const stationSelect=host.querySelector('[data-interior-station]');if(stationSelect)stationSelect.value=preview?.station?`${preview.square}:${preview.mesh}`:'';
    const submit = host.querySelector("[data-inline-confirm-move]");
    if (submit) {
      submit.disabled = moveSubmitting || !(preview?.locked && preview?.path?.length);
      submit.setAttribute("aria-busy", String(moveSubmitting));
      submit.textContent = moveSubmitting ? "Starting..." : preview?.station ? "Station" : "Confirm Move";
    }
  }

  function refreshLiveInterior(host) {
    const record=ships().find(s=>s.id===host?.dataset.inlineShipMap);
    if(!record||record.id!==selectedShipId)return;
    const template=host.ownerDocument.createElement('template');template.innerHTML=inlineMapMarkup(record);
    const next=template.content;
    for(const cell of host.querySelectorAll('.combat-map-square[data-inline-square]')) {
      const replacement=next.querySelector(`[data-inline-square="${cell.dataset.inlineSquare}"]`);
      if(!replacement)continue;
      cell.querySelectorAll('.combat-token,.combat-station-marker').forEach(n=>n.remove());
      replacement.querySelectorAll('.combat-token,.combat-station-marker').forEach(n=>cell.append(n));
    }
    for(const button of host.querySelectorAll('[data-map-square]')){
      const occupied=Boolean(stationAt(record,button.dataset.mapSquare,button.dataset.mapMesh)&&stationDestinationOccupied(record,button.dataset.mapSquare,button.dataset.mapMesh));
      button.classList.toggle('station-occupied',occupied);
      button.setAttribute('aria-label',occupied?'Station occupied':'Map location');
    }
    const grid=host.querySelector('.inline-combat-map-grid');
    grid?.querySelectorAll(':scope>.combat-moving-token').forEach(n=>n.remove());
    next.querySelectorAll('.inline-combat-map-grid>.combat-moving-token').forEach(n=>grid?.append(n));
    refreshInlinePreview(host);
  }

  function renderRoster() {
    const ship = selectedShip();
    const units = (combatState?.units || []).filter((unit) => mode === "gm" || unit.id === myUnitId || unit.location?.starshipId === ship?.id);
    roster.innerHTML = mode === "gm" ? units.map((unit) => `<button class="combat-map-person ${unit.id === selectedUnitId ? "active" : ""}" data-map-unit="${unit.id}" style="--token-color:${esc(unit.color || "#39e58f")}"><i></i><span>${esc(unit.characterName)}<small>${unit.location?.starshipId ? unit.location.starshipId === ship?.id ? `Square ${Number(unit.location.square) + 1}` : "Aboard another ship" : "Exterior / Surface"}</small></span></button>`).join("") : "";
  }

  function render() {
    const available = ships().length > 0;
    openButton?.classList.toggle("hidden", !available || !["gm", "player"].includes(mode));
    if (interaction !== "move" || !document.querySelector(`[data-inline-ship-map="${CSS.escape(selectedShipId)}"]`)) renderInlineMaps();
    if (dialog.classList.contains("hidden")) return;
    const unit = selectedUnit();
    const ship = selectedShip();
    title.textContent = ship?.title || "Starship Interior";
    renderRoster();
    renderGrid();
    renderStats();
    stop.hidden = unit?.timedAction?.kind !== "move";
    leaveStation.hidden = Boolean(unit?.shipAi) || !unit?.location?.stationed || combatState?.activeId !== unit?.id;
    confirm.textContent = mode === "gm" && interaction === "relocate" ? "Relocate" : preview?.station ? "Station" : "Confirm Move";
  }

  function open(options = {}) {
    const preferred = options.unitId || (mode === "player" ? myUnitId : combatState?.activeId) || combatState?.units?.[0]?.id || "";
    selectedUnitId = preferred;
    interaction = options.interaction || (mode === "gm" ? "relocate" : "view");
    if (interaction !== "view") mapView.hull = false;
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
    const cells = ship ? [...new Set([...(ship.ship.gridCells||[]),...window.SAShipMap.triangleCells(ship.ship),...layoutFor(ship.ship).footprint.keys()])] : [];
    if (!viewport || !cells.length) return;
    const columns=window.SAShipMap.gridColumns(ship);
    const rows = cells.map((cell) => Math.floor(cell / columns));
    const cols = cells.map((cell) => cell % columns);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);
    const cellSize = Math.max(1, Math.min(96, Math.floor(Math.min((viewport.clientWidth - 36) / (maxCol - minCol + 1), (viewport.clientHeight - 36) / (maxRow - minRow + 1)))));
    grid.style.setProperty("--cell-size", `${cellSize}px`);
    viewport.scrollLeft = Math.max(0, minCol * cellSize - (viewport.clientWidth - (maxCol - minCol + 1) * cellSize) / 2 + 20);
    viewport.scrollTop = Math.max(0, minRow * cellSize - (viewport.clientHeight - (maxRow - minRow + 1) * cellSize) / 2 + 20);
  }

  function close() { dialog.classList.add("hidden"); clearMoveSelection(); }

  async function submitSelectedMove({ closeAfter = false } = {}) {
    const ship = selectedShip();
    const unit = selectedUnit();
    if (moveSubmitting || !ship || !unit || !preview?.locked || !preview?.path?.length) return;
    moveSubmitting = true;
    moveError = "";
    const submittedDestination = completeLocation(ship, preview);
    refreshInlinePreview(document.querySelector(`[data-inline-ship-map="${CSS.escape(selectedShipId)}"]`));
    try {
      if (mode === "gm" && interaction === "relocate") await bridge()?.action({ action: "setCombatLocation", id: unit.id, location: submittedDestination });
      else await bridge()?.action({ action: "playerCombatAction", id: unit.id, kind: "move", route: preview.path.map((point) => completeLocation(ship, point)), stationOnArrival: Boolean(preview.station), stationName: footprint(ship).get(Number(preview.square))?.label || "SIC", stationSlot: preview.mesh });
    } catch (error) {
      moveSubmitting = false;
      moveError = error.message || "Connection interrupted. Your destination is still selected.";
      refreshInlinePreview(document.querySelector(`[data-inline-ship-map="${CSS.escape(selectedShipId)}"]`));
      return;
    }
    const nextUnit = bridge()?.state?.()?.units?.find((entry) => entry.id === unit.id);
    const relocationAccepted = mode === "gm" && interaction === "relocate"
      && nextUnit?.location?.starshipId === submittedDestination.starshipId
      && Number(nextUnit?.location?.square) === submittedDestination.square
      && Number(nextUnit?.location?.mesh) === submittedDestination.mesh;
    const arrived=nextUnit?.location?.starshipId===submittedDestination.starshipId
      &&Number(nextUnit.location.square)===submittedDestination.square&&Number(nextUnit.location.mesh)===submittedDestination.mesh;
    const moveAccepted = interaction === "move" && (nextUnit?.timedAction?.kind === "move"||arrived);
    moveSubmitting = false;
    if (relocationAccepted || moveAccepted) {
      clearMoveSelection();
      if (closeAfter) dialog.classList.add("hidden");
      requestAppRender();
      return;
    }
    if (!nextUnit || (interaction==='move'&&bridge()?.state?.()?.activeId!==unit.id)) {
      clearMoveSelection();
      requestAppRender();
      return;
    }
    moveError = "Movement did not start. The destination is still selected; try Confirm Move again.";
    refreshInlinePreview(document.querySelector(`[data-inline-ship-map="${CSS.escape(selectedShipId)}"]`));
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
  grid.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch" || interaction === "view" || preview?.locked) return;
    const cell = event.target.closest("[data-map-square]");
    if (cell) chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), false);
  });
  roster.addEventListener("click", (event) => { const button = event.target.closest("[data-map-unit]"); if (button) { selectedUnitId = button.dataset.mapUnit; preview = null; confirm.disabled = true; render(); } });
  shipSelect.addEventListener("change", () => { selectedShipId = shipSelect.value; preview = null; confirm.disabled = true; render(); requestAnimationFrame(fitShip); });
  for(const [action,label] of [['out','−'],['in','+'],['fit','Fit Ship'],['focus','Enlarge / Character']]){
    const button=document.createElement('button');button.type='button';button.dataset.combatInteriorZoom=action;button.textContent=label;button.title=action==='fit'?'Fit Ship':`Zoom ${action}`;button.setAttribute('aria-label',button.title);
    closeButton.before(button);
    button.onclick=()=>{
      if(action==='fit'){fitShip();return;}
      const viewport=grid.parentElement,current=parseFloat(grid.style.getPropertyValue('--cell-size'))||54,size=Math.max(6,Math.min(viewport.clientWidth/4,action==='focus'?viewport.clientWidth/15:current*(action==='in'?1.25:.8)));
      const x=(viewport.scrollLeft+viewport.clientWidth/2-20)/current,y=(viewport.scrollTop+viewport.clientHeight/2-20)/current;
      grid.style.setProperty('--cell-size',size+'px');viewport.scrollLeft=x*size-viewport.clientWidth/2+20;viewport.scrollTop=y*size-viewport.clientHeight/2+20;
      if(action==='focus'){const unit=selectedUnit(),loc=unit?.location;if(loc?.starshipId===selectedShipId){const columns=window.SAShipMap.gridColumns(selectedShip());viewport.scrollLeft=(loc.square%columns+.5)*size-viewport.clientWidth/2+20;viewport.scrollTop=(Math.floor(loc.square/columns)+.5)*size-viewport.clientHeight/2+20;}}
    };
  }
  panButtons.forEach((button) => button.addEventListener("click", () => {
    const viewport = grid.parentElement;
    const amount = Math.max(70, Math.round(Math.min(viewport.clientWidth, viewport.clientHeight) * .42));
    const direction = button.dataset.combatMapPan;
    viewport.scrollBy({ left: direction === "left" ? -amount : direction === "right" ? amount : 0, top: direction === "up" ? -amount : direction === "down" ? amount : 0, behavior: "smooth" });
  }));
  viewInputs.forEach((input) => input.addEventListener("change", () => {
    mapView[input.dataset.combatMapView] = input.checked;window.SAShipMap.saveViewPreferences(mapView);
    renderGrid();
  }));
  confirm.addEventListener("click", async () => {
    await submitSelectedMove({ closeAfter: true });
  });
  stop.addEventListener("click", async () => { await bridge()?.action({ action: "stopTravel", id: selectedUnitId }); close(); });
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
  function handleInlineClick(event) {
    const inlineHost = event.target.closest?.("[data-inline-ship-map]");
    if (inlineHost) {
      if(event.target.closest('[data-interior-fit]')){fitInline(inlineHost);return;}
      if(event.target.closest('[data-interior-focus]')){zoomInterior(inlineHost,1,true);return;}
      const zoom=event.target.closest('[data-preview-zoom]');if(zoom){
        zoomInterior(inlineHost,Number(zoom.dataset.previewZoom)>0?1.25:.8);return;
      }
      const expand = event.target.closest("[data-expand-interior]");
      if (expand) { if (expandedMap?.host !== inlineHost) expandInterior(inlineHost, expand); return; }
      const view = event.target.closest("[data-inline-map-view]");
      if (view) { mapView[view.dataset.inlineMapView] = view.checked; window.SAShipMap.saveViewPreferences(mapView); renderInlineMaps(document, true); return; }
      const door = event.target.closest("[data-combat-door]");
      if (door) {
        const unit = mode === "player" ? combatState?.units?.find((entry) => entry.id === myUnitId) : selectedUnit();
        void bridge()?.action({ action: "operateCombatDoor", id: unit?.id || "", starshipId: inlineHost.dataset.inlineShipMap, doorKey: door.dataset.combatDoor });
        return;
      }
      if (event.target.closest("[data-inline-cancel-move]")) {
        if (moveSubmitting) return;
        clearMoveSelection(); requestAppRender(); return;
      }
      if (event.target.closest("[data-inline-confirm-move]")) { void submitSelectedMove(); return; }
      const cell = event.target.closest("[data-map-square]");
      if (cell && interaction === "move" && selectedShipId === inlineHost.dataset.inlineShipMap) {
        chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), true);
        refreshInlinePreview(inlineHost);
      }
      // Pointerdown remains the primary mouse path because hover redraws can
      // replace a cell before click. This fallback also supports synthetic clicks.
      return;
    }
    const button = event.target.closest("[data-open-ship-map]");
    if (!button) return;
    open({ starshipId: button.dataset.openShipMap, interaction: mode === "gm" ? "relocate" : "view" });
  }
  document.addEventListener("click", handleInlineClick, true);
  function handleInteriorStation(event){
    const select=event.target.closest?.('[data-interior-station]'),host=select?.closest('[data-inline-ship-map]');
    if(!select?.value||interaction!=='move'||host.dataset.inlineShipMap!==selectedShipId)return;
    const [square,mesh]=select.value.split(':').map(Number);
    chooseDestination(square,mesh,true);refreshInlinePreview(host);
  }
  document.addEventListener('change',handleInteriorStation);
  function handleInlineHover(event) {
    const host = event.target.closest?.("[data-inline-ship-map]");
    const cell = event.target.closest?.("[data-map-square]");
    if (!host || !cell || event.pointerType === "touch" || interaction !== "move" || preview?.locked || selectedShipId !== host.dataset.inlineShipMap) return;
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), false);
    refreshInlinePreview(host);
  }
  document.addEventListener("pointerover", handleInlineHover);
  function handleInlinePointer(event) {
    const host = event.target.closest?.("[data-inline-ship-map]");
    const cell = event.target.closest?.("[data-map-square]");
    if (!host || !cell || interaction !== "move" || selectedShipId !== host.dataset.inlineShipMap) return;
    event.preventDefault();
    event.stopPropagation();
    chooseDestination(Number(cell.dataset.mapSquare), Number(cell.dataset.mapMesh), true);
    refreshInlinePreview(host);
  }
  document.addEventListener("click", handleInlinePointer, true);
  window.addEventListener("sa-combat-state", (event) => {
    window.SAVacuumUI?.animateEjections(combatState,event.detail.state);
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
      if (!stillSelectable && !moveSubmitting) {
        clearMoveSelection();
        requestAppRender();
        return;
      }
      if (stillSelectable || moveSubmitting) {
        document.querySelectorAll('[data-inline-ship-map]').forEach(refreshLiveInterior);
        if(expandedMap)refreshLiveInterior(expandedMap.host);
        return;
      }
    }
    render();
  });
  window.SACombatMap = {
    chooseStartingLocation(state,preferred,name){
      let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}
      return new Promise(resolve=>{
        const view=doc.createElement('dialog');view.setAttribute('aria-label','Starting location');view.style.cssText='width:min(900px,94vw);max-height:90dvh;background:#081923;color:#e5f8ff;border:1px solid #6de0ed;padding:18px';
        view.innerHTML=`<h2>Starting location: ${esc(name)}</h2><label>Starship <select aria-label="Starting starship">${state.starships.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select></label><p role="status">Choose a starting square.</p><div data-start-grid style="overflow:auto;max-height:60vh;margin:12px 0"></div><button type="button" data-back>Back</button> <button type="button" data-start disabled>Confirm starting location</button>`;
        const select=view.querySelector('select'),grid=view.querySelector('[data-start-grid]'),confirm=view.querySelector('[data-start]');let chosen=null;
        if(state.starships.some(s=>s.id===preferred))select.value=preferred;
        const draw=()=>{chosen=null;confirm.disabled=true;const ship=state.starships.find(s=>s.id===select.value),columns=window.SAShipMap.gridColumns(ship),cells=ship.ship.gridCells,minX=Math.min(...cells.map(c=>c%columns)),minY=Math.min(...cells.map(c=>Math.floor(c/columns))),layout=layoutFor(ship.ship);
          grid.innerHTML=`<div style="display:grid;grid-auto-columns:72px;grid-auto-rows:72px;width:max-content">${cells.map(c=>`<button type="button" data-start-square="${c}" title="${esc(layout.footprint.get(c)?.label||'Hull')}" style="grid-column:${c%columns-minX+1};grid-row:${Math.floor(c/columns)-minY+1};border-radius:0;background:#184550;color:white;font-size:11px;padding:3px">${esc(layout.footprint.get(c)?.label||'Hull')}</button>`).join('')}</div>`;};
        select.onchange=draw;grid.onclick=event=>{const button=event.target.closest('[data-start-square]');if(!button)return;const square=Number(button.dataset.startSquare),occupied=new Set(state.units.filter(u=>u.location?.starshipId===select.value&&u.location.square===square).map(u=>u.location.mesh));const mesh=[4,0,1,2,3,5,6,7,8].find(m=>!occupied.has(m));if(mesh===undefined){view.querySelector('[role=status]').textContent='That square is full. Choose another.';return;}chosen={environment:'starship',starshipId:select.value,square,mesh,sicId:'',stationed:false};grid.querySelectorAll('button').forEach(b=>b.style.outline='');button.style.outline='3px solid #ffe16a';confirm.disabled=false;view.querySelector('[role=status]').textContent='Starting square selected.';};
        confirm.onclick=()=>{view.returnValue='confirmed';view.close();};view.querySelector('[data-back]').onclick=()=>view.close();view.addEventListener('close',()=>{const result=view.returnValue==='confirmed'?chosen:null;view.remove();resolve(result);},{once:true});doc.body.append(view);draw();view.showModal();
      });
    },
    open,
    movementPresentation,
    planMove(unitId,destination){
      const unit=combatState?.units.find(u=>u.id===unitId),ship=ships().find(s=>s.id===unit?.location?.starshipId);
      if(!unit||!ship)return {error:'Character is not aboard a combat starship.'};
      if(combatState.activeId!==unit.id||unit.defeatedAt||unit.consoleHold||unit.delayedAction||unit.timedAction||combatState.rollPaused)return {error:'Wait for your turn and finish the pending action or roll.'};
      const square=Number(destination.square),mesh=Number(destination.mesh),station=stationAt(ship,square,mesh);
      if(station&&stationDestinationOccupied(ship,square,mesh,unit.id))return {error:'That station is occupied or reserved.'};
      if(combatState.units.filter(u=>u.id!==unit.id&&u.location?.starshipId===ship.id&&u.location.square===square&&u.location.mesh===mesh).length>=2)return {error:'That location already holds two characters.'};
      const path=findPath(unit,{square,mesh},ship);
      if(!path?.length)return {error:path===null?'No legal route reaches that location.':'You are already there.'};
      return {route:path.map(point=>completeLocation(ship,point)),station,stationName:footprint(ship).get(square)?.label||'SIC',turnSerial:unit.turnSerial};
    },
    openMove(unit) {
      if (unit?.shipAi) return;
      mapView.hull = false;
      selectedUnitId = unit.id;
      selectedShipId = unit.location?.starshipId || "";
      interaction = "move";
      preview = null;
      moveSubmitting = false;
      moveError = "";
      const host = document.querySelector(`[data-inline-ship-map="${CSS.escape(selectedShipId)}"]`);
      if (!host) { open({ interaction: "move", unitId: unit.id, starshipId: selectedShipId }); return; }
      setInlineMoveSelecting(true);
      renderInlineMaps();
      requestAnimationFrame(() => {
        fitMoveToScreen(host,true);
        moveViewportOwner?.removeEventListener('resize',moveViewportResize);
        moveViewportOwner=movementScreen(host).owner;
        moveViewportResize=()=>fitMoveToScreen(host);moveViewportOwner.addEventListener('resize',moveViewportResize);
        // Let the enclosing PC frame report its new height before final alignment.
        requestAnimationFrame(()=>requestAnimationFrame(()=>fitMoveToScreen(host,true)));
      });
    },
    isInlineMoveSelecting: () => interaction === "move",
    render,
    renderInlineMaps,
  };
})();
