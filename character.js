import {
  ATTRIBUTE_POINTS,
  BASE_SKILL_POINTS,
  MAX_STARTING_SKILL,
  DICE_NAMES,
  DICE_FACES,
  ATTRIBUTE_COSTS,
  ATTRIBUTE_DEFS,
  SPACECRAFT_SKILLS,
  GENERAL_SKILLS,
  INTELLECT_SKILL_POINT_BONUSES,
  CLASS_DEFS,
  classById,
} from "./character-data.js?v=20260723-character-7";
import { PhysicalDiceRoller } from "./dice-roller.js?v=20260723-character-7";

const STORAGE_KEY = "sa2e-character-library-v1";
const ACTIVE_KEY = "sa2e-active-character-v1";
const RECOVERY_KEY = "sa2e-character-recovery-v1";
const FORMAT_NAME = "spaceship-architect-2e-character";
const FORMAT_VERSION = 3;
const ALL_SKILLS = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
const $ = (selector) => document.querySelector(selector);

const dom = {
  characterPicker: $("#characterPicker"),
  newCharacter: $("#newCharacter"),
  duplicateCharacter: $("#duplicateCharacter"),
  exportCharacter: $("#exportCharacter"),
  importCharacter: $("#importCharacter"),
  deleteCharacter: $("#deleteCharacter"),
  saveStatus: $("#saveStatus"),
  identityCallsign: $("#identityCallsign"),
  classPicker: $("#classPicker"),
  classDetails: $("#classDetails"),
  phaseBadge: $("#phaseBadge"),
  nextRequirement: $("#nextRequirement"),
  workflowDetail: $("#workflowDetail"),
  workflowBar: $(".workflow-bar"),
  finalizeCharacter: $("#finalizeCharacter"),
  spendExperience: $("#spendExperience"),
  attributeBudget: $("#attributeBudget"),
  skillBudget: $("#skillBudget"),
  xpAvailable: $("#xpAvailable"),
  xpSpent: $("#xpSpent"),
  xpTotal: $("#xpTotal"),
  xpGrantAmount: $("#xpGrantAmount"),
  grantXp: $("#grantXp"),
  creatorNotice: $("#creatorNotice"),
  attributeGrid: $("#attributeGrid"),
  spacecraftSkills: $("#spacecraftSkills"),
  generalSkills: $("#generalSkills"),
  customSkills: $("#customSkills"),
  customSkillsEmpty: $("#customSkillsEmpty"),
  addCustomSkill: $("#addCustomSkill"),
  skillSearch: $("#skillSearch"),
  skillLockNotice: $("#skillLockNotice"),
  derivedSpeed: $("#derivedSpeed"),
  derivedCommand: $("#derivedCommand"),
  maximumHp: $("#maximumHp"),
  permanentHpBonus: $("#permanentHpBonus"),
  currentHp: $("#currentHp"),
  restoreHp: $("#restoreHp"),
  exertionCurrent: $("#exertionCurrent"),
  exertionMax: $("#exertionMax"),
  moveSpeedValue: $("#moveSpeedValue"),
  creditsValue: $("#creditsValue"),
  reverenceCurrent: $("#reverenceCurrent"),
  reverenceMeter: $("#reverenceMeter"),
  maxHpBonus: $("#maxHpBonus"),
  crewRoster: $("#crewRoster"),
  addCrewRow: $("#addCrewRow"),
  confirmModal: $("#confirmModal"),
  confirmTitle: $("#confirmTitle"),
  confirmMessage: $("#confirmMessage"),
  confirmCancel: $("#confirmCancel"),
  confirmAccept: $("#confirmAccept"),
  wipeOverlay: $("#wipeOverlay"),
};

const diceRoller = new PhysicalDiceRoller({
  shell: $("#diceRoller"),
  stage: $(".dice-stage"),
  title: $("#diceTitle"),
  subtitle: $("#diceSubtitle"),
  result: $("#diceResult"),
  actions: $("#diceActions"),
  canvasHost: $("#diceCanvas"),
});

let saveTimer = null;
let noticeTimer = null;
let confirmResolver = null;
let migrationDetected = false;

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sa2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  const numeric = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : 0));
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function getPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const finalKey = keys.pop();
  const target = keys.reduce((current, key) => current[key], object);
  target[finalKey] = value;
}

function blankSkill() {
  return { tenths: 0, creationDecimal: null };
}

function blankSkills() {
  return Object.fromEntries(ALL_SKILLS.map((name) => [name, blankSkill()]));
}

