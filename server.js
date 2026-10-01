const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { CampaignStore } = require("./campaign-store");
const { CampaignApi } = require("./campaign-api");
const { resolvePublicAsset } = require("./public-assets");
const {
  applyNpcSimplifiedStats,
  combatEventTimes,
  completeStagedAttack,
  effectiveSpeed,
  hasCombatCountdown,
  hasTimedAction,
  migrateUnitCombat,
  normalizeWeaponRows,
  cancelTimedActionForForcedDelay,
  resolvePlayerCombatAction,
  syncUnitCombat,
  tickCombatTimers,
} = require("./combat-engine");
const combatRules = require("./combat-rules");
const shipPower = require("./ship-power");
const shipNavigation = require("./ship-navigation");
const shipShields = require("./ship-shields");
const shipSensors = require("./ship-sensors");
const shipLocks = require('./ship-locks');
const shipWeapons = require("./ship-weapons");
const shipTransit = require('./ship-transit');
const shipMissiles=require('./ship-missiles'),shipTargets=require('./ship-targets');
const crewRooms=require('./ship-crew-rooms'),shipAi=require('./ship-ai');
const shipCleanser=require('./ship-cleanser');
const transitPending = room => shipCleanser.pending(room)|| crewRooms.pending(room)||shipMissiles.pending(room)||room.starships.some(s=>s.ship.destructState?.phase==='blastPending');
const transitBoundary = room => Math.min(shipCleanser.nextEvent(room),shipProbes.nextEvent(room),shipSensors.nextEvent(room),shipDrones.nextEvent(room),require('./ship-breach-drones').nextEvent(room),crewRooms.nextEvent(room),shipMissiles.nextEvent(room),...room.starships.flatMap(s=>[s.ship.warpState?.phase==='activating'?s.ship.warpState.remaining:Infinity,s.ship.destructState?.phase==='countdown'?s.ship.destructState.remaining:Infinity]));

function transitEvents(room, events) {
  for(const event of events||[]){
    const ship=room.starships.find(s=>s.id===event.shipId);if(!ship)continue;
    if(event.kind==='warpDeparted'){
      let releaseSource;
      ship.escapedAt=new Date().toISOString();
      ship.navigation=null;ship.auCommands=[];
      if(ship.commandSystems)ship.commandSystems.armed=null;
      for(const unit of room.units.filter(u=>u.location?.starshipId===ship.id)){
        unit.escapedAt=ship.escapedAt;unit.defeatedAt=Date.now();unit.atb=0;unit.delayedAction=null;unit.delayTimer=null;unit.timedAction=null;unit.consoleHold=null;unit.pendingShipRolls=[];unit.pendingTimedResolutions=[];unit.queuedEffects=[];unit.thrownEffects=[];
        const affectedItem=removeUnitFromCombatObjects(room,unit.id),affectedAction=room.activeAction?.unitId===unit.id,affectedAttack=room.attackResolution&&[room.attackResolution.attackerId,room.attackResolution.defenderId].includes(unit.id);
        if(affectedAction)room.activeAction=null;
        if(room.delayRequest?.unitId===unit.id)clearDelayRequest(room);
        if(affectedAttack){room.attackResolution=null;clearAttackCommand(room);}
        if(room.activeId===unit.id||affectedItem||affectedAction||affectedAttack){releaseSource=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);}
      }
      if(releaseSource!==undefined)moveToNextTurnOrClock(room,releaseSource);
      pushLog(room,`${ship.title} escaped into warp.`,{starshipId:ship.id});
    }else if(event.kind==='needsBlastRoll')pushLog(room,`${ship.title}: awaiting manual ${event.diceCount}D12 self-destruct damage.`,{starshipId:ship.id});
    else if(event.kind==='destructExploded'){
      for(const id of [ship.id,...event.targetIds]){
        const target=room.starships.find(s=>s.id===id);if(!target)continue;
        shipSensors.knowledge(target).reports.unshift({id:`${event.id}-${id}`,at:new Date().toISOString(),targetId:id,impact:true,hit:true,damage:event.total,text:`Self-destruct blast: ${event.total} damage rolled.`});
      }
      pushLog(room,`${ship.title} self-destructed.`,{starshipId:ship.id});
    }else pushLog(room,`${ship.title}: ${event.report?.reason||event.kind.replace(/([A-Z])/g,' $1')}.`,{starshipId:ship.id});
  }
}
const shipCommands = require("./ship-commands");
const shipMaintenance = require("./ship-maintenance");
const shipHacking = require('./ship-hacking');
const shipOxygen = require('./ship-oxygen');
const shipDrones = require('./ship-drones');
const shipProbes = require('./ship-probes');
const hackingPractice = require('./hacking-practice').createPracticeService();
const shipDistances = require("./ship-distances");
const shipMapCore = require("./ship-map-core");
const { validatePreparation, preparationFingerprint } = require("./encounter-preparation");

const PORT = Number(process.env.PORT || 8790);
const HOST = "0.0.0.0";
const PUBLIC_DIR = __dirname;

const rooms = new Map();
const clients = new Map();
const pendingBroadcasts = new WeakMap();
const roomPersistTimers = new Map();
const roomPersistWrites = new Map();
const roomPreparations = new Map();
const roomActionQueues = new Map();
const npcDefeatTimers = new Map();
const campaignStore = new CampaignStore();
let campaignApi = null;
let stateSequence = 0;
const stateEpoch = require('node:crypto').randomUUID();
const HEARTBEAT_MS = 25000;
const NPC_HP_DEFAULTS = new Map([
  ["Security Guard", 36], ["Space Slug", 24], ["Civilian", 20],
  ["Chief Security Guard", 45], ["Thug", 30], ["Purple Alien", 40],
  ["Mini Boss", 60], ["Robot Sentry", 54], ["Cyber Ninja", 48], ["Final Boss", 80],
]);

function ensureNpcHp(unit) {
  if (!unit || unit.team !== "npc") return;
  const fallback = NPC_HP_DEFAULTS.get(unit.characterName) || 30;
  if (!Number.isFinite(Number(unit.maximumHp)) || Number(unit.maximumHp) < 1) unit.maximumHp = fallback;
  if (unit.currentHp === null || unit.currentHp === undefined || !Number.isFinite(Number(unit.currentHp))) unit.currentHp = unit.maximumHp;
  unit.currentHp = Math.max(0, Math.min(unit.maximumHp, Number(unit.currentHp)));
}

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function normalizeEncounterStarships(value) {
  return (Array.isArray(value) ? value : []).slice(0, 24).map((record) => {
    const ship = record?.ship && typeof record.ship === "object" ? record.ship : {};
    const gridCells = [...new Set((Array.isArray(ship.gridCells) ? ship.gridCells : [])
      .map(Number).filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < shipMapCore.gridColumns(ship) * shipMapCore.gridRows(ship)))];
    const placements = (Array.isArray(ship.placements) ? ship.placements : []).slice(0, 400).flatMap((entry) => {
      const cell = Number(entry?.cell);
      const item = ship.sicInventory?.find(item => item.id === entry.sicId), type=item?.type;
      if(item&&shipMapCore.definition(type).hullSystem)return gridCells.length?[{sicId:String(entry.sicId).slice(0,120),cell:gridCells.includes(cell)?cell:gridCells[0]}]:[];
      if(item&&shipMapCore.definition(type).multiMount){
        return shipMapCore.multiMountPlacement(ship,item,entry.mountCells)?[{sicId:String(entry.sicId).slice(0,120),cell:entry.mountCells[0],mountCells:[...entry.mountCells]}]:[];
      }
      if (!item || !Number.isInteger(cell) || (shipMapCore.definition(type).mixed ? !shipMapCore.mixedPlacement(ship,item,cell,entry.exteriorCell) : (!gridCells.includes(cell) && !(shipMapCore.definition(type).exterior && shipMapCore.exteriorPlacement(ship,type,cell,entry.sicId))))) return [];
      return [{ sicId: String(entry.sicId || "").slice(0, 120), cell, ...(Number.isInteger(entry.exteriorCell)?{exteriorCell:entry.exteriorCell}:{}) }];
    });
    const sicInventory = (Array.isArray(ship.sicInventory) ? ship.sicInventory : []).slice(0, 400).map((entry) => ({
      attachTo: entry?.attachTo?String(entry.attachTo).slice(0,120):undefined, purchasePrice: entry?.purchasePrice,
      id: String(entry?.id || "").slice(0, 120),
      type: String(entry?.type || "").slice(0, 80),
      status: String(entry?.status || "").slice(0, 40),
      blueprintType:entry?.type==='blueprint'?String(entry.blueprintType||'').slice(0,80):undefined,printed:Boolean(entry?.printed),printedFor:entry?.printedFor?String(entry.printedFor).slice(0,120):null,
      impaired: Boolean(entry?.impaired),
      impairmentPoints: Math.max(0,Math.min(4,Number(entry?.impairmentPoints)||0)),
      repairDifficulty: Math.max(10,Number(entry?.repairDifficulty)||10),
      bootRemaining: Math.max(0,Number(entry?.bootRemaining)||0),
      unstable: Boolean(entry?.unstable),
      disabled: Boolean(entry?.disabled),
      rotation: [0,90,180,270].includes(Number(entry?.rotation))?Number(entry.rotation):0,
      weaponFacing: [0,90,180,270].includes(entry?.weaponFacing)?entry.weaponFacing:undefined,
      exteriorRotation: [0,90,180,270].includes(Number(entry?.exteriorRotation))?Number(entry.exteriorRotation):0,
      bayWidth: entry?.type==='docking-bay'?Math.max(2,Math.min(60,Math.floor(Number(entry.bayWidth)||2))):undefined,
      bayHeight: entry?.type==='docking-bay'?Math.max(2,Math.min(60,Math.floor(Number(entry.bayHeight)||2))):undefined,
      brigWidth: entry?.type==='brig'?Math.max(1,Math.min(60,Math.floor(Number(entry.brigWidth)||1))):undefined,
      brigHeight: entry?.type==='brig'?Math.max(1,Math.min(60,Math.floor(Number(entry.brigHeight)||1))):undefined,
      stationLayout: entry?.stationLayout === "corners-v1" ? "corners-v1" : undefined,
      storage: Boolean(entry?.storage),
    }));
    const doorStates = {};
    for (const [key, state] of Object.entries(ship.doorStates && typeof ship.doorStates === "object" ? ship.doorStates : {})) {
      if (/^\d{1,4}:\d{1,4}$/.test(key)) doorStates[key] = state === "open" ? "open" : "closed";
    }
    return {
      id: String(record?.id || ship.id || "").slice(0, 120),
      title: String(record?.title || ship.title || "Starship").slice(0, 100),
      maximumHullHp: Math.max(0, Number(record.maximumHullHp ?? ship.maximumHullHp ?? shipMapCore.hullHp(ship)) || 0),
      currentHullHp: Math.max(0, Number(record.currentHullHp ?? ship.currentHullHp ?? record.maximumHullHp ?? ship.maximumHullHp ?? shipMapCore.hullHp(ship)) || 0),
      maximumShieldHp: Math.max(0, Number(record.maximumShieldHp ?? ship.maximumShieldHp) || 0),
      currentShieldHp: Math.max(0, Number(record.currentShieldHp ?? ship.currentShieldHp ?? record.maximumShieldHp ?? ship.maximumShieldHp) || 0),
      controlType: record?.controlType === "gm" ? "gm" : "pc",
      crewCharacterIds: (Array.isArray(record?.crewCharacterIds) ? record.crewCharacterIds : []).slice(0, 80).map((idValue) => String(idValue).slice(0, 120)),
      crewNpcUnitIds: (Array.isArray(record?.crewNpcUnitIds) ? record.crewNpcUnitIds : record?.ship?.crewNpcUnitIds || []).slice(0,100).map(String),
      escapedAt:record.escapedAt||null,
      ship: { triangleCells:shipMapCore.triangleCells(ship), ...Object.fromEntries(['airlocks','airlockStates','breachState','breachDroneState','encounterState','extractionState','salvagedAt','blackHoleGunState','fabricationState','devastationState','cleanserState','atmosphereState','cloakState','gravityFieldState','mapColor','mapHeading','warpState','destructState','warpFuel','minerals','transitReceipts','missileState','missileAmmo','missileStorage','crewRoomState','fieldState','droneState','probeState','surveillanceState','doorDamage','transporterState','intruderState'].map(key=>[key,clone(ship[key]??null)])),gridCells, placements, sicInventory, doorStates, oxygenEnabled:ship.oxygenEnabled!==false,oxygenState:clone(ship.oxygenState||null),gravityEnabled:ship.gravityEnabled!==false, zoneColumns:shipMapCore.gridColumns(ship),zoneRows:shipMapCore.gridRows(ship),thrusterDirection:[0,90,180,270].includes(ship.thrusterDirection)?ship.thrusterDirection:null, affiliation:String(ship.affiliation || '').slice(0,100),
        class:String(ship.class || '').slice(0,100),
        defenseScore:Number.isFinite(ship.defenseScore) ? ship.defenseScore : undefined },
      auState: record?.auState ? { current: record.auState.current, progress: record.auState.progress } : null,
    };
  }).filter((record) => record.id);
}

function createRoom(requestedCode = "", snapshot = null, register = true) {
  let code = String(requestedCode || "").trim().toUpperCase() || roomCode();
  while (!requestedCode && rooms.has(code)) code = roomCode();
  const room = {
    roomCode: code,
    encounterId: snapshot?.encounterId || require("node:crypto").randomUUID(),
    running: false,
    pausedForTurn: false,
    resumeAfterTurn: false,
    activeId: null,
    activeAction: null,
    attackResolution: null,
    itemResolution: null,
    vehicles: [],
    areaEffects: [],
    activeSource: null,
    commandDeadline: null,
    commandTotal: 0,
    commandExpired: false,
    hardPaused: false,
    holdPaused: false,
    holdStartedAt: null,
    commandHeldRemaining: null,
    lastInterruptedId: null,
    lastInterruptedAt: 0,
    lastKeepAliveAt: Date.now(),
    encounterEndedAt: null,
    lastTick: Date.now(),
    delayRequest: null,
    hasEngagedClock: false,
    threshold: 100,
    starships: [],
    hackingPrivate: {secrets:{},sessions:[],receipts:[]},
    units: [],
    log: [],
    undoSnapshot: null,
    undoLabel: "",
    lastPersistRequestAt: 0,
    preparations: [],
  };
  if (snapshot && typeof snapshot === "object") {
    room.running = Boolean(snapshot.running);
    room.pausedForTurn = Boolean(snapshot.pausedForTurn);
    room.resumeAfterTurn = Boolean(snapshot.resumeAfterTurn);
    room.activeId = snapshot.activeId || null;
    room.activeAction = clone(snapshot.activeAction);
    room.attackResolution = restoreAttackResolution(snapshot.attackResolution);
    room.itemResolution = snapshot.itemResolution ? clone(snapshot.itemResolution) : null;
    room.vehicles = Array.isArray(snapshot.vehicles) ? clone(snapshot.vehicles) : [];
    room.areaEffects = Array.isArray(snapshot.areaEffects) ? clone(snapshot.areaEffects) : [];
    room.activeSource = snapshot.activeSource || null;
    room.commandDeadline = snapshot.commandRemaining === null || snapshot.commandRemaining === undefined
      ? null
      : Date.now() + Math.max(0, Number(snapshot.commandRemaining) || 0) * 1000;
    room.commandTotal = Math.max(0, Number(snapshot.commandTotal) || 0);
    room.commandExpired = Boolean(snapshot.commandExpired);
    room.hardPaused = Boolean(snapshot.hardPaused);
    room.holdPaused = Boolean(snapshot.holdPaused);
    room.holdStartedAt = snapshot.holdPaused ? Date.now() : null;
    room.commandHeldRemaining = snapshot.commandHeldRemaining === null || snapshot.commandHeldRemaining === undefined
      ? null
      : Math.max(0, Number(snapshot.commandHeldRemaining) || 0);
    room.lastInterruptedId = snapshot.lastInterruptedId || null;
    room.lastInterruptedAt = Number(snapshot.lastInterruptedAt) || 0;
    room.encounterEndedAt = snapshot.encounterEndedAt || null;
    room.delayRequest = clone(snapshot.delayRequest);
    room.hasEngagedClock = Boolean(snapshot.hasEngagedClock);
    room.sensorMode = Boolean(snapshot.sensorMode);
    room.hackingPrivate = clone(snapshot.hackingPrivate || {secrets:{},sessions:[],receipts:[]});
    room.threshold = Math.max(1, Number(snapshot.threshold) || 100);
    room.starships = normalizeEncounterStarships(snapshot.starships);
    room.starships.forEach(ship => {
      const saved = snapshot.starships?.find(s => s.id === ship.id);
      for (const key of ['auState', 'navigation', 'shieldSystems', 'auCommands', 'shieldReceipts', 'sensorState', 'weaponState', 'lockState', 'destroyedAt', 'escapedAt', 'victoryAt', 'sensorScenarioMasking', 'commandSystems', 'maintenanceReceipts']) ship[key] = clone(saved?.[key] ?? null);
    });
    room.planetaryEvent = clone(snapshot.planetaryEvent||null);
    room.cleanserScars = clone(snapshot.cleanserScars||[]);
    room.spaceObjects = clone(snapshot.spaceObjects||[]);
    room.shipPositions = shipDistances.positions(room.starships, snapshot.shipPositions);
    room.shipDistances = shipDistances.fromPositions(room.starships, room.shipPositions);
    room.units = Array.isArray(snapshot.units) ? clone(snapshot.units) : [];
    for (const unit of room.units) unit.playerConnected = Boolean(unit.playerConnected);
    room.log = Array.isArray(snapshot.log) ? clone(snapshot.log).slice(-80) : [];
    room.preparations = clone(snapshot.preparations || []);
    room.running = false;
    room.hardPaused = true;
  }
  if (register) {
    rooms.set(code, room);
    clients.set(code, new Set());
  }
  for (const unit of room.units) if (unit.defeatedAt) syncNpcDefeat(room, unit);
  pushLog(room, snapshot ? `Campaign encounter ${code} restored in a paused state.` : `Room ${code} created.`);
  return room;
}

function getRoom(code) {
  return rooms.get(String(code || "").trim().toUpperCase());
}

async function ensureCampaignRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const existing = getRoom(normalized);
  if (existing) return existing;
  if (!campaignApi) return null;
  const campaign = await campaignApi.campaign(normalized);
  if (!campaign || campaign.interfaceVersion==='0.3'&&!campaign.roomOpen) return null;
  return createRoom(normalized, campaign.encounter);
}

function scheduleRoomPersist(room, delay = 250) {
  if (!campaignApi || !room?.roomCode || roomPreparations.has(room.roomCode)) return;
  clearTimeout(roomPersistTimers.get(room.roomCode));
  roomPersistTimers.set(room.roomCode, setTimeout(async () => {
    if (getRoom(room.roomCode) !== room) return;
    roomPersistTimers.delete(room.roomCode);
    try {
      const write = campaignApi.saveEncounter(room.roomCode, snapshotRoom(room));
      roomPersistWrites.set(room.roomCode, write);
      await write;
      if (roomPersistWrites.get(room.roomCode) === write) roomPersistWrites.delete(room.roomCode);
    } catch (error) {
      console.error(`Could not persist encounter ${room.roomCode}:`, error.message);
    }
  }, delay));
}

function publicState(room) {
  for(const message of require('./ship-breaches').reconcile(room,campaignApi?.campaignCache.get(room.roomCode)))pushLog(room,message);
  require('./crew-carry').sync(room);
  require('./ship-field-utilities').advance(room,0);
  shipAi.sync(room,preparedUnit);
  require('./station-access').adjustInputs(room);
  const crewCampaign=campaignApi?.campaignCache.get(room.roomCode);
  if(crewRooms.reconcile(room,crewCampaign)){scheduleRoomPersist(room,0);moveToNextTurnOrClock(room,room.activeSource||'clock');}
  for(const unit of room.units.filter(u=>u.shipAi&&u.defeatedAt)){unit.delayedAction=null;unit.pendingShipRolls=[];unit.delayTimer=null;unit.consoleHold=null;if(room.activeId===unit.id){room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);moveToNextTurnOrClock(room,room.activeSource||'clock');}}
  shipDrones.reconcile(room);require('./ship-breach-drones').reconcile(room);shipProbes.reconcile(room);
  const missileCancelled=shipMissiles.reconcile(room),damageCancelled=recordShipReports(room,()=>shipWeapons.cancelUnavailableDamage(room));
  if(missileCancelled||damageCancelled){scheduleRoomPersist(room,0);moveToNextTurnOrClock(room,room.activeSource||'clock');}
  for (const unit of room.units) if (unit.team !== 'npc') syncNpcDefeat(room, unit);
  for(const unit of room.units){
    const pending=unit.delayedAction;
    if(pending?.sensorOrder&&!pending.automaticNotice&&['area','hex','analysis'].includes(pending.sensorOrder.kind)){
      const auto=shipSensors.automaticScan(room,unit,pending.sensorOrder);
      if(auto!==null){pending.automaticNotice=true;const checks=shipSensors.scanChecks(room,pending.sensorOrder),success=Array.isArray(auto)?auto.length:!!auto.success;
        recordActionResult(unit,{id:pending.id+':automatic',label:'Scan: no dice required',text:!checks.length?'No objects in the scan area require a roll.':success?'Difficulty too low to fail: guaranteed contacts will be detected. Any impossible contacts remain undetected.':'Difficulty too high for the available dice: scan cannot succeed.',controller:pending.rollController||'player',stage:'automatic'});
      }
    }
    if(pending&&!pending.rollConfirmed&&!pending.rollBeforeDelay&&!(pending.weaponOrder?.burst?.shot>1)&&shipSensors.automaticScan(room,unit,pending.sensorOrder)===null&&(pending.lockOrder||pending.weaponOrder||pending.maintenanceOrder||pending.probeOrder?.kind==='scan'||(pending.transporterOrder?.risk>0||pending.transporterOrder?.scramblers?.length>0)||['area','hex','analysis','life','lifeArea'].includes(pending.sensorOrder?.kind)||['evade','ram','skim'].includes(pending.commandOrder?.kind))&&!pending.sensorOrder?.trigger&&!pending.commandOrder?.trigger){
      pending.rollBeforeDelay=true;pending.awaitingRoll=true;pending.resolving=true;
    }
    if(unit.delayedAction?.awaitingRoll){unit.delayedAction.automated ||= require('./ship-automation').active(unit);unit.delayedAction.rollSpec ||= shipRollSpec(room,unit,unit.delayedAction);if(unit.shipAi&&!unit.delayedAction.rollSpec.damage){unit.delayedAction.rollSpec.sides=[6,6,6,6];}
      unit.delayedAction.rollSpec.exertionAvailable=unit.delayedAction.transporterOrder?0:unit.characterId?Number(crewCampaign?.characters.find(c=>c.id===unit.characterId)?.character.resources?.exertionCurrent)||0:Number(unit.exertionCurrent??1);}
    for(const request of unit.pendingShipRolls||[]){request.rollSpec ||= shipRollSpec(room,{...unit,location:request.armed.location},request.armed.delayed||{commandOrder:request.armed.order});request.rollSpec.exertionAvailable=(request.extractionRoll||request.breachDroneRoll)?0:unit.characterId?Number(crewCampaign?.characters.find(c=>c.id===unit.characterId)?.character.resources?.exertionCurrent)||0:Number(unit.exertionCurrent??1);}
  }
  room.showcase ||= Boolean(campaignApi?.isShowcase(room.roomCode));
  shipShields.refresh(room);
  shipCommands.reconcileCalls(room);
  let destroyedActiveSource;
  for(const ship of room.starships){
    if(ship.currentHullHp<=0||ship.destroyedAt){
      if(!ship.destroyedAt){ship.destroyedAt=new Date().toISOString();pushLog(room,`${ship.title} DESTROYED.`,{starshipId:ship.id,destroyed:true});}
      ship.navigation=null;ship.auCommands=[];
      ship.ship.oxygenState=null;
      if(ship.commandSystems)ship.commandSystems.armed=null;
      for(const u of room.units.filter(u=>u.location?.starshipId===ship.id)){
        u.defeatedAt ||= Date.now();u.delayedAction=null;u.delayTimer=null;u.timedAction=null;u.consoleHold=null;u.atb=0;
        u.pendingShipRolls=[];u.pendingTimedResolutions=[];u.queuedEffects=[];u.thrownEffects=[];u.travelRoute=[];
        const affectedAction=room.activeAction?.unitId===u.id;
        const affectedAttack=room.attackResolution&&[room.attackResolution.attackerId,room.attackResolution.defenderId].includes(u.id);
        const affectedItem=removeUnitFromCombatObjects(room,u.id);
        if(affectedAction)room.activeAction=null;
        if(affectedAttack){room.attackResolution=null;clearAttackCommand(room);pushLog(room,'Attack cancelled because a participating ship was destroyed.');}
        if(room.delayRequest?.unitId===u.id)clearDelayRequest(room);
        if(room.activeId===u.id||affectedAction||affectedAttack||affectedItem){destroyedActiveSource=room.activeSource||'manual';room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);}
      }
    }
  }
  if(destroyedActiveSource!==undefined)moveToNextTurnOrClock(room,destroyedActiveSource);
  const survivors=room.starships.filter(s=>!s.destroyedAt&&!s.escapedAt&&s.currentHullHp>0);
  if(!shipTargets.flights(room).some(m=>['flying','impact'].includes(m.phase))&&room.starships.length>1&&survivors.length===1&&room.units.some(u=>u.team==='pc'&&u.location?.starshipId===survivors[0].id)&&!survivors[0].victoryAt){survivors[0].victoryAt=new Date().toISOString();pushLog(room,`VICTORY: ${survivors[0].title} is the last surviving ship.`,{starshipId:survivors[0].id,victory:true});}
  recordShipReports(room,()=>shipSensors.refresh(room));
  shipHacking.refresh(room);
  if(require('./ship-surveillance').reconcile(room))scheduleRoomPersist(room,0);
  recordShipReports(room,()=>shipLocks.refresh(room));
  for(const ship of room.starships)ship.droneRepairTargets=shipDrones.repairTargets(room,ship);
  for(const ship of room.starships)ship.incomingLocks=room.starships.flatMap(other=>(other.lockState?.targets||[]).filter(t=>t.targetId===ship.id).map(()=>({shipId:other.id,breakDifficulty:shipLocks.breakDifficulty(other,ship.id),title:ship.sensorState?.contacts?.[other.id]?.level==='detected'?other.title:'Unknown attacker'})));
  for(const ship of room.starships){ship.defenseScore=shipSensors.defense(room,ship);ship.evasionRemaining=Math.max(0,...(ship.commandSystems?.evasions||[]).map(e=>e.remaining??20));}
  migrateRoomDelays(room);
  const command = commandState(room);
  return {
    revision: ++stateSequence,
    stateEpoch,
    roomCode: room.roomCode,
    encounterId:room.encounterId,
    crewRoomRolls:crewRooms.rolls(room),
    missileRolls:shipTargets.flights(room).filter(m=>m.phase==='impact').map(m=>({id:m.id,name:m.name,dice:m.dice,unitId:m.unitId,characterId:m.characterId,controller:m.controller,automated:m.automated,damageMultiplier:(()=>{const t=shipTargets.find(room,m.targetId);return t?.isMissile?1:t?.isDrone?5:t?.currentShieldHp>0?1:5;})()})),
    running: room.running,
    rollPaused: (transitPending(room)||shipOxygen.pending(room.starships)||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)),
    pausedForTurn: room.pausedForTurn,
    activeId: room.activeId,
    activeAction: room.activeAction,
    attackResolution: publicAttackResolution(room),
    itemResolution: clone(room.itemResolution),
    vehicles: clone(room.vehicles || []),
    areaEffects: clone(room.areaEffects || []),
    activeSource: room.activeSource,
    command,
    hardPaused: room.hardPaused,
    holdPaused: room.holdPaused,
    delayRequest: room.delayRequest,
    hasEngagedClock: room.hasEngagedClock,
    lastInterruptedId: room.lastInterruptedId,
    lastInterruptedAt: room.lastInterruptedAt,
    lastKeepAliveAt: room.lastKeepAliveAt,
    encounterEndedAt: room.encounterEndedAt,
    threshold: room.threshold,
    starships: shipTargets.all(room).map(s=>s.isMissile?({...s,projectile:undefined}):s),
    planetaryEvent: clone(room.planetaryEvent||null),
    cleanserScars: clone(room.cleanserScars||[]),
    spaceObjects: clone(room.spaceObjects||[]),
    shipPositions: shipTargets.all(room).map(s=>({...shipTargets.point(room,s.id),id:s.id})),
    shipDistances: shipDistances.fromPositions(room.starships || [], room.shipPositions),
    units: room.units.map(unit=>shipHacking.publicUnit(room,unit)),
    log: room.log.slice(-30),
    undoAvailable: Boolean(room.undoSnapshot),
    showcase: Boolean(room.showcase || campaignApi?.isShowcase(room.roomCode)),
    sensorMode: Boolean(room.sensorMode),
  };
}

