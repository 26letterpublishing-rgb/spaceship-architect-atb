const STORAGE_KEY = "sa2e-character-library-v1";
const ACTIVE_KEY = "sa2e-active-character-v1";
const FORMAT_NAME = "spaceship-architect-2e-character";
const FORMAT_VERSION = 2;
const diceNames = ["D4", "D6", "D8", "D10", "D12"];
const attributeCosts = [
  [0, 15, 30, 60, 120],
  [0, 15, 30, 60, 120],
  [15, 30, 60, 120, 240],
  [15, 30, 60, 120, 240],
];
const attributeDefs = [
  { key: "strength", label: "Strength", color: "#ff5b58" },
  { key: "health", label: "Health", color: "#39e58f" },
  { key: "perception", label: "Perception", color: "#ffd05a" },
  { key: "dexterity", label: "Dexterity", color: "#35c9ff" },
  { key: "luck", label: "Luck", color: "#a86cff" },
  { key: "charisma", label: "Charisma", color: "#ff68b8" },
  { key: "intellect", label: "Intellect", color: "#4f83ff" },
  { key: "willpower", label: "Willpower", color: "#ff984d" },
];
const spacecraftSkillNames = [
  "Computer Systems",
  "Engineering",
  "Hacking",
  "Pilot/Helm",
  "Sensor Systems",
  "Weapon Systems",
];
const generalSkillNames = [
  "Acting/Lie",
  "Anatomy/First Aid",
  "Architecture",
  "Art/Music",
  "Astronomy",
  "Athletics/Endurance",
  "Awareness",
  "Break Free/Escape",
  "Caretaking/Nurture",
  "Catch/Throw",
  "Climb",
  "Common Knowledge",
  "Cooking",
  "Demolitions",
  "Disguise/Mimic",
  "Dodge/Block",
  "Drive/Small Vehicle",
  "Fashion/Etiquette",
  "Forgotten Languages",
  "Gambling",
  "History/Lore",
  "Identify Taste/Smell",
  "Initiative",
  "Intimidate/Taunt",
  "Intuition/Empathy",
  "Jump",
  "Law/Politics",
  "Leadership",
  "Lift/Push/Pull",
  "Lock-picking",
  "Mathematics",
  "Melee",
  "Navigate",
  "Negotiation/Persuade",
  "Occult",
  "Pickpocket",
  "Projectile",
  "Psychology",
  "Religion",
  "Research",
  "Resist Distress",
  "Science/Physics",
  "Self-Control",
  "Showmanship",
  "Stealth/Hide",
  "Survival/Tracking",
  "Swim",
  "Tame Animal",
  "Teaching",
  "Technology",
  "Vehicle Mechanics",
  "Weapon Mechanics",
  "Wrestle/Disarm",
  "Writing",
];
const damageDefs = [
  { key: "guard", label: "Guard", color: "#35d9ff", pointClass: "guard" },
  { key: "shell", label: "Shell", color: "#ff984d", pointClass: "shell" },
  { key: "stability", label: "Stability", color: "#39e58f", pointClass: "stability" },
  { key: "core", label: "Core", color: "#ff526d", pointClass: "core" },
];