function blankCharacter(name = "New Character") {
  return {
    id: uid(),
    version: FORMAT_VERSION,
    phase: "draft",
    advancementOpen: false,
    legacyDraft: false,
    identity: {
      playerName: "",
      characterName: name,
      race: "",
      classId: "",
      className: "No Class",
      homePlanet: "",
      sex: "",
      age: "",
      height: "",
      weight: "",
      hair: "",
      eyes: "",
      description: "",
    },
    experience: { available: 0, spent: 0, totalGained: 0 },
    attributes: Object.fromEntries(ATTRIBUTE_DEFS.map((attribute) => [attribute.key, [0, 0, -1, -1]])),
    skills: blankSkills(),
    customSkills: [],
    creation: {
      skillPurchaseOrder: [],
      finalizationQueue: [],
      classGrantsApplied: false,
    },
    pendingRoll: null,
    health: { current: null, permanentBonus: 0 },
    resources: {
      exertionCurrent: 1,
      exertionMax: 1,
      reverence: 0,
      creditsBase: 0,
      dramaCards: 0,
    },
    crew: Array.from({ length: 3 }, () => ({ name: "", title: "" })),
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function classIdFromName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return CLASS_DEFS.find((entry) => entry.name.toLowerCase() === normalized)?.id || "";
}

function normalizeSkill(raw, legacy = false) {
  if (raw && typeof raw === "object") {
    return {
      tenths: Math.round(clamp(raw.tenths, 0, 9999)),
      creationDecimal: raw.creationDecimal === null || raw.creationDecimal === undefined
        ? null
        : Math.round(clamp(raw.creationDecimal, 0, 9)),
    };
  }
  const numeric = Math.max(0, Number(raw) || 0);
  return {
    tenths: Math.round(numeric * 10),
    creationDecimal: legacy ? null : Math.round((numeric * 10) % 10),
  };
}

function skillKeyForBase(name) {
  return `base:${name}`;
}

function skillKeyForCustom(id) {
  return `custom:${id}`;
}

function resolveSkill(characterObject, key) {
  if (key.startsWith("base:")) {
    const name = key.slice(5);
    return characterObject.skills[name] ? { skill: characterObject.skills[name], name, custom: false } : null;
  }
  if (key.startsWith("custom:")) {
    const id = key.slice(7);
    const entry = characterObject.customSkills.find((skill) => skill.id === id);
    return entry ? { skill: entry, name: entry.name || "Custom Skill", custom: true } : null;
  }
  return null;
}

function rebuildPurchaseOrder(characterObject) {
  const order = [];
  for (const name of ALL_SKILLS) {
    const level = Math.floor(characterObject.skills[name].tenths / 10);
    for (let next = 1; next <= level; next += 1) order.push({ key: skillKeyForBase(name), cost: next });
  }
  for (const custom of characterObject.customSkills) {
    const level = Math.floor(custom.tenths / 10);
    for (let next = 1; next <= level; next += 1) order.push({ key: skillKeyForCustom(custom.id), cost: next });
  }
  return order;
}

function normalizeCharacter(raw) {
  const base = blankCharacter();
  const source = raw && typeof raw === "object" ? raw : {};
  const legacy = (Number(source.version) || 1) < FORMAT_VERSION;
  const identity = { ...base.identity, ...(source.identity || {}) };
  identity.classId = identity.classId || classIdFromName(identity.className);
  identity.className = classById(identity.classId).name;

  const normalized = {
    ...base,
    ...source,
    id: source.id || uid(),
    version: FORMAT_VERSION,
    phase: legacy ? "draft" : ["draft", "finalizing", "finalized"].includes(source.phase) ? source.phase : "draft",
    advancementOpen: legacy ? false : Boolean(source.advancementOpen),
    legacyDraft: legacy || Boolean(source.legacyDraft),
    identity,
    experience: { ...base.experience, ...(source.experience || {}) },
    attributes: { ...base.attributes },
    skills: blankSkills(),
    customSkills: [],
    creation: { ...base.creation, ...(source.creation || {}) },
    pendingRoll: legacy ? null : source.pendingRoll || null,
    health: { ...base.health, ...(source.health || {}) },
    resources: {
      ...base.resources,
      ...(source.resources || {}),
      creditsBase: source.resources?.creditsBase ?? source.resources?.credits ?? 0,
    },
    crew: Array.isArray(source.crew) ? source.crew.slice(0, 24) : base.crew,
  };

  for (const definition of ATTRIBUTE_DEFS) {
    const rows = source.attributes?.[definition.key];
    normalized.attributes[definition.key] = Array.from({ length: 4 }, (_, row) => {
      const fallback = row < 2 ? 0 : -1;
      return Math.round(clamp(Array.isArray(rows) ? rows[row] ?? fallback : fallback, -1, 4));
    });
    normalized.attributes[definition.key][0] = Math.max(0, normalized.attributes[definition.key][0]);
    normalized.attributes[definition.key][1] = Math.max(0, normalized.attributes[definition.key][1]);
  }

  for (const name of ALL_SKILLS) normalized.skills[name] = normalizeSkill(source.skills?.[name], legacy);
  normalized.customSkills = (Array.isArray(source.customSkills) ? source.customSkills : []).slice(0, 24).map((entry) => {
    const value = normalizeSkill(entry, legacy);
    return { id: entry?.id || uid(), name: String(entry?.name || ""), ...value };
  });
  if (legacy) normalized.customSkills = normalized.customSkills.filter((skill) => skill.name.trim() || skill.tenths > 0);

  normalized.creation.skillPurchaseOrder = Array.isArray(source.creation?.skillPurchaseOrder)
    ? source.creation.skillPurchaseOrder.filter((entry) => entry && typeof entry.key === "string").map((entry) => ({ key: entry.key, cost: Math.max(1, Math.round(Number(entry.cost) || 1)) }))
    : rebuildPurchaseOrder(normalized);
  normalized.creation.finalizationQueue = Array.isArray(source.creation?.finalizationQueue)
    ? source.creation.finalizationQueue.filter((key) => typeof key === "string")
    : [];
  normalized.creation.classGrantsApplied = legacy ? false : Boolean(source.creation?.classGrantsApplied);

  while (normalized.crew.length < 3) normalized.crew.push({ name: "", title: "" });
  normalized.crew = normalized.crew.map((member) => ({ name: String(member?.name || ""), title: String(member?.title || "") }));
  normalized.experience.available = Math.round(clamp(normalized.experience.available, 0, 9999999));
  normalized.experience.spent = Math.round(clamp(normalized.experience.spent, 0, 9999999));
  normalized.experience.totalGained = Math.max(
    Math.round(clamp(normalized.experience.totalGained, 0, 9999999)),
    normalized.experience.available + normalized.experience.spent,
  );
  normalized.resources.exertionMax = Math.round(clamp(normalized.resources.exertionMax, 0, 99));
  normalized.resources.exertionCurrent = Math.round(clamp(normalized.resources.exertionCurrent, 0, normalized.resources.exertionMax));
  normalized.resources.reverence = Math.round(clamp(normalized.resources.reverence, 0, 10));
  normalized.resources.creditsBase = Math.round(clamp(normalized.resources.creditsBase, 0, 999999999));
  normalized.resources.dramaCards = Math.round(clamp(normalized.resources.dramaCards, 0, 999));
  normalized.health.permanentBonus = Math.round(clamp(normalized.health.permanentBonus, 0, 9999));
  normalized.health.current = source.health?.current === null || source.health?.current === undefined
    ? null
    : Math.round(clamp(source.health.current, -9999, 999999));
  return normalized;
}

function rawLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLibrary() {
  const raw = rawLibrary();
  migrationDetected = raw.some((entry) => (Number(entry?.version) || 1) < FORMAT_VERSION);
  return raw.map(normalizeCharacter);
}

function loadRecoveries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECOVERY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 2).map((entry) => ({
      id: entry.id || uid(),
      label: String(entry.label || "Recovery Draft"),
      createdAt: entry.createdAt || new Date().toISOString(),
      character: normalizeCharacter(entry.character),
    }));
  } catch {
    return [];
  }
}

let library = loadLibrary();
let recoveries = loadRecoveries();
if (!library.length) library.push(blankCharacter());
let activeId = localStorage.getItem(ACTIVE_KEY) || library[0].id;
if (!library.some((entry) => entry.id === activeId)) activeId = library[0].id;
let character = library.find((entry) => entry.id === activeId) || library[0];

function saveLibrary(message = "Saved locally") {
  character.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  localStorage.setItem(ACTIVE_KEY, activeId);
  dom.saveStatus.textContent = message;
  dom.saveStatus.classList.remove("saving");
}

function queueSave() {
  dom.saveStatus.textContent = "Saving...";
  dom.saveStatus.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLibrary(), 160);
}

function snapshotRecovery(reason) {
  recoveries.unshift({
    id: uid(),
    label: `${reason}: ${character.identity.characterName || "Unnamed Character"}`,
    createdAt: new Date().toISOString(),
    character: deepCopy(character),
  });
  recoveries = recoveries.slice(0, 2);
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries));
}

function notice(message, type = "") {
  dom.creatorNotice.textContent = message;
  dom.creatorNotice.className = `creator-notice ${type}`.trim();
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    dom.creatorNotice.textContent = "";
    dom.creatorNotice.className = "creator-notice";
  }, 4800);
}

function classEffects(characterObject = character) {
  return classById(characterObject.identity.classId).effects || {};
}

function boxesFilled(attributeKey, characterObject = character) {
  return characterObject.attributes[attributeKey].reduce((sum, value) => sum + Math.max(0, value + 1), 0);
}

function attributePointsSpent(characterObject = character) {
  return ATTRIBUTE_DEFS.reduce((total, definition) => total + characterObject.attributes[definition.key].reduce((subtotal, current, row) => {
    if (current < 0) return subtotal;
    return subtotal + ATTRIBUTE_COSTS[row].slice(0, current + 1).reduce((sum, cost) => sum + cost, 0);
  }, 0), 0);
}

function skillPointBudget(characterObject = character) {
  return BASE_SKILL_POINTS + characterObject.attributes.intellect.reduce((sum, dieIndex) => {
    return sum + (dieIndex >= 0 ? INTELLECT_SKILL_POINT_BONUSES[dieIndex] : 0);
  }, 0);
}

function skillCreationLevel(skill) {
  return Math.floor((Number(skill?.tenths) || 0) / 10);
}