function resetShowcaseRoom(room) {
  const template = campaignApi?.showcaseEncounter(room.roomCode);
  if (!template) return false;
  const roomCode = room.roomCode;
  Object.assign(room, template, { roomCode, showcase: true, lastTick: Date.now(), encounterEndedAt: null, hackingPrivate:{secrets:{},sessions:[],receipts:[]} });
  room.log = clone(template.log || []);
  pushLog(room, "Explore Features encounter restored and paused.");
  return true;
}

function pushLog(room, text, context = {}) {
  if (!context.starshipId) {
    const mentioned = room.units.filter(unit => unit.characterName && text.includes(unit.characterName));
    const ships = new Set(mentioned.map(unit => unit.location?.starshipId).filter(Boolean));
    if (ships.size === 1) context = {...context, starshipId:[...ships][0]};
  }
  room.log.push({ id: id(), at: new Date().toLocaleTimeString(), timestamp:new Date().toISOString(), text, ...context });
  room.log = room.log.slice(-80);
}

function recordShipReports(room, operation) {
  const previous=new Map(room.starships.map(ship=>[ship.id,ship.sensorState?.reports?.[0]]));
  const result=operation();
  for(const ship of room.starships){
    const report=ship.sensorState?.reports?.[0];
    if(report&&report!==previous.get(ship.id))pushLog(room,report.text,{starshipId:ship.id,detected:Boolean(report.detected),...(report.objectRefs?.length?{objectRefs:clone(report.objectRefs)}:{})});
  }
  return result;
}

function removeUnitFromCombatObjects(room, unitId) {
  let cancelledItem = null;
  for (const owner of room.units || []) {
    if (owner.powerShield?.protectedIds) owner.powerShield.protectedIds = owner.powerShield.protectedIds.filter((entry) => entry !== unitId);
  }
  for (const vehicle of room.vehicles || []) {
    vehicle.occupantIds = (vehicle.occupantIds || []).filter((entry) => entry !== unitId);
    if (vehicle.driverId === unitId) { vehicle.driverId = ""; vehicle.currentMoveSpeed = vehicle.moveSpeed; }
  }
  room.vehicles = (room.vehicles || []).filter((vehicle) => vehicle.occupantIds.length);
  if (room.itemResolution && [room.itemResolution.healerId, room.itemResolution.targetId].includes(unitId)) {
    pushLog(room, "First Aid resolution cancelled because a participant left combat.");
    cancelledItem = room.itemResolution;
    room.itemResolution = null;
  }
  return cancelledItem;
}

function activateSmokeEffect(room, unit, effect) {
  unit.thrownEffects = (unit.thrownEffects || []).filter((entry) => entry.id !== effect.id);
  room.areaEffects ||= [];
  room.areaEffects.push({ id: id(), kind: "smoke", label: "Smoke Cloud", sourceUnitId: unit.id, sourceName: unit.characterName, radius: 6, penalty: 8, weakenEvery: 6, weakenRemaining: 6, createdAt: Date.now() });
  pushLog(room, `${unit.characterName}'s Smoke Grenade detonated: 6-unit smoke cloud, -8 Perception and Projectile; penalty weakens by 1 every 6 seconds.`);
}

function tickAreaEffects(room, seconds, multiplier = 1) {
  const elapsed = Math.max(0, Number(seconds) || 0) * Math.max(0, Number(multiplier) || 0);
  if (!elapsed) return;
  for (const effect of room.areaEffects || []) {
    if (effect.kind !== "smoke") continue;
    effect.weakenRemaining = Math.max(0, Number(effect.weakenRemaining) || Number(effect.weakenEvery) || 6) - elapsed;
    while (effect.weakenRemaining <= 0 && effect.penalty > 0) {
      effect.penalty -= 1;
      effect.weakenRemaining += Math.max(0.1, Number(effect.weakenEvery) || 6);
      if (effect.penalty > 0) pushLog(room, `${effect.label} weakened to -${effect.penalty}.`);
    }
  }
  const expired = (room.areaEffects || []).filter((effect) => effect.kind === "smoke" && effect.penalty <= 0);
  if (expired.length) pushLog(room, `${expired.length === 1 ? expired[0].label : "Smoke clouds"} dispersed.`);
  room.areaEffects = (room.areaEffects || []).filter((effect) => effect.kind !== "smoke" || effect.penalty > 0);
}

async function syncUnitItemsToCampaign(room, unit) {
  if (!unit?.characterId || !campaignApi) return;
  await campaignApi.syncCharacterCombatInventory(room.roomCode, unit.characterId, unit.items || [], unit.statuses || {});
}

function shieldProtectingTarget(room, target, { attackerId = "", attackType = "" } = {}) {
  if (attackType !== "ranged") return null;
  return room.units.find((owner) => {
    const shield = owner.powerShield;
    if (!shield?.active || !(Number(shield.hp) > 0) || !shield.protectedIds?.includes(target.id)) return false;
    return !attackerId || !shield.protectedIds.includes(attackerId);
  }) || null;
}

async function applyDamageToUnit(room, target, rawDamage, source, options = {}) {
  if (!target) return null;
  const incoming = Math.max(0, Number(rawDamage) || 0);
  const shieldOwner = shieldProtectingTarget(room, target, options);
  if (shieldOwner) {
    const shield = shieldOwner.powerShield;
    const beforeShield = Math.max(0, Number(shield.hp) || 0);
    const absorbed = Math.min(beforeShield, incoming);
    shield.hp = Math.max(0, beforeShield - incoming);
    const shieldItem = (shieldOwner.items || []).find((entry) => entry.id === shield.itemId);
    if (shieldItem) shieldItem.charges = shield.hp;
    const collapsed = shield.hp <= 0;
    if (collapsed) { shield.active = false; shield.collapsedAt = Date.now(); }
    await syncUnitItemsToCampaign(room, shieldOwner);
    target.damageEvent = {
      id: id(), source: `${source} - Power Shields`, rawDamage: incoming, reduction: 0, applied: 0,
      beforeHp: target.currentHp, currentHp: target.currentHp, maximumHp: target.maximumHp, shieldAbsorbed: absorbed,
      shieldOwnerId: shieldOwner.id, shieldBefore: beforeShield, shieldCurrent: shield.hp, shieldCollapsed: collapsed, createdAt: Date.now(),
    };
    pushLog(room, `${shieldOwner.characterName}'s Power Shields intercepted ${source} against ${target.characterName}; ${absorbed} Shield HP lost, overflow discarded${collapsed ? "; SHIELDS COLLAPSED" : `; ${shield.hp}/30 remains`}.`);
    return target.damageEvent;
  }
  let result = null;
  if (target.characterId && campaignApi && !options.finalDamage) {
    result = await campaignApi.damageCharacter(room.roomCode, target.characterId, incoming, source, { currentHp: target.currentHp, maximumHp: target.maximumHp, damageReduction: target.damageReduction });
  }
  if (!result) {
    const reduction = options.finalDamage ? 0 : Math.max(0, Number(target.damageReduction) || 0);
    const applied = Math.max(0, incoming - reduction);
    const beforeHp = target.currentHp === null || target.currentHp === undefined ? null : Number(target.currentHp);
    const currentHp = beforeHp === null ? null : Math.max(0, beforeHp - applied);
    result = { id: id(), rawDamage: incoming, reduction, applied, beforeHp, currentHp, maximumHp: target.maximumHp ?? null, source, createdAt: Date.now() };
  }
  if (result.currentHp !== null && result.currentHp !== undefined) target.currentHp = result.currentHp;
  if (result.maximumHp !== null && result.maximumHp !== undefined) target.maximumHp = result.maximumHp;
  target.damageReduction = result.reduction;
  target.damageEvent = { ...result, id: result.id || id(), source: String(source || "Combat damage"), createdAt: result.createdAt || Date.now() };
  pushLog(room, `${target.characterName} took ${result.applied} HP damage from ${source}${result.reduction ? ` (${result.rawDamage} incoming, ${result.reduction} Damage Reduction)` : ""}${result.currentHp === null ? "; GM records HP manually" : `; HP ${result.currentHp}/${result.maximumHp}`}.`);
  if(campaignApi)await campaignApi.personalDamageStatistics(room.roomCode,target.characterId,room.units.find(u=>u.id===options.attackerId)?.characterId,result.applied,target.damageEvent.id);
  syncNpcDefeat(room, target);
  return target.damageEvent;
}

async function applyHealingToUnit(room, target, amount, source) {
  if (!target) return null;
  const requested = Math.max(0, Number(amount) || 0);
  let result = null;
  if (target.characterId && campaignApi) result = await campaignApi.healCharacter(room.roomCode, target.characterId, requested, source);
  if (!result) {
    const maximumHp = Math.max(0, Number(target.maximumHp) || Number(target.currentHp) || 0);
    const beforeHp = Math.max(0, Number(target.currentHp) || 0);
    const currentHp = Math.min(maximumHp, beforeHp + requested);
    result = { requested, applied: currentHp - beforeHp, beforeHp, currentHp, maximumHp, source, createdAt: Date.now() };
  }
  target.currentHp = result.currentHp;
  target.maximumHp = result.maximumHp;
  target.healingEvent = { ...result, id: id() };
  pushLog(room, `${source} restored ${result.applied} HP to ${target.characterName}; HP ${result.currentHp}/${result.maximumHp}.`);
  syncNpcDefeat(room, target);
  return target.healingEvent;
}

function beginFirstAidResolution(room, healer, timedAction, source) {
  const target = room.units.find((entry) => entry.id === timedAction.targetId);
  if (!target || target.defeatedAt || healer.defeatedAt) {
    pushLog(room, `${healer.characterName}'s First Aid ended because a participant is no longer available.`);
    return false;
  }
  room.running = false;
  room.pausedForTurn = true;
  room.activeId = null;
  clearActiveCommand(room);
  room.activeSource = source;
  room.itemResolution = {
    id: id(), kind: "firstAid", phase: "gmDifficulty", healerId: healer.id, targetId: target.id,
    healerName: healer.characterName, targetName: target.characterName, useKit: Boolean(timedAction.useKit),
    baseDifficulty: healer.id === target.id ? 15 : 12, difficulty: healer.id === target.id ? 15 : 12,
    treatmentRating: Number(timedAction.treatmentRating) || 0, roll: null, healingRoll: null,
    healingFormula: "", createdAt: Date.now(), source,
  };
  pushLog(room, `${healer.characterName}'s treatment of ${target.characterName} is ready; GM must confirm First Aid Difficulty.`);
  return true;
}

function finishItemResolution(room, text) {
  const resolution = room.itemResolution;
  if (!resolution) return;
  room.itemResolution = null;
  room.pausedForTurn = false;
  room.activeId = null;
  clearActiveCommand(room);
  if (text) pushLog(room, text);
  moveToNextTurnOrClock(room, resolution.source || room.activeSource);
}

function npcDefeatKey(roomCodeValue, unitId) {
  return `${roomCodeValue}:${unitId}`;
}

function cancelNpcDefeat(roomCodeValue, unitId) {
  const key = npcDefeatKey(roomCodeValue, unitId);
  clearTimeout(npcDefeatTimers.get(key));
  npcDefeatTimers.delete(key);
}

function cancelRoomNpcDefeats(roomCodeValue) {
  const prefix = `${roomCodeValue}:`;
  for (const [key, timer] of npcDefeatTimers) {
    if (!key.startsWith(prefix)) continue;
    clearTimeout(timer);
    npcDefeatTimers.delete(key);
  }
}

function syncNpcDefeat(room, unit) {
  if (!room || !unit) return;
  if(unit.escapedAt){cancelNpcDefeat(room.roomCode,unit.id);unit.defeatedAt ||= Date.now();return;}
  if (room.starships.some(s => s.id === unit.location?.starshipId && s.destroyedAt)) {
    cancelNpcDefeat(room.roomCode, unit.id);
    unit.defeatedAt ||= Date.now();
    return;
  }
  const hp = unit.currentHp == null ? NaN : Number(unit.currentHp);
  if (!Number.isFinite(hp) || hp > 0) {
    cancelNpcDefeat(room.roomCode, unit.id);
    delete unit.defeatedAt;
    delete unit.defeatRemovesAt;
    delete unit.oxygenUnconscious;
    return;
  }
  if (unit.team !== 'npc' || unit.location?.starshipId) {
    cancelNpcDefeat(room.roomCode,unit.id);delete unit.defeatRemovesAt;
    const newlyUnconscious = !unit.defeatedAt;
    unit.defeatedAt ||= Date.now();
    unit.atb = 0;
    unit.consoleHold = null;
    unit.delayedAction = null; unit.delayTimer = null; unit.timedAction = null;
    unit.pendingShipRolls = []; unit.pendingTimedResolutions = []; unit.travelRoute = []; unit.queuedEffects = [];
    const affectedAttack = room.attackResolution && [room.attackResolution.attackerId, room.attackResolution.defenderId].includes(unit.id);
    const affectedItem = removeUnitFromCombatObjects(room, unit.id);
    if (affectedAttack) { room.attackResolution = null; clearAttackCommand(room); }
    if (room.delayRequest?.unitId === unit.id) clearDelayRequest(room);
    if (room.activeId === unit.id || room.activeAction?.unitId === unit.id || affectedAttack || affectedItem) {
      const source = room.activeSource;
      room.activeId = null; room.activeAction = null; room.pausedForTurn = false;
      clearActiveCommand(room);
      moveToNextTurnOrClock(room, source);
    }
    if (newlyUnconscious) pushLog(room, `${unit.characterName} is unconscious. ATB and actions stopped.`);
    return;
  }
  const medicalShip=room.starships.find(s=>s.id===unit.location?.starshipId),medicalCell=medicalShip&&shipMapCore.buildLayout(medicalShip.ship).footprint.get(unit.location.square);
  if(unit.medbayTreatment||medicalCell?.type==='medbay'){cancelNpcDefeat(room.roomCode,unit.id);unit.defeatedAt||=Date.now();unit.atb=0;return;}
  const newlyDefeated = !unit.defeatedAt;
  if(unit.oxygenUnconscious){cancelNpcDefeat(room.roomCode,unit.id);unit.defeatedAt||=Date.now();return;}
  unit.defeatedAt = Number(unit.defeatedAt) || Date.now();
  unit.defeatRemovesAt = Number(unit.defeatRemovesAt) || unit.defeatedAt + 5600;
  unit.atb = Math.min(unit.atb, Math.max(0, room.threshold - 0.001));
  if (newlyDefeated) pushLog(room, `${unit.characterName} was defeated.`);
  cancelNpcDefeat(room.roomCode, unit.id);
  const remaining = Math.max(0, unit.defeatRemovesAt - Date.now());
  const key = npcDefeatKey(room.roomCode, unit.id);
  npcDefeatTimers.set(key, setTimeout(() => {
    npcDefeatTimers.delete(key);
    const liveRoom = getRoom(room.roomCode);
    const defeated = liveRoom?.units.find((entry) => entry.id === unit.id);
    if (!liveRoom || !defeated || defeated.team !== "npc" || Number(defeated.currentHp) > 0) return;
    const previousSource = liveRoom.activeSource;
    const wasActive = liveRoom.activeId === defeated.id;
    const affectedAttack = liveRoom.attackResolution && [liveRoom.attackResolution.attackerId, liveRoom.attackResolution.defenderId].includes(defeated.id);
    const affectedAction = liveRoom.activeAction?.unitId === defeated.id;
    const affectedItem = removeUnitFromCombatObjects(liveRoom, defeated.id);
    liveRoom.units = liveRoom.units.filter((entry) => entry.id !== defeated.id);
    if (affectedAttack) {
      liveRoom.attackResolution = null;
      clearAttackCommand(liveRoom);
    }
    if (liveRoom.activeAction?.unitId === defeated.id) liveRoom.activeAction = null;
    if (wasActive || affectedAttack || affectedAction || affectedItem) {
      liveRoom.activeId = null;
      liveRoom.pausedForTurn = false;
      clearActiveCommand(liveRoom);
      moveToNextTurnOrClock(liveRoom, previousSource);
    }
    pushLog(liveRoom, `${defeated.characterName} was removed from combat.`);
    broadcast(liveRoom);
    scheduleRoomPersist(liveRoom, 0);
    campaignApi?.broadcast(liveRoom.roomCode).catch(() => {});
  }, remaining));
}
function beginAttackResolution(room, details) {
  const attacker = room.units.find((entry) => entry.id === details.attackerId);
  const defender = room.units.find((entry) => entry.id === details.defenderId)||require('./ship-doors').find(room,details.defenderId);
  if (!attacker || !defender) return null;
  const source = room.activeSource || "manual";
  clearActiveCommand(room);
  room.activeSource = source;
  room.running = false;
  room.pausedForTurn = true;
  room.activeId = attacker.id;
  const defenderCommandTotal = defender.team === "pc" ? Math.max(0, Number(defender.commandWindow) || 0) : 0;
  room.attackResolution = {
    id: id(),
    phase: "checks",
    source,
    ...clone(details),
    attackerName: attacker.characterName,
    defenderName: defender.characterName,
    attackerRoll: null,
    defenseRoll: null,
    attackResult: null,
    damageRoll: null,
    damageSummary: null,
    defenderCommandTotal,
    defenderCommandDeadline: defenderCommandTotal > 0 && !room.hardPaused ? Date.now() + defenderCommandTotal * 1000 : null,
    defenderCommandHeldRemaining: defenderCommandTotal > 0 && room.hardPaused ? defenderCommandTotal : null,
    defenderCommandExpired: false,
    createdAt: Date.now(),
  };
  if(details.doorTarget){room.attackResolution.phase='damage';room.attackResolution.attackResult={hit:true,critical:false};room.attackResolution.defenseRoll={score:0};pushLog(room,attacker.characterName+' attacks '+defender.characterName+'. Roll '+details.plan.damageFormula+' damage. A hit of 10 or more causes one breach point.');return room.attackResolution;}
  pushLog(room, attacker.characterName + " targeted " + defender.characterName + " with " + details.weaponName + " at " + details.distance + " unit" + (details.distance === 1 ? "" : "s") + "; attack and Defense rolls requested.");
  return room.attackResolution;
}

function finishAttackResolution(room, logText) {
  const attack = room.attackResolution;
  if (!attack) return;
  const attacker = room.units.find((entry) => entry.id === attack.attackerId);
  room.attackResolution = null;
  room.activeSource = attack.source || room.activeSource;
  clearAttackCommand(room);
  if (attacker) {
    completeStagedAttack(room, attacker, attack, logText, {
      id,
      clearActiveCommand,
      moveToNextTurnOrClock,
      pushLog,
    });
  } else {
    room.activeId = null;
    room.pausedForTurn = false;
    clearActiveCommand(room);
    moveToNextTurnOrClock(room, attack.source);
  }
}

function resolveAttackChecks(room) {
  const state = room.attackResolution;
  if (!state || state.phase !== "checks" || !state.attackerRoll || !state.defenseRoll) return null;
  const defender = room.units.find((entry) => entry.id === state.defenderId);
  const attacker = room.units.find((entry) => entry.id === state.attackerId);
  const defenseTimed = defender?.timedAction?.kind === "defense";
  const timedDefenseBonus = defenseTimed ? Math.max(0, Number(defender.dodgeSkill) || 0) : 0;
  const racialDefenseBonus = Number(defender?.defenseScoreModifier) || 0;
  const attackerDefenseModifier = state.attackType === "melee"
    && state.weaponId === "unarmed"
    && attacker?.raceId === "antropic"
    && attacker?.raceType === "fangs"
    ? -3
    : 0;
  const defenseBonus = timedDefenseBonus + racialDefenseBonus + attackerDefenseModifier;
  const targetDefense = Number(state.defenseRoll.score) + defenseBonus;
  state.defenseBonus = defenseBonus;
  state.timedDefenseBonus = timedDefenseBonus;
  state.racialDefenseBonus = racialDefenseBonus;
  state.attackerDefenseModifier = attackerDefenseModifier;
  state.attackResult = combatRules.resolveAttack({
    baseAttackScore: state.attackerRoll.score,
    targetDefense,
    calledShot: state.calledShot,
    plan: state.plan,
  });
  if (!state.attackResult.hit && state.attackType === "melee") {
    const defenderCritical = targetDefense >= Number(state.attackResult.attackScore) * 2;
    if (defenderCritical && defender?.raceId === "krax-gny-vtek") {
      defender.atb = Math.max(room.threshold, Number(defender.atb) || 0);
      state.defenderImmediateAtb = true;
      pushLog(room, defender.characterName + " critically avoided a Melee attack; ATB immediately filled to 100%.");
    }
    if (defenderCritical && defenseTimed) {
      const elapsedDefense = Math.max(0, Number(defender.timedAction.total) - Number(defender.timedAction.remaining));
      state.counterDelaySeconds = Math.ceil(elapsedDefense * 20) / 10;
      if (state.counterDelaySeconds > 0) {
        pushLog(room, defender.characterName + " scored a Critical Defense against " + (attacker?.characterName || state.attackerName) + "; Counter Delay " + state.counterDelaySeconds.toFixed(1) + " seconds.");
      }
    }
  }
  clearAttackCommand(room);
  if (!state.attackResult.hit) {
    const verb = state.attackType === "melee" ? "attacked " : "fired ";
    const rangeText = state.attackType === "melee" ? "" : " from " + state.distance + " unit" + (state.distance === 1 ? "" : "s");
    const logText = verb + state.defenderName + " with " + state.weaponName + rangeText + " and missed (" + state.attackResult.attackScore + " To-Hit vs " + state.attackResult.hitDefense + " Defense). Range: " + state.plan.rangeExplanation;
    finishAttackResolution(room, logText);
    return { hit: false };
  }
  state.phase = "damage";
  pushLog(room, state.attackerName + " hit " + state.defenderName + " with " + state.weaponName + (state.attackResult.critical ? state.calledShot ? " - CRITICAL EFFECT." : " - CRITICAL HIT." : ".") + " Roll " + state.plan.damageFormula + " Damage.");
  return { hit: true };
}

function directNpcDamage(room, target, finalDamage, state) {
  const applied = Math.max(0, Number(finalDamage) || 0);
  const beforeHp = target.currentHp === null || target.currentHp === undefined ? 0 : Number(target.currentHp);
  const maximumHp = Math.max(1, Number(target.maximumHp) || beforeHp || 1);
  const currentHp = Math.max(0, beforeHp - applied);
  target.currentHp = currentHp;
  target.maximumHp = maximumHp;
  target.damageEvent = {
    id: id(),
    source: state.attackerName + "'s " + state.weaponName,
    rawDamage: state.damageSummary.beforeReduction,
    reduction: state.damageSummary.reduction,
    applied,
    beforeHp,
    currentHp,
    maximumHp,
    critical: Boolean(state.attackResult?.critical),
    calledShot: Boolean(state.calledShot),
    createdAt: Date.now(),
  };
  pushLog(room, target.characterName + " took " + applied + " HP damage; HP " + currentHp + "/" + maximumHp + ".");

  syncNpcDefeat(room, target);
  return target.damageEvent;
}