const characterPicker = document.querySelector("#characterPicker");
const newCharacterButton = document.querySelector("#newCharacter");
const duplicateCharacterButton = document.querySelector("#duplicateCharacter");
const exportCharacterButton = document.querySelector("#exportCharacter");
const importCharacterInput = document.querySelector("#importCharacter");
const deleteCharacterButton = document.querySelector("#deleteCharacter");
const saveStatus = document.querySelector("#saveStatus");
const identityCallsign = document.querySelector("#identityCallsign");
const xpAvailable = document.querySelector("#xpAvailable");
const xpSpent = document.querySelector("#xpSpent");
const xpTotal = document.querySelector("#xpTotal");
const xpGrantAmount = document.querySelector("#xpGrantAmount");
const grantXpButton = document.querySelector("#grantXp");
const creatorNotice = document.querySelector("#creatorNotice");
const attributeGrid = document.querySelector("#attributeGrid");
const spacecraftSkills = document.querySelector("#spacecraftSkills");
const generalSkills = document.querySelector("#generalSkills");
const customSkills = document.querySelector("#customSkills");
const skillSearch = document.querySelector("#skillSearch");
const damageLayers = document.querySelector("#damageLayers");
const derivedSpeed = document.querySelector("#derivedSpeed");
const derivedCommand = document.querySelector("#derivedCommand");
const derivedStability = document.querySelector("#derivedStability");
const derivedCore = document.querySelector("#derivedCore");
const derivedCorePenalty = document.querySelector("#derivedCorePenalty");
const exertionCurrent = document.querySelector("#exertionCurrent");
const exertionMax = document.querySelector("#exertionMax");
const reverenceCurrent = document.querySelector("#reverenceCurrent");
const moveSpeedValue = document.querySelector("#moveSpeedValue");
const crewRoster = document.querySelector("#crewRoster");
const addCrewRowButton = document.querySelector("#addCrewRow");
const addCustomSkillButton = document.querySelector("#addCustomSkill");
const customSkillsEmpty = document.querySelector("#customSkillsEmpty");

let library = loadLibrary();
let activeId = localStorage.getItem(ACTIVE_KEY) || "";
let saveTimer = null;
let noticeTimer = null;

if (!library.length) library.push(blankCharacter());
if (!library.some((entry) => entry.id === activeId)) activeId = library[0].id;
let character = activeCharacter();

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sa2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function blankSkills() {
  return Object.fromEntries([...spacecraftSkillNames, ...generalSkillNames].map((name) => [name, 0]));
}

function blankCharacter(name = "New Character") {
  return {
    id: uid(),
    version: FORMAT_VERSION,
    identity: {
      playerName: "",
      characterName: name,
      race: "",
      className: "",
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
    attributes: Object.fromEntries(attributeDefs.map((attribute) => [attribute.key, [0, 0, -1, -1]])),
    skills: blankSkills(),
    customSkills: [],
    damage: {
      guard: { max: 0, current: 0, threshold: 0 },
      shell: { max: 0, current: 0, threshold: 0 },
      stability: { max: 10, current: 10 },
      core: { max: 10, current: 10 },
    },
    resources: { exertionCurrent: 1, exertionMax: 1, reverence: 0, moveSpeed: 2, credits: 0 },
    crew: Array.from({ length: 3 }, () => ({ name: "", title: "" })),
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCharacter(raw) {
  const base = blankCharacter();
  const source = raw && typeof raw === "object" ? raw : {};
  const normalized = {
    ...base,
    ...source,
    id: source.id || uid(),
    identity: { ...base.identity, ...(source.identity || {}) },
    experience: { ...base.experience, ...(source.experience || {}) },
    attributes: { ...base.attributes },
    skills: { ...base.skills, ...(source.skills || {}) },
    customSkills: Array.isArray(source.customSkills) ? source.customSkills.slice(0, 24) : base.customSkills,
    damage: {
      guard: { ...base.damage.guard, ...(source.damage?.guard || {}) },
      shell: { ...base.damage.shell, ...(source.damage?.shell || {}) },
      stability: { ...base.damage.stability, ...(source.damage?.stability || {}) },
      core: { ...base.damage.core, ...(source.damage?.core || {}) },
    },
    resources: { ...base.resources, ...(source.resources || {}) },
    crew: Array.isArray(source.crew) ? source.crew.slice(0, 24) : base.crew,
  };

  for (const definition of attributeDefs) {
    const rows = source.attributes?.[definition.key];
    normalized.attributes[definition.key] = Array.from({ length: 4 }, (_, row) => {
      const fallback = row < 2 ? 0 : -1;
      return clamp(Array.isArray(rows) ? rows[row] ?? fallback : fallback, -1, 4);
    });
    normalized.attributes[definition.key][0] = Math.max(0, normalized.attributes[definition.key][0]);
    normalized.attributes[definition.key][1] = Math.max(0, normalized.attributes[definition.key][1]);
  }

  normalized.customSkills = normalized.customSkills.map((skill) => ({ name: String(skill?.name || ""), level: clamp(skill?.level, 0, 99) }));
  if ((Number(source.version) || 1) < 2) {
    normalized.customSkills = normalized.customSkills.filter((skill) => skill.name.trim() || skill.level > 0);
    const lastUsedCrew = normalized.crew.reduce((last, member, index) => member?.name || member?.title ? index : last, -1);
    normalized.crew = normalized.crew.slice(0, Math.max(3, lastUsedCrew + 1));
  }
  while (normalized.crew.length < 3) normalized.crew.push({ name: "", title: "" });
  normalized.crew = normalized.crew.map((member) => ({ name: String(member?.name || ""), title: String(member?.title || "") }));
  normalized.version = FORMAT_VERSION;

  for (const definition of damageDefs) {
    const layer = normalized.damage[definition.key];
    layer.max = clamp(layer.max, 0, 10);
    layer.current = clamp(layer.current, 0, layer.max);
    if (definition.key === "guard" || definition.key === "shell") layer.threshold = clamp(layer.threshold, 0, 999);
  }

  normalized.experience.available = clamp(normalized.experience.available, 0, 9999999);
  normalized.experience.spent = clamp(normalized.experience.spent, 0, 9999999);
  normalized.experience.totalGained = Math.max(
    clamp(normalized.experience.totalGained, 0, 9999999),
    normalized.experience.available + normalized.experience.spent,
  );
  normalized.resources.exertionMax = clamp(normalized.resources.exertionMax, 0, 99);
  normalized.resources.exertionCurrent = clamp(normalized.resources.exertionCurrent, 0, normalized.resources.exertionMax);
  normalized.resources.reverence = clamp(normalized.resources.reverence, 0, 999);
  return normalized;
}

function loadLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCharacter);
  } catch {
    return [];
  }
}