function creationSkillCostForLevel(level) {
  return level * (level + 1) / 2;
}

function skillPointsSpent(characterObject = character) {
  let total = ALL_SKILLS.reduce((sum, name) => sum + creationSkillCostForLevel(skillCreationLevel(characterObject.skills[name])), 0);
  total += characterObject.customSkills.reduce((sum, skill) => sum + creationSkillCostForLevel(skillCreationLevel(skill)), 0);
  return total;
}

function skillBonusTenths(name, characterObject = character) {
  return Number(classEffects(characterObject).skillBonuses?.[name]) || 0;
}

function displayedSkillTenths(name, skill, characterObject = character) {
  return Math.round((Number(skill?.tenths) || 0) + skillBonusTenths(name, characterObject));
}

function ratingText(tenths) {
  return (Math.round(Number(tenths) || 0) / 10).toFixed(1);
}

function maximumHp(characterObject = character) {
  const healthDice = characterObject.attributes.health.filter((index) => index >= 0).reduce((sum, index) => sum + DICE_FACES[index], 0);
  return 20 + healthDice + (Number(characterObject.health.permanentBonus) || 0) + (Number(classEffects(characterObject).maxHpBonus) || 0);
}

function calculatedExertionMax(characterObject = character) {
  return 1 + characterObject.attributes.willpower.filter((dieIndex) => dieIndex >= 3).length;
}

function calculatedMoveSpeed(characterObject = character) {
  return 2 + characterObject.attributes.dexterity.filter((dieIndex) => dieIndex >= 3).length;
}

function syncDerivedResources(previousMaxHp = null) {
  const nextExertion = calculatedExertionMax();
  const oldExertion = character.resources.exertionMax;
  if (nextExertion > oldExertion && character.resources.exertionCurrent === oldExertion) character.resources.exertionCurrent = nextExertion;
  character.resources.exertionMax = nextExertion;
  character.resources.exertionCurrent = Math.round(clamp(character.resources.exertionCurrent, 0, nextExertion));

  const nextMaxHp = maximumHp();
  if (character.health.current === null || (previousMaxHp !== null && character.health.current === previousMaxHp)) character.health.current = nextMaxHp;
  character.health.current = Math.round(clamp(character.health.current, -9999, 999999));
}

function derivedValues() {
  const initiative = displayedSkillTenths("Initiative", character.skills.Initiative) / 10;
  const awareness = displayedSkillTenths("Awareness", character.skills.Awareness) / 10;
  return {
    speed: boxesFilled("intellect") + initiative,
    command: boxesFilled("perception") * 10 + awareness * 30,
  };
}

function advancementSkillCost(tenths) {
  const current = Math.max(0, Math.round(tenths));
  if (current === 0) return 1;
  if (current <= 9) return 5;
  return Math.floor(current / 10) * 10;
}

function formatNumber(value, places = 1) {
  const rounded = Number(value.toFixed(places));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(places);
}
function invalidSkillKeys() {
  const invalid = new Set();
  const deficit = Math.max(0, skillPointsSpent() - skillPointBudget());
  let remaining = deficit;
  for (let index = character.creation.skillPurchaseOrder.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const entry = character.creation.skillPurchaseOrder[index];
    invalid.add(entry.key);
    remaining -= Number(entry.cost) || 0;
  }
  for (const custom of character.customSkills) {
    if (custom.tenths > 0 && !custom.name.trim()) invalid.add(skillKeyForCustom(custom.id));
  }
  return invalid;
}

function draftValidation() {
  const attributeSpent = attributePointsSpent();
  const skillSpent = skillPointsSpent();
  const skillBudget = skillPointBudget();
  const invalidSkills = invalidSkillKeys();
  const overCap = [];
  for (const name of ALL_SKILLS) {
    if (skillCreationLevel(character.skills[name]) > MAX_STARTING_SKILL) overCap.push(skillKeyForBase(name));
  }
  for (const custom of character.customSkills) {
    if (skillCreationLevel(custom) > MAX_STARTING_SKILL) overCap.push(skillKeyForCustom(custom.id));
  }
  overCap.forEach((key) => invalidSkills.add(key));

  const issues = [];
  if (attributeSpent !== ATTRIBUTE_POINTS) issues.push(`Attribute allocation is ${attributeSpent - ATTRIBUTE_POINTS > 0 ? `${attributeSpent - ATTRIBUTE_POINTS} over` : `${ATTRIBUTE_POINTS - attributeSpent} short`}.`);
  if (attributeSpent === ATTRIBUTE_POINTS && skillSpent !== skillBudget) issues.push(`Skill allocation is ${skillSpent - skillBudget > 0 ? `${skillSpent - skillBudget} over` : `${skillBudget - skillSpent} short`}.`);
  if (invalidSkills.size) issues.push(`${invalidSkills.size} skill entr${invalidSkills.size === 1 ? "y is" : "ies are"} invalid.`);
  return {
    attributeSpent,
    skillSpent,
    skillBudget,
    invalidSkills,
    attributesComplete: attributeSpent === ATTRIBUTE_POINTS,
    skillsComplete: skillSpent === skillBudget,
    ready: attributeSpent === ATTRIBUTE_POINTS && skillSpent === skillBudget && invalidSkills.size === 0,
    issues,
  };
}