function attackResolutionLog(state, appliedDamage) {
  const result = state.attackResult;
  const label = result.critical ? state.calledShot ? "CRITICAL EFFECT" : "CRITICAL HIT" : "HIT";
  const doubling = result.critical && !state.calledShot && !state.plan.criticalDamageDisabled
    ? ", doubled to " + state.damageSummary.beforeReduction
    : result.critical && state.plan.criticalDamageDisabled
      ? ", card prevents critical doubling"
      : "";
  const opening = state.attackType === "melee"
    ? "attacked " + state.defenderName + " with " + state.weaponName
    : "fired " + state.weaponName + " at " + state.defenderName + " from " + state.distance + " unit" + (state.distance === 1 ? "" : "s");
  return opening + ": " + label + " (" + result.attackScore + " To-Hit vs " + result.hitDefense + " Defense); rolled " + state.damageSummary.rolled + " Damage" + doubling + ", DR " + state.damageSummary.reduction + ", " + appliedDamage + " HP applied. Range: " + state.plan.rangeExplanation;
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function attackCommandState(room) {
  const attack = room.attackResolution;
  if (!attack || attack.phase !== "checks" || !attack.defenderCommandTotal || attack.defenseRoll) return null;
  const remaining = attack.defenderCommandExpired
    ? 0
    : attack.defenderCommandHeldRemaining !== null && attack.defenderCommandHeldRemaining !== undefined
      ? Math.max(0, Number(attack.defenderCommandHeldRemaining) || 0)
      : attack.defenderCommandDeadline
        ? Math.max(0, (attack.defenderCommandDeadline - Date.now()) / 1000)
        : 0;
  return {
    unitId: attack.defenderId,
    total: attack.defenderCommandTotal,
    remaining,
    expired: Boolean(attack.defenderCommandExpired),
  };
}

function snapshotAttackResolution(room) {
  if (!room.attackResolution) return null;
  const attack = clone(room.attackResolution);
  attack.defenderCommandRemaining = attack.defenderCommandExpired
    ? 0
    : attack.defenderCommandHeldRemaining !== null && attack.defenderCommandHeldRemaining !== undefined
      ? Math.max(0, Number(attack.defenderCommandHeldRemaining) || 0)
      : attack.defenderCommandDeadline
        ? Math.max(0, (attack.defenderCommandDeadline - Date.now()) / 1000)
        : null;
  delete attack.defenderCommandDeadline;
  delete attack.defenderCommandHeldRemaining;
  return attack;
}

function restoreAttackResolution(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const attack = clone(snapshot);
  const remaining = attack.defenderCommandRemaining;
  attack.defenderCommandDeadline = remaining === null || remaining === undefined || attack.defenderCommandExpired
    ? null
    : Date.now() + Math.max(0, Number(remaining) || 0) * 1000;
  attack.defenderCommandHeldRemaining = null;
  delete attack.defenderCommandRemaining;
  return attack;
}

function publicAttackResolution(room) {
  if (!room.attackResolution) return null;
  const attack = clone(room.attackResolution);
  attack.defenderCommand = attackCommandState(room);
  delete attack.defenderCommandDeadline;
  delete attack.defenderCommandHeldRemaining;
  return attack;
}

function pauseAttackCommand(room) {
  const attack = room.attackResolution;
  if (!attack?.defenderCommandDeadline || attack.defenderCommandExpired || attack.defenseRoll) return;
  attack.defenderCommandHeldRemaining = Math.max(0, (attack.defenderCommandDeadline - Date.now()) / 1000);
  attack.defenderCommandDeadline = null;
}

function resumeAttackCommand(room) {
  const attack = room.attackResolution;
  if (!attack || attack.defenderCommandExpired || attack.defenseRoll) return;
  if (attack.defenderCommandHeldRemaining !== null && attack.defenderCommandHeldRemaining !== undefined) {
    attack.defenderCommandDeadline = Date.now() + Math.max(0, Number(attack.defenderCommandHeldRemaining) || 0) * 1000;
    attack.defenderCommandHeldRemaining = null;
  }
}

function clearAttackCommand(room) {
  const attack = room.attackResolution;
  if (!attack) return;
  attack.defenderCommandDeadline = null;
  attack.defenderCommandHeldRemaining = null;
}
function snapshotRoom(room) {
  return {
    encounterId:room.encounterId,
    hackingPrivate: clone(room.hackingPrivate || null),
    running: room.running,
    pausedForTurn: room.pausedForTurn,
    resumeAfterTurn: room.resumeAfterTurn,
    activeId: room.activeId,
    activeAction: clone(room.activeAction),
    attackResolution: snapshotAttackResolution(room),
    itemResolution: clone(room.itemResolution),
    vehicles: clone(room.vehicles || []),
    areaEffects: clone(room.areaEffects || []),
    activeSource: room.activeSource,
    commandRemaining: room.commandDeadline ? Math.max(0, (room.commandDeadline - Date.now()) / 1000) : null,
    commandTotal: room.commandTotal,
    commandExpired: room.commandExpired,
    hardPaused: room.hardPaused,
    holdPaused: room.holdPaused,
    holdStartedAt: room.holdStartedAt,
    commandHeldRemaining: room.commandHeldRemaining,
    lastInterruptedId: room.lastInterruptedId,
    lastInterruptedAt: room.lastInterruptedAt,
    encounterEndedAt: room.encounterEndedAt,
    delayRequest: clone(room.delayRequest),
    hasEngagedClock: room.hasEngagedClock,
    threshold: room.threshold,
    starships: clone(room.starships || []),
    shipDistances: clone(room.shipDistances || []),
    planetaryEvent: clone(room.planetaryEvent||null),
    cleanserScars: clone(room.cleanserScars||[]),
    spaceObjects: clone(room.spaceObjects||[]),
    shipPositions: clone(room.shipPositions || []),
    units: clone(room.units),
    log: clone(room.log),
    preparations: clone(room.preparations || []),
    sensorMode: Boolean(room.sensorMode),
  };
}

function restoreUndoSnapshot(room) {
  if (!room.undoSnapshot) return false;
  cancelRoomNpcDefeats(room.roomCode);
  const snapshot = room.undoSnapshot;
  room.hackingPrivate = clone(snapshot.hackingPrivate || {secrets:{},sessions:[],receipts:[]});
  room.running = snapshot.running;
  room.pausedForTurn = snapshot.pausedForTurn;
  room.resumeAfterTurn = snapshot.resumeAfterTurn;
  room.activeId = snapshot.activeId;
  room.activeAction = clone(snapshot.activeAction);
  room.attackResolution = restoreAttackResolution(snapshot.attackResolution);
  room.itemResolution = clone(snapshot.itemResolution);
  room.vehicles = clone(snapshot.vehicles || []);
  room.areaEffects = clone(snapshot.areaEffects || []);
  room.activeSource = snapshot.activeSource;
  room.commandDeadline = snapshot.commandRemaining === null ? null : Date.now() + snapshot.commandRemaining * 1000;
  room.commandTotal = snapshot.commandTotal;
  room.commandExpired = snapshot.commandExpired;
  room.hardPaused = snapshot.hardPaused;
  room.holdPaused = snapshot.holdPaused;
  room.holdStartedAt = snapshot.holdStartedAt;
  room.commandHeldRemaining = snapshot.commandHeldRemaining;
  room.lastInterruptedId = snapshot.lastInterruptedId;
  room.lastInterruptedAt = snapshot.lastInterruptedAt;
  room.encounterEndedAt = snapshot.encounterEndedAt;
  room.delayRequest = clone(snapshot.delayRequest);
  room.hasEngagedClock = snapshot.hasEngagedClock;
  room.sensorMode = Boolean(snapshot.sensorMode);
  room.threshold = snapshot.threshold;
  room.starships = clone(snapshot.starships || []);
  room.shipDistances = clone(snapshot.shipDistances || []);
  room.planetaryEvent = clone(snapshot.planetaryEvent||null);
  room.cleanserScars = clone(snapshot.cleanserScars||[]);
  room.spaceObjects = clone(snapshot.spaceObjects||[]);
  room.shipPositions = clone(snapshot.shipPositions || []);
  room.units = clone(snapshot.units);
  for(const unit of room.units){if(require('./ship-automation').active(unit)||unit.delayedAction?.automated){unit.automationSuspended=true;unit.automationNotice='Automation paused after Undo. Select its mode again to resume.';if(unit.delayedAction)unit.delayedAction.automated=false;delete unit.automationPresentation;}}
  for(const missile of shipTargets.flights(room))if(missile.phase==='impact'&&missile.automated){missile.automated=false;delete missile.automationPresentation;}
  for (const unit of room.units) if (unit.defeatedAt) syncNpcDefeat(room, unit);
  room.log = clone(snapshot.log);
  room.undoSnapshot = null;
  room.undoLabel = "";
  room.lastTick = Date.now();
  pushLog(room, "GM undid the last combat change.");
  return true;
}

function cleanserPlayerResult(event) {
  const result=event?.outcome||event?.impactPreview;
  if(event?.targetKind!=='starship'||!result)return event?.resultText;
  const damage=Number(event.damage||0).toLocaleString();
  return !result.hit?`${event.targetName} escaped the Planetary Cleanser. The blast struck the original aim hex; no damage.`:result.destroyed?`${event.targetName} destroyed. Simulated damage: ${damage}.`:`${event.targetName} survived the Planetary Cleanser. Simulated blast: ${damage}.`;
}
function visibleCleanserEvent(event) {
  if(event?.targetKind!=='starship')return event;
  const summary=value=>value?{hit:value.hit,survived:value.survived,destroyed:value.destroyed}:value;
  const {missReason,...publicEvent}=event;
  return {...publicEvent,impactPreview:summary(event.impactPreview),outcome:summary(event.outcome),...(event.resultText?{resultText:cleanserPlayerResult(event)}:{})};
}

function visibleEncounter(data, viewer) {
  if (!data?.units || !data?.starships) return data;
  data={...data,starships:data.starships.map(s=>({...s,ship:{...s.ship,oxygenState:undefined,missileState:s.ship.missileState?{cooldowns:s.ship.missileState.cooldowns,flights:(s.ship.missileState.flights||[]).filter(m=>['flying','impact','mine','web'].includes(m.phase)||Date.now()-(m.endedAt||0)<6000)}:undefined}}))};
  const hackingDice=data.starships.filter(s=>viewer?.gm||viewer?.characterId&&s.crewCharacterIds?.includes(viewer.characterId)).flatMap(s=>(s.ship.fieldState?.hackAlertRolls||[]).filter(r=>r.phase!=='complete'||Date.now()-(r.completedAt||0)<1800).map(r=>({id:s.id,characterName:s.title,hackAlert:true,automationPresentation:r})));
  data={...data,hackingDice,starships:data.starships.map(s=>({...s,ship:{...s.ship,fieldState:s.ship.fieldState?{...s.ship.fieldState,hackAlertRolls:undefined}:undefined}}))};
  data = { ...data, accessRole: viewer?.gm ? 'gm' : viewer?.characterId ? 'character' : 'spectator' };
  const notices=require('./fleet-status').project(data,{role:viewer?.gm?'gm':'character',characterId:viewer?.characterId});
  data={...data,fleetNotices:{lockedShips:notices.lockedShips,damagedSystems:notices.damagedSystems,activity:notices.activity,detections:notices.detections,intrusions:notices.intrusions}};
  data.crewRoomRolls=(data.crewRoomRolls||[]).filter(r=>viewer?.gm||(viewer?.characterId&&r.characterId===viewer.characterId&&r.controller!=='gm'));
  data.starships=data.starships.map(s=>viewer?.gm||viewer?.spectator&&s.controlType==='pc'||s.crewCharacterIds?.includes(viewer?.characterId)||data.units.some(u=>u.characterId===viewer?.characterId&&u.location?.starshipId===s.id)?s:{...s,ship:{...s.ship,atmosphereState:undefined,cloakState:undefined,crewRoomState:undefined,fabricationState:undefined,fieldState:undefined,droneState:undefined,probeState:undefined}});
  data.missileRolls=(data.missileRolls||[]).filter(m=>viewer?.gm||(viewer?.characterId&&m.characterId===viewer.characterId&&m.controller!=='gm'));
  data.starships=data.starships.map(s=>({...s,ship:{...s.ship,surveillanceState:undefined}}));
  if (viewer?.gm) return {...data,intruderShips:data.starships.filter(s=>s.ship.intruderState?.detected?.length).map(s=>({id:s.id,title:s.title}))};
  if(data.showcase&&viewer?.characterId)data={...data,demoAutomation:data.units.filter(u=>u.automationPresentation).map(u=>({id:u.id,characterName:u.characterName,automationPresentation:u.automationPresentation})).concat(data.starships.flatMap(s=>(s.ship.missileState?.flights||[]).filter(m=>m.automated&&m.automationPresentation).map(m=>({id:m.unitId,characterName:m.name,automationPresentation:m.automationPresentation}))))};
  const intruderSource=data;
  data={...data,planetaryEvent:visibleCleanserEvent(data.planetaryEvent)};
  data={...data,units:data.units.map(unit=>unit.characterId===viewer?.characterId?unit:{...unit,hackingSessions:[],counterHackSwap:null})};
  const sensorEncounter = data.starships.some(s => (s.ship?.sicInventory || []).some(i => shipMapCore.definition(i.type).sensor));
  let visible=viewer?.spectator ? require("./spectator-view").combined(data) : data.sensorMode||sensorEncounter
    ?shipSensors.view(data,(data.units.find(u => u.characterId === viewer?.characterId)?.location?.starshipId||data.units.find(u=>u.characterId===viewer?.characterId)?.vacuum?.sourceShipId)):data;
  if(!viewer?.spectator)visible.spaceObjects=require("./spectator-view").objects(data,data.starships.filter(s=>s.id===(data.units.find(u=>u.characterId===viewer?.characterId)?.location?.starshipId||data.units.find(u=>u.characterId===viewer?.characterId)?.vacuum?.sourceShipId)));
  visible=shipHacking.capturedView(visible,data,viewer?.characterId);
  visible=require('./ship-intruders').project(visible,intruderSource,viewer);
  visible.starships=visible.starships.map(s=>({...s,ship:{...s.ship,intruderState:undefined}}));
  return {...visible,units:visible.units.map(unit=>({...unit,actionResults:unit.characterId===viewer?.characterId
    ?(unit.actionResults||[]).filter(result=>result.controller!=='gm'):[]}))};
}

async function encounterViewer(room, params) {
  const token = params.get('token') || '';
  const session = campaignApi.session(token,room.roomCode);
  return {spectator:session?.role==='viewer',gm:session?.role === 'gm',characterId:session?.role === 'character' ? session.characterId : null};
}

function sendEvent(res, event, data, projections) {
  if (event === 'state') {
    const viewer=res.sensorViewer||{},key=JSON.stringify([Boolean(viewer.gm),Boolean(viewer.spectator),viewer.characterId||null]);
    let prepared=projections?.get(key);
    if(!prepared){const visible=visibleEncounter(data,viewer);prepared={visible,snapshot:null};projections?.set(key,prepared);}
    data=prepared.visible;
    if(res.deltaState){
      // Diff only the authorized view; never diff raw GM state for a player.
      const snapshot=prepared.snapshot||(prepared.snapshot=JSON.parse(JSON.stringify(data)));
      if(res.previousState){
        const packet={base:res.previousState.revision,changes:require('./combat-wire').diff(res.previousState,snapshot)};
        res.previousState=snapshot;event='state-delta';data=packet;
      }else res.previousState=snapshot;
    }
  }
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room, clock = false) {
  const remaining = 200 - (Date.now() - (room.lastBroadcastAt || 0));
  if (clock && remaining > 0) {
    // Preserve the final update even when readiness stops the clock before
    // another tick. Coalesce into the latest state, never a stale snapshot.
    if (!pendingBroadcasts.has(room)) {
      const timer = setTimeout(() => {
        pendingBroadcasts.delete(room);
        if (rooms.get(room.roomCode) === room) broadcast(room);
      }, remaining);
      timer.unref();
      pendingBroadcasts.set(room, timer);
    }
    return;
  }
  clearTimeout(pendingBroadcasts.get(room));
  pendingBroadcasts.delete(room);
  room.lastBroadcastAt=Date.now();
  const data = publicState(room);
  const projections=new Map();
  for (const res of clients.get(room.roomCode) || []) sendEvent(res, "state", data,projections);
}

function normalizeSpeed(value) {
  if (value === null || value === undefined || value === "") return null;
  return Math.max(0.1, Math.min(100, Number(value) || 0.1));
}

function normalizeCommandWindow(value) {
  if (value === null || value === undefined || value === "") return null;
  return Math.max(1, Math.min(999, Math.round(Number(value) || 1)));
}

function normalizeDelayRate(value) {
  if (value === null || value === undefined || value === "") return null;
  return Math.max(0.1, Math.min(100, Number(value) || 1));
}

function normalizeDelayKind(value) {
  if (value === "queued") return "queued";
  return value === "action" ? "action" : "timer";
}

function normalizeDelayLabel(value, kind = "timer") {
  const fallback = kind === "queued" ? "Queued Effect" : kind === "action" ? "Delayed Resolution" : "Reload/Recovery";
  return String(value || fallback).trim().slice(0, 60) || fallback;
}

function normalizeDelaySettings(value) {
  const base = Number(value?.base);
  const allowedBases = new Set([3, 6, 8, 10, 14]);
  const factors = {};
  for (const factor of ["Quality", "Performance", "Efficiency", "Situation", "Ingenuity", "Execution"]) {
    const raw = Number(value?.factors?.[factor]) || 0;
    if (factor === "Execution") {
      factors[factor] = raw > 0 ? 1 : 0;
      continue;
    }
    factors[factor] = Math.max(-4, Math.min(4, Math.round(raw)));
  }
  return {
    base: allowedBases.has(base) ? base : 8,
    factors,
  };
}

function normalizeQueuedEffect(value) {
  return {
    id: id(),
    label: normalizeDelayLabel(value?.label, "queued"),
    rate: normalizeDelayRate(value?.rate) || 1,
    settings: normalizeDelaySettings(value?.settings),
    progress: 0,
    total: 100,
    impairments: 0,
    resolving: false,
  };
}

function normalizeActionLog(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return text || "has taken an action";
}

function normalizeTeam(value) {
  return value === "pc" ? "pc" : "npc";
}

function normalizeActorType(value) {
  return "character";
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#39e58f";
}

function needsSetup(unit) {
  return !unit.shipAi&&(!unit.speed || (unit.team === "pc" && !unit.commandWindow));
}

function canStartClock(room) {
  return room.units.length > 0 && !room.units.some(needsSetup);
}

function tieCompare(a, b) {
  const aSpeed = effectiveSpeed(a);
  const bSpeed = effectiveSpeed(b);
  if (a.team !== b.team) return a.team === "pc" ? -1 : 1;
  if (aSpeed !== bSpeed) return bSpeed - aSpeed;
  return a.tieSeed - b.tieSeed;
}

function findReadyUnit(room, excludeId = null) {
  return room.units.filter((unit) => unit.id !== excludeId && !unit.defeatedAt && !unit.consoleHold && !unit.shieldRestabilizing && !hasDelay(unit) && unit.atb >= room.threshold).sort((a, b) => tieCompare(a, b))[0];
}

function nextTurnSource(room, previousSource = null) {
  if (room.resumeAfterTurn) return "clock";
  if (previousSource === "step") return "step";
  return "manual";
}

function commandState(room) {
  if (!room.activeId || !room.commandTotal) return null;
  const remaining = (room.hardPaused || room.holdPaused) && room.commandHeldRemaining !== null
    ? room.commandHeldRemaining
    : room.commandExpired || !room.commandDeadline
    ? 0
    : Math.max(0, (room.commandDeadline - Date.now()) / 1000);
  return {
    unitId: room.activeId,
    total: room.commandTotal,
    remaining,
    expired: room.commandExpired,
  };
}

function clearActiveCommand(room) {
  room.activeSource = null;
  room.commandDeadline = null;
  room.commandTotal = 0;
  room.commandExpired = false;
  room.holdPaused = false;
  room.holdStartedAt = null;
  room.commandHeldRemaining = null;
}

function clearDelayRequest(room) {
  room.delayRequest = null;
}

function delayConsoleAllowed(room) {
  const active = room.units.find((unit) => unit.id === room.activeId);
  return Boolean(room.hardPaused || (room.pausedForTurn && active?.team === "npc"));
}

function holdCommandWindow(room) {
  if (!room.commandDeadline || room.commandExpired || room.holdPaused) return;
  room.holdPaused = true;
  room.holdStartedAt = Date.now();
  room.commandHeldRemaining = Math.max(0, (room.commandDeadline - Date.now()) / 1000);
}

function hardPauseRoom(room) {
  if (room.hardPaused) return;
  pauseAttackCommand(room);
  if (!room.holdPaused && room.commandDeadline && !room.commandExpired) {
    room.commandHeldRemaining = Math.max(0, (room.commandDeadline - Date.now()) / 1000);
  }
  room.hardPaused = true;
  room.holdStartedAt = Date.now();
  room.lastTick = Date.now();
  pushLog(room, "All timers paused.");
}

function hardResumeRoom(room) {
  if (!room.hardPaused) return;
  resumeAttackCommand(room);
  if (room.commandHeldRemaining !== null && room.commandDeadline) {
    room.commandDeadline = Date.now() + Math.max(0, room.commandHeldRemaining || 0) * 1000;
  }
  room.hardPaused = false;
  room.holdStartedAt = null;
  if (!room.holdPaused) room.commandHeldRemaining = null;
  room.lastTick = Date.now();
  if (!room.running && !room.pausedForTurn && !room.holdPaused && !room.activeAction && hasActiveDelayCountdown(room) && canStartClock(room)) {
    room.running = true;
  }
  pushLog(room, "All timers resumed.");
}

function copyDelay(delay) {
  if (!delay) return null;
  return JSON.parse(JSON.stringify(delay));
}

function migrateRoomDelays(room) {
  for (const unit of room.units) {
    require('./console-hold').reconcile(unit);
    migrateUnitCombat(unit);
    ensureNpcHp(unit);
    if (!Array.isArray(unit.queuedEffects)) unit.queuedEffects = [];
    if (!unit.delay) continue;
    if (unit.delay.kind === "action") {
      unit.delayedAction = unit.delayedAction || unit.delay;
    } else if (unit.delay.kind === "queued") {
      unit.delayedAction = unit.delayedAction || unit.delay;
    } else {
      unit.delayTimer = unit.delayTimer || unit.delay;
    }
    delete unit.delay;
  }
}

function hasDelay(unit) {
  return Boolean(unit?.medbayTreatment || unit?.delayTimer || unit?.delayedAction || unit?.delay || unit?.pendingTimedResolutions?.length || hasTimedAction(unit));
}

function activeDelay(unit) {
  return unit?.delayTimer || unit?.delayedAction || unit?.delay || null;
}

function hasActiveDelayCountdown(room) {
  return room.units.some((unit) =>
    (unit.delayTimer && !unit.delayTimer.resolving) ||
    (unit.delayedAction && !unit.delayedAction.resolving) ||
    (unit.delay && !unit.delay.resolving) ||
    (Array.isArray(unit.queuedEffects) && unit.queuedEffects.some((effect) => !effect.resolving)) ||
    hasCombatCountdown(unit),
  );
}

function usesCommandWindow(unit, source) {
  return source === "clock" && unit?.team === "pc" && unit?.commandWindow;
}

function pauseForReadyUnit(room, unit, source = "clock") {
  if (!unit || unit.consoleHold || room.pausedForTurn) return;
  unit.turnSerial=(Number(unit.turnSerial)||0)+1;
  const carriedCommand = unit.commandCarrySeconds;
  room.pausedForTurn = true;
  room.running = false;
  room.activeId = unit.id;
  room.activeSource = source;
  room.commandExpired = false;
  room.holdPaused = false;
  room.holdStartedAt = null;
  room.commandHeldRemaining = null;
  unit.commandCarrySeconds = null;
  if (usesCommandWindow(unit, source)) {
    room.commandTotal = unit.commandWindow;
    room.commandDeadline = Date.now() + Math.max(0, carriedCommand ?? unit.commandWindow) * 1000;
  } else {
    room.commandTotal = 0;
    room.commandDeadline = null;
  }
  pushLog(room, usesCommandWindow(unit, source)
    ? `${unit.characterName} is ready. Command Window started (${unit.commandWindow} sec).`
    : `${unit.characterName} is ready.`);
}

function interruptActiveTurn(room) {
  const interrupted = room.units.find((unit) => unit.id === room.activeId);
  if (interrupted) {
    interrupted.atb = Math.max(0, interrupted.atb - room.threshold);
    room.lastInterruptedId = interrupted.id;
    room.lastInterruptedAt = Date.now();
    pushLog(room, `${interrupted.characterName}'s action was interrupted!`);
  }
  room.activeId = null;
  room.pausedForTurn = false;
  clearActiveCommand(room);
}

function pauseForDelayedAction(room, unit, source = "clock") {
  if (!unit || room.pausedForTurn) return;
  clearActiveCommand(room);
  room.pausedForTurn = true;
  room.running = false;
  room.activeId = null;
  room.activeAction = {
    id: unit.delayedAction?.id || id(),
    unitId: unit.id,
    characterName: unit.characterName,
    playerName: unit.playerName,
    label: normalizeDelayLabel(unit.delayedAction?.label, unit.delayedAction?.kind || "action"),
    kind: unit.delayedAction?.kind || "action",
  };
  room.activeSource = source;
  pushLog(room, `${room.activeAction.kind === "queued" ? "Resolve Queued Setup" : "Resolve Action"}: ${room.activeAction.label}.`);
}

function pauseForQueuedEffect(room, unit, effect, source = "clock") {
  if (!unit || !effect || room.pausedForTurn) return;
  clearActiveCommand(room);
  room.pausedForTurn = true;
  room.running = false;
  room.activeId = null;
  room.activeAction = {
    id: effect.id,
    unitId: unit.id,
    effectId: effect.id,
    characterName: unit.characterName,
    playerName: unit.playerName,
    label: normalizeDelayLabel(effect.label, "queued"),
    kind: "queuedEffect",
  };
  room.activeSource = source;
  pushLog(room, `Resolve Queued Effect: ${room.activeAction.label}.`);
}

function requestDelay(room, unit, kind, requestedBy = "player") {
  if (!unit || room.activeId !== unit.id) return;
  if (requestedBy !== "player" && !delayConsoleAllowed(room)) {
    pushLog(room, "Pause Everything before opening the Delay Console.");
    return;
  }
  holdCommandWindow(room);
  room.delayRequest = {
    id: id(),
    unitId: unit.id,
    kind: normalizeDelayKind(kind),
    characterName: unit.characterName,
    playerName: unit.playerName,
    requestedAt: Date.now(),
  };
  pushLog(room, requestedBy === "gm" ? `GM opened Delay Console for ${unit.characterName}.` : `${unit.characterName} requested a Delay.`);
}

function cancelDelayRequest(room) {
  if (!room.delayRequest) return;
  clearDelayRequest(room);
  if (room.holdPaused && room.commandHeldRemaining !== null && room.commandDeadline) {
    room.commandDeadline = Date.now() + Math.max(0, room.commandHeldRemaining || 0) * 1000;
  }
  room.holdPaused = false;
  room.holdStartedAt = null;
  room.commandHeldRemaining = null;
  pushLog(room, "Delay request cancelled.");
}

function startUnitDelay(room, unit, { kind = "timer", rate = 1, label = "", settings = null, queuedEffect = null } = {}) {
  if (!unit) return;
  const isRequestedDelay = room.delayRequest?.unitId === unit.id;
  if (!delayConsoleAllowed(room) && !isRequestedDelay) {
    pushLog(room, "Pause Everything before confirming a delay.");
    return;
  }
  const previousSource = room.activeSource;
  const wasActive = room.activeId === unit.id;
  const normalizedKind = normalizeDelayKind(kind);
  const cancelledTimedAction = cancelTimedActionForForcedDelay(unit);
  const nextDelay = {
    id: id(),
    kind: normalizedKind,
    label: normalizeDelayLabel(label, normalizedKind),
    rate: normalizeDelayRate(rate) || 1,
    settings: normalizeDelaySettings(settings),
    remaining: 100,
    total: 100,
    consumeTurn: wasActive,
    resolving: false,
    forceResetAfter: cancelledTimedAction,
  };
  if (normalizedKind === "queued") {
    nextDelay.queuedEffect = normalizeQueuedEffect(queuedEffect);
    unit.delayedAction = nextDelay;
  } else if (normalizedKind === "action") {
    unit.delayedAction = nextDelay;
  } else {
    unit.delayTimer = nextDelay;
  }
  clearDelayRequest(room);
  pushLog(room, `${unit.characterName} started ${nextDelay.kind === "queued" ? `Queued Effect setup: ${nextDelay.label}` : nextDelay.kind === "action" ? `Delayed Resolution: ${nextDelay.label}` : "Reload/Recovery"} at ${nextDelay.rate}.`);
  if (wasActive) {
    room.pausedForTurn = false;
    room.activeId = null;
    room.activeAction = null;
    clearActiveCommand(room);
    moveToNextTurnOrClock(room, previousSource);
  }
}

function updateUnitDelay(room, unit, { delayId = "", kind = "timer", rate = 1, label = "", settings = null } = {}) {
  if (!unit || !delayConsoleAllowed(room)) {
    pushLog(room, "Pause Everything before changing a delay.");
    return;
  }
  const normalizedKind = normalizeDelayKind(kind);
  const delay = normalizedKind === "timer" ? unit.delayTimer : unit.delayedAction;
  if (!delay || (delayId && delay.id !== delayId)) {
    pushLog(room, "That delay is no longer active.");
    return;
  }
  delay.rate = normalizeDelayRate(rate) || delay.rate || 1;
  delay.label = normalizeDelayLabel(label, normalizedKind);
  delay.settings = normalizeDelaySettings(settings);
  delay.kind = normalizedKind;
  pushLog(room, `${unit.characterName}'s ${normalizedKind === "action" ? "Delayed Resolution" : "Reload/Recovery"} was changed to ${delay.rate}.`);
}

function resolveInstantDelay(room, unit, { kind = "timer", label = "" } = {}) {
  if (!unit) return;
  const previousSource = room.activeSource;
  const wasActive = room.activeId === unit.id;
  const normalizedKind = normalizeDelayKind(kind);
  const resolvedLabel = normalizeDelayLabel(label, normalizedKind);
  clearDelayRequest(room);
  if (wasActive) {
    unit.atb = Math.max(0, unit.atb - room.threshold);
    room.pausedForTurn = false;
    room.activeId = null;
    room.activeAction = null;
    clearActiveCommand(room);
    pushLog(room, normalizedKind === "action"
      ? `Instant Resolution: ${resolvedLabel}.`
      : `${unit.characterName}'s Delay resolved instantly.`);
    moveToNextTurnOrClock(room, previousSource);
    return;
  }
  pushLog(room, normalizedKind === "action"
    ? `Instant Resolution: ${resolvedLabel}. No delay created.`
    : `${unit.characterName}'s Delay resolved instantly. No delay created.`);
}

function moveToNextTurnOrClock(room, previousSource = null) {
  if(transitPending(room)){room.lastTick=Date.now();return;}
  for (const unit of room.units) {
    if (unit.defeatedAt) continue;
    for (const thrown of (unit.thrownEffects || []).filter(effect => effect.resolving)) {
      if (resolveCompletedEvent(room, { type: "thrown", unit, effect: thrown }, nextTurnSource(room, previousSource))) return;
    }
    for (const queued of (unit.queuedEffects || []).filter(effect => effect.resolving)) {
      if (resolveCompletedEvent(room, { type: "queued", unit, effect: queued }, nextTurnSource(room, previousSource))) return;
    }
    if (unit.delayedAction?.resolving && !unit.delayedAction.awaitingRoll) {
      if (resolveCompletedEvent(room, { type: "delayed", unit, delay: unit.delayedAction }, nextTurnSource(room, previousSource))) return;
    }
    for (const timedAction of [...(unit.pendingTimedResolutions || [])]) {
      if (resolveCompletedEvent(room, { type: "timed", unit, timedAction }, nextTurnSource(room, previousSource))) return;
    }
  }
  const ready = findReadyUnit(room);
  if (ready) {
    pauseForReadyUnit(room, ready, nextTurnSource(room, previousSource));
  } else if (room.resumeAfterTurn && canStartClock(room)) {
    room.running = true;
    room.lastTick = Date.now();
  } else {
    room.running = false;
    room.lastTick = Date.now();
  }
}

function applyOxygenEvents(room,events){
  let resumeSource;
  for(const event of events){
    const unit=room.units.find(u=>u.id===event.unitId);
    if(unit){
      unit.damageEvent={...event,applied:5,rawDamage:5,reduction:0,maximumHp:unit.maximumHp,source:'Lack of oxygen',createdAt:Date.now()};
      if(event.unconscious){
        unit.oxygenUnconscious=true;unit.defeatedAt||=Date.now();unit.atb=0;unit.consoleHold=null;
        unit.delayedAction=null;unit.delayTimer=null;unit.timedAction=null;unit.pendingShipRolls=[];unit.pendingTimedResolutions=[];unit.travelRoute=[];unit.queuedEffects=[];
        cancelNpcDefeat(room.roomCode,unit.id);
        const affectedAttack=room.attackResolution&&[room.attackResolution.attackerId,room.attackResolution.defenderId].includes(unit.id);
        const affectedItem=removeUnitFromCombatObjects(room,unit.id);
        if(affectedAttack){room.attackResolution=null;clearAttackCommand(room);}
        if(room.activeId===unit.id||room.activeAction?.unitId===unit.id||affectedAttack||affectedItem){resumeSource=room.activeSource||'manual';room.activeId=null;room.activeAction=null;room.pausedForTurn=false;clearActiveCommand(room);}
        if(room.delayRequest?.unitId===unit.id)clearDelayRequest(room);
      }
    }
    pushLog(room,`${event.name} lost 5 HP from lack of oxygen.${event.unconscious?' Unconscious; oxygen damage stopped.':''}`,{starshipId:event.shipId});
  }
  if(resumeSource!==undefined)moveToNextTurnOrClock(room,resumeSource);
}

function addProgress(room, seconds, { slow = false, skipId = null } = {}) {
  const multiplier = slow ? 0.2 : 1;
  const campaign=campaignApi?.campaignCache.get(room.roomCode);
  if(campaign)applyOxygenEvents(room,shipOxygen.advance(room.starships,shipOxygen.people(campaign,room),seconds*multiplier));
  const medicalPending=crewRooms.pending(room);
  if(crewRooms.advance(room,campaign,seconds*multiplier)&&!medicalPending)scheduleRoomPersist(room,0);
  const shieldBusy = new Set(room.units.filter(u => u.shieldRestabilizing).map(u => u.id));
  for (const ship of room.starships || []) shipMaintenance.advance(ship,seconds*multiplier);
  shipShields.advance(room, seconds * multiplier);
  shipWeapons.advance(room, seconds * multiplier);
  const missileWait=shipMissiles.pending(room);
  if(shipProbes.advance(room,seconds*multiplier))scheduleRoomPersist(room,0);
  transitEvents(room,shipTransit.advance(room,seconds*multiplier));
  const beforeShipMovement=shipDistances.positions(room.starships,room.shipPositions).map(p=>({...p}));
  shipNavigation.advance(room, seconds * multiplier);
  for(const message of require('./ship-breaches').advance(room,seconds*multiplier,campaign))pushLog(room,message);
  for(const message of room.gravityReports||[])pushLog(room,message);room.gravityReports=[];
  if(shipProbes.maintainRange(room))scheduleRoomPersist(room,0);
  shipProbes.reconcile(room);
  require('./ship-field-utilities').advance(room,seconds*multiplier);

  require('./ship-breach-drones').advance(room,seconds*multiplier);
  if(shipDrones.advance(room,seconds*multiplier))scheduleRoomPersist(room,0);
  recordShipReports(room,()=>shipMissiles.advance(room,seconds*multiplier));
  if(!missileWait&&shipMissiles.pending(room))scheduleRoomPersist(room,0);
  shipHacking.refresh(room);
  recordShipReports(room,()=>shipCommands.advance(room, seconds * multiplier,beforeShipMovement));
  recordShipReports(room,()=>shipLocks.refresh(room,seconds * multiplier));
  shipShields.refresh(room);
  shipSensors.refresh(room);
  shipSensors.advance(room, seconds * multiplier, limit=>require('node:crypto').randomInt(limit));
  // Freeze the shot against positions at the charge boundary, after this tick's movement.
  for(const report of shipCleanser.advance(room,seconds*multiplier)){pushLog(room,report);scheduleRoomPersist(room,0);}
  const completedEvents = [];
  tickAreaEffects(room, seconds, multiplier);
  for (const unit of room.units) {
    if (unit.id === skipId || unit.defeatedAt || !unit.speed || crewRooms.inTreatment(room,unit.characterId||unit.id)) continue;
    const wasTimed = hasTimedAction(unit);
    for (const event of tickCombatTimers(unit, seconds, multiplier, room)) {
      if (event.type === "timed") {
        if (event.timedAction.kind === "firstAid") {
          // Another event can claim the GM prompt first. Retain completed
          // treatment in saved state until its own resolution is dispatched.
          unit.pendingTimedResolutions ||= [];
          unit.pendingTimedResolutions.push(event.timedAction);
          completedEvents.push(event);
        } else if (event.timedAction.kind === "defense") {
          pushLog(room, `${unit.characterName}'s Defense ended.`);
        } else {
          pushLog(room, `${unit.characterName} completed ${event.timedAction.label}.`);
        }
      } else {
        completedEvents.push(event);
      }
    }
    if (unit.characterId && unit.regenerationRate > 0) {
      unit.regenerationProgress = (Number(unit.regenerationProgress) || 0) + unit.regenerationRate * seconds * multiplier;
      const healing = Math.floor(unit.regenerationProgress / 100);
      if (healing > 0) {
        unit.regenerationProgress %= 100;
        applyHealingToUnit(room, unit, healing, unit.regenerationLabel || "Healing ATB").catch(() => {});
      }
    }
    if (unit.characterId && unit.recurringHealingInterval > 0 && unit.recurringHealingAmount > 0) {
      unit.recurringHealingProgress = (Number(unit.recurringHealingProgress) || 0) + seconds * multiplier;
      const intervals = Math.floor(unit.recurringHealingProgress / unit.recurringHealingInterval);
      if (intervals > 0) {
        unit.recurringHealingProgress %= unit.recurringHealingInterval;
        const healing = intervals * unit.recurringHealingAmount;
        applyHealingToUnit(room, unit, healing, unit.recurringHealingLabel || "Regeneration").catch(() => {});
      }
    }
    if (Array.isArray(unit.queuedEffects)) {
      for (const effect of unit.queuedEffects) {
        if (effect.resolving) continue;
        const impairmentMultiplier = Math.max(0, 1 - (Math.max(0, Math.min(2, Number(effect.impairments) || 0)) * 0.1));
        effect.progress = Math.min(100, (Number(effect.progress) || 0) + effect.rate * impairmentMultiplier * seconds * multiplier);
        if (effect.progress >= 100) {
          effect.progress = 100;
          effect.resolving = true;
          completedEvents.push({ type: "queued", unit, effect });
        }
      }
    }
    if (unit.delayTimer) {
      if (!unit.delayTimer.resolving) {
        unit.delayTimer.remaining = Math.max(0, unit.delayTimer.remaining - unit.delayTimer.rate * seconds * multiplier);
        if (unit.delayTimer.remaining <= 0) {
          const shouldConsumeTurn = unit.delayTimer.consumeTurn && !unit.delayedAction;
          if (shouldConsumeTurn || unit.delayTimer.forceResetAfter) unit.atb = Math.max(0, unit.atb - room.threshold);
          unit.delayTimer = null;
          pushLog(room, `${unit.characterName}'s Reload/Recovery ended.`);
        }
      }
      continue;
    }
    if (unit.delayedAction) {
      if (!unit.delayedAction.resolving) {
        unit.delayedAction.remaining = Math.max(0, unit.delayedAction.remaining - unit.delayedAction.rate * seconds * multiplier);
        if (unit.delayedAction.remaining <= 0) {
          unit.delayedAction.remaining = 0;
          unit.delayedAction.resolving = true;
          completedEvents.push({ type: "delayed", unit, delay: unit.delayedAction });
        }
      }
      continue;
    }
    if (wasTimed || hasTimedAction(unit) || unit.pendingTimedResolutions?.length || shieldBusy.has(unit.id) || unit.shieldRestabilizing) continue;
    if (unit.atb < room.threshold) unit.atb += effectiveSpeed(unit) * seconds * multiplier;
  }
  return completedEvents;
}

function shipRollSpec(room,unit,pending){
  if(pending.breachRepair)return pending.rollSpec;
  if(pending.transporterOrder)return require('./ship-transporter').rollSpec(room,unit,pending.transporterOrder);
  if(pending.probeOrder)return shipProbes.rollSpec(room,unit,pending.probeOrder);
  if(pending.lockOrder)return shipLocks.rollSpec(room,unit,pending.lockOrder);
  if(pending.weaponOrder)return shipWeapons.rollSpec(room,unit,pending.weaponOrder);
  const order=pending.sensorOrder||pending.commandOrder||pending.maintenanceOrder,ship=room.starships.find(s=>s.id===order?.shipId);
  let sides=[],bonus=0,skill='Sensor Systems',difficulty={value:null,label:'Difficulty unknown'};
  if(!ship)return {sides,bonus,skill,difficulty:null,difficultyLabel:'System unavailable'};
  if(pending.sensorOrder){sides=shipSensors.installed(ship)?.dice||[];bonus=shipSensors.skill(unit);difficulty=shipSensors.difficulty(room,ship.id,order.kind,order.targetId,order.hex);}
  else if(pending.maintenanceOrder){const item=ship?.ship.sicInventory.find(i=>i.id===order.sicId),d=shipMapCore.definition(item?.type),sensor=d.sensor||d.darkveil||d.lockOn;skill=sensor?'Sensor Systems':d.weapon?'Weapon Systems':d.bridge?'Computer Systems':'Engineering';bonus=Number(sensor?unit.sensorSkill:d.weapon?unit.weaponSystemsSkill:d.bridge?unit.computerSkill:unit.engineeringSkill)||Number(unit.mentalSkill)||0;sides=unit.team==='npc'&&!unit.shipAi?require('./combat-engine').npcAttributeDice(unit.mentalAttribute):unit.intellectDice||[];difficulty={value:Math.max(10,Number(item?.repairDifficulty)||10),label:'Repair difficulty '+Math.max(10,Number(item?.repairDifficulty)||10)};}
  else{const propulsion=shipMapCore.propulsion(ship);skill='Pilot/Helm';sides=Array(propulsion?.evadeCount||0).fill(propulsion?.evadeDie||4);bonus=Number(unit.pilotSkill??unit.mentalSkill)||0;}
  if(!pending.maintenanceOrder){const matching=(ship?.commandSystems?.preparations||[]).filter(p=>p.action===order.kind&&p.remaining>0),teams=matching.filter(p=>p.kind==='team'&&p.unitId!==unit.id&&room.units.some(u=>u.id===p.unitId&&!u.defeatedAt));sides=[...sides,...teams.flatMap(()=>sides)];bonus=Math.max(bonus,...teams.map(p=>p.skill))+matching.filter(p=>p.kind==='calculation').length*2+(teams.length?teams.length+1:0);}
  const retryBonus=pending.sensorOrder?.kind==='analysis'?ship.sensorState?.failures?.[order.targetId]||0:0;
  const checks=pending.sensorOrder?shipSensors.scanChecks(room,order):[];if(checks.length){difficulty={value:Math.max(...checks.map(c=>c.difficulty)),label:'Difficulty '+checks.map(c=>c.difficulty).join(' / ')};}
  return {sides,bonus:bonus+retryBonus,retryBonus,skill,difficulty:difficulty.value,difficultyLabel:difficulty.label};
}
function recordActionResult(unit, value) {
  unit.actionResults=[...(unit.actionResults||[]).filter(r=>r.id!==value.id),{...value,at:new Date().toISOString()}].slice(-40);
}
function resolveCompletedEvent(room,event,source){
  const pending=event?.type==='delayed'?event.unit?.delayedAction:null,effect=event?.effect;
  const ship=room.starships.find(s=>s.id===(pending?.sensorOrder?.shipId||pending?.commandOrder?.shipId||pending?.weaponOrder?.shipId||event?.unit?.location?.starshipId));
  const reports=()=>[...(ship?.sensorState?.reports||[]),...(ship?.weaponState?.reports||[]),...(ship?.lockState?.reports||[])];
  const previous=new Set(reports());
  const result=resolveCompletedEventInner(room,event,source);
  if(event?.unit&&(((pending?.rollConfirmed||pending?.sensorOrder)&&event.unit.delayedAction!==pending)||(event?.type==='queued'&&effect?.sensorReport))){
    const fresh=reports().filter(r=>!previous.has(r));
    recordActionResult(event.unit,{id:`${pending?.id||effect.id}:complete`,label:pending?.label||effect.label,
      text:fresh.map(r=>r.text).join(' ')||'Action resolved.',total:pending?.submittedRoll?pending.submittedRoll.score+(pending.submittedRoll.retryBonus||0):fresh[0]?.total,
      controller:pending?.rollController||effect?.rollController||'player',stage:'complete'});
  }
  return result;
}
function resolveCompletedEventInner(room, event, source) {
  if (!event) return false;
  const stored=event.unit?.delayedAction?.submittedRoll;
  if(stored&&!event.rollDie){let index=0;event.rollDie=sides=>stored.values[index++]??require('node:crypto').randomInt(1,sides+1);event.rollDie.submittedScore=stored.score;event.rollDie.retryBonus=stored.retryBonus;}
  const pending=event.type==='delayed'&&event.unit.delayedAction;
  if(pending?.missileOrder){recordShipReports(room,()=>shipMissiles.resolveInput(room,event.unit));event.unit.atb=Math.max(0,event.unit.atb-room.threshold);scheduleRoomPersist(room,0);return false;}
  if(pending?.weaponDamage)return false;
  const needsRoll=pending&&(pending.breachRepair||pending.lockOrder||pending.weaponOrder||pending.maintenanceOrder||pending.probeOrder?.kind==='scan'||(pending.transporterOrder?.risk>0||pending.transporterOrder?.scramblers?.length>0)||['area','hex','analysis','life','lifeArea'].includes(pending.sensorOrder?.kind)||['evade','ram','skim'].includes(pending.commandOrder?.kind));
  if(needsRoll&&!pending.rollConfirmed&&shipSensors.automaticScan(room,event.unit,pending.sensorOrder)===null&&!pending.sensorOrder?.trigger&&!pending.commandOrder?.trigger){
    pending.awaitingRoll=true;pending.resolving=true;
    if(!pending.rollAnnounced){pending.rollAnnounced=true;pushLog(room,`${event.unit.characterName}: roll required for ${pending.label}.`,{starshipId:event.unit.location?.starshipId});}
    return false;
  }
  if (event.type === 'delayed' && (event.unit.delayedAction?.shipOrder?.trigger || event.unit.delayedAction?.sensorOrder?.trigger)) {
    recordShipReports(room,()=>shipCommands.armExternal(room,event.unit,event.unit.delayedAction.shipOrder ? 'pilot' : 'sensor'));
    event.unit.atb=Math.max(0,event.unit.atb-room.threshold);
    return false;
  }
  if (event.type === 'delayed' && event.unit.delayedAction?.weaponOrder) {
    const random = sides => require('node:crypto').randomInt(1,sides+1);
    recordShipReports(room,()=>shipWeapons.resolveInput(room,event.unit,event.rollDie || random,random));
    if(pending.consumeTurn!==false)event.unit.atb=Math.max(0,event.unit.atb-room.threshold);
    // A manual damage wait stops the periodic clock saves; persist its new stage now.
    scheduleRoomPersist(room,0);
    return false;
  }
  if(event.type==='delayed'&&event.unit.delayedAction?.lockOrder){recordShipReports(room,()=>shipLocks.resolve(room,event.unit,event.rollDie));event.unit.atb=Math.max(0,event.unit.atb-room.threshold);return false;}
  if(event.type==='delayed'&&pending?.breachRepair){require('./ship-breaches').resolveRepair(room,event.unit,event.rollDie);event.unit.atb=Math.max(0,event.unit.atb-room.threshold);return false;}
  if (event.type === 'delayed' && event.unit.delayedAction?.maintenanceOrder) {
    recordShipReports(room,()=>shipMaintenance.resolve(room,event.unit,event.rollDie || (sides=>require('node:crypto').randomInt(1,sides+1))));
    event.unit.atb=Math.max(0,event.unit.atb-room.threshold);
    return false;
  }
  if (event.type === 'delayed' && event.unit.delayedAction?.commandOrder) {
    recordShipReports(room,()=>shipCommands.resolveInput(room,event.unit,event.rollDie || (sides=>require('node:crypto').randomInt(1,sides+1))));
    shipShields.refresh(room);
    event.unit.atb = Math.max(0,event.unit.atb-room.threshold);
    return false;
  }
  if(event.type==='delayed'&&event.unit.delayedAction?.transporterOrder){recordShipReports(room,()=>require('./ship-transporter').resolve(room,event.unit));event.unit.atb=Math.max(0,event.unit.atb-room.threshold);return false;}
  if(event.type==='delayed'&&event.unit.delayedAction?.probeOrder){recordShipReports(room,()=>shipProbes.resolveInput(room,event.unit));event.unit.atb=Math.max(0,event.unit.atb-room.threshold);return false;}
  if (event.type === 'delayed' && event.unit.delayedAction?.sensorOrder) {
    recordShipReports(room,()=>shipSensors.resolveInput(room,event.unit,event.rollDie || (sides=>require('node:crypto').randomInt(1,sides+1))));
    event.unit.atb = Math.max(0,event.unit.atb-room.threshold);
    return false;
  }
  if (event.type === 'queued' && event.effect.sensorReport) {
    recordShipReports(room,()=>shipSensors.resolveReport(room,event.unit,event.effect));
    return false;
  }
  if(event.type==='delayed' && event.unit.delayedAction?.shipOrder){
    const result=shipNavigation.resolveInput(room,event.unit);
    event.unit.atb=Math.max(0,event.unit.atb-room.threshold);
    pushLog(room,`${event.unit.characterName}: ${result.ok ? `pilot input complete; ${result.ship.title} moving${result.cost ? ` (${result.cost} AU)` : ''}` : result.error}`);
    return false;
  }
  if (event.type === "queued") {
    pauseForQueuedEffect(room, event.unit, event.effect, source);
    return true;
  }
  if (event.type === "thrown") {
    if (event.effect.specialType === "smoke") {
      activateSmokeEffect(room, event.unit, event.effect);
      return false;
    }
    clearActiveCommand(room);
    room.pausedForTurn = true;
    room.running = false;
    room.activeId = null;
    room.activeAction = {
      id: event.effect.id,
      unitId: event.unit.id,
      effectId: event.effect.id,
      characterName: event.unit.characterName,
      playerName: event.unit.playerName,
      label: event.effect.label,
      kind: "thrownEffect",
    };
    room.activeSource = source;
    pushLog(room, `Resolve Detonation: ${event.effect.label}.`);
    return true;
  }
  if (event.type === "timed") {
    if (event.timedAction?.kind === "firstAid") {
      event.unit.pendingTimedResolutions = (event.unit.pendingTimedResolutions || []).filter(action => action.id !== event.timedAction.id);
      return beginFirstAidResolution(room, event.unit, event.timedAction, source);
    }
    return false;
  }
  pauseForDelayedAction(room, event.unit, source);
  return true;
}

function advanceSeconds(room, seconds = 1, { exact = false, source = "clock" } = {}) {
  if(transitPending(room))return;
  if((shipOxygen.pending(room.starships)||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)))return;
  if (room.pausedForTurn || room.holdPaused) return;
  if (room.units.some(u => !u.defeatedAt && (u.pendingTimedResolutions?.length ||
      u.delayedAction?.resolving || u.queuedEffects?.some(e => e.resolving) || u.thrownEffects?.some(e => e.resolving)))) {
    moveToNextTurnOrClock(room, source);
    if (room.pausedForTurn || room.units.some(u => u.delayedAction?.awaitingRoll || u.pendingShipRolls?.length)) return;
  }

  const interruptedId = room.commandExpired ? room.activeId : null;

  if (!exact) {
    seconds=Math.min(seconds,Math.max(.000001,Math.min(shipOxygen.nextEvent(room.starships),transitBoundary(room))/(interruptedId?.2:1)));
    const completedEvents = addProgress(room, seconds, { slow: Boolean(interruptedId), skipId: interruptedId });
    for (const event of completedEvents) {
      if (resolveCompletedEvent(room, event, source)) {
        if (interruptedId) interruptActiveTurn(room);
        return;
      }
    }
    const ready = findReadyUnit(room, interruptedId);
    if (ready) {
      if (interruptedId) interruptActiveTurn(room);
      pauseForReadyUnit(room, ready, source);
    }
    return;
  }

  const alreadyReady = findReadyUnit(room, interruptedId);
  if (alreadyReady) {
    if (interruptedId) interruptActiveTurn(room);
    pauseForReadyUnit(room, alreadyReady, source);
    return;
  }

  const times = room.units
    .filter((unit) => unit.speed > 0 && !unit.defeatedAt && !unit.medbayTreatment && unit.id !== interruptedId)
    .flatMap((unit) => {
      const multiplier = interruptedId ? 0.2 : 1;
      const effectTimes = Array.isArray(unit.queuedEffects)
        ? unit.queuedEffects
          .filter((effect) => !effect.resolving)
          .map((effect) => {
            const impairmentMultiplier = Math.max(0, 1 - (Math.max(0, Math.min(2, Number(effect.impairments) || 0)) * 0.1));
            const speed = effect.rate * multiplier * impairmentMultiplier;
            return speed > 0 ? Math.max(0, (100 - (Number(effect.progress) || 0)) / speed) : Infinity;
          })
        : [];
      const timerTimes = combatEventTimes(unit, multiplier);
      const delay = activeDelay(unit);
      if (delay && !delay.resolving) return [...effectTimes, ...timerTimes, Math.max(0, delay.remaining / (delay.rate * multiplier))];
      if (delay) return [...effectTimes, ...timerTimes, Infinity];
      if (hasTimedAction(unit) || unit.pendingTimedResolutions?.length) return [...effectTimes, ...timerTimes];
      const speed = effectiveSpeed(unit) * multiplier;
      return [...effectTimes, ...timerTimes, speed > 0 ? Math.max(0, (room.threshold - unit.atb) / speed) : Infinity];
    })
    .filter((time) => Number.isFinite(time));
  const oxygenTime=shipOxygen.nextEvent(room.starships)/(interruptedId?.2:1);
  if(Number.isFinite(oxygenTime))times.push(oxygenTime);
  const transitTime=transitBoundary(room)/(interruptedId?.2:1);if(Number.isFinite(transitTime))times.push(transitTime);
  if (!times.length) { addProgress(room, seconds, {slow:Boolean(interruptedId),skipId:interruptedId}); return; }

  const nextReadyIn = Math.min(...times);
  if (nextReadyIn <= seconds) {
    // Floating-point leftovers can underflow to a zero-second event boundary.
    // A bounded microsecond of progress lets due timers finish instead of
    // repeatedly choosing that same boundary and freezing the entire room.
    const boundarySeconds = Math.min(seconds, Math.max(nextReadyIn, 0.000001));
    const completedEvents = addProgress(room, boundarySeconds, { slow: Boolean(interruptedId), skipId: interruptedId });
    if (interruptedId) interruptActiveTurn(room);
    for (const event of completedEvents) {
      if (resolveCompletedEvent(room, event, source)) return;
    }
    const ready = findReadyUnit(room);
    if (ready) pauseForReadyUnit(room, ready, source);
  } else {
    addProgress(room, seconds, { slow: Boolean(interruptedId), skipId: interruptedId });
  }
}