function activeCharacter() {
  return library.find((entry) => entry.id === activeId) || library[0];
}

function saveLibrary(message = "Saved locally") {
  character.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  localStorage.setItem(ACTIVE_KEY, activeId);
  saveStatus.textContent = message;
  saveStatus.classList.remove("saving");
}

function queueSave() {
  saveStatus.textContent = "Saving...";
  saveStatus.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLibrary(), 180);
}

function notice(message, type = "") {
  creatorNotice.textContent = message;
  creatorNotice.className = `creator-notice ${type}`.trim();
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    creatorNotice.textContent = "";
    creatorNotice.className = "creator-notice";
  }, 4200);
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((value, key) => value[key], object);
  target[last] = value;
}

function boxesFilled(attributeKey) {
  return character.attributes[attributeKey].reduce((total, dieIndex) => total + Math.max(0, dieIndex + 1), 0);
}

function calculatedExertionMax() {
  return 1 + character.attributes.willpower.filter((dieIndex) => dieIndex >= 3).length;
}

function calculatedMoveSpeed() {
  return 2 + character.attributes.dexterity.filter((dieIndex) => dieIndex >= 3).length;
}

function syncExertion(previousMax = null) {
  const nextMax = calculatedExertionMax();
  const oldMax = previousMax ?? character.resources.exertionMax;
  if (nextMax > oldMax && character.resources.exertionCurrent === oldMax) {
    character.resources.exertionCurrent = nextMax;
  }
  character.resources.exertionMax = nextMax;
  character.resources.exertionCurrent = clamp(character.resources.exertionCurrent, 0, nextMax);
}

function diceSummary(attributeKey) {
  const dice = character.attributes[attributeKey].filter((value) => value >= 0).map((value) => diceNames[value]);
  return dice.length ? dice.join(" + ") : "No dice";
}

function skillCost(level) {
  const current = Math.max(0, Number(level) || 0);
  return current === 0 ? 10 : current * 30;
}

function skillRefund(level) {
  const current = Math.max(0, Number(level) || 0);
  return current <= 1 ? 10 : (current - 1) * 30;
}

