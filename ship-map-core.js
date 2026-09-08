(function initializeShipMapCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAShipMap = api;
}(typeof window !== "undefined" ? window : null, function createShipMapCore() {
  const ASSET_VERSION = "20260902-floorplans-2";
  const GRID_SIZE = 20;
  const SIDES = Object.freeze([
    { name: "top", offset: -GRID_SIZE, valid: (square) => square >= GRID_SIZE },
    { name: "right", offset: 1, valid: (square) => square % GRID_SIZE < GRID_SIZE - 1 },
    { name: "bottom", offset: GRID_SIZE, valid: (square) => square < GRID_SIZE * (GRID_SIZE - 1) },
    { name: "left", offset: -1, valid: (square) => square % GRID_SIZE > 0 },
  ]);
  const image = (filename) => `${filename}?v=${ASSET_VERSION}`;
  const catalog = {
    "en-engine-1": { width: 1, height: 1, label: "EN 1", color: "#2d873b", image: image("en-engine-1-floor-plan.png"), output: 5, stations: [{ x: 0, y: 0, mesh: 1 }] },
    "en-engine-2": { width: 2, height: 2, label: "EN 2", color: "#2d873b", image: image("en-engine-2-floor-plan.png"), output: 13, stations: [{ x: 0, y: 0, mesh: 1 }, { x: 1, y: 1, mesh: 7 }] },
    "en-engine-3": { width: 3, height: 3, label: "EN 3", color: "#2d873b", image: image("en-engine-3-floor-plan.png"), output: 29, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 1, y: 2, mesh: 7 }] },
    "en-engine-4": { width: 4, height: 4, label: "EN 4", color: "#2d873b", image: image("en-engine-4-floor-plan.png"), output: 50, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 3, y: 1, mesh: 5 }, { x: 1, y: 3, mesh: 7 }] },
    "en-engine-5": { width: 5, height: 5, label: "EN 5", color: "#2d873b", image: image("en-engine-5-floor-plan.png"), output: 77, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 4, y: 2, mesh: 5 }, { x: 2, y: 4, mesh: 7 }] },
    "en-engine-6": { width: 6, height: 6, label: "EN 6", color: "#2d873b", image: image("en-engine-6-floor-plan.png"), output: 110, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 5, y: 2, mesh: 5 }, { x: 3, y: 5, mesh: 7 }, { x: 0, y: 3, mesh: 3 }] },
    "life-support": { width: 2, height: 2, label: "LIFE", color: "#16788a", image: image("life-support-floor-plan.png"), output: 0, stations: [] },
    "nutritional-supplement": { width: 1, height: 1, label: "NUT.", color: "#197a6f", image: image("nutritional-supplement-floor-plan.png"), output: 0, stations: [] },
  };

  Object.assign(catalog, {
    "au-engine-1": { ...catalog["en-engine-1"], label: "AU 1", color: "#886b28", output: 0, auOutput: 3, price: 1200, security: 3, crafting: "Drakkonite, 16 hrs", threshold: 8, cardNumber: "A-19", image: image("au-engine-1-floor-plan.png") },
    "au-engine-2": { ...catalog["en-engine-2"], label: "AU 2", color: "#886b28", output: 0, auOutput: 7, price: 2800, security: 3, crafting: "Phazon, 16 hrs", threshold: 11, cardNumber: "A-20", image: image("au-engine-2-floor-plan.png") },
    "au-engine-3": { ...catalog["en-engine-3"], label: "AU 3", color: "#886b28", output: 0, auOutput: 15, price: 6000, security: 4, crafting: "Endernium, 2 days", threshold: 16, cardNumber: "A-21", image: image("au-engine-3-floor-plan.png") },
    "au-engine-4": { ...catalog["en-engine-4"], label: "AU 4", color: "#886b28", output: 0, auOutput: 25, price: 10000, security: 4, crafting: "Dark Phazon, 3 days", threshold: 20, cardNumber: "A-22", image: image("au-engine-4-floor-plan.png") },
    "au-engine-5": { ...catalog["en-engine-5"], label: "AU 5", color: "#886b28", output: 0, auOutput: 40, price: 16000, security: 5, crafting: "Carmot, 1 week", threshold: 27, cardNumber: "B-11", image: image("au-engine-5-floor-plan.png") },
    "au-engine-6": { ...catalog["en-engine-6"], label: "AU 6", color: "#886b28", output: 0, auOutput: 60, price: 24000, security: 5, crafting: "Infinium, 1 week", threshold: 33, cardNumber: "B-12", image: image("au-engine-6-floor-plan.png") },
  });

  const hybridFamilies = [
    { prefix: "en-au", name: "Power Hybrid", label: "PH", color: "#296e88", bonus: "en", en: [3, 9, 19, 33, 51, 73], au: [1, 2, 5, 10, 17, 26], prices: [1450, 3950, 8650, 15550, 24650, 35950], thresholds: [9, 14, 20, 26, 34, 42], firstCraft: "Argol, 6 hrs", cards: ["A-11", "A-12", "A-13", "A-14", "B-7", "B-8"] },
    { prefix: "au-en", name: "Action Hybrid", label: "AH", color: "#8b5378", bonus: "au", en: [1, 4, 9, 16, 25, 36], au: [2, 5, 12, 20, 30, 47], prices: [1150, 3400, 7950, 13600, 20750, 31400], thresholds: [8, 12, 17, 22, 29, 36], firstCraft: "Mirium, 8 hrs", cards: ["A-15", "A-16", "A-17", "A-18", "B-9", "B-10"] },
  ];
  for (let tier = 1; tier <= 6; tier += 1) {
    Object.assign(catalog[`en-engine-${tier}`], { name: `Power Engine ${tier}`, stationBonus: "en", engine: true });
    Object.assign(catalog[`au-engine-${tier}`], { name: `Action Engine ${tier}`, stationBonus: "au", engine: true });
    for (const family of hybridFamilies) {
      const type = `${family.prefix}-engine-${tier}`;
      catalog[type] = { ...catalog[`au-engine-${tier}`], name: `${family.name} Engine ${tier}`, label: `${family.label} ${tier}`, color: family.color,
        output: family.en[tier - 1], auOutput: family.au[tier - 1], stationBonus: family.bonus,
        price: family.prices[tier - 1], threshold: family.thresholds[tier - 1], cardNumber: family.cards[tier - 1],
        crafting: tier === 1 ? family.firstCraft : catalog[`au-engine-${tier}`].crafting,
        impairedAuOnly: true, image: image(`${type}-floor-plan.png`) };
    }
  }

  function definition(type) {
    return catalog[type] || { width: 1, height: 1, label: type || "SIC", color: "#197a6f", image: "", output: 0, stations: [] };
  }

  function floorplanStyle(type, column = 0, row = 0) {
    const entry = definition(type);
    if (!entry.image) return "";
    const x = entry.width === 1 ? 50 : (Number(column) / (entry.width - 1)) * 100;
    const y = entry.height === 1 ? 50 : (Number(row) / (entry.height - 1)) * 100;
    return `background-image:url('${entry.image}');background-size:${entry.width * 100}% ${entry.height * 100}%;background-position:${x}% ${y}%;background-repeat:no-repeat`;
  }

  function doorKey(first, second) {
    return [Number(first), Number(second)].sort((a, b) => a - b).join(":");
  }

  function blocksMovement(type, width, height, column, row) {
    if (!definition(type).engine || width < 3 || height < 3) return false;
    const centerColumns = width % 2 ? [Math.floor(width / 2)] : [width / 2 - 1, width / 2];
    const centerRows = height % 2 ? [Math.floor(height / 2)] : [height / 2 - 1, height / 2];
    return centerColumns.includes(column) && centerRows.includes(row);
  }

  function buildLayout(ship = {}) {
    const hull = new Set(Array.isArray(ship.gridCells) ? ship.gridCells.map(Number) : []);
    const inventory = new Map((ship.sicInventory || []).map((item) => [item.id, item]));
    const footprint = new Map();
    for (const placement of ship.placements || []) {
      const item = inventory.get(placement.sicId);
      const type = item?.type || "";
      const entry = definition(type);
      const origin = Number(placement.cell);
      const originRow = Math.floor(origin / GRID_SIZE);
      const originColumn = origin % GRID_SIZE;
      for (let row = 0; row < entry.height; row += 1) for (let column = 0; column < entry.width; column += 1) {
        const square = (originRow + row) * GRID_SIZE + originColumn + column;
        footprint.set(square, { placement, item, sicId: placement.sicId, type, width: entry.width, height: entry.height, label: entry.label, color: entry.color, image: entry.image, stations: entry.stations || [], offset: row * entry.width + column, row, column, blocked: blocksMovement(type, entry.width, entry.height, column, row) });
      }
    }

    const bestConnections = new Map();
    for (const [square, current] of footprint) {
      for (const side of SIDES.filter((entry) => entry.name === "right" || entry.name === "bottom")) {
        if (!side.valid(square)) continue;
        const adjacent = square + side.offset;
        const other = footprint.get(adjacent);
        if (!other || other.sicId === current.sicId) continue;
        const currentCross = side.name === "right" ? current.row : current.column;
        const otherCross = side.name === "right" ? other.row : other.column;
        const currentSize = side.name === "right" ? current.height : current.width;
        const otherSize = side.name === "right" ? other.height : other.width;
        const score = Math.abs(currentCross - (currentSize - 1) / 2) + Math.abs(otherCross - (otherSize - 1) / 2);
        const pair = [current.sicId, other.sicId].sort().join(":");
        const key = doorKey(square, adjacent);
        const previous = bestConnections.get(pair);
        if (!previous || score < previous.score || (score === previous.score && key < previous.key)) bestConnections.set(pair, { key, score });
      }
    }
    const connectionDoors = new Set([...bestConnections.values()].map((entry) => entry.key));

    function boundary(square, sideName) {
      const side = SIDES.find((entry) => entry.name === sideName);
      if (!side) return { kind: "none", side: sideName, key: "" };
      const adjacent = Number(square) + side.offset;
      if (!side.valid(Number(square)) || !hull.has(adjacent)) return { kind: "wall", side: sideName, key: "" };
      const current = footprint.get(Number(square));
      const other = footprint.get(adjacent);
      if (!current || current.sicId === other?.sicId) return { kind: "none", side: sideName, key: "" };
      if (other) {
        if (Number(square) > adjacent) return { kind: "none", side: sideName, key: "" };
        const key = doorKey(square, adjacent);
        return { kind: connectionDoors.has(key) ? "door" : "wall", side: sideName, key };
      }
      const cross = sideName === "top" || sideName === "bottom" ? current.column : current.row;
      const size = sideName === "top" || sideName === "bottom" ? current.width : current.height;
      const centered = cross === Math.floor((size - 1) / 2);
      return { kind: centered ? "door" : "wall", side: sideName, key: centered ? doorKey(square, adjacent) : "" };
    }

    function edge(first, second) {
      const difference = Number(second) - Number(first);
      if (Math.abs(difference) === 1 && Math.floor(Number(first) / GRID_SIZE) === Math.floor(Number(second) / GRID_SIZE)) {
        const left = Math.min(Number(first), Number(second));
        const fromLeft = boundary(left, "right");
        return fromLeft.kind === "none" ? boundary(left + 1, "left") : fromLeft;
      }
      if (Math.abs(difference) === GRID_SIZE) {
        const top = Math.min(Number(first), Number(second));
        const fromTop = boundary(top, "bottom");
        return fromTop.kind === "none" ? boundary(top + GRID_SIZE, "top") : fromTop;
      }
      return { kind: "none", side: "", key: "" };
    }

    return Object.freeze({ hull, footprint, connectionDoors, boundary, edge });
  }

  function boundaryMarkup(layout, square, options = {}) {
    const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    return SIDES.map(({ name }) => {
      const boundary = layout.boundary(square, name);
      if (boundary.kind === "none") return "";
      const axis = name === "top" || name === "bottom" ? "horizontal" : "vertical";
      const wall = (segment = "full") => `<i aria-hidden="true" class="sa-map-wall ${name} ${axis} ${segment}"></i>`;
      if (boundary.kind === "wall") return wall();
      const open = Boolean(options.isOpen?.(boundary.key));
      const attributes = Object.entries(options.doorAttributes?.(boundary.key) || {})
        .filter(([key]) => /^data-[a-z-]+$/.test(key))
        .map(([key, value]) => `${key}="${escape(value)}"`).join(" ");
      return `${wall("start")}${wall("end")}<button type="button" class="sa-map-door ${name} ${axis}${open ? " is-open" : ""}" ${attributes} aria-pressed="${open}" aria-label="${open ? "Close" : "Open"} door"><i class="sa-door-leaf"></i><i class="sa-door-leaf"></i></button>`;
    }).join("");
  }

  return Object.freeze({ ASSET_VERSION, GRID_SIZE, SIDES, catalog: Object.freeze(catalog), definition, floorplanStyle, doorKey, blocksMovement, buildLayout, boundaryMarkup, image });
}));