function renderCharacterPicker() {
  const saved = library.map((entry) => `<option value="saved:${entry.id}">${escapeHtml(entry.identity.characterName || "Unnamed Character")}${entry.legacyDraft ? " [Legacy Draft]" : ""}</option>`).join("");
  const recovery = recoveries.map((entry) => {
    const time = new Date(entry.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `<option value="recovery:${entry.id}">${escapeHtml(entry.label)} - ${escapeHtml(time)}</option>`;
  }).join("");
  dom.characterPicker.innerHTML = `<optgroup label="Saved Characters">${saved}</optgroup>${recovery ? `<optgroup label="Recovery Drafts">${recovery}</optgroup>` : ""}`;
  dom.characterPicker.value = `saved:${activeId}`;
}

function renderIdentityTheme() {
  const panel = $(".identity-panel");
  const value = String(character.identity.sex || "").trim().toLowerCase();
  panel.classList.remove("identity-male", "identity-female", "identity-other");
  if (value === "m" || value === "male") panel.classList.add("identity-male");
  else if (value === "f" || value === "female") panel.classList.add("identity-female");
  else if (value) panel.classList.add("identity-other");
}

function renderFields() {
  document.querySelectorAll("[data-field]").forEach((input) => {
    input.value = getPath(character, input.dataset.field) ?? "";
    input.disabled = character.phase !== "draft" && input.dataset.field === "identity.race";
  });
  dom.identityCallsign.textContent = character.identity.characterName || "Unnamed Character";
  renderIdentityTheme();
}

function renderClass() {
  dom.classPicker.innerHTML = CLASS_DEFS.map((definition) => `<option value="${definition.id}">${escapeHtml(definition.name)}</option>`).join("");
  dom.classPicker.value = character.identity.classId;
  dom.classPicker.disabled = character.phase !== "draft";
  const definition = classById(character.identity.classId);
  dom.classDetails.className = `class-details ${definition.pendingAtb ? "pending" : ""}`.trim();
  dom.classDetails.innerHTML = `<strong>${escapeHtml(definition.name)}</strong><p>${escapeHtml(definition.summary)}</p>${definition.manual ? `<small>${escapeHtml(definition.manual)}</small>` : ""}`;
}

function renderWorkflow() {
  const validation = draftValidation();
  dom.phaseBadge.className = `phase-badge ${character.phase}`;
  dom.workflowBar.classList.remove("invalid");
  dom.finalizeCharacter.hidden = character.phase === "finalized";
  dom.spendExperience.hidden = character.phase !== "finalized";

  if (character.phase === "finalizing") {
    const remaining = character.creation.finalizationQueue.length;
    dom.phaseBadge.textContent = "Finalizing";
    dom.nextRequirement.textContent = `Rolling Skill Decimals - ${remaining} remaining`;
    dom.workflowDetail.textContent = "Each completed result is saved immediately.";
    dom.finalizeCharacter.textContent = "Finalizing...";
    dom.finalizeCharacter.disabled = true;
    return;
  }

  if (character.phase === "finalized") {
    dom.phaseBadge.textContent = character.advancementOpen ? "Advancement" : "Finalized";
    dom.phaseBadge.classList.add("finalized");
    dom.nextRequirement.textContent = character.advancementOpen ? `${character.experience.available} XP available to spend` : "Character Finalized";
    dom.workflowDetail.textContent = character.advancementOpen ? "Purchases are permanent. Finish spending when you are done." : "Race, Class, and creation allocations are locked.";
    dom.spendExperience.textContent = character.advancementOpen ? "Finish Spending" : "Spend EXP";
    dom.spendExperience.disabled = Boolean(character.pendingRoll);
    return;
  }

  dom.phaseBadge.textContent = character.legacyDraft ? "Legacy Draft" : "Draft";
  dom.finalizeCharacter.textContent = "Finalize Character";
  dom.finalizeCharacter.disabled = !validation.ready;
  if (!validation.attributesComplete) {
    const difference = ATTRIBUTE_POINTS - validation.attributeSpent;
    dom.nextRequirement.textContent = difference > 0 ? `Spend ${difference} more Attribute Points` : `Refund ${Math.abs(difference)} Attribute Points`;
    dom.workflowDetail.textContent = "Skills unlock after Attribute allocation is exactly 195 points.";
  } else if (!validation.skillsComplete || validation.invalidSkills.size) {
    const difference = validation.skillBudget - validation.skillSpent;
    dom.nextRequirement.textContent = difference > 0 ? `Spend ${difference} more Skill Points` : difference < 0 ? `Refund ${Math.abs(difference)} Skill Points` : `Resolve ${validation.invalidSkills.size} invalid skill ${validation.invalidSkills.size === 1 ? "entry" : "entries"}`;
    dom.workflowDetail.textContent = "Starting skills cannot exceed level 3.0 and every Custom Skill needs a name.";
  } else {
    dom.nextRequirement.textContent = "Ready to Finalize";
    dom.workflowDetail.textContent = "Finalizing permanently locks Race, Class, and starting allocations.";
  }
  if (!validation.ready && (validation.attributeSpent > ATTRIBUTE_POINTS || validation.skillSpent > validation.skillBudget || validation.invalidSkills.size)) dom.workflowBar.classList.add("invalid");
}

function renderExperience() {
  const validation = draftValidation();
  dom.attributeBudget.textContent = `${validation.attributeSpent} / ${ATTRIBUTE_POINTS}`;
  dom.attributeBudget.className = validation.attributeSpent === ATTRIBUTE_POINTS ? "complete" : validation.attributeSpent > ATTRIBUTE_POINTS ? "invalid" : "";
  dom.skillBudget.textContent = validation.attributesComplete ? `${validation.skillSpent} / ${validation.skillBudget}` : "Locked";
  dom.skillBudget.className = validation.attributesComplete && validation.skillSpent === validation.skillBudget ? "complete" : validation.skillSpent > validation.skillBudget ? "invalid" : "";
  dom.xpAvailable.textContent = character.experience.available;
  dom.xpSpent.textContent = character.experience.spent;
  dom.xpTotal.textContent = character.experience.totalGained;
}

function dieSvg(column, cost, purchased) {
  const shapes = [
    `<path class="die-shape" d="M24 5 43 40H5Z" />`,
    `<path class="die-shape" d="m24 4 18 10v20L24 44 6 34V14Z" /><path class="die-detail" d="m6 14 18 10 18-10M24 24v20" />`,
    `<path class="die-shape" d="m24 3 20 20-20 22L4 23Z" /><path class="die-detail" d="M4 23h40M24 3 13 23l11 22 11-22Z" />`,
    `<path class="die-shape" d="m24 3 20 19-20 23L4 22Z" /><path class="die-detail" d="m24 3 8 17-8 25-8-25ZM4 22l12-2h16l12 2" />`,
    `<path class="die-shape" d="m24 3 17 10 2 20-19 12L5 33l2-20Z" /><path class="die-inner" d="m24 7 11 7-4 13H17l-4-13Z" />`,
  ];
  return `<svg viewBox="-4 -4 56 56" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${shapes[column]}${purchased ? "" : `<text class="die-cost" x="24" y="25">${cost}</text><text class="die-xp" x="24" y="33">XP</text>`}</svg>`;
}

function diceSummary(attributeKey) {
  const dice = character.attributes[attributeKey].filter((value) => value >= 0).map((value) => DICE_NAMES[value]);
  return dice.length ? dice.join(" + ") : "No dice";
}

function canPurchaseAttributes() {
  return character.phase === "draft" || (character.phase === "finalized" && character.advancementOpen);
}

function renderAttributes() {
  const validation = draftValidation();
  const advancement = character.phase === "finalized" && character.advancementOpen;
  const interactive = canPurchaseAttributes() && !character.pendingRoll;
  dom.attributeGrid.innerHTML = ATTRIBUTE_DEFS.map((definition) => {
    const rows = character.attributes[definition.key];
    const rowMarkup = rows.map((current, row) => {
      const progress = ((current + 1) / 5) * 100;
      const buttons = DICE_NAMES.map((dieName, column) => {
        const purchased = column <= current;
        const next = column === current + 1;
        const lockedFree = row < 2 && column === 0;
        const cost = ATTRIBUTE_COSTS[row][column];
        const allowedDraft = character.phase === "draft" && (next || column === current) && !lockedFree;
        const allowedAdvancement = advancement && next && character.experience.available >= cost;
        const disabled = !interactive || !(allowedDraft || allowedAdvancement);
        let title = purchased ? `${dieName} purchased` : `Purchase ${dieName} for ${cost}`;
        if (lockedFree) title = `${dieName} is a free starting die`;
        else if (character.phase === "draft" && column === current) title = `Refund ${cost} Attribute Points`;
        else if (advancement && next) title = `Spend ${cost} XP to upgrade to ${dieName}`;
        return `<button class="attribute-die ${purchased ? "purchased" : ""} ${next ? "next" : ""}" type="button" data-attribute="${definition.key}" data-row="${row}" data-column="${column}" title="${escapeAttribute(title)}" ${disabled ? "disabled" : ""}>${dieSvg(column, cost, purchased)}</button>`;
      }).join("");
      const wave = current >= 0 ? `<span class="attribute-purchased-wave" aria-hidden="true"></span>` : "";
      return `<div class="attribute-row" style="--progress:${progress}%">${wave}${buttons}</div>`;
    }).join("");
    return `<article class="attribute-card ${validation.attributeSpent > ATTRIBUTE_POINTS ? "invalid" : ""}" style="--attribute:${definition.color}"><div class="attribute-card-head"><strong>${definition.label}</strong><span>${diceSummary(definition.key)} | ${boxesFilled(definition.key)} boxes</span></div><div class="attribute-rows">${rowMarkup}</div></article>`;
  }).join("");
}

function formatSkillName(name) {
  return escapeHtml(name).replaceAll(" ", "&nbsp;").replaceAll("/", "/<wbr>");
}

function renderSkillRow(name, skill, key) {
  const validation = draftValidation();
  const bonus = skillBonusTenths(name);
  const displayed = displayedSkillTenths(name, skill);
  const level = skillCreationLevel(skill);
  const advancement = character.phase === "finalized" && character.advancementOpen;
  const draftBuying = character.phase === "draft" && validation.attributesComplete;
  const nextCost = advancement ? advancementSkillCost(displayed) : level + 1;
  const canIncrease = !character.pendingRoll && ((draftBuying && level < MAX_STARTING_SKILL && validation.skillSpent + nextCost <= validation.skillBudget) || (advancement && character.experience.available >= nextCost));
  const canDecrease = character.phase === "draft" && level > 0 && !character.pendingRoll;
  const invalid = validation.invalidSkills.has(key);
  const locked = !(draftBuying || advancement);
  return `<div class="skill-row ${["Awareness", "Initiative"].includes(name) ? "key-skill" : ""} ${invalid ? "invalid" : ""} ${locked ? "locked" : ""}" data-search-name="${escapeAttribute(name.toLowerCase())}">
    <span class="skill-name" title="${escapeAttribute(name)}">${formatSkillName(name)}</span>
    <button class="skill-refund" type="button" data-skill-action="decrease" data-skill-key="${escapeAttribute(key)}" aria-label="Decrease ${escapeAttribute(name)}" ${canDecrease ? "" : "disabled"}>-</button>
    <span class="skill-value"><strong>${ratingText(displayed)}</strong><small>${bonus ? `+${ratingText(bonus)} CLASS` : ""}</small></span>
    <button class="skill-buy" type="button" data-skill-action="increase" data-skill-key="${escapeAttribute(key)}" aria-label="Spend ${nextCost} ${advancement ? "XP" : "Skill Points"} to increase ${escapeAttribute(name)}" ${canIncrease ? "" : "disabled"}><strong>${nextCost}</strong><small>${advancement ? "XP" : "SP"}</small></button>
  </div>`;
}

function renderSkills() {
  const validation = draftValidation();
  dom.skillLockNotice.hidden = validation.attributesComplete || character.phase !== "draft";
  dom.spacecraftSkills.innerHTML = SPACECRAFT_SKILLS.map((name) => renderSkillRow(name, character.skills[name], skillKeyForBase(name))).join("");
  dom.generalSkills.innerHTML = GENERAL_SKILLS.map((name) => renderSkillRow(name, character.skills[name], skillKeyForBase(name))).join("");
  dom.customSkills.innerHTML = character.customSkills.map((skill) => {
    const key = skillKeyForCustom(skill.id);
    const row = renderSkillRow(skill.name || "Custom Skill", skill, key);
    return `<div class="custom-skill-row-wrapper">${row.replace("<div class=\"skill-row", `<div class=\"skill-row custom-skill-row ${validation.invalidSkills.has(key) ? "invalid" : ""}`)
      .replace(`<span class="skill-name" title="${escapeAttribute(skill.name || "Custom Skill")}">${formatSkillName(skill.name || "Custom Skill")}</span>`, `<input data-custom-name="${skill.id}" value="${escapeAttribute(skill.name)}" placeholder="Custom Skill" aria-label="Custom skill name" ${character.phase === "draft" ? "" : "disabled"} />`)
      .replace("</div>", `<button class="row-remove" type="button" data-remove-custom-skill="${skill.id}" aria-label="Remove custom skill" ${character.phase === "draft" ? "" : "disabled"}>-</button></div>`)}</div>`;
  }).join("");
  dom.customSkillsEmpty.hidden = character.customSkills.length > 0;
  dom.addCustomSkill.disabled = character.phase !== "draft" || !validation.attributesComplete;
  applySkillSearch();
}

function renderResources() {
  syncDerivedResources();
  dom.exertionCurrent.textContent = character.resources.exertionCurrent;
  dom.exertionMax.textContent = character.resources.exertionMax;
  dom.moveSpeedValue.textContent = calculatedMoveSpeed();
  dom.creditsValue.textContent = (character.resources.creditsBase + (Number(classEffects().creditsBonus) || 0)).toLocaleString();
  dom.reverenceCurrent.textContent = character.resources.reverence;
  dom.reverenceMeter.innerHTML = Array.from({ length: 10 }, (_, index) => `<span class="reverence-slot ${index < character.resources.reverence ? "filled" : ""}" aria-hidden="true"></span>`).join("");
  dom.maxHpBonus.disabled = character.phase !== "finalized" || character.resources.reverence < 6 || Boolean(character.pendingRoll);
}

function renderDerived() {
  const derived = derivedValues();
  dom.derivedSpeed.textContent = formatNumber(derived.speed);
  dom.derivedCommand.textContent = `${formatNumber(derived.command)} sec`;
  dom.maximumHp.textContent = maximumHp();
  dom.permanentHpBonus.textContent = character.health.permanentBonus;
  dom.currentHp.value = character.health.current;
  dom.currentHp.classList.toggle("invalid", character.health.current < 1);
}

function renderCrew() {
  const atMinimum = character.crew.length <= 3;
  dom.crewRoster.innerHTML = character.crew.map((member, index) => `<div class="crew-row"><input data-crew-index="${index}" data-crew-field="name" value="${escapeAttribute(member.name)}" placeholder="Crewmember" aria-label="Crewmember ${index + 1} name" /><input data-crew-index="${index}" data-crew-field="title" value="${escapeAttribute(member.title)}" placeholder="Title / Station" aria-label="Crewmember ${index + 1} title" /><button class="row-remove" type="button" data-remove-crew="${index}" ${atMinimum ? "disabled" : ""} aria-label="Remove crew row ${index + 1}">-</button></div>`).join("");
}

function renderAll() {
  renderCharacterPicker();
  renderFields();
  renderClass();
  renderWorkflow();
  renderExperience();
  renderAttributes();
  renderSkills();
  renderResources();
  renderDerived();
  renderCrew();
}

function applySkillSearch() {
  const query = dom.skillSearch.value.trim().toLowerCase();
  document.querySelectorAll(".skill-row[data-search-name]").forEach((row) => {
    row.classList.toggle("hidden-by-search", Boolean(query) && !row.dataset.searchName.includes(query));
  });
}
function spendXp(cost, description) {
  if (character.experience.available < cost) {
    notice(`You need ${cost} XP for ${description}. ${character.experience.available} XP is available.`, "error");
    return false;
  }
  character.experience.available -= cost;
  character.experience.spent += cost;
  return true;
}

function purchaseAttribute(attributeKey, row, column) {
  if (!canPurchaseAttributes() || character.pendingRoll) return;
  const current = character.attributes[attributeKey][row];
  const definition = ATTRIBUTE_DEFS.find((entry) => entry.key === attributeKey);
  if (!definition) return;
  const previousMaxHp = maximumHp();

  if (character.phase === "draft") {
    if (column === current + 1) {
      const cost = ATTRIBUTE_COSTS[row][column];
      if (attributePointsSpent() + cost > ATTRIBUTE_POINTS) {
        notice(`That purchase would exceed the ${ATTRIBUTE_POINTS}-point Attribute budget.`, "error");
        return;
      }
      character.attributes[attributeKey][row] = column;
      notice(`${definition.label} upgraded to ${DICE_NAMES[column]} for ${cost} Attribute Points.`, "success");
    } else if (column === current) {
      if (row < 2 && column === 0) return;
      const refund = ATTRIBUTE_COSTS[row][column];
      character.attributes[attributeKey][row] = current - 1;
      notice(`${refund} Attribute Points refunded.`, "success");
    } else {
      return;
    }
  } else if (character.phase === "finalized" && character.advancementOpen && column === current + 1) {
    const cost = ATTRIBUTE_COSTS[row][column];
    if (!spendXp(cost, `${definition.label} ${DICE_NAMES[column]}`)) return;
    character.attributes[attributeKey][row] = column;
    notice(`${definition.label} upgraded to ${DICE_NAMES[column]} for ${cost} XP.`, "success");
  } else {
    return;
  }
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
}

function removeLastPurchaseEntry(key) {
  for (let index = character.creation.skillPurchaseOrder.length - 1; index >= 0; index -= 1) {
    if (character.creation.skillPurchaseOrder[index].key === key) {
      character.creation.skillPurchaseOrder.splice(index, 1);
      return;
    }
  }
}

function changeDraftSkill(key, direction) {
  if (character.phase !== "draft" || character.pendingRoll) return;
  const validation = draftValidation();
  if (!validation.attributesComplete) {
    notice("Spend all 195 Attribute Points before purchasing Skills.", "error");
    return;
  }
  const resolved = resolveSkill(character, key);
  if (!resolved) return;
  const currentLevel = skillCreationLevel(resolved.skill);
  if (direction > 0) {
    if (currentLevel >= MAX_STARTING_SKILL) {
      notice("Starting skills cannot exceed level 3.0.", "error");
      return;
    }
    const cost = currentLevel + 1;
    if (validation.skillSpent + cost > validation.skillBudget) {
      notice(`You need ${cost} Skill Points. Only ${validation.skillBudget - validation.skillSpent} remain.`, "error");
      return;
    }
    resolved.skill.tenths = (currentLevel + 1) * 10;
    resolved.skill.creationDecimal = null;
    character.creation.skillPurchaseOrder.push({ key, cost });
    notice(`${resolved.name} increased to ${currentLevel + 1}.0 for ${cost} Skill Point${cost === 1 ? "" : "s"}.`, "success");
  } else if (currentLevel > 0) {
    resolved.skill.tenths = (currentLevel - 1) * 10;
    resolved.skill.creationDecimal = null;
    removeLastPurchaseEntry(key);
    notice(`${currentLevel} Skill Point${currentLevel === 1 ? "" : "s"} refunded.`, "success");
  }
  queueSave();
  renderAll();
}

function skillKeysForFinalization() {
  const keys = [];
  for (const name of ALL_SKILLS) {
    const skill = character.skills[name];
    if (skillCreationLevel(skill) > 0 && skill.creationDecimal === null) keys.push(skillKeyForBase(name));
  }
  for (const skill of character.customSkills) {
    if (skillCreationLevel(skill) > 0 && skill.creationDecimal === null) keys.push(skillKeyForCustom(skill.id));
  }
  return keys;
}

function askConfirmation({ title, message, acceptLabel, cancelLabel = "Cancel", danger = false }) {
  if (confirmResolver) confirmResolver(false);
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmAccept.textContent = acceptLabel;
  dom.confirmCancel.textContent = cancelLabel;
  dom.confirmAccept.classList.toggle("danger", danger);
  dom.confirmModal.hidden = false;
  dom.confirmCancel.focus();
  return new Promise((resolve) => {
    confirmResolver = resolve;
    dom.confirmCancel.onclick = () => closeConfirmation(false);
    dom.confirmAccept.onclick = () => closeConfirmation(true);
  });
}

function closeConfirmation(result) {
  dom.confirmModal.hidden = true;
  const resolver = confirmResolver;
  confirmResolver = null;
  resolver?.(result);
}

function playWipe(switchCharacter) {
  dom.wipeOverlay.hidden = false;
  void dom.wipeOverlay.offsetWidth;
  return new Promise((resolve) => {
    window.setTimeout(() => {
      switchCharacter();
      renderAll();
    }, 330);
    window.setTimeout(() => {
      dom.wipeOverlay.hidden = true;
      resolve();
    }, 790);
  });
}

async function beginNewCharacter() {
  const accepted = await askConfirmation({
    title: "Start a new character?",
    message: "The current character is saved, and a Recovery Draft will be created before the sheet is cleared.",
    acceptLabel: "Start Over",
    cancelLabel: "Keep Current Character",
    danger: true,
  });
  if (!accepted) return;
  saveLibrary();
  snapshotRecovery("Before New Character");
  await playWipe(() => {
    const next = blankCharacter(`New Character ${library.length + 1}`);
    library.push(next);
    activeId = next.id;
    character = next;
    dom.skillSearch.value = "";
    saveLibrary("New character saved locally");
  });
  notice("Fresh Character Draft created. The previous character remains saved.", "success");
}

async function beginFinalization() {
  const validation = draftValidation();
  if (!validation.ready || character.phase !== "draft") {
    notice(validation.issues[0] || "Resolve the remaining creation requirements first.", "error");
    return;
  }
  const accepted = await askConfirmation({
    title: "Finalize this character?",
    message: "Race, Class, Attribute allocation, and starting Skill levels will become permanent. Skill decimals will now be rolled in sheet order.",
    acceptLabel: "Begin Finalization",
    cancelLabel: "Continue Editing",
  });
  if (!accepted) return;
  saveLibrary();
  snapshotRecovery("Before Finalization");
  character.phase = "finalizing";
  character.advancementOpen = false;
  character.creation.finalizationQueue = skillKeysForFinalization();
  character.pendingRoll = null;
  saveLibrary("Finalization started");
  renderAll();
  processFinalization();
}

function finishFinalization() {
  if (!character.creation.classGrantsApplied) {
    const effects = classEffects();
    const bonusXp = Number(effects.xpOnFinalize) || 0;
    if (bonusXp) {
      character.experience.available += bonusXp;
      character.experience.totalGained += bonusXp;
    }
    if (effects.reverenceOnFinalize) character.resources.reverence = Math.max(character.resources.reverence, Math.min(10, effects.reverenceOnFinalize));
    if (effects.dramaCardsOnFinalize) character.resources.dramaCards += effects.dramaCardsOnFinalize;
    character.creation.classGrantsApplied = true;
  }
  character.phase = "finalized";
  character.advancementOpen = false;
  character.legacyDraft = false;
  character.pendingRoll = null;
  character.creation.finalizationQueue = [];
  character.health.current = maximumHp();
  saveLibrary("Character finalized");
  renderAll();
  notice("Character finalized. Advancement rules are now active.", "success");
}

function processFinalization() {
  if (character.phase !== "finalizing" || diceRoller.isActive()) return;
  if (character.pendingRoll) {
    rollPending();
    return;
  }
  while (character.creation.finalizationQueue.length) {
    const key = character.creation.finalizationQueue[0];
    if (resolveSkill(character, key)) {
      character.pendingRoll = { kind: "creation-d10", skillKey: key, result: null, config: null };
      saveLibrary("Finalization roll prepared");
      renderWorkflow();
      rollPending();
      return;
    }
    character.creation.finalizationQueue.shift();
  }
  finishFinalization();
}

function startSkillAdvancement(key) {
  if (character.phase !== "finalized" || !character.advancementOpen || character.pendingRoll) return;
  const resolved = resolveSkill(character, key);
  if (!resolved) return;
  const displayed = displayedSkillTenths(resolved.name, resolved.skill);
  const cost = advancementSkillCost(displayed);
  if (!spendXp(cost, `${resolved.name} advancement`)) return;
  character.pendingRoll = {
    kind: "advancement-d6",
    skillKey: key,
    baseCost: cost,
    preRatingTenths: displayed,
    paidRerollUsed: false,
    result: null,
    config: null,
  };
  saveLibrary("Skill advancement roll prepared");
  renderAll();
  rollPending();
}

function pendingRollTitle(pending) {
  const resolved = resolveSkill(character, pending.skillKey);
  return resolved?.name || "Skill";
}

function rollPending() {
  const pending = character.pendingRoll;
  if (!pending || diceRoller.isActive()) return;
  const resolved = resolveSkill(character, pending.skillKey);
  if (!resolved) {
    character.pendingRoll = null;
    saveLibrary();
    renderAll();
    return;
  }
  if (pending.result !== null && pending.result !== undefined) {
    showPersistedPendingResult();
    return;
  }
  const creation = pending.kind === "creation-d10";
  const remaining = character.creation.finalizationQueue.length;
  diceRoller.roll({
    sides: creation ? 10 : 6,
    title: resolved.name,
    subtitle: creation ? `Finalization decimal roll - ${remaining} skill${remaining === 1 ? "" : "s"} remaining` : `Advancing from ${ratingText(pending.preRatingTenths)} - ${pending.baseCost} XP spent`,
    config: pending.config,
    onConfig: (config) => {
      character.pendingRoll.config = config;
      saveLibrary("Physical roll in progress");
    },
    onSettled: (result) => handleSettledRoll(result),
  }).catch(() => {
    notice("The 3D dice tray could not start. Reload the page to resume this saved roll.", "error");
  });
}

function handleSettledRoll(result) {
  const pending = character.pendingRoll;
  if (!pending) return;
  pending.result = result;
  saveLibrary("Roll result saved");
  if (pending.kind === "creation-d10") {
    const resolved = resolveSkill(character, pending.skillKey);
    if (!resolved) return;
    const decimal = result === 10 ? 0 : result;
    resolved.skill.tenths = skillCreationLevel(resolved.skill) * 10 + decimal;
    resolved.skill.creationDecimal = decimal;
    character.creation.finalizationQueue = character.creation.finalizationQueue.filter((key, index) => !(index === 0 && key === pending.skillKey));
    character.pendingRoll = null;
    saveLibrary("Skill decimal finalized");
    renderAll();
    diceRoller.celebrate(1000).then(processFinalization);
    return;
  }
  presentAdvancementDecision();
}

function presentAdvancementDecision() {
  const pending = character.pendingRoll;
  if (!pending || pending.kind !== "advancement-d6" || pending.result === null) return;
  const freeReroll = pending.preRatingTenths <= 9 && pending.result === 1;
  const rerollCost = Math.round(pending.baseCost / 5);
  const paidReroll = pending.preRatingTenths >= 10 && !pending.paidRerollUsed && character.experience.available >= rerollCost;
  if (!freeReroll && !paidReroll) {
    acceptAdvancementResult();
    return;
  }
  diceRoller.showChoices([
    { label: "Keep", action: () => acceptAdvancementResult() },
    { label: freeReroll ? "Reroll Free" : `Reroll - ${rerollCost} XP`, className: "primary-action", action: () => rerollAdvancement(freeReroll ? 0 : rerollCost) },
  ]);
}

function rerollAdvancement(cost) {
  const pending = character.pendingRoll;
  if (!pending) return;
  if (cost > 0) {
    if (!spendXp(cost, "skill reroll")) return;
    pending.paidRerollUsed = true;
  }
  pending.result = null;
  pending.config = null;
  saveLibrary("Reroll prepared");
  renderAll();
  diceRoller.reroll({
    sides: 6,
    title: pendingRollTitle(pending),
    subtitle: cost ? `${cost} XP reroll spent - this result is final` : "Free reroll of a 1",
    config: null,
    onConfig: (config) => {
      character.pendingRoll.config = config;
      saveLibrary("Physical reroll in progress");
    },
    onSettled: (result) => handleSettledRoll(result),
  });
}

function acceptAdvancementResult() {
  const pending = character.pendingRoll;
  if (!pending || pending.result === null) return;
  const resolved = resolveSkill(character, pending.skillKey);
  if (!resolved) return;
  const result = pending.result;
  resolved.skill.tenths += result;
  character.pendingRoll = null;
  saveLibrary("Skill advancement applied");
  renderAll();
  notice(`${resolved.name} increased by +0.${result}.`, "success");
  diceRoller.celebrate(3500);
}

function showPersistedPendingResult() {
  const pending = character.pendingRoll;
  if (!pending) return;
  const displayedResult = pending.kind === "creation-d10" && pending.result === 10 ? 0 : pending.result;
  diceRoller.showPersistedResult({
    title: pendingRollTitle(pending),
    subtitle: "Recovered saved roll result",
    result: displayedResult,
  });
  if (pending.kind === "advancement-d6") presentAdvancementDecision();
}

function filenameForCharacter() {
  const raw = character.identity.characterName || "spaceship-architect-character";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "spaceship-architect-character";
}

function exportCurrentCharacter() {
  saveLibrary();
  const payload = { format: FORMAT_NAME, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), character };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenameForCharacter()}.sa2character`;
  anchor.click();
  URL.revokeObjectURL(url);
  notice("Character exported. Import the file on another device to continue.", "success");
}
document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (field) {
    if (field.disabled) return;
    setPath(character, field.dataset.field, field.value);
    if (field.dataset.field === "identity.characterName") {
      dom.identityCallsign.textContent = field.value || "Unnamed Character";
      renderCharacterPicker();
    }
    if (field.dataset.field === "identity.sex") renderIdentityTheme();
    queueSave();
    return;
  }

  const customName = event.target.closest("[data-custom-name]");
  if (customName && character.phase === "draft") {
    const custom = character.customSkills.find((skill) => skill.id === customName.dataset.customName);
    if (custom) custom.name = customName.value;
    queueSave();
    renderWorkflow();
    return;
  }

  const crewInput = event.target.closest("[data-crew-index]");
  if (crewInput) {
    const member = character.crew[Number(crewInput.dataset.crewIndex)];
    if (member) member[crewInput.dataset.crewField] = crewInput.value;
    queueSave();
    return;
  }

  if (event.target === dom.currentHp) {
    character.health.current = Math.round(clamp(event.target.value, -9999, 999999));
    queueSave();
    renderDerived();
  }
});