function totalSkillXp(level) {
  let total = 0;
  for (let current = 0; current < level; current += 1) total += skillCost(current);
  return total;
}

function derivedValues() {
  const initiative = Number(character.skills.Initiative) || 0;
  const awareness = Number(character.skills.Awareness) || 0;
  const resistDistress = Number(character.skills["Resist Distress"]) || 0;
  const threshold = boxesFilled("health") + resistDistress;
  return {
    speed: boxesFilled("intellect") + initiative,
    command: boxesFilled("perception") * 10 + awareness * 30,
    stability: threshold,
    core: threshold,
    corePenalty: -(character.damage.core.max - character.damage.core.current),
  };
}

function dieSvg(column, cost, purchased) {
  const vectorShapes = [
    `<path class="die-shape" d="M24 5 43 40H5Z" />`,
    `<path class="die-shape" d="m24 4 18 10v20L24 44 6 34V14Z" />
     <path class="die-detail" d="m6 14 18 10 18-10M24 24v20" />`,
    `<path class="die-shape" d="m24 3 20 20-20 22L4 23Z" />
     <path class="die-detail" d="M4 23h40M24 3 13 23l11 22 11-22Z" />`,
    `<path class="die-shape" d="m24 3 20 19-20 23L4 22Z" />
     <path class="die-detail" d="m24 3 8 17-8 25-8-25ZM4 22l12-2h16l12 2" />`,
    `<path class="die-shape" d="m24 3 17 10 2 20-19 12L5 33l2-20Z" />
     <path class="die-inner" d="m24 7 11 7-4 13H17l-4-13Z" />`,
  ];
  return `
    <svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${vectorShapes[column]}
      ${purchased ? "" : `<text class="die-cost" x="24" y="25">${cost}</text><text class="die-xp" x="24" y="33">XP</text>`}
    </svg>`;
}