function scheduleAutomation(room, seconds=.1){
  if(roomActionQueues.has(room.roomCode)||room.automationBusy)return;
  if(!(room.showcase&&room.attackResolution?.phase==='gmDamage')&&!room.units.some(u=>require('./ship-automation').active(u)||u.delayedAction?.automated)&&!shipTargets.flights(room).some(m=>m.automated&&m.phase==='impact'))return;
  room.automationBusy=true;
  const work=Promise.resolve().then(()=>require('./automation-runner').step(room,seconds,{
    act:async body=>{let data,status;const response={writeHead(code){status=code;this.statusCode=code;},end(text){data=JSON.parse(text);this.writableEnded=true;}};await handleRoomAction({...body,roomCode:room.roomCode},response,true);return {ok:status>=200&&status<300,error:data?.error};},
    publish:()=>{broadcast(room);scheduleRoomPersist(room,0);},
    off:(unit,reason)=>{unit.automationNotice=reason;unit.automationMode='off';if(unit.shipAi){const ship=room.starships.find(s=>s.id===unit.location?.starshipId),item=ship&&shipAi.enabled(ship);if(item)crewRooms.roomData(ship,item.id).automationMode='off';}pushLog(room,`${unit.characterName}: ${reason}`,{starshipId:unit.location?.starshipId});}
  })).catch(error=>console.error('Automation:',error.message)).finally(()=>{room.automationBusy=false;if(roomActionQueues.get(room.roomCode)===work)roomActionQueues.delete(room.roomCode);});
  roomActionQueues.set(room.roomCode,work);
}
setInterval(() => {
  for (const room of rooms.values()) {
    const inputNow = Date.now(), inputElapsed = (inputNow - (room.lastInputTick || inputNow)) / 1000;
    room.lastInputTick = inputNow;
    if (roomPreparations.has(room.roomCode)) { room.lastTick = Date.now(); continue; }
    if(shipCleanser.finish(room)){pushLog(room,cleanserPlayerResult(room.planetaryEvent)||room.planetaryEvent.targetName+' destroyed. Simulated damage: '+room.planetaryEvent.damage.toLocaleString()+'.');broadcast(room);room.lastTick=Date.now();scheduleRoomPersist(room,0);}
    if(shipCleanser.pending(room)){if(room.commandDeadline)room.commandDeadline+=inputElapsed*1000;if(room.attackResolution?.defenderCommandDeadline)room.attackResolution.defenderCommandDeadline+=inputElapsed*1000;room.lastTick=Date.now();broadcast(room,true);continue;}
    migrateRoomDelays(room);
    const hadAuInput = room.starships.some(s => s.auCommands?.length);
    const completedAu = shipShields.advanceInputs(room, inputElapsed);
    for (const event of completedAu) {
      const operator = room.units.find(u => u.id === event.unitId);
      pushLog(room, `${operator?.characterName || 'Operator'} completed shield ${event.kind === 'restore' ? 'restoration' : 'reinforcement'}.`, { starshipId: event.shipId });
    }
    if (hadAuInput) { broadcast(room); if (!roomPersistTimers.has(room.roomCode)) scheduleRoomPersist(room); }
    if (room.hardPaused) continue;
    scheduleAutomation(room,inputElapsed);
    if((transitPending(room)||shipOxygen.pending(room.starships)||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length))){
      if(room.commandDeadline)room.commandDeadline+=inputElapsed*1000;
      if(room.attackResolution?.defenderCommandDeadline)room.attackResolution.defenderCommandDeadline+=inputElapsed*1000;
      room.lastTick=Date.now();broadcast(room,true);continue;
    }
    const defenseCommand = attackCommandState(room);
    if (defenseCommand && room.attackResolution?.defenderCommandDeadline) {
      if (Date.now() >= room.attackResolution.defenderCommandDeadline) {
        room.attackResolution.defenderCommandExpired = true;
        room.attackResolution.defenderCommandDeadline = null;
        room.attackResolution.defenderCommandHeldRemaining = null;
        const defender = room.units.find((entry) => entry.id === room.attackResolution.defenderId);
        if (defender) pushLog(room, defender.characterName + "'s Defense Command Window expired; the GM may resolve it.");
      }
      broadcast(room,true);
      if (Date.now() - room.lastPersistRequestAt >= 2000) {
        room.lastPersistRequestAt = Date.now();
        scheduleRoomPersist(room, 0);
      }
      continue;
    }
    if (room.attackResolution || room.itemResolution) continue;
    if (room.pausedForTurn && room.commandDeadline && !room.holdPaused) {
      if (Date.now() >= room.commandDeadline) {
        const unit = room.units.find((entry) => entry.id === room.activeId);
        room.pausedForTurn = false;
        room.running = true;
        room.commandExpired = true;
        room.commandDeadline = null;
        room.lastTick = Date.now();
        if (unit) pushLog(room, `${unit.characterName}'s Command Window expired.`);
      }
      broadcast(room,true);
      if (Date.now() - room.lastPersistRequestAt >= 2000) {
        room.lastPersistRequestAt = Date.now();
        scheduleRoomPersist(room, 0);
      }
      continue;
    }
    if (!room.running || room.pausedForTurn || room.holdPaused || room.hardPaused) continue;
    const now = Date.now();
    const elapsed = now - room.lastTick;
    if (elapsed < 80) continue;
    room.lastTick = now;
    advanceSeconds(room, elapsed / 1000, { exact: true, source: "clock" });
    broadcast(room,true);
    if (now - room.lastPersistRequestAt >= 2000) {
      room.lastPersistRequestAt = now;
      scheduleRoomPersist(room, 0);
    }
  }
}, 100);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const absolute = resolvePublicAsset(PUBLIC_DIR, url.pathname);
  if (!absolute) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  require('./static-response').serve(req,res,absolute,contentType(absolute));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, status, data) {
  data = visibleEncounter(data,res.sensorViewer);
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
  res.end(JSON.stringify(data));
}