document.addEventListener("click", (event) => {
  const attributeButton = event.target.closest("[data-attribute]");
  if (attributeButton) {
    purchaseAttribute(attributeButton.dataset.attribute, Number(attributeButton.dataset.row), Number(attributeButton.dataset.column));
    return;
  }

  const skillButton = event.target.closest("[data-skill-action]");
  if (skillButton) {
    const key = skillButton.dataset.skillKey;
    if (skillButton.dataset.skillAction === "decrease") changeDraftSkill(key, -1);
    else if (character.phase === "draft") changeDraftSkill(key, 1);
    else startSkillAdvancement(key);
    return;
  }

  const removeCustom = event.target.closest("[data-remove-custom-skill]");
  if (removeCustom && character.phase === "draft") {
    const id = removeCustom.dataset.removeCustomSkill;
    const custom = character.customSkills.find((skill) => skill.id === id);
    if (!custom) return;
    if (custom.tenths > 0) {
      notice("Refund this Custom Skill to 0.0 before removing it.", "error");
      return;
    }
    character.customSkills = character.customSkills.filter((skill) => skill.id !== id);
    character.creation.skillPurchaseOrder = character.creation.skillPurchaseOrder.filter((entry) => entry.key !== skillKeyForCustom(id));
    queueSave();
    renderAll();
    return;
  }

  const removeCrew = event.target.closest("[data-remove-crew]");
  if (removeCrew) {
    if (character.crew.length <= 3) return;
    character.crew.splice(Number(removeCrew.dataset.removeCrew), 1);
    queueSave();
    renderCrew();
    return;
  }

  const resourceButton = event.target.closest("[data-resource]");
  if (resourceButton?.dataset.resource === "exertion") {
    character.resources.exertionCurrent = Math.round(clamp(character.resources.exertionCurrent + Number(resourceButton.dataset.change), 0, character.resources.exertionMax));
    queueSave();
    renderResources();
    return;
  }

  const hpButton = event.target.closest("[data-hp-change]");
  if (hpButton) {
    character.health.current = Math.round(clamp(character.health.current + Number(hpButton.dataset.hpChange), -9999, 999999));
    queueSave();
    renderDerived();
  }
});

