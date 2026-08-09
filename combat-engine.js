const weaponCatalog = require("./data/weapons.json");

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
  "actionResolved",
]);

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
  unit.aim = unit.aim && typeof unit.aim === "object" ? unit.aim : null;
  unit.weaponCharge = unit.weaponCharge && typeof unit.weaponCharge === "object" ? unit.weaponCharge : null;
  unit.timedAction = unit.timedAction && typeof unit.timedAction === "object" ? unit.timedAction : null;
  unit.commandCarrySeconds = unit.commandCarrySeconds === null || unit.commandCarrySeconds === undefined
    ? null
    : Math.max(0, Number(unit.commandCarrySeconds) || 0);
  unit.movementChargeUnits = Math.max(0, Number(unit.movementChargeUnits) || 0);
  unit.thrownEffects = Array.isArray(unit.thrownEffects) ? unit.thrownEffects.slice(0, 5) : [];
  unit.combatBrief = unit.combatBrief && typeof unit.combatBrief === "object" ? unit.combatBrief : null;

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
  });
}

function heldWeapon(unit) {
  return (unit?.weapons || []).find((weapon) => weapon.inventoryId === unit.heldWeaponId) || null;
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

function tickCombatTimers(unit, seconds, multiplier = 1) {
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
  unit.atb = 0;
  return true;
}

function completedCharges(unit) {
  const weapon = heldWeapon(unit);
  if (!weapon || !unit.weaponCharge || unit.weaponCharge.inventoryId !== weapon.inventoryId) return 0;
  const segments = Math.max(1, Number(weapon.chargeSegments) || 1);
  return Math.min(segments, Math.floor(((Number(unit.weaponCharge.progress) || 0) + 0.00001) / (100 / segments)));
}

function targetUnit(room, unit, targetId) {
  return room.units.find((entry) => entry.id === targetId && entry.id !== unit.id) || null;
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
  if (!unit || room.activeId !== unit.id || unit.team !== "pc" || !ACTION_KINDS.has(kind)) {
    return { ok: false, error: "That combat action is not currently available." };
  }

  const weapon = heldWeapon(unit);
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
    const maxUnits = Math.max(1, Number(unit.moveSpeed) || 1);
    const units = clamp(body.units, 1, maxUnits, 1);
    const duration = Math.max(0.1, ceilTenth((3 * units) / maxUnits));
    clearAim(unit);
    unit.movementChargeUnits = Math.min(maxUnits, units);
    beginTimedAction(room, unit, {
      id: helpers.id(),
      kind: "move",
      label: `Move ${units} unit${units === 1 ? "" : "s"}`,
      total: duration,
      remaining: duration,
      units,
    }, `${unit.characterName} moved ${units} unit${units === 1 ? "" : "s"} (${duration.toFixed(1)} sec).`, helpers);
    setCombatBrief(unit, kind, `Moved ${units} unit${units === 1 ? "" : "s"}`, [`Immediate action in ${duration.toFixed(1)} sec`, `${units} melee movement Charge${units === 1 ? "" : "s"}`]);
    return { ok: true };
  }

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
    setCombatBrief(unit, kind, "Aim", [`+${unit.aim.speedBonus} ATB Speed`, unit.aim.aimDie ? `+1D${unit.aim.aimDie} to Dexterity pool and Damage` : "+highest Perception die to Dexterity pool and Damage"]);
    finishTurn(room, unit, `aimed; the next ATB refill gains +${unit.aim.speedBonus} Speed`, helpers);
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
    const thrown = (unit.weapons || []).find((entry) => entry.inventoryId === inventoryId && (entry.throwable || entry.placeable || entry.category === "melee"));
    if (!thrown) return { ok: false, error: "Choose a throwable explosive or melee weapon." };
    const isExplosive = Boolean(thrown.throwable || thrown.placeable);
    if (!isExplosive && !requestedTarget) return { ok: false, error: "Choose a valid target for the thrown melee weapon." };
    if (isExplosive && (unit.thrownEffects || []).length >= 5) return { ok: false, error: "This character already has five active queued effects." };
    if (unit.heldWeaponId !== thrown.inventoryId) {
      unit.heldWeaponId = thrown.inventoryId;
      unit.weaponCharge = null;
      unit.aim = null;
    }
    unit.movementChargeUnits = 0;
    unit.heldWeaponId = "";
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
      });
      setCombatBrief(unit, kind, `${thrown.placeable ? "Placed" : "Threw"} ${thrown.name}`, [
        `Destination: ${destination}`,
        `Detonation in ${seconds} sec`,
        "Wait 3 may be used repeatedly while cooking an explosive",
      ]);
      finishTurn(room, unit, `${thrown.placeable ? "placed" : "threw"} ${thrown.name} toward ${destination}; detonation in ${seconds} seconds`, helpers);
      return { ok: true };
    }
    setCombatBrief(unit, kind, `Threw ${thrown.name} -> ${target}`, [
      `To-Hit: ${thrown.toHit}`,
      `Damage: half of ${thrown.damage}`,
      "Resolve attack and damage dice manually",
    ]);
    finishTurn(room, unit, `threw ${thrown.name} at ${target}; use half damage and resolve dice manually`, helpers);
    return { ok: true };
  }

  const chargeCount = completedCharges(unit);
  const chargeText = chargeCount ? ` with ${chargeCount} Charge${chargeCount === 1 ? "" : "s"} (${weapon?.chargeBonus || "card bonus"} each)` : "";
  if (kind === "fire" || kind === "calledShot") {
    if (!weapon) return { ok: false, error: "Choose a held weapon in Supplies first." };
    if (!["ranged", "melee"].includes(weapon.category) || (kind === "fire" && weapon.category !== "ranged")) {
      return { ok: false, error: kind === "fire" ? "Fire Gun requires a held ranged weapon." : "Called Shot requires a held ranged or melee weapon." };
    }
    if (!requestedTarget) return { ok: false, error: "Choose a valid target." };
    if (weapon.requiredCharge && chargeCount < 1) return { ok: false, error: `${weapon.name} requires at least one completed Charge before firing.` };
    const aimDetails = unit.aim
      ? [unit.aim.aimDie ? `Aim adds 1D${unit.aim.aimDie} to Dexterity and Damage` : "Aim adds the highest Perception die to Dexterity and Damage"]
      : [];
    unit.weaponCharge = null;
    unit.aim = null;
    unit.movementChargeUnits = 0;
    const called = kind === "calledShot" ? "made a Called Shot" : weapon.category === "melee" ? "made a melee attack" : "fired";
    const calledDetails = kind === "calledShot" ? ["Target Defense +5 for To-Hit; on hit apply -5 Defense instead"] : [];
    setCombatBrief(unit, kind, `${kind === "calledShot" ? "Called Shot" : "Fire"}: ${weapon.name} -> ${target}`, [
      `To-Hit: ${weapon.toHit}`,
      `Damage: ${weapon.damage}${chargeText}`,
      ...aimDetails,
      ...calledDetails,
    ]);
    const logText = `${called} with ${weapon.name} at ${target}${chargeText}; resolve attack and damage dice manually`;
    const recovery = Math.max(0, Number(weapon.recoverySeconds) || 0);
    if (recovery > 0) {
      beginTimedAction(room, unit, {
        id: helpers.id(),
        kind: "recovery",
        label: `Reload ${weapon.name}`,
        total: recovery,
        remaining: recovery,
      }, `${unit.characterName} ${logText}; automatic Reload/Recovery started (${recovery} sec).`, helpers, { resetAtb: true });
      return { ok: true };
    }
    finishTurn(room, unit, logText, helpers);
    return { ok: true };
  }

  if (kind === "melee") {
    if (!weapon || weapon.category !== "melee") return { ok: false, error: "Melee Attack requires a held melee weapon." };
    if (!requestedTarget) return { ok: false, error: "Choose a valid target." };
    const movementCharges = Math.min(Math.max(0, Number(unit.moveSpeed) || 0), Math.max(0, Number(unit.movementChargeUnits) || 0));
    unit.movementChargeUnits = 0;
    setCombatBrief(unit, kind, `Melee: ${weapon.name} -> ${target}`, [
      `To-Hit: ${weapon.toHit}`,
      `Damage: ${weapon.damage}`,
      movementCharges ? `${movementCharges} movement Charge${movementCharges === 1 ? "" : "s"}: ${weapon.chargeBonus} each` : "No movement Charges",
    ]);
    finishTurn(room, unit, `made a melee attack against ${target}${movementCharges ? ` with ${movementCharges} movement Charge${movementCharges === 1 ? "" : "s"}` : ""}; resolve dice manually`, helpers);
    return { ok: true };
  }

  unit.movementChargeUnits = 0;
  if (kind === "wrestle" && !requestedTarget) return { ok: false, error: "Choose a valid target." };
  const stationName = safeText(body.stationName, "an SIC", 80);
  const itemName = safeText(body.itemName, "an item", 80);
  const labels = {
    wrestle: `attempted to Wrestle/Disarm ${target}; resolve dice manually`,
    useItem: `used ${itemName}`,
    firstAid: "used First Aid (Intellect + Anatomy/First Aid + 2D8; healing cannot exceed Maximum HP)",
    station: `became stationed at ${stationName}`,
    actionResolved: "resolved an action",
  };
  const briefDetails = {
    wrestle: ["Resolve the contest manually", "Target must be nearby"],
    useItem: ["Resolve the item's effect manually"],
    firstAid: ["Requires a First Aid Kit", "Roll Intellect + Anatomy/First Aid, then add 2D8 healing", "Healing cannot exceed Maximum HP"],
    station: [`Station: ${stationName}`],
    actionResolved: ["Freeform table action"],
  };
  setCombatBrief(unit, kind, labels[kind] || "Action resolved", briefDetails[kind] || []);
  finishTurn(room, unit, labels[kind] || "resolved an action", helpers);
  return { ok: true };
}

module.exports = {
  combatEventTimes,
  completedCharges,
  effectiveSpeed,
  hasCombatCountdown,
  hasTimedAction,
  heldWeapon,
  migrateUnitCombat,
  normalizeWeaponRows,
  cancelTimedActionForForcedDelay,
  resolvePlayerCombatAction,
  syncUnitCombat,
  tickCombatTimers,
};