function renderCharacterPicker() {
  characterPicker.innerHTML = library
    .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.identity.characterName || "Unnamed Character")}</option>`)
    .join("");
  characterPicker.value = activeId;
}

function renderFields() {
  document.querySelectorAll("[data-field]").forEach((input) => {
    const value = getPath(character, input.dataset.field);
    input.value = value ?? "";
  });
  identityCallsign.textContent = character.identity.characterName || "Unnamed Character";
  renderIdentityTheme();
}

function renderIdentityTheme() {
  const identityPanel = document.querySelector(".identity-panel");
  const value = character.identity.sex.trim().toLowerCase();
  identityPanel.classList.remove("identity-male", "identity-female", "identity-other");
  if (value === "m" || value === "male") identityPanel.classList.add("identity-male");
  else if (value === "f" || value === "female") identityPanel.classList.add("identity-female");
  else if (value) identityPanel.classList.add("identity-other");
}

function renderExperience() {
  xpAvailable.textContent = character.experience.available;
  xpSpent.textContent = character.experience.spent;
  xpTotal.textContent = character.experience.totalGained;
}

function renderAttributes() {
  attributeGrid.innerHTML = attributeDefs.map((definition) => {
    const rows = character.attributes[definition.key];
    const rowMarkup = rows.map((current, row) => {
      const progress = ((current + 1) / 5) * 100;
      const buttons = diceNames.map((dieName, column) => {
        const purchased = column <= current;
        const next = column === current + 1;
        const locked = row < 2 && column === 0;
        const title = purchased
          ? locked ? `${dieName} is a free starting die` : column === current ? `Refund ${attributeCosts[row][column]} XP and step this die down` : `${dieName} purchased`
          : `Purchase through ${dieName}`;
        return `<button class="attribute-die ${purchased ? "purchased" : ""} ${next ? "next" : ""} ${locked ? "locked" : ""}" type="button" data-attribute="${definition.key}" data-row="${row}" data-column="${column}" title="${title}">${dieSvg(column, attributeCosts[row][column], purchased)}</button>`;
      }).join("");
      const wave = current >= 0 ? `<span class="attribute-purchased-wave" aria-hidden="true"></span>` : "";
      return `<div class="attribute-row" style="--progress:${progress}%">${wave}${buttons}</div>`;
    }).join("");
    return `<article class="attribute-card" style="--attribute:${definition.color}"><div class="attribute-card-head"><strong>${definition.label}</strong><span>${diceSummary(definition.key)} | ${boxesFilled(definition.key)} boxes</span></div><div class="attribute-rows">${rowMarkup}</div></article>`;
  }).join("");
}

function formatSkillName(name) {
  return escapeHtml(name).replaceAll(" ", "&nbsp;").replaceAll("/", "/<wbr>");
}

function renderSkillRow(name, level, customIndex = null) {
  const keySkill = ["Awareness", "Initiative", "Resist Distress"].includes(name);
  const attributes = customIndex === null ? `data-skill="${escapeAttribute(name)}"` : `data-custom-skill="${customIndex}"`;
  const cost = skillCost(level);
  return `<div class="skill-row ${keySkill ? "key-skill" : ""}" data-search-name="${escapeAttribute(name.toLowerCase())}">
    <span class="skill-name" title="${escapeAttribute(name)}">${formatSkillName(name)}</span>
    <button class="skill-refund" type="button" data-skill-action="decrease" ${attributes} aria-label="Decrease ${escapeAttribute(name)}">-</button>
    <span class="skill-level">${level}</span>
    <button class="skill-buy" type="button" data-skill-action="increase" ${attributes} aria-label="Spend ${cost} XP to increase ${escapeAttribute(name)}"><strong>${cost}</strong><small>XP</small></button>
  </div>`;
}

function renderSkills() {
  spacecraftSkills.innerHTML = spacecraftSkillNames.map((name) => renderSkillRow(name, character.skills[name])).join("");
  generalSkills.innerHTML = generalSkillNames.map((name) => renderSkillRow(name, character.skills[name])).join("");
  customSkills.innerHTML = character.customSkills.map((skill, index) => {
    const cost = skillCost(skill.level);
    return `
    <div class="custom-skill-row">
      <input data-custom-name="${index}" value="${escapeAttribute(skill.name)}" placeholder="Custom Skill ${index + 1}" aria-label="Custom skill ${index + 1} name" />
      <button class="skill-refund" type="button" data-skill-action="decrease" data-custom-skill="${index}" aria-label="Decrease custom skill">-</button>
      <span class="skill-level">${skill.level}</span>
      <button class="skill-buy" type="button" data-skill-action="increase" data-custom-skill="${index}" aria-label="Spend ${cost} XP to increase custom skill"><strong>${cost}</strong><small>XP</small></button>
      <button class="row-remove" type="button" data-remove-custom-skill="${index}" aria-label="Remove custom skill">-</button>
    </div>`;
  }).join("");
  customSkillsEmpty.hidden = character.customSkills.length > 0;
  applySkillSearch();
}

function layerThreshold(key) {
  const derived = derivedValues();
  if (key === "stability") return derived.stability;
  if (key === "core") return derived.core;
  return character.damage[key].threshold;
}

function renderDamage() {
  damageLayers.innerHTML = damageDefs.map((definition) => {
    const layer = character.damage[definition.key];
    const points = Array.from({ length: 10 }, (_, index) => {
      const unavailable = index >= layer.max;
      const erased = !unavailable && index < layer.max - layer.current;
      return `<button type="button" class="damage-point ${definition.pointClass} ${erased ? "erased" : ""} ${unavailable ? "unavailable" : ""}" data-damage-point="${definition.key}" data-point-index="${index}" aria-label="${definition.label} point ${index + 1}${unavailable ? ", unavailable" : erased ? ", erased" : ", filled"}"></button>`;
    }).join("");
    const thresholdControl = definition.key === "guard" || definition.key === "shell"
      ? `<label>Threshold<input type="number" min="0" max="999" step="1" value="${layer.threshold}" data-damage-threshold="${definition.key}" /></label>`
      : `<label>Threshold<input value="${layerThreshold(definition.key)}" readonly aria-label="${definition.label} derived threshold" /></label>`;
    return `<article class="damage-layer" style="--layer:${definition.color}">
      <div class="damage-layer-head"><strong>${definition.label}</strong><span>${layer.current} / ${layer.max} Points</span></div>
      <div class="damage-points">${points}</div>
      <div class="damage-controls">
        ${thresholdControl}
        <label>Maximum Points<div class="point-stepper"><button type="button" data-damage-max="${definition.key}" data-change="-1">-</button><strong>${layer.max}</strong><button type="button" data-damage-max="${definition.key}" data-change="1">+</button></div></label>
      </div>
    </article>`;
  }).join("");
}

function renderDerived() {
  const derived = derivedValues();
  derivedSpeed.textContent = derived.speed;
  derivedCommand.textContent = `${derived.command} sec`;
  derivedStability.textContent = derived.stability;
  derivedCore.textContent = derived.core;
  derivedCorePenalty.textContent = derived.corePenalty;
  document.querySelector(".core-penalty")?.classList.toggle("active", derived.corePenalty < 0);
}

function renderResources() {
  syncExertion();
  character.resources.moveSpeed = calculatedMoveSpeed();
  exertionCurrent.textContent = character.resources.exertionCurrent;
  exertionMax.textContent = character.resources.exertionMax;
  reverenceCurrent.textContent = character.resources.reverence;
  moveSpeedValue.textContent = character.resources.moveSpeed;
}

function renderCrew() {
  const atMinimum = character.crew.length <= 3;
  crewRoster.innerHTML = character.crew.map((member, index) => `<div class="crew-row"><input data-crew-index="${index}" data-crew-field="name" value="${escapeAttribute(member.name)}" placeholder="Crewmember" aria-label="Crewmember ${index + 1} name" /><input data-crew-index="${index}" data-crew-field="title" value="${escapeAttribute(member.title)}" placeholder="Title / Station" aria-label="Crewmember ${index + 1} title" /><button class="row-remove" type="button" data-remove-crew="${index}" ${atMinimum ? "disabled" : ""} aria-label="Remove crew row ${index + 1}">-</button></div>`).join("");
}

function renderAll() {
  renderCharacterPicker();
  renderFields();
  renderExperience();
  renderAttributes();
  renderSkills();
  renderDamage();
  renderDerived();
  renderResources();
  renderCrew();
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

function refundXp(cost) {
  character.experience.available += cost;
  character.experience.spent = Math.max(0, character.experience.spent - cost);
}

function purchaseAttribute(attributeKey, row, column) {
  const current = character.attributes[attributeKey][row];
  const definition = attributeDefs.find((entry) => entry.key === attributeKey);
  const previousExertionMax = calculatedExertionMax();
  if (!definition) return;

  if (column > current) {
    const cost = attributeCosts[row].slice(current + 1, column + 1).reduce((total, value) => total + value, 0);
    if (!spendXp(cost, `${definition.label} ${diceNames[column]}`)) return;
    character.attributes[attributeKey][row] = column;
    notice(`${definition.label} upgraded to ${diceNames[column]} for ${cost} XP.`, "success");
  } else if (column === current) {
    if (row < 2 && column === 0) {
      notice("The first two D4 dice are free starting dice.");
      return;
    }
    const refund = attributeCosts[row][column];
    character.attributes[attributeKey][row] = current - 1;
    refundXp(refund);
    notice(`${refund} XP refunded.`, "success");
  } else {
    notice("Use the rightmost filled die to step this row down.");
    return;
  }
  syncExertion(previousExertionMax);
  queueSave();
  renderAll();
}

function changeSkill(name, direction, customIndex = null) {
  const holder = customIndex === null ? character.skills : character.customSkills[customIndex];
  const current = customIndex === null ? Number(holder[name]) || 0 : Number(holder.level) || 0;
  if (direction > 0) {
    const cost = skillCost(current);
    const label = customIndex === null ? name : holder.name || "Custom Skill";
    if (!spendXp(cost, `${label} ${current + 1}`)) return;
    if (customIndex === null) holder[name] = current + 1;
    else holder.level = current + 1;
    notice(`${label} increased to ${current + 1} for ${cost} XP.`, "success");
  } else {
    if (current <= 0) return;
    const refund = skillRefund(current);
    if (customIndex === null) holder[name] = current - 1;
    else holder.level = current - 1;
    refundXp(refund);
    notice(`${refund} XP refunded.`, "success");
  }
  queueSave();
  renderAll();
}

function applySkillSearch() {
  const query = skillSearch.value.trim().toLowerCase();
  document.querySelectorAll(".skill-row[data-search-name]").forEach((row) => {
    row.classList.toggle("hidden-by-search", Boolean(query) && !row.dataset.searchName.includes(query));
  });
}

function filenameForCharacter() {
  const raw = character.identity.characterName || "spaceship-architect-character";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "spaceship-architect-character";
}

function exportCurrentCharacter() {
  saveLibrary();
  const payload = {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    character,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenameForCharacter()}.sa2character`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice("Character exported. Import this file on another device to continue.", "success");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (field) {
    const value = field.type === "number" ? Number(field.value) || 0 : field.value;
    setPath(character, field.dataset.field, value);
    if (field.dataset.field === "identity.characterName") {
      identityCallsign.textContent = value || "Unnamed Character";
      const option = characterPicker.querySelector(`option[value="${activeId}"]`);
      if (option) option.textContent = value || "Unnamed Character";
    }
    if (field.dataset.field === "identity.sex") renderIdentityTheme();
    queueSave();
    return;
  }

  if (event.target.matches("[data-damage-threshold]")) {
    const key = event.target.dataset.damageThreshold;
    character.damage[key].threshold = clamp(event.target.value, 0, 999);
    queueSave();
    return;
  }

  if (event.target.matches("[data-custom-name]")) {
    character.customSkills[Number(event.target.dataset.customName)].name = event.target.value;
    queueSave();
    return;
  }

  if (event.target.matches("[data-crew-index]")) {
    const member = character.crew[Number(event.target.dataset.crewIndex)];
    member[event.target.dataset.crewField] = event.target.value;
    queueSave();
  }
});