dom.classPicker.addEventListener("change", () => {
  if (character.phase !== "draft") return;
  const previousMaxHp = maximumHp();
  character.identity.classId = dom.classPicker.value;
  character.identity.className = classById(dom.classPicker.value).name;
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  notice(`${character.identity.className} selected. Class effects recalculated.`, "success");
});

dom.characterPicker.addEventListener("change", () => {
  saveLibrary();
  const [kind, id] = dom.characterPicker.value.split(":");
  if (kind === "recovery") {
    const recovery = recoveries.find((entry) => entry.id === id);
    if (!recovery) return;
    const restored = normalizeCharacter(deepCopy(recovery.character));
    restored.id = uid();
    restored.identity.characterName = `${restored.identity.characterName || "Character"} (Recovered)`;
    restored.phase = restored.phase === "finalizing" ? "draft" : restored.phase;
    restored.pendingRoll = null;
    restored.creation.finalizationQueue = [];
    library.push(restored);
    activeId = restored.id;
    character = restored;
    saveLibrary("Recovery Draft restored as a new character");
    notice("Recovery Draft restored without changing the protected snapshot.", "success");
  } else {
    activeId = id;
    character = library.find((entry) => entry.id === activeId) || library[0];
    localStorage.setItem(ACTIVE_KEY, activeId);
  }
  dom.skillSearch.value = "";
  renderAll();
  if (character.phase === "finalizing" || character.pendingRoll) window.setTimeout(() => processFinalization() || rollPending(), 100);
});