async function handleCreateRoom(req, res) {
  try {
    await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Bad JSON" });
    return;
  }
  const room = createRoom();
  sendJson(res, 200, publicState(room));
  broadcast(room);
}

function preparedUnit(body, threshold) {
  const unit = {
    id: body.team === "npc" && body.npcRosterId ? body.npcRosterId : id(),
    playerName: String(body.playerName || "GM").trim().slice(0, 40),
    characterName: String(body.characterName || "Character").trim().slice(0, 40),
    speed: normalizeSpeed(body.speed), commandWindow: normalizeCommandWindow(body.commandWindow),
    atb: Math.max(0, Math.min(threshold - 0.001, Number(body.initialAtb) || 0)),
    encounterSpeedBonus: 0, regenerationRate: Math.max(0, Math.min(100, Number(body.regenerationRate) || 0)),
    regenerationLabel: String(body.regenerationLabel || "").slice(0, 80),
    regenerationProgress: 0, recurringHealingProgress: 0,
    delay: null, delayTimer: null, delayedAction: null, queuedEffects: [],
    controlledBy: body.team === "pc" ? "player" : "gm", team: body.team,
    allyNpc: body.team === "npc" && Boolean(body.allyNpc), actorType: "character",
    color: normalizeColor(body.color), tieSeed: Math.random(),
    characterId: body.team === "pc" ? String(body.characterId) : "", playerConnected: false,
  };
  syncUnitCombat(unit, body);
  ensureNpcHp(unit);
  return unit;
}

async function prepareEncounter(room, body) {
  const receipt = room.preparations?.find(entry => entry.id === body.preparationId);
  if (receipt) {
    if (receipt.fingerprint !== preparationFingerprint(body)) throw Object.assign(new Error("This preparation ID was already used for a different setup."), { status: 409 });
    return;
  }
  const campaign = await campaignApi.campaign(room.roomCode);
  if(room.hasEngagedClock&&!room.encounterEndedAt&&(body.confirmCampaignName!==campaign.name||body.expectedEncounterId!==room.encounterId))throw Object.assign(new Error('An encounter is active. Confirm the campaign name and current encounter before replacing it.'),{status:409});
  const prepared = validatePreparation(body, campaign, normalizeEncounterStarships);
  if(room.units.length)await campaignApi.checkpoint(campaign,'Before encounter replacement',snapshotRoom(room));
  const candidate = createRoom(room.roomCode, null, false);
  candidate.showcase = room.showcase;
  candidate.starships = prepared.starships;
  for(const ship of candidate.starships){
    const source=(!room.encounterEndedAt&&room.hasEngagedClock?room.starships:campaign.starships).find(s=>s.id===ship.id)?.ship;
    if(source){ship.ship.fabricationState=clone(source.fabricationState||null);for(const printed of (source.sicInventory||[]).filter(i=>i.printed))if(!ship.ship.sicInventory.some(i=>i.id===printed.id))ship.ship.sicInventory.push(clone(printed));ship.ship.devastationState=clone(source.devastationState||null);ship.ship.blackHoleGunState=clone(source.blackHoleGunState||null);ship.ship.oxygenEnabled=source.oxygenEnabled!==false;ship.ship.oxygenState=clone(source.oxygenState||null);}
  }
  if (candidate.showcase) for (const ship of candidate.starships) {
    const masking = room.starships.find(previous => previous.id === ship.id)?.sensorScenarioMasking;
    if (Number.isFinite(masking)) ship.sensorScenarioMasking = masking;
  }
  for(const ship of candidate.starships){require('./ship-state').apply(ship,(!room.encounterEndedAt&&room.hasEngagedClock?room.starships:campaign.starships).find(s=>s.id===ship.id));if(ship.ship.missileState)ship.ship.missileState.flights=[];}
  candidate.shipDistances = prepared.shipDistances;
  candidate.shipPositions = prepared.shipPositions;
  candidate.planetaryEvent=null;
  candidate.cleanserScars=[];
  candidate.spaceObjects = prepared.spaceObjects;
  candidate.units = prepared.units.map(unit => preparedUnit(unit, candidate.threshold));
  candidate.units.forEach((unit,index)=>{
    if(unit.team!=='npc')return;
    const input=prepared.units[index],previous=room.units.find(u=>u.team==='npc'&&u.id===(input.npcRosterId||input.preparationUnitId));
    if(previous&&!candidate.units.some(other=>other!==unit&&other.id===previous.id))unit.id=previous.id;
  });
  for (const unit of candidate.units) {
    const previous = unit.characterId && room.units.find(entry => entry.characterId === unit.characterId);
    if (previous) {
      unit.id = previous.id;
      unit.liveConnections = previous.liveConnections || 0;
      unit.playerConnected = Boolean(previous.playerConnected);
    }
  }
  shipAi.sync(candidate,preparedUnit);
  candidate.preparations = [...(room.preparations || []), { id: body.preparationId, fingerprint: prepared.fingerprint }].slice(-100);
  shipPower.refresh(candidate);
  pushLog(candidate, "Encounter prepared and paused. Engage the clock when ready.");
  // Drain old writes before saving the replacement; never expose a partial roster.
  clearTimeout(roomPersistTimers.get(room.roomCode));
  roomPersistTimers.delete(room.roomCode);
  await roomPersistWrites.get(room.roomCode)?.catch(() => {});
  if (!await campaignApi.saveEncounter(room.roomCode, snapshotRoom(candidate))) throw new Error("Campaign could not be saved.");
  cancelRoomNpcDefeats(room.roomCode);
  Object.assign(room, candidate, { lastTick: Date.now() });
  broadcast(room);
  void campaignApi.broadcast(room.roomCode).catch(() => {});
}

async function handleAction(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Bad JSON" });
    return;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) { sendJson(res, 400, { error: "An action object is required." }); return; }
  const code = String(body.roomCode || "").trim().toUpperCase();
  const previous = roomActionQueues.get(code) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => handleRoomAction(body, res));
  roomActionQueues.set(code, pending);
  try { await pending; }
  catch (error) {
    console.error(`Encounter action failed in ${code}:`, error.message);
    if (!res.writableEnded) sendJson(res, 500, { error: "The encounter action could not be completed. Please retry." });
  } finally {
    if (roomActionQueues.get(code) === pending) roomActionQueues.delete(code);
  }
}