document.addEventListener("click", (event) => {
  const die = event.target.closest("[data-attribute]");
  if (die) {
    purchaseAttribute(die.dataset.attribute, Number(die.dataset.row), Number(die.dataset.column));
    return;
  }

  const skillButton = event.target.closest("[data-skill-action]");
  if (skillButton) {
    const direction = skillButton.dataset.skillAction === "increase" ? 1 : -1;
    const customIndex = skillButton.dataset.customSkill === undefined ? null : Number(skillButton.dataset.customSkill);
    changeSkill(skillButton.dataset.skill || "", direction, customIndex);
    return;
  }

  const point = event.target.closest("[data-damage-point]");
  if (point) {
    const layer = character.damage[point.dataset.damagePoint];
    const index = Number(point.dataset.pointIndex);
    if (index >= layer.max) return;
    const damageCount = layer.max - layer.current;
    const nextDamageCount = index < damageCount ? index : index + 1;
    layer.current = layer.max - nextDamageCount;
    queueSave();
    renderDamage();
    renderDerived();
    return;
  }

  const maxButton = event.target.closest("[data-damage-max]");
  if (maxButton) {
    const layer = character.damage[maxButton.dataset.damageMax];
    const previousMax = layer.max;
    layer.max = clamp(layer.max + Number(maxButton.dataset.change), 0, 10);
    if (layer.max > previousMax && layer.current === previousMax) layer.current = layer.max;
    layer.current = Math.min(layer.current, layer.max);
    queueSave();
    renderDamage();
    renderDerived();
    return;
  }

  const resourceButton = event.target.closest("[data-resource]");
  if (resourceButton) {
    const change = Number(resourceButton.dataset.change);
    if (resourceButton.dataset.resource === "exertion") {
      character.resources.exertionCurrent = clamp(character.resources.exertionCurrent + change, 0, character.resources.exertionMax);
    } else {
      character.resources.reverence = clamp(character.resources.reverence + change, 0, 999);
    }
    queueSave();
    renderResources();
    return;
  }

  const removeCustomSkill = event.target.closest("[data-remove-custom-skill]");
  if (removeCustomSkill) {
    const index = Number(removeCustomSkill.dataset.removeCustomSkill);
    const skill = character.customSkills[index];
    if (!skill) return;
    const refund = totalSkillXp(skill.level);
    if (refund > 0 && !confirm(`Remove ${skill.name || "this custom skill"} and refund ${refund} XP?`)) return;
    if (refund > 0) refundXp(refund);
    character.customSkills.splice(index, 1);
    queueSave();
    renderSkills();
    renderExperience();
    notice(refund > 0 ? `${refund} XP refunded.` : "Custom skill removed.", "success");
    return;
  }

  const removeCrew = event.target.closest("[data-remove-crew]");
  if (removeCrew) {
    if (character.crew.length <= 3) return;
    const index = Number(removeCrew.dataset.removeCrew);
    const member = character.crew[index];
    if ((member?.name || member?.title) && !confirm(`Remove ${member.name || "this crew entry"} from the roster?`)) return;
    character.crew.splice(index, 1);
    queueSave();
    renderCrew();
    return;
  }
});

