const showcaseSummaryCache=new WeakMap();
const crypto = require("crypto");
const { DRAMA_CARD_COST, DRAMA_CARD_HAND_LIMIT, DRAMA_CARDS } = require("./drama-card-data.js");
const SHIP_MAP = require("./ship-map-core.js");
const SHOWCASE_NPCS = require("./data/npc-templates.json");
const CAMPAIGN_TIME = require("./campaign-time.js");
const OXYGEN = require('./ship-oxygen');
const TRANSIT = require('./ship-transit');
const CREW_ROOMS=require('./ship-crew-rooms');
const SHIP_POWER=require('./ship-power');
const REPUTATION = require('./ship-reputation');
const TRANSIT_FIELDS = require('./ship-state').fields;

function transitRoom(campaign) {
  const units=campaign.starships.flatMap(ship=>require('./ship-power').campaignUnits(ship,campaign.characters).map(unit=>{
    const record=campaign.characters.find(c=>c.id===unit.id);
    return {...unit,carryingId:unit.location?.carryingId,carriedBy:unit.location?.carriedBy,characterId:unit.id,characterName:safeCharacterName(record),team:'pc',currentHp:record?.character.health?.current??1};
  }).filter(unit=>unit.location));
  for(const record of campaign.characters)if(!units.some(u=>u.characterId===record.id))units.push({id:record.id,characterId:record.id,characterName:safeCharacterName(record),team:'pc',currentHp:record.character.health?.current??1});
  for(const npc of campaign.npcRoster||[])if(!units.some(u=>u.id===npc.id))units.push(clone(npc));
  for(const ship of campaign.starships){ship.maximumHullHp=ship.ship.maximumHullHp??SHIP_MAP.hullHp(ship);ship.currentHullHp=ship.ship.currentHullHp??ship.maximumHullHp;ship.currentShieldHp=ship.ship.currentShieldHp??0;}
  const shipPositions=require('./ship-distances').positions(campaign.starships,campaign.encounter?.shipPositions||[]).map(p=>({...p,...campaign.starships.find(s=>s.id===p.id)?.ship.fieldState?.position,id:p.id}));
  return {starships:campaign.starships,units,shipPositions,spaceObjects:campaign.encounter?.spaceObjects||[],outsideCombat:true,knownContacts:Object.fromEntries((campaign.encounter?.starships||[]).map(s=>[s.id,s.sensorState?.contacts||{}]))};
}

function syncCampaignCarry(campaign){
  const room=transitRoom(campaign);require('./crew-carry').sync(room);let changed=false;
  for(const unit of room.units){
    const stored=unit.characterId?campaign.starships.find(s=>s.id===unit.location?.starshipId)?.characterLocations?.[unit.characterId]:campaign.npcRoster?.find(n=>n.id===unit.id);
    if(!stored)continue;
    for(const key of ['carryingId','carriedBy'])if((stored[key]||null)!==(unit[key]||null)){stored[key]=unit[key]||null;changed=true;}
  }
  return changed;
}

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_SCRIPT_LENGTH = 250000;
const PLAYER_INBOX_LIMIT = 20;
const GM_INBOX_LIMIT = 50;
const DRAMA_CARD_BY_ID = new Map(DRAMA_CARDS.map((card) => [card.id, card]));
const DRAMA_CARD_IDS = DRAMA_CARDS.map((card) => card.id);
const REWARD_RESOURCES = ["experience", "credits", "reverence", "dramaCards", "attributePoints", "skillPoints", "shipCredits", "rest"];
const SHOWCASE_LIFETIME_MS = 1000 * 60 * 60 * 6;

