const ammunition = require('./personal-ammunition');
const weaponCatalog = require("./weapon-catalog");
const combatRules = require("./combat-rules");
const navigation = require("./ship-navigation");
const shipMaps = require('./ship-map-core');
const arena = require('./combat-arena');

const weaponsById = new Map(weaponCatalog.map((weapon) => [weapon.id, weapon]));
const ACTION_KINDS = new Set([
  "carry",
  "wait3",
  "defense",
  "melee",
  "move",
  "moveStarship",
  "wrestle",
  "aim",
  "charge",
  "fire",
  "useItem",
  "drawWeapon",
  "calledShot",
  "throwItem",
  "firstAid",
  "station",
  "enterStation",
  "getUp",
  "stopDropRoll",
  "standUp",
  "escapeRestraint",
  "sheathWeapon",
  "reloadWeapon",
  "armExplosive",
  "removeSticky",
  "actionResolved",
]);
const DOOR_OPEN_SECONDS = 0.6;

function normalizeCombatLocation(value) {
  const source = value && typeof value === "object" ? value : {};
  const starshipId = safeText(source.starshipId, "", 120);
  const square = Number.isInteger(Number(source.square)) ? Math.max(0, Math.min(3599, Number(source.square))) : null;
  const mesh = Number.isInteger(Number(source.mesh)) ? Math.max(0, Math.min(8, Number(source.mesh))) : 4;
  return {
    ...(source.arenaId==='surface'?{arenaId:'surface'}:{}),
    environment: source.arenaId==='surface'?'surface':source.escapePodId ? 'escape-pod' : starshipId ? "starship" : "exterior",
    ...(source.escapePodId ? {escapePodId:safeText(source.escapePodId,'',120)} : {}),
    starshipId,
    ...(source.planetId?{planetId:safeText(source.planetId,'',120)}:{}),
    square: starshipId||source.arenaId==='surface' ? square : null,
    mesh,
    sicId: starshipId ? safeText(source.sicId, "", 120) : "",
    stationed: Boolean(starshipId && source.stationed),
    stationSlot: starshipId && source.stationed ? Math.max(0, Math.round(Number(source.stationSlot) || 0)) : null,
    doorKey: starshipId ? safeText(source.doorKey, "", 20) : "",
  };
}

function applyStationBenefits(unit) {
  if (!unit?.location?.stationed) { unit.stationBenefits = null; return; }
  const benefits = [];
  if (unit.classId === "engineer") benefits.push({ id: "engineer-au", label: "Engineer", auBonus: Math.max(0, ...unit.intellectDice) });
  if (unit.classId === "gunner") benefits.push({ id: "gunner-weapon-die", label: "Gunner", weaponSystemsBonusDie: true });
  if (unit.classId === "navigator-sensor-tech") benefits.push({ id: "navigator-sensor", label: "Navigator / Sensor Tech", combineNavigationSkills: true });
  unit.stationBenefits = benefits;
}

function routeDoorDelay(room, route) {
  const keys = new Set((route || []).map((point) => point.doorKey).filter(Boolean));
  if (!keys.size) return 0;
  const shipId = route.find((point) => point.starshipId)?.starshipId; const ship = (room.starships || []).find((entry) => entry.id === shipId);
  return [...keys].filter((key) => ship?.ship?.doorStates?.[key] !== "open").length * DOOR_OPEN_SECONDS;
}

function reservedStationDestination(unit) {
  if (unit?.timedAction?.kind !== "move" || !unit.timedAction.stationOnArrival) return null;
  if (Array.isArray(unit.travelRoute) && unit.travelRoute.length) return unit.travelRoute.at(-1);
  return unit.timedAction.destination || null;
}

function stationOccupied(room, unit, location) {
  const mesh = Number(location?.mesh);
  return room.units.some((entry) => {
    if (entry.id === unit.id) return false;
    const reserved = reservedStationDestination(entry);
    if (reserved) {
      return reserved.starshipId === location.starshipId
        && Number(reserved.square) === Number(location.square)
        && Number(reserved.mesh) === mesh;
    }
    return entry.location?.starshipId === location.starshipId
      && Number(entry.location.square) === Number(location.square)
      && Number(entry.location.stationSlot ?? entry.location.mesh) === mesh;
  });
}

function safeText(value, fallback = "", limit = 80) {
  return String(value || fallback).trim().replace(/\s+/g, " ").slice(0, limit);
}

function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

function ceilTenth(value) {
  return Math.ceil((Number(value) || 0) * 10) / 10;
}

function npcAttributeDice(value) {
  const rating = Math.max(2, Math.min(20, Math.round(Number(value) || 2)));
  if (rating <= 4) return Array.from({ length: rating }, () => 4);
  const dice = [4, 4, 4, 4];
  const faces = [4, 6, 8, 10, 12];
  for (let upgrade = 0; upgrade < rating - 4; upgrade += 1) {
    const index = upgrade % 4;
    dice[index] = faces[Math.min(faces.length - 1, faces.indexOf(dice[index]) + 1)];
  }
  return dice.sort((a, b) => b - a);
}

function applyNpcSimplifiedStats(unit, source = {}) {
  if (!unit || unit.team !== "npc") return unit;
  if(unit.shipAi||source.shipAi){unit.shipAi=true;unit.dexterityDice=[6,6,6,6];unit.strengthDice=[6,6,6,6];unit.intellectDice=[6,6,6,6];unit.perceptionDice=[6,6,6,6];unit.willpowerDice=[6,6,6,6];unit.highestPerceptionDie=6;unit.physicalSkill=unit.mentalSkill=unit.projectileSkill=unit.meleeSkill=unit.dodgeSkill=unit.weaponMechanics=2.5;return unit;}
  unit.physicalAttribute = Math.max(2, Math.min(20, Math.round(Number(source.physicalAttribute ?? unit.physicalAttribute) || 4)));
  unit.mentalAttribute = Math.max(2, Math.min(20, Math.round(Number(source.mentalAttribute ?? unit.mentalAttribute) || 4)));
  unit.physicalSkill = Math.max(0, Math.min(4, Number(source.physicalSkill ?? unit.physicalSkill) || 0));
  unit.mentalSkill = Math.max(0, Math.min(4, Number(source.mentalSkill ?? unit.mentalSkill) || 0));
  unit.dexterityDice = npcAttributeDice(unit.physicalAttribute);
  unit.strengthDice = npcAttributeDice(unit.physicalAttribute);
  unit.projectileSkill = unit.physicalSkill;
  unit.meleeSkill = unit.grapplingSkill = unit.physicalSkill;
  unit.perceptionDice = unit.willpowerDice = npcAttributeDice(unit.mentalAttribute);
  unit.highestPerceptionDie=Math.max(...unit.perceptionDice);
  unit.breakFreeSkill=unit.physicalSkill;unit.resistDistressSkill=unit.demolitionsSkill=unit.mentalSkill;
  unit.scienceSkill = unit.mentalSkill;
  unit.dodgeSkill = unit.physicalSkill;
  unit.weaponMechanics = unit.mentalSkill;
  return unit;
}

function normalizeWeaponRows(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 24).flatMap((entry, index) => {
    const weaponId = safeText(entry?.weaponId || entry?.id, "", 80);
    const weapon = weaponsById.get(weaponId);
    if (!weapon) return [];
    let inventoryId = safeText(entry?.inventoryId, `${weaponId}-${index + 1}`, 100);
    while (seen.has(inventoryId)) inventoryId = `${inventoryId}-${index + 1}`;
    seen.add(inventoryId);
    return [{ inventoryId, weaponId, ...weapon, ...(ammunition.profile(weapon)?{ammoRemaining:ammunition.remaining({...weapon,ammoRemaining:entry.ammoRemaining})}:{}), ...(entry.targetProgram?{targetProgram:entry.targetProgram}:{}) }];
  });
}

function normalizeItemRows(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((entry, index) => {
    const quantity = Math.max(0, Math.min(9999, Math.round(Number(entry?.quantity) || 0)));
    if (!quantity) return [];
    const chargesMax = entry?.chargesMax === null || entry?.chargesMax === undefined ? null : Math.max(0, Number(entry.chargesMax) || 0);
    return [{
      id: safeText(entry?.id, `item-${index + 1}`, 100),
      catalogId: safeText(entry?.catalogId, "", 100),
      name: safeText(entry?.name, "Custom Item", 120),
      description: String(entry?.description || "").slice(0, 4000),
      quantity,
      unitCost: Math.max(0, Number(entry?.unitCost) || 0),
      ...(entry?.ammoRounds !== undefined ? {ammoRounds:Math.max(0,Math.min(999900,Math.floor(Number(entry.ammoRounds)||0)))} : {}),
      ...(entry?.catalogId === "space-suit" ? {protectionHp:Math.max(0,Math.min(20,Number(entry?.protectionHp??20)))} : {}),
      chargesMax,
      charges: chargesMax === null ? null : clamp(entry?.charges, 0, chargesMax, chargesMax),
      chargeState: safeText(entry?.chargeState, "", 40),
      special: safeText(entry?.special, "", 80),
    }];
  });
}

