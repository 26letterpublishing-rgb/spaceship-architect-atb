const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { CampaignStore } = require("./campaign-store");
const { CampaignApi } = require("./campaign-api");
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

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";
const PUBLIC_DIR = __dirname;

const rooms = new Map();
const clients = new Map();
const roomPersistTimers = new Map();
const npcDefeatTimers = new Map();
const campaignStore = new CampaignStore();
let campaignApi = null;
let stateSequence = 0;
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

function createRoom(requestedCode = "", snapshot = null) {
  let code = String(requestedCode || "").trim().toUpperCase() || roomCode();
  while (!requestedCode && rooms.has(code)) code = roomCode();
  const room = {
    roomCode: code,
    running: false,
    pausedForTurn: false,
    resumeAfterTurn: false,
    activeId: null,
    activeAction: null,
    attackResolution: null,
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
    units: [],
    log: [],
    undoSnapshot: null,
    undoLabel: "",
    lastPersistRequestAt: 0,
  };
  if (snapshot && typeof snapshot === "object") {
    room.running = Boolean(snapshot.running);
    room.pausedForTurn = Boolean(snapshot.pausedForTurn);
    room.resumeAfterTurn = Boolean(snapshot.resumeAfterTurn);
    room.activeId = snapshot.activeId || null;
    room.activeAction = clone(snapshot.activeAction);
    room.attackResolution = restoreAttackResolution(snapshot.attackResolution);
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
    room.threshold = Math.max(1, Number(snapshot.threshold) || 100);
    room.units = Array.isArray(snapshot.units) ? clone(snapshot.units) : [];
    for (const unit of room.units) unit.playerConnected = Boolean(unit.playerConnected);
    room.log = Array.isArray(snapshot.log) ? clone(snapshot.log).slice(-80) : [];
    room.running = false;
    room.hardPaused = true;
  }
  rooms.set(code, room);
  clients.set(code, new Set());
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
  if (!campaign) return null;
  return createRoom(normalized, campaign.encounter);
}

function scheduleRoomPersist(room, delay = 250) {
  if (!campaignApi || !room?.roomCode) return;
  clearTimeout(roomPersistTimers.get(room.roomCode));
  roomPersistTimers.set(room.roomCode, setTimeout(async () => {
    roomPersistTimers.delete(room.roomCode);
    try {
      await campaignApi.saveEncounter(room.roomCode, snapshotRoom(room));
    } catch (error) {
      console.error(`Could not persist encounter ${room.roomCode}:`, error.message);
    }
  }, delay));
}

function publicState(room) {
  migrateRoomDelays(room);
  const command = commandState(room);
  return {
    revision: ++stateSequence,
    roomCode: room.roomCode,
    running: room.running,
    pausedForTurn: room.pausedForTurn,
    activeId: room.activeId,
    activeAction: room.activeAction,
    attackResolution: publicAttackResolution(room),
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
    units: room.units,
    log: room.log.slice(-30),
    undoAvailable: Boolean(room.undoSnapshot),
  };
}

function pushLog(room, text) {
  room.log.push({ id: id(), at: new Date().toLocaleTimeString(), text });
  room.log = room.log.slice(-80);
}