function uid(prefix = "id") {
  return `${prefix}-${crypto.randomBytes(9).toString("base64url")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showcaseSkills(ratings = {}) {
  return Object.fromEntries(Object.entries(ratings).map(([name, value]) => [name, {
    tenths: Math.max(0, Math.round(Number(value) * 10)),
    creationDecimal: Math.max(0, Math.round((Number(value) * 10) % 10)),
  }]));
}

function showcaseCharacter({ id, playerName, characterName, color, speed, commandWindow, moveSpeed, hp, damageReduction = 0, attributes, skills, weaponId }) {
  const now = new Date().toISOString();
  const character = {
    id,
    version: 7,
    phase: "finalized",
    advancementOpen: false,
    identity: { playerName, characterName, race: "Human", raceId: "human", raceKind: "preset", raceType: "", classId: "", className: "No Class", homePlanet: "Earth", homePlanetKind: "preset", sex: "", age: "", height: "", weight: "", hair: "", eyes: "", description: "Explore Features sample character." },
    experience: { available: 12, spent: 0, totalGained: 12 },
    attributes,
    skills: showcaseSkills(skills),
    customSkills: [],
    creation: { skillPurchaseOrder: [], finalizationQueue: [], classGrantsApplied: true, raceGrantsApplied: true, manualInput: true },
    fubs: { status: "not-activated", rolls: [], rerollUsed: false },
    health: { current: hp, permanentBonus: 0 },
    gmAdjustments: { maximumHp: 0, exertionMax: 0, moveSpeed: 0, speed: 0, command: 0, damageReduction: 0 },
    resources: { exertionCurrent: 2, exertionMax: 2, reverence: 4, creditsBase: 500, mechanicalExperience: 0, dramaCards: 0, attributePoints: 0, skillPoints: 0 },
    presentation: { atbColor: color },
    access: { pcCode: `TEST-${id.slice(-1)}` },
    campaignLink: { roomCode: "", campaignName: "Explore Features", status: "linked", requestId: "", message: "" },
    localInbox: [],
    session: { number: 0, freeRerollsUsed: {}, marineHealingUsed: false, psychopathAwardsUsed: 0, tacticianReverenceGiven: 0, peacekeeperDramaCardsEarned: 0 },
    crew: Array.from({ length: 3 }, () => ({ name: "", title: "" })),
    weapons: [{ id: `${id}-weapon`, weaponId, held: true }],
    items: [],
    storedItems: [],
    statuses: { intoxicated: false },
    advantagesNotes: "",
    notes: "",
    computed: { speed, commandWindow, maximumHp: hp, moveSpeed, damageReduction, skills },
    updatedAt: now,
  };
  return { id, pcCode: character.access.pcCode, approved: true, imported: false, createdAt: now, updatedAt: now, character };
}

function showcaseShip(...args) {
  const [id,title,side,crew,start,npcs]=args;
  return normalizeStarshipRecord(require('./showcase-starters')(id,side,crew,npcs));
}

function showcaseLocation(starshipId, square, sicId = "") {
  return { environment: "starship", starshipId, square, mesh: 4, sicId, stationed: false, stationSlot: null };
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(0, index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function createDramaDeck() {
  return { drawPile: shuffle(DRAMA_CARD_IDS), discardPile: [], hands: {}, playEvents: [] };
}

function drawDramaCardId(deck) {
  if (!deck.drawPile.length && deck.discardPile.length) {
    deck.drawPile = shuffle(deck.discardPile);
    deck.discardPile = [];
  }
  return deck.drawPile.shift() || "";
}

function normalizeDramaDeck(campaign) {
  const source = campaign.dramaDeck && typeof campaign.dramaDeck === "object" ? campaign.dramaDeck : null;
  const deck = { drawPile: [], discardPile: [], hands: {}, playEvents: [] };
  const valid = new Set(DRAMA_CARD_IDS);
  const used = new Set();
  const characterIds = new Set((campaign.characters || []).map((record) => record.id));

  const collect = (values, target) => {
    for (const value of Array.isArray(values) ? values : []) {
      const id = String(value || "");
      if (!valid.has(id) || used.has(id)) continue;
      used.add(id);
      target.push(id);
    }
  };

  collect(source?.drawPile, deck.drawPile);
  collect(source?.discardPile, deck.discardPile);
  for (const record of campaign.characters || []) {
    const hand = [];
    collect(source?.hands?.[record.id], hand);
    deck.hands[record.id] = hand;
  }
  for (const [characterId, hand] of Object.entries(source?.hands || {})) {
    if (characterIds.has(characterId)) continue;
    collect(hand, deck.discardPile);
  }

  const missing = DRAMA_CARD_IDS.filter((id) => !used.has(id));
  deck.drawPile.push(...(source ? missing : shuffle(missing)));
  deck.playEvents = (Array.isArray(source?.playEvents) ? source.playEvents : []).slice(-50).map((event) => ({
    id: String(event?.id || uid("drama-play")).slice(0, 120),
    cardId: valid.has(String(event?.cardId || "")) ? String(event.cardId) : "",
    characterId: String(event?.characterId || "").slice(0, 120),
    characterName: String(event?.characterName || "Unnamed Character").slice(0, 80),
    playerName: String(event?.playerName || "Player").slice(0, 80),
    playedAt: event?.playedAt || new Date().toISOString(),
  })).filter((event) => event.cardId);

  for (const record of campaign.characters || []) {
    record.character.resources ||= {};
    const requested = Math.max(0, Math.min(DRAMA_CARDS.length, Math.round(Number(record.character.resources.dramaCards) || 0)));
    const hand = deck.hands[record.id];
    while (hand.length < requested) {
      const cardId = drawDramaCardId(deck);
      if (!cardId) break;
      hand.push(cardId);
    }
    record.character.resources.dramaCards = hand.length;
  }

  campaign.dramaDeck = deck;
  return deck;
}

function releaseDramaHand(campaign, characterId) {
  const deck = normalizeDramaDeck(campaign);
  deck.discardPile.push(...(deck.hands[characterId] || []));
  delete deck.hands[characterId];
}

function dramaCardState(cardId) {
  const card = DRAMA_CARD_BY_ID.get(cardId);
  return card ? clone(card) : null;
}

function campaignCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
}

function backupKey() {
  return crypto.randomBytes(24).toString("base64url");
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
  return {
    experience: "Experience",
    credits: "Credits",
    reverence: "Reverence",
    dramaCards: "Drama Cards",
    attributePoints: "Attribute Points",
    skillPoints: "Skill Points",
    shipCredits: "Group Credits",
    rest: "Rest",
  }[resource] || resource;
}

function characterRewardSnapshot(record, campaign = null) {
  const character = record.character;
  character.experience ||= { available: 0, spent: 0, totalGained: 0 };
  character.resources ||= {};
  const hand = campaign ? normalizeDramaDeck(campaign).hands[record.id] || [] : [];
  return {
    id: record.id,
    experience: clone(character.experience),
    creditsBase: Number(character.resources.creditsBase) || 0,
    reverence: Number(character.resources.reverence) || 0,
    attributePoints: Math.max(0, Math.round(Number(character.resources.attributePoints) || 0)),
    skillPoints: Math.max(0, Math.round(Number(character.resources.skillPoints) || 0)),
    exertionCurrent: Math.max(0, Math.round(Number(character.resources.exertionCurrent) || 0)),
    dramaHand: clone(hand),
  };
}

function applyCharacterReward(record, award, campaign = null) {
  const character = record.character;
  character.statistics||={};character.statistics.experienceEarned??=Number(character.experience?.totalGained)||0;
  const resource = award.resource;
  const amount = Math.round(Number(award.amount) || 0);
  const before = characterRewardSnapshot(record, campaign);
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
    require('./character-statistics').earned(character,'experience',received);
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
    require('./character-statistics').earned(character,'experience',converted);
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
    character.resources.creditsBase = Math.round(boundedNumber(current + amount, -999999999, 999999999));
    appliedAmount = character.resources.creditsBase - current;
  }

  if (resource === "reverence") {
    const current = Number(character.resources.reverence) || 0;
    character.resources.reverence = Math.round(boundedNumber(current + amount, 0, 10));
    appliedAmount = character.resources.reverence - current;
    require('./character-statistics').earned(character,'reverence',Math.max(0,amount));
    const wasted = Math.max(0, amount - appliedAmount);
    if (wasted) messageDetail = ` ${wasted.toLocaleString()} excess Reverence was lost at the maximum of 10.`;
  }

  if (resource === "attributePoints" || resource === "skillPoints") {
    const current = Math.max(0, Math.round(Number(character.resources[resource]) || 0));
    character.resources[resource] = Math.round(boundedNumber(current + amount, 0, 999999));
    appliedAmount = character.resources[resource] - current;
  }

  if (resource === "rest") {
    const current = Math.max(0, Math.round(Number(character.resources.exertionCurrent) || 0));
    const maximum = Math.max(0, Math.round(Number(character.resources.exertionMax) || 0));
    character.resources.exertionCurrent = maximum;
    appliedAmount = Math.max(0, maximum - current);
    messageDetail = appliedAmount ? " Exertion fully restored." : " Exertion was already full.";
  }

  if (resource === "dramaCards") {
    const deck = campaign ? normalizeDramaDeck(campaign) : null;
    if (!deck) {
      appliedAmount = 0;
      messageDetail = " The shared campaign deck was unavailable.";
    } else {
      const hand = deck.hands[record.id] || (deck.hands[record.id] = []);
      const requested = Math.abs(amount);
      let changed = 0;
      if (amount > 0) {
        for (let index = 0; index < requested; index += 1) {
          const cardId = drawDramaCardId(deck);
          if (!cardId) break;
          hand.push(cardId);
          changed += 1;
        }
      } else {
        for (let index = 0; index < requested && hand.length; index += 1) {
          deck.discardPile.push(hand.pop());
          changed -= 1;
        }
      }
      character.resources.dramaCards = hand.length;
      appliedAmount = changed;
      if (changed !== amount) messageDetail = ` ${Math.abs(amount - changed)} requested card${Math.abs(amount - changed) === 1 ? " was" : "s were"} unavailable.`;
    }
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
  notes.filter((note) => note.kind === "reverence-gift-request" && note.requestStatus === "pending").forEach((note) => keep.add(note.id));
  notes.filter(note => note.kind === "angiluros-craft-request" && ["crafting","pending"].includes(note.requestStatus)).forEach(note => keep.add(note.id));
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
    message: action.message || `Successful ${action.attribute} + ${action.skill} check: ${amount.toLocaleString()} ${rewardLabel(resource)} is ready to receive.`,
    createdAt: now, readAt: null,
  });
  return { kind: "award", resource, amount, awardId: award.id, pending: true };
}

function normalizeStarshipRecord(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const ship = source.ship && typeof source.ship === "object" ? clone(source.ship) : {};
  const cleanCells = Array.isArray(ship.gridCells) ? [...new Set(ship.gridCells.filter((value) => Number.isInteger(value) && value >= 0 && value < SHIP_MAP.gridColumns(ship)*SHIP_MAP.gridRows(ship)))].slice(0, 400) : [];
  const cleanPlacements = Array.isArray(ship.placements) ? ship.placements.filter((entry) => {
    const item=ship.sicInventory?.find(item=>item.id===entry?.sicId),def=SHIP_MAP.definition(item?.type);
    return item&&(def.hullSystem?cleanCells.length>0:def.multiMount?SHIP_MAP.multiMountPlacement(ship,item,entry.mountCells):def.mixed?SHIP_MAP.mixedPlacement(ship,item,entry.cell,entry.exteriorCell):cleanCells.includes(entry.cell)||(def.exterior&&SHIP_MAP.exteriorPlacement(ship,item.type,entry.cell,item.id)));
  }).slice(0,400).map(entry=>({sicId:String(entry.sicId).slice(0,120),cell:SHIP_MAP.definition(ship.sicInventory.find(i=>i.id===entry.sicId)?.type).hullSystem&&!cleanCells.includes(entry.cell)?cleanCells[0]:entry.cell,...(Number.isInteger(entry.exteriorCell)?{exteriorCell:entry.exteriorCell}:{}),...(Array.isArray(entry.mountCells)?{mountCells:[...entry.mountCells]}:{})})) : [];
  ship.gridCells = cleanCells;ship.triangleCells=SHIP_MAP.triangleCells(ship);
  ship.placements = cleanPlacements;
  ship.sicInventory = Array.isArray(ship.sicInventory) ? ship.sicInventory.slice(0, 400) : [];
  for(const item of ship.sicInventory)if(SHIP_MAP.definition(item.type).hullUpgrade)item.purchasePrice=SHIP_MAP.sicPrice(item,ship);
  const installedIds = new Set(cleanPlacements.map(entry => entry.sicId));
  ship.maximumShieldHp = ship.sicInventory.reduce((total, item) => total + (installedIds.has(item.id) && !item.disabled && !['disabled', 'offline', 'destroyed', 'powered-down'].includes(item.status) ? Number(SHIP_MAP.definition(item.type).shieldHp) || 0 : 0), 0);
  ship.currentShieldHp = Math.max(0, Math.min(ship.maximumShieldHp, Number(ship.currentShieldHp ?? ship.maximumShieldHp) || 0));
  ship.title = String(ship.title || source.title || "Untitled Starship").trim().slice(0, 100) || "Untitled Starship";
  ship.affiliation = String(ship.affiliation || "").slice(0, 100);
  ship.class = String(ship.class || "").slice(0, 100);
  ship.confirmedOnce = true;
  SHIP_MAP.ensureAirlocks(ship);
  const validCrew = [...new Set((Array.isArray(source.crewCharacterIds) ? source.crewCharacterIds : ship.crewCharacterIds || []).map(String))].slice(0, 100);
  const characterLocations = {};
  for(const pod of ship.fieldState?.pods||[])if(!pod.recovered)for(const passenger of pod.passengers||[])if(validCrew.includes(passenger.id))characterLocations[passenger.id]={environment:'escape-pod',starshipId:'',square:null,mesh:4,escapePodId:pod.id,stationed:false};
  for (const [characterId, location] of Object.entries(source.characterLocations && typeof source.characterLocations === "object" ? source.characterLocations : ship.characterLocations || {})) {
    if(characterLocations[characterId]?.escapePodId)continue;
    if(validCrew.includes(characterId)&&(location?.environment==='exterior'||location?.escapePodId)){characterLocations[characterId]=clone(location);continue;}
    const square = Number(location?.square);
    const mesh = Number(location?.mesh);
    if (validCrew.includes(characterId) && cleanCells.includes(square)) characterLocations[characterId] = { carryingId:location?.carryingId?String(location.carryingId).slice(0,120):null,carriedBy:location?.carriedBy?String(location.carriedBy).slice(0,120):null, square, mesh: Number.isInteger(mesh) ? Math.max(0, Math.min(8, mesh)) : 4, stationed: Boolean(location?.stationed), stationSlot: location?.stationed ? Math.max(0, Math.min(8, Number(location?.stationSlot) || 0)) : null };
  }
  return {
    id: String(source.id || ship.id || uid("starship")).slice(0, 120),
    title: ship.title,
    controlType: source.controlType === "gm" ? "gm" : "pc",
    accessKey: String(source.accessKey || "").slice(0, 160),
    buildRevision:Math.max(0,Number(source.buildRevision)||0),
    crewCharacterIds: validCrew,
    crewNpcUnitIds: [...new Set((Array.isArray(source.crewNpcUnitIds) ? source.crewNpcUnitIds : ship.crewNpcUnitIds || []).map(String))].slice(0, 100),
    characterLocations,
    characterWalks:clone(source.characterWalks||{}),
    auState:source.auState?{current:Math.max(0,Number(source.auState.current)||0),progress:Math.max(0,Number(source.auState.progress)||0)}:null,
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
    ship,
  };
}

function starshipStationAt(record, square, mesh) {
  const cell=SHIP_MAP.buildLayout(record?.ship||{}).footprint.get(Number(square));
  if(!cell||cell.exterior)return null;
  const station=cell.stations.find(entry=>entry.x===cell.column&&entry.y===cell.row&&Number(entry.mesh)===Number(mesh));
  return station?{...station,sicId:cell.sicId,type:cell.type}:null;
}

function publicStarship(record) {
  const copy = clone(record);
  copy.constructionCost=require('./ship-budget').cost(record.ship||{});
  copy.powerSummary=SHIP_POWER.output(record,[]);
  delete copy.accessKey;
  if(copy.ship)delete copy.ship.oxygenState;
  if(copy.ship){delete copy.ship.surveillanceState;delete copy.ship.intruderState;}
  return copy;
}

function defaultCampaign({ code, name, gmCode }) {
  const now = new Date().toISOString();
  return {
    version: 3,
    code,
    name: String(name || "New Campaign").trim().slice(0, 80) || "New Campaign",
    gmCode: passwordRecord(gmCode),
    backupKey: backupKey(),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    script: "",
    scriptChapters: [{ id: uid("chapter"), name: "Chapter 1", script: "" }],
    conditionalActions: [],
    characters: [],
    starships: [],
    joinRequests: [],
    shipCredits: 100000,
    bankerCharacterId: null,
    awardHistory: [],
    itemTransactions: [],
    privateNotes: [],
    rollRequests: [],
    npcTemplates: [],
    dramaDeck: createDramaDeck(),
    settings: { commandWindowBonus: 0, hideRoomCode: false },
    encounter: null,
    sessionNumber: 0,
  };
}

function normalizeCampaign(raw) {
  const campaign = require("./skill-catalog").migrate(raw && typeof raw === "object" ? raw : {});
  campaign.version = 3;
  campaign.npcRoster = [...new Map([...(campaign.npcRoster || []), ...(campaign.encounter?.units || []).filter(unit => unit.team === "npc")].map(unit => [unit.id, unit])).values()].slice(-200);
  campaign.code = String(campaign.code || "").trim().toUpperCase();
  campaign.name = String(campaign.name || "Campaign").trim().slice(0, 80) || "Campaign";
  campaign.gmCode = campaign.gmCode || campaign.password || null;
  campaign.backupKey = String(campaign.backupKey || "").trim() || backupKey();
  campaign.revision = Math.max(1, Math.round(Number(campaign.revision) || 1));
  campaign.createdAt = campaign.createdAt || new Date().toISOString();
  campaign.updatedAt = campaign.updatedAt || campaign.createdAt;
  delete campaign.password;
  campaign.script = String(campaign.script || "").slice(0, MAX_SCRIPT_LENGTH);
  const previousScript = campaign.script;
  const chapterSource = Array.isArray(campaign.scriptChapters) && campaign.scriptChapters.length
    ? campaign.scriptChapters
    : [{ id: uid("chapter"), name: "Chapter 1", script: previousScript }];
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
    resource: REWARD_RESOURCES.includes(action?.resource) ? action.resource : "experience",
    amount: Math.round(boundedNumber(action?.amount, 0, 999999999)),
    attribute: String(action?.attribute || "").slice(0, 40),
    skill: String(action?.skill || "").slice(0, 80),
    difficulty: Number.isFinite(Number(action?.difficulty)) ? Number(action.difficulty) : 0,
    hideDifficulty: false,
  })).filter((action) => action.keyword && action.attribute && action.skill && action.difficulty >= 0);
  campaign.settings = campaign.settings && typeof campaign.settings === "object" ? campaign.settings : {};
  campaign.settings.commandWindowBonus = Math.round(boundedNumber(campaign.settings.commandWindowBonus, 0, 3600));
  campaign.settings.hideRoomCode = Boolean(campaign.settings.hideRoomCode);
  campaign.characters = Array.isArray(campaign.characters) ? campaign.characters : [];
  campaign.characters = campaign.characters.map((record) => ({
    id: String(record?.id || record?.character?.id || uid("character")),
    pcCode: String(record?.pcCode ?? record?.pin ?? ""),
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
    resource: REWARD_RESOURCES.includes(award?.resource) ? award.resource : "experience",
    amount: Math.round(Number(award?.amount) || 0),
    targetIds: Array.isArray(award?.targetIds) ? [...new Set(award.targetIds.map(String))] : [],
    before: award?.before && typeof award.before === "object" ? award.before : { shipCredits: campaign.shipCredits, characters: [] },
    claimRequired: Boolean(award?.claimRequired),
    claimedCharacterIds: Array.isArray(award?.claimedCharacterIds) ? [...new Set(award.claimedCharacterIds.map(String))] : [],
    androidExperienceIds: Array.isArray(award?.androidExperienceIds) ? [...new Set(award.androidExperienceIds.map(String))] : [],
    at: award?.at || new Date().toISOString(),
  }));
  campaign.starships = (Array.isArray(campaign.starships) ? campaign.starships : []).slice(0, 100).map(normalizeStarshipRecord);
  const shipNames=new Set();for(const record of campaign.starships){const base=record.title;let title=base,index=1;while(shipNames.has(title.toLocaleLowerCase()))title=base+' ('+(index++)+')';record.title=record.ship.title=title;shipNames.add(title.toLocaleLowerCase());}
  trimAwardHistory(campaign);
  campaign.itemTransactions = Array.isArray(campaign.itemTransactions) ? campaign.itemTransactions.slice(-250) : [];
  campaign.privateNotes = (Array.isArray(campaign.privateNotes) ? campaign.privateNotes : []).slice(-1000).map((note) => ({
    id: String(note?.id || uid("note")),
    characterId: String(note?.characterId || ""),
    characterName: String(note?.characterName || "").slice(0, 80),
    direction: note?.direction === "to-gm" ? "to-gm" : "to-character",
    kind: ["system", "award", "damage", "roll-request", "session-end", "science-choice", "item-transaction", "item-activity", "recharge", "reverence-gift-request", "reverence-spent", "exertion-spent", "rest-request", "angiluros-craft-request"].includes(note?.kind) ? note.kind : "message",
    choices: Array.isArray(note?.choices) ? note.choices.map(String).slice(0, 8) : [],
    rollRequestId: String(note?.rollRequestId || ""),
    awardId: String(note?.awardId || ""),
    rewardResource: REWARD_RESOURCES.includes(note?.rewardResource) ? note.rewardResource : "",
    rewardAmount: Math.max(0, Math.round(Number(note?.rewardAmount) || 0)),
    rewardStatus: ["pending", "claimed", "cancelled"].includes(note?.rewardStatus) ? note.rewardStatus : "",
    rewardClaimedAt: note?.rewardClaimedAt || null,
    rewardAppliedAmount: Math.max(0, Math.round(Number(note?.rewardAppliedAmount) || 0)),
    requestStatus: ["pending", "approved", "denied"].includes(note?.requestStatus) ? note.requestStatus : "",
    requesterCharacterId: String(note?.requesterCharacterId || ""),
    targetCharacterId: String(note?.targetCharacterId || ""),
    requestedAmount: Math.max(0, Math.min(10, Math.round(Number(note?.requestedAmount) || 0))),
    requestResolvedAt: note?.requestResolvedAt || null,
    grantedAmount: Math.max(0, Math.round(Number(note?.grantedAmount) || 0)),
    requestedWeaponId: String(note?.requestedWeaponId || "").slice(0, 100),
    requestedWeaponName: String(note?.requestedWeaponName || "").slice(0, 120),
    requestedInventoryId: String(note?.requestedInventoryId || "").slice(0, 100),
    craftHours: Math.max(0, Math.round(Number(note?.craftHours) || 0)),
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
    allyNpc: Boolean(template?.allyNpc ?? template?.ally),
  }));
  campaign.npcRoster ||= [];
  for(const template of campaign.npcTemplates){const id='roster-'+template.id;if(campaign.npcRoster.some(n=>n.templateId===template.id||n.id===id))continue;
    const unit={...clone(template),id,templateId:template.id,characterName:template.name,playerName:'GM',team:'npc',controlledBy:'gm',currentHp:template.maximumHp,location:{starshipId:'',square:null,mesh:4,stationed:false},weapons:[{inventoryId:id+'-weapon',weaponId:template.heldWeaponId}],heldWeaponId:id+'-weapon'};
    require('./combat-engine').migrateUnitCombat(unit);campaign.npcRoster.push(unit);
  }
  campaign.sessionNumber = Math.max(0, Math.round(Number(campaign.sessionNumber) || 0));
  normalizeDramaDeck(campaign);
  trimPrivateNotes(campaign);
  return campaign;
}

function campaignBackup(campaign) {
  const portableEncounter=clone(campaign.encounter || null);
  if(portableEncounter){
    delete portableEncounter.hackingPrivate;
    for(const unit of portableEncounter.units||[]){
      delete unit.hackingSessions;delete unit.counterHackSwap;
      if(unit.delayedAction?.counterHack)unit.delayedAction=null;
    }
    for(const ship of portableEncounter.starships||[])ship.hackedSystems=[];
  }
  const exportedAt = new Date().toISOString();
  return {
    format: "spaceship-architect-campaign",
    version: 2,
    exportedAt,
    authentication: {
      gmCode: clone(campaign.gmCode),
      backupKey: campaign.backupKey,
    },
    summary: {
      campaignName: campaign.name,
      campaignCode: campaign.code,
      revision: campaign.revision,
      updatedAt: campaign.updatedAt,
      exportedAt,
      sessionNumber: campaign.sessionNumber,
      characterCount: campaign.characters.length,
    },
    campaign: clone({
      starmaps: clone(campaign.starmaps||null),
      activeSystem: clone(campaign.activeSystem||null),
      interfaceVersion: campaign.interfaceVersion,
      roomOpen: campaign.roomOpen,
      imports: campaign.imports,
      quickPrompts: campaign.quickPrompts,
      reputationSession: campaign.reputationSession,
      endSessionReceipts: campaign.endSessionReceipts,
      crewLogs: campaign.crewLogs||[],
      libraryEntries: campaign.libraryEntries||[],
      version: campaign.version,
      code: campaign.code,
      name: campaign.name,
      revision: campaign.revision,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      script: campaign.script,
      scriptChapters: campaign.scriptChapters,
      conditionalActions: campaign.conditionalActions,
      characters: campaign.characters,
      starships: campaign.starships,
      joinRequests: campaign.joinRequests,
      settings: campaign.settings,
      shipCredits: campaign.shipCredits,
      bankerCharacterId: campaign.bankerCharacterId,
      awardHistory: campaign.awardHistory,
      itemTransactions: campaign.itemTransactions,
      privateNotes: campaign.privateNotes,
      rollRequests: campaign.rollRequests,
      npcTemplates: campaign.npcTemplates,
      npcRoster: campaign.npcRoster,
      dramaDeck: campaign.dramaDeck,
      encounter: portableEncounter,
      sessionNumber: campaign.sessionNumber,
    }),
  };
}

function campaignFromBackup(backup, { code = "", gmCode = null, currentGmCode = null } = {}) {
  if (backup?.format !== "spaceship-architect-campaign" || !backup?.campaign || !Array.isArray(backup.campaign.characters)) return null;
  const restored = normalizeCampaign(clone(backup.campaign));
  restored.code = String(code || restored.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(restored.code)) return null;
  restored.gmCode = currentGmCode || backup.authentication?.gmCode || (gmCode ? passwordRecord(gmCode) : null);
  restored.backupKey = String(backup.authentication?.backupKey || restored.backupKey || "").trim() || backupKey();
  if (!restored.gmCode?.salt || !restored.gmCode?.hash) return null;
  restored.updatedAt = new Date().toISOString();
  return restored;
}

function campaignComparison(hosted, backup) {
  const backupCampaign = backup?.campaign || {};
  const hostedRevision = Math.max(1, Math.round(Number(hosted?.revision) || 1));
  const backupRevision = Math.max(1, Math.round(Number(backupCampaign.revision ?? backup?.summary?.revision) || 1));
  const hostedUpdatedAt = hosted?.updatedAt || hosted?.createdAt || null;
  const backupUpdatedAt = backupCampaign.updatedAt || backup?.summary?.updatedAt || backup?.exportedAt || null;
  const hostedTime = Date.parse(hostedUpdatedAt || 0) || 0;
  const backupTime = Date.parse(backupUpdatedAt || 0) || 0;
  const preferred = hostedRevision === backupRevision
    ? hostedTime >= backupTime ? "hosted" : "backup"
    : hostedRevision > backupRevision ? "hosted" : "backup";
  const summarize = (source, fallback = {}) => ({
    campaignName: String(source?.name || fallback.campaignName || "Campaign"),
    campaignCode: String(source?.code || fallback.campaignCode || ""),
    revision: Math.max(1, Math.round(Number(source?.revision ?? fallback.revision) || 1)),
    updatedAt: source?.updatedAt || fallback.updatedAt || null,
    exportedAt: fallback.exportedAt || null,
    sessionNumber: Math.max(0, Math.round(Number(source?.sessionNumber ?? fallback.sessionNumber) || 0)),
    characterCount: Array.isArray(source?.characters)
      ? source.characters.length
      : Math.max(0, Math.round(Number(fallback.characterCount) || 0)),
  });
  return {
    preferred,
    hosted: summarize(hosted),
    backup: summarize(backupCampaign, backup?.summary || { exportedAt: backup?.exportedAt }),
  };
}

function publicCharacter(record, { gm = false, own = false, notes = [] } = {}) {
  const character = clone(record.character);
  if (!gm && !own) delete character.access;
  // The roster shares hand size, never the identities of another player’s cards.
  return {
    id: record.id,
    pcCode: gm || own ? record.pcCode : undefined,
    approved: record.approved,
    imported: record.imported,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    character,
    privateNotes: gm || own ? clone(notes) : undefined,
  };
}

function writeEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

class CampaignApi {
  constructor({ store, storageMode, connectedCharacterIds = () => [], restoreEncounter = () => {}, deleteEncounter = () => {}, canPassTime = () => true, timePassed = () => {}, liveEncounter = () => null, characterMoved = () => {}, environmentChanged = () => {}, ensureRescueEncounter = null }) {
    this.store = store;
    this.storageMode = storageMode;
    this.connectedCharacterIds = code => [...new Set([...connectedCharacterIds(code), ...[...(this.clients?.get(code)||[])].map(client=>this.session(client.token,code)).filter(session=>session?.role==='character').map(session=>session.characterId)])];
    this.restoreEncounter = restoreEncounter;
    this.deleteEncounter = deleteEncounter;
    this.canPassTime = canPassTime;
    this.timePassed = timePassed;
    this.liveEncounter = liveEncounter;
    this.characterMoved = characterMoved;
    this.environmentChanged = environmentChanged;
    this.ensureRescueEncounter = ensureRescueEncounter;
    this.environmentTicks = new Map();
    this.sessions = new Map();
    this.clients = new Map();
    this.campaignCache = new Map();
    this.campaignLoads = new Map();
    this.saveQueues = new Map();
    this.showcases = new Map();
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
    const record = this.sessions.get(String(token || "")) || this.campaignCache.get(code)?.runtimeSessions?.[String(token || "")];
    if(record) this.sessions.set(String(token || ""),record);
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

  isShowcase(code) {
    return Boolean(this.showcases.get(String(code || "").trim().toUpperCase())?.campaign?.showcase);
  }

  showcaseEncounter(code) {
    const record = this.showcases.get(String(code || "").trim().toUpperCase());
    return record?.encounterTemplate ? clone(record.encounterTemplate) : null;
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
    const showcase = this.showcases.get(normalizedCode);
    if (showcase) {
      if (showcase.expiresAt > Date.now()) return showcase.campaign;
      this.showcases.delete(normalizedCode);
      this.campaignCache.delete(normalizedCode);
      this.deleteEncounter(normalizedCode);
    }
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

  async save(campaign, { broadcast = true, incrementRevision = true } = {}) {
    normalizeDramaDeck(campaign);
    const names=new Set();for(const record of campaign.starships||[]){const base=record.title||record.ship.title||"Starship";let title=base,n=1;while(names.has(title.toLowerCase()))title=base+" ("+(n++)+")";names.add(title.toLowerCase());record.title=record.ship.title=title;}
    trimPrivateNotes(campaign);
    if (incrementRevision) campaign.revision = Math.max(1, Math.round(Number(campaign.revision) || 1)) + 1;
    this.campaignCache.set(campaign.code, campaign);
    if (campaign.showcase) {
      const record = this.showcases.get(campaign.code);
      if (record) {
        campaign.updatedAt = new Date().toISOString();
        record.campaign = campaign;
        record.expiresAt = Date.now() + SHOWCASE_LIFETIME_MS;
      }
      if (broadcast) await this.broadcast(campaign.code, campaign);
      return;
    }
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

  environment(campaign,token=''){
    const session=this.session(token,campaign.code),combat=!this.canPassTime(campaign.code),room=combat?this.liveEncounter(campaign.code):null;
    const ships=room?.starships||campaign.starships;
    OXYGEN.sync(ships,OXYGEN.people(campaign,room));
    const paused=Boolean(room&&(!room.running||room.hardPaused||room.holdPaused||room.pausedForTurn||room.attackResolution||room.itemResolution||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)));
    return {notices:require('./fleet-status').project(room||{starships:ships,units:[],encounterEndedAt:true},session),ships:OXYGEN.project(ships,{gm:session?.role==='gm',characterId:session?.role==='character'?session.characterId:null,paused}),combat};
  }

  async tickEnvironment(now=Date.now()){
    if(this.environmentBusy)return;this.environmentBusy=true;
    try{for(const campaign of this.campaignCache.values()){
      const tick=this.environmentTicks.get(campaign.code)||{at:now,saved:now},seconds=Math.max(0,(now-tick.at)/1000);tick.at=now;this.environmentTicks.set(campaign.code,tick);
      const combat=!this.canPassTime(campaign.code),room=combat?this.liveEncounter(campaign.code):null,ships=room?.starships||campaign.starships;
      const galaxy=require('./campaign-starmaps'),travel=galaxy.tick(campaign,now,combat);
      if(travel.changed){
        for(const client of this.clients.get(campaign.code)||[]){const session=this.session(client.token,campaign.code);writeEvent(client.response,'galaxy-travel',galaxy.travelPacket(campaign,session?.role==='gm',now,combat));}
        if(travel.finished||now-(tick.travelSaved||0)>=5000){await this.save(campaign,{broadcast:travel.finished});tick.travelSaved=now;}
      }
      const walkingShips=!combat?ships.filter(s=>Object.keys(s.characterWalks||{}).length):[];
      if(walkingShips.length){
        let finished=false;
        for(const ship of walkingShips){for(const id of require('./ship-walking').advance(ship,now)){finished=true;this.characterMoved(campaign.code,ship.id,id,ship.characterLocations[id]);}for(const [id,loc]of Object.entries(ship.characterLocations||{})){const passenger=campaign.npcRoster?.find(n=>n.id===loc.carryingId);if(passenger)passenger.location={...loc,starshipId:ship.id,carryingId:null,carriedBy:id,stationed:false};}}
        for(const client of this.clients.get(campaign.code)||[]){const session=this.session(client.token,campaign.code);writeEvent(client.response,'ship-walks',{serverNow:now,ships:walkingShips.filter(s=>session?.role==='gm'||s.controlType==='pc').map(s=>({id:s.id,characterLocations:s.characterLocations,characterWalks:s.characterWalks}))});}
        if(finished)await this.save(campaign);
      }
      const transitActive=!combat&&ships.some(s=>!s.ship.warpState?.campaignClock&&['activating','traveling'].includes(s.ship.warpState?.phase)||['countdown','approvals'].includes(s.ship.destructState?.phase));
      const fieldActive=!combat&&ships.some(s=>Object.values(s.ship.fieldState?.systems||{}).some(d=>d.cooldown>0||d.tether));
      const systemsActive=!combat&&ships.some(s=>Object.values(s.ship.blackHoleGunState?.cooldowns||{}).some(n=>n>0)||require('./ship-devastation').needsPower(s)||Object.entries(s.ship.fieldState?.systems||{}).some(([id,d])=>d.enabled&&s.ship.sicInventory.some(i=>i.id===id&&i.type==='ionic-force-displacers'))||s.ship.cloakState?.active||s.ship.gravityFieldState?.active||s.ship.sicInventory.some(i=>i.bootRemaining>0));
      const roomsReconciled=!combat&&CREW_ROOMS.reconcile(transitRoom(campaign),campaign);
      const medicalActive=!combat&&(require('./ship-fabrication').active({starships:ships})||roomsReconciled||CREW_ROOMS.hibernating({starships:ships})||CREW_ROOMS.jobs({starships:ships}).some(({job})=>['preparing','recovering'].includes(job.phase))||CREW_ROOMS.actors(transitRoom(campaign),campaign).some(a=>!a.mechanical&&a.hp<=0&&ships.some(s=>s.id===a.loc?.starshipId&&(s.ship.crewRoomState?.down?.[a.id]||0)<=CREW_ROOMS.RECOVERY_SECONDS)));
      if(!combat&&require('./ship-surveillance').reconcile(transitRoom(campaign)))await this.save(campaign);
      if(!ships.some(s=>require('./ship-atmosphere').active(s))&&!tick.active&&!transitActive&&!medicalActive&&!fieldActive&&!systemsActive&&!combat)continue;
      if(systemsActive){const systemsRoom=transitRoom(campaign);SHIP_POWER.advance(systemsRoom,seconds);require('./ship-black-hole-gun').cooldowns(systemsRoom,seconds);require('./ship-black-holes').advance(systemsRoom,seconds,[],false);for(const s of ships)require('./ship-maintenance').advance(s,seconds);tick.active=true;}
      const actors=OXYGEN.people(campaign,room),before=OXYGEN.pending(ships);
      const events=combat?[]:OXYGEN.advance(ships,actors,seconds);
      const medicalChanged=!combat&&CREW_ROOMS.advance(transitRoom(campaign),campaign,seconds);
      const carryChanged=!combat&&syncCampaignCarry(campaign);
      const transitEvents=transitActive?TRANSIT.advance(transitRoom(campaign),seconds):[];
      const fieldChanged=!combat&&require('./ship-field-utilities').advance(transitRoom(campaign),seconds);
      for(const ship of ships)if(!combat&&ship.currentHullHp!=null)ship.ship.currentHullHp=ship.currentHullHp;
      if(!combat&&(roomsReconciled||carryChanged||fieldChanged||medicalChanged||transitActive||transitEvents.length||events.length||before!==OXYGEN.pending(ships)||now-tick.saved>=((medicalActive||tick.active)?1000:5000))){
        this.timePassed(campaign.code,campaign.characters);await this.save(campaign,{broadcast:Boolean(carryChanged||fieldChanged||medicalActive||medicalChanged||events.length||transitActive||transitEvents.length||tick.active)});tick.saved=now;
      }
      tick.active=ships.some(s=>require('./ship-atmosphere').active(s));
      for(const client of this.clients.get(campaign.code)||[])writeEvent(client.response,'oxygen',this.environment(campaign,client.token));
    }}finally{this.environmentBusy=false;}
  }

  state(campaign, token = "") {
    const dramaDeck = normalizeDramaDeck(campaign);
    const session = this.session(token, campaign.code);
    if(campaign.interfaceVersion==='0.3' && (!session || !campaign.roomOpen)) return {interfaceVersion:'0.3',code:campaign.code,roomOpen:false,role:'viewer',characters:[],starships:[],settings:{},redirectCode:campaign.redirectCode};
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
      starmaps: require("./campaign-starmaps").view(campaign,gm),
      activeSystem: gm?clone(campaign.activeSystem||null):undefined,
      interfaceVersion: campaign.interfaceVersion,
      roomOpen: campaign.roomOpen,
      playerId: this.session(token,campaign.code)?.playerId || null,
      players: gm ? clone(campaign.players || []) : undefined,
      imports: (campaign.imports || []).filter(r=>gm || r.playerId===this.session(token,campaign.code)?.playerId).map(r=>({...clone(r),data:gm?r.data:undefined})),
      quickPrompts: gm ? clone(campaign.quickPrompts || {}) : undefined,
      reputation: gm ? clone(REPUTATION.state(campaign)) : undefined,
      code: campaign.code,
      roomCode: campaign.code,
      name: campaign.name,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      revision: campaign.revision,
      storageMode: this.storageMode,
      showcase: Boolean(campaign.showcase),
      role: gm ? "gm" : ownId ? "character" : "viewer",
      ownCharacterId: ownId,
      combatActive: !this.canPassTime(campaign.code),
      serverNow: Date.now(),
      clockRunning:Boolean((this.liveEncounter(campaign.code)||campaign.encounter)?.running&&!(this.liveEncounter(campaign.code)||campaign.encounter)?.hardPaused),
      deployedShipIds: (campaign.encounter?.starships||[]).filter(s=>campaign.starships.some(record=>record.id===s.id&&(gm||record.controlType==='pc'||record.crewCharacterIds?.includes(ownId)))).map(s=>s.id),
      libraryTargets: gm ? CREW_ROOMS.libraryTargets(campaign,!this.canPassTime(campaign.code)?this.liveEncounter(campaign.code):null) : undefined,
      spaceObjects: clone(gm?(campaign.spaceObjects||campaign.encounter?.spaceObjects||[]).filter(o=>!o.collectedBy):require("./spectator-view").objects(campaign.encounter||{spaceObjects:[]},campaign.starships.filter(s=>session?.role==='viewer'?s.controlType==='pc':s.crewCharacterIds?.includes(ownId)))),
      crewRoomRolls:CREW_ROOMS.rolls((!this.canPassTime(campaign.code)&&this.liveEncounter(campaign.code))||transitRoom(campaign)).filter(r=>gm||(r.characterId===ownId&&r.controller!=='gm')),
      oxygen: this.environment(campaign,token),
      script: gm ? campaign.script : undefined,
      scriptChapters: gm ? clone(campaign.scriptChapters) : undefined,
      conditionalActions: gm ? clone(campaign.conditionalActions) : undefined,
      shipCredits: campaign.shipCredits,
      crewLogs:clone(require('./crew-logs').visible(campaign,ownId,gm)),
      libraryEntries:clone(campaign.libraryEntries||[]),
      gmConnected:[...(this.clients.get(campaign.code)||[])].some(client=>this.gmSession(client.token,campaign.code)),
      sessionNumber: campaign.sessionNumber,
      bankerCharacterId: campaign.bankerCharacterId,
      settings: clone(campaign.settings),
      npcTemplates: gm ? clone(campaign.npcTemplates) : undefined,
      npcRoster: gm ? clone(campaign.npcRoster || []) : undefined,
      crewLocations: gm ? (campaign.encounter?.units || []).map(unit => ({ id: unit.id, characterId: unit.characterId, location: clone(unit.location || null), timedAction: unit.timedAction?.kind === "move" ? { kind: "move" } : null })) : undefined,
      lastAward: gm ? campaign.awardHistory.at(-1) || null : undefined,
      dramaDeck: gm
        ? {
            drawCount: dramaDeck.drawPile.length,
            discardCount: dramaDeck.discardPile.length,
            discard: dramaDeck.discardPile.map(dramaCardState).filter(Boolean),
            handCounts: Object.fromEntries(campaign.characters.map((record) => [record.id, (dramaDeck.hands[record.id] || []).length])),
            playEvents: dramaDeck.playEvents.map((event) => ({ ...clone(event), card: dramaCardState(event.cardId) })),
          }
        : ownId
          ? {
              cost: DRAMA_CARD_COST,
              handLimit: DRAMA_CARD_HAND_LIMIT,
              hand: (dramaDeck.hands[ownId] || []).map(dramaCardState).filter(Boolean),
              playEvents: dramaDeck.playEvents.map((event) => ({ ...clone(event), card: dramaCardState(event.cardId) })),
            }
          : undefined,
      joinRequests: gm ? clone(campaign.joinRequests.filter((request) => request.status === "pending")) : undefined,
      inbox: gm ? clone(campaign.privateNotes.slice(-GM_INBOX_LIMIT)) : undefined,
      characters: campaign.characters.map((record) => ({
        ...publicCharacter(record, {
          gm,
          own: record.id === ownId,
          notes: limitedNotes(notesByCharacter.get(record.id) || [], PLAYER_INBOX_LIMIT),
        }),
        claimed: (campaign.players||[]).some(p=>p.characterId===record.id),
        connected: connectedIds.has(record.id),
      })),
      starships: campaign.starships
        .filter((record) => gm || record.controlType === "pc")
        .map(record=>{
          const live=this.liveEncounter(campaign.code)||campaign.encounter;
          if(campaign.showcase&&session?.compactShowcase&&!session.loadedShipIds?.includes(record.id)&&!record.crewCharacterIds?.includes(ownId)&&!live?.starships?.some(s=>s.id===record.id)){if(!showcaseSummaryCache.has(record.ship))showcaseSummaryCache.set(record.ship,SHIP_POWER.output(record,[]));return {id:record.id,title:record.title,constructionCost:require('./ship-budget').cost(record.ship||{}),controlType:record.controlType,crewCharacterIds:record.crewCharacterIds,crewNpcUnitIds:record.crewNpcUnitIds,characterLocations:record.characterLocations,lazyLayout:true,sensorSummary:SHIP_MAP.sensorStats(record),powerSummary:showcaseSummaryCache.get(record.ship),hullCount:record.ship.gridCells.length,ship:{title:record.title,class:record.ship.class,mapColor:record.ship.mapColor,warpState:record.ship.warpState?Object.fromEntries(['phase','remaining','targetLY','traveledLY'].map(key=>[key,record.ship.warpState[key]])):undefined,gridCells:[],placements:[],sicInventory:[],maximumHullHp:record.ship.maximumHullHp}};}
          const visible=publicStarship(record);if(campaign.interfaceVersion==='0.3'&&!campaign.showcase){visible.ship.groupCredits=campaign.shipCredits;visible.ship.allowCreditDebt=campaign.sessionNumber===0;if(visible.ship.confirmed)visible.ship.confirmed.groupCredits=campaign.shipCredits;}if(!gm&&session?.role!=='viewer'&&!record.crewCharacterIds?.includes(ownId)){delete visible.ship.cleanserState;delete visible.ship.atmosphereState;delete visible.ship.cloakState;delete visible.ship.crewRoomState;delete visible.ship.fabricationState;delete visible.ship.fieldState;delete visible.ship.droneState;delete visible.ship.probeState;}
          const encounter=this.liveEncounter(campaign.code)||campaign.encounter;
          const interiorRoom=encounter?.hasEngagedClock&&!encounter.encounterEndedAt?encounter:transitRoom(campaign);const interiorShip=interiorRoom.starships.find(s=>s.id===record.id)||record;require('./ship-intruders').reconcile(interiorRoom);visible.intrudersDetected=Boolean(interiorShip.ship.intruderState?.detected?.length);visible.interiorOccupants=(interiorRoom.units||[]).filter(u=>u.team==='npc'&&u.location?.starshipId===record.id&&(gm||require('./ship-intruders').visible(interiorRoom,interiorShip,u))).map(u=>({id:u.id,name:u.characterName,color:u.color,currentHp:u.currentHp,location:clone(u.location)}));
          const shieldSource=encounter?.starships?.find(ship=>ship.id===record.id);
          if(gm||record.crewCharacterIds?.includes(ownId)){
            if(shieldSource?.shieldSystems)visible.shieldSystems=Object.fromEntries(Object.entries(shieldSource.shieldSystems).map(([id,system])=>[id,{hp:system.hp}]));
          }else{delete visible.shieldSystems;delete visible.ship.shieldSystems;}
          if(!this.canPassTime(campaign.code)&&!encounter?.encounterEndedAt){
            visible.characterLocations=clone(visible.characterLocations||{});
            for(const unit of encounter?.units||[]){
              if(!record.crewCharacterIds?.includes(unit.characterId))continue;
              if(unit.location?.starshipId===record.id)visible.characterLocations[unit.characterId]=clone(unit.location);
            }
          }
          return visible;
        }),
      carryOptions:ownId?(()=>{const room=transitRoom(campaign),unit=room.units.find(u=>u.characterId===ownId);return unit&&unit.currentHp>0?{shipId:unit.location?.starshipId,carryingId:unit.carryingId,patients:require('./crew-carry').candidates(room,unit).map(p=>({id:p.id,name:p.characterName}))}:null;})():null,
      rollRequests: clone(requests.slice(-50)).map(request=>{if(!gm)for(const result of Object.values(request.results||{}))delete result.reputation;return request;}),
    };
  }

  async broadcast(code, campaignValue = null) {
    const campaign = campaignValue || await this.campaign(code);
    if (!campaign) return;
    for (const client of this.clients.get(code) || []) {
      writeEvent(client.response, "campaign", this.state(campaign, client.token));
    }
  }

  async checkpoint(campaign,reason,encounter=null){
    if(!campaign)return;
    const value=clone(campaign);if(encounter)value.encounter=clone(encounter);
    return require('./encounter-checkpoints').save(this.store,value,reason);
  }

  async saveEncounter(code, encounter) {
    const campaign = await this.campaign(code);
    if (!campaign) return false;
    const previous = this.saveQueues.get(code) || Promise.resolve();
    const queued = previous.catch(() => {}).then(async () => {
      if(this.campaignCache.get(code)!==campaign)return false; // A loaded/recovered campaign supersedes queued writes from the old object.
      const npcRoster = [...new Map([...(campaign.npcRoster || []), ...(encounter.units || []).filter(unit => unit.team === "npc")].map(unit => [unit.id, clone(unit)])).values()].slice(-200);
      const positions = value => JSON.stringify([value?.hasEngagedClock,value?.running,value?.hardPaused,value?.pausedForTurn,value?.encounterEndedAt,(value?.units||[]).map(u=>[u.characterId,u.location])]);
      const locationsChanged=positions(campaign.encounter)!==positions(encounter);
      const updatedAt = new Date().toISOString();
      const revision = (Number(campaign.revision) || 1) + 1;
      const next = { ...clone(campaign), encounter: clone(encounter), npcRoster, updatedAt, revision };
      require("./campaign-starmaps").saveSystem(next,encounter);
      const ending=encounter.encounterEndedAt&&!campaign.encounter?.encounterEndedAt;
      const authoritative=ending||encounter.hasEngagedClock&&!encounter.encounterEndedAt;
      let transitChanged=false;
      if(authoritative){
        for(const ship of next.starships){const live=encounter.starships?.find(s=>s.id===ship.id);if(!live)continue;
          const before=JSON.stringify([ship.ship,ship.characterLocations]);
          require('./ship-state').persist(ship,live);
          if(before!==JSON.stringify([ship.ship,ship.characterLocations]))transitChanged=true;
        }
        require('./ship-state').locations(next.starships,encounter.units);
        transitChanged ||= locationsChanged;
      }
      if(encounter.hasEngagedClock&&!encounter.encounterEndedAt&&Date.now()-(this.lastCheckpoint?.get(code)||0)>=60000){
        await this.checkpoint(next,'Automatic combat checkpoint');(this.lastCheckpoint||=new Map()).set(code,Date.now());
      }
      if (!campaign.showcase) await this.store.save(next);
      // Publish to the cache only after durable storage succeeds.
      Object.assign(campaign, { starmaps:next.starmaps, spaceObjects:next.spaceObjects, encounter: next.encounter, ...(ending||transitChanged?{starships:next.starships}:{}), npcRoster, updatedAt, revision });
      if(transitChanged&&Date.now()-(this.lastShipBroadcast?.get(code)||0)>=2000){(this.lastShipBroadcast||=new Map()).set(code,Date.now());await this.broadcast(code,campaign);}
      if(locationsChanged)for(const client of this.clients.get(code)||[]){
        const gm=this.session(client.token,code)?.role==='gm';
        const ships=campaign.starships.filter(ship=>gm||ship.controlType==='pc');
        const units=(encounter.units||[]).filter(unit=>ships.some(ship=>ship.crewCharacterIds.includes(unit.characterId)))
          .map(unit=>({characterId:unit.characterId,location:clone(unit.location)}));
        writeEvent(client.response,'encounter-locations',{units,deployedShipIds:(encounter.starships||[]).filter(s=>ships.some(v=>v.id===s.id)).map(s=>s.id),encounterEndedAt:encounter.encounterEndedAt,combatActive:Boolean(encounter.hasEngagedClock&&!encounter.encounterEndedAt),clockRunning:Boolean(encounter.running&&!encounter.hardPaused)});
      }
    });
    this.saveQueues.set(code, queued);
    try { await queued; }
    finally { if (this.saveQueues.get(code) === queued) this.saveQueues.delete(code); }
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

  async personalDamageStatistics(code,targetId,attackerId,amount,receipt){
    const campaign=await this.campaign(code);if(!campaign)return;
    const stats=require('./character-statistics');
    const target=campaign.characters.find(c=>c.id===targetId),attacker=campaign.characters.find(c=>c.id===attackerId);
    if(target)stats.damage(target.character,'taken',amount,receipt);
    if(attacker)stats.damage(attacker.character,'dealt',amount,receipt);
    await this.save(campaign);
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
    await this.campaign(code);
    return Boolean(this.characterSession(token, code, characterId));
  }

  async verifyGmAccess(code, token) {
    await this.campaign(code);
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
      if(campaign.interfaceVersion==='0.3'&&(!campaign.roomOpen||!this.session(token,code))){res.writeHead(403);res.end("Room access required");return true;}
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const client = { response: res, token };
      const set = this.clients.get(code) || new Set();
      this.clients.set(code, set);
      set.add(client);
      await this.broadcast(code,campaign);
      const heartbeat = setInterval(() => res.write(`: keep-alive ${Date.now()}\n\n`), 25000);
      req.on("close", () => {
        clearInterval(heartbeat);
        set.delete(client);
        void this.broadcast(code).catch(()=>{});
      });
      return true;
    }

    let body = {};
    if (req.method !== "GET") {
      try {
        body = require("./skill-catalog").migrate(await readBody(req));
      } catch {
        sendJson(res, 400, { error: "Bad JSON" });
        return true;
      }
    }
    const code = String(body.code || url.searchParams.get("code") || "").trim().toUpperCase();
    const token = String(body.token || url.searchParams.get("token") || "");

    if(await require("./campaign-v03").handle(this,{path,req,res,body,code,token,sendJson,defaultCampaign,normalizeCampaign,campaignCode,normalizeStarshipRecord,shipMap:SHIP_MAP,shipPower:SHIP_POWER})) return true;

    if (path === "/api/campaign/showcase/start" && req.method === "POST") {
      for (const [expiredCode, record] of this.showcases) {
        if (record.expiresAt <= Date.now()) {
          this.showcases.delete(expiredCode);
          this.campaignCache.delete(expiredCode);
          this.deleteEncounter(expiredCode);
        }
      }
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let showcaseCode = "";
      do {
        showcaseCode = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
      } while (this.showcases.has(showcaseCode) || await this.store.get(showcaseCode));

      const pcDefinitions = [
        { id: "showcase-nova", playerName: "Player One", characterName: "Nova Vale", color: "#35c9ff", speed: 6.2, commandWindow: 44, moveSpeed: 4, hp: 36, damageReduction: 1, weaponId: "standard-sidearm", attributes: { strength: [0, 0, -1, -1], health: [1, 0, -1, -1], perception: [1, 1, -1, -1], dexterity: [2, 1, -1, -1], luck: [0, 0, -1, -1], charisma: [1, 0, -1, -1], intellect: [1, 1, -1, -1], willpower: [1, 0, -1, -1] }, skills: { Initiative: 2.2, Awareness: 2, Projectile: 2.4, "Dodge": 1.8, Melee: 0.8, "Weapon Mechanics": 1.2 } },
      ];
      Object.assign(pcDefinitions[0].skills,{'Computer Systems':5,Engineering:5,Hacking:4,'Piloting':6,'Sensor Systems':5.5,'Weapon Systems':6,Mathematics:4,Awareness:4,Initiative:4,'Dodge':3.5});
      Object.assign(pcDefinitions[0].attributes,{dexterity:[3,2,1,-1],intellect:[4,3,1,-1],perception:[3,2,1,-1]});
      Object.assign(pcDefinitions[0],{speed:15,commandWindow:120,moveSpeed:3,hp:30,damageReduction:0});
      pcDefinitions.push({...structuredClone(pcDefinitions[0]),id:'showcase-orion',playerName:'Player Two',characterName:'Orion Reed',color:'#f5b85b'});
      const characters = pcDefinitions.map(showcaseCharacter);
      characters[0].character.experience.available+=2000;characters[0].character.experience.totalGained+=2000;
      characters[0].character.resources.exertionCurrent=1;characters[0].character.resources.exertionMax=1;
      for (const record of characters) record.character.campaignLink = { roomCode: showcaseCode, campaignName: "Explore Features", status: "linked", requestId: "", message: "" };
      const pcShip = showcaseShip("showcase-pc-ship", "Wayfinder", "pc", characters.map((record) => record.id), 146);
      const showcaseNpcUnitIds = Array.from({length:4},(_,i)=>'unit-showcase-npc-'+i);
      const npcShip = showcaseShip("showcase-npc-ship", "Red Horizon", "gm", [], 148, showcaseNpcUnitIds);
      const campaign = defaultCampaign({ code: showcaseCode, name: "Explore Features", gmCode: uid("showcase") });
      campaign.showcase = true;
      campaign.characters = characters;
      campaign.starships = [pcShip, npcShip];
      campaign.shipCredits = 9999999;
      campaign.settings.hideRoomCode = false;
      const selectedNpcs = ['Space Slug','Civilian','Security Guard','Final Boss'].map(name=>SHOWCASE_NPCS.find(npc=>npc.name===name));
      const pcSquares = [pcShip.ship.placements.find(p=>require('./ship-map-core').definition(pcShip.ship.sicInventory.find(i=>i.id===p.sicId)?.type).bridge).cell];
      const npcSquares = [npcShip.ship.placements.find(p=>require('./ship-map-core').definition(npcShip.ship.sicInventory.find(i=>i.id===p.sicId)?.type).bridge).cell];
      const units = pcDefinitions.map((entry, index) => ({
        id: `unit-${entry.id}`, playerName: entry.playerName, characterName: entry.characterName, speed: entry.speed,
        commandWindow: entry.commandWindow, atb: 0, encounterSpeedBonus: 0, regenerationRate: 0,
        regenerationProgress: 0, recurringHealingProgress: 0, delay: null, delayTimer: null, delayedAction: null, queuedEffects: [],
        controlledBy: "player", team: "pc", allyNpc: false, actorType: "character", color: entry.color, tieSeed: index / 10,
        characterId: entry.id, playerConnected: false, moveSpeed: entry.moveSpeed, dexterityBoxes: entry.attributes.dexterity.reduce((n,v)=>n+Math.max(0,v+1),0), highestPerceptionDie: Math.max(...entry.attributes.perception.filter(v=>v>=0).map(v=>[4,6,8,10,12][v])),
        weaponMechanics: entry.skills["Weapon Mechanics"] || 0, dexterityDice: entry.attributes.dexterity.filter(v=>v>=0).map(v=>[4,6,8,10,12][v]),strengthDice:entry.attributes.strength.filter(v=>v>=0).map(v=>[4,6,8,10,12][v]),intellectDice:entry.attributes.intellect.filter(v=>v>=0).map(v=>[4,6,8,10,12][v]),
        projectileSkill: entry.skills.Projectile || 0, meleeSkill: entry.skills.Melee || 0, dodgeSkill: entry.skills["Dodge"] || 0,
        engineeringSkill: entry.skills.Engineering || 0,
        pilotSkill: entry.skills['Piloting'] || 0,
        sensorSkill: entry.skills['Sensor Systems'] || 0,
        weaponSystemsSkill: entry.skills['Weapon Systems'] || 0,
        mathematicsSkill: entry.skills.Mathematics || 0,
        computerSkill: entry.skills['Computer Systems'] || 0,
        hackingSkill: entry.skills.Hacking || 0,
        damageReduction: entry.damageReduction, maximumHp: entry.hp, currentHp: entry.hp,
        weapons: [{ inventoryId: `${entry.id}-weapon`, weaponId: entry.weaponId }], heldWeaponId: `${entry.id}-weapon`, items: [],
        location: showcaseLocation(pcShip.id, pcSquares[index]??(pcSquares[0]+index)), travelRoute: [],
      }));
      units.push(...selectedNpcs.map((npc, index) => ({
        id: `unit-showcase-npc-${index}`, playerName: "GM", characterName: npc.name, speed: npc.speed, commandWindow: null,
        atb: 0, encounterSpeedBonus: 0, regenerationRate: 0, regenerationProgress: 0,
        recurringHealingProgress: 0, delay: null, delayTimer: null, delayedAction: null, queuedEffects: [], controlledBy: "gm",
        team: "npc", allyNpc: false, actorType: "character", color: npc.color, tieSeed: .5 + index / 10, characterId: "", playerConnected: false,
        moveSpeed: npc.moveSpeed, physicalAttribute: npc.physicalAttribute, mentalAttribute: npc.mentalAttribute,
        physicalSkill: npc.physicalSkill, mentalSkill: npc.mentalSkill, damageReduction: 0, maximumHp: npc.maximumHp, currentHp: npc.maximumHp,
        weapons: [{ inventoryId: `showcase-npc-${index}-weapon`, weaponId: npc.heldWeaponId }], heldWeaponId: `showcase-npc-${index}-weapon`, items: [],
        location: showcaseLocation(npcShip.id, npcSquares[index]??(npcSquares[0]+index)), travelRoute: [],
      })));
      for(const unit of units)if(unit.characterId)pcShip.characterLocations[unit.characterId]=clone(unit.location);
      campaign.encounter = { running: false, pausedForTurn: false, resumeAfterTurn: false, activeId: null, activeAction: null, attackResolution: null, itemResolution: null, vehicles: [], areaEffects: [], activeSource: null, commandRemaining: null, commandTotal: 0, commandExpired: false, hardPaused: false, holdPaused: false, commandHeldRemaining: null, lastInterruptedId: null, lastInterruptedAt: 0, encounterEndedAt: null, delayRequest: null, hasEngagedClock: false, threshold: 100, starships: campaign.starships, units, log: [{ id: uid("log"), at: new Date().toLocaleTimeString(), text: "Explore Features encounter prepared. Engage the clock when ready." }] };
      campaign.starships=[...campaign.starships,...require('./showcase-variants')()];
      require('./campaign-starmaps').seedShowcase(campaign);
      const normalized = normalizeCampaign(campaign);
      normalized.showcase = true;
      normalized.encounter.showcase = true;
      normalized.encounter.shipPositions = [{id:pcShip.id,q:0,r:0},{id:npcShip.id,q:10,r:0}];
      normalized.encounter.log.push({id:uid('log'),at:new Date().toLocaleTimeString(),text:'Playtest: Nova Vale and Space Slug. Ships use their calculated Masking and Defense, without scenario overrides.'});
      const encounterTemplate = clone(normalized.encounter);
      normalized.encounter.encounterEndedAt = Date.now();
      normalized.encounter.log = [];
      this.showcases.set(showcaseCode, { campaign: normalized, encounterTemplate, expiresAt: Date.now() + SHOWCASE_LIFETIME_MS });
      this.campaignCache.set(showcaseCode, normalized);
      this.restoreEncounter(showcaseCode, normalized.encounter);
      const gmToken = this.newSession(showcaseCode, "gm");
      const players = normalized.characters.map((record) => ({ id: record.id, name: safeCharacterName(record), token: this.newSession(showcaseCode, "character", record.id), color: record.character?.presentation?.atbColor || "#39e58f" }));
      sendJson(res, 200, { code: showcaseCode, gmToken, players });
      return true;
    }

    if (path === "/api/campaign/create" && req.method === "POST") {
      const name = String(body.name || "").trim();
      const gmCode = String(body.gmCode ?? body.password ?? "");
      if (!name || !gmCode) {
        sendJson(res, 400, { error: "Campaign Name and GM Code are required." });
        return true;
      }
      const duplicate = (await this.campaignsNamed(name)).some((entry) => passwordMatches(gmCode, entry.gmCode));
      if (duplicate) {
        sendJson(res, 409, { error: "That Campaign Name and GM Code combination is already in use. Choose a different name or GM Code." });
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
      const candidates = name ? (await this.campaignsNamed(name)).filter(c=>c.interfaceVersion!=='0.3') : [];
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
      const candidates = name ? (await this.campaignsNamed(name)).filter(c=>c.interfaceVersion!=='0.3') : [];
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

    const loadingBackup = path === "/api/campaign/backup/load" && req.method === "POST";
    const campaign = loadingBackup ? null : await this.campaign(code);
    if (!loadingBackup && !campaign) {
      sendJson(res, 404, { error: "Campaign not found." });
      return true;
    }

    if(campaign?.interfaceVersion==='0.3') {
      if(!campaign.roomOpen){sendJson(res,410,{error:'The GM has closed this room.'});return true;}
      if(!this.session(token,code)){sendJson(res,403,{error:'Join the room first.'});return true;}
      if(['/api/campaign/character/create','/api/campaign/character/unlock','/api/campaign/join/request','/api/campaign/join/respond'].includes(path)){sendJson(res,409,{error:'Use the room lobby to create, claim or import characters.'});return true;}
      if(['/api/campaign/starship/link','/api/campaign/starship/crew'].includes(path)&&!this.gmSession(token,code)){sendJson(res,403,{error:'Only the GM may import ships or assign crew.'});return true;}
    }

    if(await require('./crew-logs').handle(this,{path,req,res,body,campaign,token,sendJson}))return true;
    if(path==='/api/campaign/starship/details'&&req.method==='POST'){
      const session=this.session(token,code),gm=this.gmSession(token,code);if(!session){sendJson(res,403,{error:'Join the room first.'});return true;}
      const ids=[...new Set((Array.isArray(body.ids)?body.ids:[]).map(String))],ships=campaign.starships.filter(s=>ids.includes(s.id)&&(gm||s.controlType==='pc'));
      if(ships.length!==ids.length||ids.length>6){sendJson(res,403,{error:'Choose up to six available ships.'});return true;}
      session.loadedShipIds=[...new Set([...(session.loadedShipIds||[]),...ids])];sendJson(res,200,{starships:ships.map(record=>{const result=publicStarship(record);if(campaign.interfaceVersion==='0.3'&&!campaign.showcase){result.ship.groupCredits=campaign.shipCredits;result.ship.allowCreditDebt=campaign.sessionNumber===0;if(result.ship.confirmed)result.ship.confirmed.groupCredits=campaign.shipCredits;}return result;})});return true;
    }
    if (path === "/api/campaign/state" && req.method === "GET") {
      const currentSession=this.session(token,code);if(currentSession&&url.searchParams.get('compact')==='1')currentSession.compactShowcase=true;
      sendJson(res, 200, this.state(campaign, token));
      return true;
    }

    if (path === "/api/campaign/starship/link" && req.method === "POST") {
      const exteriorError = SHIP_MAP.exteriorError(body.starship);
      if (exteriorError) { sendJson(res, 400, { error: exteriorError }); return true; }
      if (!body.starship?.confirmedOnce) {
        sendJson(res, 400, { error: "Confirm the starship's construction before linking it." });
        return true;
      }
      const supplied = normalizeStarshipRecord({
        id: body.starship?.id,
        ship: body.starship,
        controlType: body.controlType,
        crewCharacterIds: [],
      });
      const powerError = SHIP_POWER.constructionError(supplied);
      if (powerError) { sendJson(res, 400, { error: powerError }); return true; }
      const airlockError=SHIP_MAP.ensureAirlocks(supplied.ship);
      if(airlockError){sendJson(res,400,{error:airlockError});return true;}
      if (!supplied.ship.gridCells.length) {
        sendJson(res, 400, { error: "Confirm the starship's construction before linking it." });
        return true;
      }
      const existing = campaign.starships.find((record) => record.id === supplied.id);
      if (existing) {
        sendJson(res, 409, { error: "That starship is already linked to this campaign." });
        return true;
      }
      supplied.accessKey = crypto.randomBytes(24).toString("base64url");
      campaign.starships.push(supplied);
      await this.save(campaign);
      sendJson(res, 201, { starship: publicStarship(supplied), accessKey: supplied.accessKey, campaignName: campaign.name });
      return true;
    }

    if(path==='/api/campaign/reputation'&&req.method==='POST'){
      if(!this.gmSession(token,code)){sendJson(res,403,{error:'GM access required.'});return true;}
      try{
        const rep=REPUTATION.state(campaign),receipt=String(body.receipt||'');
        if(!receipt)throw Error('A request receipt is required.');
        if(!rep.receipts.includes(receipt)){
          if(body.kind==='attitude'){
            const npcId=String(body.npcId||'general');
            if(npcId!=='general'&&!campaign.starships.some(s=>s.id===npcId)&&!this.liveEncounter(code)?.starships.some(s=>s.id===npcId))throw Error('Choose an NPC ship.');
            REPUTATION.setAttitude(campaign,npcId,body.values);
          }else if(body.kind==='reroll'){
            const previous=rep.contacts[body.key||rep.activeKey],ship=campaign.starships.find(s=>s.id===previous?.shipId);
            if(!ship)throw Error('No recognition check is available yet.');
            REPUTATION.recognize(campaign,ship,previous.npcId,previous.key,{reroll:true});
          }else if(body.kind==='edit'){
            const ship=campaign.starships.find(s=>s.id===body.shipId);if(!ship)throw Error('Ship not found.');
            if(!Array.isArray(body.values)||body.values.length!==5||body.values.some(n=>!Number.isInteger(n)||n<0||n>10)||!Number.isInteger(body.popularity)||body.popularity<0||body.popularity>100)throw Error('Choose valid Reputation and Popularity values.');
            ship.ship.reputationSelections=body.values.slice();ship.ship.popularity=body.popularity;
          }else throw Error('Choose a Reputation action.');
          rep.receipts.push(receipt);rep.receipts=rep.receipts.slice(-500);
        }
        await this.save(campaign);sendJson(res,200,{campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,400,{error:error.message});}return true;
    }
    if(path==='/api/campaign/quick-prompts'&&req.method==='POST'){
      if(!this.gmSession(token,code)){sendJson(res,403,{error:'GM access required.'});return true;}
      const column=String(body.column||'everyone');
      if(column!=='everyone'&&!campaign.characters.some(c=>c.id===column)){sendJson(res,400,{error:'Character not found.'});return true;}
      if(body.kind==='reverence'){
        campaign.quickPromptReceipts||=[];const receipt=String(body.receipt||'');
        if(!receipt){sendJson(res,400,{error:'A request receipt is required.'});return true;}
        if(!campaign.quickPromptReceipts.includes(receipt)){
          for(const record of campaign.characters.filter(c=>column==='everyone'||c.id===column))applyConditionalDelivery(campaign,record,{kind:'award',resource:'reverence',amount:1,message:'The GM sent 1 Reverence. Claim this reward when you are ready.'});
          campaign.quickPromptReceipts.push(receipt);campaign.quickPromptReceipts=campaign.quickPromptReceipts.slice(-300);
        }
      }else{
        if(!Array.isArray(body.presets)||body.presets.length>(body.presets.some(p=>p.attribute==='Charisma'&&p.skill==='Persuasion')?11:10)||body.presets.some(p=>!p.name||!p.attribute||!p.skill||!Number.isInteger(p.difficulty))){sendJson(res,400,{error:'Choose up to ten prompts with whole-number difficulties.'});return true;}
        campaign.quickPrompts||={};campaign.quickPrompts[column]=body.presets.map(p=>({name:String(p.name).slice(0,80),attribute:String(p.attribute).slice(0,40),skill:String(p.skill).slice(0,80),difficulty:p.difficulty}));
      }
      await this.save(campaign);sendJson(res,200,{campaign:this.state(campaign,token)});return true;
    }
    if(path==='/api/campaign/statistics/roll'&&req.method==='POST'){
      const record=campaign.characters.find(c=>c.id===body.characterId);
      if(!record||!this.characterSession(token,code,record.id)){sendJson(res,403,{error:'Character access required.'});return true;}
      require('./character-statistics').roll(record.character,body.skill,body.score,body.receipt);
      REPUTATION.recordRoll(campaign,record.id,body);
      await this.save(campaign);sendJson(res,200,{statistics:record.character.statistics});return true;
    }
    if (path === "/api/campaign/starship/save" && req.method === "POST") {
      const record = campaign.starships.find((entry) => entry.id === String(body.starship?.id || body.starshipId || ""));
      if (!record) { sendJson(res, 404, { error: "Linked starship not found." }); return true; }
      const characterId = String(body.characterId || "");
      const gmAccess = Boolean(this.gmSession(token, code));
      const crewAccess = Boolean(characterId && record.crewCharacterIds.includes(characterId) && this.characterSession(token, code, characterId));
      const ownerAccess = Boolean(!record.crewCharacterIds.length && body.accessKey && body.accessKey === record.accessKey);
      if (!gmAccess && !crewAccess && !ownerAccess) { sendJson(res, 403, { error: "Only assigned crew or the GM may edit this starship." }); return true; }
      const combat=this.liveEncounter(code)||campaign.encounter;
      if(!gmAccess&&combat?.hasEngagedClock&&!combat.encounterEndedAt){sendJson(res,409,{error:'you cannot perform this action in combat'});return true;}
      if(campaign.interfaceVersion==='0.3' && Number(body.buildRevision??-1)!==(record.buildRevision||0)){sendJson(res,409,{error:"Another crew member confirmed changes. Reopen this ship to use its latest layout."});return true;}
      if(JSON.stringify(body.starship?.resourceReceipts||[])!==JSON.stringify(record.ship.resourceReceipts||[])){sendJson(res,409,{error:'Ship stores changed while this builder was open. Reopen the ship before saving construction.'});return true;}
      const exteriorError = SHIP_MAP.exteriorError(body.starship);
      if (exteriorError) { sendJson(res, 400, { error: exteriorError }); return true; }
      const proposed=body.starship;
      const legacyShift=(Number(proposed.originOffset)||0)-(Number(record.ship.originOffset)||0);
      const remapping=SHIP_MAP.gridColumns(proposed)!==SHIP_MAP.gridColumns(record.ship)
        || (Number(proposed.originX)||0)!==(Number(record.ship.originX)||0)
        || (Number(proposed.originY)||0)!==(Number(record.ship.originY)||0) || legacyShift!==0;
      if(!Number.isInteger(legacyShift)||Math.abs(legacyShift)>=3600
        || ['originX','originY'].some(key=>proposed[key]!=null&&(!Number.isInteger(proposed[key])||Math.abs(proposed[key])>3600))
        || ['zoneColumns','zoneRows'].some(key=>proposed[key]!=null&&(!Number.isInteger(proposed[key])||proposed[key]<20||proposed[key]>60))){
        sendJson(res,400,{error:'Invalid construction dimensions.'});return true;
      }
      if(remapping&&!this.canPassTime(code)){sendJson(res,409,{error:'Expand or center the ship outside combat.'});return true;}
      const remap=square=>SHIP_MAP.remapSquare(square,record.ship,proposed)+legacyShift;
      const locations=Object.fromEntries(Object.entries(record.characterLocations||{}).map(([id,location])=>[id,{...location,square:remap(location.square)}]));
      const updated = normalizeStarshipRecord({ ...record,characterLocations:locations, ship: body.starship, title: body.starship?.title, accessKey: record.accessKey });
      // Fame is GM-owned, independent of construction saves and stale editor copies.
      updated.ship.popularity=record.ship.popularity||0;
      updated.ship.reputationSelections=clone(record.ship.reputationSelections||[5,5,5,5,5]);
      const powerError = SHIP_POWER.constructionError(updated);
      if (powerError) { sendJson(res, 400, { error: powerError }); return true; }
      const airlockError=SHIP_MAP.ensureAirlocks(updated.ship);
      if(airlockError){sendJson(res,400,{error:airlockError});return true;}
      const hullSource=this.liveEncounter(code)?.starships.find(s=>s.id===record.id)||record,hullDelta=SHIP_MAP.hullHp(updated)-SHIP_MAP.hullHp(record);
      updated.ship.maximumHullHp=Math.max(0,Number(hullSource.maximumHullHp??record.ship.maximumHullHp??SHIP_MAP.hullHp(record))+hullDelta);
      updated.ship.currentHullHp=Math.max(0,Math.min(updated.ship.maximumHullHp,Number(hullSource.currentHullHp??record.ship.currentHullHp??updated.ship.maximumHullHp-hullDelta)+hullDelta));
      updated.ship.gravityEnabled=record.ship.gravityEnabled!==false;
      updated.ship.oxygenEnabled=record.ship.oxygenEnabled!==false;
      updated.ship.oxygenState=clone(record.ship.oxygenState||null);
      for(const key of TRANSIT_FIELDS.filter(key=>key!=='airlocks'))updated.ship[key]=clone(record.ship[key]??null);
      if(remapping&&updated.ship.breachState)for(const hole of Object.values(updated.ship.breachState.holes||{}))hole.square=remap(hole.square);
      if(/^#[0-9a-f]{6}$/i.test(body.starship?.mapColor||''))updated.ship.mapColor=body.starship.mapColor;updated.auState=clone(record.auState??null);
      const cameraSource=(!this.canPassTime(code)&&this.liveEncounter(code)?.starships.find(s=>s.id===record.id))||record;
      if(cameraSource.ship.surveillanceState){
        updated.ship.surveillanceState=clone(cameraSource.ship.surveillanceState);
        updated.ship.doorDamage=Object.fromEntries(Object.entries(cameraSource.ship.doorDamage||{}).map(([key,value])=>[remapping?key.split(':').map(n=>remap(Number(n))).sort((a,b)=>a-b).join(':'):key,value]));
        updated.ship.doorStates=Object.fromEntries(Object.entries(cameraSource.ship.doorStates||{}).map(([key,value])=>[remapping?key.split(':').map(n=>remap(Number(n))).sort((a,b)=>a-b).join(':'):key,value]));
      }
      for(const [id,loc]of Object.entries(record.characterLocations||{}))if(loc.escapePodId)updated.characterLocations[id]=clone(loc);
      if(campaign.starships.some(s=>s.ship.fieldState?.dockedIn?.shipId===record.id&&!updated.ship.placements.some(p=>p.sicId===s.ship.fieldState.dockedIn.sicId))){sendJson(res,409,{error:'Undock the vessel before removing its occupied Docking Bay.'});return true;}
      for(const item of updated.ship.sicInventory||[]){
        const prior=(this.liveEncounter(code)?.starships.find(s=>s.id===record.id)||record).ship.sicInventory?.find(i=>i.id===item.id);if(!prior)continue;
        for(const key of ['status','disabled','impaired','impairmentPoints','repairDifficulty','bootRemaining','unstable','printed','printedFor','salvaged','salvageSource']){if(key in prior)item[key]=clone(prior[key]);else delete item[key];}
      }
      for(const item of updated.ship.sicInventory)if(item.printed&&updated.ship.placements.some(p=>p.sicId===item.id)){if(item.printedFor&&item.printedFor!==record.id){sendJson(res,409,{error:'This printed SIC is licensed to another starship.'});return true;}item.printedFor=record.id;}
      if(campaign.interfaceVersion==='0.3'&&!campaign.showcase){try{require('./ship-budget').spend(campaign,require('./ship-budget').buildDelta(record.ship,updated.ship,Array.isArray(body.destroyedIds)?body.destroyedIds:[]));updated.ship.groupCredits=campaign.shipCredits;updated.ship.allowCreditDebt=campaign.sessionNumber===0;if(updated.ship.confirmed)updated.ship.confirmed.groupCredits=campaign.shipCredits;}catch(error){sendJson(res,409,{error:error.message});return true;}}
      updated.ship.constructionCost=require('./ship-budget').cost(updated.ship);
      updated.buildRevision=(record.buildRevision||0)+1;
      updated.controlType = record.controlType;
      updated.crewCharacterIds = record.crewCharacterIds;
      updated.crewNpcUnitIds = record.crewNpcUnitIds || [];
      updated.createdAt = record.createdAt;
      updated.updatedAt = new Date().toISOString();
      campaign.starships[campaign.starships.indexOf(record)] = updated;
      if(remapping)for(const npc of campaign.npcRoster||[]){if(npc.location?.starshipId===record.id&&Number.isInteger(npc.location.square))npc.location={...npc.location,square:remap(npc.location.square)};}
      // Synchronize the construction before any encounter snapshot can restore the old layout.
      const liveRoom=this.liveEncounter(code),liveShip=liveRoom?.starships.find(s=>s.id===updated.id);
      if(liveShip){liveShip.maximumHullHp=updated.ship.maximumHullHp;liveShip.currentHullHp=updated.ship.currentHullHp;liveShip.ship={...clone(updated.ship),...Object.fromEntries(TRANSIT_FIELDS.map(k=>[k,clone(liveShip.ship[k]??updated.ship[k]??null)]))};if(remapping){liveShip.ship.breachState=clone(updated.ship.breachState);liveShip.ship.doorStates=clone(updated.ship.doorStates);liveShip.ship.doorDamage=clone(updated.ship.doorDamage);}liveShip.ship.mapColor=updated.ship.mapColor;liveShip.title=updated.title;liveShip.characterLocations=clone(updated.characterLocations);if(remapping)for(const u of liveRoom.units)if(u.location?.starshipId===updated.id&&Number.isInteger(u.location.square))u.location.square=remap(u.location.square);}
      const savedShip=campaign.encounter?.starships?.find(s=>s.id===updated.id);if(savedShip){savedShip.maximumHullHp=updated.ship.maximumHullHp;savedShip.currentHullHp=updated.ship.currentHullHp;savedShip.ship=clone(liveShip?.ship||updated.ship);savedShip.title=updated.title;}
      await this.save(campaign);
      sendJson(res, 200, { starship: publicStarship(updated) });
      return true;
    }

    if (path === "/api/campaign/starship/crew" && req.method === "POST") {
      const record = campaign.starships.find((entry) => entry.id === String(body.starshipId || ""));
      if (!record) { sendJson(res, 404, { error: "Linked starship not found." }); return true; }
      const callerId = String(body.characterId || "");
      const gmAccess = Boolean(this.gmSession(token, code));
      const callerAccess = Boolean(callerId && this.characterSession(token, code, callerId));
      if (!gmAccess && (!callerAccess || (record.crewCharacterIds.length && !record.crewCharacterIds.includes(callerId)))) {
        sendJson(res, 403, { error: "Once a ship has crew, only assigned crewmembers or the GM may change its roster." }); return true;
      }
      const validIds = new Set(campaign.characters.map((entry) => entry.id));
      record.crewCharacterIds = [...new Set((Array.isArray(body.crewCharacterIds) ? body.crewCharacterIds : []).map(String))].filter((id) => validIds.has(id));
      const liveNpcs=(this.liveEncounter(code)?.units||[]).filter(u=>u.team==='npc');
      campaign.npcRoster=[...new Map([...(campaign.npcRoster||[]),...(campaign.encounter?.units||[]).filter(u=>u.team==='npc'),...liveNpcs].map(u=>[u.id,clone(u)])).values()];
      const encounterNpcIds=new Set(campaign.npcRoster.map(u=>String(u.id)));
      if(gmAccess&&Array.isArray(body.crewNpcUnitIds)){const ids=[...new Set(body.crewNpcUnitIds.map(String))];if(ids.some(id=>!encounterNpcIds.has(id))){sendJson(res,409,{error:'The NPC roster changed. Refresh and assign the current NPC.'});return true;}record.crewNpcUnitIds=ids;}
      for(const list of [this.liveEncounter(code)?.starships,campaign.encounter?.starships]){const live=list?.find(s=>s.id===record.id);if(live){live.crewCharacterIds=clone(record.crewCharacterIds);live.crewNpcUnitIds=clone(record.crewNpcUnitIds||[]);}}
      record.characterLocations ||= {};
      for (const id of Object.keys(record.characterLocations)) if (!record.crewCharacterIds.includes(id)) delete record.characterLocations[id];
      record.ship.crewCharacterIds = clone(record.crewCharacterIds);
      record.ship.crewNpcUnitIds = clone(record.crewNpcUnitIds);
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { starship: publicStarship(record) });
      return true;
    }

    if(path==='/api/campaign/starship/airlock'&&req.method==='POST'){
      try {
      const gm=Boolean(this.gmSession(token,code)),characterId=String(body.characterId||'');
      if(!gm&&!this.characterSession(token,code,characterId)){sendJson(res,403,{error:'Choose your own character.'});return true;}
      let room=this.canPassTime(code)?transitRoom(campaign):this.liveEncounter(code);let unit=room.units.find(u=>characterId&&u.characterId===characterId||gm&&u.id===body.id);
      const validation=clone(room);require('./ship-breaches').operate(validation,validation.units.find(u=>u.id===unit?.id),body);
      if(room.outsideCombat&&validation.starships.find(s=>s.id===body.starshipId)?.ship.airlockStates?.[body.airlockId]?.open&&this.ensureRescueEncounter){room=await this.ensureRescueEncounter(campaign,body.starshipId);unit=room.units.find(u=>characterId?u.characterId===characterId:u.id===body.id);}
      const text=require('./ship-breaches').operate(room,unit,body);if(!room.outsideCombat){campaign.encounter=this.environmentChanged(room,[]);require('./ship-state').persist(campaign.starships.find(s=>s.id===body.starshipId),room.starships.find(s=>s.id===body.starshipId));}await this.save(campaign);sendJson(res,200,{result:{text},campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}return true;
    }
    if (path === "/api/campaign/starship/door" && req.method === "POST") {
      const saved = campaign.starships.find((entry) => entry.id === String(body.starshipId || "")),live=!this.canPassTime(code)?this.liveEncounter(code):null;
      const record=live?.starships.find(s=>s.id===saved?.id)||saved;
      const characterId = String(body.characterId || ""); const key = String(body.doorKey || ""); const cells = key.split(":").map(Number);
      const gmAccess = Boolean(this.gmSession(token, code)); const crewAccess = Boolean(characterId && record?.crewCharacterIds.includes(characterId) && this.characterSession(token, code, characterId));
      const adjacent = cells.length === 2 && cells.every((cell) => Number.isInteger(cell) && record?.ship?.gridCells?.includes(cell)) && (Math.abs(cells[0] - cells[1]) === SHIP_MAP.gridColumns(record) || (Math.abs(cells[0] - cells[1]) === 1 && Math.floor(cells[0] / SHIP_MAP.gridColumns(record)) === Math.floor(cells[1] / SHIP_MAP.gridColumns(record))));
      if (!record || !adjacent || (!gmAccess && !crewAccess)) { sendJson(res, 403, { error: "Only assigned crew or the GM may operate that door." }); return true; }
      const doorOperator=(live||transitRoom(campaign)).units.find(u=>characterId&&u.characterId===characterId||gmAccess&&u.id===body.id);if(!doorOperator){sendJson(res,403,{error:'Choose an operator aboard this ship.'});return true;}
      if(!require('./ship-doors').list(record).includes(key)||!require('./ship-doors').canOperate(record,doorOperator,key)){sendJson(res,403,{error:'Operate remote doors from a Bridge station.'});return true;}
      if(require('./ship-doors').broken(record,key))throw Error('This door is broken open. Complete System Repairs and Diagnostics to repair it.');
      record.ship.doorStates ||= {}; record.ship.doorStates[key] = record.ship.doorStates[key] === "open" ? "closed" : "open"; record.updatedAt = new Date().toISOString();
      if(live){campaign.encounter=this.environmentChanged(live,[]);require('./ship-state').persist(saved,record);}
      await this.save(campaign); sendJson(res, 200, { open: record.ship.doorStates[key] === "open", starship: publicStarship(record), campaign: this.state(campaign, token) }); return true;
    }

    if(path==='/api/campaign/oxygen/roll'&&req.method==='POST'){
      const actorId=String(body.actorId||''),gm=Boolean(this.gmSession(token,code));
      if(!gm&&!this.characterSession(token,code,actorId)){sendJson(res,403,{error:'Only this character or the GM may resolve the oxygen check.'});return true;}
      const room=this.canPassTime(code)?null:this.liveEncounter(code),ships=room?.starships||campaign.starships,actors=OXYGEN.people(campaign,room);
      OXYGEN.sync(ships,actors);
      const result=OXYGEN.resolve(ships,actors,body);
      if(!result.ok){sendJson(res,409,{error:result.error});return true;}
      if(room){const snapshot=this.environmentChanged(room,result.events);if(snapshot)campaign.encounter=snapshot;}
      else this.timePassed(code,campaign.characters);
      this.environmentTicks.set(code,{at:Date.now(),saved:Date.now(),active:true});
      await this.save(campaign);
      sendJson(res,200,{ok:true,oxygen:this.environment(campaign,token),result:result.crew?.result});return true;
    }
    if(path==='/api/campaign/starship/resources'&&req.method==='POST'){
      const record=campaign.starships.find(s=>s.id===body.starshipId),gm=Boolean(this.gmSession(token,code)),characterId=String(body.characterId||'');
      if(!record||(!gm&&!(record.crewCharacterIds.includes(characterId)&&this.characterSession(token,code,characterId)))){sendJson(res,403,{error:'Only registered crew or the GM may manage these stores.'});return true;}
      if(!this.canPassTime(code)&&!(gm&&body.grantMineral)){sendJson(res,409,{error:'Manage ship stores outside combat.'});return true;}
      try{
        const receipt=String(body.requestId||'');if(!/^[\w-]{8,100}$/.test(receipt))throw Error('A stock transaction receipt is required.');
        record.ship.resourceReceipts ||= [];
        if(!record.ship.resourceReceipts.includes(receipt)){
          const sharedBudget=campaign.interfaceVersion==='0.3'&&!campaign.showcase;if(sharedBudget){record.ship.groupCredits=campaign.shipCredits;record.ship.allowCreditDebt=campaign.sessionNumber===0;}
          if(body.grantMineral){
            const name=String(body.grantMineral).trim(),quantity=Number(body.quantity);
            if(!gm||!/^[A-Za-z][A-Za-z .-]{0,39}$/.test(name)||['constructor','prototype'].includes(name)||!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error('Choose a mineral name and a positive whole quantity.');
            const live=this.liveEncounter(code),liveShip=live?.starships.find(s=>s.id===record.id),stores={...(liveShip?.ship.minerals||record.ship.minerals||{})};
            if((Number(stores[name])||0)+quantity>1000000)throw Error('Ship stores cannot exceed 1,000,000 of one mineral.');
            stores[name]=(Number(stores[name])||0)+quantity;record.ship.minerals=stores;
            if(liveShip){liveShip.ship.minerals=clone(stores);liveShip.ship.resourceReceipts=[...(liveShip.ship.resourceReceipts||[]),receipt].slice(-200);const snapshot=this.environmentChanged(live,[]);if(snapshot)campaign.encounter=snapshot;}
          }else if(body.purchaseMissile){
            require('./missile-ammunition').purchase(record.ship,body.purchaseMissile,Number(body.quantity),require('./ship-map-core').definition);
          }else if(body.purchaseGrade){
            const grade=String(body.purchaseGrade),price={F:50,D:100,C:300,B:800,A:2400,S:5000}[grade],quantity=Number(body.quantity);
            if(!price||!Number.isInteger(quantity)||quantity<1||quantity>10000)throw Error('Choose a fuel grade and a whole quantity.');
            if(!record.ship.allowCreditDebt&&Number(record.ship.groupCredits||0)<price*quantity)throw Error('Not enough ship Group Credits.');
            record.ship.warpFuel ||= {};record.ship.warpFuel[grade]=(Number(record.ship.warpFuel[grade])||0)+quantity;record.ship.groupCredits-=price*quantity;
          }else{
            if(!gm)throw Error('Only the GM may adjust stock without purchasing fuel.');
            const changes={};
            for(const key of ['warpFuel','minerals'])if(body[key]){
              if(typeof body[key]!=='object'||Array.isArray(body[key])||Object.keys(body[key]).length>50)throw Error('Invalid stock values.');
              changes[key]={...(record.ship[key]||{})};
              for(const [name,value] of Object.entries(body[key])){
                if(!/^[A-Za-z][A-Za-z .-]{0,39}$/.test(name)||['constructor','prototype'].includes(name)||!Number.isInteger(value)||value<0||value>1000000||(key==='warpFuel'&&!['F','D','C','B','A','S'].includes(name)))throw Error('Stock must be a nonnegative whole number.');
                changes[key][name]=value;
              }
            }
            Object.assign(record.ship,changes);
          }
          if(sharedBudget)campaign.shipCredits=record.ship.groupCredits;
          record.ship.resourceReceipts=[...record.ship.resourceReceipts,receipt].slice(-200);
          if(record.ship.confirmed)for(const key of ['warpFuel','minerals','missileAmmo','missileStorage','groupCredits','resourceReceipts'])record.ship.confirmed[key]=clone(record.ship[key]??{});
          await this.save(campaign);
        }
        sendJson(res,200,{starship:publicStarship(record),campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}
      return true;
    }
    if(path==='/api/campaign/starship/transit'&&req.method==='POST'){
      const record=campaign.starships.find(s=>s.id===(body.starshipId||body.shipId)),characterId=String(body.characterId||''),gm=Boolean(this.gmSession(token,code));
      if(!record||(!gm&&!(record.crewCharacterIds.includes(characterId)&&this.characterSession(token,code,characterId)))){sendJson(res,403,{error:'Registered crew or GM authorization is required.'});return true;}
      const live=this.canPassTime(code)?null:this.liveEncounter(code);
      if(live&&!['warpCancel','warpExit','destructCancel','blastRoll'].includes(body.kind)){sendJson(res,409,{error:'Use the combat console to start an operation.'});return true;}
      const room=live||transitRoom(campaign),target=room.starships.find(s=>s.id===record.id);
      const unit=room.units.find(u=>characterId&&u.characterId===characterId)||room.units.find(u=>gm&&u.id===body.id)||transitRoom(campaign).units.find(u=>characterId&&u.characterId===characterId);
      const commandRoom=unit&&!room.units.some(u=>u.id===unit.id)&&body.kind==='destructCancel'?{...room,units:[...room.units,unit]}:room;
      try{
        let result;
        if(!target)throw Error('Ship not found in the current encounter.');
        if(body.kind==='warpPlan')result=TRANSIT.plan(target,Number(body.distanceLY),{sicId:body.sicId});
        else if(body.kind==='blastRoll'){
          const pending=target.ship.destructState;
          if(!gm&&pending?.unitId!==unit?.id)throw Error('The initiating crewmember or GM must roll blast damage.');
          if(pending?.id!==body.blastId)throw Error('That detonation is no longer pending.');
          result=TRANSIT.resolveBlast(room,record.id,Number(body.score));
        }else{
          if(!unit)throw Error('Choose a registered crewmember aboard this ship.');
          result=TRANSIT.command(commandRoom,unit,{...body,shipId:record.id},{outsideCombat:!live});
        }
        if(result?.ok===false)throw Error(result.error);
        if(body.kind!=='warpPlan'){
          if(live){const snapshot=this.environmentChanged(room,result.events||[]);if(snapshot)campaign.encounter=snapshot;}
          for(const ship of room.starships){
            ship.ship.currentHullHp=ship.currentHullHp;ship.ship.currentShieldHp=ship.currentShieldHp;
            const saved=campaign.starships.find(s=>s.id===ship.id);if(saved&&live)for(const key of [...TRANSIT_FIELDS,'currentHullHp','currentShieldHp'])saved.ship[key]=clone(ship.ship[key]??null);
          }
          this.environmentTicks.set(code,{at:Date.now(),saved:Date.now(),active:true});
          await this.save(campaign);
        }
        sendJson(res,200,{result,campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}
      return true;
    }
    if(path==='/api/campaign/starship/field-utility'&&req.method==='POST'){
      const gm=Boolean(this.gmSession(token,code)),characterId=String(body.characterId||''),own=Boolean(characterId&&this.characterSession(token,code,characterId));
      const record=campaign.starships.find(s=>s.id===body.starshipId);
      if(!record||(!gm&&!own)){sendJson(res,403,{error:'An authenticated operator or GM is required.'});return true;}
      const candidate=this.liveEncounter(code)||campaign.encounter;let live=candidate&&!candidate.encounterEndedAt&&(body.kind==='inspect'||!this.canPassTime(code))?candidate:null,room=live||transitRoom(campaign);
      let unit=room.units.find(u=>characterId?u.characterId===characterId:gm&&u.id===body.id);
      try{
        const field=require('./ship-field-utilities');let result;
        if(['dock-clearance','decline-dock'].includes(body.kind)){
          if(!gm)throw Error('Only the GM may issue docking clearance.');
          const vessel=room.starships.find(s=>s.id===record.id),details=field.system(vessel,body.sicId),request=details.request;
          if(!request||request.id!==body.clearanceId)throw Error('That docking request is no longer current.');
          if(body.kind==='decline-dock'){details.request=null;result={text:'Docking request declined.'};}
          else{
            if(live&&(OXYGEN.pending(room.starships)||CREW_ROOMS.pending(room)||require('./ship-missiles').pending(room)||room.starships.some(s=>s.ship.destructState?.phase==='blastPending')||room.attackResolution||room.itemResolution||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length)))throw Error('Resolve pending dice before docking.');
            const operator=room.units.find(u=>request.characterId?u.characterId===request.characterId:u.id===request.unitId);
            result=field.command(room,operator,{...body,kind:'dock',targetId:request.targetId},{gm:true,campaign,outsideCombat:!live,clearance:true});if(!result.ok)throw Error(result.error);
          }
          if(live){campaign.encounter=this.environmentChanged(room,[],{resolve:true});for(const vessel of room.starships){const saved=campaign.starships.find(s=>s.id===vessel.id);if(saved)saved.ship.fieldState=clone(vessel.ship.fieldState??null);}}
          await this.save(campaign);
        }else if(body.kind==='inspect')result=field.inspect(room,unit,body.sicId,gm);
        else{
          if(live)throw Error('Use the live combat console for this action.');
          if(body.kind==='launch-pod'&&this.ensureRescueEncounter){const trial=clone(room),check=field.command(trial,trial.units.find(u=>u.id===unit?.id),body,{gm,campaign:clone(campaign),outsideCombat:true});if(!check.ok)throw Error(check.error);room=await this.ensureRescueEncounter(campaign,record.id);live=room;unit=room.units.find(u=>characterId?u.characterId===characterId:u.id===body.id);}
          result=field.command(room,unit,body,{gm,campaign,outsideCombat:true});if(!result.ok)throw Error(result.error);
          if(live){campaign.encounter=this.environmentChanged(room,[]);for(const vessel of room.starships)require('./ship-state').persist(campaign.starships.find(s=>s.id===vessel.id),vessel);require('./ship-state').locations(campaign.starships,room.units);}
          for(const p of room.shipPositions){const ship=room.starships.find(s=>s.id===p.id);field.state(ship).position={q:p.q,r:p.r};}await this.save(campaign);this.timePassed(code,campaign.characters);
        }
        sendJson(res,200,{result:body.kind==='inspect'?result:{text:result.text},campaign:body.kind==='inspect'?undefined:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}return true;
    }
    if(path==='/api/campaign/starship/surveillance'&&req.method==='POST'){
      const gm=Boolean(this.gmSession(token,code)),characterId=String(body.characterId||'');
      if(!gm&&!(characterId&&this.characterSession(token,code,characterId))){sendJson(res,403,{error:'Character or GM authorization required.'});return true;}
      const live=!this.canPassTime(code)?this.liveEncounter(code):null,room=live||transitRoom(campaign);
      if(live)require('./ship-hacking').refresh(room);
      const unit=room.units.find(u=>characterId?u.characterId===characterId:gm&&u.id===body.id);
      try{sendJson(res,200,{result:require('./ship-surveillance').inspect(room,unit,String(body.sicId||''))});}
      catch(error){sendJson(res,409,{error:error.message});}return true;
    }
    if(path==='/api/campaign/starship/library-entry'&&req.method==='POST'){
      if(!this.gmSession(token,code)){sendJson(res,403,{error:'GM authorization is required.'});return true;}
      const live=!this.canPassTime(code)?this.liveEncounter(code):null;
      try{
        const result=CREW_ROOMS.deliverLibrary(campaign,live,body);
        const liveShip=live?.starships.find(s=>s.id===body.starshipId);
        if(liveShip){
          campaign.starships.find(s=>s.id===body.starshipId).ship.crewRoomState=clone(liveShip.ship.crewRoomState);
          const snapshot=this.environmentChanged(live,[]);if(snapshot)campaign.encounter=snapshot;
        }
        await this.save(campaign);sendJson(res,200,{result,campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}return true;
    }
    if(path==='/api/campaign/starship/crew-room'&&req.method==='POST'){
      const gm=Boolean(this.gmSession(token,code)),characterId=String(body.characterId||''),own=Boolean(characterId&&this.characterSession(token,code,characterId));
      const record=campaign.starships.find(s=>s.id===body.starshipId);
      if(!record||(!gm&&(!own||!record.crewCharacterIds?.includes(characterId)))){sendJson(res,403,{error:'Only this ship crew or GM may access room records.'});return true;}
      const live=!this.canPassTime(code)?this.liveEncounter(code):null,room=live||transitRoom(campaign);
      const unit=room.units.find(u=>characterId?u.characterId===characterId:gm&&u.id===body.id);
      try{
        let result;
        if(body.kind==='inspect'){result=CREW_ROOMS.inspect(room,campaign,unit,body.sicId,gm);if(result.shipId!==record.id)throw Error('Wrong ship.');if(result.changed&&!live)await this.save(campaign);}
        else{
          if(live&&!body.jobId)throw Error('Use the live combat console for treatment.');
          if(body.jobId&&!String(body.kind).startsWith('fabricate-')&&!String(body.kind).startsWith('extract-'))result=CREW_ROOMS.resolve(room,campaign,body,{gm,characterId:own?characterId:null});
          else result=CREW_ROOMS.command(room,unit,body,{campaign,gm,outsideCombat:true});
          this.environmentTicks.set(code,{at:Date.now(),saved:Date.now(),active:true});
          if(live){const snapshot=this.environmentChanged(room,[],{resolve:true});if(snapshot)campaign.encounter=snapshot;}await this.save(campaign);this.timePassed(code,campaign.characters);
        }
        sendJson(res,200,{result,campaign:body.kind==='inspect'?undefined:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}
      return true;
    }
    if(path==='/api/campaign/starship/utility'&&req.method==='POST'){
      const record=campaign.starships.find(s=>s.id===body.starshipId),characterId=String(body.characterId||'');
      if(!record?.crewCharacterIds.includes(characterId)||(!this.gmSession(token,code)&&!this.characterSession(token,code,characterId))){sendJson(res,403,{error:'Only the assigned character or GM may operate this station.'});return true;}
      if(!this.canPassTime(code)){sendJson(res,409,{error:'Use the combat console during combat.'});return true;}
      if(Number(campaign.characters.find(c=>c.id===characterId)?.character.health?.current)<=0){sendJson(res,409,{error:'An unconscious character cannot operate a console.'});return true;}
      const loc=record.characterLocations?.[characterId],cell=loc&&SHIP_MAP.buildLayout(record.ship).footprint.get(loc.square);
      const unit={id:characterId,characterId,location:{...loc,starshipId:record.id,sicId:cell?.sicId}};
      const result=require('./ship-utilities').setGravity({starships:campaign.starships,units:[unit]},unit,body,{outsideCombat:true,campaign});
      if(!result.ok){sendJson(res,409,{error:result.error});return true;}
      OXYGEN.sync(campaign.starships,OXYGEN.people(campaign));
      this.environmentTicks.set(code,{at:Date.now(),saved:Date.now(),active:true});
      record.updatedAt=new Date().toISOString();await this.save(campaign);
      sendJson(res,200,{starship:publicStarship(record),campaign:this.state(campaign,token)});return true;
    }
    if(path==='/api/campaign/starship/power'&&req.method==='POST'){
      const record=campaign.starships.find(s=>s.id===body.starshipId),characterId=String(body.characterId||'');
      if(!record?.crewCharacterIds.includes(characterId)||(!this.gmSession(token,code)&&!this.characterSession(token,code,characterId))){sendJson(res,403,{error:'Only registered crew or the GM may operate this station.'});return true;}
      if(!this.canPassTime(code)){sendJson(res,409,{error:'Use SIC Maintenance during your combat turn.'});return true;}
      if(Number(campaign.characters.find(c=>c.id===characterId)?.character.health?.current)<=0){sendJson(res,409,{error:'An unconscious character cannot operate a station.'});return true;}
      if(!['off','on','restart'].includes(body.kind)){sendJson(res,400,{error:'Choose a power operation.'});return true;}
      const loc=record.characterLocations?.[characterId],cell=loc&&SHIP_MAP.buildLayout(record.ship).footprint.get(loc.square);
      const unit={id:characterId,characterId,location:{...loc,starshipId:record.id,sicId:cell?.sicId}};
      const result=require('./ship-maintenance').queue({starships:[record],units:[unit],activeId:unit.id},unit,{...body,requestId:body.requestId});
      if(!result.ok){sendJson(res,409,{error:result.error});return true;}
      this.environmentTicks.set(code,{at:Date.now(),saved:Date.now(),active:true});await this.save(campaign);
      sendJson(res,200,{campaign:this.state(campaign,token)});return true;
    }
    if (path === "/api/campaign/starship/diagnostics" && req.method === "POST") {
      const record=campaign.starships.find(s=>s.id===body.starshipId),characterId=String(body.characterId||'');
      if(!record?.crewCharacterIds.includes(characterId)||(!this.gmSession(token,code)&&!this.characterSession(token,code,characterId))){sendJson(res,403,{error:'Only the assigned character or GM may schedule diagnostics.'});return true;}
      if(!this.canPassTime(code)){sendJson(res,409,{error:'Diagnostics are only available outside combat.'});return true;}
      try{
        require('./ship-maintenance').diagnostics(record,characterId);
        await this.save(campaign);sendJson(res,200,{campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}
      return true;
    }
    if(path==='/api/campaign/starship/carry'&&req.method==='POST'){
      const id=String(body.characterId||'');
      if(!this.gmSession(token,code)&&!this.characterSession(token,code,id)){sendJson(res,403,{error:'You may only direct your own character.'});return true;}
      if(!this.canPassTime(code)){sendJson(res,409,{error:'Use Carry in Combat during an encounter.'});return true;}
      try{const room=transitRoom(campaign),unit=room.units.find(u=>u.characterId===id),text=require('./crew-carry').command(room,unit,body.targetId);
        for(const actor of room.units){const ship=campaign.starships.find(s=>s.id===actor.location?.starshipId);if(actor.characterId&&ship){ship.characterLocations[actor.characterId]={...actor.location,carryingId:actor.carryingId||null,carriedBy:actor.carriedBy||null};}else {const npc=campaign.npcRoster?.find(n=>n.id===actor.id);if(npc)Object.assign(npc,{location:actor.location,carryingId:actor.carryingId,carriedBy:actor.carriedBy});}}
        await this.save(campaign);sendJson(res,200,{text,campaign:this.state(campaign,token)});
      }catch(error){sendJson(res,409,{error:error.message});}return true;
    }
    if (path === "/api/campaign/starship/move-character" && req.method === "POST") {
      const record = campaign.starships.find((entry) => entry.id === String(body.starshipId || ""));
      const characterId = String(body.characterId || "");
      const square = Number(body.square);
      const mesh = Math.max(0, Math.min(8, Number.isFinite(Number(body.mesh)) && body.mesh !== null ? Number(body.mesh) : 4));
      const gmAccess = Boolean(this.gmSession(token, code));
      const selfAccess = Boolean(characterId && this.characterSession(token, code, characterId));
      if (!record || !record.crewCharacterIds.includes(characterId)) { sendJson(res, 404, { error: "That character is not assigned to this starship." }); return true; }
      if (!gmAccess && !selfAccess) { sendJson(res, 403, { error: "You may only move your own character." }); return true; }
      if (!this.canPassTime(code)) { sendJson(res,409,{error:'Combat is active. Use Move in Combat so movement follows the turn and timing rules.'}); return true; }
      if(record.characterLocations?.[characterId]?.escapePodId){sendJson(res,409,{error:'This character is in an escape pod and must be rescued before moving aboard.'});return true;}
      if(CREW_ROOMS.inTreatment(transitRoom(campaign),characterId)){sendJson(res,409,{error:'Use Wake Now in the Hibernation Chamber before moving.'});return true;}
      if(!gmAccess&&Number(campaign.characters.find(c=>c.id===characterId)?.character.health?.current)<=0){sendJson(res,409,{error:'An unconscious character cannot move.'});return true;}
      record.characterLocations ||= {};
      require('./ship-walking').advance(record);
      const previous=record.characterLocations[characterId];
      if(body.stop){delete (record.characterWalks||{})[characterId];await this.save(campaign);this.characterMoved(code,record.id,characterId,previous);sendJson(res,200,{moved:true,campaign:this.state(campaign,token)});return true;}
      if (!record.ship.gridCells.includes(square)) { sendJson(res, 400, { error: "Choose a location inside the starship." }); return true; }
      if(record.characterWalks?.[characterId]){sendJson(res,409,{error:'This character is already walking. Stop before choosing another destination.'});return true;}
      if(previous&&!gmAccess&&!SHIP_MAP.meshRoute(SHIP_MAP.buildLayout(record.ship),{square:previous.square,mesh:previous.mesh??4},{square,mesh})){sendJson(res,409,{error:'No route through the doorways reaches that location.'});return true;}
      const occupied = Object.entries(record.characterLocations).filter(([id, location]) => {if(id===characterId)return false;const reserved=record.characterWalks?.[id]?.destination;return [location,reserved].some(loc=>loc&&Number(loc.square)===square&&Number(loc.mesh)===mesh);}).length;
      const station = body.stationed ? starshipStationAt(record, square, mesh) : null;
      const aiSeat=require('./ship-ai').reservedSeat(record);if(aiSeat&&Number(aiSeat.square)===square&&Number(aiSeat.mesh)===mesh){sendJson(res,409,{error:'That station is reserved by Ship AI. Turn automation off to free it.'});return true;}
      if (station && occupied >= 1) { sendJson(res, 409, { error: "That station is already occupied." }); return true; }
      if (occupied >= 2) { sendJson(res, 409, { error: "That location already holds two characters." }); return true; }
      const destination={carryingId:previous?.carryingId||null,square,mesh,stationed:Boolean(station),stationSlot:station?mesh:null};
      if(body.animate&&previous){
        const speed=Number(campaign.characters.find(c=>c.id===characterId)?.character.computed?.moveSpeed)||3;
        record.characterWalks||={};record.characterWalks[characterId]=require('./ship-walking').plan(record,characterId,destination,speed);
        record.characterLocations[characterId]={...previous,stationed:false,stationSlot:null};
        await this.save(campaign);sendJson(res,200,{moved:true,campaign:this.state(campaign,token)});return true;
      }
      record.characterLocations[characterId] = destination;
      if(previous?.carryingId){const target=previous.carryingId,loc={square,mesh,starshipId:record.id,stationed:false,carriedBy:characterId};if(record.crewCharacterIds.includes(target))record.characterLocations[target]=loc;else{const npc=campaign.npcRoster?.find(n=>n.id===target);if(npc)npc.location=loc;}}
      require('./ship-maintenance').passTime(record,0);
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      this.characterMoved(code,record.id,characterId,record.characterLocations[characterId]);
      sendJson(res, 200, { moved: true, starship: publicStarship(record), campaign: this.state(campaign, token) });
      return true;
    }

    if(path==='/api/campaign/starship/color'&&req.method==='POST'){
      if(!this.gmSession(token,code)){sendJson(res,403,{error:'GM access required.'});return true;}
      const record=campaign.starships.find(s=>s.id===body.starshipId);
      if(!record||!/^#[0-9a-f]{6}$/i.test(body.color||'')){sendJson(res,400,{error:'Choose a starship and valid glow color.'});return true;}
      record.ship.mapColor=body.color;const room=this.liveEncounter(code),live=room?.starships.find(s=>s.id===record.id);if(live){live.ship.mapColor=body.color;campaign.encounter=this.environmentChanged(room,[]);}
      await this.save(campaign);sendJson(res,200,{ok:true});return true;
    }
    if (path === "/api/campaign/starship/control" && req.method === "POST") {
      if (!this.gmSession(token, code)) { sendJson(res, 403, { error: "GM access required." }); return true; }
      const record = campaign.starships.find((entry) => entry.id === String(body.starshipId || ""));
      if (!record) { sendJson(res, 404, { error: "Linked starship not found." }); return true; }
      record.controlType = body.controlType === "gm" ? "gm" : "pc";
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { starship: publicStarship(record) });
      return true;
    }

    if (path === "/api/campaign/starship/unlink" && req.method === "POST") {
      const record = campaign.starships.find((entry) => entry.id === String(body.starshipId || ""));
      if (!record) { sendJson(res, 404, { error: "Linked starship not found." }); return true; }
      if (!this.gmSession(token, code) && body.accessKey !== record.accessKey) { sendJson(res, 403, { error: "GM or owning starship access required." }); return true; }
      campaign.starships = campaign.starships.filter((entry) => entry.id !== record.id);
      await this.save(campaign);
      sendJson(res, 200, { unlinked: true });
      return true;
    }

    if (path === "/api/campaign/backup/load" && req.method === "POST") {
      const backup = body.backup;
      const backupCode = String(backup?.campaign?.code || "").trim().toUpperCase();
      if (backup?.format !== "spaceship-architect-campaign" || !/^[A-Z0-9]{4}$/.test(backupCode)) {
        sendJson(res, 400, { error: "That file is not a valid Spaceship Architect campaign backup." });
        return true;
      }
      const hosted = await this.campaign(backupCode);
      const suppliedGmCode = String(body.gmCode ?? "");
      const suppliedBackupKey = String(backup?.authentication?.backupKey || "");
      const backupHasAccess = hosted
        ? (suppliedBackupKey && suppliedBackupKey === hosted.backupKey) || passwordMatches(suppliedGmCode, hosted.gmCode)
        : Boolean(backup?.authentication?.gmCode?.salt && backup?.authentication?.gmCode?.hash) || Boolean(suppliedGmCode);
      if (!backupHasAccess) {
        sendJson(res, 403, { error: "This older backup needs the campaign's GM Code. Enter it in the GM Code field and load the backup again." });
        return true;
      }
      const comparison = hosted ? campaignComparison(hosted, backup) : null;
      const choice = String(body.choice || "");
      if (hosted && !["hosted", "backup"].includes(choice)) {
        sendJson(res, 409, {
          error: "A hosted copy of this campaign still exists. Choose which version to open.",
          requiresChoice: true,
          comparison,
        });
        return true;
      }
      let selected;
      if (hosted && choice === "hosted") {
        selected = hosted;
      } else {
        selected = campaignFromBackup(backup, {
          code: backupCode,
          gmCode: suppliedGmCode,
          currentGmCode: hosted?.gmCode || null,
        });
        if (!selected) {
          sendJson(res, 400, { error: "This backup cannot restore GM access. Enter its GM Code and try again." });
          return true;
        }
        if (hosted) {
          await this.checkpoint(hosted,'Before campaign file replacement',this.liveEncounter(hosted.code)||hosted.encounter);
          selected.backupKey = hosted.backupKey;
          selected.revision = Math.max(Number(hosted.revision) || 1, Number(selected.revision) || 1);
          await this.save(selected);
        } else {
          selected.revision = Math.max(1, Number(selected.revision) || 1) + 1;
          if (!await this.store.create(selected)) {
            sendJson(res, 409, { error: "The campaign appeared on the server while the backup was loading. Try again." });
            return true;
          }
          this.campaignCache.set(selected.code, selected);
        }
        this.restoreEncounter(selected.code, selected.encounter);
      }
      this.campaignCache.set(selected.code, selected);
      const gmToken = this.newSession(selected.code, "gm");
      sendJson(res, 200, {
        token: gmToken,
        restored: !hosted || choice === "backup",
        comparison,
        campaign: this.state(selected, gmToken),
      });
      return true;
    }

    if (path === "/api/campaign/drama/draw" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      if (record.character?.phase !== "finalized") {
        sendJson(res, 409, { error: "Finalize this character before purchasing Drama Cards." });
        return true;
      }
      const deck = normalizeDramaDeck(campaign);
      const hand = deck.hands[record.id] || (deck.hands[record.id] = []);
      if (hand.length >= DRAMA_CARD_HAND_LIMIT) {
        sendJson(res, 409, { error: `You may purchase cards only while holding fewer than ${DRAMA_CARD_HAND_LIMIT}.` });
        return true;
      }
      record.character.resources ||= {};
      const reverence = Math.max(0, Number(record.character.resources.reverence) || 0);
      if (reverence < DRAMA_CARD_COST) {
        sendJson(res, 409, { error: `Purchasing a Drama Card costs ${DRAMA_CARD_COST} Reverence.` });
        return true;
      }
      const cardId = drawDramaCardId(deck);
      if (!cardId) {
        sendJson(res, 409, { error: "No Drama Cards are currently available to draw." });
        return true;
      }
      record.character.resources.reverence = reverence - DRAMA_CARD_COST;
      hand.push(cardId);
      record.character.resources.dramaCards = hand.length;
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { card: dramaCardState(cardId), campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/drama/play" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const deck = normalizeDramaDeck(campaign);
      const hand = deck.hands[record.id] || [];
      const cardId = String(body.cardId || "");
      const cardIndex = hand.indexOf(cardId);
      const card = DRAMA_CARD_BY_ID.get(cardId);
      if (cardIndex < 0 || !card) {
        sendJson(res, 404, { error: "That Drama Card is not in this character's hand." });
        return true;
      }
      hand.splice(cardIndex, 1);
      deck.discardPile.push(cardId);
      const event = {
        id: uid("drama-play"),
        cardId,
        characterId: record.id,
        characterName: safeCharacterName(record),
        playerName: String(record.character?.identity?.playerName || "Player").trim().slice(0, 80) || "Player",
        playedAt: new Date().toISOString(),
      };
      deck.playEvents.push(event);
      deck.playEvents = deck.playEvents.slice(-50);
      record.character.resources ||= {};
      record.character.resources.dramaCards = hand.length;
      record.updatedAt = event.playedAt;
      await this.save(campaign);
      sendJson(res, 200, { played: true, card: dramaCardState(cardId), campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/drama/reshuffle" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const deck = normalizeDramaDeck(campaign);
      const count = deck.discardPile.length;
      if (count) {
        deck.drawPile = shuffle([...deck.drawPile, ...deck.discardPile]);
        deck.discardPile = [];
      }
      await this.save(campaign);
      sendJson(res, 200, { reshuffled: count, campaign: this.state(campaign, token) });
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
        releaseDramaHand(campaign, linked.id);
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

    if(path==='/api/campaign/checkpoints'&&req.method==='GET'){
      if(!this.gmSession(token,code)){sendJson(res,403,{error:'GM authorization required.'});return true;}
      sendJson(res,200,{checkpoints:await require('./encounter-checkpoints').list(this.store,code)});return true;
    }
    if(path==='/api/campaign/checkpoint/restore'&&req.method==='POST'){
      if(!this.gmSession(token,code)){sendJson(res,403,{error:'GM authorization required.'});return true;}
      const live=this.liveEncounter(code)||campaign.encounter;
      if(body.confirmCampaignName!==campaign.name||body.expectedEncounterId!==live?.encounterId){sendJson(res,409,{error:'Confirm the campaign name and refresh the current encounter before restoring.'});return true;}
      const saved=await require('./encounter-checkpoints').get(this.store,code,body.checkpointId);
      if(!saved?.encounter){sendJson(res,404,{error:'Checkpoint not found.'});return true;}
      await this.checkpoint(campaign,'Before checkpoint recovery',live);
      const restored=normalizeCampaign({...saved,gmCode:campaign.gmCode,backupKey:campaign.backupKey,runtimeSessions:campaign.runtimeSessions,roomOpen:campaign.roomOpen,showcase:campaign.showcase});
      restored.encounter.encounterId=crypto.randomUUID();restored.encounter.running=false;restored.encounter.hardPaused=true;
      restored.revision=campaign.revision;await this.save(restored);this.restoreEncounter(code,restored.encounter);
      sendJson(res,200,{campaign:this.state(restored,token)});return true;
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
      await this.checkpoint(campaign,'Before campaign file replacement',this.liveEncounter(code)||campaign.encounter);
      restored.backupKey = campaign.backupKey;
      // Backups omit transient demo metadata. Preserve the destination's mode
      // so restoring Explore updates its active campaign instead of a shadow
      // record that campaign() will never read (or writing it to normal storage).
      restored.showcase = Boolean(campaign.showcase);
      if (restored.showcase && restored.encounter) restored.encounter.showcase = true;
      restored.revision = Math.max(Number(campaign.revision) || 1, Number(restored.revision) || 1);
      await this.save(restored);
      this.restoreEncounter(code, restored.encounter);
      sendJson(res, 200, { campaign: this.state(restored, token) });
      return true;
    }

    if (path === "/api/campaign/delete" && req.method === "POST") {
      if (!this.gmSession(token, code) || body.campaignName !== campaign.name || (campaign.interfaceVersion !== "0.3" && !passwordMatches(body.gmCode ?? body.password, campaign.gmCode))) {
        sendJson(res, 403, { error: campaign.interfaceVersion === "0.3" ? "GM authorization and the exact campaign name are required." : "GM authorization, the GM Code, and the exact campaign name are required." });
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

    if (path === "/api/campaign/time/pass" && req.method === "POST") {
      if (!this.gmSession(token, code)) { sendJson(res, 403, { error: "GM authorization is required." }); return true; }
      try {
        const minutes = CAMPAIGN_TIME.durationMinutes(body.amount, body.unit);
        const requestId = String(body.requestId || "");
        if (!/^[\w-]{8,100}$/.test(requestId)) throw new Error("A time request ID is required.");
        const previous = this.saveQueues.get(code) || Promise.resolve();
        const queued = previous.catch(() => {}).then(async () => {
          const receipt = (campaign.timeReceipts || []).find(entry => entry.id === requestId);
          if (receipt) {
            if (receipt.minutes !== minutes) throw new Error("This time request was already used for a different duration.");
            return receipt;
          }
          if (!this.canPassTime(code)) throw new Error("End combat before passing campaign time.");
          const next = clone(campaign);
          const actors=OXYGEN.people(next);OXYGEN.sync(next.starships,actors);
          if(OXYGEN.pending(next.starships))throw new Error('Resolve the pending oxygen roll before passing time.');
          const occupied=next.starships.filter(s=>actors.some(a=>a.shipId===s.id&&!a.immune&&a.hp>0));
          const elapsed=Math.min(minutes,Math.max(.000001,OXYGEN.nextEvent(occupied))/60);
          let healed = 0, recharged = 0;
          for (const record of next.characters.filter(entry => entry.approved)) {
            const result = CAMPAIGN_TIME.passCharacterTime(record.character, elapsed);
            healed += result.healed; recharged += result.recharged.length;
            record.updatedAt = new Date().toISOString();
            next.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "recharge", message: `GM passed ${Number(elapsed.toFixed(3))} minutes. Restored ${result.healed} HP${result.recharged.length ? ` and recharged ${result.recharged.join(", ")}` : ""}.`, createdAt: record.updatedAt, readAt: null });
          }
          require('./campaign-starmaps').advance(next,elapsed);
          const result = { id: requestId, minutes, advancedMinutes:elapsed, oxygenInterrupted:elapsed<minutes, healed, recharged };
          for(const ship of next.starships || []) {require('./ship-maintenance').passTime(ship,elapsed);require('./ship-cleanser').passTime(ship,elapsed);}
          TRANSIT.advance(transitRoom(next),elapsed*60);
          require('./ship-black-hole-gun').cooldowns(transitRoom(next),elapsed*60);const chargedRoom=transitRoom(next);chargedRoom.starships=chargedRoom.starships.filter(s=>require('./ship-devastation').needsPower(s));SHIP_POWER.advance(chargedRoom,elapsed*60);
          CREW_ROOMS.advance(transitRoom(next),next,elapsed*60);
          OXYGEN.advance(next.starships,actors,elapsed*60);
          syncCampaignCarry(next);
          require('./ancestral-crafting').advance(next,elapsed);
          next.elapsedMinutes = (Number(next.elapsedMinutes) || 0) + elapsed;
          next.timeReceipts = [...(next.timeReceipts || []), result].slice(-200);
          next.revision = (Number(next.revision) || 1) + 1;
          next.updatedAt = new Date().toISOString();
          trimPrivateNotes(next);
          if (!next.showcase) await this.store.save(next);
          Object.assign(campaign, next);
          this.timePassed(code, campaign.characters);
          await this.broadcast(code, campaign);
          return result;
        });
        this.saveQueues.set(code, queued);
        let result;
        try { result = await queued; }
        finally { if (this.saveQueues.get(code) === queued) this.saveQueues.delete(code); }
        sendJson(res, 200, { ...result, campaign: this.state(campaign, token) });
      } catch (error) { sendJson(res, 400, { error: error.message }); }
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
        const names = CAMPAIGN_TIME.rechargeItems(record.character);
        recharged += names.length;
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
      next.statistics=clone(record.character.statistics||next.statistics||{});
      next.campaignLink = {
        roomCode: campaign.code,
        campaignName: campaign.name,
        status: "linked",
        requestId: "",
        message: "",
      };
      next.resources ||= {};
      next.vrTrainingDay=record.character.vrTrainingDay;
      next.health ||= { current: null, permanentBonus: 0 };
      next.health.recoveryMinutes = record.character.health?.recoveryMinutes || 0;
      const serverCredits = Number(record.character?.resources?.creditsBase) || 0;
      const submittedCredits = Number(next.resources.creditsBase) || 0;
      const baseCredits = Number(body.baseCredits);
      const exactGmSave = Boolean(body.exact && this.gmSession(token, code));
      next.resources.creditsBase = !exactGmSave && Number.isFinite(baseCredits)
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
      next.health.current = !exactGmSave && Number.isFinite(baseCurrentHp) && Number.isFinite(submittedHp)
        ? boundedNumber(serverHp + (submittedHp - baseCurrentHp), -9999, nextMaximumHp)
        : boundedNumber(submittedHp, -9999, nextMaximumHp);
      require('./ancestral-crafting').preserveUnseen(record.character,next,body.seenCraftedWeapons);
      record.character = next;
      record.updatedAt = new Date().toISOString();
      await this.save(campaign);
      sendJson(res, 200, { saved: true, updatedAt: record.updatedAt, creditsBase: next.resources.creditsBase, currentHp: next.health.current });
      this.timePassed(code,[record]);
      return true;
    }

    if ((path === "/api/campaign/character/change-pc-code" || path === "/api/campaign/character/change-pin") && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      const pcCode = String(body.pcCode ?? body.pin ?? "");
      if (!record || !this.characterSession(token, code, record.id) || (!pcCode && campaign.interfaceVersion!=='0.3')) {
        sendJson(res, 403, { error: "Authorization and a PC Code are required." });
        return true;
      }
      if (campaign.interfaceVersion!=='0.3' && campaign.characters.some((entry) => entry.id !== record.id && entry.pcCode === pcCode)) {
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
      releaseDramaHand(campaign, record.id);
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
      releaseDramaHand(campaign, record.id);
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
      releaseDramaHand(campaign, record.id);
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
      for (const client of this.clients.get(code) || []) {
        const clientSession = this.session(client.token, code);
        if (clientSession?.role === "character" && clientSession.characterId === record.id) {
          writeEvent(client.response, "character-kicked", {
            campaignName: campaign.name,
            character: {
              ...clone(record.character),
              campaignLink: { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" },
            },
          });
        }
      }
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
      campaign.settings ||= { commandWindowBonus: 0, hideRoomCode: false };
      if (body.commandWindowBonus !== undefined) {
        campaign.settings.commandWindowBonus = Math.round(boundedNumber(body.commandWindowBonus, 0, 3600));
      }
      if (body.hideRoomCode !== undefined) campaign.settings.hideRoomCode = Boolean(body.hideRoomCode);
      await this.save(campaign);
      sendJson(res, 200, { campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/npc-templates" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const normalized=normalizeCampaign({...campaign,npcTemplates:body.templates});campaign.npcTemplates=normalized.npcTemplates;campaign.npcRoster=normalized.npcRoster;
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
      const resource = REWARD_RESOURCES.includes(body.resource) ? body.resource : "experience";
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
      const next = { id: actionId || uid("conditional"), keyword, kind, message, resource, amount, attribute, skill, difficulty, hideDifficulty: false };
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
      const receipt=String(body.receipt||'');
      if(receipt&&campaign.endSessionReceipts?.[receipt]!=null){sendJson(res,200,{sessionEnded:campaign.endSessionReceipts[receipt],campaign:this.state(campaign,token)});return true;}
      if(body.expectedSession!=null&&body.expectedSession!==campaign.sessionNumber){sendJson(res,409,{error:'This session already ended. Refresh before ending another session.'});return true;}
      try{REPUTATION.applyEnd(campaign,body.reputation);}catch(error){sendJson(res,400,{error:error.message});return true;}
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
            choices: ["Research", "Science", "Mathematics"],
            message: `Session ${endedSession}: choose one Science Officer Skill to increase by +0.1.`,
            createdAt: new Date().toISOString(),
            readAt: null,
          });
        }
        record.updatedAt = new Date().toISOString();
      }
      campaign.sessionNumber += 1;
      campaign.reputationSession=null;
      if(receipt){campaign.endSessionReceipts||={};campaign.endSessionReceipts[receipt]=endedSession;}
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
        record.character.statistics||={};record.character.statistics.experienceEarned??=Number(record.character.experience.totalGained)||0;
        require('./character-statistics').earned(record.character,'experience',5);require('./character-statistics').earned(record.character,'reverence',1);
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
        record.character.statistics||={};record.character.statistics.experienceEarned??=Number(record.character.experience.totalGained)||0;
        require('./character-statistics').earned(record.character,'experience',8);
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
      if (!amount || !REWARD_RESOURCES.includes(resource)) {
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
          const result = applyCharacterReward(record, { resource, amount, androidExperienceIds: [...androidExperienceIds] }, campaign);
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

      const previousCardIds=new Set((campaign.dramaDeck?.hands?.[record.id]||[]).map(card=>typeof card==='string'?card:card.id));
      const result = award.resource === "shipCredits"
        ? (() => {
            const before = characterRewardSnapshot(record, campaign);
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
        : applyCharacterReward(record, award, campaign);
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
        cards: result.appliedResource==='dramaCards'?(this.state(campaign,token).dramaDeck?.hand||[]).filter(card=>!previousCardIds.has(card.id)):[],
        campaign: this.state(campaign, token),
      });
      return true;
    }

    if (path === "/api/campaign/exertion/spent" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const amount = Math.max(1, Math.min(99, Math.round(Number(body.amount) || 1)));
      campaign.privateNotes.push({
        id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-gm", kind: "exertion-spent",
        message: `${safeCharacterName(record)} spent ${amount} Exertion manually.`, createdAt: new Date().toISOString(), readAt: null,
      });
      await this.save(campaign);
      sendJson(res, 200, { recorded: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/exertion/rest" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      record.character.resources ||= {};
      const before = Math.max(0, Math.round(Number(body.before) || 0));
      const maximum = Math.max(0, Math.round(Number(record.character.resources.exertionMax) || Number(body.maximum) || 0));
      const grantedAmount = Math.max(0, maximum - before);
      record.character.resources.exertionCurrent = maximum;
      record.updatedAt = new Date().toISOString();
      campaign.privateNotes.push({
        id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-gm", kind: "rest-request",
        requestStatus: "pending", grantedAmount,
        message: `${safeCharacterName(record)} rested and restored ${grantedAmount} Exertion. Ignoring this message approves the Rest.`,
        createdAt: record.updatedAt, readAt: null,
      });
      await this.save(campaign);
      sendJson(res, 200, { rested: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/exertion/rest-decision" && req.method === "POST") {
      if (!this.gmSession(token, code)) {
        sendJson(res, 403, { error: "GM authorization is required." });
        return true;
      }
      const note = campaign.privateNotes.find((entry) => entry.id === body.noteId && entry.kind === "rest-request");
      if (!note || note.requestStatus !== "pending") {
        sendJson(res, 409, { error: "That Rest message is no longer pending." });
        return true;
      }
      const now = new Date().toISOString();
      if (body.decision === "deny") {
        const record = campaign.characters.find((entry) => entry.id === note.characterId);
        if (record) {
          record.character.resources ||= {};
          record.character.resources.exertionCurrent = Math.max(0, Math.round(Number(record.character.resources.exertionCurrent) || 0) - Math.max(0, Number(note.grantedAmount) || 0));
          record.updatedAt = now;
          campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "system", message: "The GM denied that Rest. The Exertion restored by it was removed.", createdAt: now, readAt: null });
        }
        note.requestStatus = "denied";
      } else if (body.decision === "approve-all") {
        for (const record of campaign.characters) {
          const award = { id: uid("award"), resource: "rest", amount: 1, targetIds: [record.id], before: { shipCredits: campaign.shipCredits, characters: [] }, at: now, claimRequired: true, claimedCharacterIds: [], androidExperienceIds: [] };
          campaign.awardHistory.push(award);
          campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "award", awardId: award.id, rewardResource: "rest", rewardAmount: 1, rewardStatus: "pending", message: "The GM approved Rest for everyone. Receive this reward to restore all Exertion.", createdAt: now, readAt: null });
        }
        trimAwardHistory(campaign);
        note.requestStatus = "approved";
      } else {
        sendJson(res, 400, { error: "Choose Deny or Approve for All." });
        return true;
      }
      note.requestResolvedAt = now;
      note.readAt ||= now;
      await this.save(campaign);
      sendJson(res, 200, { resolved: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/reverence/spent" && req.method === "POST") {
      const record = campaign.characters.find((entry) => entry.id === body.characterId);
      if (!record || !this.characterSession(token, code, record.id)) {
        sendJson(res, 403, { error: "Character authorization is required." });
        return true;
      }
      const amount = Math.max(1, Math.min(10, Math.round(Number(body.amount) || 1)));
      campaign.privateNotes.push({
        id: uid("note"),
        characterId: record.id,
        characterName: safeCharacterName(record),
        direction: "to-gm",
        kind: "reverence-spent",
        message: `${safeCharacterName(record)} manually spent ${amount} Reverence.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      trimPrivateNotes(campaign);
      await this.save(campaign);
      sendJson(res, 200, { recorded: true, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/angiluros/craft" && req.method === "POST") {
      const action = String(body.action || "request");
      if (action === "request") {
        const session = this.session(token, code);
        const record = session?.role === "character" ? campaign.characters.find((entry) => entry.id === session.characterId) : null;
        const weaponId = String(body.weaponId || "").slice(0, 100);
        if (!record || record.id !== String(body.characterId || "")) { sendJson(res, 403, { error: "Character authorization is required." }); return true; }
        if (record.character?.identity?.raceId !== "angiluros" || !weaponId.startsWith("angiluros-")) { sendJson(res, 400, { error: "That is not an Angiluros ancestral weapon." }); return true; }
        const names = {
          "angiluros-wooden-shield": "Wooden Shield", "angiluros-stone-knife": "Stone Knife", "angiluros-slingshot": "Slingshot",
          "angiluros-wooden-staff": "Wooden Staff", "angiluros-blowgun": "Blowgun", "angiluros-whip": "Whip",
          "angiluros-wooden-bow": "Wooden Bow", "angiluros-stone-hammer": "Stone Hammer", "angiluros-stone-axe": "Stone Axe",
        };
        if (!names[weaponId]) { sendJson(res, 400, { error: "Unknown ancestral weapon." }); return true; }
        const note = {
          id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-gm",
          kind: "angiluros-craft-request", requestStatus: "crafting", remainingMinutes: Math.max(1, Math.min(999, Math.round(Number(body.craftHours) || 1))) * 60, requestedWeaponId: weaponId,
          requestedWeaponName: names[weaponId], requestedInventoryId: String(body.inventoryId || uid("weaponrow")).slice(0, 100),
          craftHours: Math.max(1, Math.min(999, Math.round(Number(body.craftHours) || 1))),
          message: `${safeCharacterName(record)} spent ${Math.max(1, Math.round(Number(body.craftHours) || 1))} fictional hours crafting ${names[weaponId]} and requests GM approval.`,
          createdAt: new Date().toISOString(), readAt: null,
        };
        note.message = `${safeCharacterName(record)} started crafting ${names[weaponId]}: ${note.craftHours} fictional hours remaining.`;
        campaign.privateNotes.push(note);
        trimPrivateNotes(campaign);
        await this.save(campaign);
        sendJson(res, 201, { requested: true, campaign: this.state(campaign, token) });
        return true;
      }
      if (!this.gmSession(token, code)) { sendJson(res, 403, { error: "GM authorization is required." }); return true; }
      const note = campaign.privateNotes.find((entry) => entry.id === String(body.noteId || "") && entry.kind === "angiluros-craft-request");
      const decision = body.decision === "approve" ? "approved" : body.decision === "deny" ? "denied" : "";
      if (!note || !decision) { sendJson(res, 400, { error: "Choose a pending crafting request." }); return true; }
      if (note.requestStatus === "crafting") { sendJson(res, 409, { error: "Crafting is still in progress. Advance campaign time first." }); return true; }
      if (note.requestStatus !== "pending") { sendJson(res, 200, { alreadyResolved: true, campaign: this.state(campaign, token) }); return true; }
      const record = campaign.characters.find((entry) => entry.id === note.characterId);
      if (!record) { sendJson(res, 404, { error: "That character is no longer in the campaign." }); return true; }
      note.requestStatus = decision;
      note.requestResolvedAt = new Date().toISOString();
      note.readAt ||= note.requestResolvedAt;
      if (decision === "approved") {
        require('./ancestral-crafting').grant(record.character,note);
        record.updatedAt = note.requestResolvedAt;
        note.message = `Approved: ${safeCharacterName(record)} crafted ${note.requestedWeaponName} in ${note.craftHours} fictional hours.`;
        campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "system", message: `Crafting approved: ${note.requestedWeaponName} has been added to your weapon storage (Crafted).`, createdAt: note.requestResolvedAt, readAt: null });
      } else {
        note.message = `Denied: ${safeCharacterName(record)}'s request to craft ${note.requestedWeaponName}.`;
        campaign.privateNotes.push({ id: uid("note"), characterId: record.id, characterName: safeCharacterName(record), direction: "to-character", kind: "system", message: `The GM denied your ${note.requestedWeaponName} crafting request.`, createdAt: note.requestResolvedAt, readAt: null });
      }
      trimPrivateNotes(campaign);
      await this.save(campaign);
      sendJson(res, 200, { decision, campaign: this.state(campaign, token) });
      return true;
    }

    if (path === "/api/campaign/reverence-gift" && req.method === "POST") {
      const action = String(body.action || "request");
      if (action === "request") {
        const session = this.session(token, code);
        const requester = session?.role === "character"
          ? campaign.characters.find((entry) => entry.id === session.characterId)
          : null;
        const target = campaign.characters.find((entry) => entry.id === String(body.targetCharacterId || ""));
        const amount = Math.max(1, Math.min(10, Math.round(Number(body.amount) || 0)));
        if (!requester) {
          sendJson(res, 403, { error: "Character authorization is required." });
          return true;
        }
        if (!target || target.id === requester.id) {
          sendJson(res, 400, { error: "Choose another character in this campaign." });
          return true;
        }
        const note = {
          id: uid("note"),
          characterId: requester.id,
          characterName: safeCharacterName(requester),
          direction: "to-gm",
          kind: "reverence-gift-request",
          requestStatus: "pending",
          requesterCharacterId: requester.id,
          targetCharacterId: target.id,
          requestedAmount: amount,
          message: `${safeCharacterName(requester)} suggests awarding ${amount} Reverence to ${safeCharacterName(target)}.`,
          createdAt: new Date().toISOString(),
          readAt: null,
        };
        campaign.privateNotes.push(note);
        await this.save(campaign);
        sendJson(res, 201, { sent: true, targetName: safeCharacterName(target), campaign: this.state(campaign, token) });
        return true;
      }

      if (action === "respond") {
        if (!this.gmSession(token, code)) {
          sendJson(res, 403, { error: "GM authorization is required." });
          return true;
        }
        const note = campaign.privateNotes.find((entry) => entry.id === String(body.noteId || "") && entry.kind === "reverence-gift-request");
        const decision = body.decision === "approve" ? "approved" : body.decision === "deny" ? "denied" : "";
        if (!note || !decision) {
          sendJson(res, 400, { error: "Choose a pending Reverence suggestion." });
          return true;
        }
        if (note.requestStatus !== "pending") {
          sendJson(res, 200, { resolved: true, alreadyResolved: true, decision: note.requestStatus, campaign: this.state(campaign, token) });
          return true;
        }
        const requester = campaign.characters.find((entry) => entry.id === note.requesterCharacterId);
        const target = campaign.characters.find((entry) => entry.id === note.targetCharacterId);
        if (!requester || !target) {
          note.requestStatus = "denied";
          note.requestResolvedAt = new Date().toISOString();
          await this.save(campaign);
          sendJson(res, 409, { error: "One of the characters is no longer in this campaign." });
          return true;
        }
        const now = new Date().toISOString();
        const amount = Math.max(1, Math.min(10, Math.round(Number(note.requestedAmount) || 1)));
        note.requestStatus = decision;
        note.requestResolvedAt = now;
        note.readAt ||= now;
        note.message = decision === "approved"
          ? `Approved: ${safeCharacterName(requester)} suggested ${amount} Reverence for ${safeCharacterName(target)}.`
          : `Denied: ${safeCharacterName(requester)} suggested ${amount} Reverence for ${safeCharacterName(target)}.`;

        if (decision === "approved") {
          const award = {
            id: uid("award"), resource: "reverence", amount, targetIds: [target.id],
            before: { shipCredits: campaign.shipCredits, characters: [] }, at: now,
            claimRequired: true, claimedCharacterIds: [], androidExperienceIds: [],
          };
          campaign.awardHistory.push(award);
          trimAwardHistory(campaign);
          campaign.privateNotes.push({
            id: uid("note"), characterId: target.id, characterName: safeCharacterName(target),
            direction: "to-character", kind: "award", awardId: award.id,
            rewardResource: "reverence", rewardAmount: amount, rewardStatus: "pending",
            message: `${safeCharacterName(requester)} suggested a ${amount} Reverence reward and the GM approved it. Claim it when you are ready.`,
            createdAt: now, readAt: null,
          });
        }
        campaign.privateNotes.push({
          id: uid("note"), characterId: requester.id, characterName: safeCharacterName(requester),
          direction: "to-character", kind: "system",
          message: decision === "approved"
            ? `The GM approved your suggestion of ${amount} Reverence for ${safeCharacterName(target)}.`
            : `The GM denied your suggestion of ${amount} Reverence for ${safeCharacterName(target)}.`,
          createdAt: now, readAt: null,
        });
        await this.save(campaign);
        sendJson(res, 200, { resolved: true, decision, campaign: this.state(campaign, token) });
        return true;
      }

      sendJson(res, 400, { error: "Choose request, approve, or deny." });
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
      const dramaDeck = normalizeDramaDeck(campaign);
      for (const snapshot of award.before.characters || []) {
        const record = campaign.characters.find((entry) => entry.id === snapshot.id);
        if (!record) continue;
        record.character.experience = snapshot.experience;
        record.character.resources ||= {};
        record.character.resources.creditsBase = snapshot.creditsBase;
        record.character.resources.reverence = snapshot.reverence;
        record.character.resources.attributePoints = Math.max(0, Number(snapshot.attributePoints) || 0);
        record.character.resources.skillPoints = Math.max(0, Number(snapshot.skillPoints) || 0);
        if (Number.isFinite(Number(snapshot.exertionCurrent))) record.character.resources.exertionCurrent = Math.max(0, Number(snapshot.exertionCurrent));
        if (Array.isArray(snapshot.dramaHand)) {
          const restored = new Set(snapshot.dramaHand);
          dramaDeck.drawPile = dramaDeck.drawPile.filter((cardId) => !restored.has(cardId));
          dramaDeck.discardPile = dramaDeck.discardPile.filter((cardId) => !restored.has(cardId));
          for (const cardId of dramaDeck.hands[record.id] || []) {
            if (!restored.has(cardId)) dramaDeck.discardPile.push(cardId);
          }
          dramaDeck.hands[record.id] = [...snapshot.dramaHand];
          record.character.resources.dramaCards = snapshot.dramaHand.length;
        }
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
        hideDifficulty: false,
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

    if (path === "/api/campaign/roll/cancel" && req.method === "POST") {
      const request=campaign.rollRequests.find(r=>r.id===body.requestId),characterId=String(body.characterId||'');
      if(!request?.targetIds.includes(characterId)||!this.characterSession(token,code,characterId)){sendJson(res,403,{error:'This request belongs to another character.'});return true;}
      if(request.results?.[characterId]&&!request.results[characterId].cancelled){sendJson(res,409,{error:'This roll has already been submitted.'});return true;}
      request.results[characterId]||={cancelled:true,outcome:'Cancelled',respondedAt:new Date().toISOString()};
      campaign.privateNotes=campaign.privateNotes.filter(n=>!(n.rollRequestId===request.id&&n.characterId===characterId));
      await this.save(campaign);sendJson(res,200,{cancelled:true,campaign:this.state(campaign,token)});return true;
    }

    if (path === "/api/campaign/roll/respond" && req.method === "POST") {
      const request = campaign.rollRequests.find((entry) => entry.id === body.requestId);
      const characterId = String(body.characterId || "");
      if (!request || !request.targetIds.includes(characterId) || !this.characterSession(token, code, characterId)) {
        sendJson(res, 403, { error: "This roll request is not available to that character." });
        return true;
      }
      if (request.results[characterId]) {
        const previous = request.results[characterId];
        const same = previous.score === (Number(body.score) || 0)
          && previous.mode === (body.mode === "manual" ? "manual" : "automatic")
          && previous.outcome === String(body.outcome || "").slice(0, 40)
          && JSON.stringify(previous.diceResults) === JSON.stringify(Array.isArray(body.diceResults) ? body.diceResults.map(Number) : []);
        if (same) { sendJson(res, 200, { recorded: true, alreadyRecorded: true }); return true; }
        sendJson(res, 409, { error: "This character has already answered that roll request." });
        return true;
      }
      if (request.closedAt) { sendJson(res, 403, { error: "This roll request was closed by the GM." }); return true; }
      const submittedScore = Number(body.score) || 0;
      request.results[characterId] = {
        score: submittedScore,
        mode: body.mode === "manual" ? "manual" : "automatic",
        diceResults: Array.isArray(body.diceResults) ? body.diceResults.map(Number) : [],
        outcome: String(body.outcome || "").slice(0, 40),
        respondedAt: new Date().toISOString(),
      };
      if(String(request.attribute).toLowerCase()==='charisma')request.results[characterId].reputation=REPUTATION.snapshot(campaign,characterId,submittedScore,request.id+':'+characterId);
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
          target.character.statistics||={};target.character.statistics.experienceEarned??=Number(target.character.experience.totalGained)||0;
        require('./character-statistics').earned(target.character,'experience',experience);
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
        require('./character-statistics').earned(target.character,'reverence',amount);
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
        target.character.statistics||={};target.character.statistics.experienceEarned??=Number(target.character.experience.totalGained)||0;
        require('./character-statistics').earned(target.character,'experience',experience);
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