async function handleRoomAction(body, res, automated = false) {

  const room = getRoom(body.roomCode) || await ensureCampaignRoom(body.roomCode);
  if (!room) {
    sendJson(res, 404, { error: "Room not found" });
    return;
  }
  migrateRoomDelays(room);

  const action = body.action;
  const previousRolls=new Map(room.units.map(u=>[u.id,u.delayedAction?.id]));
  const previousAttack=room.attackResolution?.id,previousItem=room.itemResolution?.id;
  const gmAuthorized = automated || await campaignApi?.verifyGmAccess(room.roomCode, body.gmToken);
  const playerUnit = body.id
    ? room.units.find((entry) => entry.id === body.id)
    : body.characterId ? room.units.find((entry) => entry.characterId === String(body.characterId)) : null;
  const characterAuthorized = Boolean(body.characterId)
    && await campaignApi?.verifyCharacterAccess(room.roomCode, String(body.characterId), body.characterToken);
  const playerAuthorized = playerUnit?.characterId
    && playerUnit.characterId === String(body.characterId || "")
    && characterAuthorized;
  res.sensorViewer = { gm:Boolean(gmAuthorized), characterId:characterAuthorized ? String(body.characterId) : null };
  if(!gmAuthorized&&((room.attackResolution?.rollController==='gm'&&playerUnit?.id===room.attackResolution.attackerId&&['submitAttackRoll','submitAttackDamage'].includes(action))||(room.itemResolution?.rollController==='gm'&&['submitFirstAidRoll','submitFirstAidHealing'].includes(action)))){
    sendJson(res,403,{error:'The GM is resolving this action.'});return;
  }
  if(action==='hackAlertAnimationComplete'){
    const ship=room.starships.find(s=>s.id===body.starshipId),viewer=room.units.find(u=>u.characterId===String(body.characterId));
    if(!gmAuthorized&&!(characterAuthorized&&ship&&ship.crewCharacterIds?.includes(String(body.characterId)))){sendJson(res,403,{error:'Only the defending crew or GM may resolve this check.'});return;}
    try{require('./ship-countermeasures').finish(room,body.starshipId,body.rollId);scheduleRoomPersist(room,0);broadcast(room);sendJson(res,200,{ok:true});}catch(e){sendJson(res,409,{error:e.message});}return;
  }
  if(action==='automationAnimationComplete'){
    const missile=shipTargets.flights(room).find(m=>m.id===body.rollId&&m.automated),holder=missile||playerUnit;
    const show=holder?.automationPresentation,sourceId=missile?.sourceId||playerUnit?.location?.starshipId;
    const viewer=room.units.find(u=>u.characterId===String(body.characterId));
    if(!gmAuthorized&&!(characterAuthorized&&(viewer?.location?.starshipId===sourceId||room.showcase))){sendJson(res,403,{error:'This roll is not visible to this character.'});return;}
    if(!show||show.id!==body.rollId){sendJson(res,409,{error:'This automatic roll has ended.'});return;}
    show.animationComplete=true;scheduleRoomPersist(room,0);sendJson(res,200,{ok:true});return;
  }
  if(body.expectedEncounterId&&body.expectedEncounterId!==room.encounterId&&!(action==='prepareEncounter'&&gmAuthorized&&room.preparations?.some(r=>r.id===body.preparationId&&r.fingerprint===preparationFingerprint(body)))){sendJson(res,409,{error:'The encounter changed in another tab. Refresh before sending this action.'});return;}
  if(gmAuthorized&&action==='clearEncounter'&&room.units.length){const campaign=await campaignApi.campaign(room.roomCode);if(body.confirmCampaignName!==campaign.name||body.expectedEncounterId!==room.encounterId){sendJson(res,409,{error:'Type the campaign name to confirm clearing the current encounter.'});return;}}
  if(gmAuthorized&&['clearEncounter','exitEncounter','reset','undoLastAction','undoLastTiming'].includes(action))await campaignApi.checkpoint(await campaignApi.campaign(room.roomCode),'Before '+action,snapshotRoom(room));
  const joiningPlayer = action === "join" && body.controlledBy === "player";
  if (joiningPlayer) {
    const allowed = body.characterId && await campaignApi?.verifyCharacterAccess(room.roomCode, String(body.characterId), body.characterToken);
    if (!allowed) {
      sendJson(res, 403, { error: "Unlock this campaign character before joining the encounter." });
      return;
    }
  } else if (["cleanserDamage","crewRoomCommand","crewRoomResolve","missileDamage", "transitCommand", "hackingCommand", "counterHackSwap", "utilityCommand", "acknowledgeVictory", "lockCommand", "weaponCommand", "rollShipAction", "shipMaintenance", "shipCommand", "sensorCommand", "shieldCommand", "completeTurn", "requestDelay", "logPlayerAction", "setColor", "characterSpeedBoost", "playerCombatAction", "syncCharacterLoadout", "submitAttackRoll", "submitAttackDamage", "submitFirstAidRoll", "submitFirstAidHealing", "stopTravel", "operateCombatDoor", "operateAirlock", "repairHullBreach"].includes(action) && playerUnit) {
    if (!playerAuthorized && !gmAuthorized) {
      sendJson(res, 403, { error: "Character or GM authorization is required." });
      return;
    }
  } else if (action === "refreshCharacterVersion" || action === 'missileDamage' || action === 'crewRoomResolve') {
    if (!characterAuthorized && !gmAuthorized) {
      sendJson(res, 403, { error: "Character or GM authorization is required." });
      return;
    }
  } else if (!gmAuthorized) {
    sendJson(res, 403, { error: "GM authorization is required for that encounter control." });
    return;
  }
  if(shipCleanser.pending(room)&&!['cleanserDamage','reset','undoLastAction','undoLastTiming','exitEncounter','join','refreshCharacterVersion','syncCharacterLoadout','setColor','setShipColor'].includes(action)){sendJson(res,409,{error:'Planetary Cleanser firing sequence in progress.'});return;}
  if(!automated&&require('./ship-automation').active(playerUnit)&&['weaponCommand','sensorCommand','lockCommand','shipCommand','shipMaintenance','playerCombatAction','completeTurn','hackingCommand','utilityCommand','shieldCommand','transitCommand'].includes(action)){sendJson(res,409,{error:'Turn automation off before choosing this actor’s actions manually.'});return;}
  if(!automated&&playerUnit?.delayedAction?.automated&&action==='rollShipAction'){sendJson(res,409,{error:'Automation is resolving this roll.'});return;}
  if(action==='cleanserDamage'){
    try{shipCleanser.resolve(room,body,{gm:gmAuthorized,unit:playerAuthorized?playerUnit:null});}
    catch(error){sendJson(res,409,{error:error.message});return;}
    scheduleRoomPersist(room,0);broadcast(room,true);sendJson(res,200,publicState(room));return;
  }
  if (action === "prepareEncounter") {
    // Concurrent retries share the first transaction, then check its saved receipt.
    while (roomPreparations.has(room.roomCode)) await roomPreparations.get(room.roomCode).catch(() => {});
    const preparation = prepareEncounter(room, body);
    roomPreparations.set(room.roomCode, preparation);
    try {
      await preparation;
      sendJson(res, 200, publicState(room));
    } catch (error) {
      sendJson(res, error.status || 400, { error: error.message });
    } finally {
      roomPreparations.delete(room.roomCode);
    }
    return;
  }
  if (roomPreparations.has(room.roomCode)) {
    sendJson(res, 409, { error: "Encounter preparation is being saved. Please try again in a moment." });
    return;
  }
  if (playerUnit && (playerUnit.defeatedAt || playerUnit.oxygenUnconscious || (playerUnit.currentHp != null && Number(playerUnit.currentHp) <= 0)) &&
      ['hackingCommand','utilityCommand','weaponCommand','sensorCommand','lockCommand','shipCommand','shieldCommand','shipMaintenance','playerCombatAction','gmBeginNpcAttack','requestDelay','startDelay','instantDelay','completeTurn','characterSpeedBoost','operateCombatDoor','operateAirlock','repairHullBreach'].includes(action)) {
    sendJson(res, 409, {error:'This character is unconscious and cannot act.'}); return;
  }
  if(shipOxygen.pending(room.starships)&&['weaponCommand','sensorCommand','lockCommand','shipCommand','shieldCommand','shipMaintenance','playerCombatAction','gmBeginNpcAttack','requestDelay','startDelay','instantDelay','completeTurn','characterSpeedBoost'].includes(action)){
    sendJson(res,409,{error:'Resolve the pending Health + Endurance oxygen checks before taking another action.'});return;
  }
  shipHacking.refresh(room);
  if(transitPending(room)&&['weaponCommand','sensorCommand','lockCommand','shipCommand','shieldCommand','playerCombatAction','startDelay','completeTurn','hackingCommand'].includes(action)){
    sendJson(res,409,{error:'Resolve the pending damage before taking another action.'});return;
  }
  if(playerUnit&&['weaponCommand','sensorCommand','lockCommand','shipCommand','shieldCommand','hackingCommand','utilityCommand'].includes(action)){
    const access=require('./station-access').access(room,playerUnit,body.sicId),ship=access?.ship||room.starships.find(s=>s.id===playerUnit.location?.starshipId);
    if(ship?.escapedAt||ship?.ship.warpState?.phase==='traveling'){sendJson(res,409,{error:'This ship has left combat in warp.'});return;}
    if(ship?.ship.warpState?.phase==='activating'&&action==='shipCommand'&&['move','evade','ram','skim'].includes(body.kind)){sendJson(res,409,{error:'Cancel warp activation before moving the ship.'});return;}
  }
  if(playerUnit&&playerUnit.shipAi&&['playerCombatAction','setCombatLocation','operateCombatDoor','stopTravel'].includes(action)){sendJson(res,409,{error:'Ship AI cannot leave its bridge station.'});return;}
  if(playerUnit&&crewRooms.inTreatment(room,playerUnit.characterId||playerUnit.id)&&['playerCombatAction','setCombatLocation','weaponCommand','shipCommand','sensorCommand','lockCommand','hackingCommand','utilityCommand','crewRoomCommand'].includes(action)&&!(action==='crewRoomCommand'&&body.kind==='wake')){sendJson(res,409,{error:'Use Wake Now in the Hibernation Chamber before acting or moving.'});return;}
  if(!['cleanserDamage','reset','undoLastAction','undoLastTiming','syncCharacterLoadout','syncEncounterStarships'].includes(action)){
    // Commit the checkpoint only for successful requests; failed validation and retries keep the previous undo.
    const checkpoint=snapshotRoom(room),before=JSON.stringify(checkpoint),campaignBefore=campaignApi.campaignCache.get(room.roomCode);
    checkpoint.characterResources=(campaignBefore?.characters||[]).map(c=>({id:c.id,exertion:c.character.resources?.exertionCurrent}));
    const end=res.end;
    res.end=function(...args){
      if(res.statusCode>=200&&res.statusCode<300&&JSON.stringify(snapshotRoom(room))!==before){room.undoSnapshot=checkpoint;room.undoLabel=action;}
      return end.apply(this,args);
    };
  }
  if(action==='setAutomation'){
    if(!gmAuthorized||!playerUnit||playerUnit.team!=='npc'){sendJson(res,403,{error:'GM authorization and an NPC are required.'});return;}
    try{if(playerUnit.shipAi)shipAi.configure(room,room.starships.find(s=>s.id===playerUnit.location?.starshipId),body.mode);else {if(!['off','npc'].includes(body.mode))throw Error('Choose NPC automation or Off.');playerUnit.automationMode=body.mode;}playerUnit.automationSuspended=false;playerUnit.automationNotice='';}catch(e){sendJson(res,409,{error:e.message});return;}
  }
  if(action==='crewRoomResolve'){
    try{const campaign=await campaignApi.campaign(room.roomCode);crewRooms.resolve(room,campaign,body,{gm:gmAuthorized,characterId:characterAuthorized?String(body.characterId):null});await campaignApi.save(campaign);room.lastTick=Date.now();moveToNextTurnOrClock(room,room.activeSource||'clock');}catch(error){sendJson(res,409,{error:error.message});return;}
  }
  if(action==='crewRoomCommand'){
    try{const campaign=await campaignApi.campaign(room.roomCode);const aiSettings=body.kind==='configure'&&room.starships.some(s=>s.id===body.starshipId&&s.ship.sicInventory.some(i=>i.id===body.sicId&&shipMapCore.definition(i.type).shipAi));if(!aiSettings&&(transitPending(room)||shipOxygen.pending(room.starships)||room.attackResolution||room.itemResolution||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)))throw Error('Resolve pending dice before starting treatment.');const result=crewRooms.command(room,playerUnit,body,{campaign,gm:gmAuthorized});if(result.spent&&!result.duplicate){playerUnit.atb=Math.max(0,playerUnit.atb-room.threshold);const source=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);pushLog(room,result.text,{starshipId:body.starshipId});moveToNextTurnOrClock(room,source);}scheduleRoomPersist(room,0);}catch(error){sendJson(res,409,{error:error.message});return;}
  }
  if(action==='missileDamage'){
    const missile=shipTargets.flights(room).find(m=>m.id===body.missileId);
    if(missile?.automated&&!automated){sendJson(res,409,{error:'Automation is resolving this missile.'});return;}
    if(!missile||(!gmAuthorized&&(!characterAuthorized||missile.controller==='gm'||missile.characterId!==String(body.characterId)))){sendJson(res,403,{error:'The launching player or GM must resolve this damage.'});return;}
    const damageCampaign=await campaignApi.campaign(room.roomCode);
    const result=recordShipReports(room,()=>shipMissiles.resolveDamage(room,body.missileId,Number(body.score),damageCampaign));
    if(!result.ok){sendJson(res,409,{error:result.error});return;}
    if(result.podInjuries)await campaignApi.save(damageCampaign);
    room.lastTick=Date.now();moveToNextTurnOrClock(room,room.activeSource||'clock');
  }
  if(action==='transitCommand'){
    const ship=room.starships.find(s=>s.id===(body.shipId||body.starshipId));
    try{
      if(!ship)throw Error('Ship not found.');
      if(['warpStart','destructApprove'].includes(body.kind)&&(transitPending(room)||room.attackResolution||room.itemResolution||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)))throw Error('Resolve the pending dice before starting another action.');
      if(body.kind==='warpPlan'){
        const access=require('./station-access').access(room,playerUnit,body.sicId);
        if(!access||access.blocked||access.ship.id!==ship.id)throw Error('Use an accessible warp console.');
        sendJson(res,200,{result:shipTransit.plan(ship,Number(body.distanceLY),{sicId:body.sicId})});return;
      }
      let result;
      if(body.kind==='blastRoll'){
        const pending=ship.ship.destructState;
        if(!gmAuthorized&&pending?.unitId!==playerUnit?.id)throw Error('The initiating crewmember or GM must roll blast damage.');
        if(pending?.id!==body.blastId)throw Error('That detonation is no longer pending.');
        result=shipTransit.resolveBlast(room,ship.id,Number(body.score));
      }else result=shipTransit.command(room,playerUnit,body);
      if(!result.ok)throw Error(result.error);
      transitEvents(room,result.events);
      if(result.spent&&!result.duplicate){
        playerUnit.atb=Math.max(0,playerUnit.atb-room.threshold);const source=room.activeSource;
        room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);moveToNextTurnOrClock(room,source);
      }
      room.lastTick=Date.now();
    }catch(error){sendJson(res,409,{error:error.message});return;}
  }
  if(playerUnit&&['utilityCommand','weaponCommand','sensorCommand','lockCommand','shipCommand','shieldCommand'].includes(action)){
    const ship=room.starships.find(s=>s.id===playerUnit.location?.starshipId);
    if(ship?.hackedSystems?.some(h=>h.bridge||h.sicId===body.sicId)){
      sendJson(res,409,{error:'Console compromised. Electronic controls are locked. Move to the SIC for local power-off or reboot.'});return;
    }
  }
  if (action === "undoLastAction" || action === "undoLastTiming" || action === 'reset') {
    const resources=room.undoSnapshot?.characterResources;
    const restored = restoreUndoSnapshot(room);
    if(!restored){sendJson(res,409,{error:'No previous action is available to undo.'});return;}
    if(resources){const campaign=await campaignApi.campaign(room.roomCode);for(const saved of resources){const record=campaign?.characters.find(c=>c.id===saved.id);if(record&&Number.isFinite(saved.exertion)){record.character.resources||={};record.character.resources.exertionCurrent=saved.exertion;}}if(campaign)await campaignApi.save(campaign);}
    if (restored) {
      await Promise.all(room.units.flatMap((unit) => (
        unit.characterId && Number.isFinite(Number(unit.currentHp))
          ? [campaignApi?.setCharacterCombatHp(room.roomCode, unit.characterId, unit.currentHp)]
          : []
      )));
    }
    sendJson(res, 200, publicState(room));
    broadcast(room);
    scheduleRoomPersist(room, 0);
    return;
  }

  if (action === "submitAttackRoll") {
    const attack = room.attackResolution;
    const rollRole = String(body.rollRole || "");
    const field = rollRole === "attacker" ? "attackerRoll" : rollRole === "defender" ? "defenseRoll" : "";
    if (!attack || attack.id !== String(body.attackId || "") || attack.phase !== "checks" || !field || attack[field]) {
      sendJson(res, 409, { error: "That attack roll is no longer waiting." });
      return;
    }
  }
  if (action === "submitFirstAidRoll") {
    const resolution = room.itemResolution;
    if (!resolution || resolution.id !== String(body.resolutionId || "") || resolution.phase !== "roll" || resolution.roll) {
      sendJson(res, 409, { error: "That First Aid roll is no longer waiting." }); return;
    }
  }
  if (action === "submitFirstAidHealing") {
    const resolution = room.itemResolution;
    if (!resolution || resolution.id !== String(body.resolutionId || "") || resolution.phase !== "healing" || resolution.healingRoll) {
      sendJson(res, 409, { error: "That healing roll is no longer waiting." }); return;
    }
  }
  if (action === "submitAttackDamage") {
    const attack = room.attackResolution;
    if (!attack || attack.id !== String(body.attackId || "") || attack.phase !== "damage" || attack.damageRoll) {
      sendJson(res, 409, { error: "That Damage roll is no longer waiting." });
      return;
    }
  }


  if (action === "syncEncounterStarships") {
    if (!Array.isArray(body.starships) || body.starships.length > 6 || new Set(body.starships.map(ship => ship.id)).size !== body.starships.length) { sendJson(res, 400, { error: "Choose up to six different starships." }); return; }
    for (const record of body.starships) { const error=shipMapCore.exteriorError(record.ship); if(error) {sendJson(res,400,{error});return;} }
    const conditions=new Map((room.starships||[]).map(s=>[s.id,new Map((s.ship.sicInventory||[]).map(i=>[i.id,i]))]));
    const gravity=new Map((room.starships||[]).map(s=>[s.id,s.ship.gravityEnabled!==false]));const previousEnvironment=new Map(room.starships.map(s=>[s.id,s.ship]));
    const previous = new Map((room.starships || []).map(ship => [ship.id, Object.fromEntries(['auState','navigation','shieldSystems','auCommands','shieldReceipts','sensorState','weaponState','lockState','destroyedAt','escapedAt','victoryAt','sensorScenarioMasking','commandSystems','maintenanceReceipts','currentHullHp','currentShieldHp'].map(key => [key,ship[key]]))]));
    room.starships = normalizeEncounterStarships(body.starships);
    room.starships.forEach(ship => { if (previous.has(ship.id)) Object.assign(ship, previous.get(ship.id)); });
    for(const ship of room.starships)if(previousEnvironment.has(ship.id))for(const key of ['airlocks','airlockStates','breachState','breachDroneState','encounterState','extractionState','salvagedAt','blackHoleGunState','fabricationState','devastationState','cleanserState','atmosphereState','cloakState','gravityFieldState','mapColor','mapHeading','warpState','destructState','warpFuel','minerals','transitReceipts','missileState','missileAmmo','missileStorage','crewRoomState','fieldState','droneState','probeState','surveillanceState','doorDamage','transporterState','intruderState'])ship.ship[key]=clone(previousEnvironment.get(ship.id)[key]??null);
    for(const ship of room.starships)if(gravity.has(ship.id)){ship.ship.gravityEnabled=gravity.get(ship.id);const previousShip=previousEnvironment.get(ship.id);ship.ship.oxygenEnabled=previousShip?.oxygenEnabled!==false;ship.ship.oxygenState=clone(previousShip?.oxygenState||null);}
    for(const ship of room.starships)for(const item of ship.ship.sicInventory||[]){
      const old=conditions.get(ship.id)?.get(item.id);
      if(old)for(const key of ['impaired','impairmentPoints','repairDifficulty','disabled','status','bootRemaining','unstable'])if(key in old)item[key]=old[key];
    }
    for(const ship of room.starships)if(previousEnvironment.has(ship.id))require('./ship-state').apply(ship,{ship:previousEnvironment.get(ship.id)},{restoreRuntime:false});
    shipShields.refresh(room);
    room.shipPositions = shipDistances.positions(room.starships, room.shipPositions);
    room.shipDistances = shipDistances.fromPositions(room.starships, room.shipPositions);
    pushLog(room, `${room.starships.length} starship${room.starships.length === 1 ? "" : "s"} synchronized for combat.`);
  }

  if (action === "setCombatLocation") {
    const unit = room.units.find((entry) => entry.id === String(body.id || ""));
    if (!unit) { sendJson(res, 404, { error: "Combatant not found." }); return; }
    const destination = body.location || {};
    const occupied = room.units.filter((entry) => entry.id !== unit.id && entry.location?.starshipId === destination.starshipId && Number(entry.location?.square) === Number(destination.square) && Number(entry.location?.mesh) === Number(destination.mesh)).length;
    const destinationShip=room.starships.find(s=>s.id===destination.starshipId);
    const cell=destinationShip&&shipMapCore.buildLayout(destinationShip.ship).footprint.get(Number(destination.square));
    const isStation=cell?.stations.some(p=>p.x===cell.column&&p.y===cell.row&&p.mesh===Number(destination.mesh));
    if(occupied&&isStation){sendJson(res,409,{error:'That station is already occupied.'});return;}
    if (occupied >= 2) { sendJson(res, 409, { error: "That location already holds two characters." }); return; }
    // Relocation changes position, not the character's movement, skills or equipment.
    syncUnitCombat(unit, { ...unit, location: { ...destination, sicId: cell?.sicId || '', stationed: Boolean(isStation) } });
    shipShields.refresh(room);
    if (unit.shieldRestabilizing && room.activeId === unit.id) {
      const source = room.activeSource;
      room.activeId = null; room.pausedForTurn = false; clearActiveCommand(room);
      moveToNextTurnOrClock(room, source);
    }
    if(unit.delayedAction?.shipOrder){
      const pending=unit.delayedAction.shipOrder,seated=shipNavigation.station(room,unit,pending.sicId);
      if(!seated||seated.ship.id!==pending.shipId||seated.cell.sicId!==pending.sicId||(pending.station&&seated.key!==pending.station)){
        unit.delayedAction=null;unit.atb=Math.max(0,unit.atb-room.threshold);pushLog(room,`${unit.characterName}'s pilot input was interrupted.`);
      }
    }
    unit.travelRoute = [];
    unit.timedAction = null;
    pushLog(room, `${unit.characterName} was relocated by the GM.`);
  }

  if (action === "spendShipAu") {
    if (!shipPower.spend(room, String(body.starshipId || ""), Number(body.amount))) {
      sendJson(res, 409, { error: "The ship does not have that much AU available." }); return;
    }
    const ship = room.starships.find(record => record.id === body.starshipId);
    pushLog(room, `${ship.title} spent ${Number(body.amount)} AU.`, { starshipId: ship.id });
  }

  if (action === 'weaponCommand') {
    const result=shipWeapons.queue(room,playerUnit,body);
    if(!result.ok){sendJson(res,409,{error:result.error});return;}
    if(!result.duplicate){
      const source=room.activeSource;
      room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);
      pushLog(room,`${playerUnit.characterName} committed ${result.reload?"a missile reload":"a weapon firing order"}.`,{starshipId:result.ship.id});
      moveToNextTurnOrClock(room,source);
    }
  }
  if(action==='lockCommand'){
    const result=shipLocks.queue(room,playerUnit,body);
    if(!result.ok){sendJson(res,409,{error:result.error});return;}
    if(!result.duplicate&&!result.free){const source=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);pushLog(room,`${playerUnit.characterName}: ${playerUnit.delayedAction.label} - roll required.`,{starshipId:result.ship.id});moveToNextTurnOrClock(room,source);}
  }
  if (action === 'sensorCommand') {
    const ship=room.starships.find(s=>s.id===playerUnit?.location?.starshipId);
    const duplicate=ship?.sensorState?.receipts?.includes(String(body.requestId||''));
    let trigger=null;
    if(body.trigger&&!duplicate){
      if(!ship){sendJson(res,409,{error:'Choose a ship console.'});return;}
      const checked=shipCommands.validateTrigger(room,ship,body.trigger);
      if(!checked.ok){sendJson(res,409,{error:checked.error});return;}
      trigger=checked.trigger;
    }
    const result = shipSensors.queue(room,playerUnit,body);
    if (!result.ok) { sendJson(res,409,{error:result.error}); return; }
    if (!result.duplicate) {
      if(trigger)playerUnit.delayedAction.sensorOrder.trigger=trigger;
      const source = room.activeSource;
      room.activeId = null; room.pausedForTurn = false; clearActiveCommand(room);
      pushLog(room,`${playerUnit.characterName} started sensor input.`,{starshipId:result.ship.id});
      moveToNextTurnOrClock(room,source);
    }
  }
  if(action==='rollShipAction'){
    if(body.score!==undefined&&(!Number.isFinite(body.score)||Math.abs(body.score)>100000)){sendJson(res,400,{error:'Enter a valid roll score.'});return;}
    const submitted=Array.isArray(body.diceResults)?body.diceResults.slice(0,100):[];
    if(submitted.some(v=>!Number.isInteger(v)||v<1||v>100)){sendJson(res,400,{error:'Invalid dice values.'});return;}
    let dieIndex=0;const rollDie=sides=>submitted[dieIndex++]??require('node:crypto').randomInt(1,sides+1);rollDie.submittedScore=body.score;
    const pending=playerUnit?.delayedAction;
    if(playerUnit?.lastShipRoll?.id!==body.rollId){
      const queued=playerUnit?.pendingShipRolls?.find(r=>r.id===body.rollId);
      if(!queued&&(!pending?.awaitingRoll||pending.id!==body.rollId)){sendJson(res,409,{error:'That roll is no longer waiting.'});return;}
      const spec=queued?.rollSpec||pending?.rollSpec;
      if((queued?.rollController||pending?.rollController)==='gm'&&!gmAuthorized){sendJson(res,403,{error:'The GM is resolving this action.'});return;}
      if(!Number.isFinite(body.score)&&!submitted.length){sendJson(res,400,{error:'Roll the dice or enter your result before confirming.'});return;}
      const exertion=Number(body.exertion||0),exertionCampaign=await campaignApi.campaign(room.roomCode),exertionRecord=exertionCampaign?.characters.find(c=>c.id===playerUnit.characterId);
      const available=exertionRecord?Number(exertionRecord.character.resources?.exertionCurrent)||0:Number(playerUnit.exertionCurrent??1);
      if(!Number.isInteger(exertion)||exertion<0||exertion>available||(exertion&&(spec.damage||pending?.transporterOrder))){sendJson(res,400,{error:'Selected Exertion is unavailable for this roll. Reopen the dice.'});return;}
      const expectedSides=[...(spec?.sides||[]),...Array(exertion).fill(12)];
      if(submitted.length&&(submitted.length!==expectedSides.length||submitted.some((v,i)=>v>expectedSides[i]))){sendJson(res,400,{error:'Dice do not match the requested roll.'});return;}
      const ship=room.starships.find(s=>s.id===(queued?.breachDroneRoll?.shipId||queued?.extractionRoll?.shipId||queued?.breachCheck?.shipId||queued?.armed?.order?.shipId||pending?.weaponOrder?.shipId||pending?.weaponDamage?.shipId||playerUnit.location?.starshipId)),previous=ship?.sensorState?.reports?.[0];
      if(pending?.counterHack){
        try {
          const text=shipHacking.counterRoll(room,playerUnit,submitted[0]??body.score);
          const report={at:new Date().toISOString(),text,values:[submitted[0]??body.score],total:submitted[0]??body.score};
          if(ship)shipSensors.knowledge(ship).reports.unshift(report);
          moveToNextTurnOrClock(room,room.activeSource);
        }catch(error){sendJson(res,409,{error:error.message});return;}
      }else if(pending?.weaponDamage){
        const count=pending.weaponDamage.count,bonus=pending.weaponDamage.damageBonus||0,score=submitted.length?submitted.reduce((a,b)=>a+b,0)+bonus:body.score;
        if(!Number.isInteger(score)||score<count+bonus||score>count*(pending.weaponDamage.dieSides||4)+bonus){sendJson(res,400,{error:'Damage total is outside the requested dice range and bonus.'});return;}
        if(gmAuthorized)pending.rollController='gm';
        const damageCampaign=await campaignApi.campaign(room.roomCode),result=recordShipReports(room,()=>shipWeapons.resolveDamage(room,playerUnit,submitted,score,damageCampaign));
        if(result?.podInjuries)await campaignApi.save(damageCampaign);
      }else if(queued?.extractionRoll){
        if(exertion){sendJson(res,400,{error:'Exertion cannot change extraction chance dice.'});return;}
        const order=queued.extractionRoll,job=ship?.ship.extractionState?.jobs[order.sicId];
        if(!job||job.id!==order.jobId){sendJson(res,409,{error:'Extraction job no longer exists.'});return;}
        const result=require('./ship-extraction').resolve(room,ship,job,order.phase,submitted,exertionCampaign);
        shipSensors.knowledge(ship).reports.unshift({at:new Date().toISOString(),text:result.text,values:submitted});
      }else if(queued?.breachDroneRoll){
        if(exertion){sendJson(res,400,{error:'Exertion cannot change a drone repair roll.'});return;}
        try{pushLog(room,require('./ship-breach-drones').resolve(room,queued.breachDroneRoll,submitted));}catch(error){sendJson(res,409,{error:error.message});return;}
      }else if(queued?.breachCheck){
        const total=Number.isFinite(body.score)?body.score:shipSensors.fusedTotal(submitted)+(spec.bonus||0);
        require('./ship-breaches').resolveCheck(room,playerUnit,queued,total,submitted);
        if(playerUnit.vacuum&&room.activeId===playerUnit.id){room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);moveToNextTurnOrClock(room,room.activeSource);}
      }else if(queued){
        if(gmAuthorized){queued.rollController='gm';if(queued.armed.delayed)queued.armed.delayed.rollController='gm';queued.armed.order.rollController='gm';}
        const retry=queued.rollSpec?.retryBonus||0;if(Number.isFinite(rollDie.submittedScore))rollDie.submittedScore-=retry;rollDie.retryBonus=retry;
        const operator={...playerUnit,defeatedAt:null,location:queued.armed.location,timedAction:null,delayedAction:queued.armed.delayed,queuedEffects:playerUnit.queuedEffects ||= []};
        recordShipReports(room,()=>queued.armed.system==='sensor'?shipSensors.resolveInput(room,operator,rollDie):shipCommands.resolveInput(room,operator,rollDie,queued.armed.order));
        playerUnit.pendingShipRolls=playerUnit.pendingShipRolls.filter(r=>r!==queued);shipShields.refresh(room);
      }else{
        // Taking over an existing player roll also owns its follow-up rolls.
        if(gmAuthorized)pending.rollController='gm';
        pending.rollConfirmed=true;
        if(pending.rollBeforeDelay){
          const spec=pending.rollSpec||shipRollSpec(room,playerUnit,pending);
          const values=submitted;
          pending.submittedRoll={score:(Number.isFinite(body.score)?body.score:shipSensors.fusedTotal(values)+spec.bonus)-(spec.retryBonus||0),values,retryBonus:spec.retryBonus||0};
          // Apply once to this roll's factor-derived console input, never damage/cooldown clocks.
          const timingDifficulty=pending.sensorOrder?shipSensors.timingDifficulty(room,pending.sensorOrder,pending.submittedRoll.score+(spec.retryBonus||0)):spec.difficulty;
          pending.rollTiming=require('./delay-rules').afterRoll(pending.remaining/pending.rate,pending.submittedRoll.score+(spec.retryBonus||0),timingDifficulty);
          if(pending.rollTiming.seconds>0)pending.rate=pending.remaining/pending.rollTiming.seconds;
          pending.awaitingRoll=false;pending.resolving=false;
        }else resolveCompletedEvent(room,{type:'delayed',unit:playerUnit,rollDie},room.activeSource);
      }
      const report=ship?.sensorState?.reports?.[0];
      const resolved=report&&report!==previous?report:null;
      if(exertionRecord&&!queued?.extractionRoll&&!spec.damage&&Number.isFinite(body.score??resolved?.total)){require('./character-statistics').roll(exertionRecord.character,spec.skill||spec.attributeKey||'Ship Systems',body.score??resolved.total,body.rollId);await campaignApi.save(exertionCampaign);}
      if(exertion){if(exertionRecord){exertionRecord.character.resources.exertionCurrent=available-exertion;exertionRecord.updatedAt=new Date().toISOString();await campaignApi.save(exertionCampaign);}else playerUnit.exertionCurrent=available-exertion;}
      playerUnit.lastShipRoll={id:body.rollId,label:queued?.label||pending.label,text:resolved?.text||'Action completed.',values:resolved?.values||[],total:resolved?.total};
      const entering=Boolean(pending?.rollBeforeDelay&&playerUnit.delayedAction===pending);
      const damage=pending?.weaponDamage;
      recordActionResult(playerUnit,{id:`${body.rollId}:${entering?'input':'complete'}`,label:queued?.label||pending.label,
        text:entering?`Roll submitted. Operating the console: ${pending.rollTiming.seconds.toFixed(1)} seconds${pending.rollTiming.outcome!=='No fixed difficulty'?` (${pending.rollTiming.outcome} input timing; originally ${pending.rollTiming.baseSeconds.toFixed(1)} seconds)`:''}. Outcome follows input.`:damage?`Damage confirmed: ${submitted.length?submitted.reduce((a,b)=>a+b,0)+(damage.damageBonus||0):body.score}.`:resolved?.text||'Roll submitted.',
        total:Number.isFinite(body.score)?body.score:damage?submitted.reduce((a,b)=>a+b,0)+(damage.damageBonus||0):shipSensors.fusedTotal(submitted)+(spec.bonus||0),
        controller:gmAuthorized?'gm':'player',stage:entering?'input':'complete'});
    }
  }
  if (action === 'shipCommand') {
    const previousPositions=shipDistances.positions(room.starships,room.shipPositions).map(p=>({...p}));
    let result;recordShipReports(room,()=>{result=shipCommands.queue(room,playerUnit,body);});
    if (!result.ok) { sendJson(res,409,{error:result.error}); return; }
    if(result.free&&!result.duplicate)recordShipReports(room,()=>shipCommands.advance(room,0,previousPositions));
    if (!result.duplicate && !result.free) {
      const source = room.activeSource;
      room.activeId = null; room.pausedForTurn = false; clearActiveCommand(room);
      pushLog(room,`${playerUnit.characterName} started ${playerUnit.delayedAction.label}.`,{starshipId:result.ship.id});
      moveToNextTurnOrClock(room,source);
    }
  }
  if (action === 'sensorLifeReading') {
    // GM readings remain separate from player command input.
    const ship = room.starships.find(s => s.id === body.starshipId);
    const report = ship?.sensorState?.reports.find(r => r.lifeScan && r.pending && r.at === body.reportAt);
    const reading = String(body.reading || '').trim().slice(0,500);
    if (!report || !reading) { sendJson(res,409,{error:'Choose a pending life scan and enter an approximate biological reading.'}); return; }
    report.pending = false; report.text = `Life scan: ${reading}`;
  }
  if (action === 'shieldCommand') {
    const result = shipShields.command(room, playerUnit, body);
    if (!result.ok) { sendJson(res, 409, { error: result.error }); return; }
    if (!result.duplicate) {
      pushLog(room, `${playerUnit.characterName} ${body.kind === 'restabilize' ? 'started shield restabilization' : 'is entering a shield command'}.`, { starshipId: result.ship.id });
      if (room.units.some(u => u.id === room.activeId && u.shieldRestabilizing)) {
        const source = room.activeSource;
        room.activeId = null; room.pausedForTurn = false; clearActiveCommand(room);
        moveToNextTurnOrClock(room, source);
      }
    }
  }
  if(action==='hackingCommand'){
    try{
      const result=shipHacking.command(room,playerUnit,body);
      if(result.spent&&!result.duplicate){
        playerUnit.atb=Math.max(0,playerUnit.atb-room.threshold);
        const source=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);
        if(result.text)recordActionResult(playerUnit,{id:body.requestId,label:'Hacking',text:result.text,controller:gmAuthorized?'gm':'player',stage:'complete'});
        moveToNextTurnOrClock(room,source);
      }
    }catch(error){sendJson(res,409,{error:error.message});return;}
  }
  if(action==='counterHackSwap'){
    try{shipHacking.swap(room,playerUnit,body,gmAuthorized);}catch(error){sendJson(res,409,{error:error.message});return;}
  }
  if(action==='setShipColor'){
    if(!gmAuthorized){sendJson(res,403,{error:'GM access required.'});return;}
    const ship=room.starships.find(s=>s.id===body.shipId);if(!ship||!/^#[0-9a-f]{6}$/i.test(body.color||'')){sendJson(res,400,{error:'Choose a starship and valid glow color.'});return;}
    ship.ship.mapColor=body.color;const campaign=await campaignApi.campaign(room.roomCode),saved=campaign?.starships.find(s=>s.id===ship.id);if(saved){saved.ship.mapColor=body.color;await campaignApi.save(campaign);}
  }
  if(action==='utilityCommand'){
    if(transitPending(room)||shipOxygen.pending(room.starships)||room.attackResolution||room.itemResolution||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)){sendJson(res,409,{error:'Resolve pending dice before operating a utility.'});return;}
    const campaign=await campaignApi.campaign(room.roomCode);
    const result=require('./ship-utilities').setGravity(room,playerUnit,body,{gm:gmAuthorized,campaign});
    if(!result.ok){sendJson(res,409,{error:result.error});return;}
    if(!result.duplicate){
      if(!result.delayed)playerUnit.atb=result.resetAtb?0:Math.max(0,playerUnit.atb-room.threshold);
      const source=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);
      pushLog(room,result.text||`${playerUnit.characterName}: ${body.kind} ${result.enabled?'on':'off'} aboard ${result.ship.title}.`,{starshipId:result.ship.id});
      if(['launch-pod','rescue-pod'].includes(body.kind)){for(const live of room.starships){const saved=campaign.starships.find(s=>s.id===live.id);if(saved){saved.characterLocations=clone(live.characterLocations);saved.crewCharacterIds=clone(live.crewCharacterIds);saved.crewNpcUnitIds=clone(live.crewNpcUnitIds||[]);saved.ship.fieldState=clone(live.ship.fieldState);}}await campaignApi.save(campaign);}
      moveToNextTurnOrClock(room,source);
    }
  }
  if (action === 'shipMaintenance') {
    const result=shipMaintenance.queue(room,playerUnit,body);
    if(!result.ok){sendJson(res,409,{error:result.error});return;}
    if(!result.duplicate){
      if(result.immediate)playerUnit.atb=Math.max(0,playerUnit.atb-room.threshold);
      shipShields.refresh(room);shipSensors.refresh(room);
      const source=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);
      pushLog(room,`${playerUnit.characterName}: SIC ${body.kind}.`,{starshipId:result.ship.id});
      moveToNextTurnOrClock(room,source);
    }
  }
  if (action === 'damageStarship') {
    const damageType=body.damageType??'untyped';
    if(!['untyped','laser','heat','ballistic'].includes(damageType)){sendJson(res,400,{error:'Choose a valid ship damage type.'});return;}
    if (!shipShields.damage(room, String(body.starshipId || ''), Number(body.amount),{damageType})) { sendJson(res,400,{error:'Choose a ship and a nonnegative damage amount.'}); return; }
    pushLog(room, 'The GM applied '+(damageType==='untyped'?'':damageType+' ')+'damage to a starship.', { starshipId: String(body.starshipId) });
  }

  if (action === "setShipDistances") {
    sendJson(res, 409, { error: "Distances are calculated from hex positions. Set positions in encounter preparation." }); return;
  }

  if (action === "stopTravel") {
    if (!playerUnit || playerUnit.timedAction?.kind !== "move") { sendJson(res, 409, { error: "That character is not traveling." }); return; }
    playerUnit.timedAction = null;
    playerUnit.travelRoute = [];
    playerUnit.atb = room.threshold;
    pushLog(room, `${playerUnit.characterName} stopped moving and may act.`);
    if (!room.pausedForTurn) pauseForReadyUnit(room, playerUnit, "travel-stop");
  }

  if(action==='operateAirlock'||action==='repairHullBreach'){
    try{const breaches=require('./ship-breaches');if(action==='operateAirlock')pushLog(room,breaches.operate(room,playerUnit,body));else{breaches.queueRepair(room,playerUnit,body,await campaignApi.campaign(room.roomCode));const source=room.activeSource;room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);moveToNextTurnOrClock(room,source);}}catch(e){sendJson(res,409,{error:e.message});return;}
  }
  if (action === "operateCombatDoor") {
    const starship = (room.starships || []).find((entry) => entry.id === String(body.starshipId || ""));
    const key = String(body.doorKey || "");
    const cells = key.split(":").map(Number);
    const adjacent = cells.length === 2 && cells.every((cell) => Number.isInteger(cell) && starship?.ship?.gridCells?.includes(cell))
      && (Math.abs(cells[0] - cells[1]) === shipMapCore.gridColumns(starship) || (Math.abs(cells[0] - cells[1]) === 1 && Math.floor(cells[0] / shipMapCore.gridColumns(starship)) === Math.floor(cells[1] / shipMapCore.gridColumns(starship))));
    const isCrew = Boolean(playerUnit?.characterId && starship?.crewCharacterIds?.includes(playerUnit.characterId));
    if (!starship || !adjacent || !require('./ship-doors').list(starship).includes(key) || !require('./ship-doors').canOperate(starship,playerUnit,key)) { sendJson(res, 403, { error: "That door cannot be operated by this character." }); return; }
    if(require('./ship-doors').broken(starship,key)){sendJson(res,409,{error:'This door is broken open. Complete System Repairs and Diagnostics to repair it.'});return;}
    starship.ship.doorStates ||= {};
    starship.ship.doorStates[key] = starship.ship.doorStates[key] === "open" ? "closed" : "open";
    pushLog(room, `${playerUnit?.characterName || "GM"} ${starship.ship.doorStates[key] === "open" ? "opened" : "closed"} a door aboard ${starship.title}.`);
  }

  if (action === "join" || action === "addUnit") {
    room.encounterEndedAt = null;
    const playerName = String(body.playerName || "Player").trim().slice(0, 40);
    const characterName = String(body.characterName || "Character").trim().slice(0, 40);
    const speed = normalizeSpeed(body.speed);
    const commandWindow = normalizeCommandWindow(body.commandWindow);
    const existingCampaignUnit = action === "join" && body.characterId
      ? room.units.find((entry) => entry.characterId === String(body.characterId))
      : null;
    if ((room.starships || []).length && !existingCampaignUnit) {
      const destinationShip = room.starships.find((entry) => entry.id === String(body.location?.starshipId || ""));
      const destinationSquare = Number(body.location?.square);
      if (!destinationShip || !destinationShip.ship?.gridCells?.includes(destinationSquare)) {
        sendJson(res, 400, { error: "Every combatant in a starship encounter must begin aboard a selected starship." });
        return;
      }
    }
    if (existingCampaignUnit) {
      existingCampaignUnit.playerName = playerName;
      existingCampaignUnit.characterName = characterName;
      existingCampaignUnit.speed = speed;
      existingCampaignUnit.commandWindow = commandWindow;
      existingCampaignUnit.color = normalizeColor(body.color);
      existingCampaignUnit.controlledBy = "player";
      existingCampaignUnit.team = "pc";
      existingCampaignUnit.allyNpc = false;
      existingCampaignUnit.playerConnected = true;
      syncUnitCombat(existingCampaignUnit, body);
      pushLog(room, `${characterName} rejoined the encounter.`);
      sendJson(res, 200, publicState(room));
      broadcast(room);
      scheduleRoomPersist(room, 0);
      campaignApi?.broadcast(room.roomCode).catch(() => {});
      return;
    }
    const rosterNpc = action === "addUnit" && body.npcRosterId ? (await campaignApi.campaign(room.roomCode))?.npcRoster?.find(unit => unit.id === body.npcRosterId && unit.team === "npc") : null;
    if (rosterNpc && room.units.some(unit => unit.id === rosterNpc.id)) { sendJson(res, 409, { error: "That NPC is already in combat." }); return; }
    const unit = {
      id: rosterNpc?.id || id(),
      playerName,
      characterName,
      speed,
      commandWindow,
      atb: Math.max(0, Math.min(room.threshold - 0.001, Number(body.initialAtb) || 0)),
      encounterSpeedBonus: 0,
      regenerationRate: Math.max(0, Math.min(100, Number(body.regenerationRate) || 0)),
      regenerationLabel: String(body.regenerationLabel || "").slice(0, 80),
      regenerationProgress: 0,
      recurringHealingProgress: 0,
      delay: null,
      delayTimer: null,
      delayedAction: null,
      queuedEffects: [],
      controlledBy: body.controlledBy || "player",
      team: normalizeTeam(body.team || (body.controlledBy === "player" ? "pc" : "npc")),
      allyNpc: normalizeTeam(body.team || (body.controlledBy === "player" ? "pc" : "npc")) === "npc" && Boolean(body.allyNpc),
      actorType: normalizeActorType(body.actorType),
      color: normalizeColor(body.color),
      tieSeed: Math.random(),
      characterId: String(body.characterId || ""),
      playerConnected: action === "join" && body.controlledBy === "player",
    };
    syncUnitCombat(unit, body);
    ensureNpcHp(unit);
    room.units.push(unit);
    const setupText = needsSetup(unit) ? "awaiting GM setup" : `Speed ${speed}`;
    pushLog(room, `${characterName} joined (${setupText}).`);
  }

  if (action === "syncCampaignUnits") {
    let changed = 0;
    for (const update of Array.isArray(body.units) ? body.units : []) {
      const unit = room.units.find((entry) => entry.characterId && entry.characterId === String(update.characterId || ""));
      if (!unit) continue;
      const nextSpeed = normalizeSpeed(update.speed);
      const nextCommand = normalizeCommandWindow(update.commandWindow);
      const nextName = String(update.characterName || unit.characterName).trim().slice(0, 40) || unit.characterName;
      const nextPlayer = String(update.playerName || unit.playerName).trim().slice(0, 40) || unit.playerName;
      const nextColor = normalizeColor(update.color);
      if (unit.speed !== nextSpeed || unit.commandWindow !== nextCommand || unit.characterName !== nextName || unit.playerName !== nextPlayer || unit.color !== nextColor) changed += 1;
      unit.speed = nextSpeed === null ? null : nextSpeed + (Number(unit.encounterSpeedBonus) || 0);
      unit.commandWindow = nextCommand;
      unit.regenerationRate = Math.max(0, Math.min(100, Number(update.regenerationRate) || 0));
      unit.regenerationLabel = String(update.regenerationLabel || unit.regenerationLabel || "").slice(0, 80);
      unit.characterName = nextName;
      unit.playerName = nextPlayer;
      unit.color = nextColor;
      syncUnitCombat(unit, update);
    }
    if (changed) pushLog(room, `${changed} campaign character${changed === 1 ? "" : "s"} synchronized from updated sheets.`);
  }

  if (action === "refreshCharacterVersion") {
    const unit = room.units.find((entry) => entry.characterId === String(body.characterId || ""));
    if (unit) {
      const wasActive = room.activeId === unit.id;
      const previousSource = room.activeSource;
      unit.atb = 0;
      unit.speed = normalizeSpeed(body.speed);
      unit.commandWindow = normalizeCommandWindow(body.commandWindow);
      unit.characterName = String(body.characterName || unit.characterName).trim().slice(0, 40) || unit.characterName;
      unit.playerName = String(body.playerName || unit.playerName).trim().slice(0, 40) || unit.playerName;
      unit.color = normalizeColor(body.color || unit.color);
      syncUnitCombat(unit, body);
      if (wasActive) {
        room.activeId = null;
        room.pausedForTurn = false;
        clearActiveCommand(room);
        moveToNextTurnOrClock(room, previousSource);
      }
    }
  }

  if (action === "syncCharacterLoadout") {
    const unit = playerUnit;
    if (unit) {
      syncUnitCombat(unit, body);
      pushLog(room, `${unit.characterName}'s combat loadout synchronized.`);
    }
  }

  if (action === "setNpcCombatStat") {
    const unit = room.units.find((entry) => entry.id === String(body.id || "") && entry.team === "npc");
    const field = String(body.field || "");
    if (!unit || !["physicalAttribute", "mentalAttribute", "physicalSkill", "mentalSkill", "moveSpeed"].includes(field)) {
      sendJson(res, 400, { error: "Choose a valid NPC combat statistic." });
      return;
    }
    if (field === "moveSpeed") unit.moveSpeed = Math.max(1, Math.min(30, Number(body.value) || 1));
    else applyNpcSimplifiedStats(unit, { [field]: body.value });
    pushLog(room, `${unit.characterName}'s ${field.replace(/([A-Z])/g, " $1").toLowerCase()} was adjusted.`);
  }

  if (action === "setNpcWeapon") {
    const unit = room.units.find((entry) => entry.id === String(body.id || "") && entry.team === "npc");
    const weaponId = String(body.weaponId || "");
    const weapons = normalizeWeaponRows([{ inventoryId: `npc-${unit?.id || "unit"}-weapon`, weaponId }]);
    if (!unit || !weapons.length) {
      sendJson(res, 400, { error: "Choose a valid NPC weapon." });
      return;
    }
    unit.weapons = weapons;
    unit.heldWeaponId = weapons[0].inventoryId;
    unit.weaponCharge = null;
    unit.aim = null;
    unit.movementChargeUnits = 0;
    pushLog(room, `${unit.characterName} readied ${weapons[0].name}.`);
  }

  if (action === "playerCombatAction") {
    if (body.turnSerial !== undefined && body.turnSerial !== (playerUnit?.turnSerial || 0)) {
      sendJson(res, 409, { error: 'This turn has ended. Choose an action for the current turn.' }); return;
    }
    shipShields.refresh(room);
    let trigger=null;
    if(body.kind==='moveStarship'&&body.trigger){
      const ship=room.starships.find(s=>s.id===playerUnit?.location?.starshipId);
      if(!ship){sendJson(res,409,{error:'Choose a ship console.'});return;}
      const checked=shipCommands.validateTrigger(room,ship,body.trigger);
      if(!checked.ok){sendJson(res,409,{error:checked.error});return;}
      trigger=checked.trigger;
    }
    if (body.kind === "move" && Array.isArray(body.route) && body.route.length) {
      const destination = body.route.at(-1) || {};
      const occupied = room.units.filter((entry) => entry.id !== playerUnit?.id && entry.location?.starshipId === destination.starshipId && Number(entry.location?.square) === Number(destination.square) && Number(entry.location?.mesh) === Number(destination.mesh)).length;
      const stationReserved = Boolean(body.stationOnArrival) && room.units.some((entry) => {
        if (entry.id === playerUnit?.id || entry.timedAction?.kind !== "move" || !entry.timedAction.stationOnArrival) return false;
        const finalDestination = Array.isArray(entry.travelRoute) && entry.travelRoute.length
          ? entry.travelRoute.at(-1)
          : entry.timedAction.destination;
        return finalDestination?.starshipId === destination.starshipId
          && Number(finalDestination?.square) === Number(destination.square)
          && Number(finalDestination?.mesh) === Number(destination.mesh);
      });
      if (body.stationOnArrival && (occupied >= 1 || stationReserved)) { sendJson(res, 409, { error: "That station is already occupied." }); return; }
      if (occupied >= 2) { sendJson(res, 409, { error: "That location already holds two characters." }); return; }
    }
    const result = resolvePlayerCombatAction(room, playerUnit, body, {
      id,
      clearActiveCommand,
      moveToNextTurnOrClock,
      pushLog,
    });
    if (!result.ok) {
      sendJson(res, 409, { error: result.error });
      return;
    }
    if(trigger&&playerUnit.delayedAction?.shipOrder)playerUnit.delayedAction.shipOrder.trigger=trigger;
    if (result.beginAttack && !beginAttackResolution(room, result.beginAttack)) {
      sendJson(res, 409, { error: "The attacker or defender is no longer in this encounter." });
      return;
    }
    if (playerUnit?.characterId && (result.itemConsumed || result.itemUpdate || result.statusUpdate || body.jetPack)) await syncUnitItemsToCampaign(room, playerUnit);
  }

  if (action === "setFirstAidDifficulty") {
    const resolution = room.itemResolution;
    if (!resolution || resolution.kind !== "firstAid" || resolution.phase !== "gmDifficulty") { sendJson(res, 409, { error: "No First Aid Difficulty is waiting." }); return; }
    const difficulty = Number(body.difficulty);
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 999) { sendJson(res, 400, { error: "Enter a valid First Aid Difficulty." }); return; }
    resolution.difficulty = difficulty;
    resolution.phase = "roll";
    pushLog(room, `First Aid Difficulty set to ${difficulty}; ${resolution.healerName} must roll Intellect + Anatomy/First Aid.`);
  }

  if (action === "submitFirstAidRoll") {
    const resolution = room.itemResolution;
    const score = Number(body.score);
    if (!resolution || resolution.id !== String(body.resolutionId || "") || resolution.phase !== "roll" || !Number.isFinite(score)) { sendJson(res, 409, { error: "That First Aid roll is unavailable." }); return; }
    if (!gmAuthorized && (!playerAuthorized || playerUnit?.id !== resolution.healerId)) { sendJson(res, 403, { error: "That First Aid roll belongs to another character." }); return; }
    if (gmAuthorized) resolution.rollController = 'gm';
    resolution.roll = { score, mode: String(body.mode || "manual").slice(0, 20), diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number).filter(Number.isFinite).slice(0, 30) : [], submittedAt: Date.now() };
    resolution.success = score >= resolution.difficulty;
    resolution.critical = score >= resolution.difficulty * 2;
    if (!resolution.success) {
      finishItemResolution(room, `${resolution.healerName} failed First Aid on ${resolution.targetName} (Score ${score} vs Difficulty ${resolution.difficulty}).`);
    } else {
      resolution.healingFormula = resolution.useKit ? (resolution.healerId === resolution.targetId ? "1D6" : "2D8") : "1D4";
      resolution.phase = "healing";
      pushLog(room, `${resolution.healerName} succeeded at First Aid (Score ${score}); roll ${resolution.healingFormula}${resolution.useKit ? " plus the Skill Check Score" : ""} healing.`);
    }
  }

  if (action === "submitFirstAidHealing") {
    const resolution = room.itemResolution;
    const rolledHealing = Number(body.rolledHealing);
    if (!resolution || resolution.id !== String(body.resolutionId || "") || resolution.phase !== "healing" || !Number.isFinite(rolledHealing) || rolledHealing < 0) { sendJson(res, 409, { error: "That healing roll is unavailable." }); return; }
    if (!gmAuthorized && (!playerAuthorized || playerUnit?.id !== resolution.healerId)) { sendJson(res, 403, { error: "That healing roll belongs to another character." }); return; }
    resolution.healingRoll = { rolledHealing, mode: String(body.mode || "manual").slice(0, 20), diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number).filter(Number.isFinite).slice(0, 30) : [] };
    const totalHealing = rolledHealing + (resolution.useKit ? Number(resolution.roll?.score) || 0 : 0);
    const target = room.units.find((entry) => entry.id === resolution.targetId);
    if (target) await applyHealingToUnit(room, target, totalHealing, `${resolution.healerName}'s First Aid`);
    finishItemResolution(room, `First Aid resolved: ${resolution.healerName} restored up to ${totalHealing} HP to ${resolution.targetName}.`);
  }

  if (action === "gmBeginNpcAttack") {
    const attacker = room.units.find((entry) => entry.id === String(body.attackerId || "") && entry.team === "npc");
    const attackerShip = String(attacker?.location?.starshipId || "");
    const defender = room.units.find((entry) => {
      if (entry.id !== String(body.defenderId || "") || entry.id === attacker?.id) return false;
      const defenderShip = String(entry.location?.starshipId || "");
      return attackerShip || defenderShip ? Boolean(attackerShip && attackerShip === defenderShip) : true;
    });
    if (!attacker || !defender || room.activeId !== attacker.id || room.attackResolution) {
      sendJson(res, 409, { error: "Choose the active NPC and a valid target." });
      return;
    }
    const distance = Number(body.distance);
    const attackModifier = Number(body.attackModifier || 0);
    if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(attackModifier)) {
      sendJson(res, 400, { error: "Enter a valid distance and To-Hit modifier." });
      return;
    }
    const weaponName = String(body.weaponName || "NPC attack").trim().slice(0, 80) || "NPC attack";
    const damageFormula = String(body.damageFormula || "2D6").trim().slice(0, 40) || "2D6";
    beginAttackResolution(room, {
      attackerId: attacker.id,
      defenderId: defender.id,
      weaponId: "gm-npc-attack",
      inventoryId: "gm-npc-attack",
      weaponName,
      distance,
      calledShot: Boolean(body.calledShot),
      calledShotDetail: "",
      chargeCount: 0,
      chargeText: "",
      aimDie: null,
      recoverySeconds: 0,
      plan: {
        allowed: true,
        distance,
        effectiveRange: null,
        attackModifier,
        defenseRangeModifier: 0,
        damageFormula,
        damageFormulaSupported: true,
        rangeExplanation: "GM-entered NPC attack",
        criticalDamageDisabled: false,
      },
    });
  }

  if (action === "submitAttackRoll") {
    const state = room.attackResolution;
    const rollRole = String(body.rollRole || "");
    const expectedId = rollRole === "attacker" ? state?.attackerId : rollRole === "defender" ? state?.defenderId : "";
    const score = Number(body.score);
    if (!state || state.id !== String(body.attackId || "") || state.phase !== "checks" || !expectedId) {
      sendJson(res, 409, { error: "That attack roll is no longer waiting." });
      return;
    }
    if (!gmAuthorized && (!playerAuthorized || playerUnit?.id !== expectedId)) {
      sendJson(res, 403, { error: "That roll belongs to another combatant." });
      return;
    }
    if (!Number.isFinite(score)) {
      sendJson(res, 400, { error: "Enter a valid final Score." });
      return;
    }
    const field = rollRole === "attacker" ? "attackerRoll" : "defenseRoll";
    if (!state[field]) {
      if (gmAuthorized && rollRole === 'attacker') state.rollController = 'gm';
      state[field] = {
        score,
        mode: String(body.mode || "manual").slice(0, 20),
        diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number).filter(Number.isFinite).slice(0, 30) : [],
        submittedBy: gmAuthorized ? "gm" : "player",
        submittedAt: Date.now(),
      };
      if (rollRole === "defender") clearAttackCommand(room);
      pushLog(room, (rollRole === "attacker" ? state.attackerName : state.defenderName) + " submitted " + (rollRole === "attacker" ? "To-Hit" : "Defense") + " Score " + score + ".");
      resolveAttackChecks(room);
    }
  }

  if (action === "submitAttackDamage") {
    const state = room.attackResolution;
    const rolledDamage = Number(body.rolledDamage);
    if (!state || state.id !== String(body.attackId || "") || state.phase !== "damage") {
      sendJson(res, 409, { error: "That Damage roll is no longer waiting." });
      return;
    }
    if (!gmAuthorized && (!playerAuthorized || playerUnit?.id !== state.attackerId)) {
      sendJson(res, 403, { error: "Only the attacker or GM may submit this Damage roll." });
      return;
    }
    if (!Number.isFinite(rolledDamage) || rolledDamage < 0) {
      sendJson(res, 400, { error: "Enter a valid Damage total." });
      return;
    }
    const target = room.units.find((entry) => entry.id === state.defenderId)||require('./ship-doors').find(room,state.defenderId);
    if (!target) {
      sendJson(res, 409, { error: "The defender is no longer in this encounter." });
      return;
    }
    state.damageRoll = {
      rolledDamage,
      mode: String(body.mode || "manual").slice(0, 20),
      diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number).filter(Number.isFinite).slice(0, 60) : [],
      submittedAt: Date.now(),
    };
    state.damageSummary = combatRules.resolveDamage({
      rolledDamage,
      damageReduction: target.damageReduction,
      critical: state.attackResult.critical,
      calledShot: state.calledShot || state.plan.criticalDamageDisabled,
    });
    if(state.doorTarget){const hits=require('./ship-doors').hit(room,state.doorTarget,rolledDamage);finishAttackResolution(room,'hit '+target.characterName+' for '+rolledDamage+' damage: '+hits+'/3 breach points'+(hits>=3?'; door broken open':''));}
    else if (target.team === "npc") {
      state.phase = "gmDamage";
      pushLog(room, "GM confirmation requested for " + target.characterName + ": " + state.damageSummary.applied + " final Damage after DR " + state.damageSummary.reduction + ".");
    } else {
      const damageEvent = await applyDamageToUnit(room, target, state.damageSummary.beforeReduction, state.attackerName + "'s " + state.weaponName, { attackerId: state.attackerId, attackType: state.attackType });
      const applied = Number(damageEvent?.applied) || 0;
      const logText = attackResolutionLog(state, applied);
      finishAttackResolution(room, logText);
    }
  }

  if (action === "confirmNpcDamage") {
    const state = room.attackResolution;
    const finalDamage = Number(body.finalDamage);
    if (!state || state.id !== String(body.attackId || "") || state.phase !== "gmDamage") {
      sendJson(res, 409, { error: "That NPC Damage confirmation is no longer waiting." });
      return;
    }
    if (!Number.isFinite(finalDamage) || finalDamage < 0) {
      sendJson(res, 400, { error: "Enter a valid final Damage amount." });
      return;
    }
    const target = room.units.find((entry) => entry.id === state.defenderId && entry.team === "npc");
    if (!target) {
      sendJson(res, 409, { error: "The NPC defender is no longer in this encounter." });
      return;
    }
    const damageEvent = await applyDamageToUnit(room, target, finalDamage, state.attackerName + "'s " + state.weaponName, { attackerId: state.attackerId, attackType: state.attackType, finalDamage: true });
    const appliedDamage = Number(damageEvent?.applied) || 0;
    const logText = attackResolutionLog(state, appliedDamage);
    finishAttackResolution(room, logText);
  }

  if (action === "setNpcHp") {
    const target = room.units.find((entry) => entry.id === String(body.id || "") && entry.team === "npc");
    if (!target) {
      sendJson(res, 404, { error: "Choose an NPC in this encounter." });
      return;
    }
    const maximumHp = Number(body.maximumHp);
    const currentHp = Number(body.currentHp);
    if (!Number.isFinite(maximumHp) || maximumHp < 1 || !Number.isFinite(currentHp)) {
      sendJson(res, 400, { error: "Enter valid Current and Maximum HP values." });
      return;
    }
    target.maximumHp = Math.round(maximumHp);
    target.currentHp = Math.max(0, Math.min(target.maximumHp, Math.round(currentHp)));
    syncNpcDefeat(room, target);
    pushLog(room, "GM set " + target.characterName + " to " + target.currentHp + "/" + target.maximumHp + " HP.");
  }

  if (action === "applyDamage") {
    const target = room.units.find((entry) => entry.id === String(body.id || ""));
    if (!target) {
      sendJson(res, 404, { error: "Choose a combatant to receive damage." });
      return;
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      sendJson(res, 400, { error: "Enter a valid incoming Damage amount." });
      return;
    }
    await applyDamageToUnit(room, target, amount, String(body.source || "GM-resolved NPC attack").trim().slice(0, 160) || "GM-resolved NPC attack", { attackType: body.attackType === "ranged" ? "ranged" : "" });
  }

  if(action==='removeStarship'){
    const removed=room.starships.find(s=>s.id===body.starshipId);
    if(!removed){sendJson(res,404,{error:'This ship is no longer deployed.'});return;}
    const ids=new Set(room.units.filter(u=>u.location?.starshipId===removed.id).map(u=>u.id));
    let interrupted=ids.has(room.activeId),previousSource=room.activeSource;
    for(const id of ids){cancelNpcDefeat(room.roomCode,id);removeUnitFromCombatObjects(room,id);}
    if(ids.has(room.activeAction?.unitId)){room.activeAction=null;interrupted=true;}
    if(room.attackResolution&&[room.attackResolution.attackerId,room.attackResolution.defenderId].some(id=>ids.has(id))){room.attackResolution=null;clearAttackCommand(room);interrupted=true;}
    if(ids.has(room.delayRequest?.unitId))clearDelayRequest(room);
    room.units=room.units.filter(u=>!ids.has(u.id));
    const refersToRemoved=order=>order&&['targetId','shipId','starshipId','sourceId','targetShipId','destinationShipId'].some(key=>order[key]===removed.id);
    for(const unit of room.units){const pending=unit.delayedAction,orders=['weaponOrder','weaponDamage','sensorOrder','lockOrder','transporterOrder','missileOrder','hackingOrder','commandOrder','probeOrder','shipOrder'].map(key=>pending?.[key]);if(orders.some(refersToRemoved)){unit.delayedAction=null;unit.delayTimer=null;pushLog(room,unit.characterName+' order cancelled: ship removed from combat.');}if(unit.pendingShipRolls)unit.pendingShipRolls=unit.pendingShipRolls.filter(roll=>!refersToRemoved(roll.armed?.order));}
    room.starships=room.starships.filter(s=>s.id!==removed.id);room.shipPositions=(room.shipPositions||[]).filter(s=>s.id!==removed.id);room.shipDistances=(room.shipDistances||[]).filter(p=>p.a!==removed.id&&p.b!==removed.id);
    for(const ship of room.starships){if(ship.lockState)ship.lockState.targets=(ship.lockState.targets||[]).filter(t=>t.targetId!==removed.id);if(ship.ship.missileState)ship.ship.missileState.flights=(ship.ship.missileState.flights||[]).filter(m=>m.targetId!==removed.id&&m.sourceId!==removed.id);}
    if(interrupted){room.activeId=null;room.pausedForTurn=false;clearActiveCommand(room);moveToNextTurnOrClock(room,previousSource);}
    pushLog(room,removed.title+' removed from combat. Its campaign record and crew assignments are retained.');
  }

  if (action === "removeUnit") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if(unit?.shipAi){const ship=room.starships.find(s=>s.id===unit.location?.starshipId),item=ship&&shipAi.enabled(ship);if(item)crewRooms.roomData(ship,item.id).enabled=false;}
    if (room.attackResolution && [room.attackResolution.attackerId, room.attackResolution.defenderId].includes(body.id)) {
      const interruptedAttack = room.attackResolution;
      room.attackResolution = null;
      clearAttackCommand(room);
      pushLog(room, "Attack resolution cancelled because a participant left combat.");
      if (interruptedAttack.attackerId !== body.id) {
        const attacker = room.units.find((entry) => entry.id === interruptedAttack.attackerId);
        if (attacker) {
          room.activeSource = interruptedAttack.source;
          completeStagedAttack(room, attacker, interruptedAttack, "had an attack interrupted when its target left combat", { id, clearActiveCommand, moveToNextTurnOrClock, pushLog });
        }
      }
    }    const wasActive = room.activeId === body.id;
    const previousSource = room.activeSource;
    cancelNpcDefeat(room.roomCode, body.id);
    const affectedItem = removeUnitFromCombatObjects(room, body.id);
    room.units = room.units.filter((entry) => entry.id !== body.id);
    if (wasActive || affectedItem) {
      room.activeId = null;
      room.pausedForTurn = false;
      clearActiveCommand(room);
      moveToNextTurnOrClock(room, previousSource);
    }
    if (room.activeAction?.unitId === body.id) {
      room.activeAction = null;
      room.pausedForTurn = false;
      moveToNextTurnOrClock(room, room.activeSource);
    }
    if (room.delayRequest?.unitId === body.id) clearDelayRequest(room);
    if (unit) pushLog(room, `${unit.characterName} removed from combat.`);
  }

  if (action === "setRunning") {
    const wantsRunning = Boolean(body.running);
    if (wantsRunning && !room.pausedForTurn && !room.hardPaused) {
      if (!canStartClock(room)) {
        pushLog(room, "Clock cannot start until every participant has GM-entered values.");
      } else {
        room.running = true;
        room.resumeAfterTurn = true;
        if (!room.hasEngagedClock) shipPower.refresh(room, { reset: true });
        room.hasEngagedClock = true;
        room.lastTick = Date.now();
        pushLog(room, "Clock started.");
      }
    }
  }

  if (action === "setHardPaused") {
    if (Boolean(body.paused)) {
      hardPauseRoom(room);
    } else {
      hardResumeRoom(room);
    }
  }

  if (action === "toggleClock") {
    if (room.hardPaused) {
      const shouldEngageDormantClock = !room.running
        && !room.pausedForTurn
        && !room.holdPaused
        && !room.activeAction
        && !hasActiveDelayCountdown(room)
        && canStartClock(room);
      hardResumeRoom(room);
      if (shouldEngageDormantClock) {
        room.running = true;
        room.resumeAfterTurn = true;
        if (!room.hasEngagedClock) shipPower.refresh(room, { reset: true });
        room.hasEngagedClock = true;
        room.lastTick = Date.now();
        pushLog(room, "Clock started.");
      }
    } else if (room.running || room.pausedForTurn || room.holdPaused || room.activeAction) {
      hardPauseRoom(room);
    } else if (!canStartClock(room)) {
      pushLog(room, "Clock cannot start until every participant has GM-entered values.");
    } else {
      room.running = true;
      room.resumeAfterTurn = true;
      if (!room.hasEngagedClock) shipPower.refresh(room, { reset: true });
      room.hasEngagedClock = true;
      room.lastTick = Date.now();
      pushLog(room, "Clock started.");
    }
  }

  if (action === "setSpeed") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      const oldSpeed = unit.speed;
      unit.speed = normalizeSpeed(body.speed);
      pushLog(room, `${unit.characterName}'s Speed changed from ${oldSpeed} to ${unit.speed}.`);
    }
  }

  if (action === "setCommandWindow") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      const oldWindow = unit.commandWindow;
      unit.commandWindow = normalizeCommandWindow(body.commandWindow);
      pushLog(room, `${unit.characterName}'s Command Window changed from ${oldWindow || "unset"} to ${unit.commandWindow} seconds.`);
    }
  }

  if (action === "setName") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      const oldName = unit.characterName;
      unit.characterName = String(body.characterName || unit.characterName).trim().slice(0, 40) || unit.characterName;
      pushLog(room, `${oldName} renamed to ${unit.characterName}.`);
    }
  }

  if (action === "setColor") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit) {
      unit.color = normalizeColor(body.color);
      pushLog(room, `${unit.characterName}'s ATB color changed.`);
    }
  }

  if (action === "logPlayerAction") {
    const unit = room.units.find((entry) => entry.id === body.id);
    const label = normalizeActionLog(body.label);
    if (unit) pushLog(room, `${unit.characterName} ${label}.`);
  }

  if (action === "requestDelay") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if(unit?.shieldRestabilizing){sendJson(res,409,{error:'Finish shield restabilization first.'});return;}
    requestDelay(room, unit, body.kind, body.requestedBy);
  }

  if (action === "cancelDelayRequest") {
    cancelDelayRequest(room);
  }

  if (action === "startDelay") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if(unit?.shieldRestabilizing){sendJson(res,409,{error:'Finish shield restabilization first.'});return;}
    startUnitDelay(room, unit, {
      kind: body.kind,
      rate: body.rate,
      label: body.label,
      settings: body.settings,
      queuedEffect: body.queuedEffect,
    });
  }

  if (action === "updateDelay") {
    const unit = room.units.find((entry) => entry.id === body.id);
    updateUnitDelay(room, unit, {
      delayId: body.delayId,
      kind: body.kind,
      rate: body.rate,
      label: body.label,
      settings: body.settings,
    });
  }

  if (action === "instantDelay") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if (unit?.shieldRestabilizing) { sendJson(res,409,{error:'Finish shield restabilization first.'}); return; }
    resolveInstantDelay(room, unit, {
      kind: body.kind,
      label: body.label,
    });
  }

  if (action === "impairQueuedEffect") {
    const unit = room.units.find((entry) => entry.id === body.id);
    const effect = unit?.queuedEffects?.find((entry) => entry.id === body.effectId);
    if (unit && effect) {
      effect.impairments = Math.max(0, Math.min(3, (Number(effect.impairments) || 0) + 1));
      if (effect.impairments >= 3) {
        unit.queuedEffects = unit.queuedEffects.filter((entry) => entry.id !== effect.id);
        if (room.activeAction?.effectId === effect.id) {
          room.activeAction = null;
          room.pausedForTurn = false;
          moveToNextTurnOrClock(room, room.activeSource);
        }
        pushLog(room, `${effect.label} was destroyed.`);
      } else {
        pushLog(room, `${effect.label} impaired (${effect.impairments}/3).`);
      }
    }
  }

  if (action === "removeQueuedEffect") {
    const unit = room.units.find((entry) => entry.id === body.id);
    const effect = unit?.queuedEffects?.find((entry) => entry.id === body.effectId);
    if (unit && effect) {
      unit.queuedEffects = unit.queuedEffects.filter((entry) => entry.id !== effect.id);
      if (room.activeAction?.effectId === effect.id) {
        room.activeAction = null;
        room.pausedForTurn = false;
        moveToNextTurnOrClock(room, room.activeSource);
      }
      pushLog(room, `${effect.label} removed.`);
    }
  }

  if (action === "step") {
    if (room.activeId || room.pausedForTurn) {
      pushLog(room, "Resolve the active turn before stepping the clock.");
      sendJson(res, 200, publicState(room));
      broadcast(room);
      scheduleRoomPersist(room, 0);
      return;
    }
    room.resumeAfterTurn = false;
    room.running = false;
    clearActiveCommand(room);
    advanceSeconds(room, 1, { source: "step" });
    pushLog(room, "GM advanced one second.");
  }

  if (action === "clearEncounter") {
    room.hackingPrivate={secrets:{},sessions:[],receipts:[]};
    room.starships.forEach(ship => {ship.navigation=null;});

    room.attackResolution = null;
    room.itemResolution = null;
    room.vehicles = [];
    room.areaEffects = [];
    room.units = [];
    room.running = false;
    room.pausedForTurn = false;
    room.resumeAfterTurn = false;
    room.hardPaused = false;
    room.activeId = null;
    room.activeAction = null;
    clearDelayRequest(room);
    clearActiveCommand(room);
    room.lastInterruptedId = null;
    room.lastInterruptedAt = 0;
    room.lastTick = Date.now();
    room.hasEngagedClock = false;
    room.encounterEndedAt = null;
    pushLog(room, "Encounter cleared.");
  }

  if (action === "characterSpeedBoost") {
    const unit = playerUnit;
    if (!unit || unit.encounterSpeedBonus) {
      sendJson(res, 409, { error: "This Angiluros Speed boost is already active for the encounter." });
      return;
    }
    unit.encounterSpeedBonus = 4;
    unit.speed = normalizeSpeed((Number(unit.speed) || 0) + 4);
    pushLog(room, `${unit.characterName} spent 2 Exertion for +4 Speed this encounter.`);
  }

  if (action === "exitEncounter" || action === "acknowledgeVictory") {
    if(action === "acknowledgeVictory"){
      const survivors=room.starships.filter(ship=>!ship.destroyedAt&&!ship.escapedAt);
      if(survivors.length!==1||!survivors[0].victoryAt||(!gmAuthorized&&playerUnit?.location?.starshipId!==survivors[0].id)){
        sendJson(res,409,{error:'Only the victorious crew can acknowledge a completed battle.'});return;
      }
      // Keep the clock, crew, navigation and salvage alive until End Combat.
      sendJson(res,200,{ok:true});return;
    }

    for(const unit of room.units){
      const ship=room.starships.find(s=>s.id===unit.location?.starshipId);
      if(ship&&unit.characterId){ship.characterLocations ||= {};ship.characterLocations[unit.characterId]=clone(unit.location);}
    }
    room.attackResolution = null;
    room.itemResolution = null;
    room.vehicles = [];
    room.areaEffects = [];
    for(const unit of room.units){unit.delayedAction=null;unit.timedAction=null;unit.delayTimer=null;unit.consoleHold=null;unit.pendingShipRolls=[];unit.pendingTimedResolutions=[];unit.queuedEffects=[];unit.travelRoute=[];}
    // Keep final crew positions and conditions on the saved ship.
    room.running = false;
    room.pausedForTurn = false;
    room.resumeAfterTurn = false;
    room.hardPaused = false;
    room.activeId = null;
    room.activeAction = null;
    clearDelayRequest(room);
    clearActiveCommand(room);
    room.lastInterruptedId = null;
    room.lastInterruptedAt = 0;
    room.lastTick = Date.now();
    room.hasEngagedClock = false;
    shipCleanser.end(room);
    room.encounterEndedAt = Date.now();
    pushLog(room, "The GM ended the encounter.");
  }

  if (action === "completeTurn") {
    if (room.attackResolution) {
      sendJson(res, 409, { error: "Finish the active attack resolution first." });
      return;
    }
    if (room.activeAction) {
      const previousSource = room.activeSource;
      const actionToResolve = room.activeAction;
      const unit = room.units.find((entry) => entry.id === actionToResolve.unitId);
      if (unit) {
        if (actionToResolve.kind === "thrownEffect") {
          unit.thrownEffects = (unit.thrownEffects || []).filter((effect) => effect.id !== actionToResolve.effectId);
          pushLog(room, `Detonated ${actionToResolve.label}; resolve its effect now.`);
        } else if (actionToResolve.kind === "queuedEffect") {
          const before = Array.isArray(unit.queuedEffects) ? unit.queuedEffects.length : 0;
          unit.queuedEffects = (unit.queuedEffects || []).filter((effect) => effect.id !== actionToResolve.effectId);
          pushLog(room, before === unit.queuedEffects.length
            ? `Resolved Queued Effect: ${actionToResolve.label}.`
            : `Resolved Queued Effect: ${actionToResolve.label}.`);
        } else {
          const queuedTemplate = unit.delayedAction?.queuedEffect;
          unit.delayedAction = null;
          if (!unit.delayTimer) unit.atb = Math.max(0, unit.atb - room.threshold);
          if (queuedTemplate) {
            unit.queuedEffects = Array.isArray(unit.queuedEffects) ? unit.queuedEffects : [];
            if (unit.queuedEffects.length >= 5) {
              pushLog(room, `${unit.characterName} cannot queue ${queuedTemplate.label}; maximum queued effects reached.`);
            } else {
              unit.queuedEffects.push({
                ...copyDelay(queuedTemplate),
                id: id(),
                progress: 0,
                total: 100,
                impairments: 0,
                resolving: false,
              });
              pushLog(room, `${unit.characterName} launched Queued Effect: ${queuedTemplate.label}.`);
            }
          } else {
            pushLog(room, `Resolved Action: ${actionToResolve.label}.`);
          }
        }
      }
      room.pausedForTurn = false;
      room.activeAction = null;
      room.activeId = null;
      clearActiveCommand(room);
      moveToNextTurnOrClock(room, previousSource);
      sendJson(res, 200, publicState(room));
      broadcast(room);
      scheduleRoomPersist(room, 0);
      return;
    }
    if (body.id && body.id !== room.activeId) {
      sendJson(res, 200, publicState(room));
      scheduleRoomPersist(room, 0);
      return;
    }
    const previousSource = room.activeSource;
    const unit = room.units.find((entry) => entry.id === room.activeId);
    if (unit) {
      unit.atb = Math.max(0, unit.atb - room.threshold);
      pushLog(room, `${unit.characterName}'s turn completed.`);
    }
    room.pausedForTurn = false;
    room.activeId = null;
    clearActiveCommand(room);
    moveToNextTurnOrClock(room, previousSource);
  }

  if (action === "nudge") {
    const unit = room.units.find((entry) => entry.id === body.id);
    if(unit?.shieldRestabilizing){sendJson(res,409,{error:'Shield restabilization freezes this character\'s initiative.'});return;}
    if(unit?.consoleHold){sendJson(res,409,{error:'Resume this character before advancing their initiative.'});return;}
    if (unit && !room.pausedForTurn) {
      unit.atb = Math.min(room.threshold, unit.atb + Math.max(1, Number(body.amount) || 1));
      if (unit.atb >= room.threshold && !hasDelay(unit)) {
        if (room.commandExpired && room.activeId) interruptActiveTurn(room);
        pauseForReadyUnit(room, unit, room.resumeAfterTurn ? "clock" : "manual");
      }
    }
  }

  if(gmAuthorized&&playerUnit){
    const pending=playerUnit.delayedAction;
    if(pending&&pending.id!==previousRolls.get(playerUnit.id)){
      pending.rollController='gm';
      if(pending.commandOrder)pending.commandOrder.rollController='gm';
      if(pending.sensorOrder)pending.sensorOrder.rollController='gm';
    }
    if(room.attackResolution&&room.attackResolution.id!==previousAttack)room.attackResolution.rollController='gm';
    if(room.itemResolution&&room.itemResolution.id!==previousItem)room.itemResolution.rollController='gm';
  }
  if(action==='exitEncounter')await campaignApi?.saveEncounter(room.roomCode,snapshotRoom(room));
  sendJson(res, 200, publicState(room));
  broadcast(room);
  scheduleRoomPersist(room);
  if (["join", "addUnit", "removeUnit", "removeStarship", "clearEncounter", "exitEncounter"].includes(action)) campaignApi?.broadcast(room.roomCode).catch(() => {});
}

