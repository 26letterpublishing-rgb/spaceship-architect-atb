const weaponCatalog = require("./data/weapons.json");
const combatRules = require("./combat-rules");

const weaponsById = new Map(weaponCatalog.map((weapon) => [weapon.id, weapon]));
const ACTION_KINDS = new Set([
  "wait3",
  "defense",
  "melee",
  "move",
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
  "actionResolved",
]);
const DOOR_OPEN_SECONDS = 0.6;

function normalizeCombatLocation(value) {
  const source = value && typeof value === "object" ? value : {};
  const starshipId = safeText(source.starshipId, "", 120);
  const square = Number.isInteger(Number(source.square)) ? Math.max(0, Math.min(399, Number(source.square))) : null;
  const mesh = Number.isInteger(Number(source.mesh)) ? Math.max(0, Math.min(8, Number(source.mesh))) : 4;
  return {
    environment: starshipId ? "starship" : "exterior",
    starshipId,
    square: starshipId ? square : null,
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
  unit.physicalAttribute = Math.max(2, Math.min(20, Math.round(Number(source.physicalAttribute ?? unit.physicalAttribute) || 4)));
  unit.mentalAttribute = Math.max(2, Math.min(20, Math.round(Number(source.mentalAttribute ?? unit.mentalAttribute) || 4)));
  unit.physicalSkill = Math.max(0, Math.min(4, Number(source.physicalSkill ?? unit.physicalSkill) || 0));
  unit.mentalSkill = Math.max(0, Math.min(4, Number(source.mentalSkill ?? unit.mentalSkill) || 0));
  unit.dexterityDice = npcAttributeDice(unit.physicalAttribute);
  unit.strengthDice = npcAttributeDice(unit.physicalAttribute);
  unit.projectileSkill = unit.physicalSkill;
  unit.meleeSkill = unit.physicalSkill;
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
    return [{ inventoryId, weaponId, ...weapon }];
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
  unit.weapons = weapons;
  unit.heldWeaponId = weapons.some((weapon) => weapon.inventoryId === requestedHeld)
    ? requestedHeld
    : weapons[0]?.inventoryId || "";
  unit.dexterityBoxes = Math.max(0, Math.round(Number(source.dexterityBoxes) || 0));
  unit.highestPerceptionDie = Math.max(0, Math.round(Number(source.highestPerceptionDie) || 0));
  unit.moveSpeed = Math.max(1, Number(source.moveSpeed) || 1);
  unit.weaponMechanics = Math.max(0, Number(source.weaponMechanics) || 0);
  unit.dexterityDice = Array.isArray(source.dexterityDice) ? source.dexterityDice.map(Number).filter((value) => value >= 4 && value <= 20).slice(0, 20) : [];
  unit.projectileSkill = Math.max(0, Number(source.projectileSkill) || 0);
  unit.meleeSkill = Math.max(0, Number(source.meleeSkill) || 0);
  unit.dodgeSkill = Math.max(0, Number(source.dodgeSkill) || 0);
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
    ? unit.travelRoute.slice(0, 600).map(normalizeCombatLocation).filter((entry) => entry.starshipId)
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
    moveSpeed: unit.moveSpeed,
    weaponMechanics: unit.weaponMechanics,
    dexterityDice: unit.dexterityDice,
    projectileSkill: unit.projectileSkill,
    meleeSkill: unit.meleeSkill,
    dodgeSkill: unit.dodgeSkill,
    raceId: unit.raceId,
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
  return (unit?.weapons || []).find((weapon) => weapon.inventoryId === unit.heldWeaponId) || null;
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
  if (jetPack && carriedItem(unit, "jet-pack")?.charges > 0) return 4;
  const vehicle = (room?.vehicles || []).find((entry) => entry.id === unit?.mountedVehicleId);
  if (vehicle && vehicle.driverId === unit.id) return Math.max(1, Number(vehicle.currentMoveSpeed) || Number(vehicle.moveSpeed) || 1);
  return Math.max(1, Number(unit?.moveSpeed) || 1);
}

function resetVehicleAcceleration(room, unit) {
  const vehicle = (room?.vehicles || []).find((entry) => entry.id === unit?.mountedVehicleId && entry.driverId === unit.id);
  if (vehicle) vehicle.currentMoveSpeed = vehicle.moveSpeed;
}

function effectiveSpeed(unit) {
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

function tickCombatTimers(unit, seconds, multiplier = 1, room = null) {
  const completed = [];
  const elapsed = Math.max(0, Number(seconds) || 0) * Math.max(0, Number(multiplier) || 0);
  if (!elapsed) return completed;

  const weapon = heldWeapon(unit);
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

  for (const effect of unit.thrownEffects || []) {
    if (effect.resolving) continue;
    effect.remaining = Math.max(0, (Number(effect.remaining) || 0) - elapsed);
    if (effect.remaining <= 0.0001) {
      effect.remaining = 0;
      effect.resolving = true;
      completed.push({ type: "thrown", unit, effect });
    }
  }

  if (unit.timedAction) {
    unit.timedAction.remaining = Math.max(0, (Number(unit.timedAction.remaining) || 0) - elapsed);
    if (unit.timedAction.remaining <= 0.0001) {
      const completedAction = unit.timedAction;
      unit.timedAction = null;
      if (completedAction.kind === "move" && completedAction.destination) {
        unit.location = normalizeCombatLocation(completedAction.destination);
        applyStationBenefits(unit);
        if (Array.isArray(unit.travelRoute) && unit.travelRoute.length) {
          const moveSpeed = Math.max(1, Number(completedAction.moveSpeed) || Number(unit.moveSpeed) || 1);
          const segment = unit.travelRoute.splice(0, moveSpeed);
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
  const times = [];
  if (unit?.timedAction) times.push(Math.max(0, Number(unit.timedAction.remaining) || 0) / scale);
  for (const effect of unit?.thrownEffects || []) {
    if (!effect.resolving) times.push(Math.max(0, Number(effect.remaining) || 0) / scale);
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
  return true;
}

function targetUnit(room, unit, targetId) {
  return room.units.find((entry) => entry.id === targetId && entry.id !== unit.id && sameCombatLocation(unit, entry)) || null;
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
  if (!unit || room.activeId !== unit.id || !ACTION_KINDS.has(kind)) {
    return { ok: false, error: "That combat action is not currently available." };
  }

  const weapon = heldWeapon(unit);
  room.vehicles = Array.isArray(room.vehicles) ? room.vehicles : [];
  const requestedTarget = targetUnit(room, unit, safeText(body.targetId, "", 100));
  const target = requestedTarget?.characterName || "the chosen target";
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
      ? body.route.slice(0, 600).map(normalizeCombatLocation).filter((entry) => entry.starshipId && entry.starshipId === unit.location?.starshipId)
      : [];
    const units = requestedRoute.length ? Math.min(maxUnits, requestedRoute.length) : clamp(body.units, 1, maxUnits, 1);
    const routeSegment = requestedRoute.slice(0, units);
    const doorDelay = routeDoorDelay(room, routeSegment); const duration = Math.max(0.1, ceilTenth((3 * units) / maxUnits + doorDelay));
    clearAim(unit);
    unit.movementChargeUnits = Math.min(maxUnits, units);
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
    const occupied = room.units.some((entry) => entry.id !== unit.id
      && entry.location?.starshipId === unit.location.starshipId
      && entry.location?.sicId === unit.location.sicId
      && entry.location?.stationed);
    if (occupied) return { ok: false, error: "That SIC station is currently occupied." };
    unit.location.stationed = true;
    unit.location.stationSlot = 0;
    applyStationBenefits(unit);
    unit.travelRoute = [];
    setCombatBrief(unit, kind, `Stationed at ${safeText(body.stationName, "SIC", 80)}`, ["Starship actions available"]);
    finishTurn(room, unit, `entered the ${safeText(body.stationName, "SIC", 80)} station`, helpers);
    return { ok: true };
  }

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

  if (kind === "aim") {
    unit.movementChargeUnits = 0;
    unit.aim = {
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
      unit.aim.aimDie ? `+1D${unit.aim.aimDie} to Dexterity pool and Damage` : "+highest Perception die to Dexterity pool and Damage",
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
    if (!nextWeapon) return { ok: false, error: "Choose a weapon from this character's Supplies." };
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
    const thrown = gearItem?.catalogId === "smoke-grenade"
      ? { inventoryId: gearItem.id, weaponId: "smoke-grenade", name: gearItem.name, throwable: true, placeable: false, countdownSeconds: 5, itemId: gearItem.id, specialType: "smoke" }
      : (unit.weapons || []).find((entry) => entry.inventoryId === inventoryId && (entry.throwable || entry.placeable || entry.category === "melee"));
    if (!thrown) return { ok: false, error: "Choose a throwable explosive or melee weapon." };
    const isExplosive = Boolean(thrown.throwable || thrown.placeable);
    if (!isExplosive && !requestedTarget) return { ok: false, error: "Choose a valid target for the thrown melee weapon." };
    if (isExplosive && (unit.thrownEffects || []).length >= 5) return { ok: false, error: "This character already has five active queued effects." };
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
      unit.thrownEffects.push({
        id: helpers.id(),
        label: thrown.name,
        weaponId: thrown.weaponId,
        inventoryId: thrown.inventoryId,
        remaining: seconds,
        total: seconds,
        resolving: false,
        specialType: thrown.specialType || "",
      });
      if (gearItem) consumeCarriedItem(unit, gearItem.id, 1);
      setCombatBrief(unit, kind, `${thrown.placeable ? "Placed" : "Threw"} ${thrown.name}`, [
        `Destination: ${destination}`,
        `Detonation in ${seconds} sec`,
        "Wait 3 may be used repeatedly while cooking an explosive",
      ]);
      finishTurn(room, unit, `${thrown.placeable ? "placed" : "threw"} ${thrown.name} toward ${destination}; detonation in ${seconds} seconds`, helpers);
      return { ok: true, itemConsumed: gearItem?.id || "" };
    }
    setCombatBrief(unit, kind, `Threw ${thrown.name} -> ${target}`, [
      `To-Hit: ${thrown.toHit}`,
      `Damage: half of ${thrown.damage}`,
      "Resolve attack and damage dice manually",
    ]);
    finishTurn(room, unit, `threw ${thrown.name} at ${target}; use half damage and resolve dice manually`, helpers);
    return { ok: true };
  }

  if (kind === "useItem") {
    const item = carriedItem(unit, safeText(body.itemId, "", 100));
    if (!item) return { ok: false, error: "Choose a carried item. Items in Storage are unavailable." };
    unit.movementChargeUnits = 0;
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
      `${unit.team === "npc" ? "Mental Attribute + Mental Skill" : "Intellect boxes + Anatomy/First Aid"} = ${treatmentRating.toFixed(1)} Speed`,
      useKit ? "First Aid Kit committed" : "No kit",
    ]);
    return { ok: true, itemConsumed: useKit ? kit.id : "" };
  }

  if (kind === "station") {
    const operation = safeText(body.stationMode, "manual", 30);
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
    if (!["ranged", "melee"].includes(weapon.category) || (kind === "fire" && weapon.category !== "ranged")) {
      return { ok: false, error: kind === "fire" ? "Fire Gun requires a held ranged weapon." : "Called Shot requires a held ranged or melee weapon." };
    }
    if (!requestedTarget) return { ok: false, error: "Choose a valid target." };
    if (weapon.requiredCharge && chargeCount < 1) return { ok: false, error: weapon.name + " requires at least one completed Charge before firing." };
    const calledShot = kind === "calledShot" || Boolean(body.calledShot);
    const attackType = weapon.category === "melee" ? "melee" : "ranged";
    const distance = attackType === "melee" ? 1 : Math.max(0, Number(body.distance) || 0);
    const aimDie = Math.max(0, Number(unit.aim?.aimDie) || 0);
    const smokePenalty = attackType === "ranged" ? Math.max(0, Number(body.smokePenalty) || 0) : 0;
    const plan = combatRules.attackPlan(weapon, { distance, charges: chargeCount, aimDie: attackType === "ranged" ? aimDie : 0, attackType, strengthDice: unit.strengthDice, situationalAttackModifier: -smokePenalty });
    if (!plan.allowed) return { ok: false, error: weapon.name + " cannot reach a target " + distance + " units away. " + plan.rangeExplanation };
    return {
      ok: true,
      beginAttack: {
        attackerId: unit.id,
        defenderId: requestedTarget.id,
        weaponId: weapon.weaponId,
        inventoryId: weapon.inventoryId,
        weaponName: weapon.name,
        targetName: requestedTarget.characterName,
        distance,
        calledShot,
        calledShotDetail: safeText(body.calledShotDetail, "", 80),
        chargeCount,
        chargeText,
        aimDie,
        plan,
        recoverySeconds: Math.max(0, Number(weapon.recoverySeconds) || 0),
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
    const printedLimit = Number(meleeWeapon.maxCharge);
    const movementLimit = Number.isFinite(printedLimit) && printedLimit > 0
      ? Math.min(Math.max(0, Number(unit.moveSpeed) || 0), printedLimit)
      : Math.max(0, Number(unit.moveSpeed) || 0);
    const unarmedMovementCharges = Math.min(movementLimit, Math.max(0, Number(unit.movementChargeUnits) || 0));
    const meleeChargeText = unarmedMovementCharges
      ? ` with ${unarmedMovementCharges} Charge${unarmedMovementCharges === 1 ? "" : "s"} (${meleeWeapon.chargeBonus || "card bonus"} each)`
      : "";
    const plan = combatRules.attackPlan(meleeWeapon, { distance: 1, charges: unarmedMovementCharges, attackType: "melee", strengthDice: unit.strengthDice });
    return { ok: true, beginAttack: {
      attackerId: unit.id,
      defenderId: requestedTarget.id,
      weaponId: meleeWeapon.weaponId,
      inventoryId: meleeWeapon.inventoryId,
      weaponName: meleeWeapon.name,
      targetName: requestedTarget.characterName,
      distance: 1,
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
  const stationName = safeText(body.stationName, "an SIC", 80);
  const labels = {
    wrestle: `attempted to Wrestle/Disarm ${target}; resolve dice manually`,
    firstAid: "used First Aid (Intellect + Anatomy/First Aid + 2D8; healing cannot exceed Maximum HP)",
    station: `became stationed at ${stationName}`,
    actionResolved: "resolved an action",
  };
  const briefDetails = {
    wrestle: ["Resolve the contest manually", "Target must be nearby"],
    firstAid: ["Requires a First Aid Kit", "Roll Intellect + Anatomy/First Aid, then add 2D8 healing", "Healing cannot exceed Maximum HP"],
    station: [`Station: ${stationName}`],
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
  tickCombatTimers,
};
