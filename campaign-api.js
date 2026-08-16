const crypto = require("crypto");

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_SCRIPT_LENGTH = 250000;
const PLAYER_INBOX_LIMIT = 20;
const GM_INBOX_LIMIT = 50;

function uid(prefix = "id") {
  return `${prefix}-${crypto.randomBytes(9).toString("base64url")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function campaignCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const actual = Buffer.from(record.hash, "hex");
  const candidate = crypto.scryptSync(String(password), record.salt, 64);
  return actual.length === candidate.length && crypto.timingSafeEqual(actual, candidate);
}

function boundedNumber(value, min, max) {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : 0));
}

function safeCharacterName(record) {
  return String(record?.character?.identity?.characterName || "Unnamed Character").trim().slice(0, 80) || "Unnamed Character";
}

function rewardLabel(resource) {
  return { experience: "Experience", credits: "Credits", reverence: "Reverence", shipCredits: "Group Credits" }[resource] || resource;
}

function characterRewardSnapshot(record) {
  const character = record.character;
  character.experience ||= { available: 0, spent: 0, totalGained: 0 };
  character.resources ||= {};
  return {
    id: record.id,
    experience: clone(character.experience),
    creditsBase: Number(character.resources.creditsBase) || 0,
    reverence: Number(character.resources.reverence) || 0,
  };
}

function applyCharacterReward(record, award) {
  const character = record.character;
  const resource = award.resource;
  const amount = Math.round(Number(award.amount) || 0);
  const before = characterRewardSnapshot(record);
  let appliedAmount = amount;
  let appliedResource = resource;
  let messageDetail = "";

  if (resource === "experience") {
    const raceId = character.identity?.raceId;
    const received = raceId === "android" ? 0 : raceId === "spiddix" ? Math.floor(amount / 2) : amount;
    character.experience.available = Math.max(0, Math.round((Number(character.experience.available) || 0) + received));
    character.experience.totalGained = Math.max(
      Number(character.experience.spent) + character.experience.available,
      Math.round((Number(character.experience.totalGained) || 0) + amount),
    );
    appliedAmount = received;
    if (received !== amount) messageDetail = raceId === "android"
      ? " Androids do not receive Experience awards."
      : ` Spiddix receives ${received.toLocaleString()} Experience after its racial adjustment.`;
  }

  const androidConversion = resource === "credits"
    && amount > 0
    && Array.isArray(award.androidExperienceIds)
    && award.androidExperienceIds.includes(record.id);
  if (androidConversion) {
    const converted = Math.max(0, Math.floor(amount / 75));
    character.experience.available = Math.max(0, Math.round((Number(character.experience.available) || 0) + converted));
    character.experience.totalGained = Math.max(
      Number(character.experience.spent) + character.experience.available,
      Math.round((Number(character.experience.totalGained) || 0) + converted),
    );
    appliedAmount = converted;
    appliedResource = "experience";
    messageDetail = ` Converted into ${converted.toLocaleString()} Android Experience.`;
  } else if (resource === "credits") {
    const current = Number(character.resources.creditsBase) || 0;
    character.resources.creditsBase = Math.round(boundedNumber(current + amount, 0, 999999999));
    appliedAmount = character.resources.creditsBase - current;
  }

  if (resource === "reverence") {
    const current = Number(character.resources.reverence) || 0;
    character.resources.reverence = Math.round(boundedNumber(current + amount, 0, 10));
    appliedAmount = character.resources.reverence - current;
    const wasted = Math.max(0, amount - appliedAmount);
    if (wasted) messageDetail = ` ${wasted.toLocaleString()} excess Reverence was lost at the maximum of 10.`;
  }

  record.updatedAt = new Date().toISOString();
  return { before, appliedAmount, appliedResource, messageDetail };
}

function trimAwardHistory(campaign) {
  const history = Array.isArray(campaign.awardHistory) ? campaign.awardHistory : [];
  const keep = new Set(history.slice(-20).map((award) => award.id));
  for (const award of history) {
    const claimed = new Set(Array.isArray(award.claimedCharacterIds) ? award.claimedCharacterIds : []);
    if (award.claimRequired && (award.targetIds || []).some((id) => !claimed.has(id))) keep.add(award.id);
  }
  campaign.awardHistory = history.filter((award) => keep.has(award.id));
}

function limitedNotes(notes, limit) {
  const recent = notes.slice(-limit);
  const pending = notes.filter((note) => note.kind === "award" && note.rewardStatus === "pending");
  const keep = new Set([...recent, ...pending].map((note) => note.id));
  return notes.filter((note) => keep.has(note.id));
}

function normalizeInventoryItem(raw) {
  const chargesMax = raw?.chargesMax === null || raw?.chargesMax === undefined ? null : Math.max(0, Number(raw.chargesMax) || 0);
  return {
    id: String(raw?.id || uid("item")).slice(0, 100),
    catalogId: String(raw?.catalogId || "").slice(0, 100),
    name: String(raw?.name || "Custom Item").trim().slice(0, 120) || "Custom Item",
    description: String(raw?.description || "").slice(0, 4000),
    quantity: Math.max(1, Math.min(9999, Math.round(Number(raw?.quantity) || 1))),
    unitCost: Math.max(0, Math.min(999999999, Math.round(Number(raw?.unitCost) || 0))),
    chargesMax,
    charges: chargesMax === null ? null : Math.max(0, Math.min(chargesMax, Number(raw?.charges ?? chargesMax))),
    chargeState: String(raw?.chargeState || "").slice(0, 40),
    special: String(raw?.special || "").slice(0, 80),
  };
}

function matchingInventoryItem(list, item) {
  return list.find((entry) => entry.catalogId === item.catalogId && entry.name === item.name
    && entry.description === item.description && Number(entry.unitCost) === Number(item.unitCost)
    && entry.charges === item.charges && entry.chargesMax === item.chargesMax && entry.chargeState === item.chargeState);
}

function addInventoryItem(character, source, quantity = 1) {
  character.items = Array.isArray(character.items) ? character.items : [];
  const item = normalizeInventoryItem(source);
  const matching = matchingInventoryItem(character.items, item);
  if (matching) matching.quantity = Math.min(9999, Number(matching.quantity || 0) + quantity);
  else character.items.push({ ...item, id: uid("item"), quantity });
  return matching || character.items.at(-1);
}

function removeInventoryItem(character, itemId, fallbackItem = null, quantity = 1) {
  character.items = Array.isArray(character.items) ? character.items : [];
  const target = character.items.find((entry) => entry.id === itemId)
    || (fallbackItem ? matchingInventoryItem(character.items, fallbackItem) : null);
  if (!target) return false;
  target.quantity = Math.max(0, Number(target.quantity || 0) - quantity);
  if (target.quantity <= 0) character.items = character.items.filter((entry) => entry !== target);
  return true;
}


function normalizeWeaponTransaction(raw) {
  return {
    id: String(raw?.id || uid("weaponrow")).slice(0, 100),
    weaponId: String(raw?.weaponId || "").slice(0, 100),
    previousWeaponId: String(raw?.previousWeaponId || "").slice(0, 100),
    name: String(raw?.name || "Weapon").trim().slice(0, 120) || "Weapon",
    unitCost: Math.max(0, Math.min(999999999, Math.round(Number(raw?.unitCost) || 0))),
  };
}
function applyWeaponTransaction(character, item) {
  character.weapons = Array.isArray(character.weapons) && character.weapons.length ? character.weapons : [{ id: item.id, weaponId: "", held: false }];
  let row = character.weapons.find((entry) => entry.id === item.id);
  if (!row) { row = { id: item.id, weaponId: "", held: false }; character.weapons.push(row); }
  row.weaponId = item.weaponId;
  row.held = false;
  return row;
}
function denyWeaponTransaction(character, item) {
  character.weapons = Array.isArray(character.weapons) && character.weapons.length ? character.weapons : [{ id: item.id, weaponId: "", held: false }];
  const row = character.weapons.find((entry) => entry.id === item.id);
  if (!row || row.weaponId !== item.weaponId) return false;
  row.weaponId = item.previousWeaponId || "";
  row.held = false;
  return true;
}

function addStoredInventoryItem(character, source, quantity = 1) {
  character.storedItems = Array.isArray(character.storedItems) ? character.storedItems : [];
  const item = normalizeInventoryItem(source);
  const matching = matchingInventoryItem(character.storedItems, item);
  if (matching) matching.quantity = Math.min(9999, Number(matching.quantity || 0) + quantity);
  else character.storedItems.push({ ...item, id: uid("stored-item"), quantity });
  return matching || character.storedItems.at(-1);
}

function removeStoredInventoryItem(character, itemId, quantity = 1) {
  character.storedItems = Array.isArray(character.storedItems) ? character.storedItems : [];
  const target = character.storedItems.find((entry) => entry.id === itemId);
  if (!target || Number(target.quantity || 0) < quantity) return null;
  const removed = normalizeInventoryItem(target);
  target.quantity = Math.max(0, Number(target.quantity || 0) - quantity);
  if (target.quantity <= 0) character.storedItems = character.storedItems.filter((entry) => entry !== target);
  return removed;
}
function trimPrivateNotes(campaign) {
  const notes = Array.isArray(campaign.privateNotes) ? campaign.privateNotes : [];
  const keep = new Set(notes.slice(-GM_INBOX_LIMIT).map((note) => note.id));
  for (const record of campaign.characters || []) {
    notes.filter((note) => note.characterId === record.id).slice(-PLAYER_INBOX_LIMIT).forEach((note) => keep.add(note.id));
  }
  notes.filter((note) => note.kind === "award" && note.rewardStatus === "pending").forEach((note) => keep.add(note.id));
  campaign.privateNotes = notes.filter((note) => keep.has(note.id));
}
function applyConditionalDelivery(campaign, record, action) {
  const now = new Date().toISOString();
  if (action.kind === "message") {
    campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "message", message: action.message, createdAt: now, readAt: null });
    return { kind: "message" };
  }
  const resource = action.resource;
  const amount = Math.max(0, Math.round(Number(action.amount) || 0));
  const award = {
    id: uid("award"), resource, amount, targetIds: [record.id],
    before: { shipCredits: campaign.shipCredits, characters: [] },
    at: now, claimRequired: true, claimedCharacterIds: [], androidExperienceIds: [],
  };
  campaign.awardHistory.push(award);
  trimAwardHistory(campaign);
  campaign.privateNotes.push({
    id: uid("note"), characterId: record.id, characterName: safeCharacterName(record),
    direction: "to-character", kind: "award", awardId: award.id,
    rewardResource: resource, rewardAmount: amount, rewardStatus: "pending",
    message: `Successful ${action.attribute} + ${action.skill} check: ${amount.toLocaleString()} ${rewardLabel(resource)} is ready to receive.`,
    createdAt: now, readAt: null,
  });
  return { kind: "award", resource, amount, awardId: award.id, pending: true };
}

function defaultCampaign({ code, name, gmCode }) {
  const now = new Date().toISOString();
  return {
    version: 2,
    code,
    name: String(name || "New Campaign").trim().slice(0, 80) || "New Campaign",
    gmCode: passwordRecord(gmCode),
    createdAt: now,
    updatedAt: now,
    script: "",
    scriptChapters: [{ id: uid("chapter"), name: "Chapter 1", script: "" }],
    conditionalActions: [],
    characters: [],
    joinRequests: [],
    shipCredits: 0,
    bankerCharacterId: null,
    awardHistory: [],
    itemTransactions: [],
    privateNotes: [],
    rollRequests: [],
    npcTemplates: [],
    settings: { commandWindowBonus: 0 },
    encounter: null,
    sessionNumber: 0,
  };
}

function normalizeCampaign(raw) {
  const campaign = raw && typeof raw === "object" ? raw : {};
  campaign.version = 2;
  campaign.code = String(campaign.code || "").trim().toUpperCase();
  campaign.name = String(campaign.name || "Campaign").trim().slice(0, 80) || "Campaign";
  campaign.gmCode = campaign.gmCode || campaign.password || null;
  delete campaign.password;
  campaign.script = String(campaign.script || "").slice(0, MAX_SCRIPT_LENGTH);
  const legacyScript = campaign.script;
  const chapterSource = Array.isArray(campaign.scriptChapters) && campaign.scriptChapters.length
    ? campaign.scriptChapters
    : [{ id: uid("chapter"), name: "Chapter 1", script: legacyScript }];
  campaign.scriptChapters = chapterSource.slice(0, 100).map((chapter, index) => ({
    id: String(chapter?.id || uid("chapter")).slice(0, 100),
    name: String(chapter?.name || `Chapter ${index + 1}`).trim().slice(0, 80) || `Chapter ${index + 1}`,
    script: String(chapter?.script || "").slice(0, MAX_SCRIPT_LENGTH),
  }));
  campaign.script = campaign.scriptChapters[0].script;
  campaign.conditionalActions = (Array.isArray(campaign.conditionalActions) ? campaign.conditionalActions : []).slice(0, 250).map((action) => ({
    id: String(action?.id || uid("conditional")).slice(0, 100),
    keyword: String(action?.keyword || "").trim().slice(0, 60),
    kind: action?.kind === "award" ? "award" : "message",
    message: String(action?.message || "").trim().slice(0, 4000),
    resource: ["experience", "credits", "reverence", "shipCredits"].includes(action?.resource) ? action.resource : "experience",
    amount: Math.round(boundedNumber(action?.amount, 0, 999999999)),
    attribute: String(action?.attribute || "").slice(0, 40),
    skill: String(action?.skill || "").slice(0, 80),
    difficulty: Number.isFinite(Number(action?.difficulty)) ? Number(action.difficulty) : 0,
    hideDifficulty: Boolean(action?.hideDifficulty),
  })).filter((action) => action.keyword && action.attribute && action.skill && action.difficulty >= 0);
  campaign.settings = campaign.settings && typeof campaign.settings === "object" ? campaign.settings : {};
  campaign.settings.commandWindowBonus = Math.round(boundedNumber(campaign.settings.commandWindowBonus, 0, 3600));
  campaign.characters = Array.isArray(campaign.characters) ? campaign.characters : [];
  campaign.characters = campaign.characters.map((record) => ({
    id: String(record?.id || record?.character?.id || uid("character")),
    pcCode: String(record?.pcCode ?? record?.pin ?? "").slice(0, 120),
    approved: true,
    imported: Boolean(record?.imported),
    createdAt: record?.createdAt || new Date().toISOString(),
    updatedAt: record?.updatedAt || new Date().toISOString(),
    character: record?.character && typeof record.character === "object" ? record.character : {},
  }));
  campaign.joinRequests = (Array.isArray(campaign.joinRequests) ? campaign.joinRequests : []).slice(-250).map((request) => ({
    id: String(request?.id || uid("join")),
    characterId: String(request?.characterId || request?.character?.id || uid("character")),
    pcCode: String(request?.pcCode || "").slice(0, 120),
    status: ["pending", "approved", "rejected"].includes(request?.status) ? request.status : "pending",
    requestedAt: request?.requestedAt || new Date().toISOString(),
    resolvedAt: request?.resolvedAt || null,
    message: String(request?.message || "").slice(0, 1000),
    character: request?.character && typeof request.character === "object" ? request.character : {},
  }));
  campaign.shipCredits = Math.round(boundedNumber(campaign.shipCredits, -999999999999, 999999999999));
  campaign.bankerCharacterId = campaign.characters.some((record) => record.id === campaign.bankerCharacterId)
    ? campaign.bankerCharacterId
    : null;
  campaign.awardHistory = (Array.isArray(campaign.awardHistory) ? campaign.awardHistory : []).map((award) => ({
    ...award,
    id: String(award?.id || uid("award")),
    resource: ["experience", "credits", "reverence", "shipCredits"].includes(award?.resource) ? award.resource : "experience",
    amount: Math.round(Number(award?.amount) || 0),
    targetIds: Array.isArray(award?.targetIds) ? [...new Set(award.targetIds.map(String))] : [],
    before: award?.before && typeof award.before === "object" ? award.before : { shipCredits: campaign.shipCredits, characters: [] },
    claimRequired: Boolean(award?.claimRequired),
    claimedCharacterIds: Array.isArray(award?.claimedCharacterIds) ? [...new Set(award.claimedCharacterIds.map(String))] : [],
    androidExperienceIds: Array.isArray(award?.androidExperienceIds) ? [...new Set(award.androidExperienceIds.map(String))] : [],
    at: award?.at || new Date().toISOString(),
  }));
  trimAwardHistory(campaign);
  campaign.itemTransactions = Array.isArray(campaign.itemTransactions) ? campaign.itemTransactions.slice(-250) : [];
  campaign.privateNotes = (Array.isArray(campaign.privateNotes) ? campaign.privateNotes : []).slice(-1000).map((note) => ({
    id: String(note?.id || uid("note")),
    characterId: String(note?.characterId || ""),
    characterName: String(note?.characterName || "").slice(0, 80),
    direction: note?.direction === "to-gm" ? "to-gm" : "to-character",
    kind: ["system", "award", "damage", "roll-request", "session-end", "science-choice", "item-transaction", "item-activity", "recharge"].includes(note?.kind) ? note.kind : "message",
    choices: Array.isArray(note?.choices) ? note.choices.map(String).slice(0, 8) : [],
    rollRequestId: String(note?.rollRequestId || ""),
    awardId: String(note?.awardId || ""),
    rewardResource: ["experience", "credits", "reverence", "shipCredits"].includes(note?.rewardResource) ? note.rewardResource : "",
    rewardAmount: Math.max(0, Math.round(Number(note?.rewardAmount) || 0)),
    rewardStatus: ["pending", "claimed", "cancelled"].includes(note?.rewardStatus) ? note.rewardStatus : "",
    rewardClaimedAt: note?.rewardClaimedAt || null,
    rewardAppliedAmount: Math.max(0, Math.round(Number(note?.rewardAppliedAmount) || 0)),
    transactionId: String(note?.transactionId || ""),
    deficit: Math.max(0, Number(note?.deficit) || 0),
    reversible: Boolean(note?.reversible),
    message: String(note?.message || "").slice(0, 4000),
    createdAt: note?.createdAt || new Date().toISOString(),
    readAt: note?.readAt || null,
  }));
  campaign.rollRequests = Array.isArray(campaign.rollRequests) ? campaign.rollRequests.slice(-250) : [];
  campaign.npcTemplates = (Array.isArray(campaign.npcTemplates) ? campaign.npcTemplates : []).slice(0, 100).map((template) => ({
    id: String(template?.id || uid("npc-template")).slice(0, 100),
    name: String(template?.name || "Custom NPC").trim().slice(0, 80) || "Custom NPC",
    speed: boundedNumber(template?.speed, 0.1, 100),
    moveSpeed: boundedNumber(template?.moveSpeed, 1, 30),
    maximumHp: Math.round(boundedNumber(template?.maximumHp, 1, 999999)),
    physicalAttribute: Math.round(boundedNumber(template?.physicalAttribute, 2, 20)),
    mentalAttribute: Math.round(boundedNumber(template?.mentalAttribute, 2, 20)),
    physicalSkill: boundedNumber(template?.physicalSkill, 0, 4),
    mentalSkill: boundedNumber(template?.mentalSkill, 0, 4),
    heldWeaponId: String(template?.heldWeaponId || "unarmed").slice(0, 100),
    color: /^#[0-9a-f]{6}$/i.test(String(template?.color || "")) ? String(template.color) : "#39e58f",
  }));
  campaign.sessionNumber = Math.max(0, Math.round(Number(campaign.sessionNumber) || 0));
  trimPrivateNotes(campaign);
  return campaign;
}

function campaignBackup(campaign) {
  return {
    format: "spaceship-architect-campaign",
    version: 1,
    exportedAt: new Date().toISOString(),
    campaign: clone({
      version: campaign.version,
      code: campaign.code,
      name: campaign.name,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      script: campaign.script,
      scriptChapters: campaign.scriptChapters,
      conditionalActions: campaign.conditionalActions,
      characters: campaign.characters,
      joinRequests: campaign.joinRequests,
      settings: campaign.settings,
      shipCredits: campaign.shipCredits,
      bankerCharacterId: campaign.bankerCharacterId,
      awardHistory: campaign.awardHistory,
      itemTransactions: campaign.itemTransactions,
      privateNotes: campaign.privateNotes,
      rollRequests: campaign.rollRequests,
      npcTemplates: campaign.npcTemplates,
      encounter: campaign.encounter,
      sessionNumber: campaign.sessionNumber,
    }),
  };
}

function campaignFromBackup(backup, { code = "", gmCode = null, currentGmCode = null } = {}) {
  if (backup?.format !== "spaceship-architect-campaign" || !backup?.campaign || !Array.isArray(backup.campaign.characters)) return null;
  const restored = normalizeCampaign(clone(backup.campaign));
  restored.code = String(code || restored.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(restored.code)) return null;
  restored.gmCode = currentGmCode || passwordRecord(gmCode);
  restored.updatedAt = new Date().toISOString();
  return restored;
}

function publicCharacter(record, { gm = false, own = false, notes = [] } = {}) {
  return {
    id: record.id,
    pcCode: gm || own ? record.pcCode : undefined,
    approved: record.approved,
    imported: record.imported,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    character: clone(record.character),
    privateNotes: gm || own ? clone(notes) : undefined,
  };
}

function writeEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

class CampaignApi {
  constructor({ store, storageMode, connectedCharacterIds = () => [], restoreEncounter = () => {}, deleteEncounter = () => {} }) {
    this.store = store;
    this.storageMode = storageMode;
    this.connectedCharacterIds = connectedCharacterIds;
    this.restoreEncounter = restoreEncounter;
    this.deleteEncounter = deleteEncounter;
    this.sessions = new Map();
    this.clients = new Map();
    this.campaignCache = new Map();
    this.campaignLoads = new Map();
    this.saveQueues = new Map();
  }

  newSession(code, role, characterId = null) {
    const token = crypto.randomBytes(24).toString("base64url");
    this.sessions.set(token, {
      code,
      role,
      characterId,
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
    });
    return token;
  }

  session(token, code) {
    const record = this.sessions.get(String(token || ""));
    if (!record || record.code !== code || record.expiresAt < Date.now()) {
      if (record) this.sessions.delete(String(token || ""));
      return null;
    }
    record.expiresAt = Date.now() + SESSION_LIFETIME_MS;
    return record;
  }

  gmSession(token, code) {
    const session = this.session(token, code);
    return session?.role === "gm" ? session : null;
  }

  characterSession(token, code, characterId) {
    const session = this.session(token, code);
    if (session?.role === "gm") return session;
    return session?.role === "character" && session.characterId === characterId ? session : null;
  }

  invalidateCharacterSessions(code, characterId) {
    for (const [token, session] of this.sessions) {
      if (session.code === code && session.role === "character" && session.characterId === characterId) {
        this.sessions.delete(token);
      }
    }
  }

  async campaignsNamed(name) {
    const records = await this.store.findByName(name);
    return records.map(normalizeCampaign);
  }

  async campaign(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    if (this.campaignCache.has(normalizedCode)) return this.campaignCache.get(normalizedCode);
    if (!this.campaignLoads.has(normalizedCode)) {
      this.campaignLoads.set(normalizedCode, this.store.get(normalizedCode).then((stored) => {
        const campaign = stored ? normalizeCampaign(stored) : null;
        if (campaign) this.campaignCache.set(normalizedCode, campaign);
        return campaign;
      }).finally(() => this.campaignLoads.delete(normalizedCode)));
    }
    return this.campaignLoads.get(normalizedCode);
  }

  async save(campaign, { broadcast = true } = {}) {
    trimPrivateNotes(campaign);
    this.campaignCache.set(campaign.code, campaign);
    const previous = this.saveQueues.get(campaign.code) || Promise.resolve();
    const queued = previous.catch(() => {}).then(async () => {
      campaign.updatedAt = new Date().toISOString();
      await this.store.save(campaign);
      if (broadcast) await this.broadcast(campaign.code, campaign);
    });
    this.saveQueues.set(campaign.code, queued);
    try {
      await queued;
    } finally {
      if (this.saveQueues.get(campaign.code) === queued) this.saveQueues.delete(campaign.code);
    }
  }

  state(campaign, token = "") {
    const session = this.session(token, campaign.code);
    const gm = session?.role === "gm";
    const ownId = session?.role === "character" ? session.characterId : null;
    const connectedIds = new Set(this.connectedCharacterIds(campaign.code));
    const notesByCharacter = new Map();
    for (const note of campaign.privateNotes) {
      if (!notesByCharacter.has(note.characterId)) notesByCharacter.set(note.characterId, []);
      notesByCharacter.get(note.characterId).push(note);
    }
    const requests = gm
      ? campaign.rollRequests
      : ownId
        ? campaign.rollRequests.filter((request) => request.targetIds.includes(ownId))
        : [];
    return {
      code: campaign.code,
      roomCode: campaign.code,
      name: campaign.name,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      storageMode: this.storageMode,
      role: gm ? "gm" : ownId ? "character" : "viewer",
      ownCharacterId: ownId,
      script: gm ? campaign.script : undefined,
      scriptChapters: gm ? clone(campaign.scriptChapters) : undefined,
      conditionalActions: gm ? clone(campaign.conditionalActions) : undefined,
      shipCredits: campaign.shipCredits,
      sessionNumber: campaign.sessionNumber,
      bankerCharacterId: campaign.bankerCharacterId,
      settings: clone(campaign.settings),
      npcTemplates: gm ? clone(campaign.npcTemplates) : undefined,
      lastAward: gm ? campaign.awardHistory.at(-1) || null : undefined,
      joinRequests: gm ? clone(campaign.joinRequests.filter((request) => request.status === "pending")) : undefined,
      inbox: gm ? clone(campaign.privateNotes.slice(-GM_INBOX_LIMIT)) : undefined,
      characters: campaign.characters.map((record) => ({
        ...publicCharacter(record, {
          gm,
          own: record.id === ownId,
          notes: limitedNotes(notesByCharacter.get(record.id) || [], PLAYER_INBOX_LIMIT),
        }),
        connected: connectedIds.has(record.id),
      })),
      rollRequests: clone(requests.slice(-50)),
    };
  }

  async broadcast(code, campaignValue = null) {
    const campaign = campaignValue || await this.campaign(code);
    if (!campaign) return;
    for (const client of this.clients.get(code) || []) {
      writeEvent(client.response, "campaign", this.state(campaign, client.token));
    }
  }

  async saveEncounter(code, encounter) {
    const campaign = await this.campaign(code);
    if (!campaign) return false;
    campaign.encounter = encounter;
    await this.save(campaign, { broadcast: false });
    return true;
  }

  async getEncounter(code) {
    return (await this.campaign(code))?.encounter || null;
  }

  async healCharacter(code, characterId, amount = 1, source = "Healing") {
    const campaign = await this.campaign(code);
    const record = campaign?.characters.find((entry) => entry.id === characterId);
    if (!record) return null;
    record.character.health ||= { current: 0, permanentBonus: 0 };
    const maximumHp = Math.max(0, Number(record.character.computed?.maximumHp) || Number(record.character.health.current) || 0);
    const beforeHp = Math.max(0, Number(record.character.health.current) || 0);
    const requested = Math.max(0, Number(amount) || 0);
    const currentHp = Math.min(maximumHp, beforeHp + requested);
    const applied = Math.max(0, currentHp - beforeHp);
    record.character.health.current = currentHp;
    record.updatedAt = new Date().toISOString();
    campaign.privateNotes.push({
      id: uid("heal"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "system",
      message: `${String(source || "Healing").slice(0, 160)} restored ${applied} HP. HP: ${currentHp}/${maximumHp}.`, createdAt: record.updatedAt, readAt: null,
    });
    await this.save(campaign);
    return { requested, applied, beforeHp, currentHp, maximumHp, source: String(source || "Healing").slice(0, 160), createdAt: Date.now() };
  }

  async syncCharacterCombatInventory(code, characterId, items = [], statuses = null) {
    const campaign = await this.campaign(code);
    const record = campaign?.characters.find((entry) => entry.id === characterId);
    if (!record) return false;
    record.character.items = Array.isArray(items) ? items.map(normalizeInventoryItem) : [];
    if (statuses && typeof statuses === "object") record.character.statuses = { ...(record.character.statuses || {}), ...statuses };
    record.updatedAt = new Date().toISOString();
    await this.save(campaign);
    return true;
  }

  async damageCharacter(code, characterId, rawDamage = 0, source = "Combat damage", fallback = {}) {
    const campaign = await this.campaign(code);
    const record = campaign?.characters.find((entry) => entry.id === characterId);
    if (!record) return null;
    const savedCurrent = record.character.health?.current;
    record.character.health ||= { current: fallback.currentHp ?? 0, permanentBonus: 0 };
    const maximumHp = Math.max(0, Number(record.character.computed?.maximumHp) || Number(fallback.maximumHp) || Number(savedCurrent) || 0);
    const beforeHp = savedCurrent === null || savedCurrent === undefined
      ? Math.max(0, Number(fallback.currentHp) || maximumHp)
      : Math.max(0, Number(savedCurrent) || 0);
    const incoming = Math.max(0, Number(rawDamage) || 0);
    const savedReduction = record.character.computed?.damageReduction;
    const reduction = Math.max(0, savedReduction === null || savedReduction === undefined ? Number(fallback.damageReduction) || 0 : Number(savedReduction) || 0);
    const applied = Math.max(0, incoming - reduction);
    const currentHp = Math.max(0, beforeHp - applied);
    record.character.health.current = currentHp;
    record.updatedAt = new Date().toISOString();
    const note = {
      id: uid("damage"),
      characterId: record.id,
      characterName: safeCharacterName(record),
      direction: "to-character",
      kind: "damage",
      message: `${String(source || "Combat damage").slice(0, 160)} dealt ${applied} HP damage${reduction ? ` after ${reduction} Damage Reduction` : ""}. HP: ${currentHp}/${maximumHp}.`,
      createdAt: record.updatedAt,
      readAt: null,
    };
    campaign.privateNotes.push(note);
    await this.save(campaign);
    return { id: note.id, rawDamage: incoming, reduction, applied, beforeHp, currentHp, maximumHp, source: String(source || "Combat damage").slice(0, 160), createdAt: Date.now() };
  }

  async setCharacterCombatHp(code, characterId, currentHp = 0) {
    const campaign = await this.campaign(code);
    const record = campaign?.characters.find((entry) => entry.id === characterId);
    if (!record) return false;
    record.character.health ||= { current: 0, permanentBonus: 0 };
    const maximum = Math.max(0, Number(record.character.computed?.maximumHp) || Number(currentHp) || 0);
    record.character.health.current = Math.max(0, Math.min(maximum, Number(currentHp) || 0));
    record.updatedAt = new Date().toISOString();
    await this.save(campaign);
    return true;
  }


  async verifyCharacterAccess(code, characterId, token) {
    return Boolean(this.characterSession(token, code, characterId));
  }

  async verifyGmAccess(code, token) {
    return Boolean(this.gmSession(token, code));
  }

  async handle(req, res, url, readBody, sendJson) {
    const path = url.pathname;
    if (!path.startsWith("/api/campaign/") && path !== "/campaign-events") return false;

    if (path === "/campaign-events" && req.method === "GET") {
      const code = String(url.searchParams.get("code") || "").trim().toUpperCase();
      const campaign = await this.campaign(code);
      if (!campaign) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Campaign not found");
        return true;
      }
      const token = String(url.searchParams.get("token") || "");
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const client = { response: res, token };
      const set = this.clients.get(code) || new Set();
      this.clients.set(code, set);
      set.add(client);
      writeEvent(res, "campaign", this.state(campaign, token));
      const heartbeat = setInterval(() => res.write(`: keep-alive ${Date.now()}\n\n`), 25000);
      req.on("close", () => {
        clearInterval(heartbeat);
        set.delete(client);
      });
      return true;
    }

    let body = {};
    if (req.method !== "GET") {
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Bad JSON" });
        return true;
      }
    }
    const code = String(body.code || url.searchParams.get("code") || "").trim().toUpperCase();
    const token = String(body.token || url.searchParams.get("token") || "");

    if (path === "/api/campaign/create" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const gmCode = String(body.gmCode ?? body.password ?? "");
      if (!name || !gmCode) {
        sendJson(res, 400, { error: "Campaign Name and GM Code are required." });
        return true;
      }
      let campaign;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        campaign = defaultCampaign({ code: campaignCode(), name, gmCode });
        if (await this.store.create(campaign)) break;
        campaign = null;
      }
      if (!campaign) {
        sendJson(res, 503, { error: "A unique campaign code could not be created." });
        return true;
      }
      this.campaignCache.set(campaign.code, campaign);
      const gmToken = this.newSession(campaign.code, "gm");
      sendJson(res, 201, { token: gmToken, campaign: this.state(campaign, gmToken) });
      return true;
    }

    if (path === "/api/campaign/restore-create" && req.method === "POST") {
      const gmCode = String(body.gmCode ?? body.password ?? "");
      const restored = gmCode ? campaignFromBackup(body.backup, { gmCode }) : null;
      if (!restored) {
        sendJson(res, 400, { error: "A valid campaign backup and a new GM Code are required." });
        return true;
      }
      if (!await this.store.create(restored)) {
        sendJson(res, 409, { error: `Campaign ${restored.code} already exists. Open it and use Restore This Campaign instead.` });
        return true;
      }
      this.campaignCache.set(restored.code, restored);
      this.restoreEncounter(restored.code, restored.encounter);
      const gmToken = this.newSession(restored.code, "gm");
      sendJson(res, 201, { token: gmToken, campaign: this.state(restored, gmToken) });
      return true;
    }

    if (path === "/api/campaign/open" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const gmCode = String(body.gmCode ?? body.password ?? "");
      const candidates = name ? await this.campaignsNamed(name) : [];
      const campaign = candidates.find((entry) => passwordMatches(gmCode, entry.gmCode));
      if (!campaign) {
        sendJson(res, 403, { error: "Campaign Name or GM Code is incorrect." });
        return true;
      }
      this.campaignCache.set(campaign.code, campaign);
      const gmToken = this.newSession(campaign.code, "gm");
      sendJson(res, 200, { token: gmToken, campaign: this.state(campaign, gmToken) });
      return true;
    }

    if (path === "/api/campaign/player/open" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const identifier = String(body.identifier ?? body.pcCode ?? "").trim();
      const normalizedIdentifier = identifier.toLocaleLowerCase();
      const candidates = name ? await this.campaignsNamed(name) : [];
      const matches = [];

      for (const candidate of candidates) {
        for (const record of candidate.characters) {
          const identifiers = [
            record.pcCode,
            record.character?.identity?.playerName,
            record.character?.identity?.characterName,
          ].map((value) => String(value || "").trim().toLocaleLowerCase());
          if (!identifiers.includes(normalizedIdentifier)) continue;
          matches.push({ campaign: candidate, record });
        }
      }

      const requestedCampaign = String(body.campaignCode || "").trim().toUpperCase();
      const requestedCharacter = String(body.characterId || "");
      const selectable = matches.filter(({ campaign, record }) =>
        (!requestedCampaign || campaign.code === requestedCampaign)
        && (!requestedCharacter || record.id === requestedCharacter));

      if (!identifier || !selectable.length) {
        sendJson(res, 403, { error: "Campaign Name or character identifier is incorrect." });
        return true;
      }

      if (selectable.length > 1) {
        sendJson(res, 200, {
          requiresSelection: true,
          matches: selectable.map(({ campaign, record }) => ({
            campaignCode: campaign.code,
            characterId: record.id,
            characterName: safeCharacterName(record),
            playerName: String(record.character?.identity?.playerName || "Player"),
          })),
        });
        return true;
      }

      const { campaign, record: match } = selectable[0];
      this.campaignCache.set(campaign.code, campaign);
      const characterToken = this.newSession(campaign.code, "character", match.id);
      sendJson(res, 200, {
        token: characterToken,
        characterId: match.id,
        campaign: this.state(campaign, characterToken),
      });
      return true;
    }

    const campaign = await this.campaign(code);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found." });
      return true;
    }

    if (path === "/api/campaign/state" && req.method === "GET") {
      sendJson(res, 200, this.state(campaign, token));
      return true;
    }

    if (path === "/api/campaign/join/request" && req.method === "POST") {
      const source = body.character && typeof body.character === "object" ? clone(body.character) : null;
      const pcCode = String(body.pcCode || source?.access?.pcCode || "");
      if (!source?.id || source.phase !== "finalized" || !pcCode) {
        sendJson(res, 400, { error: "A finalized character and PC Code are required." });
        return true;
      }
      const codeInUse = campaign.characters.some((entry) => entry.pcCode === pcCode)
        || campaign.joinRequests.some((entry) => entry.status === "pending" && entry.pcCode === pcCode && entry.characterId !== source.id);
      if (codeInUse) {
        sendJson(res, 409, { error: "Error: Please try a different code" });
        return true;
      }
      campaign.joinRequests = campaign.joinRequests.filter((entry) => entry.characterId !== source.id || entry.status === "approved");
      source.access = { ...(source.access || {}), pcCode };
      source.campaignLink = {
        roomCode: campaign.code,
        campaignName: campaign.name,
        status: "pending",
      };
      const request = {
        id: uid("join"),
        characterId: String(source.id),
        pcCode,
        status: "pending",
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
        message: "Awaiting GM approval.",
        character: source,
      };
      campaign.joinRequests.push(request);
      await this.save(campaign);
      sendJson(res, 201, {
        requestId: request.id,
        status: request.status,
        roomCode: campaign.code,
        campaignName: campaign.name,
      });
      return true;
    }

    if (path === "/api/campaign/join/status" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const pcCode = String(body.pcCode || "");
      const linked = campaign.characters.find((entry) => entry.id === characterId && entry.pcCode === pcCode);
      if (linked) {
        const characterToken = this.newSession(code, "character", linked.id);
        sendJson(res, 200, {
          status: "approved",
          token: characterToken,
          characterId: linked.id,
          campaign: this.state(campaign, characterToken),
        });
        return true;
      }
      const request = [...campaign.joinRequests].reverse().find((entry) => entry.characterId === characterId && entry.pcCode === pcCode);
      if (!request) {
        sendJson(res, 404, { error: "No campaign request was found for this character." });
        return true;
      }
      if (request.status === "pending" && body.character && typeof body.character === "object") {
        request.character = clone(body.character);
        request.character.access = { ...(request.character.access || {}), pcCode };
        request.character.campaignLink = { roomCode: campaign.code, campaignName: campaign.name, status: "pending" };
        await this.save(campaign);
      }
      sendJson(res, 200, {
        status: request.status,
        message: request.message,
        roomCode: campaign.code,
        campaignName: campaign.name,
      });
      return true;
    }

    if (path === "/api/campaign/join/cancel" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const pcCode = String(body.pcCode || "");
      const request = [...campaign.joinRequests].reverse().find((entry) => entry.characterId === characterId && entry.pcCode === pcCode);
      const linked = campaign.characters.find((entry) => entry.id === characterId && entry.pcCode === pcCode);
      if (!request && !linked) {
        sendJson(res, 404, { error: "No campaign request was found for this character." });
        return true;
      }
      campaign.joinRequests = campaign.joinRequests.filter((entry) => entry.characterId !== characterId || entry.pcCode !== pcCode);
      if (linked) {
        campaign.characters = campaign.characters.filter((entry) => entry.id !== linked.id);
        campaign.rollRequests = campaign.rollRequests.filter((rollRequest) => !rollRequest.targetIds.includes(linked.id));
        if (campaign.bankerCharacterId === linked.id) campaign.bankerCharacterId = null;
        this.invalidateCharacterSessions(code, linked.id);
      }
      await this.save(campaign);
      sendJson(res, 200, { cancelled: true, approvalVoided: Boolean(linked) });
      return true;
    }

    if (path === "/api/campaign/join/respond" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const request = campaign.joinRequests.find((entry) => entry.id === body.requestId && entry.status === "pending");
      if (!request) {
        sendJson(res, 404, { error: "That join request is no longer pending." });
        return true;
      }
      const approve = body.decision === "approve";
      request.status = approve ? "approved" : "rejected";
      request.resolvedAt = new Date().toISOString();
      request.message = approve
        ? `${campaign.name} approved this character.`
        : `${campaign.name} declined this character's join request.`;
      if (approve) {
        if (campaign.characters.some((entry) => entry.pcCode === request.pcCode)) {
          request.status = "rejected";
          request.message = "Error: Please try a different code";
          await this.save(campaign);
          sendJson(res, 409, { error: request.message });
          return true;
        }
        const source = clone(request.character);
        source.campaignLink = { roomCode: campaign.code, campaignName: campaign.name, status: "linked" };
        source.access = { ...(source.access || {}), pcCode: request.pcCode };
        campaign.characters.push({
          id: request.characterId,
          pcCode: request.pcCode,
          approved: true,
          imported: Boolean(source.imported),
          createdAt: request.requestedAt,
          updatedAt: new Date().toISOString(),
          character: source,
        });
        campaign.privateNotes.push({
          id: uid("note"),
          characterId: request.characterId,
          characterName: safeCharacterName({ character: source }),
          direction: "to-character",
          message: `Your character has been approved for ${campaign.name}.`,
          createdAt: new Date().toISOString(),
          readAt: null,
        });
      }
      await this.save(campaign);
      sendJson(res, 200, { status: request.status, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/backup" && req.method === "GET") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required to download a campaign backup." });
        return true;
      }
      sendJson(res, 200, campaignBackup(campaign));
      return true;
    }

    if (path === "/api/campaign/restore" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required to restore this campaign." });
        return true;
      }
      const backupCode = String(body.backup?.campaign?.code || "").trim().toUpperCase();
      const restored = backupCode === code ? campaignFromBackup(body.backup, { code, currentGmCode: campaign.gmCode }) : null;
      if (!restored) {
        sendJson(res, 400, { error: "That backup does not match this campaign." });
        return true;
      }
      await this.save(restored);
      this.restoreEncounter(code, restored.encounter);
      sendJson(res, 200, { campaign: this.state(restored, token) });
      return true;
    }

    if (path === "/api/campaign/delete" && req.method === "POST") {
      if (!this.gmSession(token, code) || body.campaignName !== campaign.name || !passwordMatches(body.gmCode ?? body.password, campaign.gmCode)) {
        sendJson(res, 403, { error: "GM authorization, the GM Code, and the exact campaign name are required." });
        return true;
      }
      for (const client of this.clients.get(code) || []) {
        const session = this.session(client.token, code);
        const record = session?.role === "character" ? campaign.characters.find((entry) => entry.id === session.characterId) : null;
        writeEvent(client.response, "campaign-deleted", {
          campaignName: campaign.name,
          character: record ? { ...clone(record.character), campaignLink: { roomCode: "", campaignName: "", status: "unlinked" } } : null,
        });
      }
      this.deleteEncounter(code);
      for (const [sessionToken, session] of this.sessions) {
        if (session.code === code) this.sessions.delete(sessionToken);
      }
      await this.store.delete(code);
      this.campaignCache.delete(code);
      this.campaignLoads.delete(code);
      this.saveQueues.delete(code);
      this.clients.delete(code);
      sendJson(res, 200, { deleted: true });
      return true;
    }

    if (path === "/api/campaign/character/create" && req.method === "POST") {
      const source = body.character && typeof body.character === "object" ? clone(body.character) : {};
      const id = String(source.id || uid("character"));
      const pcCode = String(body.pcCode || source?.access?.pcCode || "");
      if (!pcCode || campaign.characters.some((entry) => entry.pcCode === pcCode)) {
        sendJson(res, 409, { error: "Error: Please try a different code" });
        return true;
      }
      source.id = id;
      const record = {
        id,
        pcCode,
        approved: true,
        imported: Boolean(body.imported),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        character: source,
      };
      campaign.characters.push(record);
      await this.save(campaign);
      const characterToken = this.newSession(code, "character", id);
      sendJson(res, 201, { token: characterToken, pcCode: record.pcCode, record: publicCharacter(record, { own: true, notes: [] }) });
      return true;
    }

    if (path === "/api/campaign/character/unlock" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || String(body.pcCode ?? body.pin ?? "") !== record.pcCode) {
        sendJson(res, 403, { error: "PC Code is incorrect." });
        return true;
      }
      const characterToken = this.newSession(code, "character", record.id);
      sendJson(res, 200, { token: characterToken, record: publicCharacter(record, {
        own: true,
        notes: campaign.privateNotes.filter((note) => note.characterId === record.id),
      }) });
      return true;
    }

    if (path === "/api/campaign/item/transaction" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const mode = body.mode === "receive" ? "receive" : "purchase";
      const inventoryType = body.inventoryType === "weapon" ? "weapon" : "item";
      const item = inventoryType === "weapon" ? normalizeWeaponTransaction(body.item) : normalizeInventoryItem(body.item);
      const paid = mode === "purchase" ? item.unitCost : 0;
      record.character.resources ||= {};
      record.character.resources.creditsBase = Math.round(boundedNumber(record.character.resources.creditsBase, -999999999, 999999999));
      if (mode === "purchase") record.character.resources.creditsBase -= paid;
      const added = inventoryType === "weapon" ? applyWeaponTransaction(record.character, item) : addInventoryItem(record.character, item, 1);
      const transaction = {
        id: uid("itemtx"), characterId: record.id, mode, paid, inventoryType,
        item: inventoryType === "weapon" ? { ...item, id: added.id } : { ...item, id: added.id, quantity: 1 },
        createdAt: new Date().toISOString(), deniedAt: null,
      };
      campaign.itemTransactions.push(transaction);
      campaign.itemTransactions = campaign.itemTransactions.slice(-250);
      record.updatedAt = transaction.createdAt;
      const deficit = Math.max(0, -(Number(record.character.resources.creditsBase) || 0));
      campaign.privateNotes.push({
        id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-gm", kind: "item-transaction",
        transactionId: transaction.id, deficit, reversible: true,
        message: `${safeCharacterName(record)} ${mode === "purchase" ? `purchased ${item.name} for ${paid} Credits` : `received ${item.name}`}.${deficit ? ` Their Credit balance is -${deficit}.` : ""}`,
        createdAt: transaction.createdAt, readAt: null,
      });
      await this.save(campaign);
      sendJson(res, 200, { transaction: clone(transaction), campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/item/give" && req.method === "POST") {
      const sender = campaign.characters.find((entry) => entry.id === body.characterId);
      const recipient = campaign.characters.find((entry) => entry.id === body.targetCharacterId);
      if (!sender || !this.characterSession(token, code, sender.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      if (!recipient || recipient.id === sender.id) {
        sendJson(res, 400, { error: "Choose another approved character in this campaign." });
        return true;
      }
      const item = removeStoredInventoryItem(sender.character, String(body.itemId || ""), 1);
      if (!item) {
        sendJson(res, 409, { error: "That item is no longer available in storage." });
        return true;
      }
      addStoredInventoryItem(recipient.character, item, 1);
      const now = new Date().toISOString();
      sender.updatedAt = now;
      recipient.updatedAt = now;
      campaign.privateNotes.push({
        id: uid("note"),
        characterId: recipient.id,
        characterName: safeCharacterName(recipient),
        direction: "to-character",
        kind: "item-activity",
        message: `${safeCharacterName(sender)} gave you 1 ${item.name}. It was placed in Items in Storage.`,
        createdAt: now,
        readAt: null,
      });
      await this.save(campaign);
      sendJson(res, 200, { transferred: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/item/activity" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      campaign.privateNotes.push({
        id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-gm", kind: "item-activity",
        message: String(body.message || `${safeCharacterName(record)} adjusted their inventory.`).slice(0, 1000), createdAt: new Date().toISOString(), readAt: new Date().toISOString(),
      });
      await this.save(campaign);
      sendJson(res, 200, { recorded: true });
      return true;
    }

    if (path === "/api/campaign/item/deny" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const transaction = campaign.itemTransactions.find((entry) => entry.id === body.transactionId);
      const record = campaign.characters.find((entry) => entry.id === transaction?.characterId);
      if (!transaction || !record || transaction.deniedAt) {
        sendJson(res, 409, { error: "That item transaction is no longer available to deny." });
        return true;
      }
      const removed = transaction.inventoryType === "weapon" ? denyWeaponTransaction(record.character, transaction.item) : removeInventoryItem(record.character, transaction.item.id, transaction.item, 1);
      if (!removed) {
        sendJson(res, 409, { error: "That item or weapon is no longer in the character's inventory." });
        return true;
      }
      record.character.resources ||= {};
      record.character.resources.creditsBase = Math.round(boundedNumber(record.character.resources.creditsBase, -999999999, 999999999)) + Number(transaction.paid || 0);
      transaction.deniedAt = new Date().toISOString();
      const note = campaign.privateNotes.find((entry) => entry.transactionId === transaction.id);
      if (note) { note.reversible = false; note.message += " DENIED BY GM."; note.readAt ||= transaction.deniedAt; }
      campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "item-transaction", message: `The GM denied ${transaction.item.name}. It was removed${transaction.paid ? ` and ${transaction.paid} Credits were refunded` : ""}.`, createdAt: transaction.deniedAt, readAt: null });
      record.updatedAt = transaction.deniedAt;
      await this.save(campaign);
      sendJson(res, 200, { denied: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/item/cover-deficit" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record) { sendJson(res, 404, { error: "Character not found." }); return true; }
      record.character.resources ||= {};
      const current = Number(record.character.resources.creditsBase) || 0;
      const amount = Math.max(0, -current);
      record.character.resources.creditsBase = current + amount;
      campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "award", message: `The GM awarded ${amount} Credits to cover your negative balance.`, createdAt: new Date().toISOString(), readAt: null });
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { amount, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/item/recharge" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const targetIds = Array.isArray(body.targetIds) ? body.targetIds.map(String) : [];
      let recharged = 0;
      for (const record of campaign.characters.filter((entry) => targetIds.includes(entry.id))) {
        const names = [];
        for (const item of Array.isArray(record.character.items) ? record.character.items : []) {
          if (!["jet-pack", "power-shields", "mobile-zero-point-energy"].includes(item.catalogId)) continue;
          if (item.chargesMax !== null && item.chargesMax !== undefined) item.charges = item.chargesMax;
          if (item.catalogId === "mobile-zero-point-energy") item.chargeState = "Full";
          names.push(item.name);
          recharged += 1;
        }
        if (names.length) campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "recharge", message: `GM recharge restored: ${names.join(", ")}.`, createdAt: new Date().toISOString(), readAt: null });
        record.updatedAt = new Date().toISOString();
      }
      await this.save(campaign);
      sendJson(res, 200, { recharged, campaign: this.state(campaign, token) });
      return true;
    }


    if (path === "/api/campaign/character/save" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character editing authorization is required." });
        return true;
      }
      if (!body.character || typeof body.character !== "object") {
        sendJson(res, 400, { error: "Character data is required." });
        return true;
      }
      const next = clone(body.character);
      next.id = record.id;
      next.resources ||= {};
      next.health ||= { current: null, permanentBonus: 0 };
      const serverCredits = Number(record.character?.resources?.creditsBase) || 0;
      const submittedCredits = Number(next.resources.creditsBase) || 0;
      const baseCredits = Number(body.baseCredits);
      next.resources.creditsBase = Number.isFinite(baseCredits)
        ? Math.round(boundedNumber(serverCredits + (submittedCredits - baseCredits), -999999999, 999999999))
        : Math.round(boundedNumber(submittedCredits, -999999999, 999999999));
      const serverHp = record.character?.health?.current === null || record.character?.health?.current === undefined
        ? Number(record.character?.computed?.maximumHp) || Number(next.computed?.maximumHp) || 0
        : Number(record.character.health.current) || 0;
      const submittedHp = Number(next.health.current);
      const baseCurrentHp = body.baseCurrentHp === null || body.baseCurrentHp === undefined
        ? Number.NaN
        : Number(body.baseCurrentHp);
      const nextMaximumHp = Math.max(0, Number(next.computed?.maximumHp) || 0);
      next.health.current = Number.isFinite(baseCurrentHp) && Number.isFinite(submittedHp)
        ? Math.round(boundedNumber(serverHp + (submittedHp - baseCurrentHp), -9999, nextMaximumHp))
        : Math.round(boundedNumber(submittedHp, -9999, nextMaximumHp));
      record.character = next;
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { saved: true, updatedAt: record.updatedAt, creditsBase: next.resources.creditsBase, currentHp: next.health.current });
      return true;
    }

    if ((path === "/api/campaign/character/change-pc-code" || path === "/api/campaign/character/change-pin") && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      const pcCode = String(body.pcCode ?? body.pin ?? "");
      if (!record || !this.characterSession(token, code, record.id) || !pcCode) {
        sendJson(res, 403, { error: "Authorization and a PC Code are required." });
        return true;
      }
      if (campaign.characters.some((entry) => entry.id !== record.id && entry.pcCode === pcCode)) {
        sendJson(res, 409, { error: "Error: Please try a different code" });
        return true;
      }
      record.pcCode = pcCode;
      record.character.access = { ...(record.character.access || {}), pcCode };
      await this.save(campaign);
      sendJson(res, 200, { changed: true, pcCode: record.pcCode });
      return true;
    }

    if (path === "/api/campaign/character/delete" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      campaign.characters = campaign.characters.filter((entry) => entry.id !== record.id);
      campaign.privateNotes = campaign.privateNotes.filter((note) => note.characterId !== record.id);
      campaign.rollRequests = campaign.rollRequests.filter((request) => !request.targetIds.includes(record.id));
      if (campaign.bankerCharacterId === record.id) campaign.bankerCharacterId = null;
      await this.save(campaign);
      sendJson(res, 200, { deleted: true });
      return true;
    }

    if (path === "/api/campaign/character/leave" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const detachedCharacter = clone(record.character);
      detachedCharacter.campaignLink = { roomCode: "", campaignName: "", status: "unlinked" };
      campaign.characters = campaign.characters.filter((entry) => entry.id !== record.id);
      campaign.rollRequests = campaign.rollRequests.filter((request) => !request.targetIds.includes(record.id));
      if (campaign.bankerCharacterId === record.id) campaign.bankerCharacterId = null;
      campaign.privateNotes.push({
        id: uid("note"),
        characterId: record.id,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "system",
        message: `${safeCharacterName(record)} left the campaign.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      this.invalidateCharacterSessions(code, record.id);
      await this.save(campaign);
      sendJson(res, 200, { left: true, character: detachedCharacter });
      return true;
    }

    if (path === "/api/campaign/character/kick" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record) {
        sendJson(res, 404, { error: "Character not found." });
        return true;
      }
      campaign.characters = campaign.characters.filter((entry) => entry.id !== record.id);
      campaign.rollRequests = campaign.rollRequests.filter((request) => !request.targetIds.includes(record.id));
      if (campaign.bankerCharacterId === record.id) campaign.bankerCharacterId = null;
      campaign.privateNotes.push({
        id: uid("note"),
        characterId: record.id,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "system",
        message: `${safeCharacterName(record)} was removed from the campaign by the GM.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      this.invalidateCharacterSessions(code, record.id);
      await this.save(campaign);
      sendJson(res, 200, { kicked: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/character/approve" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record) {
        sendJson(res, 404, { error: "Character not found." });
        return true;
      }
      record.approved = true;
      await this.save(campaign);
      sendJson(res, 200, { approved: true });
      return true;
    }

    if (path === "/api/campaign/settings" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      campaign.settings ||= { commandWindowBonus: 0 };
      campaign.settings.commandWindowBonus = Math.round(boundedNumber(body.commandWindowBonus, 0, 3600));
      await this.save(campaign);
      sendJson(res, 200, { campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/npc-templates" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      campaign.npcTemplates = normalizeCampaign({ npcTemplates: body.templates }).npcTemplates;
      await this.save(campaign);
      sendJson(res, 200, { campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/script/save" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const chapter = campaign.scriptChapters.find((entry) => entry.id === String(body.chapterId || ""))
        || campaign.scriptChapters[0];
      if (!chapter) {
        sendJson(res, 404, { error: "Script chapter not found." });
        return true;
      }
      chapter.script = String(body.script || "").slice(0, MAX_SCRIPT_LENGTH);
      await this.save(campaign);
      sendJson(res, 200, { saved: true, updatedAt: campaign.updatedAt });
      return true;
    }

    if (path === "/api/campaign/script/chapter" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const action = String(body.action || "");
      if (action === "add") {
        const nextNumber = campaign.scriptChapters.length + 1;
        campaign.scriptChapters.push({ id: uid("chapter"), name: `Chapter ${nextNumber}`, script: "" });
      } else {
        const chapter = campaign.scriptChapters.find((entry) => entry.id === String(body.chapterId || ""));
        if (!chapter) {
          sendJson(res, 404, { error: "Script chapter not found." });
          return true;
        }
        if (action === "rename") {
          chapter.name = String(body.name || chapter.name).trim().slice(0, 80) || chapter.name;
        } else if (action === "delete") {
          if (campaign.scriptChapters.length <= 1) {
            sendJson(res, 409, { error: "Every campaign must retain at least one script chapter." });
            return true;
          }
          campaign.scriptChapters = campaign.scriptChapters.filter((entry) => entry.id !== chapter.id);
        } else {
          sendJson(res, 400, { error: "Choose add, rename, or delete." });
          return true;
        }
      }
      campaign.script = campaign.scriptChapters[0].script;
      await this.save(campaign);
      sendJson(res, 200, { campaign: this.state(campaign, token) });
      return true;
    }
    if (path === "/api/campaign/conditional-action" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const operation = String(body.operation || "save");
      const actionId = String(body.id || "");
      if (operation === "delete") {
        const before = campaign.conditionalActions.length;
        campaign.conditionalActions = campaign.conditionalActions.filter((entry) => entry.id !== actionId);
        if (campaign.conditionalActions.length === before) {
          sendJson(res, 404, { error: "Conditional action not found." });
          return true;
        }
        await this.save(campaign);
        sendJson(res, 200, { campaign: this.state(campaign, token) });
        return true;
      }
      const keyword = String(body.keyword || "").trim().slice(0, 60);
      const kind = body.kind === "award" ? "award" : "message";
      const message = String(body.message || "").trim().slice(0, 4000);
      const resource = ["experience", "credits", "reverence", "shipCredits"].includes(body.resource) ? body.resource : "experience";
      const amount = Math.round(boundedNumber(body.amount, 0, 999999999));
      const attribute = String(body.attribute || "").trim().slice(0, 40);
      const skill = String(body.skill || "").trim().slice(0, 80);
      const difficulty = Number(body.difficulty);
      if (!keyword || !attribute || !skill || !Number.isFinite(difficulty) || difficulty < 0 || (kind === "message" ? !message : amount < 1)) {
        sendJson(res, 400, { error: "Keyword, Attribute, Skill, Difficulty, and the selected delivery are required." });
        return true;
      }
      const duplicate = campaign.conditionalActions.find((entry) => entry.id !== actionId && entry.keyword.toLowerCase() === keyword.toLowerCase());
      if (duplicate) {
        sendJson(res, 409, { error: "That keyword is already assigned to another conditional action." });
        return true;
      }
      const next = { id: actionId || uid("conditional"), keyword, kind, message, resource, amount, attribute, skill, difficulty, hideDifficulty: Boolean(body.hideDifficulty) };
      const index = campaign.conditionalActions.findIndex((entry) => entry.id === actionId);
      if (index >= 0) campaign.conditionalActions[index] = next;
      else campaign.conditionalActions.push(next);
      await this.save(campaign);
      sendJson(res, 200, { action: clone(next), campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/session/end" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const endedSession = campaign.sessionNumber;
      const sessionZeroCreditAdjustment = endedSession === 0;
      const interestAdjustedCredits = (value) => {
        const current = Math.round(Number(value) || 0);
        const adjustedMagnitude = Math.ceil(Math.abs(current) * 1.2);
        return current < 0 ? -adjustedMagnitude : adjustedMagnitude;
      };
      const groupCreditsBefore = Number(campaign.shipCredits) || 0;
      if (sessionZeroCreditAdjustment) campaign.shipCredits = interestAdjustedCredits(groupCreditsBefore);
      campaign.privateNotes = campaign.privateNotes.filter((note) => !["session-end", "science-choice"].includes(note.kind));
      for (const record of campaign.characters) {
        const personalCreditsBefore = Number(record.character?.resources?.creditsBase) || 0;
        if (sessionZeroCreditAdjustment) record.character.resources.creditsBase = interestAdjustedCredits(personalCreditsBefore);
        record.character.statuses ||= {};
        record.character.statuses.intoxicated = false;
        record.character.session = {
          number: endedSession + 1,
          freeRerollsUsed: {},
          marineHealingUsed: false,
          psychopathAwardsUsed: 0,
          tacticianReverenceGiven: 0,
          peacekeeperDramaCardsEarned: 0,
        };
        campaign.privateNotes.push({
          id: uid("note"),
          characterId: record.id,
          characterName: safeCharacterName(record),
          direction: "to-character",
          kind: "session-end",
          choices: [],
          message: sessionZeroCreditAdjustment
            ? `Session 0 ended. Session abilities have been reset. Personal Credits: ${personalCreditsBefore.toLocaleString()} -> ${record.character.resources.creditsBase.toLocaleString()}. Group Credits: ${groupCreditsBefore.toLocaleString()} -> ${campaign.shipCredits.toLocaleString()}. The 20% Session 0 credit adjustment has been applied.`
            : `Session ${endedSession} ended. Session abilities have been reset.`,
          createdAt: new Date().toISOString(),
          readAt: null,
        });
        if (record.character?.identity?.classId === "science-officer") {
          campaign.privateNotes.push({
            id: uid("note"),
            characterId: record.id,
            characterName: safeCharacterName(record),
            direction: "to-character",
            kind: "science-choice",
            choices: ["Research", "Science/Physics", "Mathematics"],
            message: `Session ${endedSession}: choose one Science Officer Skill to increase by +0.1.`,
            createdAt: new Date().toISOString(),
            readAt: null,
          });
        }
        record.updatedAt = new Date().toISOString();
      }
      campaign.sessionNumber += 1;
      await this.save(campaign);
      sendJson(res, 200, { sessionEnded: endedSession, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/session/science-choice" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const record = campaign.characters.find((entry) => entry.id === characterId);
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId && entry.characterId === characterId && entry.kind === "science-choice");
      const skill = String(body.skill || "");
      if (!record || !note || !this.characterSession(token, code, characterId) || !note.choices.includes(skill)) {
        sendJson(res, 403, { error: "That Science Officer choice is no longer available." });
        return true;
      }
      record.character.skills ||= {};
      record.character.skills[skill] ||= { tenths: 0, creationDecimal: null };
      record.character.skills[skill].tenths = Math.max(0, Math.round(Number(record.character.skills[skill].tenths) || 0) + 1);
      record.updatedAt = new Date().toISOString();
      campaign.privateNotes = campaign.privateNotes.filter((entry) => entry.id !== note.id);
      campaign.privateNotes.push({
        id: uid("note"), characterId, characterName: safeCharacterName(record), direction: "to-character", kind: "system", choices: [],
        message: `${skill} increased by +0.1 from the Science Officer session benefit.`, createdAt: new Date().toISOString(), readAt: null,
      });
      await this.save(campaign);
      sendJson(res, 200, { applied: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/class-action" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      const action = String(body.action || "");
      if (!record) {
        sendJson(res, 404, { error: "Character not found." });
        return true;
      }
      const classId = record.character?.identity?.classId;
      record.character.experience ||= { available: 0, spent: 0, totalGained: 0 };
      record.character.resources ||= {};
      record.character.session ||= { freeRerollsUsed: {}, psychopathAwardsUsed: 0, tacticianReverenceGiven: 0, peacekeeperDramaCardsEarned: 0 };
      let message = "";
      if (action === "playboy-reward" && classId === "playboy-minx") {
        record.character.experience.available = (Number(record.character.experience.available) || 0) + 5;
        record.character.experience.totalGained = (Number(record.character.experience.totalGained) || 0) + 5;
        record.character.resources.reverence = Math.min(10, (Number(record.character.resources.reverence) || 0) + 1);
        message = "Class reward: +5 Experience and +1 Reverence.";
      } else if (action === "psychopath-reward" && classId === "psychopath") {
        if ((Number(record.character.session.psychopathAwardsUsed) || 0) >= 3) {
          sendJson(res, 409, { error: "Psychopath has already received three kill rewards this session." });
          return true;
        }
        record.character.session.psychopathAwardsUsed = (Number(record.character.session.psychopathAwardsUsed) || 0) + 1;
        record.character.experience.available = (Number(record.character.experience.available) || 0) + 8;
        record.character.experience.totalGained = (Number(record.character.experience.totalGained) || 0) + 8;
        message = `Psychopath kill reward ${record.character.session.psychopathAwardsUsed}/3: +8 Experience.`;
      } else if (action === "peacekeeper-reward" && classId === "peacekeeper") {
        if ((Number(record.character.session.peacekeeperDramaCardsEarned) || 0) >= 2) {
          sendJson(res, 409, { error: "Peacekeeper has already earned two Drama Cards this session." });
          return true;
        }
        record.character.session.peacekeeperDramaCardsEarned = (Number(record.character.session.peacekeeperDramaCardsEarned) || 0) + 1;
        record.character.resources.dramaCards = (Number(record.character.resources.dramaCards) || 0) + 1;
        message = `Peacekeeper reward ${record.character.session.peacekeeperDramaCardsEarned}/2: +1 Drama Card for preventing combat.`;
      } else {
        sendJson(res, 400, { error: "That class action is unavailable." });
        return true;
      }
      record.updatedAt = new Date().toISOString();
      campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "award", choices: [], message, createdAt: new Date().toISOString(), readAt: null });
      await this.save(campaign);
      sendJson(res, 200, { applied: true, message, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/award" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const resource = String(body.resource || "");
      const amount = Math.round(Number(body.amount) || 0);
      const targetIds = [...new Set(Array.isArray(body.targetIds) ? body.targetIds.map(String) : [])];
      const androidExperienceIds = new Set(Array.isArray(body.androidExperienceIds) ? body.androidExperienceIds.map(String) : []);
      if (!amount || !["experience", "credits", "reverence", "shipCredits"].includes(resource)) {
        sendJson(res, 400, { error: "A resource and non-zero amount are required." });
        return true;
      }
      const targetRecords = resource === "shipCredits"
        ? []
        : campaign.characters.filter((entry) => targetIds.includes(entry.id));
      if (resource !== "shipCredits" && !targetRecords.length) {
        sendJson(res, 400, { error: "At least one campaign character is required." });
        return true;
      }
      const claimRequired = resource !== "shipCredits" && amount > 0;
      const before = { shipCredits: campaign.shipCredits, characters: [] };
      if (resource === "shipCredits") {
        campaign.shipCredits = Math.round(boundedNumber(campaign.shipCredits + amount, 0, 999999999999));
      } else if (!claimRequired) {
        for (const record of targetRecords) {
          const result = applyCharacterReward(record, { resource, amount, androidExperienceIds: [...androidExperienceIds] });
          before.characters.push(result.before);
        }
      }
      const award = {
        id: uid("award"),
        resource,
        amount,
        targetIds,
        before,
        at: new Date().toISOString(),
        claimRequired,
        claimedCharacterIds: claimRequired ? [] : targetRecords.map((record) => record.id),
        androidExperienceIds: [...androidExperienceIds],
      };
      if (resource !== "shipCredits") {
        const label = rewardLabel(resource);
        const verb = amount > 0 ? "awarded" : "adjusted";
        for (const record of targetRecords) {
          const convertedAndroidAward = resource === "credits" && amount > 0 && record.character.identity?.raceId === "android" && androidExperienceIds.has(record.id);
          const androidExperience = convertedAndroidAward ? Math.max(0, Math.floor(amount / 75)) : 0;
          campaign.privateNotes.push({
            id: uid("note"),
            characterId: record.id,
            characterName: safeCharacterName(record),
            direction: "to-character",
            kind: "award",
            awardId: award.id,
            rewardResource: claimRequired ? resource : "",
            rewardAmount: claimRequired ? Math.abs(amount) : 0,
            rewardStatus: claimRequired ? "pending" : "",
            message: claimRequired
              ? convertedAndroidAward
                ? `The GM sent a reward worth ${Math.abs(amount).toLocaleString()} Credits, convertible into ${androidExperience} Android Experience.`
                : `The GM sent ${Math.abs(amount).toLocaleString()} ${label}. Claim this reward when you are ready.`
              : `The GM ${verb} ${Math.abs(amount).toLocaleString()} ${label}.`,
            createdAt: award.at,
            readAt: null,
          });
        }
      }
      campaign.awardHistory.push(award);
      trimAwardHistory(campaign);
      await this.save(campaign);
      sendJson(res, 200, { award: clone(award), campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/award/claim" && req.method === "POST") {
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId && entry.kind === "award");
      if (!note || !this.characterSession(token, code, note.characterId)) {
        sendJson(res, 403, { error: "That reward is not available to this character." });
        return true;
      }
      if (note.rewardStatus === "claimed") {
        sendJson(res, 200, { claimed: true, alreadyClaimed: true, campaign: this.state(campaign, token) });
        return true;
      }
      if (note.rewardStatus !== "pending") {
        sendJson(res, 409, { error: "That reward is no longer available." });
        return true;
      }
      const award = campaign.awardHistory.find((entry) => entry.id === note.awardId && entry.claimRequired);
      const record = campaign.characters.find((entry) => entry.id === note.characterId);
      if (!award || !record || !award.targetIds.includes(record.id)) {
        sendJson(res, 409, { error: "That reward has expired or was reversed by the GM." });
        return true;
      }
      award.claimedCharacterIds ||= [];
      if (award.claimedCharacterIds.includes(record.id)) {
        note.rewardStatus = "claimed";
        note.rewardClaimedAt ||= new Date().toISOString();
        await this.save(campaign);
        sendJson(res, 200, { claimed: true, alreadyClaimed: true, campaign: this.state(campaign, token) });
        return true;
      }

      const result = award.resource === "shipCredits"
        ? (() => {
            const before = characterRewardSnapshot(record);
            const previous = Number(campaign.shipCredits) || 0;
            campaign.shipCredits = Math.round(boundedNumber(previous + award.amount, -999999999999, 999999999999));
            award.before ||= { shipCredits: previous, characters: [] };
            award.before.shipCredits = previous;
            return {
              before,
              appliedAmount: campaign.shipCredits - previous,
              appliedResource: "shipCredits",
              messageDetail: " Added to the shared Group Credits pool.",
            };
          })()
        : applyCharacterReward(record, award);
      award.before ||= { shipCredits: campaign.shipCredits, characters: [] };
      award.before.characters ||= [];
      award.before.characters.push(result.before);
      award.claimedCharacterIds.push(record.id);
      note.rewardStatus = "claimed";
      note.rewardClaimedAt = new Date().toISOString();
      note.rewardAppliedAmount = Math.max(0, result.appliedAmount);
      note.readAt = note.rewardClaimedAt;
      const appliedLabel = rewardLabel(result.appliedResource);
      note.message = result.appliedAmount > 0
        ? `Received ${result.appliedAmount.toLocaleString()} ${appliedLabel}.${result.messageDetail}`
        : `Reward processed.${result.messageDetail || " No points were added."}`;
      trimAwardHistory(campaign);
      await this.save(campaign);
      sendJson(res, 200, {
        claimed: true,
        resource: result.appliedResource,
        appliedAmount: result.appliedAmount,
        campaign: this.state(campaign, token),
      });
      return true;
    }

    if (path === "/api/campaign/award/undo" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const award = campaign.awardHistory.pop();
      if (!award) {
        sendJson(res, 400, { error: "There is no award to undo." });
        return true;
      }
      if (award.resource === "shipCredits") campaign.shipCredits = award.before.shipCredits;
      for (const snapshot of award.before.characters || []) {
        const record = campaign.characters.find((entry) => entry.id === snapshot.id);
        if (!record) continue;
        record.character.experience = snapshot.experience;
        record.character.resources ||= {};
        record.character.resources.creditsBase = snapshot.creditsBase;
        record.character.resources.reverence = snapshot.reverence;
        record.updatedAt = new Date().toISOString();
      }
      campaign.privateNotes = campaign.privateNotes.filter((note) => !(note.awardId === award.id && note.rewardStatus === "pending"));
      if (award.resource !== "shipCredits") {
        const label = rewardLabel(award.resource);
        for (const snapshot of award.before.characters || []) {
          const record = campaign.characters.find((entry) => entry.id === snapshot.id);
          if (!record) continue;
          campaign.privateNotes.push({
            id: uid("note"),
            characterId: record.id,
            characterName: safeCharacterName(record),
            direction: "to-character",
            kind: "system",
            awardId: award.id,
            message: `The GM reversed the most recent ${label} award. Your balance has been restored.`,
            createdAt: new Date().toISOString(),
            readAt: null,
          });
        }
      }
      await this.save(campaign);
      sendJson(res, 200, { undone: award.id, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/note/send" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const message = String(body.message || "").trim().slice(0, 4000);
      const targetIds = [...new Set(Array.isArray(body.targetIds) ? body.targetIds.map(String) : [])];
      if (!message || !targetIds.length) {
        sendJson(res, 400, { error: "A private note and at least one character are required." });
        return true;
      }
      const notes = targetIds.filter((targetId) => campaign.characters.some((entry) => entry.id === targetId)).map((characterId) => ({
        id: uid("note"),
        characterId,
        characterName: safeCharacterName(campaign.characters.find((entry) => entry.id === characterId)),
        direction: "to-character",
        kind: "message",
        message,
        createdAt: new Date().toISOString(),
        readAt: null,
      }));
      campaign.privateNotes.push(...notes);
      await this.save(campaign);
      sendJson(res, 200, { sent: notes.length });
      return true;
    }

    if (path === "/api/campaign/note/send-to-gm" && req.method === "POST") {
      const characterId = String(body.characterId || "");
      const record = campaign.characters.find((entry) => entry.id === characterId);
      if (!record || !this.characterSession(token, code, characterId)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const message = String(body.message || "").trim().slice(0, 1000);
      if (!message) {
        sendJson(res, 400, { error: "Type a message first." });
        return true;
      }
      const note = {
        id: uid("note"),
        characterId,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "message",
        message,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      campaign.privateNotes.push(note);
      await this.save(campaign);
      sendJson(res, 201, { sent: true, note: clone(note) });
      return true;
    }

    if (path === "/api/campaign/note/gm-read" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId && entry.direction === "to-gm");
      if (note) note.readAt ||= new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { read: Boolean(note), readAt: note?.readAt || null });
      return true;
    }

    if (path === "/api/campaign/note/read" && req.method === "POST") {
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId);
      if (!note || !this.characterSession(token, code, note.characterId)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      note.readAt ||= new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { read: true, readAt: note.readAt });
      return true;
    }

    if (path === "/api/campaign/note/delete" && req.method === "POST") {
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId);
      if (!note || !this.characterSession(token, code, note.characterId)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      campaign.privateNotes = campaign.privateNotes.filter((entry) => entry.id !== note.id);
      await this.save(campaign);
      sendJson(res, 200, { deleted: true });
      return true;
    }

    if (path === "/api/campaign/roll/request" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      let targetIds = [...new Set(Array.isArray(body.targetIds) ? body.targetIds.map(String) : [])];
      if (body.connectedOnly) {
        const connected = new Set(this.connectedCharacterIds(code));
        targetIds = targetIds.filter((targetId) => connected.has(targetId));
      }
      targetIds = targetIds.filter((targetId) => campaign.characters.some((entry) => entry.id === targetId));
      if (!targetIds.length || !body.attribute || !body.skill) {
        sendJson(res, 400, { error: "At least one connected target, an Attribute, and a Skill are required." });
        return true;
      }
      const difficulty = body.difficulty === "" || body.difficulty === null || body.difficulty === undefined
        ? null
        : Number(body.difficulty);
      const completionAction = campaign.conditionalActions.find((entry) => entry.id === String(body.completionActionId || "")) || null;
      const request = {
        id: uid("roll"),
        source: String(body.source || "GM Prompt").slice(0, 160),
        attribute: String(body.attribute).slice(0, 40),
        skill: String(body.skill).slice(0, 80),
        difficulty: Number.isFinite(difficulty) ? difficulty : null,
        hideDifficulty: Boolean(body.hideDifficulty),
        targetIds,
        completionActionId: completionAction?.id || "",
        results: {},
        createdAt: new Date().toISOString(),
        closedAt: null,
      };
      campaign.rollRequests.push(request);
      for (const characterId of targetIds) {
        const record = campaign.characters.find((entry) => entry.id === characterId);
        if (!record) continue;
        const difficultyText = request.hideDifficulty
          ? "Hidden Difficulty"
          : request.difficulty === null ? "No Difficulty" : `Difficulty ${request.difficulty}`;
        campaign.privateNotes.push({
          id: uid("note"),
          characterId,
          characterName: safeCharacterName(record),
          direction: "to-character",
          kind: "roll-request",
          rollRequestId: request.id,
          message: `Roll requested: ${request.attribute} + ${request.skill} (${difficultyText}).`,
          createdAt: request.createdAt,
          readAt: null,
        });
      }
      await this.save(campaign);
      sendJson(res, 201, { request: clone(request) });
      return true;
    }

    if (path === "/api/campaign/roll/respond" && req.method === "POST") {
      const request = campaign.rollRequests.find((entry) => entry.id === body.requestId && !entry.closedAt);
      const characterId = String(body.characterId || "");
      if (!request || !request.targetIds.includes(characterId) || !this.characterSession(token, code, characterId)) {
        sendJson(res, 403, { error: "This roll request is not available to that character." });
        return true;
      }
      if (request.results[characterId]) {
        sendJson(res, 409, { error: "This character has already answered that roll request." });
        return true;
      }
      const submittedScore = Number(body.score) || 0;
      request.results[characterId] = {
        score: submittedScore,
        mode: body.mode === "manual" ? "manual" : "automatic",
        diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number) : [],
        outcome: String(body.outcome || "").slice(0, 40),
        respondedAt: new Date().toISOString(),
      };
      campaign.privateNotes = campaign.privateNotes.filter((note) => !(note.rollRequestId === request.id && note.characterId === characterId));
      const completionAction = campaign.conditionalActions.find((entry) => entry.id === request.completionActionId);
      const succeeded = request.difficulty !== null && submittedScore >= Number(request.difficulty);
      const delivery = completionAction && succeeded
        ? applyConditionalDelivery(campaign, campaign.characters.find((entry) => entry.id === characterId), completionAction)
        : null;
      request.results[characterId].conditionalDelivery = delivery;
      trimPrivateNotes(campaign);
      await this.save(campaign);
      sendJson(res, 200, { recorded: true, succeeded, delivery });
      return true;
    }

    if (path === "/api/campaign/roll/close" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const request = campaign.rollRequests.find((entry) => entry.id === body.requestId);
      if (request) {
        request.closedAt = new Date().toISOString();
        campaign.privateNotes = campaign.privateNotes.filter((note) => note.rollRequestId !== request.id);
      }
      await this.save(campaign);
      sendJson(res, 200, { closed: Boolean(request) });
      return true;
    }

    if (path === "/api/campaign/banker" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      campaign.bankerCharacterId = campaign.characters.some((entry) => entry.id === body.characterId)
        ? body.characterId
        : null;
      await this.save(campaign);
      sendJson(res, 200, { bankerCharacterId: campaign.bankerCharacterId });
      return true;
    }

    if (path === "/api/campaign/credits/transfer" && req.method === "POST") {
      const actor = campaign.characters.find((entry) => entry.id === body.characterId);
      const session = this.session(token, code);
      const gm = session?.role === "gm";
      const ownsActor = session?.role === "character" && session.characterId === actor?.id;
      const operation = String(body.operation || "");
      const amount = Math.round(Number(body.amount) || 0);
      const target = campaign.characters.find((entry) => entry.id === body.targetCharacterId);
      if (!actor || (!gm && !ownsActor)) {
        sendJson(res, 403, { error: "Unlock this character before transferring credits." });
        return true;
      }
      const validOperations = ["deposit", "withdraw", "giftPersonal", "giftShip", "mechanicalExperience", "giftReverence", "roboticsGrant"];
      if (amount < 1 || !validOperations.includes(operation)) {
        sendJson(res, 400, { error: "Choose a valid transfer and a positive whole-credit amount." });
        return true;
      }
      const usesPool = ["deposit", "withdraw", "giftShip"].includes(operation);
      if (usesPool && !gm && campaign.bankerCharacterId && campaign.bankerCharacterId !== actor.id) {
        sendJson(res, 403, { error: "Only the campaign banker may transfer credits to or from Group Credits." });
        return true;
      }
      if (["giftPersonal", "giftShip", "mechanicalExperience", "giftReverence", "roboticsGrant"].includes(operation) && (!target || target.id === actor.id)) {
        sendJson(res, 400, { error: "Choose another campaign character to receive those credits." });
        return true;
      }
      actor.character.resources ||= {};
      actor.character.resources.creditsBase = Math.round(boundedNumber(actor.character.resources.creditsBase, 0, 999999999));
      if (target) {
        target.character.resources ||= {};
        target.character.resources.creditsBase = Math.round(boundedNumber(target.character.resources.creditsBase, 0, 999999999));
      }
      if (["deposit", "giftPersonal", "mechanicalExperience"].includes(operation) && actor.character.resources.creditsBase < amount) {
        sendJson(res, 400, { error: "That character does not have enough personal credits." });
        return true;
      }
      if (["withdraw", "giftShip"].includes(operation) && campaign.shipCredits < amount) {
        sendJson(res, 400, { error: "Group Credits do not contain enough funds." });
        return true;
      }
      if (operation === "deposit") {
        actor.character.resources.creditsBase -= amount;
        campaign.shipCredits += amount;
      } else if (operation === "withdraw") {
        campaign.shipCredits -= amount;
        actor.character.resources.creditsBase += amount;
      } else if (operation === "giftPersonal") {
        actor.character.resources.creditsBase -= amount;
        target.character.resources.creditsBase += amount;
      } else if (operation === "giftShip") {
        campaign.shipCredits -= amount;
        target.character.resources.creditsBase += amount;
      } else if (operation === "mechanicalExperience") {
        const targetRace = target.character.identity?.raceId;
        if (!["android", "spiddix"].includes(targetRace)) {
          sendJson(res, 400, { error: "Mechanical Experience may only be purchased for an Android or Spiddix." });
          return true;
        }
        const roboticsDiscount = actor.character.identity?.classId === "robotics-worker" ? 25 : 0;
        const rate = (targetRace === "android" ? 75 : 100) - roboticsDiscount;
        if (amount < rate || amount % rate !== 0) {
          sendJson(res, 400, { error: `Enter a Credit amount divisible by ${rate}. Each ${rate} Credits purchases 1 Experience for this character.` });
          return true;
        }
        const experience = amount / rate;
        actor.character.resources.creditsBase -= amount;
        if (targetRace === "android") {
          target.character.experience ||= { available: 0, spent: 0, totalGained: 0 };
          target.character.experience.available = (Number(target.character.experience.available) || 0) + experience;
          target.character.experience.totalGained = (Number(target.character.experience.totalGained) || 0) + experience;
        } else {
          target.character.resources.mechanicalExperience = (Number(target.character.resources.mechanicalExperience) || 0) + experience;
        }
      } else if (operation === "giftReverence") {
        if (actor.character.identity?.classId !== "tactician") {
          sendJson(res, 403, { error: "Only a Tactician may use this Reverence transfer." });
          return true;
        }
        actor.character.session ||= { freeRerollsUsed: {}, psychopathAwardsUsed: 0, tacticianReverenceGiven: 0 };
        const maximum = campaign.characters.length + 2;
        const given = Number(actor.character.session.tacticianReverenceGiven) || 0;
        if (given + amount > maximum) {
          sendJson(res, 400, { error: `This Tactician may distribute only ${Math.max(0, maximum - given)} more Reverence this session.` });
          return true;
        }
        if ((Number(actor.character.resources.reverence) || 0) < amount || (Number(target.character.resources.reverence) || 0) + amount > 10) {
          sendJson(res, 400, { error: "The Tactician lacks that Reverence or the recipient would exceed 10." });
          return true;
        }
        actor.character.resources.reverence -= amount;
        target.character.resources.reverence = (Number(target.character.resources.reverence) || 0) + amount;
        actor.character.session.tacticianReverenceGiven = given + amount;
      } else if (operation === "roboticsGrant") {
        if (actor.character.identity?.classId !== "robotics-worker" || !["android", "spiddix"].includes(target.character.identity?.raceId)) {
          sendJson(res, 403, { error: "A Robotics Worker may grant this bonus only to an Android or Spiddix." });
          return true;
        }
        if ((Number(actor.character.resources.reverence) || 0) < amount) {
          sendJson(res, 400, { error: "The Robotics Worker does not have enough Reverence." });
          return true;
        }
        actor.character.resources.reverence -= amount;
        const experience = amount * 8;
        target.character.experience ||= { available: 0, spent: 0, totalGained: 0 };
        target.character.experience.available = (Number(target.character.experience.available) || 0) + experience;
        target.character.experience.totalGained = (Number(target.character.experience.totalGained) || 0) + experience;
      }
      if (target && ["mechanicalExperience", "giftReverence", "roboticsGrant"].includes(operation)) {
        campaign.privateNotes.push({
          id: uid("note"), characterId: target.id, characterName: safeCharacterName(target), direction: "to-character", kind: "award", choices: [],
          message: operation === "giftReverence" ? `${safeCharacterName(actor)} gave you ${amount} Reverence.` : operation === "roboticsGrant" ? `${safeCharacterName(actor)} spent ${amount} Reverence to grant you ${amount * 8} Experience.` : `${safeCharacterName(actor)} purchased mechanical Experience for you.`,
          createdAt: new Date().toISOString(), readAt: null,
        });
      }
      actor.updatedAt = new Date().toISOString();
      if (target) target.updatedAt = actor.updatedAt;
      await this.save(campaign);
      sendJson(res, 200, { transferred: true, campaign: this.state(campaign, token) });
      return true;
    }

    sendJson(res, 404, { error: "Campaign endpoint not found." });
    return true;
  }
}

module.exports = { CampaignApi };