const server = http.createServer(async (req, res) => {

  const url = new URL(req.url, `http://${req.headers.host}`);
  // Direct room links must select demo-only storage before any page script runs.
  if (req.method === 'GET' && ['/character.html', '/gm.html', '/starship.html'].includes(url.pathname)
      && url.searchParams.get('showcase') !== '1' && campaignApi?.isShowcase(url.searchParams.get('campaign'))) {
    url.searchParams.set('showcase', '1');
    res.writeHead(302, { Location: url.pathname + url.search, 'Cache-Control': 'no-store' });
    res.end(); return;
  }
  if(url.pathname==='/api/hacking/practice'){
    try{
      if(req.headers.origin&&req.headers.origin!==url.origin){sendJson(res,403,{error:'Use the practice board on this server.'});return;}
      const token=req.headers['x-practice-token'];
      if(req.method==='GET'){sendJson(res,200,hackingPractice.get(token));return;}
      if(req.method==='DELETE'){sendJson(res,200,hackingPractice.close(token));return;}
      if(req.method!=='POST'){sendJson(res,405,{error:'Unsupported practice request.'});return;}
      const body=await readBody(req);
      if(!body||typeof body!=='object'||Array.isArray(body)){sendJson(res,400,{error:'Invalid practice request.'});return;}
      const result=body.operation==='create'?hackingPractice.create({...body,previousToken:token},req.socket.remoteAddress):hackingPractice.submit(token,body);
      sendJson(res,200,result);
    }catch(error){sendJson(res,error.status||400,{error:error.message});}
    return;
  }
  try {
    if (campaignApi && url.pathname === "/api/campaign/time/pass" && req.method === "POST") {
      const body = await readBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) { sendJson(res, 400, { error: "A time request is required." }); return; }
      const code = String(body.code || "").trim().toUpperCase();
      const previous = roomActionQueues.get(code) || Promise.resolve();
      const pending = previous.catch(() => {}).then(() => campaignApi.handle(req, res, url, async () => body, sendJson));
      roomActionQueues.set(code, pending);
      try { await pending; }
      finally { if (roomActionQueues.get(code) === pending) roomActionQueues.delete(code); }
      return;
    }
    if (campaignApi && await campaignApi.handle(req, res, url, readBody, sendJson)) return;
  } catch (error) {
    console.error("Campaign request failed:", error);
    if (!res.headersSent) sendJson(res, 500, { error: "Campaign request failed." });
    else res.end();
    return;
  }

  if (url.pathname === "/ping" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`Spaceship Architect server is reachable. Campaign storage: ${campaignStore.mode}.`);
    return;
  }

  if (url.pathname === "/api/create-room" && req.method === "POST") {
    sendJson(res, 410, { error: "Standalone rooms were replaced by permanent campaigns." });
    return;
  }

  if (url.pathname === "/api/action" && req.method === "POST") {
    handleAction(req, res);
    return;
  }

  if (url.pathname === "/api/state" && req.method === "GET") {
    const room = await ensureCampaignRoom(url.searchParams.get("room"));
    if (!room) {
      sendJson(res, 404, { error: "Room not found" });
      return;
    }
    res.sensorViewer = await encounterViewer(room,url.searchParams);
    sendJson(res, 200, publicState(room));
    return;
  }

  if (url.pathname === "/api/keep-alive" && req.method === "POST") {
    const room = await ensureCampaignRoom(url.searchParams.get("room"));
    if (!room) {
      sendJson(res, 404, { error: "Room not found" });
      return;
    }
    res.sensorViewer = await encounterViewer(room,url.searchParams);
    room.lastKeepAliveAt = Date.now();
    sendJson(res, 200, publicState(room));
    return;
  }

  if (url.pathname === "/events") {
    const room = await ensureCampaignRoom(url.searchParams.get("room"));
    if (!room) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Room not found");
      return;
    }
    res.sensorViewer = await encounterViewer(room,url.searchParams);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.deltaState = url.searchParams.get('delta') === '1';
    const roomClients = clients.get(room.roomCode) || new Set();
    clients.set(room.roomCode, roomClients);
    roomClients.add(res);
    const liveUnit = room.units.find((unit) => unit.id === String(url.searchParams.get("unit") || "") && unit.team === "pc" && unit.characterId === res.sensorViewer.characterId);
    if (liveUnit) {
      liveUnit.liveConnections = Math.max(0, Number(liveUnit.liveConnections) || 0) + 1;
      liveUnit.playerConnected = true;
    }
    const heartbeat = setInterval(() => {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    }, HEARTBEAT_MS);
    if (liveUnit) {
      broadcast(room);
      void campaignApi?.broadcast(room.roomCode).catch(() => {});
    } else {
      sendEvent(res, "state", publicState(room));
    }
    req.on("close", () => {
      clearInterval(heartbeat);
      roomClients.delete(res);
      if (liveUnit) setTimeout(() => {
        const currentUnit = room.units.find(entry => entry.id === liveUnit.id);
        if (!currentUnit) return;
        currentUnit.liveConnections = Math.max(0, Number(currentUnit.liveConnections) || 0) - 1;
        if (currentUnit.liveConnections > 0) return;
        currentUnit.playerConnected = false;
        if (room.activeId === currentUnit.id) {
          currentUnit.commandCarrySeconds = room.commandDeadline ? Math.max(0, (room.commandDeadline - Date.now()) / 1000) : Math.max(0, Number(room.commandHeldRemaining) || Number(currentUnit.commandWindow) || 0);
          const previousSource = room.activeSource;
          room.activeId = null;
          room.pausedForTurn = false;
          clearActiveCommand(room);
          pushLog(room, `${currentUnit.characterName} disconnected; their ready turn is preserved.`);
          moveToNextTurnOrClock(room, previousSource);
        }
        broadcast(room);
        void campaignApi?.broadcast(room.roomCode).catch(() => {});
        scheduleRoomPersist(room);
      }, 3000);
    });
    return;
  }

  serveStatic(req, res);
});