addCustomSkillButton.addEventListener("click", () => {
  character.customSkills.push({ name: "", level: 0 });
  queueSave();
  renderSkills();
  customSkills.querySelector("[data-custom-name]:last-of-type")?.focus();
});

addCrewRowButton.addEventListener("click", () => {
  character.crew.push({ name: "", title: "" });
  queueSave();
  renderCrew();
  crewRoster.querySelector(".crew-row:last-child input")?.focus();
});

characterPicker.addEventListener("change", () => {
  saveLibrary();
  activeId = characterPicker.value;
  character = activeCharacter();
  localStorage.setItem(ACTIVE_KEY, activeId);
  skillSearch.value = "";
  renderAll();
});

newCharacterButton.addEventListener("click", () => {
  saveLibrary();
  const next = blankCharacter(`New Character ${library.length + 1}`);
  library.push(next);
  activeId = next.id;
  character = next;
  saveLibrary("New character saved locally");
  skillSearch.value = "";
  renderAll();
});

duplicateCharacterButton.addEventListener("click", () => {
  const duplicate = normalizeCharacter(JSON.parse(JSON.stringify(character)));
  duplicate.id = uid();
  duplicate.identity.characterName = `${character.identity.characterName || "Character"} Copy`;
  duplicate.updatedAt = new Date().toISOString();
  library.push(duplicate);
  activeId = duplicate.id;
  character = duplicate;
  saveLibrary("Duplicate saved locally");
  renderAll();
});