function syncUnitCombat(unit, source = {}) {
  const weapons = normalizeWeaponRows(source.weapons);
  const requestedHeld = safeText(source.heldWeaponId, "", 100);
  for(const row of weapons){const old=(unit.weapons||[]).find(w=>w.inventoryId===row.inventoryId&&w.weaponId===row.weaponId);if(old){if(old.ammoRemaining!==undefined)row.ammoRemaining=old.ammoRemaining;if(old.targetProgram)row.targetProgram=old.targetProgram;if(old.groundLocation)row.groundLocation=old.groundLocation;}}
  unit.weapons = weapons;
  unit.heldWeaponId = weapons.some((weapon) => weapon.inventoryId === requestedHeld)
    ? requestedHeld
    : weapons[0]?.inventoryId || "";
  unit.dexterityBoxes = Math.max(0, Math.round(Number(source.dexterityBoxes) || 0));
  unit.perceptionDice = Array.isArray(source.perceptionDice) ? source.perceptionDice.map(Number).filter(v=>[4,6,8,10,12,20].includes(v)).slice(0,4) : [];
  unit.highestPerceptionDie = Math.max(0, Math.round(Number(source.highestPerceptionDie) || 0));
  unit.moveSpeed = Math.max(1, Number(source.moveSpeed) || 1);
  unit.weaponMechanics = Math.max(0, Number(source.weaponMechanics) || 0);
  unit.dexterityDice = Array.isArray(source.dexterityDice) ? source.dexterityDice.map(Number).filter((value) => value >= 4 && value <= 20).slice(0, 20) : [];
  unit.projectileSkill = Math.max(0, Number(source.projectileSkill) || 0);
  const engineering = source.engineeringSkill ?? unit.engineeringSkill;
  unit.engineeringSkill = engineering == null ? null : Math.max(0, Number(engineering) || 0);
  const pilot = source.pilotSkill ?? unit.pilotSkill;
  unit.pilotSkill = pilot == null ? null : Math.max(0,Number(pilot)||0);
  const sensor = source.sensorSkill ?? unit.sensorSkill;
  unit.sensorSkill = sensor == null ? null : Math.max(0,Number(sensor)||0);
  const weapon = source.weaponSystemsSkill ?? unit.weaponSystemsSkill;
  unit.weaponSystemsSkill = weapon == null ? null : Math.max(0,Number(weapon)||0);
  for(const key of ['mathematicsSkill','computerSkill','hackingSkill']){
    const rating=source[key]??unit[key];unit[key]=rating==null?null:Math.max(0,Number(rating)||0);
  }
  unit.meleeSkill = Math.max(0, Number(source.meleeSkill) || 0);
  unit.grapplingSkill = Math.max(0, Number(source.grapplingSkill) || 0);
  unit.scienceSkill = Math.max(0, Number(source.scienceSkill) || 0);
  unit.dodgeSkill = Math.max(0, Number(source.dodgeSkill) || 0);
  unit.iconRace = String(source.iconRace??unit.iconRace??'');
  unit.iconVariant = Number(source.iconVariant??unit.iconVariant)===1?1:0;
  unit.sex=safeText(source.sex,unit.sex||"",80);
  unit.raceId = safeText(source.raceId, unit.raceId || "", 80);
  unit.raceType = safeText(source.raceType, unit.raceType || "", 80);
  unit.classId = safeText(source.classId, unit.classId || "", 80);
  unit.defenseScoreModifier = clamp(source.defenseScoreModifier, -20, 20, unit.defenseScoreModifier || 0);
  unit.recurringHealingInterval = Math.max(0, Number(source.recurringHealingInterval) || 0);
  unit.recurringHealingAmount = Math.max(0, Number(source.recurringHealingAmount) || 0);
  unit.recurringHealingLabel = safeText(source.recurringHealingLabel, "", 80);
  unit.recurringHealingProgress = Math.max(0, Number(unit.recurringHealingProgress) || 0);
  unit.strengthDice = Array.isArray(source.strengthDice) ? source.strengthDice.map(Number).filter((value) => value >= 4 && value <= 20).slice(0, 20) : [];
  unit.physicalAttribute = unit.team === "npc" ? Math.max(2, Math.min(20, Math.round(Number(source.physicalAttribute) || 4))) : null;
  unit.mentalAttribute = unit.team === "npc" ? Math.max(2, Math.min(20, Math.round(Number(source.mentalAttribute) || 4))) : null;
  unit.physicalSkill = unit.team === "npc" ? Math.max(0, Math.min(4, Number(source.physicalSkill) || 0)) : null;
  unit.mentalSkill = unit.team === "npc" ? Math.max(0, Math.min(4, Number(source.mentalSkill) || 0)) : null;
  applyNpcSimplifiedStats(unit, source);
  unit.damageReduction = Math.max(0, Number(source.damageReduction) || 0);
  unit.maximumHp = source.maximumHp === null || source.maximumHp === undefined ? null : Math.max(0, Number(source.maximumHp) || 0);
  unit.currentHp = source.currentHp === null || source.currentHp === undefined ? unit.currentHp ?? null : Number(source.currentHp);
  unit.items = normalizeItemRows(source.items);
  for(const attribute of ['willpower','perception']) if(Array.isArray(source[attribute+'Dice']))unit[attribute+'Dice']=source[attribute+'Dice'].map(Number).filter(v=>[4,6,8,10,12,20].includes(v)).slice(0,4);
  for(const skill of ['resistDistressSkill','breakFreeSkill','demolitionsSkill','coordinationSkill'])if(source[skill]!==undefined)unit[skill]=Math.max(0,Number(source[skill])||0);

  unit.intellectBoxes = Math.max(0, Math.round(Number(source.intellectBoxes) || 0));
  unit.intellectDice = Array.isArray(source.intellectDice) ? source.intellectDice.map(Number).filter((value) => value >= 4 && value <= 20).slice(0, 20) : [];
  unit.anatomySkill = Math.max(0, Number(source.anatomySkill) || 0);
  unit.statuses = { ...(unit.statuses || {}), ...(source.statuses || {}) };
  unit.powerShield = unit.powerShield && typeof unit.powerShield === "object" ? unit.powerShield : null;
  if (unit.powerShield) {
    const shieldItem = unit.items.find((entry) => entry.id === unit.powerShield.itemId || entry.catalogId === "power-shields");
    if (shieldItem && Number(shieldItem.charges) > Number(unit.powerShield.hp)) unit.powerShield.hp = Number(shieldItem.charges);
    unit.powerShield.maximumHp = 30;
  }
  unit.mountedVehicleId = safeText(unit.mountedVehicleId, "", 100);
  unit.damageEvent = unit.damageEvent && typeof unit.damageEvent === "object" ? unit.damageEvent : null;
  unit.aim = unit.aim && typeof unit.aim === "object" ? unit.aim : null;
  unit.weaponCharge = unit.weaponCharge && typeof unit.weaponCharge === "object" ? unit.weaponCharge : null;
  unit.timedAction = unit.timedAction && typeof unit.timedAction === "object" ? unit.timedAction : null;
  unit.commandCarrySeconds = unit.commandCarrySeconds === null || unit.commandCarrySeconds === undefined
    ? null
    : Math.max(0, Number(unit.commandCarrySeconds) || 0);
  unit.movementChargeUnits = Math.max(0, Number(unit.movementChargeUnits) || 0);
  unit.thrownEffects = Array.isArray(unit.thrownEffects) ? unit.thrownEffects.slice(0, 5) : [];
  unit.combatBrief = unit.combatBrief && typeof unit.combatBrief === "object" ? unit.combatBrief : null;
  unit.location = normalizeCombatLocation(source.location ?? unit.location);
  unit.travelRoute = Array.isArray(unit.travelRoute)
    ? unit.travelRoute.slice(0, 600).map(normalizeCombatLocation).filter((entry) => entry.starshipId||entry.arenaId==='surface')
    : [];
  applyStationBenefits(unit);

  if (unit.weaponCharge && !weapons.some((weapon) => weapon.inventoryId === unit.weaponCharge.inventoryId)) {
    unit.weaponCharge = null;
  }
  if (unit.aim && !unit.heldWeaponId) unit.aim = null;
  return unit;
}

function migrateUnitCombat(unit) {
  if (!Array.isArray(unit.weapons)) unit.weapons = [];
  return syncUnitCombat(unit, {
    weapons: unit.weapons,
    heldWeaponId: unit.heldWeaponId,
    dexterityBoxes: unit.dexterityBoxes,
    highestPerceptionDie: unit.highestPerceptionDie,
    perceptionDice: unit.perceptionDice,
    moveSpeed: unit.moveSpeed,
    weaponMechanics: unit.weaponMechanics,
    dexterityDice: unit.dexterityDice,
    projectileSkill: unit.projectileSkill,
    engineeringSkill: unit.engineeringSkill,
    pilotSkill: unit.pilotSkill,
    sensorSkill: unit.sensorSkill,
    weaponSystemsSkill: unit.weaponSystemsSkill,
    mathematicsSkill: unit.mathematicsSkill,
    computerSkill: unit.computerSkill,
    hackingSkill: unit.hackingSkill,
    meleeSkill: unit.meleeSkill,
    grapplingSkill: unit.grapplingSkill,
    scienceSkill: unit.scienceSkill,
    dodgeSkill: unit.dodgeSkill,
    raceId: unit.raceId,
    iconRace: unit.iconRace,
    iconVariant: unit.iconVariant,
    raceType: unit.raceType,
    classId: unit.classId,
    defenseScoreModifier: unit.defenseScoreModifier,
    recurringHealingInterval: unit.recurringHealingInterval,
    recurringHealingAmount: unit.recurringHealingAmount,
    recurringHealingLabel: unit.recurringHealingLabel,
    strengthDice: unit.strengthDice,
    physicalAttribute: unit.physicalAttribute,
    mentalAttribute: unit.mentalAttribute,
    physicalSkill: unit.physicalSkill,
    mentalSkill: unit.mentalSkill,
    damageReduction: unit.damageReduction,
    maximumHp: unit.maximumHp,
    currentHp: unit.currentHp,
    items: unit.items,
    intellectBoxes: unit.intellectBoxes,
    intellectDice: unit.intellectDice,
    anatomySkill: unit.anatomySkill,
    statuses: unit.statuses,
    powerShield: unit.powerShield,
    mountedVehicleId: unit.mountedVehicleId,
    damageEvent: unit.damageEvent,
  });
}

function heldWeapon(unit) {
  return combatRules.heldWeapon(unit);
}

function carriedItem(unit, itemIdOrCatalogId) {
  const key = safeText(itemIdOrCatalogId, "", 100);
  return (unit?.items || []).find((entry) => entry.id === key || entry.catalogId === key) || null;
}

function consumeCarriedItem(unit, itemIdOrCatalogId, quantity = 1) {
  const item = carriedItem(unit, itemIdOrCatalogId);
  if (!item) return null;
  item.quantity = Math.max(0, Number(item.quantity || 0) - Math.max(1, Math.round(Number(quantity) || 1)));
  if (!item.quantity) unit.items = unit.items.filter((entry) => entry !== item);
  return item;
}