async function startServer() {
  await campaignStore.init();
  campaignApi = new CampaignApi({
    environmentChanged:(room,events,{resolve=false}={})=>{if(resolve)moveToNextTurnOrClock(room,room.activeSource||'clock');applyOxygenEvents(room,events.filter(e=>!e.kind));transitEvents(room,events.filter(e=>e.kind));room.lastTick=Date.now();broadcast(room);scheduleRoomPersist(room,0);return snapshotRoom(room);},
    ensureRescueEncounter: async(campaign,shipId)=>{
      const existing=rooms.get(campaign.code);if(existing?.hasEngagedClock&&!existing.encounterEndedAt)return existing;
      if(existing?.units.length)await campaignApi.checkpoint(campaign,'Before rescue encounter',snapshotRoom(existing));
      const rescue=require('./rescue-encounter').build(campaign,shipId),room=createRoom(campaign.code,{...rescue,activeAction:null,delayRequest:null},false);rooms.set(campaign.code,room);if(!clients.has(campaign.code))clients.set(campaign.code,new Set());
      room.starships=normalizeEncounterStarships(rescue.starships);for(const ship of room.starships)require('./ship-state').apply(ship,rescue.starships.find(s=>s.id===ship.id));
      room.units=rescue.units;shipAi.sync(room,preparedUnit);room.hasEngagedClock=true;room.running=true;room.hardPaused=false;room.lastTick=Date.now();room.encounterEndedAt=null;
      pushLog(room,'Rescue encounter started in empty space. Ship and crew positions preserved.');await campaignApi.saveEncounter(campaign.code,snapshotRoom(room));broadcast(room);return room;
    },
    liveEncounter: code => rooms.get(code),
    characterMoved: (code,shipId,characterId,location) => {
      const room=rooms.get(code),unit=room?.units.find(u=>u.characterId===characterId),ship=room?.starships.find(s=>s.id===shipId);
      if(!unit||!ship)return;
      const cell=shipMapCore.buildLayout(ship.ship).footprint.get(location.square);
      unit.location={...location,starshipId:shipId,sicId:location.stationed?cell?.sicId:null};
      unit.timedAction=null;unit.travelRoute=[];
      broadcast(room);scheduleRoomPersist(room,0);
    },
    store: campaignStore,
    storageMode: campaignStore.mode,
    canPassTime: code => {
      const room = rooms.get(code)||campaignApi?.campaignCache.get(code)?.encounter;
      return !room || !room.hasEngagedClock || Boolean(room.encounterEndedAt);
    },
    timePassed: (code, characters) => {
      const room = rooms.get(code);
      if (!room) return;
      for (const unit of room.units) {
        const record = characters.find(entry => entry.id === unit.characterId);
        if (!record) continue;
        unit.currentHp = record.character.health?.current ?? unit.currentHp;
        if(/^#[0-9a-f]{6}$/i.test(record.character.presentation?.atbColor||''))unit.color=record.character.presentation.atbColor;
        unit.items = clone(record.character.items || []);
        const moveSpeed = Number(record.character.computed?.moveSpeed);
        if (Number.isFinite(moveSpeed)) unit.moveSpeed = Math.max(1, moveSpeed);
        if (unit.currentHp > 0) {unit.defeatedAt = null;unit.oxygenUnconscious=false;}
        scheduleRoomPersist(room,0);
      }
      broadcast(room);
    },
    connectedCharacterIds: (code) => (getRoom(code)?.units || []).filter((unit) => unit.team === "pc" && unit.characterId && unit.playerConnected).map((unit) => unit.characterId),
    restoreEncounter: (code, snapshot) => {
      clearTimeout(roomPersistTimers.get(code));
      roomPersistTimers.delete(code);
      for (const response of clients.get(code) || []) response.end();
      rooms.delete(code);
      clients.delete(code);
      createRoom(code, snapshot);
    },
    deleteEncounter: (code) => {
      for (const response of clients.get(code) || []) response.end();
      rooms.delete(code);
      clients.delete(code);
      clearTimeout(roomPersistTimers.get(code));
      roomPersistTimers.delete(code);
    },
  });
  setInterval(()=>{void campaignApi.tickEnvironment().catch(error=>console.error('Oxygen timer:',error.message));},1000).unref();
  server.listen(PORT, HOST, () => {
    const listeningPort = server.address().port;
    const addresses = [];
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
      }
    }
    console.log("Spaceship Architect campaign and ATB server running");
    console.log(`Campaign storage: ${campaignStore.mode}`);
    console.log(`Local:   http://127.0.0.1:${listeningPort}`);
    for (const address of addresses) console.log(`Phone:   http://${address}:${listeningPort}`);
  });
}

startServer().catch((error) => {
  console.error("Spaceship Architect server could not start:", error);
  process.exitCode = 1;
});
