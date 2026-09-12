(function initializeShipMapCore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAShipMap = api;
}(typeof window !== "undefined" ? window : null, function createShipMapCore() {
  const ASSET_VERSION = "20260911-pilot-web-assets-1";
  const GRID_SIZE = 20;
  const SIDES = Object.freeze([
    { name: "top", offset: -GRID_SIZE, valid: (square) => square >= GRID_SIZE },
    { name: "right", offset: 1, valid: (square) => square % GRID_SIZE < GRID_SIZE - 1 },
    { name: "bottom", offset: GRID_SIZE, valid: (square) => square < GRID_SIZE * (GRID_SIZE - 1) },
    { name: "left", offset: -1, valid: (square) => square % GRID_SIZE > 0 },
  ]);
  const image = (filename) => `${filename}?v=${ASSET_VERSION}`;
  const catalog = {
    "lock-on-1": { name:"Lock-On System 1", width:1, height:1, label:"LO 1", color:"#9d7138", image:image("lock-on-1-floor-plan.png"), lockOn:true, tier:1, energyCost:1, price:560, security:1, crafting:"Paradon, 6 hrs", threshold:3, cardNumber:"A-37", output:0, stations:[] },
    "cockpit-1": { name: "Cockpit 1", width: 1, height: 1, label: "CP 1", color: "#346f91", image: image("cockpit-1-floor-plan.png"), shipControl: true, bridge: true, edge: true, energyCost: 1, price: 750, security: 4, crafting: "Transpherion, 4 hrs", threshold: 20, cardNumber: "A-1", output: 0, stations: [{x:0,y:0,mesh:0}] },
    "rapid-laser-1": { name: "Rapid Laser 1", width: 1, height: 1, label: "RL 1", color: "#88dfff", image: image("rapid-laser-1-sprite.png"), sprite: "rapid-laser-1-sprite.png", exterior: true, weapon: true, tier: 1, energyCost: 1, price: 450, security: 1, crafting: "Crystilium, 4 hrs", threshold: 4, cardNumber: "A-100", output: 0, stations: [] },
    "exhaust-thruster-1": { name: "Exhaust Thruster 1", width: 1, height: 1, label: "ET 1", color: "#568da4", image: image("exhaust-thruster-1-graphic.png"), exterior: true, thruster: true, impulseBonus: 1, exhaust: -2, energyCost: 2, price: 200, security: 2, crafting: "Dianium, 2 hrs", threshold: 10, cardNumber: "A-23", output: 0, stations: [] },
    "en-engine-1": { width: 1, height: 1, label: "EN 1", color: "#2d873b", image: image("en-engine-1-floor-plan.png"), output: 5, stations: [{ x: 0, y: 0, mesh: 1 }] },
    "en-engine-2": { width: 2, height: 2, label: "EN 2", color: "#2d873b", image: image("en-engine-2-floor-plan.png"), output: 13, stations: [{ x: 0, y: 0, mesh: 1 }, { x: 1, y: 1, mesh: 7 }] },
    "en-engine-3": { width: 3, height: 3, label: "EN 3", color: "#2d873b", image: image("en-engine-3-floor-plan.png"), output: 29, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 1, y: 2, mesh: 7 }] },
    "en-engine-4": { width: 4, height: 4, label: "EN 4", color: "#2d873b", image: image("en-engine-4-floor-plan.png"), output: 50, stations: [{ x: 1, y: 0, mesh: 1 }, { x: 3, y: 1, mesh: 5 }, { x: 1, y: 3, mesh: 7 }] },
    "en-engine-5": { width: 5, height: 5, label: "EN 5", color: "#2d873b", image: image("en-engine-5-floor-plan.png"), output: 77, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 4, y: 2, mesh: 5 }, { x: 2, y: 4, mesh: 7 }] },
    "en-engine-6": { width: 6, height: 6, label: "EN 6", color: "#2d873b", image: image("en-engine-6-floor-plan.png"), output: 110, stations: [{ x: 2, y: 0, mesh: 1 }, { x: 5, y: 2, mesh: 5 }, { x: 3, y: 5, mesh: 7 }, { x: 0, y: 3, mesh: 3 }] },
    "life-support": { width: 2, height: 2, label: "LIFE", color: "#16788a", image: image("life-support-floor-plan.png"), output: 0, stations: [] },
    "nutritional-supplement": { width: 1, height: 1, label: "NUT.", color: "#197a6f", image: image("nutritional-supplement-floor-plan.png"), output: 0, stations: [] },
  };

  const lockDice = [[2,4],[3,4],[2,6],[3,6],[2,8],[3,8],[2,10],[3,10],[2,12],[4,12]];
  const impairedLockDice = [[2,2],[3,2],[2,4],[3,4],[2,6],[3,6],[2,8],[3,8],[2,10],[2,12]];
  const lockSizes = [[1,1],[1,1],[1,1],[1,1],[2,1],[2,1],[2,1],[2,2],[2,2],[2,2]];
  const lockCraft = ['Paradon, 6 hrs','Argol, 10 hrs','Mirium, 16 hrs','Drakkonite, 2 days','Phazon, 3 days','Necronium, 3 days','Endernium, 1 week','Dark Phazon, 1 week','Infinium, 10 days','Aethion, 3 weeks'];
  for(let tier=1;tier<=10;tier++){
    const n=tier-1,type=`lock-on-${tier}`;
    catalog[type]={...catalog['lock-on-1'],name:`Lock-On System ${tier}`,label:`LO ${tier}`,tier,width:lockSizes[n][0],height:lockSizes[n][1],price:[560,1600,3300,4500,8000,22000,24000,68000,108000,236000][n],energyCost:[1,1,1,2,2,2,3,3,3,4][n],security:Math.ceil(tier/2),threshold:tier*3,crafting:lockCraft[n],cardNumber:tier<=8?`A-${36+tier}`:`B-${22+tier}`,lockDice:Array(lockDice[n][0]).fill(lockDice[n][1]),impairedLockDice:Array(impairedLockDice[n][0]).fill(impairedLockDice[n][1]),breakDifficulty:12+tier,extraTargetAu:[4,4,3,3,2,2,1,1,0,0][n],maxTargets:tier>=9?6:2,unlimitedTargets:tier>=9,image:image(`${type}-floor-plan.png`)};
  }
  for(let tier=1;tier<=5;tier++){
    const n=tier-1,type=`rapid-laser-${tier}`;
    catalog[type]={...catalog['rapid-laser-1'],name:`Rapid Laser ${tier}`,label:`RL ${tier}`,tier,width:1,height:tier>=3?2:1,price:[450,850,2200,4100,5300][n],energyCost:tier,security:[1,1,2,3,4][n],threshold:2+tier*2,crafting:['Crystilium, 4 hrs','Crystilium, 4 hrs','Drakkonite, 10 hrs','Xpidinium, 1 day','Ragnaron, 1 day'][n],cardNumber:tier<=3?`A-${99+tier}`:`B-${78+tier}`,damageDie:[4,6,8,10,12][n],fireAu:5,image:image(`${type}-sprite.png`),sprite:`${type}-sprite.png`};
  }

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

  const exhaustSizes = [[1, 1], [2, 1], [3, 2], [3, 2], [4, 2]];
  const exhaustCraft = ["Dianium, 2 hrs", "Xpidinium, 3 hrs", "Crystilium, 4 hrs", "Argol, 4 hrs", "Drakkonite, 6 hrs"];
  const exhaustColors = ["#8ce8ff", "#bf83ff", "#679dff", "#52edcb", "#ff6679"];
  for (let tier = 1; tier <= 5; tier++) {
    const type = `exhaust-thruster-${tier}`;
    catalog[type] = { ...catalog["exhaust-thruster-1"], name: `Exhaust Thruster ${tier}`, label: `ET ${tier}`,
      width: exhaustSizes[tier - 1][0], height: exhaustSizes[tier - 1][1], impulseBonus: tier, exhaust: -1 - tier,
      energyCost: tier * 2, price: tier * 200, security: Math.ceil(tier / 2) + 1, threshold: 8 + tier * 2,
      crafting: exhaustCraft[tier - 1], cardNumber: tier < 5 ? `A-${22 + tier}` : "B-13",
      image: image(`${type}-graphic.png`), sprite: `${type}-sprite.png`, color: exhaustColors[tier - 1], auBoost: tier, auCost: 4 };
    catalog[type].emitters = [ [[50,90,50]], [[27.5,86,32],[72.5,86,32]], [[22,88,36],[78,88,36]],
      [[25,84,32],[75,84,32]], [[27,90,32],[73,90,32]] ][tier - 1];
    const ionicType = `ionic-pulse-thruster-${tier}`;
    catalog[ionicType] = { ...catalog[type], name: `Ionic Pulse Thruster ${tier}`, label: `IP ${tier}`, ionic: true,
      exhaust: 0, energyCost: tier * 5, price: tier * 350, security: [2, 2, 3, 3, 4][tier - 1], threshold: 7 + tier,
      crafting: ["Paradon, 4 hrs", "Argol, 4 hrs", "Mirium, 5 hrs", "Drakkonite, 6 hrs", "Mirium, 8 hrs"][tier - 1],
      cardNumber: `B-${13 + tier}`, image: image(`${ionicType}-graphic.png`), sprite: `${ionicType}-graphic.png`, auCost: 2,
      emitters: tier === 1 ? [[50,80,42]] : [[26,80,32],[74,80,32]] };
  }

  const bridgeRows = [
    ["cockpit-2", "Cockpit 2", 1, 2, 1100, 1, 4, "Crystilium, 5 hrs", 25, "A-2", 7],
    ["bridge-1", "Bridge 1", 2, 3, 1000, 2, 4, "Paradon, 8 hrs", 30, "A-3", 6],
    ["bridge-2", "Bridge 2", 2, 4, 2250, 2, 5, "Mirium, 10 hrs", 35, "A-4", 6],
    ["bridge-3", "Bridge 3", 3, 5, 4000, 3, 5, "Drakkonite, 16 hrs", 40, "A-5", 5],
    ["bridge-4", "Bridge 4", 3, 6, 6500, 3, 5, "Phazon, 1 day", 45, "A-6", 5],
    ["bridge-5", "Bridge 5", 4, 7, 10000, 4, 6, "Necronium, 2 days", 50, "B-1", 4],
    ["bridge-6", "Bridge 6", 4, 8, 16000, 4, 6, "Endernium, 2 days", 55, "B-2", 4],
    ["bridge-7", "Bridge 7", 5, 10, 24250, 5, 7, "Dark Phazon, 3 days", 60, "B-3", 3],
    ["bridge-8", "Bridge 8", 5, 12, 40000, 5, 8, "Carmot, 2 hrs", 65, "B-4", 2],
  ];
  catalog['cockpit-1'].rebootSeconds = 8 * 12;
  function perimeterStations(width, height, count) {
    if(width===1&&height===1&&count===2)return [{x:0,y:0,mesh:0},{x:0,y:0,mesh:2}];
    const points = [{ x: 0, y: 0, mesh: 0 }, { x: width - 1, y: height - 1, mesh: 8 },
      { x: width - 1, y: 0, mesh: 2 }, { x: 0, y: height - 1, mesh: 6 }];
    for (let x = 1; x < width - 1; x++) points.push({ x, y: 0, mesh: 0 }, { x, y: height - 1, mesh: 8 });
    for (let y = 1; y < height - 1; y++) points.push({ x: 0, y, mesh: 0 }, { x: width - 1, y, mesh: 8 });
    return points.slice(0, count);
  }
  for (const [type, name, size, seats, price, energyCost, security, crafting, threshold, cardNumber, rebootRounds] of bridgeRows) {
    catalog[type] = { ...catalog["cockpit-1"], name, width: size, height: size, price, energyCost, security, crafting, threshold, cardNumber,
      rebootSeconds: rebootRounds * 12, label: `${type.startsWith("cockpit") ? "CP" : "BR"} ${type.split("-")[1]}`,
      image: image(`${type}-floor-plan.png`), stations: perimeterStations(size, size, seats) };
  }
  catalog["shield-1"] = { name: "Shield 1", width: 1, height: 1, label: "SH 1", color: "#277b62", image: image("shield-1-floor-plan.png"),
    shield: true, energyCost: 5, price: 1000, security: 1, crafting: "Paradon, 6 hrs", threshold: 2, cardNumber: "A-51", output: 0,
    shieldHp: 10, shieldReduction: 1, shieldRegeneration: 1, restabilizeSeconds: 120, restabilizeAu: 20, stations: [{ x: 0, y: 0, mesh: 0 }] };
  const shieldRows = [
    [2, 2, 2, 2400, 1, 'Argol, 10 hrs', 1, 2, 20, 'A-52'],
    [3, 2, 2, 3900, 2, 'Mirium, 16 hrs', 2, 2, 30, 'A-53'],
    [4, 3, 3, 6000, 2, 'Drakkonite, 2 days', 2, 3, 30, 'A-54'],
    [5, 3, 3, 9500, 3, 'Phazon, 3 days', 3, 3, 40, 'A-55'],
    [6, 4, 3, 14250, 3, 'Necronium, 3 days', 3, 4, 40, 'A-56'],
    [7, 4, 4, 21000, 4, 'Endernium, 1 week', 4, 4, 50, 'A-57'],
    [8, 4, 4, 32500, 4, 'Dark Phazon, 1 week', 4, 5, 60, 'A-58'],
    [9, 5, 4, 50000, 5, 'Carmot, 10 days', 5, 5, 70, 'B-36'],
    [10, 5, 5, 80500, 5, 'Infinium, 10 days', 6, 6, 80, 'B-37'],
  ];
  for (const [tier,size,seats,price,security,crafting,shieldReduction,shieldRegeneration,restabilizeAu,cardNumber] of shieldRows) {
    catalog[`shield-${tier}`] = { ...catalog['shield-1'], name:`Shield ${tier}`,width:size,height:size,label:`SH ${tier}`,
      image:image(`shield-${tier}-floor-plan.png`),energyCost:tier*5,price,security,crafting,threshold:tier*2,cardNumber,
      shieldHp:tier*10,shieldReduction,shieldRegeneration,restabilizeAu,stations:perimeterStations(size,size,seats) };
  }

  const sensorRows = [
    [1,150,1,1,1,1,'Ragnaron, 3 hrs',6,2,4,8,4,2,'A-31'],
    [2,675,1,2,1,1,'Crystilium, 4 hrs',9,2,6,10,6,4,'A-32'],
    [3,1600,2,2,1,1,'Mirium, 8 hrs',12,3,6,12,8,4,'A-33'],
    [4,3500,2,3,1,1,'Phazon, 16 hrs',15,2,8,14,10,6,'A-34'],
    [5,6300,3,3,2,1,'Drakkonite, 2 days',18,3,8,16,12,6,'A-35'],
    [6,15750,3,4,2,1,'Necronium, 3 days',21,3,10,18,15,8,'A-36'],
    [7,30800,4,4,2,1,'Dark Phazon, 1 week',24,4,10,20,16,8,'B-24'],
    [8,63000,4,5,2,2,'Infinium, 10 days',27,3,12,22,18,10,'B-25'],
    [9,127000,5,5,2,2,'Aethion, 3 weeks',30,4,12,24,20,10,'B-26'],
  ];
  for (const [tier,price,energyCost,security,width,height,crafting,threshold,diceCount,die,range,impairedRange,impairedDie,cardNumber] of sensorRows) {
    catalog[`sensors-${tier}`] = { name:`Sensors ${tier}`, sensor:true, tier, price, energyCost, security, width, height,
      crafting, threshold, diceCount, die, range, impairedRange, impairedDie, cardNumber, output:0, stations:[],
      label:`SN ${tier}`, color:'#267f89', image:image(`sensors-${tier}-floor-plan.png`) };
  }

  function definition(type) {
    return catalog[type] || { width: 1, height: 1, label: type || "SIC", color: "#197a6f", image: "", output: 0, stations: [] };
  }

  function componentDefinition(item) {
    const entry = definition(item?.type);
    let { width, height } = entry, stations = entry.stations;
    // New purchases use corners; old saves retain their station coordinates and occupants.
    if (item?.stationLayout === "corners-v1" && stations.length) {
      stations = perimeterStations(width, height, stations.length);
    }
    if (Number(item?.rotation) % 180 === 90) {
      stations = stations.map(s => ({ x: height - 1 - s.y, y: s.x, mesh: s.mesh % 3 * 3 + 2 - Math.floor(s.mesh / 3) }));
      [width, height] = [height, width];
    }
    return { ...entry, width, height, stations };
  }

  function exteriorPlacement(ship, type, origin, ignoreId = "") {
    const item = (ship.sicInventory || []).find(item => item.id === ignoreId);
    const entry = item ? componentDefinition(item) : definition(type), hull = new Set(ship.gridCells || []), cells = [];
    if (!Number.isInteger(origin) || origin < 0 || origin >= 400 || origin % 20 + entry.width > 20 || Math.floor(origin / 20) + entry.height > 20) return false;
    for (let y = 0; y < entry.height; y++) for (let x = 0; x < entry.width; x++) cells.push(origin + y * 20 + x);
    if (cells.some(cell => hull.has(cell))) return false;
    // Flood from the construction boundary: enclosed holes are not outer space.
    const outside = new Set(), queue = [];
    for (let cell = 0; cell < 400; cell++) if ((cell < 20 || cell >= 380 || cell % 20 === 0 || cell % 20 === 19) && !hull.has(cell)) { outside.add(cell); queue.push(cell); }
    for (let i = 0; i < queue.length; i++) for (const side of SIDES) {
      const cell = queue[i], next = cell + side.offset;
      if (side.valid(cell) && !hull.has(next) && !outside.has(next)) { outside.add(next); queue.push(next); }
    }
    if (cells.some(cell => !outside.has(cell))) return false;
    if (!cells.some(cell => SIDES.some(side => side.valid(cell) && hull.has(cell + side.offset)))) return false;
    const occupied = buildLayout(ship).footprint;
    return !cells.some(cell => occupied.has(cell) && occupied.get(cell).sicId !== ignoreId);
  }

  function propulsion(record) {
    const ship = record.ship || record, count = new Set(ship.gridCells || []).size;
    const limits = [4,5,6,7,8,9,10,11,12,13,14,16,18,20,23,26,30,34,40,50,70,90,100,120,150,200,250,300,350,400];
    const index = limits.findIndex(limit => count <= limit);
    const hsm = count < 4 ? 0 : index < 0 ? -10 - Math.floor((count - 401) / 50) : 20 - index;
    const inventory = new Map((ship.sicInventory || []).map(item => [item.id, item]));
    const thrusters = (ship.placements || []).map(p => ({ item: inventory.get(p.sicId), p })).filter(({item,p}) => item && definition(item.type).thruster && !item.disabled && !["destroyed","offline","powered-down"].includes(item.status) && exteriorPlacement(ship,item.type,p.cell,item.id)).slice(0,4);
    const impulses = thrusters.map(({item}) => Math.trunc(hsm / 2) + definition(item.type).impulseBonus);
    const rawSpeed = impulses.reduce((a,b) => a+b,0), moveSpeed = Math.max(0,rawSpeed);
    return { hsm, impulses, rawSpeed, moveSpeed, exhaust: thrusters.reduce((n,{item}) => n + definition(item.type).exhaust,0), evadeCount: thrusters.filter(({item}) => !item.impaired && item.status !== "impaired").length, evadeDie: moveSpeed < 4 ? 4 : moveSpeed < 8 ? 6 : moveSpeed < 12 ? 8 : moveSpeed < 16 ? 10 : 12 };
  }

  function exteriorError(ship = {}) {
    ship ||= {};
    if (['gridCells','sicInventory','placements'].some(key => ship[key] !== undefined && !Array.isArray(ship[key]))) return "Invalid starship construction data.";
    if ((ship.sicInventory || []).some(item => !item || typeof item !== 'object') || (ship.placements || []).some(item => !item || typeof item !== 'object')) return "Invalid starship component data.";
    const inventory = ship.sicInventory || [];
    const installed = new Set((ship.placements || []).map(p => p.sicId));
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).bridge).length > 1) return "A ship may have only one Bridge or Cockpit.";
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).sensor).length > 1) return "A ship may have only one installed Sensor system.";
    if (inventory.filter(item => installed.has(item.id) && definition(item.type).thruster).length > 4) return "A ship may have at most four installed thrusters.";
    for (const p of ship.placements || []) {
      const item = inventory.find(item => item.id === p.sicId);
      if (item && definition(item.type).edge && !componentAtEdge(ship, p.cell, item)) return `${definition(item.type).name} must be inside the ship, against an outer hull wall.`;
      if (item && definition(item.type).exterior && !exteriorPlacement(ship, item.type, p.cell, item.id)) return "Exterior SICs must attach to an outer hull wall, outside the ship and clear of other SICs.";
    }
    return "";
  }

  function edgePlacement(ship, cell) {
    const hull = new Set(ship.gridCells || []);
    if (!Number.isInteger(cell) || !hull.has(cell)) return false;
    const queue = SIDES.filter(s => !s.valid(cell) || !hull.has(cell+s.offset));
    if (queue.some(s=>!s.valid(cell))) return true;
    const frontier = queue.map(s=>cell+s.offset), seen = new Set(frontier);
    for (let i=0;i<frontier.length;i++) for (const side of SIDES) {
      const current=frontier[i], next=current+side.offset;
      if (!side.valid(current)) return true;
      if (!hull.has(next) && !seen.has(next)) {seen.add(next);frontier.push(next);}
    }
    return false;
  }

  function componentAtEdge(ship, origin, item) {
    const { width, height } = componentDefinition(item), hull = new Set(ship.gridCells || []), cells = [];
    if (!Number.isInteger(origin) || origin < 0 || origin % 20 + width > 20 || Math.floor(origin / 20) + height > 20) return false;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push(origin + y * 20 + x);
    return cells.every(cell => hull.has(cell)) && cells.some(cell => edgePlacement(ship, cell));
  }

  function sensorStats(record) {
    const ship = record.ship || record, ids = new Set((ship.placements || []).map(p => p.sicId));
    const item = (ship.sicInventory || []).find(i => ids.has(i.id) && definition(i.type).sensor && !i.disabled && !['offline','powered-down','destroyed'].includes(i.status));
    if (!item) return {range:0,diceCount:0,die:0};
    const def = definition(item.type), impaired = item.impaired || item.status === 'impaired';
    return {range:impaired ? def.impairedRange : def.range,diceCount:def.diceCount,die:impaired ? def.impairedDie : def.die};
  }

  function masking(record) {
    const ship = record.ship || record, installed = new Set((ship.placements || []).map(p => p.sicId));
    const darkveil = Math.max(0, ...(ship.sicInventory || []).filter(item => installed.has(item.id) && !item.disabled && !item.impaired && !["destroyed", "offline", "powered-down", "impaired"].includes(item.status)).map(item => Number(definition(item.type).darkveil) || 0));
    const stats = propulsion(record);
    return stats.hsm + stats.exhaust + darkveil;
  }

  function floorplanStyle(type, column = 0, row = 0) {
    const entry = definition(type);
    if (!entry.image) return "";
    const x = entry.width === 1 ? 50 : (Number(column) / (entry.width - 1)) * 100;
    const y = entry.height === 1 ? 50 : (Number(row) / (entry.height - 1)) * 100;
    return `background-image:url('${entry.image}');background-size:${entry.width * 100}% ${entry.height * 100}%;background-position:${x}% ${y}%;background-repeat:no-repeat`;
  }

  function exteriorFacing(layout, square) {
    // The mount faces the neighboring hull; the exhaust points the opposite way.
    const sic = layout.footprint.get(square);
    const cells = sic ? [...layout.footprint].filter(([, other]) => other.sicId === sic.sicId).map(([cell]) => cell) : [square];
    const side = SIDES.map(side => ({ ...side, contacts: cells.filter(cell => side.valid(cell) && layout.hull.has(cell + side.offset)).length }))
      .sort((a, b) => b.contacts - a.contacts).find(side => side.contacts);
    return { top: 0, right: 90, bottom: 180, left: 270 }[side?.name] ?? 0;
  }

  function surfaceMarkup(layout, square) {
    if (layout.hull.has(square)) {
      const edges = SIDES.filter(side => !side.valid(square) || !layout.hull.has(square + side.offset)).map(side => `edge-${side.name}`).join(" ");
      const cell=layout.footprint.get(square),def=cell&&definition(cell.type);
      const canopy=def?.bridge?`<span class="sa-bridge-window" style="background-image:url('${def.image}');background-size:${cell.width*100}% ${cell.height*100}%;background-position:${cell.width>1?cell.column/(cell.width-1)*100:0}% ${cell.height>1?cell.row/(cell.height-1)*100:0}%"></span>`:'';
      const offline=cell&&(cell.item.disabled||['offline','powered-down','destroyed'].includes(cell.item.status));
      const status=offline?`<span class="sa-offline-shade"></span>${cell.offset===0?`<span class="sa-reboot-status">${cell.item.bootRemaining>0?`Restart ${Math.ceil(cell.item.bootRemaining)}s`:'OFFLINE'}</span>`:''}`:'';
      return `${status}${cell?.blocked?'<span class="sa-blocked-floor" aria-hidden="true"></span>':''}<span class="sa-hull-plate ${edges}" style="--plate-x:${square % 20 % 2 * 100}%;--plate-y:${Math.floor(square / 20) % 2 * 100}%" aria-hidden="true">${canopy}</span>`;
    }
    const sic = layout.footprint.get(square);
    if (!sic?.exterior) return "";
    if (sic.offset) return '<span class="sa-exterior-tile" aria-hidden="true"></span>';
    const data = definition(sic.type), angle = exteriorFacing(layout, square), sideways = angle % 180 !== 0;
    const active = !sic.item.disabled && !["destroyed", "offline", "powered-down"].includes(sic.item.status);
    if (data.weapon) return `<span class="sa-exterior-weapon" style="position:absolute;left:0;top:0;width:${sic.width*100}%;height:${sic.height*100}%;opacity:${active ? 1 : .35}" aria-hidden="true"><span style="position:absolute;left:50%;top:50%;width:${sideways?sic.height/sic.width*100:100}%;height:${sideways?sic.width/sic.height*100:100}%;transform:translate(-50%,-50%) rotate(${angle+180}deg)"><img src="${data.sprite}" style="width:100%;height:100%;object-fit:contain" alt="" draggable="false"></span></span>`;
    const jetClass = data.ionic ? "sa-ion-pulse" : "sa-thruster-flame";
    // Emission points are measured in the sprite frame, then transformed with the complete assembly.
    const jets = (data.emitters || []).map(([x,y,width], index) => `<i class="${jetClass}" style="left:${8 + .84 * (x - width / 2)}%;top:${-2 + .76 * y}%;width:${.84 * width}%;animation-delay:${index * -.8}s"></i>`).join("");
    return `<span class="sa-exterior-thruster ${active ? "is-firing" : ""}" style="width:${sic.width * 100}%;height:${sic.height * 100}%;--thruster-angle:${angle}deg;--assembly-width:${sideways ? sic.height / sic.width * 100 : 100}%;--assembly-height:${sideways ? sic.width / sic.height * 100 : 100}%;--exhaust-color:${data.color}" aria-hidden="true"><span class="sa-thruster-assembly"><i class="sa-thruster-body"></i><img src="${data.sprite}" alt="" draggable="false">${jets}</span></span>`;
  }

  const VIEW_LABELS = Object.freeze({ labels: "Labels", highResolution: "High Res", combatMesh: "Combat Mesh", walls: "Walls", stations: "Stations", hull: "Hull" });
  function viewDisabled(view, key) { return Boolean(view.hull && ["combatMesh", "walls", "stations"].includes(key)); }
  function viewControls(view, attribute) {
    return Object.entries(VIEW_LABELS).map(([key, label]) => `<label><input type="checkbox" ${attribute}="${key}" ${view[key] && !viewDisabled(view, key) ? "checked" : ""} ${viewDisabled(view, key) ? "disabled" : ""}> <span>${label}</span></label>`).join("");
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
      const entry = componentDefinition(item);
      const origin = Number(placement.cell);
      const originRow = Math.floor(origin / GRID_SIZE);
      const originColumn = origin % GRID_SIZE;
      for (let row = 0; row < entry.height; row += 1) for (let column = 0; column < entry.width; column += 1) {
        const square = (originRow + row) * GRID_SIZE + originColumn + column;
        const label=entry.name||type.replace(/^en-engine/,'Power Engine').replace(/^au-engine/,'Action Engine').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
        footprint.set(square, { placement, item, sicId: placement.sicId, type, exterior: Boolean(entry.exterior), width: entry.width, height: entry.height, label, color: entry.color, image: entry.image, stations: entry.stations || [], offset: row * entry.width + column, row, column, blocked: Boolean(entry.exterior) || blocksMovement(type, entry.width, entry.height, column, row) });
      }
    }

    const bestConnections = new Map();
    for (const [square, current] of footprint) {
      for (const side of SIDES.filter((entry) => entry.name === "right" || entry.name === "bottom")) {
        if (!side.valid(square)) continue;
        const adjacent = square + side.offset;
        const other = footprint.get(adjacent);
        if (!other || current.exterior || other.exterior || other.sicId === current.sicId) continue;
        const currentCross = side.name === "right" ? current.row : current.column;
        const otherCross = side.name === "right" ? other.row : other.column;
        const currentSize = side.name === "right" ? current.height : current.width;
        const otherSize = side.name === "right" ? other.height : other.width;
        const stationPenalty = room => room.stations.some(s => s.x === room.column && s.y === room.row) ? 10 : 0;
        const score = Math.abs(currentCross - (currentSize - 1) / 2) + Math.abs(otherCross - (otherSize - 1) / 2) + stationPenalty(current) + stationPenalty(other);
        const pair = [current.sicId, other.sicId].sort().join(":");
        const key = doorKey(square, adjacent);
        const previous = bestConnections.get(pair);
        if (!previous || score < previous.score || (score === previous.score && key < previous.key)) bestConnections.set(pair, { key, score });
      }
    }
    const connectionDoors = new Set([...bestConnections.values()].map((entry) => entry.key));
    const hallwayDoors = new Map();
    for (const [square, room] of footprint) {
      if (room.exterior) continue;
      for (const side of SIDES) {
        const adjacent = square + side.offset;
        if (!side.valid(square) || !hull.has(adjacent) || footprint.has(adjacent)) continue;
        const horizontal = side.name === "top" || side.name === "bottom";
        const cross = horizontal ? room.column : room.row, size = horizontal ? room.width : room.height;
        const station = room.stations.some(s => s.x === room.column && s.y === room.row);
        const score = Math.abs(cross - (size - 1) / 2) + (station ? 10 : 0);
        const group = `${room.sicId}:${side.name}`, previous = hallwayDoors.get(group);
        if (!previous || score < previous.score) hallwayDoors.set(group, { square, score });
      }
    }

    function boundary(square, sideName) {
      if (!hull.has(Number(square))) return { kind: "none", side: sideName, key: "" };
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
      const centered = hallwayDoors.get(`${current.sicId}:${sideName}`)?.square === Number(square);
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

  return Object.freeze({ ASSET_VERSION, GRID_SIZE, SIDES, catalog: Object.freeze(catalog), definition, componentDefinition, floorplanStyle, doorKey, blocksMovement, buildLayout, boundaryMarkup, image, exteriorPlacement, exteriorError, edgePlacement, componentAtEdge, propulsion, masking, sensorStats, exteriorFacing, surfaceMarkup, viewDisabled, viewControls });
}));