dom.newCharacter.addEventListener("click", beginNewCharacter);

dom.duplicateCharacter.addEventListener("click", () => {
  if (character.phase === "finalizing" || character.pendingRoll) {
    notice("Finish the active roll before duplicating this character.", "error");
    return;
  }
  const duplicate = normalizeCharacter(deepCopy(character));
  duplicate.id = uid();
  duplicate.identity.characterName = `${character.identity.characterName || "Character"} Copy`;
  duplicate.updatedAt = new Date().toISOString();
  library.push(duplicate);
  activeId = duplicate.id;
  character = duplicate;
  saveLibrary("Duplicate saved locally");
  renderAll();
});

dom.deleteCharacter.addEventListener("click", async () => {
  const accepted = await askConfirmation({
    title: `Delete ${character.identity.characterName || "this character"}?`,
    message: "A Recovery Draft will be created first, but exporting important characters is still recommended.",
    acceptLabel: "Delete Character",
    cancelLabel: "Keep Character",
    danger: true,
  });
  if (!accepted) return;
  snapshotRecovery("Before Delete");
  library = library.filter((entry) => entry.id !== activeId);
  if (!library.length) library.push(blankCharacter());
  activeId = library[0].id;
  character = library[0];
  saveLibrary("Character deleted");
  dom.skillSearch.value = "";
  renderAll();
});