function spendItemCharge(unit, itemIdOrCatalogId, quantity = 1) {
  const item = carriedItem(unit, itemIdOrCatalogId);
  if (!item || item.charges === null || Number(item.charges) < quantity) return null;
  item.charges = Math.max(0, Number(item.charges) - Math.max(1, Number(quantity) || 1));
  return item;
}

function effectiveMoveSpeed(room, unit, { jetPack = false } = {}) {
  const scale=shipMaps.gravityEnabled(room?.starships?.find(s=>s.id===unit?.location?.starshipId))?1:.5;
  if (jetPack && carriedItem(unit, "jet-pack")?.charges > 0) return 4*scale;
  const vehicle = (room?.vehicles || []).find((entry) => entry.id === unit?.mountedVehicleId);
  if (vehicle && vehicle.driverId === unit.id) return Math.max(1, Number(vehicle.currentMoveSpeed) || Number(vehicle.moveSpeed) || 1)*scale;
  return Math.max(1, Number(unit?.moveSpeed) || 1)*scale;
}

function resetVehicleAcceleration(room, unit) {
  const vehicle = (room?.vehicles || []).find((entry) => entry.id === unit?.mountedVehicleId && entry.driverId === unit.id);
  if (vehicle) vehicle.currentMoveSpeed = vehicle.moveSpeed;
}

function effectiveSpeed(unit) {
  if (unit?.location?.environment==='boarding' || unit?.defeatedAt || unit?.oxygenUnconscious || (unit?.currentHp != null && Number(unit.currentHp) <= 0) || unit?.consoleHold || unit?.shieldRestabilizing || unit?.frozenSeconds>0) return 0;
  return Math.max(0, Number(unit?.speed) || 0) + Math.max(0, Number(unit?.aim?.speedBonus) || 0);
}

function hasTimedAction(unit) {
  return Boolean(unit?.timedAction);
}

function hasCombatCountdown(unit) {
  return Boolean(unit?.timedAction)
    || (Array.isArray(unit?.thrownEffects) && unit.thrownEffects.some((effect) => !effect.resolving))
    || Boolean(unit?.weaponCharge);
}

function advanceThrown(room,unit,elapsed){
  const completed=[];
  for(const effect of unit.thrownEffects||[]){
    if(effect.resolving||effect.cancelled)continue;
    if(effect.droneId){if(!require('./personal-bore-drones').advance(room,effect,elapsed))continue;effect.resolving=true;completed.push({type:'thrown',unit,effect});continue;}
    if(effect.attachedId){const attached=room?.units.find(u=>u.id===effect.attachedId);if(attached)effect.origin={...arena.position(attached)};}
    effect.remaining=Math.max(0,(Number(effect.remaining)||0)-elapsed);
    if(effect.remaining>1e-7)continue;
    if(effect.armedMine){
      const source={location:effect.origin},launcher=room?.units.find(u=>u.id===effect.launcherId)||unit;
      if(!room||(arena.distance(room,source,launcher)??0)<15||!room.units.some(u=>!u.defeatedAt&&u.timedAction?.kind==='move'&&(arena.distance(room,source,u)??Infinity)<=3&&arena.canTarget(room,source,u)))continue;
    }
    effect.resolving=true;completed.push({type:'thrown',unit,effect});
  }
  unit.thrownEffects=(unit.thrownEffects||[]).filter(e=>!e.cancelled);
  return completed;
}
function tickCombatTimers(unit, seconds, multiplier = 1, room = null) {
  const completed = [];
  const elapsed = Math.max(0, Number(seconds) || 0) * Math.max(0, Number(multiplier) || 0);
  if (!elapsed) return completed;

  const weapon = heldWeapon(unit);
  if(unit.crosshairTargetId&&room){const target=room.units.find(u=>u.id===unit.crosshairTargetId);if(!target||target.defeatedAt||!arena.canTarget(room,unit,target)){unit.crosshairTargetId=null;unit.weaponCharge=null;unit.aim=null;}}
  if (unit.weaponCharge && weapon && weapon.inventoryId === unit.weaponCharge.inventoryId) {
    const segments = Math.max(1, Number(weapon.chargeSegments) || 1);
    const fullRating = Math.max(0.1, Number(weapon.chargeTime) + (Number(unit.weaponMechanics) || 0));
    const meterSpeed = fullRating / segments;
    unit.weaponCharge.progress = Math.min(100, (Number(unit.weaponCharge.progress) || 0) + meterSpeed * elapsed);
    unit.weaponCharge.segments = segments;
    unit.weaponCharge.meterSpeed = meterSpeed;
  } else if (unit.weaponCharge) {
    unit.weaponCharge = null;
  }

  completed.push(...advanceThrown(room,unit,elapsed));

  if(unit.timedAction?.kind==='move'&&unit.location?.arenaId==='surface'&&room?.arena){
    const current=arena.position(unit),action=unit.timedAction,start=Math.max(0,Math.floor((1-action.remaining/Math.max(.001,action.total))*action.routeSegment.length));let from=current,blocked=false;
    for(const point of action.routeSegment.slice(start)){if(!arena.step(room.arena,from,point)){blocked=true;break;}from=point;}
    if(blocked){unit.location=normalizeCombatLocation(current);unit.timedAction=null;unit.travelRoute=[];unit.atb=room.threshold;setCombatBrief(unit,'move','Movement stopped',['A door or obstacle blocked the remaining route.']);}
  }
  if (unit.timedAction) {
    if(room)shipMaps.updateMovementGravity(unit.timedAction,unit.location?.arenaId==='surface'||shipMaps.gravityEnabled(room.starships?.find(s=>s.id===unit.location?.starshipId))?1:.5);
    unit.timedAction.remaining = Math.max(0, (Number(unit.timedAction.remaining) || 0) - elapsed);
    if (unit.timedAction.remaining <= 0.0001) {
      const completedAction = unit.timedAction;
      unit.timedAction = null;
      if (completedAction.kind === "move" && completedAction.destination) {
        unit.location = normalizeCombatLocation(completedAction.destination);
        applyStationBenefits(unit);
        if (Array.isArray(unit.travelRoute) && unit.travelRoute.length) {
          const moveSpeed = Math.max(.1, Number(completedAction.moveSpeed) || Number(unit.moveSpeed) || 1);
          const segment = unit.travelRoute.splice(0, Math.max(1,Math.floor(moveSpeed)));
          const destination = segment[segment.length - 1];
          if (destination) {
            const doorDelay = room ? routeDoorDelay(room, segment) : 0; const duration = Math.max(0.1, ceilTenth((3 * segment.length) / moveSpeed + doorDelay));
            unit.timedAction = {
              id: `${completedAction.id}-next-${unit.travelRoute.length}`,
              kind: "move",
              label: `Travel ${segment.length} unit${segment.length === 1 ? "" : "s"}`,
              total: duration,
              remaining: duration,
              units: segment.length,
              moveSpeed,
              gravityScale: completedAction.gravityScale??1,
              destination,
              routed: true,
              routeSegment: segment,
              startLocation: normalizeCombatLocation(completedAction.destination),
              doorDelay,
              startedAt: Date.now(),
              stationOnArrival: Boolean(completedAction.stationOnArrival),
              stationName: completedAction.stationName,
              stationSlot: completedAction.stationSlot,
            };
          }
        } else if (completedAction.stationOnArrival) {
          unit.location.stationed = true; unit.location.stationSlot = Math.max(0, Number(completedAction.stationSlot) || 0); applyStationBenefits(unit);
        }
      }
      if (completedAction.kind === "wait") {
        unit.commandCarrySeconds = Math.max(0, Number(completedAction.commandRemaining) || 0);
      }
      completed.push({ type: "timed", unit, timedAction: completedAction });
    }
  }
  return completed;
}

function combatEventTimes(unit, multiplier = 1) {
  const scale = Math.max(0.0001, Number(multiplier) || 1);
  const times = [unit.frozenSeconds>0?unit.frozenSeconds/scale:Infinity,require('./personal-weapon-effects').nextEvent(unit)/scale];
  if (unit?.timedAction) times.push(Math.max(0, Number(unit.timedAction.remaining) || 0) / scale);
  for (const effect of unit?.thrownEffects || []) {
    if (!effect.resolving&&!(effect.armedMine&&effect.remaining<=0)) times.push(Math.max(0, Number(effect.remaining) || 0) / scale);
  }
  return times;
}

function cancelTimedActionForForcedDelay(unit) {
  if (!unit?.timedAction || !["wait", "move"].includes(unit.timedAction.kind)) return false;
  unit.timedAction = null;
  unit.commandCarrySeconds = null;
  unit.movementChargeUnits = 0;
  unit.travelRoute = [];
  unit.atb = 0;
  return true;
}

function completedCharges(unit) {
  const weapon = heldWeapon(unit);
  if (!weapon || !unit.weaponCharge || unit.weaponCharge.inventoryId !== weapon.inventoryId) return 0;
  const segments = Math.max(1, Number(weapon.chargeSegments) || 1);
  return Math.min(segments, Math.floor(((Number(unit.weaponCharge.progress) || 0) + 0.00001) / (100 / segments)));
}

function sameCombatLocation(first, second) {
  const firstShip = safeText(first?.location?.starshipId, "", 120);
  const secondShip = safeText(second?.location?.starshipId, "", 120);
  if (firstShip || secondShip) return Boolean(firstShip && firstShip === secondShip);
  return (first?.location?.planetId||'')===(second?.location?.planetId||'');
}

function targetUnit(room, unit, targetId) {
  if(String(targetId).startsWith('wall:'))return arena.wallTargets(room,unit).find(w=>w.id===targetId)||null;
  if(String(targetId).startsWith('door:'))return require('./ship-doors').targets(room,unit).find(d=>d.id===targetId)||null;
  return room.units.find((entry) => entry.id === targetId && entry.id !== unit.id && sameCombatLocation(unit, entry)&&(!(unit.team==='pc'&&entry.team==='npc'&&entry.location?.starshipId)||require('./ship-intruders').visible(room,room.starships.find(s=>s.id===entry.location.starshipId),entry))) || null;
}

function setCombatBrief(unit, kind, label, details = []) {
  unit.combatBrief = {
    kind,
    label: safeText(label, "Action Resolved", 140),
    details: details.map((entry) => safeText(entry, "", 180)).filter(Boolean).slice(0, 4),
    createdAt: Date.now(),
  };
}