deleteCharacterButton.addEventListener("click", () => {
  if (!confirm(`Delete ${character.identity.characterName || "this character"} from this device? Export first if you need a backup.`)) return;
  library = library.filter((entry) => entry.id !== activeId);
  if (!library.length) library.push(blankCharacter());
  activeId = library[0].id;
  character = activeCharacter();
  saveLibrary("Character deleted");
  skillSearch.value = "";
  renderAll();
});

grantXpButton.addEventListener("click", () => {
  const amount = Math.floor(Number(xpGrantAmount.value) || 0);
  if (amount <= 0) {
    notice("Enter a positive XP award.", "error");
    return;
  }
  character.experience.available += amount;
  character.experience.totalGained += amount;
  queueSave();
  renderExperience();
  notice(`${amount} XP added.`, "success");
});

exportCharacterButton.addEventListener("click", exportCurrentCharacter);

importCharacterInput.addEventListener("change", async () => {
  const file = importCharacterInput.files?.[0];
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
    skillSearch.value = "";
    renderAll();
    notice("Character imported successfully.", "success");
  } catch {
    notice("That file is not a valid Spaceship Architect character export.", "error");
  } finally {
    importCharacterInput.value = "";
  }
});

skillSearch.addEventListener("input", applySkillSearch);
window.addEventListener("beforeunload", () => saveLibrary());

renderAll();
saveLibrary();