async function applyDamageToUnit(room, target, rawDamage, source) {
  if (!target) return null;
  const incoming = Math.max(0, Number(rawDamage) || 0);
  let result = null;
  if (target.characterId && campaignApi) {
    result = await campaignApi.damageCharacter(room.roomCode, target.characterId, incoming, source, { currentHp: target.currentHp, maximumHp: target.maximumHp, damageReduction: target.damageReduction });
  }
  if (!result) {
    const reduction = Math.max(0, Number(target.damageReduction) || 0);
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
  syncNpcDefeat(room, target);
  return target.damageEvent;
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
  if (!room || !unit || unit.team !== "npc") return;
  const hp = Number(unit.currentHp);
  if (!Number.isFinite(hp) || hp > 0) {
    cancelNpcDefeat(room.roomCode, unit.id);
    delete unit.defeatedAt;
    delete unit.defeatRemovesAt;
    return;
  }
  const newlyDefeated = !unit.defeatedAt;
  unit.defeatedAt = Number(unit.defeatedAt) || Date.now();
  unit.defeatRemovesAt = Number(unit.defeatRemovesAt) || unit.defeatedAt + 3500;
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
    liveRoom.units = liveRoom.units.filter((entry) => entry.id !== defeated.id);
    if (affectedAttack) {
      liveRoom.attackResolution = null;
      clearAttackCommand(liveRoom);
    }
    if (liveRoom.activeAction?.unitId === defeated.id) liveRoom.activeAction = null;
    if (wasActive || affectedAttack) {
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
  const defender = room.units.find((entry) => entry.id === details.defenderId);
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
  const defenseTimed = defender?.timedAction?.kind === "defense";
  const defenseBonus = defenseTimed ? Math.max(0, Number(defender.dodgeSkill) || 0) : 0;
  const targetDefense = Number(state.defenseRoll.score) + defenseBonus;
  state.defenseBonus = defenseBonus;
  state.attackResult = combatRules.resolveAttack({
    baseAttackScore: state.attackerRoll.score,
    targetDefense,
    calledShot: state.calledShot,
    plan: state.plan,
  });
  const attacker = room.units.find((entry) => entry.id === state.attackerId);
  if (!state.attackResult.hit && state.attackType === "melee" && defenseTimed) {
    const defenderCritical = targetDefense >= Number(state.attackResult.attackScore) * 2;
    if (defenderCritical) {
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
    running: room.running,
    pausedForTurn: room.pausedForTurn,
    resumeAfterTurn: room.resumeAfterTurn,
    activeId: room.activeId,
    activeAction: clone(room.activeAction),
    attackResolution: snapshotAttackResolution(room),
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
    units: clone(room.units),
    log: clone(room.log),
  };
}

function saveUndoSnapshot(room, label = "combat change") {
  room.undoSnapshot = snapshotRoom(room);
  room.undoLabel = String(label || "combat change").slice(0, 80);
}

function restoreUndoSnapshot(room) {
  if (!room.undoSnapshot) return false;
  cancelRoomNpcDefeats(room.roomCode);
  const snapshot = room.undoSnapshot;
  room.running = snapshot.running;
  room.pausedForTurn = snapshot.pausedForTurn;
  room.resumeAfterTurn = snapshot.resumeAfterTurn;
  room.activeId = snapshot.activeId;
  room.activeAction = clone(snapshot.activeAction);
  room.attackResolution = restoreAttackResolution(snapshot.attackResolution);
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
  room.threshold = snapshot.threshold;
  room.units = clone(snapshot.units);
  for (const unit of room.units) if (unit.defeatedAt) syncNpcDefeat(room, unit);
  room.log = clone(snapshot.log);
  room.undoSnapshot = null;
  room.undoLabel = "";
  room.lastTick = Date.now();
  pushLog(room, "GM undid the last combat change.");
  return true;
}

const gmUndoableActions = new Set([
  "addUnit",
  "removeUnit",
  "syncCampaignUnits",
  "refreshCharacterVersion",
  "setNpcCombatStat",
  "setNpcWeapon",
  "gmBeginNpcAttack",
  "submitAttackRoll",
  "submitAttackDamage",
  "confirmNpcDamage",
  "setNpcHp",
  "setRunning",
  "setHardPaused",
  "toggleClock",
  "setSpeed",
  "setCommandWindow",
  "setName",
  "setColor",
  "requestDelay",
  "cancelDelayRequest",
  "startDelay",
  "updateDelay",
  "instantDelay",
  "impairQueuedEffect",
  "removeQueuedEffect",
  "step",
  "reset",
  "clearEncounter",
  "completeTurn",
  "nudge",
  "applyDamage",
]);

const gmClockOnlyActions = new Set(["setRunning", "setHardPaused", "toggleClock", "step"]);

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  const data = publicState(room);
  for (const res of clients.get(room.roomCode) || []) sendEvent(res, "state", data);
}

function normalizeSpeed(value) {
  if (value === null || value === undefined || value === "") return null;
  return Math.max(1, Math.min(100, Number(value) || 1));
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
  return !unit.speed || (unit.team === "pc" && !unit.commandWindow);
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
  return room.units.filter((unit) => unit.id !== excludeId && !unit.defeatedAt && !hasDelay(unit) && unit.atb >= room.threshold).sort((a, b) => tieCompare(a, b))[0];
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
  return Boolean(unit?.delayTimer || unit?.delayedAction || unit?.delay || hasTimedAction(unit));
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
  if (!unit || room.pausedForTurn) return;
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
  for (const unit of room.units) {
    const thrown = (unit.thrownEffects || []).find((effect) => effect.resolving);
    if (thrown) {
      resolveCompletedEvent(room, { type: "thrown", unit, effect: thrown }, nextTurnSource(room, previousSource));
      return;
    }
    const queued = (unit.queuedEffects || []).find((effect) => effect.resolving);
    if (queued) {
      resolveCompletedEvent(room, { type: "queued", unit, effect: queued }, nextTurnSource(room, previousSource));
      return;
    }
    if (unit.delayedAction?.resolving) {
      resolveCompletedEvent(room, { type: "delayed", unit, delay: unit.delayedAction }, nextTurnSource(room, previousSource));
      return;
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

function addProgress(room, seconds, { slow = false, skipId = null } = {}) {
  const multiplier = slow ? 0.2 : 1;
  const completedEvents = [];
  for (const unit of room.units) {
    if (unit.id === skipId || unit.defeatedAt || !unit.speed) continue;
    const wasTimed = hasTimedAction(unit);
    for (const event of tickCombatTimers(unit, seconds, multiplier)) {
      if (event.type === "timed") {
        if (event.timedAction.kind === "defense") {
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
        campaignApi?.healCharacter(room.roomCode, unit.characterId, healing).catch(() => {});
        pushLog(room, `${unit.characterName}'s Antropic Fins restored ${healing} HP.`);
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
    if (wasTimed || hasTimedAction(unit)) continue;
    if (unit.atb < room.threshold) unit.atb += effectiveSpeed(unit) * seconds * multiplier;
  }
  return completedEvents;
}

function resolveCompletedEvent(room, event, source) {
  if (!event) return false;
  if (event.type === "queued") {
    pauseForQueuedEffect(room, event.unit, event.effect, source);
    return true;
  }
  if (event.type === "thrown") {
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
  if (event.type === "timed") return false;
  pauseForDelayedAction(room, event.unit, source);
  return true;
}

function advanceSeconds(room, seconds = 1, { exact = false, source = "clock" } = {}) {
  if (room.pausedForTurn || room.holdPaused) return;

  const interruptedId = room.commandExpired ? room.activeId : null;

  if (!exact) {
    const completedEvents = addProgress(room, seconds, { slow: Boolean(interruptedId), skipId: interruptedId });
    if (completedEvents.length) {
      if (interruptedId) interruptActiveTurn(room);
      resolveCompletedEvent(room, completedEvents[0], source);
      return;
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
    .filter((unit) => unit.speed > 0 && !unit.defeatedAt && unit.id !== interruptedId)
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
      if (hasTimedAction(unit)) return [...effectTimes, ...timerTimes];
      const speed = effectiveSpeed(unit) * multiplier;
      return [...effectTimes, ...timerTimes, speed > 0 ? Math.max(0, (room.threshold - unit.atb) / speed) : Infinity];
    })
    .filter((time) => Number.isFinite(time));
  if (!times.length) return;

  const nextReadyIn = Math.min(...times);
  if (nextReadyIn <= seconds) {
    const completedEvents = addProgress(room, nextReadyIn, { slow: Boolean(interruptedId), skipId: interruptedId });
    if (interruptedId) interruptActiveTurn(room);
    if (completedEvents.length) {
      resolveCompletedEvent(room, completedEvents[0], source);
      return;
    }
    const ready = findReadyUnit(room);
    if (ready) pauseForReadyUnit(room, ready, source);
  } else {
    addProgress(room, seconds, { slow: Boolean(interruptedId), skipId: interruptedId });
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    migrateRoomDelays(room);
    if (room.hardPaused) continue;
    const defenseCommand = attackCommandState(room);
    if (defenseCommand && room.attackResolution?.defenderCommandDeadline) {
      if (Date.now() >= room.attackResolution.defenderCommandDeadline) {
        room.attackResolution.defenderCommandExpired = true;
        room.attackResolution.defenderCommandDeadline = null;
        room.attackResolution.defenderCommandHeldRemaining = null;
        const defender = room.units.find((entry) => entry.id === room.attackResolution.defenderId);
        if (defender) pushLog(room, defender.characterName + "'s Defense Command Window expired; the GM may resolve it.");
      }
      broadcast(room);
      if (Date.now() - room.lastPersistRequestAt >= 2000) {
        room.lastPersistRequestAt = Date.now();
        scheduleRoomPersist(room, 0);
      }
      continue;
    }
    if (room.attackResolution) continue;
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
      broadcast(room);
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
    broadcast(room);
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
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.join(PUBLIC_DIR, filePath);
  if (!absolute.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(absolute, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(absolute), "Cache-Control": "no-store" });
    res.end(data);
  });
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
  res.writeHead(status, { "Content-Type": "application/json" });
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

async function handleAction(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Bad JSON" });
    return;
  }

  const room = getRoom(body.roomCode) || await ensureCampaignRoom(body.roomCode);
  if (!room) {
    sendJson(res, 404, { error: "Room not found" });
    return;
  }
  migrateRoomDelays(room);

  const action = body.action;
  const gmAuthorized = await campaignApi?.verifyGmAccess(room.roomCode, body.gmToken);
  const playerUnit = body.id
    ? room.units.find((entry) => entry.id === body.id)
    : body.characterId ? room.units.find((entry) => entry.characterId === String(body.characterId)) : null;
  const characterAuthorized = Boolean(body.characterId)
    && await campaignApi?.verifyCharacterAccess(room.roomCode, String(body.characterId), body.characterToken);
  const playerAuthorized = playerUnit?.characterId
    && playerUnit.characterId === String(body.characterId || "")
    && characterAuthorized;
  const joiningPlayer = action === "join" && body.controlledBy === "player";
  if (joiningPlayer) {
    const allowed = body.characterId && await campaignApi?.verifyCharacterAccess(room.roomCode, String(body.characterId), body.characterToken);
    if (!allowed) {
      sendJson(res, 403, { error: "Unlock this campaign character before joining the encounter." });
      return;
    }
  } else if (["completeTurn", "requestDelay", "logPlayerAction", "setColor", "characterSpeedBoost", "playerCombatAction", "syncCharacterLoadout", "submitAttackRoll", "submitAttackDamage"].includes(action) && playerUnit) {
    if (!playerAuthorized && !gmAuthorized) {
      sendJson(res, 403, { error: "Character or GM authorization is required." });
      return;
    }
  } else if (action === "refreshCharacterVersion") {
    if (!characterAuthorized && !gmAuthorized) {
      sendJson(res, 403, { error: "Character or GM authorization is required." });
      return;
    }
  } else if (!gmAuthorized) {
    sendJson(res, 403, { error: "GM authorization is required for that encounter control." });
    return;
  }
  if (action === "undoLastAction" || action === "undoLastTiming") {
    const restored = restoreUndoSnapshot(room);
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
  if (action === "submitAttackDamage") {
    const attack = room.attackResolution;
    if (!attack || attack.id !== String(body.attackId || "") || attack.phase !== "damage" || attack.damageRoll) {
      sendJson(res, 409, { error: "That Damage roll is no longer waiting." });
      return;
    }
  }

  if (gmAuthorized && gmUndoableActions.has(action)) {
    // Clock movement must not erase the checkpoint for a substantive GM edit.
    if (!gmClockOnlyActions.has(action) || !room.undoSnapshot) saveUndoSnapshot(room, action);
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
    if (existingCampaignUnit) {
      existingCampaignUnit.playerName = playerName;
      existingCampaignUnit.characterName = characterName;
      existingCampaignUnit.speed = speed;
      existingCampaignUnit.commandWindow = commandWindow;
      existingCampaignUnit.color = normalizeColor(body.color);
      existingCampaignUnit.controlledBy = "player";
      existingCampaignUnit.team = "pc";
      existingCampaignUnit.playerConnected = true;
      syncUnitCombat(existingCampaignUnit, body);
      pushLog(room, `${characterName} rejoined the encounter.`);
      sendJson(res, 200, publicState(room));
      broadcast(room);
      scheduleRoomPersist(room, 0);
      campaignApi?.broadcast(room.roomCode).catch(() => {});
      return;
    }
    const unit = {
      id: id(),
      playerName,
      characterName,
      speed,
      commandWindow,
      atb: Math.max(0, Math.min(room.threshold - 0.001, Number(body.initialAtb) || 0)),
      encounterSpeedBonus: 0,
      regenerationRate: Math.max(0, Math.min(100, Number(body.regenerationRate) || 0)),
      regenerationProgress: 0,
      delay: null,
      delayTimer: null,
      delayedAction: null,
      queuedEffects: [],
      controlledBy: body.controlledBy || "player",
      team: normalizeTeam(body.team || (body.controlledBy === "player" ? "pc" : "npc")),
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
    if (result.beginAttack && !beginAttackResolution(room, result.beginAttack)) {
      sendJson(res, 409, { error: "The attacker or defender is no longer in this encounter." });
      return;
    }
  }

  if (action === "gmBeginNpcAttack") {
    const attacker = room.units.find((entry) => entry.id === String(body.attackerId || "") && entry.team === "npc");
    const defender = room.units.find((entry) => entry.id === String(body.defenderId || "") && entry.id !== attacker?.id);
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
    const target = room.units.find((entry) => entry.id === state.defenderId);
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
    if (target.team === "npc") {
      state.phase = "gmDamage";
      pushLog(room, "GM confirmation requested for " + target.characterName + ": " + state.damageSummary.applied + " final Damage after DR " + state.damageSummary.reduction + ".");
    } else {
      const damageEvent = await applyDamageToUnit(room, target, state.damageSummary.beforeReduction, state.attackerName + "'s " + state.weaponName);
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
    directNpcDamage(room, target, finalDamage, state);
    const logText = attackResolutionLog(state, finalDamage);
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
    await applyDamageToUnit(room, target, amount, String(body.source || "GM-resolved NPC attack").trim().slice(0, 160) || "GM-resolved NPC attack");
  }

  if (action === "removeUnit") {
    const unit = room.units.find((entry) => entry.id === body.id);
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
    room.units = room.units.filter((entry) => entry.id !== body.id);
    if (wasActive) {
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
      hardResumeRoom(room);
    } else if (room.running || room.pausedForTurn || room.holdPaused || room.activeAction) {
      hardPauseRoom(room);
    } else if (!canStartClock(room)) {
      pushLog(room, "Clock cannot start until every participant has GM-entered values.");
    } else {
      room.running = true;
      room.resumeAfterTurn = true;
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
    requestDelay(room, unit, body.kind, body.requestedBy);
  }

  if (action === "cancelDelayRequest") {
    cancelDelayRequest(room);
  }

  if (action === "startDelay") {
    const unit = room.units.find((entry) => entry.id === body.id);
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

  if (action === "reset") {
    room.attackResolution = null;
    for (const unit of room.units) {
      unit.atb = 0;
      unit.delay = null;
      unit.delayTimer = null;
      unit.delayedAction = null;
      unit.queuedEffects = [];
      unit.weaponCharge = null;
      unit.timedAction = null;
      unit.commandCarrySeconds = null;
      unit.movementChargeUnits = 0;
      unit.aim = null;
      unit.thrownEffects = [];
    }
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
    pushLog(room, "Encounter reset.");
  }

  if (action === "clearEncounter") {
    room.attackResolution = null;
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

  if (action === "exitEncounter") {
    room.attackResolution = null;
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
    if (unit && !room.pausedForTurn) {
      unit.atb = Math.min(room.threshold, unit.atb + Math.max(1, Number(body.amount) || 1));
      if (unit.atb >= room.threshold && !hasDelay(unit)) {
        if (room.commandExpired && room.activeId) interruptActiveTurn(room);
        pauseForReadyUnit(room, unit, room.resumeAfterTurn ? "clock" : "manual");
      }
    }
  }

  sendJson(res, 200, publicState(room));
  broadcast(room);
  scheduleRoomPersist(room);
  if (["join", "addUnit", "removeUnit", "clearEncounter", "exitEncounter"].includes(action)) campaignApi?.broadcast(room.roomCode).catch(() => {});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
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
    sendJson(res, 200, publicState(room));
    return;
  }

  if (url.pathname === "/api/keep-alive" && req.method === "POST") {
    const room = await ensureCampaignRoom(url.searchParams.get("room"));
    if (!room) {
      sendJson(res, 404, { error: "Room not found" });
      return;
    }
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const roomClients = clients.get(room.roomCode) || new Set();
    clients.set(room.roomCode, roomClients);
    roomClients.add(res);
    const heartbeat = setInterval(() => {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    }, HEARTBEAT_MS);
    sendEvent(res, "state", publicState(room));
    req.on("close", () => {
      clearInterval(heartbeat);
      roomClients.delete(res);
    });
    return;
  }

  serveStatic(req, res);
});

async function startServer() {
  await campaignStore.init();
  campaignApi = new CampaignApi({
    store: campaignStore,
    storageMode: campaignStore.mode,
    connectedCharacterIds: (code) => (getRoom(code)?.units || []).filter((unit) => unit.team === "pc" && unit.characterId && unit.playerConnected).map((unit) => unit.characterId),
    restoreEncounter: (code, snapshot) => {
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
  server.listen(PORT, HOST, () => {
    const addresses = [];
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
      }
    }
    console.log("Spaceship Architect campaign and ATB server running");
    console.log(`Campaign storage: ${campaignStore.mode}`);
    console.log(`Local:   http://127.0.0.1:${PORT}`);
    for (const address of addresses) console.log(`Phone:   http://${address}:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Spaceship Architect server could not start:", error);
  process.exitCode = 1;
});