function clearAim(unit) {
  if (!unit?.aim) return;
  unit.aim = null;
  if (heldWeapon(unit)?.aimRequired) unit.weaponCharge = null;
}

function finishTurn(room, unit, label, helpers) {
  const previousSource = room.activeSource;
  unit.atb = Math.max(0, unit.atb - room.threshold);
  room.pausedForTurn = false;
  room.activeId = null;
  helpers.clearActiveCommand(room);
  helpers.pushLog(room, `${unit.characterName} ${label}.`);
  helpers.moveToNextTurnOrClock(room, previousSource);
}

function beginTimedAction(room, unit, timedAction, logText, helpers, { resetAtb = false } = {}) {
  const previousSource = room.activeSource;
  if (resetAtb) unit.atb = Math.max(0, unit.atb - room.threshold);
  unit.timedAction = timedAction;
  room.pausedForTurn = false;
  room.activeId = null;
  helpers.clearActiveCommand(room);
  helpers.pushLog(room, logText);
  helpers.moveToNextTurnOrClock(room, previousSource);
}

function resolvePlayerCombatAction(room, unit, body, helpers) {
  const kind = safeText(body?.kind, "", 30);
  if (unit?.shieldRestabilizing) return {ok:false,error:'Finish shield restabilization before taking another action.'};
  if (['holdConsole','resumeConsole'].includes(kind)) return require('./console-hold').resolve(room,unit,kind,helpers);
  if (!unit || room.activeId !== unit.id || !ACTION_KINDS.has(kind)) {
    return { ok: false, error: "That combat action is not currently available." };
  }
  if(unit.delayedAction || unit.delayTimer)return {ok:false,error:'Finish the current delay first.'};
  if(require('./station-access').consoles(room,unit).length && !['moveStarship','move'].includes(kind))return {ok:false,error:'Leave the station to use standard combat actions.'};

  const weapon = heldWeapon(unit);
  if(kind==='armExplosive'){
    if(!weapon?.throwable||weapon.placeable)return {ok:false,error:'Hold a throwable explosive to arm it.'};
    if((unit.thrownEffects||[]).length>=5)return {ok:false,error:'Resolve an existing explosive first.'};
    (unit.thrownEffects||=[]).push({id:helpers.id(),weaponId:weapon.weaponId,label:weapon.name,origin:{...unit.location},attachedId:unit.id,armedHeld:true,remaining:weapon.countdownSeconds||25,total:weapon.countdownSeconds||25});
    unit.weapons=unit.weapons.filter(w=>w.inventoryId!==weapon.inventoryId);unit.heldWeaponId='';finishTurn(room,unit,'armed '+weapon.name+'; throw it before the countdown expires',helpers);return {ok:true,weaponConsumed:weapon.inventoryId};
  }
  if(kind==='removeSticky'){
    const effect=room.units.flatMap(u=>u.thrownEffects||[]).find(e=>e.attachedId===unit.id&&!e.armedHeld&&e.weaponId==='sticky-grenade');
    if(!effect)return {ok:false,error:'No attached Sticky Grenade is waiting.'};
    return {ok:true,beginAttack:{attackerId:unit.id,defenderId:unit.id,weaponId:'remove-sticky',weaponName:'Detach Sticky Grenade',attackType:'effect',consumeEffectTurn:true,personalEffect:{check:true,attribute:'strength',skill:'Escape',difficulty:13,removeSticky:effect.id},plan:{allowed:true,attackAttribute:'strength',attackSkill:'Escape',attackModifier:0}}};
  }
  if(kind==='reloadWeapon'){
    try{const loaded=ammunition.reload(unit,weapon);clearAim(unit);unit.weaponCharge=null;finishTurn(room,unit,'reloaded '+loaded+' rounds into '+weapon.name,helpers);return {ok:true,itemUpdate:true,weaponUpdate:true};}catch(e){return {ok:false,error:e.message};}
  }
  if(kind==='sheathWeapon'){
    if(weapon?.weaponId!=='murasama-blade')return {ok:false,error:'Hold the Murasama Blade to sheath it.'};
    unit.drawnMurasama ||= {};unit.drawnMurasama[weapon.inventoryId]=false;const seconds=200/Math.max(1,unit.speed||1);
    beginTimedAction(room,unit,{id:helpers.id(),kind:'recovery',label:'Sheathing Murasama Blade',total:seconds,remaining:seconds},unit.characterName+' sheathed the Murasama Blade.',helpers,{resetAtb:true});return {ok:true};
  }
  if(kind==='escapeRestraint'){
    if(!unit.net)return {ok:false,error:'This character is not trapped in a net.'};
    const effect={name:'Escape net',check:true,attribute:'dexterity',skill:'Escape',difficulty:unit.net.difficulty,escapeNet:true};
    return {ok:true,beginAttack:{attackerId:unit.id,defenderId:unit.id,weaponId:'escape-net',weaponName:effect.name,attackType:'effect',personalEffect:effect,consumeEffectTurn:true,plan:{allowed:true,attackModifier:0,attackAttribute:'dexterity',attackSkill:'Escape'}}};
  }
  if(unit.net&&['move','melee','wrestle'].includes(kind))return {ok:false,error:'Escape the net before moving or using melee.'};
  if(unit.statuses?.prone&&kind==='move')return {ok:false,error:'Stand Up before moving.'};
  room.vehicles = Array.isArray(room.vehicles) ? room.vehicles : [];
  if (kind === 'moveStarship') {
    const result = navigation.queue(room, unit, body);
    if (!result.ok) return result;
    clearAim(unit);
    const previousSource=room.activeSource;
    room.pausedForTurn=false;room.activeId=null;helpers.clearActiveCommand(room);
    helpers.pushLog(room,`${unit.characterName} started pilot input for ${result.ship.title}.`);
    helpers.moveToNextTurnOrClock(room,previousSource);
    return {ok:true};
  }
  const requestedTarget = targetUnit(room, unit, safeText(body.targetId, "", 100));
  if(requestedTarget&&!requestedTarget.doorTarget&&['fire','calledShot','melee','wrestle','throwItem'].includes(kind)){
    if(!arena.canTarget(room,unit,requestedTarget))return {ok:false,error:'A wall or closed door blocks line of sight to that target.'};
    if(unit.team==='pc'&&!arena.isVisible(room,requestedTarget))return {ok:false,error:'That target is hidden by fog of war.'};
    if(['melee','wrestle'].includes(kind)&&(arena.distance(room,unit,requestedTarget)??1)>Math.max(1.5,weapon?.category==='melee' ? parseFloat(weapon.range)||1 : 1))return {ok:false,error:'Move within melee reach of this target first.'};
  }
  if(kind==='carry'){
    try{const text=require('./crew-carry').command(room,unit,body.targetId);helpers.pushLog(room,text,{starshipId:unit.location?.starshipId});return {ok:true};}
    catch(error){return {ok:false,error:error.message};}
  }
  const target = requestedTarget?.characterName || "the chosen target";
  if(requestedTarget?.doorTarget&&!['fire','melee','calledShot'].includes(kind))return {ok:false,error:'Doors can only be targeted with firearms or melee attacks.'};
  if(requestedTarget?.doorTarget&&(kind==='melee'||weapon?.category==='melee')&&requestedTarget.distance>1)return {ok:false,error:'Move adjacent to the door before a melee attack.'};
  if (kind === "wait3") {
    unit.movementChargeUnits = 0;
    const commandRemaining = room.commandDeadline
      ? Math.max(0, (room.commandDeadline - Date.now()) / 1000)
      : room.commandHeldRemaining ?? 0;
    beginTimedAction(room, unit, {
      id: helpers.id(),
      kind: "wait",
      label: "Wait 3",
      total: 3,
      remaining: 3,
      commandRemaining,
    }, `${unit.characterName} chose Wait 3.`, helpers);
    setCombatBrief(unit, kind, "Wait 3", [`Command Window preserved at ${commandRemaining.toFixed(1)} sec`]);
    return { ok: true };
  }

  if (kind === "move") {
    if (unit.powerShield?.active) return { ok: false, error: "Deactivate Power Shields before moving." };
    const mounted = room.vehicles.find((entry) => entry.id === unit.mountedVehicleId);
    if (mounted && mounted.driverId !== unit.id) return { ok: false, error: "Only the vehicle's driver may choose Move." };
    const useJetPack = Boolean(body.jetPack);
    if (useJetPack && !(carriedItem(unit, "jet-pack")?.charges > 0)) return { ok: false, error: "A charged Jet-Pack must be carried to fly." };
    const maxUnits = effectiveMoveSpeed(room, unit, { jetPack: useJetPack });
    const requestedRoute = Array.isArray(body.route)
      ? body.route.slice(0, 600).map(normalizeCombatLocation).filter((entry) => unit.location?.arenaId==='surface'?entry.arenaId==='surface':entry.starshipId && entry.starshipId === unit.location?.starshipId)
      : [];
    const units = requestedRoute.length ? Math.min(Math.max(1,Math.floor(maxUnits)), requestedRoute.length) : clamp(body.units, 1, Math.max(1,maxUnits), 1);
    if(unit.location?.arenaId==='surface'){
      if(!room.arena||!requestedRoute.length)return {ok:false,error:'Choose a destination on the surface arena.'};
      let from=unit.location;for(const point of requestedRoute){if(!arena.step(room.arena,from,point))return {ok:false,error:'That route is blocked by a wall or closed manual door.'};from=point;}
      const end=requestedRoute.at(-1);if(room.units.some(u=>u.id!==unit.id&&u.location?.arenaId==='surface'&&u.location.square===end.square))return {ok:false,error:'That destination is occupied.'};
    }
    if(requestedRoute.length&&unit.location?.arenaId!=='surface'){
      const ship=room.starships.find(s=>s.id===unit.location.starshipId),layout=ship&&shipMaps.buildLayout(ship.ship);let from=unit.location;
      for(const point of requestedRoute){
        if(!layout||!shipMaps.meshStepAllowed(layout,from,point))return {ok:false,error:'Movement must follow the mesh through actual doorways.'};
        const edge=layout.edge(from.square,point.square);if(edge.kind==='door'&&ship.ship.doorStates?.[edge.key]!=='open'&&require('./ship-surveillance').hostile(room,ship,unit))return {ok:false,error:'The closed door blocks intruders. Break it or find an open route.'};point.doorKey=from.square!==point.square&&edge.kind==='door'?edge.key:'';from=point;
      }
    }
    const routeSegment = requestedRoute.slice(0, units);
    const doorDelay = routeDoorDelay(room, routeSegment); const duration = Math.max(0.1, ceilTenth((3 * units) / maxUnits + doorDelay));
    clearAim(unit);
    unit.movementChargeUnits = Math.min(maxUnits, units);
    unit.lastMoveStart={...unit.location};
    if (useJetPack) spendItemCharge(unit, "jet-pack", 1);
    if (mounted?.driverId === unit.id) {
      mounted.currentMoveSpeed = Math.min(mounted.maximumMoveSpeed, mounted.currentMoveSpeed + mounted.acceleration);
    }
    unit.travelRoute = requestedRoute.slice(units);
    beginTimedAction(room, unit, {
      id: helpers.id(),
      kind: "move",
      label: `${useJetPack ? "Flight" : requestedRoute.length > maxUnits ? "Travel" : "Move"} ${units} unit${units === 1 ? "" : "s"}`,
      total: duration,
      remaining: duration,
      units,
      moveSpeed: maxUnits,
      gravityScale: unit.location?.arenaId==='surface'||shipMaps.gravityEnabled(room.starships?.find(s=>s.id===unit.location?.starshipId))?1:.5,
      destination: routeSegment[routeSegment.length - 1] || null,
      routed: Boolean(requestedRoute.length),
      routeSegment,
      startLocation: normalizeCombatLocation(unit.location),
      doorDelay,
      startedAt: Date.now(),
      stationOnArrival: Boolean(body.stationOnArrival),
      stationName: safeText(body.stationName, "SIC", 80),
      stationSlot: Math.max(0, Number(body.stationSlot) || 0),
    }, `${unit.characterName} moved ${units} unit${units === 1 ? "" : "s"} (${duration.toFixed(1)} sec).`, helpers);
    setCombatBrief(unit, kind, `Moved ${units} unit${units === 1 ? "" : "s"}`, [`Immediate action in ${duration.toFixed(1)} sec`, `${units} melee movement Charge${units === 1 ? "" : "s"}`]);
    return { ok: true };
  }

  if (kind === "enterStation") {
    if (!unit.location?.starshipId || !unit.location?.sicId) return { ok: false, error: "Move into an SIC before entering its station." };
    if (stationOccupied(room, unit, unit.location)) return { ok: false, error: "That station is currently occupied." };
    unit.location.stationed = true;
    unit.location.stationSlot = Number(unit.location.mesh) || 0;
    applyStationBenefits(unit);
    unit.travelRoute = [];
    setCombatBrief(unit, kind, `Stationed at ${safeText(body.stationName, "SIC", 80)}`, ["Starship actions available"]);
    finishTurn(room, unit, `entered the ${safeText(body.stationName, "SIC", 80)} station`, helpers);
    return { ok: true };
  }

  if (kind === "stopDropRoll") {
    if(!unit.burning)return {ok:false,error:'This character is not burning.'};
    const intensity=require('./personal-weapon-effects').extinguish(unit,3);unit.statuses={...unit.statuses,prone:true};
    clearAim(unit);finishTurn(room,unit,'stopped, dropped and rolled; Fire Intensity '+intensity,helpers);return {ok:true};
  }
  if (kind === "standUp") {unit.statuses={...unit.statuses,prone:false};finishTurn(room,unit,'stood up',helpers);return {ok:true};}
  if (kind === "getUp") {
    if (!unit.location?.stationed) return { ok: false, error: "This character is not currently stationed." };
    unit.location.stationed = false;
    unit.location.stationSlot = null;
    applyStationBenefits(unit);
    setCombatBrief(unit, kind, "Left station", ["Personal combat actions restored"]);
    finishTurn(room, unit, "got up from their station", helpers);
    return { ok: true };
  }

  if (kind !== "move") resetVehicleAcceleration(room, unit);

  if (kind === "defense") {
    const duration = clamp(body.seconds, 1, 15, 1);
    clearAim(unit);
    unit.movementChargeUnits = 0;
    beginTimedAction(room, unit, {
      id: helpers.id(),
      kind: "defense",
      label: "Defense",
      total: duration,
      remaining: duration,
      dodgeMultiplier: 2,
      startedAt: Date.now(),
    }, `${unit.characterName} entered Defense for ${duration} second${duration === 1 ? "" : "s"}; Dodge is doubled.`, helpers, { resetAtb: true });
    setCombatBrief(unit, kind, `Defense for ${duration} sec`, ["Dodge x2", "Critical melee defense delays attacker by twice the elapsed Defense time"]);
    return { ok: true };
  }

  if(['aim','charge'].includes(kind)&&['homing-spike-pistol','skull-bore'].includes(weapon?.weaponId)){
    if(!requestedTarget||!arena.canTarget(room,unit,requestedTarget))return {ok:false,error:'Choose a visible target to keep in the crosshairs while charging.'};
    if(unit.crosshairTargetId!==requestedTarget.id){unit.weaponCharge=null;unit.aim=null;}unit.crosshairTargetId=requestedTarget.id;
  }
  if (kind === "aim") {
    unit.movementChargeUnits = 0;
    const pool = (unit.perceptionDice?.length ? [...unit.perceptionDice].sort((a,b)=>b-a) : Array(4).fill(unit.highestPerceptionDie)).filter(v=>v>0);
    const count = Math.min(4, pool.length, (unit.aim?.dice?.length || (unit.aim?.aimDie ? 1 : 0)) + 1);
    unit.aim = {
      dice:pool.slice(0,count),
      speedBonus: Math.max(0, Number(unit.dexterityBoxes) || 0),
      aimDie: Math.max(0, Number(unit.highestPerceptionDie) || 0),
      createdAt: Date.now(),
    };
    let chargeStarted = false;
    if (weapon?.chargeMode === "meter" && Number(weapon.chargeSegments) > 0) {
      const sameCharge = unit.weaponCharge?.inventoryId === weapon.inventoryId;
      const chargeComplete = sameCharge && Number(unit.weaponCharge.progress) >= 100;
      if (!chargeComplete) {
        if (!sameCharge) unit.weaponCharge = { inventoryId: weapon.inventoryId, weaponId: weapon.weaponId, progress: 0 };
        chargeStarted = true;
      }
    }
    setCombatBrief(unit, kind, "Aim", [
      `+${unit.aim.speedBonus} ATB Speed`,
      unit.aim.dice.length ? `+${unit.aim.dice.map(v=>`1D${v}`).join(" + ")} to Dexterity pool and Damage` : "+highest Perception die to Dexterity pool and Damage",
      chargeStarted ? `${weapon.name} Charge meter activated` : "",
    ].filter(Boolean));
    finishTurn(room, unit, `aimed; the next ATB refill gains +${unit.aim.speedBonus} Speed${chargeStarted ? ` and ${weapon.name} began charging` : ""}`, helpers);
    return { ok: true };
  }

  if (kind === "charge") {
    unit.movementChargeUnits = 0;
    if (!weapon || weapon.chargeMode !== "meter" || !weapon.chargeSegments) {
      return { ok: false, error: "The held weapon does not use an ATB Charge meter." };
    }
    if (weapon.aimRequired && !unit.aim) {
      return { ok: false, error: `${weapon.name} must be Aimed before it can be Charged.` };
    }
    if (unit.weaponCharge?.inventoryId === weapon.inventoryId && Number(unit.weaponCharge.progress) >= 100) {
      return { ok: false, error: `${weapon.name} is already fully Charged.` };
    }
    if (!unit.weaponCharge || unit.weaponCharge.inventoryId !== weapon.inventoryId) {
      unit.weaponCharge = { inventoryId: weapon.inventoryId, weaponId: weapon.weaponId, progress: 0 };
    }
    const fullRate = Math.max(0.1, Number(weapon.chargeTime) + (Number(unit.weaponMechanics) || 0));
    const segmentRate = fullRate / Math.max(1, Number(weapon.chargeSegments) || 1);
    setCombatBrief(unit, kind, `Charging ${weapon.name}`, [`${weapon.chargeSegments} segments at ${segmentRate.toFixed(1)}%/sec`, `${weapon.chargeBonus} per completed Charge`]);
    finishTurn(room, unit, `began charging ${weapon.name}`, helpers);
    return { ok: true };
  }

  if (kind === "drawWeapon") {
    const inventoryId = safeText(body.inventoryId, "", 100);
    const nextWeapon = (unit.weapons || []).find((entry) => entry.inventoryId === inventoryId);
    if(nextWeapon?.ammo){
      const launcher=(unit.weapons||[]).find(w=>w.weaponId===nextWeapon.launcherId);if(!launcher)return {ok:false,error:'You must own the matching launcher to load this ammunition.'};
      unit.launcherAmmo ||= {};const magazine=unit.launcherAmmo[launcher.inventoryId]||=[];
      if(!magazine.includes(nextWeapon.inventoryId)){if(magazine.length>=(launcher.weaponId==='bore-launcher'?5:10))return {ok:false,error:'That launcher magazine is full.'};magazine.unshift(nextWeapon.inventoryId);}else{magazine.splice(magazine.indexOf(nextWeapon.inventoryId),1);magazine.unshift(nextWeapon.inventoryId);}
      unit.heldWeaponId=launcher.inventoryId;unit.weaponCharge=null;unit.aim=null;finishTurn(room,unit,'loaded '+nextWeapon.name+' into '+launcher.name,helpers);return {ok:true};
    }

    if (!nextWeapon) return { ok: false, error: "Choose a weapon from this character's Supplies." };
    if(nextWeapon.groundLocation){const probe={location:nextWeapon.groundLocation};if((arena.distance(room,unit,probe)??Infinity)>1.5||!arena.canTarget(room,unit,probe))return {ok:false,error:'Move beside the thrown weapon to retrieve it.'};delete nextWeapon.groundLocation;}
    const changed = unit.heldWeaponId !== inventoryId;
    unit.heldWeaponId = inventoryId;
    if (changed) {
      unit.weaponCharge = null;
      unit.aim = null;
      unit.movementChargeUnits = 0;
    }
    setCombatBrief(unit, kind, `Readied ${nextWeapon.name}`, [changed ? "Stored Charge and Aim cleared" : "Weapon remains held"]);
    finishTurn(room, unit, `readied ${nextWeapon.name}`, helpers);
    return { ok: true };
  }

  if (kind === "throwItem") {
    const inventoryId = safeText(body.inventoryId, "", 100);
    const gearItem = carriedItem(unit, safeText(body.itemId, "", 100));
    const armedOwner=room.units.find(u=>(u.thrownEffects||[]).some(e=>'armed:'+e.id===inventoryId&&e.armedHeld&&e.attachedId===unit.id));
    const armed=armedOwner?.thrownEffects.find(e=>'armed:'+e.id===inventoryId);
    const thrown = armed ? {...weaponsById.get(armed.weaponId),inventoryId,weaponId:armed.weaponId,countdownSeconds:armed.remaining} : gearItem?.catalogId === "smoke-grenade"
      ? { inventoryId: gearItem.id, weaponId: "smoke-grenade", name: gearItem.name, throwable: true, placeable: false, countdownSeconds: 5, itemId: gearItem.id, specialType: "smoke" }
      : (unit.weapons || []).find((entry) => entry.inventoryId === inventoryId && (entry.throwable || entry.placeable || entry.category === "melee"));
    if (!thrown) return { ok: false, error: "Choose a throwable explosive or melee weapon." };
    const isExplosive = Boolean(thrown.throwable || thrown.placeable);
    let groundZero=requestedTarget?.location || body.destination;
    if(thrown.throwable||thrown.placeable){
      const g=arena.grid(room,unit.location),probe={location:groundZero};
      if(!g||!groundZero||!g.floor.has(g.index(groundZero))||groundZero.starshipId!==unit.location.starshipId||groundZero.arenaId!==unit.location.arenaId)return {ok:false,error:'Choose a valid destination on this map.'};
      const reach=Math.max(1,...(unit.strengthDice||[4]));
      if(arena.distance(room,unit,probe)>reach||!arena.canTarget(room,unit,probe))return {ok:false,error:'Choose a visible destination within your highest Strength die in units.'};
    }

    if(thrown.groundLocation)return {ok:false,error:'Retrieve this weapon before throwing it again.'};
    if(!isExplosive){
      const maximum=[...(unit.strengthDice||[4,4])].sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0),d=requestedTarget?arena.distance(room,unit,requestedTarget):null;
      if(d===null||d>maximum)return {ok:false,error:'Thrown melee range is the sum of the two highest Strength dice.'};
      const g=arena.grid(room,unit.location),start=unit.lastMoveStart&&g.index(unit.lastMoveStart),now=g.index(unit.location),end=g.index(requestedTarget.location);
      let charges=0;if(Number.isInteger(start)){const ax=now%g.width-start%g.width,ay=Math.floor(now/g.width)-Math.floor(start/g.width),bx=end%g.width-now%g.width,by=Math.floor(end/g.width)-Math.floor(now/g.width);if(ax*bx+ay*by>0&&Math.abs(ax*by-ay*bx)<.001)charges=unit.movementChargeUnits||0;}
      const plan=combatRules.attackPlan({...thrown,range:maximum+' Max'},{distance:d,attackType:'melee',charges,strengthDice:unit.strengthDice});plan.allowed=true;plan.attackAttribute='dexterity';plan.attackSkill='Coordination';plan.attackModifier=0;plan.damageScale=.5;plan.specialRules='Thrown weapon: halve damage before protection.';
      thrown.groundLocation={...requestedTarget.location};unit.heldWeaponId='';unit.movementChargeUnits=0;
      return {ok:true,beginAttack:{attackerId:unit.id,defenderId:requestedTarget.id,weaponId:thrown.weaponId,weaponName:'Thrown '+thrown.name,inventoryId:thrown.inventoryId,attackType:'thrown-melee',distance:d,plan,chargeCount:charges}};
    }
    if (!isExplosive && !requestedTarget) return { ok: false, error: "Choose a valid target for the thrown melee weapon." };
    if (isExplosive && !armed && (unit.thrownEffects || []).length >= 5) return { ok: false, error: "This character already has five active queued effects." };
    if (!gearItem && unit.heldWeaponId !== thrown.inventoryId) {
      unit.heldWeaponId = thrown.inventoryId;
      unit.weaponCharge = null;
      unit.aim = null;
    }
    unit.movementChargeUnits = 0;
    if (!gearItem) unit.heldWeaponId = "";
    if (isExplosive) {
      const seconds = Math.max(0.1, Number(thrown.countdownSeconds) || 25);
      const destination = requestedTarget?.characterName || "a chosen map location";
      const throwEffect={
        id: helpers.id(),
        label: thrown.name,
        weaponId: thrown.weaponId,
        inventoryId: thrown.inventoryId,
        origin:groundZero,
        armedMine:thrown.weaponId==='proximity-mine',launcherId:unit.id,
        remaining: seconds,
        total: seconds,
        resolving: false,
        specialType: thrown.specialType || "",
      };
      if(armed)armedOwner.thrownEffects=armedOwner.thrownEffects.filter(e=>e.id!==armed.id);
      if (gearItem) consumeCarriedItem(unit, gearItem.id, 1);
      else unit.weapons=unit.weapons.filter(w=>w.inventoryId!==thrown.inventoryId);
      setCombatBrief(unit, kind, `${thrown.placeable ? "Placed" : "Threw"} ${thrown.name}`, [
        `Destination: ${destination}`,
        `Detonation in ${seconds} sec`,
        "Wait 3 may be used repeatedly while cooking an explosive",
      ]);
      if(thrown.placeable){unit.thrownEffects.push(throwEffect);finishTurn(room,unit,'placed '+thrown.name,helpers);return {ok:true,itemConsumed:gearItem?.id||'',weaponConsumed:gearItem||armed?'':thrown.inventoryId};}
      return {ok:true,itemConsumed:gearItem?.id||'',weaponConsumed:gearItem||armed?'':thrown.inventoryId,beginAttack:{attackerId:unit.id,defenderId:unit.id,weaponId:thrown.weaponId,weaponName:'Throw '+thrown.name,attackType:'effect',consumeEffectTurn:true,personalEffect:{check:true,name:'Throw '+thrown.name,attribute:'dexterity',skill:'Coordination',difficulty:0,throwEffect},plan:{allowed:true,attackModifier:0,attackAttribute:'dexterity',attackSkill:'Coordination'}}};
    }

  }

  if (kind === "useItem") {
    const item = carriedItem(unit, safeText(body.itemId, "", 100));
    if (!item) return { ok: false, error: "Choose a carried item. Items in Storage are unavailable." };
    unit.movementChargeUnits = 0;
    if(['space-suit','kevlar-vest'].includes(item.catalogId)){
      if(item.catalogId==='space-suit'&&unit.raceId==='yuhorn-symitron'&&['ice','lava','rock','wood'].includes(unit.raceType))return {ok:false,error:'This Symitron type cannot wear a Space Suit.'};
      const current=require('./health-display').protectionItem(unit);unit.statuses||={};unit.statuses.armorItemId=current?.id===item.id?'none':item.id;
      finishTurn(room,unit,(unit.statuses.armorItemId==='none'?'removed ':'equipped ')+item.name,helpers);return {ok:true,statusUpdate:true};
    }
    if (item.catalogId === "fire-extinguisher") {
      const patient=requestedTarget||unit;
      if(patient!==unit&&(arena.distance(room,unit,patient)>4||!arena.canTarget(room,unit,patient)))return {ok:false,error:'Choose a visible burning target within 4 units.'};
      if(!patient.burning)return {ok:false,error:'That character is not burning.'};
      const intensity=require('./personal-weapon-effects').extinguish(patient,5);
      finishTurn(room,unit,'used Fire Extinguisher on '+patient.characterName+'; Intensity '+intensity,helpers);return {ok:true};
    }
    if (item.catalogId === "power-shields") {
      if (unit.powerShield?.active) {
        unit.powerShield.active = false;
        setCombatBrief(unit, kind, "Power Shields deactivated", [`${Math.max(0, Number(unit.powerShield.hp) || 0)}/30 Shield HP remains`]);
        finishTurn(room, unit, "deactivated Power Shields", helpers);
        return { ok: true, itemUpdate: { itemId: item.id, charges: unit.powerShield.hp } };
      }
      if (!(Number(item.charges) > 0)) return { ok: false, error: "Power Shields have no charge. Ask the GM to Recharge them." };
      const validIds = new Set(room.units.filter((entry) => !entry.defeatedAt).map((entry) => entry.id));
      const protectedIds = [unit.id, ...(Array.isArray(body.protectedIds) ? body.protectedIds : [])]
        .filter((entry, index, list) => validIds.has(entry) && list.indexOf(entry) === index);
      unit.powerShield = { active: true, itemId: item.id, hp: Math.min(30, Number(item.charges) || 30), maximumHp: 30, protectedIds, activatedAt: Date.now() };
      setCombatBrief(unit, kind, "Power Shields activated", [`Protecting ${protectedIds.length} character${protectedIds.length === 1 ? "" : "s"}`, "Movement disabled; projectiles cannot overflow"]);
      finishTurn(room, unit, `activated Power Shields around ${protectedIds.length} character${protectedIds.length === 1 ? "" : "s"}`, helpers);
      return { ok: true };
    }
    if (item.catalogId === "intoxicating-liquid" && body.consume) {
      consumeCarriedItem(unit, item.id, 1);
      unit.statuses = { ...(unit.statuses || {}), intoxicated: true };
      setCombatBrief(unit, kind, "Drank intoxicating liquid", ["+2 Charisma and Willpower", "-3 Dexterity and Intellect", "Lasts until End Session"]);
      finishTurn(room, unit, "drank intoxicating liquid and is still drunk", helpers);
      return { ok: true, itemConsumed: item.id, statusUpdate: { intoxicated: true } };
    }
    if (item.catalogId === "digital-binoculars") {
      beginTimedAction(room, unit, { id: helpers.id(), kind: "recovery", label: "Focus Digital Binoculars", total: 16.7, remaining: 16.7 }, `${unit.characterName} began focusing Digital Binoculars (Slow Delayed Resolution).`, helpers, { resetAtb: true });
      setCombatBrief(unit, kind, "Focusing Digital Binoculars", ["Slow Delayed Resolution: 16.7 sec", "+4 Common Knowledge and Research when focused"]);
      return { ok: true };
    }
    if (body.consume) consumeCarriedItem(unit, item.id, 1);
    setCombatBrief(unit, kind, `Used ${item.name}`, [body.consume ? "One unit consumed" : "Item retained", item.description]);
    finishTurn(room, unit, `used ${item.name}${body.consume ? " and consumed one" : ""}`, helpers);
    return { ok: true, itemConsumed: body.consume ? item.id : "" };
  }

  if (kind === "firstAid") {
    const aidTarget = room.units.find((entry) => entry.id === safeText(body.targetId, "", 100) && !entry.defeatedAt);
    if (!aidTarget) return { ok: false, error: "Choose the character receiving First Aid." };
    const kit = carriedItem(unit, "first-aid-kit");
    const useKit = Boolean(body.useKit);
    if (useKit && !kit) return { ok: false, error: "This character is not carrying a First Aid Kit." };
    if (useKit) consumeCarriedItem(unit, kit.id, 1);
    const treatmentRating = Math.max(0.1, unit.team === "npc"
      ? Number(unit.mentalAttribute) + Number(unit.mentalSkill)
      : Number(unit.intellectBoxes) + Number(unit.anatomySkill));
    const duration = Math.max(0.1, ceilTenth(100 / treatmentRating));
    unit.movementChargeUnits = 0;
    beginTimedAction(room, unit, {
      id: helpers.id(), kind: "firstAid", label: `First Aid: ${aidTarget.characterName}`, total: duration, remaining: duration,
      targetId: aidTarget.id, useKit, itemId: useKit ? kit.id : "", treatmentRating,
    }, `${unit.characterName} began First Aid on ${aidTarget.characterName} (${duration.toFixed(1)} sec).`, helpers, { resetAtb: true });
    setCombatBrief(unit, kind, `Treating ${aidTarget.characterName}`, [
      `${unit.team === "npc" ? "Mental Attribute + Mental Skill" : "Intellect boxes + First Aid"} = ${treatmentRating.toFixed(1)} Speed`,
      useKit ? "First Aid Kit committed" : "No kit",
    ]);
    return { ok: true, itemConsumed: useKit ? kit.id : "" };
  }

  if (kind === "station") {
    const operation = safeText(body.stationMode, "manual", 30);
    if (!['dismount','mountItem','takeDriver','joinVehicle'].includes(operation)) return {ok:false,error:'Move to a station to occupy it.'};
    if (operation === "dismount") {
      const vehicle = room.vehicles.find((entry) => entry.id === unit.mountedVehicleId);
      if (vehicle) {
        vehicle.occupantIds = vehicle.occupantIds.filter((entry) => entry !== unit.id);
        if (vehicle.driverId === unit.id) { vehicle.driverId = ""; vehicle.currentMoveSpeed = vehicle.moveSpeed; }
        if (!vehicle.occupantIds.length) room.vehicles = room.vehicles.filter((entry) => entry !== vehicle);
      }
      unit.mountedVehicleId = "";
      setCombatBrief(unit, kind, "Dismounted vehicle", []);
      finishTurn(room, unit, "dismounted a vehicle", helpers);
      return { ok: true };
    }
    if (operation === "mountItem") {
      const item = carriedItem(unit, safeText(body.itemId, "", 100));
      const specs = item?.catalogId === "one-man-vehicle" ? { seats: 1, moveSpeed: 5, acceleration: 5, maximumMoveSpeed: 20 }
        : item?.catalogId === "small-atv" ? { seats: 5, moveSpeed: 3, acceleration: 3, maximumMoveSpeed: 12 } : null;
      if (!item || !specs) return { ok: false, error: "Choose a carried vehicle." };
      const vehicle = { id: helpers.id(), ownerId: unit.id, itemId: item.id, itemCatalogId: item.catalogId, name: item.name, driverId: unit.id, occupantIds: [unit.id], currentMoveSpeed: specs.moveSpeed, ...specs };
      room.vehicles.push(vehicle);
      unit.mountedVehicleId = vehicle.id;
      setCombatBrief(unit, kind, `Mounted ${item.name}`, ["Driver seat", `Move Speed ${specs.moveSpeed}; accelerates to ${specs.maximumMoveSpeed}`]);
      finishTurn(room, unit, `mounted ${item.name} as driver`, helpers);
      return { ok: true };
    }
    if (operation === "takeDriver") {
      const vehicle = room.vehicles.find((entry) => entry.id === safeText(body.vehicleId, "", 100));
      if (!vehicle || !vehicle.occupantIds.includes(unit.id) || vehicle.driverId) return { ok: false, error: "That driver seat is unavailable." };
      vehicle.driverId = unit.id;
      vehicle.currentMoveSpeed = vehicle.moveSpeed;
      setCombatBrief(unit, kind, `Took the driver seat of ${vehicle.name}`, [`Move Speed ${vehicle.moveSpeed}; accelerates to ${vehicle.maximumMoveSpeed}`]);
      finishTurn(room, unit, `took the driver seat of ${vehicle.name}`, helpers);
      return { ok: true };
    }
    if (operation === "joinVehicle") {
      const vehicle = room.vehicles.find((entry) => entry.id === safeText(body.vehicleId, "", 100));
      if (!vehicle || vehicle.itemCatalogId !== "small-atv" || vehicle.occupantIds.length >= vehicle.seats) return { ok: false, error: "Choose an available Small ATV passenger seat." };
      vehicle.occupantIds.push(unit.id);
      unit.mountedVehicleId = vehicle.id;
      setCombatBrief(unit, kind, `Mounted ${vehicle.name}`, ["Passenger seat; Move is controlled by the driver"]);
      finishTurn(room, unit, `mounted ${vehicle.name} as a passenger`, helpers);
      return { ok: true };
    }
  }

  if(requestedTarget&&!requestedTarget.doorTarget&&['melee','wrestle','throwItem'].includes(kind)){
    if(!arena.canTarget(room,unit,requestedTarget))return {ok:false,error:'A wall or closed door blocks line of sight to that target.'};
    if(unit.team==='pc'&&!arena.isVisible(room,requestedTarget))return {ok:false,error:'That target is hidden by fog of war.'};
    if(['melee','wrestle'].includes(kind)&&(arena.distance(room,unit,requestedTarget)??1)>Math.max(1.5,weapon?.category==='melee' ? parseFloat(weapon.range)||1 : 1))return {ok:false,error:'Move within melee reach of this target first.'};
  }
  const rangedChargeCount = completedCharges(unit);
  const printedMovementLimit = Number(weapon?.maxCharge);
  const movementChargeLimit = Number.isFinite(printedMovementLimit) && printedMovementLimit > 0
    ? Math.min(Math.max(0, Number(unit.moveSpeed) || 0), printedMovementLimit)
    : Math.max(0, Number(unit.moveSpeed) || 0);
  const movementChargeCount = weapon?.category === "melee"
    ? Math.min(movementChargeLimit, Math.max(0, Number(unit.movementChargeUnits) || 0))
    : 0;
  const chargeCount = weapon?.category === "melee" ? movementChargeCount : rangedChargeCount;
  const chargeText = chargeCount ? ` with ${chargeCount} Charge${chargeCount === 1 ? "" : "s"} (${weapon?.chargeBonus || "card bonus"} each)` : "";
  if (kind === "fire" || kind === "calledShot") {
    if (!weapon) return { ok: false, error: "Choose a held weapon in Supplies first." };
    if(['bore-launcher','mine-launcher'].includes(weapon.id))return {ok:false,error:'Load purchased ammunition using Use Item / Draw Weapon first.'};
    if (!["ranged", "melee"].includes(weapon.category) || (kind === "fire" && weapon.category !== "ranged")) {
      return { ok: false, error: kind === "fire" ? "Fire Gun requires a held ranged weapon." : "Called Shot requires a held ranged or melee weapon." };
    }
    if (!requestedTarget) return { ok: false, error: "Choose a valid target." };
    if(weapon.weaponId==='hull-bore'){
      if(!requestedTarget.wallTarget)return {ok:false,error:'Choose a wall for the Hull Bore.'};
      const travel=3*requestedTarget.distance,seconds=travel+18;
      const drone=require('./personal-bore-drones').launch(room,unit,'hull-bore',{location:requestedTarget.location||unit.location});
      unit.thrownEffects.push({id:helpers.id(),weaponId:'hull-bore',label:'Hull Bore drilling',droneId:drone.id,remaining:seconds,total:seconds,wallTarget:requestedTarget.wallTarget});
      const ammoId=weapon.ammoInventoryId;unit.weapons=unit.weapons.filter(w=>w.inventoryId!==ammoId);unit.launcherAmmo[weapon.inventoryId]=unit.launcherAmmo[weapon.inventoryId].filter(id=>id!==ammoId);
      finishTurn(room,unit,'launched Hull Bore; '+travel.toFixed(1)+' seconds travel, then 18 seconds drilling',helpers);return {ok:true,weaponConsumed:ammoId};
    }
    if(!ammunition.canTarget(weapon,requestedTarget))return {ok:false,error:'The Assassin safety blocks this target. Ask the GM to program its Target ID.'};
    if(ammunition.remaining(weapon)===0)return {ok:false,error:'The magazine is empty. Reload before firing.'};
    if(weapon.weaponId==='murasama-blade'&&body.weaponOptions?.unsheathe&&unit.drawnMurasama?.[weapon.inventoryId])return {ok:false,error:'Sheath the Murasama Blade before gaining another draw bonus.'};
    if(requestedTarget.wallTarget)return {ok:false,error:'Use a loaded Hull Bore to open that wall.'};

    if(!requestedTarget.doorTarget&&!arena.canTarget(room,unit,requestedTarget))return {ok:false,error:'A wall or closed door blocks line of sight to that target.'};
    if(unit.team==='pc'&&!requestedTarget.doorTarget&&!arena.isVisible(room,requestedTarget))return {ok:false,error:'That target is hidden by fog of war.'};
    if(['homing-spike-pistol','skull-bore'].includes(weapon.weaponId)&&chargeCount>0&&unit.crosshairTargetId!==requestedTarget.id)return {ok:false,error:'Charges require the target held in the crosshairs. Aim or Charge at the new target first.'};
    if (weapon.requiredCharge && chargeCount < (weapon.id === "homing-spike-pistol" ? 2 : 1)) return { ok: false, error: weapon.name + " has not completed its required Charges before firing." };
    const calledShot = kind === "calledShot" || Boolean(body.calledShot);
    const attackType = weapon.category === "melee" ? "melee" : "ranged";
    const distance = requestedTarget.doorTarget?requestedTarget.distance:combatRules.mappedDistance(room,unit,requestedTarget)??(attackType === "melee" ? 1 : Math.max(0, Number(body.distance) || 0));
    const aimDie = Math.max(0, Number(unit.aim?.aimDie) || 0);
    const aimDice = unit.aim?.dice || (aimDie ? [aimDie] : []);
    const smokePenalty = attackType === "ranged" ? Math.max(0, Number(body.smokePenalty) || 0) : 0;
    const plan = combatRules.attackPlan(weapon, { distance, charges: chargeCount, aimDie: attackType === "ranged" ? aimDie : 0, aimDice:attackType === "ranged" ? aimDice : [], attackType, strengthDice: unit.strengthDice, situationalAttackModifier: -smokePenalty, options:body.weaponOptions || {} });
    if(weapon.weaponId==='murasama-blade'&&plan.allowed){unit.drawnMurasama ||= {};unit.drawnMurasama[weapon.inventoryId]=true;}
    if (!plan.allowed) return { ok: false, error: weapon.name + " cannot reach a target " + distance + " units away. " + plan.rangeExplanation };
    let additionalAttack=null;
    if(weapon.weaponId==='multi-lock-bizi-21'&&body.weaponOptions?.secondTarget){
      const second=targetUnit(room,unit,body.weaponOptions.secondTarget);if(!second||second.id===requestedTarget.id||!arena.canTarget(room,unit,second)||unit.team==='pc'&&!arena.isVisible(room,second))return {ok:false,error:'Choose two different visible targets.'};
      const secondDistance=arena.distance(room,unit,second)??(Number(body.distance)||0);
      const secondPlan=combatRules.attackPlan(weapon,{distance:secondDistance,charges:chargeCount,aimDice,attackType:'ranged'});if(!secondPlan.allowed)return {ok:false,error:'The second target is out of range.'};
      const parsed=combatRules.parseDiceFormula(plan.damageFormula),dice=[...parsed.dice].flatMap(([sides,n])=>Array(n).fill(sides)).sort((a,b)=>b-a),parts=[new Map(),new Map()];
      dice.forEach((d,i)=>parts[i%2].set(d,(parts[i%2].get(d)||0)+1));
      plan.damageFormula=combatRules.formatDiceFormula({dice:parts[0],flat:parsed.flat/2});plan.attackModifier-=2;
      secondPlan.damageFormula=combatRules.formatDiceFormula({dice:parts[1],flat:parsed.flat/2});secondPlan.attackModifier-=2;
      additionalAttack={attackerId:unit.id,defenderId:second.id,weaponId:weapon.weaponId,inventoryId:weapon.inventoryId,weaponName:weapon.name+' (second target)',attackType:'ranged',distance:secondDistance,plan:secondPlan,chargeCount,aimDice,aimDie,calledShot:false};
    }
    return {
      ok: true,
      beginAttack: {
        additionalAttack,
        attackerId: unit.id,
        defenderId: requestedTarget.id,
        doorTarget:requestedTarget.doorTarget,
        weaponId: weapon.weaponId,
        inventoryId: weapon.inventoryId,
        ammoInventoryId:weapon.ammoInventoryId,
        launcherId:weapon.launcherId,
        weaponName: weapon.name,
        targetName: requestedTarget.characterName,
        distance,
        calledShot,
        calledShotDetail: safeText(body.calledShotDetail, "", 80),
        chargeCount,
        chargeText,
        aimDie,
        aimDice,
        plan,
        recoverySeconds: Math.max(0, Number(plan.recoverySeconds) || Number(weapon.recoverySeconds) || 0),
        attackType,
      },
    };
  }
  if (kind === "melee") {
    const unarmed = weaponsById.get("unarmed");
    const meleeWeapon = weapon?.category === "melee"
      ? weapon
      : { ...unarmed, weaponId: unarmed.id, inventoryId: "" };
    if (!requestedTarget) return { ok: false, error: "Choose a valid target." };
    if(!requestedTarget.doorTarget&&!arena.canTarget(room,unit,requestedTarget))return {ok:false,error:'A wall or closed door blocks line of sight to that target.'};
    if(unit.team==='pc'&&!requestedTarget.doorTarget&&!arena.isVisible(room,requestedTarget))return {ok:false,error:'That target is hidden by fog of war.'};
    const printedLimit = Number(meleeWeapon.maxCharge);
    const movementLimit = Number.isFinite(printedLimit) && printedLimit > 0
      ? Math.min(Math.max(0, Number(unit.moveSpeed) || 0), printedLimit)
      : Math.max(0, Number(unit.moveSpeed) || 0);
    const unarmedMovementCharges = Math.min(movementLimit, Math.max(0, Number(unit.movementChargeUnits) || 0));
    const meleeChargeText = unarmedMovementCharges
      ? ` with ${unarmedMovementCharges} Charge${unarmedMovementCharges === 1 ? "" : "s"} (${meleeWeapon.chargeBonus || "card bonus"} each)`
      : "";
    if(meleeWeapon.weaponId==='murasama-blade'&&body.weaponOptions?.unsheathe&&unit.drawnMurasama?.[meleeWeapon.inventoryId])return {ok:false,error:'The Murasama Blade is already drawn. Sheath it before gaining another draw bonus.'};
    if(meleeWeapon.weaponId==='murasama-blade'){unit.drawnMurasama ||= {};unit.drawnMurasama[meleeWeapon.inventoryId]=true;}
    const distance=requestedTarget.doorTarget?requestedTarget.distance:combatRules.mappedDistance(room,unit,requestedTarget)??1;
    const plan = combatRules.attackPlan(meleeWeapon, { distance, charges: unarmedMovementCharges, attackType: "melee", strengthDice: unit.strengthDice, options:body.weaponOptions || {} });
    return { ok: true, beginAttack: {
      attackerId: unit.id,
      defenderId: requestedTarget.id,
        doorTarget:requestedTarget.doorTarget,
      weaponId: meleeWeapon.weaponId,
      inventoryId: meleeWeapon.inventoryId,
      weaponName: meleeWeapon.name,
      targetName: requestedTarget.characterName,
      distance,
      calledShot: false,
      calledShotDetail: "",
      chargeCount: unarmedMovementCharges,
      chargeText: meleeChargeText,
      aimDie: 0,
      plan,
      recoverySeconds: Math.max(0, Number(meleeWeapon.recoverySeconds) || 0),
      attackType: "melee",
      preserveWeaponState: weapon?.category !== "melee",
    } };
  }

  unit.movementChargeUnits = 0;
  if (kind === "wrestle" && !requestedTarget) return { ok: false, error: "Choose a valid target." };
  const labels = {
    wrestle: `attempted to Grappling ${target}; resolve dice manually`,
    firstAid: "used First Aid (Intellect + First Aid + 2D8; healing cannot exceed Maximum HP)",
    actionResolved: "resolved an action",
  };
  const briefDetails = {
    wrestle: ["Resolve the contest manually", "Target must be nearby"],
    firstAid: ["Requires a First Aid Kit", "Roll Intellect + First Aid, then add 2D8 healing", "Healing cannot exceed Maximum HP"],
    actionResolved: ["Freeform table action"],
  };
  setCombatBrief(unit, kind, labels[kind] || "Action resolved", briefDetails[kind] || []);
  finishTurn(room, unit, labels[kind] || "resolved an action", helpers);
  return { ok: true };
}