dom.grantXp.addEventListener("click", () => {
  const amount = Math.floor(Number(dom.xpGrantAmount.value) || 0);
  if (amount <= 0) {
    notice("Enter a positive debug XP award.", "error");
    return;
  }
  character.experience.available += amount;
  character.experience.totalGained += amount;
  queueSave();
  renderAll();
  notice(`DEBUG: ${amount} XP added.`, "success");
});

dom.finalizeCharacter.addEventListener("click", beginFinalization);

dom.spendExperience.addEventListener("click", () => {
  if (character.phase !== "finalized" || character.pendingRoll) return;
  character.advancementOpen = !character.advancementOpen;
  queueSave();
  renderAll();
  notice(character.advancementOpen ? "Advancement purchasing opened." : "Advancement purchasing closed.", "success");
});

dom.addCustomSkill.addEventListener("click", () => {
  if (character.phase !== "draft" || !draftValidation().attributesComplete) return;
  const custom = { id: uid(), name: "", tenths: 0, creationDecimal: null };
  character.customSkills.push(custom);
  queueSave();
  renderSkills();
  dom.customSkills.querySelector(`input[data-custom-name="${custom.id}"]`)?.focus();
});

dom.addCrewRow.addEventListener("click", () => {
  character.crew.push({ name: "", title: "" });
  queueSave();
  renderCrew();
  dom.crewRoster.querySelector(".crew-row:last-child input")?.focus();
});

dom.maxHpBonus.addEventListener("click", () => {
  if (character.phase !== "finalized" || character.resources.reverence < 6) return;
  const previousMaxHp = maximumHp();
  character.resources.reverence -= 6;
  character.health.permanentBonus += 2;
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  notice("6 Reverence spent. Maximum HP permanently increased by +2.", "success");
});

dom.restoreHp.addEventListener("click", () => {
  character.health.current = maximumHp();
  queueSave();
  renderDerived();
});

dom.exportCharacter.addEventListener("click", exportCurrentCharacter);

dom.importCharacter.addEventListener("change", async () => {
  const file = dom.importCharacter.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const importedSource = parsed?.format === FORMAT_NAME ? parsed.character : parsed.character || parsed;
    if (!importedSource?.identity || !importedSource?.attributes) throw new Error("Missing character data");
    const imported = normalizeCharacter(importedSource);
    imported.id = uid();
    if (library.some((entry) => entry.identity.characterName === imported.identity.characterName)) imported.identity.characterName += " (Imported)";
    library.push(imported);
    activeId = imported.id;
    character = imported;
    saveLibrary("Imported character saved locally");
    dom.skillSearch.value = "";
    renderAll();
    notice("Character imported successfully.", "success");
  } catch {
    notice("That file is not a valid Spaceship Architect character export.", "error");
  } finally {
    dom.importCharacter.value = "";
  }
});

dom.skillSearch.addEventListener("input", applySkillSearch);
window.addEventListener("beforeunload", () => saveLibrary());

if (migrationDetected) {
  library = [blankCharacter()];
  recoveries = [];
  activeId = library[0].id;
  character = library[0];
  localStorage.removeItem(RECOVERY_KEY);
}

renderAll();
saveLibrary(migrationDetected ? "Old prototype characters cleared" : "Saved locally");
if (character.phase === "finalizing") window.setTimeout(processFinalization, 120);
else if (character.pendingRoll) window.setTimeout(rollPending, 120);