function completeStagedAttack(room, unit, attackState, logText, helpers) {
  if (!unit) return;
  if (!attackState?.preserveWeaponState) {
    unit.weaponCharge = null;
    unit.aim = null;
  }
  unit.movementChargeUnits = 0;
  unit.combatBrief = null;
  const counterDelay = Math.max(0, Number(attackState?.counterDelaySeconds) || 0);
  if (counterDelay > 0) {
    beginTimedAction(room, unit, {
      id: helpers.id(),
      kind: "recovery",
      label: "Critical Defense Counter",
      total: counterDelay,
      remaining: counterDelay,
    }, unit.characterName + " " + logText + "; a Critical Defense imposed a " + counterDelay.toFixed(1) + " second Delay.", helpers, { resetAtb: true });
    return;
  }
  const recovery = Math.max(0, Number(attackState?.recoverySeconds) || 0);
  if (recovery > 0) {
    beginTimedAction(room, unit, {
      id: helpers.id(),
      kind: "recovery",
      label: "Reload " + attackState.weaponName,
      total: recovery,
      remaining: recovery,
    }, unit.characterName + " " + logText + "; automatic Reload/Recovery started (" + recovery + " sec).", helpers, { resetAtb: true });
    return;
  }
  finishTurn(room, unit, logText, helpers);
}
module.exports = {
  applyNpcSimplifiedStats,
  combatEventTimes,
  completedCharges,
  completeStagedAttack,
  effectiveSpeed,
  hasCombatCountdown,
  hasTimedAction,
  heldWeapon,
  migrateUnitCombat,
  npcAttributeDice,
  normalizeWeaponRows,
  normalizeItemRows,
  carriedItem,
  consumeCarriedItem,
  spendItemCharge,
  effectiveMoveSpeed,
  cancelTimedActionForForcedDelay,
  resolvePlayerCombatAction,
  sameCombatLocation,
  syncUnitCombat,
  advanceThrown,
  tickCombatTimers,
};
