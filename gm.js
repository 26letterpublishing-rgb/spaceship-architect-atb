import { ATTRIBUTE_DEFS, DICE_FACES, SPACECRAFT_SKILLS, GENERAL_SKILLS, raceById, classById } from "./character-data.js?v=20260816-atb-2e";
import { WEAPONS, weaponById } from "./weapon-data.js?v=20260816-atb-2e";

const $ = (selector) => document.querySelector(selector);
const SHOWCASE_MODE = new URLSearchParams(location.search).get("showcase") === "1";
const dom = {
  gateway: $("#campaignGateway"),
  workspace: $("#gmWorkspace"),
  heading: $("#campaignHeading"),
  brand: $("#gmBrand"),
  soundToggle: $("#gmSoundToggle"),
  dramaDeckStatus: $("#gmDramaDeckStatus"),
  dramaAlert: $("#gmDramaCardAlert"),
  dramaPlayedBy: $("#gmDramaPlayedBy"),
  dramaCardDisplay: $("#gmDramaCardDisplay"),
  dramaCardCategory: $("#gmDramaCardCategory"),
  dramaCardNumber: $("#gmDramaCardNumber"),
  dramaCardName: $("#gmDramaCardName"),
  dramaCardRules: $("#gmDramaCardRules"),
  dramaCardHandling: $("#gmDramaCardHandling"),
  dismissDramaCard: $("#dismissGmDramaCard"),
  dramaDiscardPanel: $("#gmDramaDiscardPanel"),
  dramaDiscardCount: $("#gmDramaDiscardCount"),
  dramaDiscardList: $("#gmDramaDiscardList"),
  reshuffleDramaCards: $("#reshuffleDramaCards"),
  codeHeading: $("#campaignCodeHeading"),
  nameHeading: $("#campaignNameHeading"),
  logout: $("#gmLogout"),
  exitEncounter: $("#exitEncounter"),
  openForm: $("#openCampaignForm"),
  code: $("#gmCampaignCode"),
  password: $("#gmCampaignPassword"),
  showCreate: $("#showCreateCampaign"),
  createForm: $("#createCampaignForm"),
  newName: $("#newCampaignName"),
  newPassword: $("#newCampaignPassword"),
  confirmPassword: $("#confirmCampaignPassword"),
  cancelCreate: $("#cancelCreateCampaign"),
  restoreFile: $("#restoreCampaignFile"),
  restoreForm: $("#restoreCampaignForm"),
  restoreCode: $("#restoreCampaignCode"),
  restoreName: $("#restoreCampaignName"),
  restorePassword: $("#restoreCampaignPassword"),
  cancelRestore: $("#cancelRestoreCampaign"),
  gatewayMessage: $("#gatewayMessage"),
  message: $("#gmMessage"),
  tabs: $(".gm-tabs"),
  script: $("#campaignScript"),
  scriptSaveState: $("#scriptSaveState"),
  scriptCommandBuilder: $("#scriptCommandBuilder"),
  scriptChapterTabs: $("#scriptChapterTabs"),
  addScriptChapter: $("#addScriptChapter"),
  renameScriptChapter: $("#renameScriptChapter"),
  deleteScriptChapter: $("#deleteScriptChapter"),
  scriptCommandType: $("#scriptCommandType"),
  scriptRecipient: $("#scriptRecipient"),
  scriptAttribute: $("#scriptAttribute"),
  scriptSkill: $("#scriptSkill"),
  scriptDifficulty: $("#scriptDifficulty"),
  scriptHideDifficulty: $("#scriptHideDifficulty"),
  insertCommand: $("#insertScriptCommand"),
  endSession: $("#endSession"),
  sessionNumberLabel: $("#sessionNumberLabel"),
  characterList: $("#gmCharacterList"),
  characterCount: $("#characterCount"),
  starshipCount: $("#starshipCount"),
  starshipList: $("#gmStarshipList"),
  createCampaignStarship: $("#createCampaignStarship"),
  showcaseNpcFleet: $("#showcaseNpcFleet"),
  showcaseNpcFleetList: $("#showcaseNpcFleetList"),
  premadeNpcSelect: $("#premadeNpcSelect"),
  premadeNpcEditor: $("#premadeNpcEditor"),
  newPremadeNpc: $("#newPremadeNpc"),
  deletePremadeNpc: $("#deletePremadeNpc"),
  savePremadeNpc: $("#savePremadeNpc"),
  sheetViewer: $("#gmSheetViewer"),
  sheetViewerTitle: $("#gmSheetViewerTitle"),
  sheetFrame: $("#gmSheetFrame"),
  closeSheetViewer: $("#closeGmSheetViewer"),
  selectedTargetCount: $("#selectedTargetCount"),
  promptTargets: $("#promptTargets"),
  selectAllTargets: $("#selectAllTargets"),
  selectConnectedTargets: $("#selectConnectedTargets"),
  clearTargets: $("#clearTargets"),
  awardForm: $("#awardForm"),
  awardResource: $("#awardResource"),
  awardAmount: $("#awardAmount"),
  awardMessage: $("#awardMessage"),
  shipCredits: $("#shipCredits"),
  undoAward: $("#undoAward"),
  bankerCharacter: $("#bankerCharacter"),
  setBanker: $("#setBanker"),
  noteForm: $("#privateNoteForm"),
  rechargeItems: $("#rechargeItems"),
  noteMessage: $("#privateNoteMessage"),
  rollForm: $("#rollPromptForm"),
  promptAttribute: $("#promptAttribute"),
  promptSkill: $("#promptSkill"),
  promptDifficulty: $("#promptDifficulty"),
  promptHideDifficulty: $("#promptHideDifficulty"),
  rollResults: $("#gmRollResults"),
  conditionalForm: $("#conditionalActionForm"),
  conditionalSelect: $("#conditionalActionSelect"),
  conditionalKeyword: $("#conditionalKeyword"),
  conditionalKind: $("#conditionalKind"),
  conditionalMessageWrap: $("#conditionalMessageWrap"),
  conditionalMessage: $("#conditionalMessage"),
  conditionalAwardWrap: $("#conditionalAwardWrap"),
  conditionalResource: $("#conditionalResource"),
  conditionalAmount: $("#conditionalAmount"),
  conditionalAttribute: $("#conditionalAttribute"),
  conditionalSkill: $("#conditionalSkill"),
  conditionalDifficulty: $("#conditionalDifficulty"),
  conditionalHideDifficulty: $("#conditionalHideDifficulty"),
  sendConditionalAction: $("#sendConditionalAction"),
  deleteConditionalAction: $("#deleteConditionalAction"),
  conditionalActionMessage: $("#conditionalActionMessage"),
  inboxCount: $("#gmInboxCount"),
  pendingJoinCount: $("#pendingJoinCount"),
  inboxList: $("#gmInboxList"),
  atbFrame: $("#atbFrame"),
  atbSetup: $("#atbSetup"),
  atbLive: $("#atbLive"),
  encounterStatus: $("#encounterStatus"),
  existingEncounterActions: $("#existingEncounterActions"),
  existingEncounterSummary: $("#existingEncounterSummary"),
  encounterBuilder: $("#encounterBuilder"),
  encounterCharacterList: $("#encounterCharacterList"),
  encounterNpcList: $("#encounterNpcList"),
  encounterNpcEditor: $("#encounterNpcEditor"),
  encounterNpcTemplate: $("#encounterNpcTemplate"),
  addEncounterNpc: $("#addEncounterNpc"),
  beginEncounter: $("#beginEncounter"),
  resumeEncounter: $("#resumeEncounter"),
  prepareNewEncounter: $("#prepareNewEncounter"),
  returnToEncounterSetup: $("#returnToEncounterSetup"),
  liveEncounterCode: $("#liveEncounterCode"),
  storageMode: $("#storageMode"),
  saveCampaignBackup: $("#saveCampaignBackup"),
  restoreOpenCampaignFile: $("#restoreOpenCampaignFile"),
  deleteCampaign: $("#deleteCampaign"),
  kickCharacter: $("#kickCharacter"),
  kickCharacterButton: $("#kickCharacterButton"),
  adjustCharacter: $("#adjustCharacter"),
  adjustCharacterButton: $("#adjustCharacterButton"),
  adjustmentModal: $("#gmAdjustmentModal"),
  adjustmentFrame: $("#gmAdjustmentFrame"),
  commandWindowSettingsForm: $("#commandWindowSettingsForm"),
  universalCommandWindowBonus: $("#universalCommandWindowBonus"),
  commandWindowSettingsMessage: $("#commandWindowSettingsMessage"),
  bannerExitEnabled: $("#bannerExitEnabled"),
  bannerVisibilityToggle: $("#gmBannerVisibilityToggle"),
  hideCampaignRoomCode: $("#hideCampaignRoomCode"),
  settingsRoomCode: $("#settingsRoomCode"),
  revealSettingsRoomCode: $("#revealSettingsRoomCode"),
  roomCodePrivacyMessage: $("#roomCodePrivacyMessage"),
  confirmModal: $("#gmConfirmModal"),
  confirmDialog: $("#gmConfirmModal .gm-confirm-dialog"),
  confirmTitle: $("#gmConfirmTitle"),
  confirmMessage: $("#gmConfirmMessage"),
  confirmInputWrap: $("#gmConfirmInputWrap"),
  confirmInputLabel: $("#gmConfirmInputLabel"),
  confirmInput: $("#gmConfirmInput"),
  confirmError: $("#gmConfirmError"),
  confirmCancel: $("#gmConfirmCancel"),
  confirmAccept: $("#gmConfirmAccept"),
};

const allSkills = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
let campaign = null;
let code = "";
let token = "";
let events = null;
let scriptSaveTimer = null;
let scriptDirty = false;
let lastScriptRange = null;
let activeScriptChapterId = "";
let editingConditionalActionId = "";
let selectedTargets = new Set();
let targetSelectionTouched = false;
const executedCommands = new Set();
let pendingRestoreBackup = null;
let encounterState = null;
let npcSequence = 0;
let stagedNpcs = [];
let encounterNpcDraft = null;
let premadeNpcDraft = null;
let builtinNpcTemplates = [];
let selectedEncounterCharacters = new Set();
const encounterLocations = new Map();
const CAMPAIGN_CACHE_PREFIX = "sa-campaign-cache-v1-";
const NPC_BLANK = { name: "Custom NPC", speed: 5, moveSpeed: 3, maximumHp: 30, physicalAttribute: 6, mentalAttribute: 6, physicalSkill: 1, mentalSkill: 1, heldWeaponId: "unarmed", color: "#39e58f", allyNpc: false };
const BANNER_VISIBILITY_KEY = "sa-interface-banner-visible-v1";
const BANNER_MODE_KEY = "sa-interface-banner-mode-v2";
let bannerExitEnabled = localStorage.getItem("sa-gm-banner-exit-enabled") !== "off";
let interfaceBannerMode = localStorage.getItem(BANNER_MODE_KEY) || (localStorage.getItem(BANNER_VISIBILITY_KEY) === "hidden" ? "hidden" : "show");
let settingsRoomCodeRevealed = false;
let gmSoundsMuted = localStorage.getItem("sa-atb-gm-muted") === "on";
let gmDialogState = null;
let gmDramaAudioContext = null;
let dramaEventCampaignCode = "";
let knownDramaPlayIds = new Set();
let dramaAlertQueue = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(element, message, tone = "") {
  element.textContent = message;
  const baseClass = element === dom.awardMessage ? "tool-message" : "status-message";
  element.className = `${baseClass} ${tone}`.trim();
}

function finishGmDialog(accepted) {
  if (!gmDialogState) return;
  if (accepted && gmDialogState.requiredValue !== null && dom.confirmInput.value !== gmDialogState.requiredValue) {
    dom.confirmError.textContent = "The entered text does not match.";
    dom.confirmInput.focus();
    return;
  }
  const value = gmDialogState.usesInput ? dom.confirmInput.value : accepted;
  const resolve = gmDialogState.resolve;
  gmDialogState = null;
  dom.confirmModal.hidden = true;
  dom.confirmDialog.classList.remove("danger");
  dom.confirmError.textContent = "";
  resolve(accepted ? value : null);
}

function openGmDialog({
  title = "Are you sure?",
  message = "",
  acceptLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  inputLabel = "",
  inputValue = "",
  requiredValue = null,
} = {}) {
  if (gmDialogState) finishGmDialog(false);
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmAccept.textContent = acceptLabel;
  dom.confirmCancel.textContent = cancelLabel;
  dom.confirmAccept.classList.toggle("danger", danger);
  dom.confirmDialog.classList.toggle("danger", danger);
  dom.confirmInputWrap.hidden = !inputLabel;
  dom.confirmInputLabel.textContent = inputLabel || "Response";
  dom.confirmInput.value = inputValue;
  dom.confirmError.textContent = "";
  dom.confirmModal.hidden = false;
  return new Promise((resolve) => {
    gmDialogState = { resolve, usesInput: Boolean(inputLabel), requiredValue };
    requestAnimationFrame(() => (inputLabel ? dom.confirmInput : dom.confirmAccept).focus());
  });
}

async function confirmGm(options) {
  return (await openGmDialog(options)) === true;
}

async function promptGm(options) {
  return openGmDialog(options);
}

dom.confirmCancel.addEventListener("click", () => finishGmDialog(false));
dom.confirmAccept.addEventListener("click", () => finishGmDialog(true));
dom.confirmModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    finishGmDialog(false);
  }
  if (event.key === "Enter" && event.target !== dom.confirmCancel) {
    event.preventDefault();
    finishGmDialog(true);
  }
});
function tokenKey(campaignCode) {
  return `sa-gm-token-${campaignCode}`;
}

function clearAtbBrowserIdentity() {
  localStorage.setItem("sa-atb-mode", "welcome");
  localStorage.removeItem("sa-atb-room-code");
  localStorage.removeItem("sa-atb-unit-id");
  localStorage.removeItem("sa-atb-campaign-character-id");
}

function cacheCampaignState(nextCampaign) {
  if (!nextCampaign?.code) return;
  try {
    localStorage.setItem(`${CAMPAIGN_CACHE_PREFIX}${nextCampaign.code}`, JSON.stringify({
      savedAt: new Date().toISOString(),
      campaign: nextCampaign,
    }));
  } catch {
    // The downloadable backup remains available if browser storage is full.
  }
}

function downloadJson(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function validateCampaignBackup(payload) {
  const backup = payload?.format === "spaceship-architect-campaign" ? payload : null;
  if (!backup?.campaign?.code || !backup?.campaign?.name || !Array.isArray(backup.campaign.characters)) {
    throw new Error("That file is not a Spaceship Architect campaign backup.");
  }
  return backup;
}

async function readCampaignBackup(file) {
  if (!file) throw new Error("Choose a campaign backup file first.");
  return validateCampaignBackup(JSON.parse(await file.text()));
}

function cacheFullCampaignBackup(backup) {
  try {
    localStorage.setItem(`sa-campaign-full-backup-v1-${backup.campaign.code}`, JSON.stringify(backup));
  } catch {
    // Portrait-heavy campaigns may exceed browser storage; the downloaded file remains complete.
  }
}

async function api(path, body = null, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: body === null ? undefined : { "Content-Type": "application/json" },
    body: body === null ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The server rejected that request.");
  return payload;
}

async function encounterAction(action, payload = {}) {
  return api("/api/action", { roomCode: code, gmToken: token, action, ...payload });
}

function characterName(record) {
  return record?.character?.identity?.characterName || "Unnamed Character";
}

function playerName(record) {
  return record?.character?.identity?.playerName || "No Player Name";
}

function selectedRaceEffects(record) {
  const character = record?.character || {};
  const race = raceById(character.identity?.raceId);
  const raceType = race?.types?.find((entry) => entry.id === character.identity?.raceType);
  return {
    ...(race?.effects || {}),
    ...(raceType?.effects || {}),
    skillBonuses: { ...(race?.effects?.skillBonuses || {}), ...(raceType?.effects?.skillBonuses || {}) },
    postFinalizeSkillBonuses: { ...(race?.effects?.postFinalizeSkillBonuses || {}), ...(raceType?.effects?.postFinalizeSkillBonuses || {}) },
  };
}

function playDramaJolt() {
  if (gmSoundsMuted) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  gmDramaAudioContext ||= new Context();
  const audio = gmDramaAudioContext;
  const sound = () => {
    const startsAt = audio.currentTime + 0.015;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, startsAt);
    master.gain.exponentialRampToValueAtTime(0.3, startsAt + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.42);
    master.connect(audio.destination);
    [[155, "sawtooth", 0], [520, "square", 0.035], [920, "triangle", 0.085]].forEach(([frequency, type, offset]) => {
      const oscillator = audio.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startsAt + offset);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(55, frequency * 0.42), startsAt + offset + 0.28);
      oscillator.connect(master);
      oscillator.start(startsAt + offset);
      oscillator.stop(startsAt + offset + 0.32);
    });
  };
  if (audio.state === "suspended") audio.resume().then(sound).catch(() => {});
  else sound();
}

function fillGmDramaCard(card, byline) {
  dom.dramaPlayedBy.textContent = byline;
  dom.dramaCardDisplay.dataset.category = card.category || "";
  dom.dramaCardCategory.textContent = card.category || "Drama Card";
  dom.dramaCardNumber.textContent = `#${String(card.number || 0).padStart(2, "0")}`;
  dom.dramaCardName.textContent = card.name || "Drama Card";
  dom.dramaCardRules.textContent = card.text || "";
  dom.dramaCardHandling.textContent = card.handling || "Reveal, resolve, then discard.";
}

function openGmDramaCard(card, { byline = "Discarded Drama Card", alert = false } = {}) {
  if (!card) return;
  fillGmDramaCard(card, byline);
  dom.dramaAlert.hidden = false;
  if (alert) playDramaJolt();
  requestAnimationFrame(() => dom.dismissDramaCard.focus());
}

function showNextDramaAlert() {
  if (!dom.dramaAlert.hidden || !dramaAlertQueue.length) return;
  const event = dramaAlertQueue.shift();
  openGmDramaCard(event.card, {
    byline: `${event.playerName || "A player"} played ${event.card.name} as ${event.characterName || "their character"}.`,
    alert: true,
  });
}

function gmDramaCardMiniMarkup(card) {
  return `<article class="gm-drama-card-mini-face" data-category="${escapeHtml(card.category || "")}">
    <header><span>${escapeHtml(card.category || "Drama Card")}</span><b>#${String(card.number || 0).padStart(2, "0")}</b></header>
    <div><span class="gm-drama-mini-sigil" aria-hidden="true">SA</span><h4>${escapeHtml(card.name || "Drama Card")}</h4><p>${escapeHtml(card.text || "")}</p></div>
    <footer>${escapeHtml(card.handling || "Reveal, resolve, then discard.")}</footer>
  </article>`;
}

function processDramaPlayEvents(nextCampaign) {
  const plays = Array.isArray(nextCampaign?.dramaDeck?.playEvents) ? nextCampaign.dramaDeck.playEvents : [];
  if (dramaEventCampaignCode !== nextCampaign?.code) {
    dramaEventCampaignCode = nextCampaign?.code || "";
    knownDramaPlayIds = new Set(plays.map((event) => event.id));
    dramaAlertQueue = [];
    return;
  }
  for (const event of plays) {
    if (!event?.id || knownDramaPlayIds.has(event.id)) continue;
    knownDramaPlayIds.add(event.id);
    if (event.card) dramaAlertQueue.push(event);
  }
  showNextDramaAlert();
}

function skillRating(record, name) {
  const computed = Number(record?.character?.computed?.skills?.[name]);
  if (Number.isFinite(computed)) return computed.toFixed(1);
  const character = record?.character || {};
  let tenths = Number(character.skills?.[name]?.tenths) || 0;
  if (!character.creation?.manualInput) {
    const race = selectedRaceEffects(record);
    tenths += Number(race.skillBonuses?.[name]) || 0;
    if (character.phase === "finalized") {
      tenths += Number(race.postFinalizeSkillBonuses?.[name]) || 0;
      tenths += Number(classById(character.identity?.classId)?.effects?.skillBonuses?.[name]) || 0;
      tenths += Number(character.creation?.racialSkillGrants?.[name]) || 0;
    }
  }
  return (tenths / 10).toFixed(1);
}

function boxesFilled(record, attribute) {
  return (record?.character?.attributes?.[attribute] || []).reduce((total, die) => total + Math.max(0, Number(die) + 1), 0);
}

function highestAttributeDie(record, attribute) {
  return Math.max(0, ...(record?.character?.attributes?.[attribute] || [])
    .filter((value) => Number(value) >= 0)
    .map((value) => DICE_FACES[Number(value)] || 0));
}

function characterSpeed(record) {
  const initiative = Number(skillRating(record, "Initiative")) || 0;
  const multiplier = record?.character?.identity?.classId === "mastermind" ? 1.5 : 1;
  return record?.character?.computed?.speed
    ?? Math.max(1, boxesFilled(record, "intellect") + initiative * multiplier);
}

function commandWindow(record) {
  const awarenessMultiplier = record?.character?.identity?.classId === "mastermind" ? 45 : 12;
  const base = record?.character?.computed?.commandWindow
    ?? Math.max(1, boxesFilled(record, "perception") * 8 + (Number(skillRating(record, "Awareness")) || 0) * awarenessMultiplier);
  const campaignBonus = Math.max(0, Number(campaign?.settings?.commandWindowBonus) || 0);
  return Math.max(1, Number(base) + campaignBonus);
}

function combatWeaponInventory(record) {
  return (record?.character?.weapons || []).flatMap((entry) => {
    const weapon = weaponById(entry?.weaponId);
    if (!weapon) return [];
    return [{ inventoryId: String(entry.id || weapon.id), weaponId: weapon.id }];
  });
}

function encounterRuleFields(record) {
  const identity = record?.character?.identity || {};
  const race = selectedRaceEffects(record);
  const heldEntry = (record?.character?.weapons || []).find((entry) => entry?.held && weaponById(entry.weaponId));
  const recurringHealing = identity.raceId === "everliving-brethren"
    ? { amount: highestAttributeDie(record, "health"), label: "Everliving Brethren" }
    : identity.raceId === "yuhorn-symitron" && identity.raceType === "wood"
      ? { amount: Math.max(0, Number(record?.character?.resources?.exertionCurrent) || 0) * 3, label: "Wood Symitron" }
      : null;
  return {
    raceId: identity.raceId || "",
    raceType: identity.raceType || "",
    classId: identity.classId || "",
    initialAtb: identity.classId === "rogue-drifter" ? 99 : 0,
    regenerationRate: identity.raceId === "antropic" && identity.raceType === "fins" ? boxesFilled(record, "health") : 0,
    regenerationLabel: identity.raceId === "antropic" && identity.raceType === "fins" ? "Antropic Fins" : "",
    recurringHealingInterval: recurringHealing?.amount ? 6 : 0,
    recurringHealingAmount: recurringHealing?.amount || 0,
    recurringHealingLabel: recurringHealing?.label || "",
    defenseScoreModifier: Number(race.defenseScoreModifier) || 0,
    dexterityBoxes: boxesFilled(record, "dexterity"),
    highestPerceptionDie: highestAttributeDie(record, "perception"),
    moveSpeed: Math.max(1, Number(record?.character?.computed?.moveSpeed) || 1),
    dexterityDice: (record?.character?.attributes?.dexterity || []).filter((value) => Number(value) >= 0).map((value) => DICE_FACES[Number(value)] || 0),
    strengthDice: (record?.character?.attributes?.strength || []).filter((value) => Number(value) >= 0).map((value) => DICE_FACES[Number(value)] || 0),
    projectileSkill: Number(skillRating(record, "Projectile")) || 0,
    meleeSkill: Number(skillRating(record, "Melee")) || 0,
    dodgeSkill: Number(skillRating(record, "Dodge/Block")) || 0,
    damageReduction: Math.max(0, Number(record?.character?.computed?.damageReduction) || 0),
    maximumHp: Math.max(0, Number(record?.character?.computed?.maximumHp) || 0),
    currentHp: Math.max(0, Number(record?.character?.health?.current ?? record?.character?.computed?.maximumHp) || 0),
    weaponMechanics: Number(skillRating(record, "Weapon Mechanics")) || 0,
    weapons: combatWeaponInventory(record),
    heldWeaponId: heldEntry ? String(heldEntry.id || heldEntry.weaponId) : "",
  };
}

function populateRulesControls() {
  const attributeOptions = ATTRIBUTE_DEFS.map((definition) => `<option value="${definition.label}">${definition.label}</option>`).join("");
  const skillOptions = allSkills.map((skill) => `<option value="${escapeHtml(skill)}">${escapeHtml(skill)}</option>`).join("");
  dom.scriptAttribute.innerHTML = attributeOptions;
  dom.promptAttribute.innerHTML = attributeOptions;
  dom.conditionalAttribute.innerHTML = attributeOptions;
  dom.scriptSkill.innerHTML = skillOptions;
  dom.promptSkill.innerHTML = skillOptions;
  dom.conditionalSkill.innerHTML = skillOptions;
}

function selectedRecords() {
  return campaign?.characters?.filter((record) => selectedTargets.has(record.id)) || [];
}

function scriptChapters() {
  if (campaign?.scriptChapters?.length) return campaign.scriptChapters;
  return [{ id: "chapter-1", name: "Chapter 1", script: campaign?.script || "" }];
}

function activeScriptChapter() {
  const chapters = scriptChapters();
  return chapters.find((entry) => entry.id === activeScriptChapterId) || chapters[0];
}

function renderScriptChapterControls() {
  const chapters = scriptChapters();
  if (!chapters.some((entry) => entry.id === activeScriptChapterId)) activeScriptChapterId = chapters[0]?.id || "";
  dom.scriptChapterTabs.innerHTML = chapters.map((entry) =>
    `<button type="button" data-script-chapter="${entry.id}" class="${entry.id === activeScriptChapterId ? "active" : ""}">${escapeHtml(entry.name)}</button>`
  ).join("");
  dom.deleteScriptChapter.disabled = chapters.length <= 1;
}

function syncConditionalKind() {
  const award = dom.conditionalKind.value === "award";
  dom.conditionalMessageWrap.hidden = award;
  dom.conditionalAwardWrap.hidden = !award;
}

function clearConditionalForm() {
  editingConditionalActionId = "";
  dom.conditionalSelect.value = "";
  dom.conditionalKeyword.value = "";
  dom.conditionalKind.value = "message";
  dom.conditionalMessage.value = "";
  dom.conditionalResource.value = "experience";
  dom.conditionalAmount.value = "1";
  dom.conditionalDifficulty.value = "";
  dom.conditionalHideDifficulty.checked = false;
  dom.deleteConditionalAction.disabled = true;
  syncConditionalKind();
}

function loadConditionalForm(actionId) {
  const action = (campaign?.conditionalActions || []).find((entry) => entry.id === actionId);
  if (!action) {
    clearConditionalForm();
    return;
  }
  editingConditionalActionId = action.id;
  dom.conditionalSelect.value = action.id;
  dom.conditionalKeyword.value = action.keyword;
  dom.conditionalKind.value = action.kind;
  dom.conditionalMessage.value = action.message || "";
  dom.conditionalResource.value = action.resource || "experience";
  dom.conditionalAmount.value = String(action.amount || 1);
  dom.conditionalAttribute.value = action.attribute;
  dom.conditionalSkill.value = action.skill;
  dom.conditionalDifficulty.value = String(action.difficulty);
  dom.conditionalHideDifficulty.checked = Boolean(action.hideDifficulty);
  dom.deleteConditionalAction.disabled = false;
  syncConditionalKind();
}

function renderConditionalControls() {
  const actions = campaign?.conditionalActions || [];
  const selected = editingConditionalActionId;
  const selectedScriptAction = dom.scriptCommandType.value;
  const options = actions.map((entry) => `<option value="${entry.id}">${escapeHtml(entry.keyword)}</option>`).join("");
  dom.conditionalSelect.innerHTML = `<option value="">New Action...</option>${options}`;
  dom.scriptCommandType.innerHTML = `<option value="">Direct Roll</option>${actions.map((entry) => `<option value="${entry.id}">Keyword: ${escapeHtml(entry.keyword)}</option>`).join("")}`;
  if (actions.some((entry) => entry.id === selectedScriptAction)) dom.scriptCommandType.value = selectedScriptAction;
  syncScriptCommandType();
  if (actions.some((entry) => entry.id === selected)) dom.conditionalSelect.value = selected;
  else if (selected) clearConditionalForm();
}

function syncSelectedTargets() {
  if (!campaign) return;
  const valid = new Set(campaign.characters.map((record) => record.id));
  selectedTargets = new Set([...selectedTargets].filter((id) => valid.has(id)));
  dom.selectedTargetCount.textContent = `${selectedTargets.size} Selected`;
}

function renderTargets() {
  if (!targetSelectionTouched && !selectedTargets.size && campaign.characters.length === 1) {
    selectedTargets.add(campaign.characters[0].id);
  }
  syncSelectedTargets();
  dom.promptTargets.innerHTML = campaign.characters.length
    ? campaign.characters.map((record) => `
      <label class="target-option">
        <input type="checkbox" data-target-id="${record.id}" ${selectedTargets.has(record.id) ? "checked" : ""} />
        <span><strong>${escapeHtml(characterName(record))}</strong><small>${record.connected ? "Connected" : "Offline"}</small></span>
      </label>`).join("")
    : "<p>No characters have been created for this campaign.</p>";
}

function renderCharacters() {
  dom.characterCount.textContent = `${campaign.characters.length} Character${campaign.characters.length === 1 ? "" : "s"}`;
  dom.characterList.innerHTML = campaign.characters.length
    ? campaign.characters.map((record) => {
      const character = record.character || {};
      const color = character.presentation?.atbColor || "#39e58f";
      const notes = record.privateNotes || [];
      const readNotes = notes.filter((note) => note.readAt).length;
      const classId = character.identity?.classId || "";
      const classActions = classId === "playboy-minx"
        ? `<button type="button" data-class-action="playboy-reward" data-character-id="${record.id}">+1 REV / +5 XP</button>`
        : classId === "psychopath"
          ? `<button type="button" data-class-action="psychopath-reward" data-character-id="${record.id}">+8 XP KILL</button>`
          : classId === "peacekeeper"
            ? `<button type="button" data-class-action="peacekeeper-reward" data-character-id="${record.id}">PREVENTED COMBAT: +1 DRAMA</button>`
            : "";
      return `<article class="gm-character-card ${record.connected ? "connected" : ""}" style="--character-color:${color}">
        <div class="character-card-head"><span class="character-swatch"></span><div><strong>${escapeHtml(characterName(record))}</strong><small>${escapeHtml(playerName(record))} ${record.connected ? "| CONNECTED" : "| OFFLINE"}</small></div></div>
        <div class="character-details">
          <div><span>Speed</span><strong>${Number(characterSpeed(record)).toFixed(1).replace(/\.0$/, "")}</strong></div>
          <div><span>Command</span><strong>${Math.round(commandWindow(record))} SEC</strong></div>
          <div><span>Notes Read</span><strong>${readNotes}/${notes.length}</strong></div>
        </div>
        <div class="pin-readout"><span>PC CODE</span><strong>${escapeHtml(record.pcCode || "----")}</strong></div>
        <div class="character-card-actions"><button type="button" data-view-sheet="${record.id}">View Sheet</button>${classActions}</div>
      </article>`;
    }).join("")
    : "<p>No characters yet. Players can create one from the Characters option on the main menu.</p>";
  const discard = campaign.dramaDeck?.discard || [];
  dom.dramaDiscardCount.textContent = `${discard.length} Card${discard.length === 1 ? "" : "s"}`;
  dom.dramaDiscardList.innerHTML = discard.length
    ? discard.map((card) => `<button type="button" class="gm-drama-card-mini" data-discard-card="${escapeHtml(card.id)}" data-category="${escapeHtml(card.category || "")}" aria-label="View ${escapeHtml(card.name || "Drama Card")}">${gmDramaCardMiniMarkup(card)}</button>`).join("")
    : "<p>No Drama Cards have been played.</p>";
  dom.reshuffleDramaCards.disabled = discard.length === 0;
}

function renderStarships() {
  if (!dom.starshipList) return;
  const ships = campaign?.starships || [];
  dom.starshipCount.textContent = `${ships.length} Starship${ships.length === 1 ? "" : "s"}`;
  dom.starshipList.innerHTML = ships.length ? ships.map((record) => {
    const hull = record.ship?.confirmed?.gridCells?.length ?? record.ship?.gridCells?.length ?? 0;
    const engines = record.ship?.confirmed?.placements?.length ?? record.ship?.placements?.length ?? 0;
    const crew = new Set(record.crewCharacterIds || []);
    return `<article class="gm-starship-card" data-starship-id="${escapeHtml(record.id)}">
      <header><div><h3>${escapeHtml(record.title || "Untitled Starship")}</h3><small>${escapeHtml(record.ship?.class || "Unclassified")} · ${escapeHtml(record.ship?.affiliation || "No Affiliation")}</small></div><strong>${record.controlType === "gm" ? "GM" : "PC"}</strong></header>
      <dl><div><dt>Hull</dt><dd>${hull}</dd></div><div><dt>EN</dt><dd>${engines * 5}</dd></div><div><dt>Crew</dt><dd>${crew.size}</dd></div></dl>
      <label>Control<select data-starship-control><option value="pc" ${record.controlType === "pc" ? "selected" : ""}>PC Controlled</option><option value="gm" ${record.controlType === "gm" ? "selected" : ""}>GM Controlled</option></select></label>
      <div class="gm-starship-crew">${campaign.characters.length ? campaign.characters.map((character) => `<label><input type="checkbox" data-starship-crew="${character.id}" ${crew.has(character.id) ? "checked" : ""}/> ${escapeHtml(characterName(character))}</label>`).join("") : "<small>No campaign characters available.</small>"}</div>
      <div class="gm-starship-actions"><button type="button" data-open-starship>Open / Edit</button><button type="button" data-save-starship-crew>Save Crew</button><button type="button" class="danger" data-unlink-starship>Unlink</button></div>
    </article>`;
  }).join("") : "<p>No starships are linked to this campaign yet. Link one from the Starship Creator with this campaign's Room Code.</p>";
  if (dom.showcaseNpcFleet) {
    const npcs = encounterState?.units?.filter((unit) => unit.team === "npc") || [];
    dom.showcaseNpcFleet.hidden = !SHOWCASE_MODE;
    dom.showcaseNpcFleetList.innerHTML = npcs.map((unit) => `<label class="showcase-npc-location"><span><i style="--npc-color:${escapeHtml(unit.color || "#999")}"></i><strong>${escapeHtml(unit.characterName)}</strong></span><select data-showcase-npc-location="${escapeHtml(unit.id)}">${deploymentOptions(unit.location?.starshipId || "")}</select></label>`).join("");
  }
}

function renderRollResults() {
  const requests = [...(campaign.rollRequests || [])].reverse().filter((request) => !request.closedAt);
  dom.rollResults.innerHTML = requests.length ? requests.map((request) => {
    const rows = request.targetIds.map((targetId) => {
      const record = campaign.characters.find((entry) => entry.id === targetId);
      const result = request.results?.[targetId];
      return {
        name: characterName(record),
        result,
      };
    }).sort((a, b) => (b.result?.score ?? -Infinity) - (a.result?.score ?? -Infinity));
    return `<article class="roll-request-card">
      <div class="roll-request-head"><div><strong>${escapeHtml(request.attribute)} + ${escapeHtml(request.skill)}</strong><small>${request.difficulty === null ? "No Difficulty" : `Difficulty ${request.difficulty}${request.hideDifficulty ? " (Hidden)" : ""}`}</small></div><button type="button" data-close-roll="${request.id}">Close</button></div>
      ${rows.map(({ name, result }) => `<div class="result-row"><span>${escapeHtml(name)}</span>${result ? `<strong>${result.score}</strong><small>${escapeHtml(result.outcome || result.mode)}</small>` : '<span class="waiting">Waiting</span><small>Pending</small>'}</div>`).join("")}
    </article>`;
  }).join("") : "<p>No active roll requests.</p>";
}

function parseCommand(raw, index) {
  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  let rollPart = parts.shift() || "";
  if (/^(all players|all pcs|choose pc|target character)/i.test(rollPart)) rollPart = parts.shift() || "";
  let [attribute, skill] = rollPart.split("+").map((part) => part?.trim());
  const difficultyPart = parts.find((part) => /^difficulty\s+/i.test(part));
  let difficulty = difficultyPart ? Number(difficultyPart.replace(/^difficulty\s+/i, "")) : null;
  let hideDifficulty = parts.some((part) => /^hidden$/i.test(part));
  const keyword = rollPart.match(/^keyword\s*:\s*(.+)$/i)?.[1]?.trim() || "";
  const conditionalAction = keyword
    ? (campaign?.conditionalActions || []).find((entry) => entry.keyword.toLowerCase() === keyword.toLowerCase())
    : null;
  if (conditionalAction) {
    attribute = conditionalAction.attribute;
    skill = conditionalAction.skill;
    difficulty = Number(conditionalAction.difficulty);
    hideDifficulty = Boolean(conditionalAction.hideDifficulty);
  }
  const validAttribute = ATTRIBUTE_DEFS.some((definition) => definition.label.toLowerCase() === String(attribute || "").toLowerCase());
  const validSkill = allSkills.some((entry) => entry.toLowerCase() === String(skill || "").toLowerCase());
  return {
    id: `script-command-${index}`,
    raw,
    attribute,
    skill,
    keyword,
    conditionalActionId: conditionalAction?.id || "",
    conditionalAction,
    difficulty: Number.isFinite(difficulty) ? difficulty : null,
    hideDifficulty,
    valid: Boolean(validAttribute && validSkill && (!keyword || conditionalAction)),
  };
}

function scriptSource() {
  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.matches("[data-script-command]")) return `::${node.dataset.commandRaw || ""}::`;
    if (node.tagName === "BR") return "\n";
    const content = [...node.childNodes].map(serialize).join("");
    return ["DIV", "P"].includes(node.tagName) ? `${content}\n` : content;
  }
  return [...dom.script.childNodes]
    .map(serialize)
    .join("")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u200b", "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n$/, "");
}

function inboxItemActions(note) {
  if (note.kind === "reverence-gift-request" && note.requestStatus === "pending") {
    return `<div class="inbox-actions"><button class="danger" type="button" data-reverence-gift-decision="deny" data-note-id="${escapeHtml(note.id)}">Deny</button><button class="primary" type="button" data-reverence-gift-decision="approve" data-note-id="${escapeHtml(note.id)}">Approve</button></div>`;
  }
  if (note.kind === "rest-request" && note.requestStatus === "pending") {
    return `<div class="inbox-actions"><button class="danger" type="button" data-rest-decision="deny" data-note-id="${escapeHtml(note.id)}">Deny</button><button class="primary" type="button" data-rest-decision="approve-all" data-note-id="${escapeHtml(note.id)}">Approve for All</button></div>`;
  }
  if (note.kind !== "item-transaction") return "";
  const deny = note.reversible ? `<button class="danger" type="button" data-deny-item="${escapeHtml(note.transactionId)}">Deny</button>` : "";
  const cover = Number(note.deficit) > 0 ? `<button type="button" data-cover-deficit="${escapeHtml(note.characterId)}">Cover Deficit (+${Number(note.deficit).toLocaleString()} Credits)</button>` : "";
  return deny || cover ? `<div class="inbox-actions">${deny}${cover}</div>` : "";
}


function renderInbox() {
  const requests = campaign.joinRequests || [];
  const inbox = [...(campaign.inbox || [])].reverse();
  const unread = inbox.filter((entry) => entry.direction === "to-gm" && !entry.readAt).length + requests.length;
  dom.inboxCount.textContent = unread ? String(unread) : "0";
  dom.pendingJoinCount.textContent = `${requests.length} Pending`;
  const requestMarkup = requests.map((request) => {
    const name = request.character?.identity?.characterName || "Unnamed Character";
    const player = request.character?.identity?.playerName || "Player";
    return `<article class="gm-inbox-card join-request-card" data-join-request="${request.id}">
      <div><span>JOIN REQUEST</span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(player)} | PC Code: ${escapeHtml(request.pcCode)}</small></div>
      <div class="inbox-actions"><button type="button" data-join-decision="reject">Reject</button><button class="primary" type="button" data-join-decision="approve">Approve</button></div>
    </article>`;
  }).join("");
  const messageMarkup = inbox.map((note) => `<article class="gm-inbox-card ${note.direction === "to-gm" && !note.readAt ? "unread" : ""}" data-gm-note="${note.id}">
    <div><span>${note.kind === "roll-request" ? "ROLL REQUEST" : note.kind === "award" ? "GM AWARD" : note.kind === "reverence-gift-request" ? "REVERENCE SUGGESTION" : note.kind === "system" ? "CAMPAIGN NOTICE" : note.direction === "to-gm" ? "PLAYER MESSAGE" : "SENT MESSAGE"}</span><strong>${escapeHtml(note.characterName || "Character")}</strong><small>${new Date(note.createdAt).toLocaleString()}</small></div>
    <p>${escapeHtml(note.message)}</p>
    ${inboxItemActions(note)}
  </article>`).join("");
  dom.inboxList.innerHTML = requestMarkup + messageMarkup || '<p class="empty-inbox">No campaign messages or pending characters.</p>';
}

function renderSettings() {
  const options = campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("");
  dom.kickCharacter.innerHTML = options || '<option value="">No campaign characters</option>';
  dom.adjustCharacter.innerHTML = options || '<option value="">No campaign characters</option>';
  dom.kickCharacterButton.disabled = !campaign.characters.length;
  dom.adjustCharacterButton.disabled = !campaign.characters.length;
  dom.hideCampaignRoomCode.checked = Boolean(campaign.settings?.hideRoomCode);
  dom.settingsRoomCode.textContent = settingsRoomCodeRevealed ? campaign.code : "••••";
  dom.revealSettingsRoomCode.classList.toggle("revealed", settingsRoomCodeRevealed);
  dom.revealSettingsRoomCode.setAttribute("aria-label", settingsRoomCodeRevealed ? "Hide Room Code" : "Show Room Code");
  dom.revealSettingsRoomCode.title = settingsRoomCodeRevealed ? "Hide Room Code" : "Show Room Code";
}

function scriptCommandList(source = scriptSource()) {
  const commands = [];
  const expression = /::([\s\S]*?)::/g;
  let match;
  while ((match = expression.exec(source))) commands.push(parseCommand(match[1], commands.length));
  return commands;
}

function npcTemplateById(templateId) {
  return [...builtinNpcTemplates, ...(campaign?.npcTemplates || [])].find((template) => template.id === templateId) || null;
}

function stagedNpc(source = null) {
  const template = source || builtinNpcTemplates[npcSequence % Math.max(1, builtinNpcTemplates.length)] || NPC_BLANK;
  npcSequence += 1;
  return {
    ...NPC_BLANK,
    ...structuredClone(template),
    id: `staged-npc-${Date.now()}-${npcSequence}`,
    templateId: template.id || "",
    customTemplate: Boolean((campaign?.npcTemplates || []).some((entry) => entry.id === template.id)),
  };
}

function randomBuiltinNpc() {
  const template = builtinNpcTemplates[Math.floor(Math.random() * Math.max(1, builtinNpcTemplates.length))] || NPC_BLANK;
  return stagedNpc(template);
}

function npcTemplateOptions() {
  const builtins = builtinNpcTemplates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join("");
  const custom = (campaign?.npcTemplates || []).map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)} (Saved)</option>`).join("");
  return `<optgroup label="Built-in NPCs">${builtins}</optgroup>${custom ? `<optgroup label="Campaign NPCs">${custom}</optgroup>` : ""}`;
}

function npcWeaponOptions(selectedId) {
  return WEAPONS.filter((weapon) => ["ranged", "melee"].includes(weapon.category)).map((weapon) => `<option value="${escapeHtml(weapon.id)}" ${weapon.id === selectedId ? "selected" : ""}>${escapeHtml(weapon.id === "unarmed" ? "(Unarmed)" : weapon.name)}</option>`).join("");
}

function npcEditorMarkup(npc) {
  if (!npc) return "";
  return `<article class="encounter-npc-card npc-editor-card" data-npc-editor>
    <div class="npc-card-head">
      <label>Name<input data-npc-field="name" value="${escapeHtml(npc.name)}" maxlength="40" /></label>
      <label>ATB Speed<input data-npc-field="speed" type="number" min="0.1" max="100" step="0.1" value="${npc.speed}" /></label>
      <label>Move<input data-npc-field="moveSpeed" type="number" min="1" max="30" step="0.1" value="${npc.moveSpeed}" /></label>
      <label>HP<input data-npc-field="maximumHp" type="number" min="1" max="999999" step="1" value="${npc.maximumHp}" /></label>
      <label>Color<input data-npc-field="color" type="color" value="${escapeHtml(npc.color)}" /></label>
      <label class="npc-ally-field"><input data-npc-field="allyNpc" type="checkbox" ${npc.allyNpc ? "checked" : ""} /> Ally</label>
    </div>
    <div class="npc-card-stats">
      <label>Physical Attribute <span>2-20</span><input data-npc-field="physicalAttribute" type="number" min="2" max="20" step="1" value="${npc.physicalAttribute}" /></label>
      <label>Physical Skill <span>0-4</span><input data-npc-field="physicalSkill" type="number" min="0" max="4" step="0.1" value="${npc.physicalSkill}" /></label>
      <label>Mental Attribute <span>2-20</span><input data-npc-field="mentalAttribute" type="number" min="2" max="20" step="1" value="${npc.mentalAttribute}" /></label>
      <label>Mental Skill <span>0-4</span><input data-npc-field="mentalSkill" type="number" min="0" max="4" step="0.1" value="${npc.mentalSkill}" /></label>
      <label class="npc-weapon-field">Held Weapon<select data-npc-field="heldWeaponId">${npcWeaponOptions(npc.heldWeaponId)}</select></label>
    </div>
  </article>`;
}

function updateNpcField(npc, field, value) {
  if (!npc || !field) return;
  if (field === "allyNpc") {
    npc.allyNpc = Boolean(value);
    return;
  }
  const ranges = {
    speed: [0.1, 100], moveSpeed: [1, 30], maximumHp: [1, 999999],
    physicalAttribute: [2, 20], mentalAttribute: [2, 20], physicalSkill: [0, 4], mentalSkill: [0, 4],
  };
  if (ranges[field]) {
    const [minimum, maximum] = ranges[field];
    npc[field] = Math.max(minimum, Math.min(maximum, Number(value) || minimum));
  } else {
    npc[field] = value;
  }
}

function npcTemplatePayload(npc) {
  return {
    id: npc.customTemplate && npc.templateId ? npc.templateId : `npc-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(npc.name || "Custom NPC").trim() || "Custom NPC",
    speed: Number(npc.speed) || 5,
    moveSpeed: Number(npc.moveSpeed) || 3,
    maximumHp: Number(npc.maximumHp) || 30,
    physicalAttribute: Number(npc.physicalAttribute) || 6,
    mentalAttribute: Number(npc.mentalAttribute) || 6,
    physicalSkill: Number(npc.physicalSkill) || 0,
    mentalSkill: Number(npc.mentalSkill) || 0,
    heldWeaponId: npc.heldWeaponId || "unarmed",
    color: npc.color || "#39e58f",
    allyNpc: Boolean(npc.allyNpc),
  };
}

async function saveNpcTemplate(npc) {
  const next = npcTemplatePayload(npc);
  const templates = [...(campaign?.npcTemplates || [])];
  const existing = templates.findIndex((template) => template.id === next.id);
  if (existing >= 0) templates[existing] = next;
  else templates.push(next);
  const payload = await api("/api/campaign/npc-templates", { code, token, templates });
  receiveCampaign(payload.campaign);
  showMessage(dom.message, `${next.name} saved to this campaign's NPC templates.`, "success");
  return next;
}

async function deleteNpcTemplate(templateId) {
  const template = (campaign?.npcTemplates || []).find((entry) => entry.id === templateId);
  if (!template) return;
  if (!await confirmGm({ title: "Delete Premade NPC?", message: `Delete "${template.name}"? Deployed copies already in Combat will not change.`, acceptLabel: "Delete NPC", danger: true })) return;
  const templates = (campaign?.npcTemplates || []).filter((entry) => entry.id !== templateId);
  const payload = await api("/api/campaign/npc-templates", { code, token, templates });
  receiveCampaign(payload.campaign);
  premadeNpcDraft = stagedNpc(NPC_BLANK);
  renderPremadeNpcConsole();
  showMessage(dom.message, `${template.name} was deleted from Premade NPCs.`, "success");
}

function renderPremadeNpcConsole() {
  const templates = campaign?.npcTemplates || [];
  if (!premadeNpcDraft) premadeNpcDraft = templates.length ? stagedNpc(templates[0]) : stagedNpc(NPC_BLANK);
  dom.premadeNpcSelect.innerHTML = `<option value="">New Premade NPC</option>${templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join("")}`;
  dom.premadeNpcSelect.value = premadeNpcDraft.customTemplate ? premadeNpcDraft.templateId : "";
  dom.premadeNpcEditor.innerHTML = npcEditorMarkup(premadeNpcDraft);
  dom.deletePremadeNpc.disabled = !premadeNpcDraft.customTemplate;
  dom.savePremadeNpc.textContent = premadeNpcDraft.customTemplate ? "Update Premade NPC" : "Save Premade NPC";
}

function ensureEncounterDefaults() {
  const approved = (campaign?.characters || []).filter((record) => record.approved !== false);
  if (!selectedEncounterCharacters.size) selectedEncounterCharacters = new Set(approved.map((record) => record.id));
  if (!encounterNpcDraft) encounterNpcDraft = randomBuiltinNpc();
}

function renderEncounterBuilder() {
  if (!campaign) return;
  ensureEncounterDefaults();
  const approved = campaign.characters.filter((record) => record.approved !== false);
  dom.encounterCharacterList.innerHTML = approved.length ? approved.map((record) => {
    const color = record.character?.presentation?.atbColor || "#39e58f";
    const deployment = encounterLocations.has(record.id) ? encounterLocations.get(record.id) : defaultDeployment(record);
    encounterLocations.set(record.id, deployment);
    return `<label class="encounter-character-option" style="--character-color:${escapeHtml(color)}">
      <input type="checkbox" data-encounter-character="${record.id}" ${selectedEncounterCharacters.has(record.id) ? "checked" : ""} />
      <span><strong>${escapeHtml(characterName(record))}</strong><small>${escapeHtml(playerName(record))}</small></span>
      <span class="encounter-stat">SPD ${Number(characterSpeed(record)).toFixed(1).replace(/\.0$/, "")}</span>
      <span class="encounter-stat">CMD ${Math.round(commandWindow(record))}</span>
      <select class="encounter-deployment" data-encounter-location="${record.id}" aria-label="Starting location for ${escapeHtml(characterName(record))}">${deploymentOptions(deployment)}</select>
    </label>`;
  }).join("") : '<p>No approved campaign characters are available yet.</p>';
  dom.encounterNpcTemplate.innerHTML = npcTemplateOptions();
  dom.encounterNpcTemplate.value = encounterNpcDraft?.templateId || "";
  dom.encounterNpcEditor.innerHTML = npcEditorMarkup(encounterNpcDraft);
  dom.encounterNpcList.innerHTML = stagedNpcs.length ? stagedNpcs.map((npc) => `<article class="staged-npc-summary" data-staged-npc="${npc.id}" style="--npc-color:${escapeHtml(npc.color)}">
    <div><strong>${npc.allyNpc ? '<img class="npc-ally-badge" src="SMILE.png?v=20260817" title="Ally NPC" alt="Ally NPC" />' : ""}${escapeHtml(npc.name)}</strong><small>Speed ${Number(npc.speed).toFixed(1).replace(/\.0$/, "")} | HP ${npc.maximumHp} | Phys ${npc.physicalAttribute}a/+${npc.physicalSkill} | Men ${npc.mentalAttribute}a/+${npc.mentalSkill} | Move ${npc.moveSpeed}</small></div>
    <span>${escapeHtml(weaponById(npc.heldWeaponId)?.name || "Unarmed")}</span>
    <select class="encounter-deployment" data-staged-location="${npc.id}" aria-label="Starting location for ${escapeHtml(npc.name)}">${deploymentOptions(npc.locationStarshipId || "")}</select>
    <button type="button" class="danger" data-remove-staged-npc="${npc.id}" aria-label="Remove ${escapeHtml(npc.name)}">Remove</button>
  </article>`).join("") : '<p class="empty-npc-stage">No NPCs have been added to this Combat yet.</p>';
  dom.beginEncounter.disabled = !selectedEncounterCharacters.size && !stagedNpcs.length;
}

function renderEncounterStatus() {
  const units = encounterState?.units || [];
  const hasEncounter = units.length > 0;
  dom.encounterStatus.textContent = hasEncounter ? `${units.length} Participant${units.length === 1 ? "" : "s"} Saved` : "No Active Encounter";
  dom.existingEncounterActions.hidden = !hasEncounter;
  dom.existingEncounterSummary.textContent = hasEncounter
    ? `${units.map((unit) => unit.characterName).join(", ")} ${encounterState.running ? "are currently on the clock." : "are preserved in a paused encounter."}`
    : "";
  dom.encounterBuilder.hidden = hasEncounter;
  renderEncounterBuilder();
  updateExitEncounterVisibility();
}

function updateExitEncounterVisibility() {
  const liveFrameOpen = dom.atbLive && !dom.atbLive.hidden;
  dom.exitEncounter.hidden = !campaign || !(encounterState?.units?.length) || liveFrameOpen;
}

function deploymentOptions(selected = "") {
  return `<option value="">Exterior / Surface</option>${(campaign?.starships || []).map((record) => `<option value="${escapeHtml(record.id)}" ${record.id === selected ? "selected" : ""}>${escapeHtml(record.title || record.ship?.title || "Starship")}</option>`).join("")}`;
}

function defaultDeployment(record) {
  return (campaign?.starships || []).find((ship) => ship.controlType === "pc" && ship.crewCharacterIds?.includes(record.id))?.id || "";
}

function combatLocation(starshipId) {
  const record = (campaign?.starships || []).find((entry) => entry.id === starshipId);
  const square = Number(record?.ship?.gridCells?.[0]);
  return starshipId && Number.isInteger(square)
    ? { environment: "starship", starshipId, square, mesh: 4, sicId: "", stationed: false }
    : { environment: "exterior", starshipId: "", square: null, mesh: 4, sicId: "", stationed: false };
}

function selectGmTab(tabName = "script") {
  const selected = document.querySelector(`.gm-tabs [data-tab="${tabName}"]`) || document.querySelector('.gm-tabs [data-tab="script"]');
  document.querySelectorAll(".gm-tabs [data-tab]").forEach((entry) => entry.classList.toggle("active", entry === selected));
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    const active = panel.dataset.tabPanel === selected?.dataset.tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (selected?.dataset.tab === "atb") showEncounterSetup();
  updateExitEncounterVisibility();
}

async function refreshEncounterState() {
  if (!code) return null;
  encounterState = await api(`/api/state?room=${encodeURIComponent(code)}`, null, "GET");
  renderEncounterStatus();
  if (SHOWCASE_MODE) renderStarships();
  return encounterState;
}

async function syncCampaignCharactersToEncounter() {
  await refreshCampaign();
  await refreshEncounterState();
  const updates = (encounterState?.units || []).flatMap((unit) => {
    if (!unit.characterId) return [];
    const record = campaign.characters.find((entry) => entry.id === unit.characterId);
    if (!record) return [];
    return [{
      characterId: record.id,
      playerName: playerName(record),
      characterName: characterName(record),
      speed: characterSpeed(record),
      commandWindow: commandWindow(record),
      color: record.character?.presentation?.atbColor || "#39e58f",
      ...encounterRuleFields(record),
    }];
  });
  if (updates.length) encounterState = await encounterAction("syncCampaignUnits", { units: updates });
  return updates.length;
}

function showEncounterLive() {
  dom.atbSetup.hidden = true;
  dom.atbLive.hidden = false;
  dom.liveEncounterCode.textContent = campaign?.settings?.hideRoomCode ? "••••" : code;
  const expected = `index.html?embedded=gm&campaign=${encodeURIComponent(code)}`;
  if (!dom.atbFrame.getAttribute("src")) dom.atbFrame.src = expected;
  updateExitEncounterVisibility();
}

function showEncounterSetup({ forceBuilder = false } = {}) {
  dom.atbLive.hidden = true;
  dom.atbSetup.hidden = false;
  if (forceBuilder) {
    dom.existingEncounterActions.hidden = true;
    dom.encounterBuilder.hidden = false;
    renderEncounterBuilder();
  } else {
    refreshEncounterState().catch((error) => showMessage(dom.message, error.message, "error"));
  }
  updateExitEncounterVisibility();
}

async function resumeEncounterWithFreshCharacters() {
  try {
    await refreshCampaign();
    await refreshEncounterState();
    const updates = (encounterState?.units || []).flatMap((unit) => {
      if (!unit.characterId) return [];
      const record = campaign.characters.find((entry) => entry.id === unit.characterId);
      if (!record) return [];
      return [{
        characterId: record.id,
        playerName: playerName(record),
        characterName: characterName(record),
        speed: characterSpeed(record),
        commandWindow: commandWindow(record),
        color: record.character?.presentation?.atbColor || "#39e58f",
        ...encounterRuleFields(record),
      }];
    });
    if (updates.length) encounterState = await encounterAction("syncCampaignUnits", { units: updates });
    showEncounterLive();
    showMessage(dom.message, updates.length ? "Encounter resumed with current campaign character statistics." : "Encounter resumed.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
}

async function exitCampaignEncounter() {
  if (!await confirmGm({ title: "End Combat?", message: "End this encounter for every player and return everyone to the campaign roster?", acceptLabel: "End Combat", danger: true })) return;
  try {
    encounterState = await encounterAction("exitEncounter");
    dom.atbFrame.removeAttribute("src");
    stagedNpcs = [];
    encounterNpcDraft = randomBuiltinNpc();
    renderEncounterStatus();
    selectGmTab("script");
    showMessage(dom.message, "Combat ended for the entire campaign. Character and campaign data remain saved.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
}

async function beginEncounter() {
  const selected = campaign.characters.filter((record) => selectedEncounterCharacters.has(record.id) && record.approved !== false);
  if (!selected.length && !stagedNpcs.length) {
    showMessage(dom.message, "Select at least one character or add an NPC.", "error");
    return;
  }
  dom.beginEncounter.disabled = true;
  dom.beginEncounter.textContent = "Preparing Combat...";
  try {
    await encounterAction("clearEncounter");
    await encounterAction("syncEncounterStarships", { starships: campaign.starships || [] });
    for (const record of selected) {
      await encounterAction("addUnit", {
        playerName: playerName(record),
        characterName: characterName(record),
        speed: characterSpeed(record),
        commandWindow: commandWindow(record),
        color: record.character?.presentation?.atbColor || "#39e58f",
        controlledBy: "player",
        team: "pc",
        actorType: "character",
        characterId: record.id,
        location: combatLocation(encounterLocations.get(record.id) || defaultDeployment(record)),
        ...encounterRuleFields(record),
      });
    }
    for (const npc of stagedNpcs) {
      const weapon = weaponById(npc.heldWeaponId) || weaponById("unarmed");
      await encounterAction("addUnit", {
        playerName: "GM",
        characterName: npc.name || "NPC",
        speed: npc.speed || 5,
        commandWindow: null,
        color: npc.color || "#39e58f",
        controlledBy: "gm",
        team: "npc",
        actorType: "character",
        moveSpeed: npc.moveSpeed,
        maximumHp: npc.maximumHp,
        currentHp: npc.maximumHp,
        physicalAttribute: npc.physicalAttribute,
        mentalAttribute: npc.mentalAttribute,
        physicalSkill: npc.physicalSkill,
        mentalSkill: npc.mentalSkill,
        weaponMechanics: npc.mentalSkill,
        weapons: weapon ? [{ inventoryId: `npc-${npc.id}-weapon`, weaponId: weapon.id }] : [],
        heldWeaponId: weapon ? `npc-${npc.id}-weapon` : "",
        allyNpc: Boolean(npc.allyNpc),
        location: combatLocation(npc.locationStarshipId || ""),
      });
    }
    encounterState = await api(`/api/state?room=${encodeURIComponent(code)}`, null, "GET");
    dom.atbFrame.src = `index.html?embedded=gm&campaign=${encodeURIComponent(code)}&encounter=${Date.now()}`;
    showEncounterLive();
    showMessage(dom.message, "Encounter prepared and paused. Engage the clock when the table is ready.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.beginEncounter.disabled = false;
    dom.beginEncounter.textContent = "Begin Combat";
  }
}

function renderScriptEditor(source = scriptSource()) {
  const commands = scriptCommandList(source);
  const expression = /::([\s\S]*?)::/g;
  const pieces = [];
  let cursor = 0;
  let index = 0;
  let match;
  while ((match = expression.exec(source))) {
    pieces.push(escapeHtml(source.slice(cursor, match.index)));
    const command = commands[index];
    const label = command?.valid
      ? command.keyword || `${command.skill || command.attribute} Check`
      : `INVALID ROLL PROMPT / ${match[1].trim()}`;
    pieces.push(`<span class="script-command-token" contenteditable="false" data-script-command data-command-raw="${escapeHtml(match[1])}"><button type="button" class="script-command-chip ${command?.valid ? "" : "invalid"} ${executedCommands.has(command?.id) ? "executed" : ""}" data-send-command="${index}" ${command?.valid ? "" : "disabled"}>${escapeHtml(label)}</button></span>&#8203;`);
    cursor = expression.lastIndex;
    index += 1;
  }
  pieces.push(escapeHtml(source.slice(cursor)));
  dom.script.innerHTML = pieces.join("").replaceAll("\n", "<br>");
  lastScriptRange = null;
}

function placeScriptCaretAtEnd() {
  dom.script.focus();
  let target = dom.script.lastChild;
  if (!target || target.nodeType !== Node.TEXT_NODE) {
    target = document.createTextNode("\u200b");
    dom.script.append(target);
  }
  const range = document.createRange();
  range.setStart(target, target.nodeValue.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  lastScriptRange = range.cloneRange();
}
function rememberScriptSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (dom.script.contains(range.commonAncestorContainer)) lastScriptRange = range.cloneRange();
}

function renderCampaign() {
  if (!campaign) return;
  dom.codeHeading.textContent = campaign.settings?.hideRoomCode ? "••••" : campaign.code;
  dom.nameHeading.innerHTML = `${escapeHtml(campaign.name)} <small>(GM)</small>`;
  dom.dramaDeckStatus.hidden = !campaign.dramaDeck;
  if (campaign.dramaDeck) {
    dom.dramaDeckStatus.querySelector("strong").textContent = `${campaign.dramaDeck.drawCount} DRAW / ${campaign.dramaDeck.discardCount} DISCARD`;
  }
  dom.shipCredits.textContent = Number(campaign.shipCredits || 0).toLocaleString();
  const sessionNumber = Math.max(0, Number(campaign.sessionNumber) || 0);
  dom.sessionNumberLabel.textContent = `Session ${sessionNumber}`;
  dom.endSession.textContent = `End Session ${sessionNumber}`;
  dom.undoAward.disabled = !campaign.lastAward;
  dom.storageMode.textContent = campaign.storageMode === "postgres" ? "Persistent Database" : "Local Test Storage";
  dom.storageMode.style.color = campaign.storageMode === "postgres" ? "var(--green)" : "var(--yellow)";
  if (document.activeElement !== dom.universalCommandWindowBonus) {
    dom.universalCommandWindowBonus.value = String(Math.max(0, Number(campaign.settings?.commandWindowBonus) || 0));
  }
  const selectedRecipient = dom.scriptRecipient.value || "all";
  dom.scriptRecipient.innerHTML = `<option value="all">All PCs</option>${campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}${record.connected ? "" : " (Offline)"}</option>`).join("")}`;
  dom.scriptRecipient.value = campaign.characters.some((record) => record.id === selectedRecipient) ? selectedRecipient : "all";
  dom.bankerCharacter.innerHTML = `<option value="">No Banker - Any PC May Use Pool</option>${campaign.characters.map((record) => `<option value="${record.id}">${escapeHtml(characterName(record))}</option>`).join("")}`;
  dom.bankerCharacter.value = campaign.bankerCharacterId || "";
  renderScriptChapterControls();
  renderConditionalControls();
  const chapter = activeScriptChapter();
  if (!scriptDirty && document.activeElement !== dom.script && scriptSource() !== (chapter?.script || "")) {
    renderScriptEditor(chapter?.script || "");
  }
  renderCharacters();
  renderStarships();
  renderPremadeNpcConsole();
  renderInbox();
  renderSettings();
  renderTargets();
  renderRollResults();
  renderEncounterBuilder();
}

function receiveCampaign(next) {
  processDramaPlayEvents(next);
  campaign = next;
  if (!targetSelectionTouched && !selectedTargets.size && next.characters?.length === 1) {
    selectedTargets.add(next.characters[0].id);
  }
  cacheCampaignState(next);
  renderCampaign();
}

function connectCampaignEvents() {
  events?.close();
  events = new EventSource(`/campaign-events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
  events.addEventListener("campaign", (event) => receiveCampaign(JSON.parse(event.data)));
  events.addEventListener("error", () => showMessage(dom.message, "Connection interrupted. The app will reconnect automatically.", "error"));
}

function openWorkspace(nextCampaign, nextToken) {
  campaign = nextCampaign;
  code = campaign.code;
  token = nextToken;
  (SHOWCASE_MODE ? sessionStorage : localStorage).setItem(tokenKey(code), token);
  if (!SHOWCASE_MODE) localStorage.setItem("sa-current-campaign-code", code);
  dom.gateway.hidden = true;
  dom.workspace.hidden = false;
  dom.heading.hidden = false;
  dom.logout.hidden = false;
  dom.atbFrame.removeAttribute("src");
  targetSelectionTouched = false;
  selectedTargets = campaign.characters.length === 1 ? new Set([campaign.characters[0].id]) : new Set();
  selectedEncounterCharacters = new Set(campaign.characters.filter((record) => record.approved !== false).map((record) => record.id));
  encounterLocations.clear();
  npcSequence = 0;
  stagedNpcs = [];
  encounterNpcDraft = randomBuiltinNpc();
  premadeNpcDraft = (campaign.npcTemplates || []).length ? stagedNpc(campaign.npcTemplates[0]) : stagedNpc(NPC_BLANK);
  renderCampaign();
  showEncounterSetup();
  selectGmTab("script");
  connectCampaignEvents();
}

async function refreshCampaign() {
  if (!code || !token) return;
  receiveCampaign(await api(`/api/campaign/state?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, null, "GET"));
}

async function saveScript() {
  if (!campaign) return;
  dom.scriptSaveState.textContent = "Saving...";
  try {
    const source = scriptSource();
    await api("/api/campaign/script/save", { code, token, chapterId: activeScriptChapter()?.id, script: source });
    const chapter = activeScriptChapter();
    if (chapter) chapter.script = source;
    scriptDirty = false;
    dom.scriptSaveState.textContent = "Saved";
  } catch (error) {
    dom.scriptSaveState.textContent = "Save Failed";
    showMessage(dom.message, error.message, "error");
  }
}

async function sendRollRequest({ targetIds, attribute, skill, difficulty = null, hideDifficulty = false, source = "GM Prompt", connectedOnly = false, completionActionId = "" }) {
  const payload = await api("/api/campaign/roll/request", { code, token, targetIds, attribute, skill, difficulty, hideDifficulty, source, connectedOnly, completionActionId });
  showMessage(dom.message, `Roll request sent to ${payload.request.targetIds.length} character${payload.request.targetIds.length === 1 ? "" : "s"}.`, "success");
}

function conditionalFormPayload() {
  return {
    code,
    token,
    operation: "save",
    id: editingConditionalActionId,
    keyword: dom.conditionalKeyword.value,
    kind: dom.conditionalKind.value,
    message: dom.conditionalMessage.value,
    resource: dom.conditionalResource.value,
    amount: dom.conditionalAmount.value,
    attribute: dom.conditionalAttribute.value,
    skill: dom.conditionalSkill.value,
    difficulty: dom.conditionalDifficulty.value,
    hideDifficulty: dom.conditionalHideDifficulty.checked,
  };
}

async function saveConditionalAction() {
  const payload = await api("/api/campaign/conditional-action", conditionalFormPayload());
  editingConditionalActionId = payload.action.id;
  receiveCampaign(payload.campaign);
  loadConditionalForm(payload.action.id);
  return payload.action;
}

async function changeScriptChapter(action, payload = {}) {
  if (scriptDirty) await saveScript();
  const response = await api("/api/campaign/script/chapter", { code, token, action, ...payload });
  receiveCampaign(response.campaign);
  return response.campaign;
}

dom.openForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await api("/api/campaign/open", { name: dom.code.value, gmCode: dom.password.value });
    openWorkspace(payload.campaign, payload.token);
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});
dom.showCreate.addEventListener("click", () => { dom.openForm.hidden = true; dom.createForm.hidden = false; dom.newName.focus(); });
dom.cancelCreate.addEventListener("click", () => { dom.createForm.hidden = true; dom.openForm.hidden = false; });
dom.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (dom.newPassword.value !== dom.confirmPassword.value) {
    showMessage(dom.gatewayMessage, "The two GM Codes do not match.", "error");
    return;
  }
  try {
    const payload = await api("/api/campaign/create", { name: dom.newName.value, gmCode: dom.newPassword.value });
    openWorkspace(payload.campaign, payload.token);
    showMessage(dom.message, `Campaign ${payload.campaign.code} created. This code remains with the campaign.`, "success");
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.restoreFile.addEventListener("change", async () => {
  try {
    pendingRestoreBackup = await readCampaignBackup(dom.restoreFile.files?.[0]);
    dom.restoreCode.textContent = pendingRestoreBackup.campaign.code;
    dom.restoreName.textContent = pendingRestoreBackup.campaign.name;
    dom.restoreForm.hidden = false;
    dom.restorePassword.focus();
    showMessage(dom.gatewayMessage, "Backup loaded. Create a new GM password to restore it.", "success");
  } catch (error) {
    pendingRestoreBackup = null;
    dom.restoreForm.hidden = true;
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.cancelRestore.addEventListener("click", () => {
  pendingRestoreBackup = null;
  dom.restoreFile.value = "";
  dom.restorePassword.value = "";
  dom.restoreForm.hidden = true;
});

dom.restoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingRestoreBackup) return;
  try {
    const payload = await api("/api/campaign/restore-create", { backup: pendingRestoreBackup, gmCode: dom.restorePassword.value });
    openWorkspace(payload.campaign, payload.token);
    showMessage(dom.message, `Campaign ${payload.campaign.code} restored from its local backup.`, "success");
  } catch (error) {
    showMessage(dom.gatewayMessage, error.message, "error");
  }
});

dom.logout.addEventListener("click", () => {
  events?.close();
  localStorage.removeItem(tokenKey(code));
  localStorage.removeItem("sa-current-campaign-code");
  clearAtbBrowserIdentity();
  location.href = "index.html";
});

dom.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  selectGmTab(button.dataset.tab);
});

dom.scriptChapterTabs.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-script-chapter]");
  if (!button || button.dataset.scriptChapter === activeScriptChapterId) return;
  try {
    if (scriptDirty) await saveScript();
    activeScriptChapterId = button.dataset.scriptChapter;
    renderScriptChapterControls();
    renderScriptEditor(activeScriptChapter()?.script || "");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.addScriptChapter.addEventListener("click", async () => {
  try {
    const before = new Set(scriptChapters().map((entry) => entry.id));
    const nextCampaign = await changeScriptChapter("add");
    activeScriptChapterId = nextCampaign.scriptChapters.find((entry) => !before.has(entry.id))?.id || nextCampaign.scriptChapters.at(-1)?.id || "";
    renderCampaign();
    renderScriptEditor(activeScriptChapter()?.script || "");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.renameScriptChapter.addEventListener("click", async () => {
  const chapter = activeScriptChapter();
  if (!chapter) return;
  const name = await promptGm({ title: "Rename Chapter", message: "Enter a new name for this script chapter.", inputLabel: "Chapter Name", inputValue: chapter.name, acceptLabel: "Rename" });
  if (name === null || !name.trim()) return;
  try {
    await changeScriptChapter("rename", { chapterId: chapter.id, name: name.trim() });
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.deleteScriptChapter.addEventListener("click", async () => {
  const chapter = activeScriptChapter();
  if (!chapter || scriptChapters().length <= 1) return;
  if (!await confirmGm({ title: "Delete Chapter?", message: `Delete "${chapter.name}" and all text inside it?`, acceptLabel: "Delete Chapter", danger: true })) return;
  try {
    await changeScriptChapter("delete", { chapterId: chapter.id });
    activeScriptChapterId = scriptChapters()[0]?.id || "";
    renderCampaign();
    renderScriptEditor(activeScriptChapter()?.script || "");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.script.addEventListener("input", () => {
  rememberScriptSelection();
  scriptDirty = true;
  dom.scriptSaveState.textContent = "Unsaved";
  clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(saveScript, 650);
});
dom.script.addEventListener("keydown", (event) => {
  if (!['Backspace', 'Delete'].includes(event.key)) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const backward = event.key === 'Backspace';
  let candidate = null;
  if (range.startContainer === dom.script) {
    candidate = dom.script.childNodes[range.startOffset + (backward ? -1 : 0)] || null;
  } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const atEdge = backward ? range.startOffset === 0 : range.startOffset === range.startContainer.nodeValue.length;
    if (atEdge) candidate = backward ? range.startContainer.previousSibling : range.startContainer.nextSibling;
  }
  if (candidate?.nodeName === 'BR') candidate = backward ? candidate.previousSibling : candidate.nextSibling;
  const token = candidate?.nodeType === Node.ELEMENT_NODE && candidate.matches('[data-script-command]') ? candidate : null;
  if (!token) return;
  event.preventDefault();
  token.remove();
  dom.script.dispatchEvent(new Event('input', { bubbles: true }));
});
dom.script.addEventListener("keyup", rememberScriptSelection);
dom.script.addEventListener("mouseup", rememberScriptSelection);
dom.script.addEventListener("blur", (event) => {
  if (event.relatedTarget && dom.script.contains(event.relatedTarget)) return;
  if (event.relatedTarget?.closest?.("#scriptCommandBuilder")) return;
  renderScriptEditor(scriptSource());
});
function syncScriptCommandType() {
  const savedAction = Boolean(dom.scriptCommandType.value);
  [dom.scriptAttribute, dom.scriptSkill, dom.scriptDifficulty, dom.scriptHideDifficulty].forEach((control) => { control.disabled = savedAction; });
}
dom.scriptCommandType.addEventListener("change", syncScriptCommandType);
dom.insertCommand.addEventListener("click", () => {
  const savedAction = (campaign?.conditionalActions || []).find((entry) => entry.id === dom.scriptCommandType.value);
  const parts = [savedAction
    ? `Keyword:${savedAction.keyword}`
    : `${dom.scriptAttribute.value}+${dom.scriptSkill.value}`];
  if (!savedAction && dom.scriptDifficulty.value !== "") parts.push(`Difficulty ${dom.scriptDifficulty.value}`);
  if (!savedAction && dom.scriptHideDifficulty.checked) parts.push("Hidden");
  const command = `::${parts.join("/")}::`;
  const range = lastScriptRange?.cloneRange();
  if (range && dom.script.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(document.createTextNode(command));
  } else {
    dom.script.append(document.createTextNode(`${scriptSource() ? "\n" : ""}${command}`));
  }
  dom.script.dispatchEvent(new Event("input", { bubbles: true }));
  renderScriptEditor(scriptSource());
  placeScriptCaretAtEnd();
});

dom.script.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-send-command]");
  if (!button) {
    if (event.target === dom.script) placeScriptCaretAtEnd();
    return;
  }
  event.preventDefault();
  const index = Number(button.dataset.sendCommand);
  const command = scriptCommandList()[index];
  if (!command?.valid) return;
  if (executedCommands.has(command.id) && !await confirmGm({ title: "Send Again?", message: "Send this roll request again?", acceptLabel: "Send Again" })) return;
  const selectedRecipient = dom.scriptRecipient.value || "all";
  const targets = selectedRecipient === "all"
    ? campaign.characters.filter((record) => record.connected).map((record) => record.id)
    : campaign.characters.some((record) => record.id === selectedRecipient) ? [selectedRecipient] : [];
  if (!targets.length) {
    showMessage(dom.message, selectedRecipient === "all" ? "No PCs are currently connected." : "Choose a valid Story Console recipient.", "error");
    return;
  }
  try {
    await sendRollRequest({
      targetIds: targets,
      attribute: command.attribute,
      skill: command.skill,
      difficulty: command.difficulty,
      hideDifficulty: command.hideDifficulty,
      source: `Script: ${command.raw}`,
      connectedOnly: selectedRecipient === "all",
      completionActionId: command.conditionalActionId,
    });
    executedCommands.add(command.id);
    renderScriptEditor(scriptSource());
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.promptTargets.addEventListener("change", (event) => {
  const input = event.target.closest("[data-target-id]");
  if (!input) return;
  targetSelectionTouched = true;
  if (input.checked) selectedTargets.add(input.dataset.targetId);
  else selectedTargets.delete(input.dataset.targetId);
  syncSelectedTargets();
});
dom.selectAllTargets.addEventListener("click", () => { targetSelectionTouched = true; selectedTargets = new Set(campaign.characters.map((record) => record.id)); renderTargets(); });
dom.selectConnectedTargets.addEventListener("click", () => { targetSelectionTouched = true; selectedTargets = new Set(campaign.characters.filter((record) => record.connected).map((record) => record.id)); renderTargets(); });
dom.clearTargets.addEventListener("click", () => { targetSelectionTouched = true; selectedTargets.clear(); renderTargets(); });

dom.inboxList.addEventListener("click", async (event) => {
  const restDecision = event.target.closest("[data-rest-decision]");
  if (restDecision) {
    event.stopPropagation();
    restDecision.disabled = true;
    try {
      const payload = await api("/api/campaign/exertion/rest-decision", { code, token, noteId: restDecision.dataset.noteId, decision: restDecision.dataset.restDecision });
      receiveCampaign(payload.campaign);
      showMessage(dom.message, restDecision.dataset.restDecision === "deny" ? "Rest denied and its restored Exertion removed." : "Rest reward sent to every linked character.", "success");
    } catch (error) {
      restDecision.disabled = false;
      showMessage(dom.message, error.message, "error");
    }
    return;
  }
  const giftDecision = event.target.closest("[data-reverence-gift-decision]");
  if (giftDecision) {
    event.stopPropagation();
    giftDecision.disabled = true;
    try {
      const payload = await api("/api/campaign/reverence-gift", {
        code,
        token,
        action: "respond",
        noteId: giftDecision.dataset.noteId,
        decision: giftDecision.dataset.reverenceGiftDecision,
      });
      receiveCampaign(payload.campaign);
      showMessage(dom.message, payload.decision === "approved" ? "Reverence suggestion approved. The recipient can claim it from their inbox." : "Reverence suggestion denied.", "success");
    } catch (error) {
      giftDecision.disabled = false;
      showMessage(dom.message, error.message, "error");
    }
    return;
  }
  const denyItem = event.target.closest("[data-deny-item]");
  if (denyItem) {
    event.stopPropagation();
    if (!await confirmGm({ title: "Deny This Item?", message: "The item will be removed and any Credits paid will be refunded.", acceptLabel: "Deny Item", danger: true })) return;
    try {
      const payload = await api("/api/campaign/item/deny", { code, token, transactionId: denyItem.dataset.denyItem });
      receiveCampaign(payload.campaign);
      showMessage(dom.message, "Item denied and the transaction was reversed.", "success");
    } catch (error) { showMessage(dom.message, error.message, "error"); }
    return;
  }
  const coverDeficit = event.target.closest("[data-cover-deficit]");
  if (coverDeficit) {
    event.stopPropagation();
    try {
      const payload = await api("/api/campaign/item/cover-deficit", { code, token, characterId: coverDeficit.dataset.coverDeficit });
      receiveCampaign(payload.campaign);
      showMessage(dom.message, `${payload.amount} Credits awarded to cover the negative balance.`, "success");
    } catch (error) { showMessage(dom.message, error.message, "error"); }
    return;
  }


  const decisionButton = event.target.closest("[data-join-decision]");
  const requestCard = decisionButton?.closest("[data-join-request]");
  if (decisionButton && requestCard) {
    const decision = decisionButton.dataset.joinDecision;
    if (decision === "reject" && !await confirmGm({ title: "Reject Character?", message: "Reject this character's campaign request?", acceptLabel: "Reject", danger: true })) return;
    try {
      const payload = await api("/api/campaign/join/respond", {
        code,
        token,
        requestId: requestCard.dataset.joinRequest,
        decision,
      });
      if (payload.campaign) receiveCampaign(payload.campaign);
      showMessage(dom.message, decision === "approve" ? "Character approved and linked to the campaign." : "Character request rejected.", "success");
    } catch (error) {
      showMessage(dom.message, error.message, "error");
    }
    return;
  }
  const note = event.target.closest("[data-gm-note]");
  if (!note) return;
  try {
    await api("/api/campaign/note/gm-read", { code, token, noteId: note.dataset.gmNote });
    note.classList.remove("unread");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.characterList.addEventListener("click", (event) => {
  const classAction = event.target.closest("[data-class-action]");
  if (classAction) {
    classAction.disabled = true;
    api("/api/campaign/class-action", {
      code,
      token,
      characterId: classAction.dataset.characterId,
      action: classAction.dataset.classAction,
    }).then((payload) => {
      receiveCampaign(payload.campaign);
      showMessage(dom.message, payload.message, "success");
    }).catch((error) => {
      classAction.disabled = false;
      showMessage(dom.message, error.message, "error");
    });
    return;
  }
  const button = event.target.closest("[data-view-sheet]");
  if (!button) return;
  const record = campaign.characters.find((entry) => entry.id === button.dataset.viewSheet);
  if (!record) return;
  dom.sheetViewerTitle.textContent = `${characterName(record)} - GM View`;
  dom.sheetFrame.src = `character.html?campaign=${encodeURIComponent(code)}&character=${encodeURIComponent(record.id)}&gm=1&embedded=1`;
  dom.sheetViewer.hidden = false;
  dom.characterList.hidden = true;
  dom.sheetViewer.scrollIntoView({ behavior: "smooth", block: "start" });
});

dom.closeSheetViewer.addEventListener("click", () => {
  dom.sheetViewer.hidden = true;
  dom.sheetFrame.removeAttribute("src");
  dom.characterList.hidden = false;
});

dom.endSession.addEventListener("click", async () => {
  dom.endSession.disabled = true;
  try {
    const payload = await api("/api/campaign/session/end", { code, token });
    receiveCampaign(payload.campaign);
    showMessage(dom.message, `Session ${payload.sessionEnded} ended. Player abilities and counters were reset.`, "success");
    const exportNow = await confirmGm({
      title: "Session Complete",
      message: "Save a campaign backup now? Free hosting can lose campaign data after a restart or deployment.",
      acceptLabel: "Export Campaign Backup",
      cancelLabel: "Continue Without Export",
    });
    if (exportNow) await downloadCampaignBackup();
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.endSession.disabled = false;
  }
});

dom.commandWindowSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bonus = Math.max(0, Math.min(3600, Math.round(Number(dom.universalCommandWindowBonus.value) || 0)));
  dom.universalCommandWindowBonus.value = String(bonus);
  dom.commandWindowSettingsMessage.textContent = "Saving...";
  try {
    const payload = await api("/api/campaign/settings", { code, token, commandWindowBonus: bonus });
    receiveCampaign(payload.campaign);
    await refreshEncounterState();
    const updates = (encounterState?.units || []).flatMap((unit) => {
      if (!unit.characterId) return [];
      const record = campaign.characters.find((entry) => entry.id === unit.characterId);
      if (!record) return [];
      return [{
        characterId: record.id,
        playerName: playerName(record),
        characterName: characterName(record),
        speed: characterSpeed(record),
        commandWindow: commandWindow(record),
        color: record.character?.presentation?.atbColor || "#39e58f",
        ...encounterRuleFields(record),
      }];
    });
    if (updates.length) encounterState = await encounterAction("syncCampaignUnits", { units: updates });
    dom.commandWindowSettingsMessage.textContent = `Every PC receives +${bonus} seconds. Active encounter values were synchronized.`;
    dom.commandWindowSettingsMessage.className = "tool-message success";
  } catch (error) {
    dom.commandWindowSettingsMessage.textContent = error.message;
    dom.commandWindowSettingsMessage.className = "tool-message error";
  }
});

dom.kickCharacterButton.addEventListener("click", async () => {
  const characterId = dom.kickCharacter.value;
  const record = campaign.characters.find((entry) => entry.id === characterId);
  if (!record || !await confirmGm({ title: "Kick Player?", message: `Remove ${characterName(record)} from this campaign?`, acceptLabel: "Kick Player", danger: true })) return;
  try {
    const payload = await api("/api/campaign/character/kick", { code, token, characterId });
    receiveCampaign(payload.campaign);
    showMessage(dom.message, `${characterName(record)} was removed from the campaign.`, "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.adjustCharacterButton.addEventListener("click", () => {
  const characterId = dom.adjustCharacter.value;
  if (!characterId) return;
  dom.adjustmentFrame.src = `character.html?campaign=${encodeURIComponent(code)}&character=${encodeURIComponent(characterId)}&gm=1&gmAdjust=1&embedded=1`;
  dom.adjustmentModal.hidden = false;
});

dom.starshipList?.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-starship-control]");
  if (!select) return;
  const card = select.closest("[data-starship-id]");
  if (!card) return;
  select.disabled = true;
  try {
    await api("/api/campaign/starship/control", { code, token, starshipId: card.dataset.starshipId, controlType: select.value });
    await refreshCampaign();
    showMessage(dom.message, `Starship is now ${select.value === "gm" ? "GM controlled and hidden from players" : "PC controlled and visible to players"}.`, "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
    await refreshCampaign().catch(() => {});
  } finally { select.disabled = false; }
});

dom.starshipList?.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-starship-id]");
  if (!card) return;
  const starshipId = card.dataset.starshipId;
  if (event.target.closest("[data-open-starship]")) {
    location.href = `starship.html?campaign=${encodeURIComponent(code)}&ship=${encodeURIComponent(starshipId)}`;
    return;
  }
  const saveCrew = event.target.closest("[data-save-starship-crew]");
  if (saveCrew) {
    saveCrew.disabled = true;
    try {
      const crewCharacterIds = [...card.querySelectorAll("[data-starship-crew]:checked")].map((input) => input.dataset.starshipCrew);
      await api("/api/campaign/starship/crew", { code, token, starshipId, crewCharacterIds });
      await refreshCampaign();
      showMessage(dom.message, "Starship crew assignments saved.", "success");
    } catch (error) { showMessage(dom.message, error.message, "error"); }
    finally { saveCrew.disabled = false; }
    return;
  }
  const unlink = event.target.closest("[data-unlink-starship]");
  if (!unlink) return;
  const record = campaign.starships.find((entry) => entry.id === starshipId);
  if (!await confirmGm({
    title: "Unlink Starship?",
    message: `${record?.title || "This starship"} will be removed from the campaign. Its local saved copy will remain on the device that created it, and campaign crew assignments will be cleared.`,
    acceptLabel: "Unlink Starship",
    danger: true,
  })) return;
  unlink.disabled = true;
  try {
    await api("/api/campaign/starship/unlink", { code, token, starshipId });
    await refreshCampaign();
    showMessage(dom.message, "Starship unlinked. Its original local copy was not deleted.", "success");
  } catch (error) {
    unlink.disabled = false;
    showMessage(dom.message, error.message, "error");
  }
});

dom.createCampaignStarship?.addEventListener("click", () => {
  window.location.href = "starship.html?new=1";
});

dom.showcaseNpcFleetList?.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-showcase-npc-location]");
  if (!select) return;
  select.disabled = true;
  try {
    await encounterAction("setCombatLocation", { id: select.dataset.showcaseNpcLocation, location: combatLocation(select.value) });
    await refreshEncounterState();
    renderStarships();
  } catch (error) { showMessage(dom.message, error.message, "error"); }
  finally { select.disabled = false; }
});

dom.reshuffleDramaCards?.addEventListener("click", async () => {
  if (dom.reshuffleDramaCards.disabled) return;
  dom.reshuffleDramaCards.disabled = true;
  dom.dramaDiscardList.classList.add("reshuffling");
  await new Promise((resolve) => setTimeout(resolve, 650));
  try {
    const payload = await api("/api/campaign/drama/reshuffle", { code, token });
    receiveCampaign(payload.campaign);
    showMessage(dom.message, `${payload.reshuffled} discarded Drama Card${payload.reshuffled === 1 ? " was" : "s were"} shuffled back into the deck.`, "success");
  } catch (error) {
    dom.dramaDiscardList.classList.remove("reshuffling");
    dom.reshuffleDramaCards.disabled = false;
    showMessage(dom.message, error.message, "error");
  }
});

window.addEventListener("message", async (event) => {
  if (event.origin !== location.origin || event.source !== dom.adjustmentFrame.contentWindow) return;
  if (!["sa-gm-adjustment-saved", "sa-gm-adjustment-cancelled"].includes(event.data?.type)) return;
  dom.adjustmentModal.hidden = true;
  dom.adjustmentFrame.removeAttribute("src");
  if (event.data.type === "sa-gm-adjustment-saved") {
    await syncCampaignCharactersToEncounter().catch(() => null);
    showMessage(dom.message, "Character adjustments saved and synchronized.", "success");
  }
});

dom.setBanker.addEventListener("click", async () => {
  try {
    await api("/api/campaign/banker", { code, token, characterId: dom.bankerCharacter.value || null });
    showMessage(dom.message, dom.bankerCharacter.value ? "Campaign banker assigned." : "Group Credits are open to every unlocked character.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.rechargeItems?.addEventListener("click", async () => {
  if (!selectedTargets.size) {
    showMessage(dom.message, "Select at least one character to recharge.", "error");
    return;
  }
  dom.rechargeItems.disabled = true;
  try {
    const payload = await api("/api/campaign/item/recharge", { code, token, targetIds: [...selectedTargets] });
    receiveCampaign(payload.campaign);
    showMessage(dom.message, payload.recharged ? `${payload.recharged} carried rechargeable item${payload.recharged === 1 ? " was" : "s were"} restored.` : "None of the selected characters carried a rechargeable item.", payload.recharged ? "success" : "");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.rechargeItems.disabled = false;
  }
});


dom.awardResource.addEventListener("change", () => {
  const pool = dom.awardResource.value === "shipCredits";
  dom.promptTargets.closest(".target-console").classList.toggle("targets-optional", pool);
});
dom.awardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage(dom.awardMessage, "Delivering award...");
  const resource = dom.awardResource.value;
  const targetIds = resource === "shipCredits" ? [] : [...selectedTargets];
  if (resource !== "shipCredits" && !targetIds.length) {
    showMessage(dom.awardMessage, "Choose at least one recipient above.", "error");
    return;
  }
  try {
    const androidTargets = resource === "credits" && Number(dom.awardAmount.value) > 0
      ? selectedRecords().filter((record) => record.character?.identity?.raceId === "android")
      : [];
    const convertAndroid = androidTargets.length
      ? await confirmGm({ title: "Convert Android Award?", message: `Convert this Credit award into Experience for ${androidTargets.map(characterName).join(", ")} at 75 Credits per XP?`, acceptLabel: "Convert Award" })
      : false;
    const payload = await api("/api/campaign/award", {
      code,
      token,
      resource,
      amount: dom.awardAmount.value,
      targetIds,
      androidExperienceIds: convertAndroid ? androidTargets.map((record) => record.id) : [],
    });
    receiveCampaign(payload.campaign);
    const amount = Number(dom.awardAmount.value).toLocaleString();
    const recipients = resource === "shipCredits" ? "Group Credits" : selectedRecords().map(characterName).join(", ");
    const pendingClaim = resource !== "shipCredits" && Number(dom.awardAmount.value) > 0;
    showMessage(dom.awardMessage, pendingClaim
      ? `${amount} ${dom.awardResource.selectedOptions[0].text} sent to ${recipients}. Players can receive it from their inbox.`
      : `${amount} ${dom.awardResource.selectedOptions[0].text} applied to ${recipients}.`, "success");
  } catch (error) {
    showMessage(dom.awardMessage, error.message, "error");
  }
});
dom.undoAward.addEventListener("click", async () => {
  if (!await confirmGm({ title: "Undo Award?", message: "Undo the most recent campaign award?", acceptLabel: "Undo Award" })) return;
  try {
    const payload = await api("/api/campaign/award/undo", { code, token });
    receiveCampaign(payload.campaign);
    showMessage(dom.awardMessage, "The most recent award was undone.", "success");
  } catch (error) {
    showMessage(dom.awardMessage, error.message, "error");
  }
});
dom.noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedTargets.size) {
    showMessage(dom.message, "Select at least one private-note recipient.", "error");
    return;
  }
  try {
    await api("/api/campaign/note/send", { code, token, targetIds: [...selectedTargets], message: dom.noteMessage.value });
    dom.noteMessage.value = "";
    showMessage(dom.message, "Private note delivered.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.conditionalSelect.addEventListener("change", () => loadConditionalForm(dom.conditionalSelect.value));
dom.conditionalKind.addEventListener("change", syncConditionalKind);

dom.conditionalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const action = await saveConditionalAction();
    showMessage(dom.conditionalActionMessage, `Saved keyword "${action.keyword}".`, "success");
  } catch (error) {
    showMessage(dom.conditionalActionMessage, error.message, "error");
  }
});

dom.sendConditionalAction.addEventListener("click", async () => {
  if (!selectedTargets.size) {
    showMessage(dom.conditionalActionMessage, "Choose at least one recipient above.", "error");
    return;
  }
  if (!dom.conditionalForm.reportValidity()) return;
  dom.sendConditionalAction.disabled = true;
  try {
    const action = await saveConditionalAction();
    await sendRollRequest({
      targetIds: [...selectedTargets],
      attribute: action.attribute,
      skill: action.skill,
      difficulty: action.difficulty,
      hideDifficulty: action.hideDifficulty,
      source: `Conditional Action: ${action.keyword}`,
      completionActionId: action.id,
    });
    showMessage(dom.conditionalActionMessage, `Sent "${action.keyword}" to ${selectedTargets.size} character${selectedTargets.size === 1 ? "" : "s"}.`, "success");
  } catch (error) {
    showMessage(dom.conditionalActionMessage, error.message, "error");
  } finally {
    dom.sendConditionalAction.disabled = false;
  }
});

dom.deleteConditionalAction.addEventListener("click", async () => {
  const action = (campaign?.conditionalActions || []).find((entry) => entry.id === editingConditionalActionId);
  if (!action || !await confirmGm({ title: "Delete Saved Action?", message: `Delete "${action.keyword}"?`, acceptLabel: "Delete Action", danger: true })) return;
  try {
    const payload = await api("/api/campaign/conditional-action", { code, token, operation: "delete", id: action.id });
    editingConditionalActionId = "";
    receiveCampaign(payload.campaign);
    clearConditionalForm();
    showMessage(dom.conditionalActionMessage, "Conditional action deleted.", "success");
  } catch (error) {
    showMessage(dom.conditionalActionMessage, error.message, "error");
  }
});

dom.rollForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedTargets.size) {
    showMessage(dom.message, "Select at least one roll recipient.", "error");
    return;
  }
  try {
    await sendRollRequest({
      targetIds: [...selectedTargets],
      attribute: dom.promptAttribute.value,
      skill: dom.promptSkill.value,
      difficulty: dom.promptDifficulty.value === "" ? null : dom.promptDifficulty.value,
      hideDifficulty: dom.promptHideDifficulty.checked,
    });
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.rollResults.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-close-roll]");
  if (!button) return;
  try {
    await api("/api/campaign/roll/close", { code, token, requestId: button.dataset.closeRoll });
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

dom.encounterCharacterList.addEventListener("change", (event) => {
  const location = event.target.closest("[data-encounter-location]");
  if (location) {
    encounterLocations.set(location.dataset.encounterLocation, location.value);
    return;
  }
  const input = event.target.closest("[data-encounter-character]");
  if (!input) return;
  if (input.checked) selectedEncounterCharacters.add(input.dataset.encounterCharacter);
  else selectedEncounterCharacters.delete(input.dataset.encounterCharacter);
  renderEncounterBuilder();
});

dom.encounterNpcList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-staged-npc]");
  if (!button) return;
  stagedNpcs = stagedNpcs.filter((entry) => entry.id !== button.dataset.removeStagedNpc);
  renderEncounterBuilder();
});

dom.encounterNpcTemplate.addEventListener("change", () => {
  const template = npcTemplateById(dom.encounterNpcTemplate.value);
  if (!template) return;
  encounterNpcDraft = stagedNpc(template);
  renderEncounterBuilder();
});
dom.encounterNpcEditor.addEventListener("input", (event) => {
  updateNpcField(encounterNpcDraft, event.target.dataset.npcField, event.target.type === "checkbox" ? event.target.checked : event.target.value);
});
dom.addEncounterNpc.addEventListener("click", () => {
  if (!encounterNpcDraft) return;
  stagedNpcs.push(stagedNpc(encounterNpcDraft));
  encounterNpcDraft = randomBuiltinNpc();
  renderEncounterBuilder();
});
dom.premadeNpcSelect.addEventListener("change", () => {
  const template = (campaign?.npcTemplates || []).find((entry) => entry.id === dom.premadeNpcSelect.value);
  premadeNpcDraft = template ? stagedNpc(template) : stagedNpc(NPC_BLANK);
  renderPremadeNpcConsole();
});
dom.premadeNpcEditor.addEventListener("input", (event) => {
  updateNpcField(premadeNpcDraft, event.target.dataset.npcField, event.target.type === "checkbox" ? event.target.checked : event.target.value);
});
dom.newPremadeNpc.addEventListener("click", () => {
  premadeNpcDraft = stagedNpc(NPC_BLANK);
  renderPremadeNpcConsole();
  dom.premadeNpcEditor.querySelector('[data-npc-field="name"]')?.focus();
});
dom.savePremadeNpc.addEventListener("click", async () => {
  try {
    const saved = await saveNpcTemplate(premadeNpcDraft);
    premadeNpcDraft = stagedNpc({ ...saved, customTemplate: true });
    renderPremadeNpcConsole();
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});
dom.deletePremadeNpc.addEventListener("click", () => deleteNpcTemplate(premadeNpcDraft?.templateId).catch((error) => showMessage(dom.message, error.message, "error")));
dom.beginEncounter.addEventListener("click", beginEncounter);
dom.resumeEncounter.addEventListener("click", resumeEncounterWithFreshCharacters);
dom.exitEncounter.addEventListener("click", exitCampaignEncounter);
dom.prepareNewEncounter.addEventListener("click", async () => {
  if (!await confirmGm({ title: "Prepare New Encounter?", message: "Replace the saved encounter when Begin Combat is pressed? The current encounter remains safe until then.", acceptLabel: "Prepare Encounter" })) return;
  showEncounterSetup({ forceBuilder: true });
});
dom.returnToEncounterSetup.addEventListener("click", () => showEncounterSetup());

dom.bannerExitEnabled.checked = bannerExitEnabled;
dom.bannerExitEnabled.addEventListener("change", () => {
  bannerExitEnabled = dom.bannerExitEnabled.checked;
  localStorage.setItem("sa-gm-banner-exit-enabled", bannerExitEnabled ? "on" : "off");
});

function renderGmBannerVisibility() {
  if (!["show", "hide-code", "hidden"].includes(interfaceBannerMode)) interfaceBannerMode = "show";
  document.body.classList.toggle("interface-banner-hidden", interfaceBannerMode === "hidden");
  document.body.classList.toggle("interface-room-code-hidden", interfaceBannerMode === "hide-code");
  dom.bannerVisibilityToggle?.querySelectorAll("[data-banner-mode]").forEach((button) => {
    const selected = button.dataset.bannerMode === interfaceBannerMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}
dom.bannerVisibilityToggle?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-banner-mode]");
  if (!button) return;
  interfaceBannerMode = button.dataset.bannerMode;
  localStorage.setItem(BANNER_MODE_KEY, interfaceBannerMode);
  localStorage.setItem(BANNER_VISIBILITY_KEY, interfaceBannerMode === "hidden" ? "hidden" : "visible");
  renderGmBannerVisibility();
  const messages = { show: "Interface banner and Room Code shown.", "hide-code": "Interface banner shown with the Room Code hidden on this device.", hidden: "Interface banner hidden on this device." };
  showMessage(dom.message, messages[interfaceBannerMode], "success");
});

dom.encounterNpcList.addEventListener("change", (event) => {
  const location = event.target.closest("[data-staged-location]");
  if (!location) return;
  const npc = stagedNpcs.find((entry) => entry.id === location.dataset.stagedLocation);
  if (npc) npc.locationStarshipId = location.value;
});
window.addEventListener("storage", (event) => {
  if (![BANNER_MODE_KEY, BANNER_VISIBILITY_KEY].includes(event.key)) return;
  interfaceBannerMode = localStorage.getItem(BANNER_MODE_KEY) || (localStorage.getItem(BANNER_VISIBILITY_KEY) === "hidden" ? "hidden" : "show");
  renderGmBannerVisibility();
});
renderGmBannerVisibility();
dom.brand.addEventListener("click", async () => {
  if (!campaign) {
    location.href = "index.html";
    return;
  }
  if (!bannerExitEnabled || !await confirmGm({ title: "Exit Campaign?", message: "Return to the main menu?", acceptLabel: "Exit Campaign", danger: true })) return;
  events?.close();
  clearAtbBrowserIdentity();
  location.href = "index.html";
});
function updateSoundButton() {
  dom.soundToggle.classList.toggle("muted", gmSoundsMuted);
  dom.soundToggle.setAttribute("aria-label", gmSoundsMuted ? "Unmute combat sounds" : "Mute combat sounds");
  dom.soundToggle.title = gmSoundsMuted ? "Unmute combat sounds" : "Mute combat sounds";
}
dom.soundToggle.addEventListener("click", () => {
  gmSoundsMuted = !gmSoundsMuted;
  localStorage.setItem("sa-atb-gm-muted", gmSoundsMuted ? "on" : "off");
  if (gmSoundsMuted) gmDramaAudioContext?.suspend().catch(() => {});
  else gmDramaAudioContext?.resume().catch(() => {});
  updateSoundButton();
  dom.atbFrame.contentWindow?.postMessage({ type: "sa-gm-sound-muted", muted: gmSoundsMuted }, location.origin);
});

dom.revealSettingsRoomCode?.addEventListener("click", () => {
  settingsRoomCodeRevealed = !settingsRoomCodeRevealed;
  renderSettings();
});

dom.hideCampaignRoomCode?.addEventListener("change", async () => {
  dom.hideCampaignRoomCode.disabled = true;
  dom.roomCodePrivacyMessage.textContent = "Saving...";
  try {
    const payload = await api("/api/campaign/settings", {
      code,
      token,
      hideRoomCode: dom.hideCampaignRoomCode.checked,
    });
    receiveCampaign(payload.campaign);
    dom.roomCodePrivacyMessage.textContent = dom.hideCampaignRoomCode.checked
      ? "Room Code hidden on GM and player campaign screens."
      : "Room Code visible on campaign screens.";
    dom.roomCodePrivacyMessage.className = "tool-message success";
  } catch (error) {
    dom.roomCodePrivacyMessage.textContent = error.message;
    dom.roomCodePrivacyMessage.className = "tool-message error";
    dom.hideCampaignRoomCode.checked = Boolean(campaign.settings?.hideRoomCode);
  } finally {
    dom.hideCampaignRoomCode.disabled = false;
  }
});
dom.dismissDramaCard?.addEventListener("click", () => {
  dom.dramaAlert.hidden = true;
  requestAnimationFrame(showNextDramaAlert);
});
dom.dramaDeckStatus?.addEventListener("click", () => {
  selectGmTab("characters");
  requestAnimationFrame(() => dom.dramaDiscardPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
});
dom.dramaDiscardList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-discard-card]");
  if (!button) return;
  const card = campaign?.dramaDeck?.discard?.find((entry) => entry.id === button.dataset.discardCard);
  if (card) openGmDramaCard(card, { byline: `Discard pile: ${card.name}` });
});
dom.atbFrame.addEventListener("load", () => {
  dom.atbFrame.contentWindow?.postMessage({ type: "sa-gm-sound-muted", muted: gmSoundsMuted }, location.origin);
});
window.addEventListener("message", async (event) => {
  if (event.origin !== location.origin || event.source !== dom.atbFrame.contentWindow) return;
  if (event.data?.type !== "sa-combat-ended") return;
  dom.atbFrame.removeAttribute("src");
  stagedNpcs = [];
  encounterNpcDraft = randomBuiltinNpc();
  await refreshEncounterState().catch(() => null);
  selectGmTab("script");
  showMessage(dom.message, "Combat ended for the entire campaign. Character and campaign data remain saved.", "success");
});
updateSoundButton();

async function downloadCampaignBackup() {
  try {
    const backup = await api(`/api/campaign/backup?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, null, "GET");
    cacheFullCampaignBackup(backup);
    const safeName = campaign.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "campaign";
    downloadJson(backup, `${safeName}-${campaign.code}.sa2campaign`);
    showMessage(dom.message, "Campaign synchronized and backed up to this computer.", "success");
    return true;
  } catch (error) {
    showMessage(dom.message, error.message, "error");
    return false;
  }
}

dom.saveCampaignBackup.addEventListener("click", downloadCampaignBackup);

dom.restoreOpenCampaignFile.addEventListener("change", async () => {
  try {
    const backup = await readCampaignBackup(dom.restoreOpenCampaignFile.files?.[0]);
    if (backup.campaign.code !== code) throw new Error(`That backup belongs to campaign ${backup.campaign.code}, not ${code}.`);
    const hostedRevision = Math.max(1, Number(campaign.revision) || 1);
    const backupRevision = Math.max(1, Number(backup.campaign.revision ?? backup.summary?.revision) || 1);
    const hostedUpdated = new Date(campaign.updatedAt || campaign.createdAt).toLocaleString();
    const backupUpdated = new Date(backup.campaign.updatedAt || backup.exportedAt).toLocaleString();
    const newer = backupRevision > hostedRevision ? "The backup appears newer." : hostedRevision > backupRevision ? "The hosted campaign appears newer." : "Both copies have the same revision number.";
    const comparison = `HOSTED: Session ${campaign.sessionNumber || 0}, Revision ${hostedRevision}, updated ${hostedUpdated}.\nBACKUP: Session ${backup.campaign.sessionNumber || 0}, Revision ${backupRevision}, updated ${backupUpdated}.\n\n${newer}`;
    if (!await confirmGm({ title: "Restore Campaign?", message: `${comparison}\n\nRestoring replaces the hosted campaign with the backup file.`, acceptLabel: "Restore Backup", danger: true })) return;
    const payload = await api("/api/campaign/restore", { code, token, backup });
    receiveCampaign(payload.campaign);
    await refreshEncounterState();
    showMessage(dom.message, "Campaign restored from backup.", "success");
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  } finally {
    dom.restoreOpenCampaignFile.value = "";
  }
});

dom.deleteCampaign.addEventListener("click", async () => {
  const typedName = await promptGm({
    title: "Delete Campaign",
    message: `Type the campaign name exactly to continue:\n${campaign.name}`,
    inputLabel: "Campaign Name",
    requiredValue: campaign.name,
    acceptLabel: "Continue",
    danger: true,
  });
  if (typedName === null) return;
  const gmCode = await promptGm({
    title: "Confirm GM Code",
    message: "Enter the GM Code to permanently delete this campaign.",
    inputLabel: "GM Code",
    acceptLabel: "Continue",
    danger: true,
  });
  if (gmCode === null) return;
  if (!await confirmGm({ title: "Permanently Delete Campaign?", message: "This removes its script, notes, and encounter. Player characters will be unlinked and preserved on their devices.", acceptLabel: "Delete Campaign", danger: true })) return;
  try {
    await api("/api/campaign/delete", { code, token, campaignName: typedName, gmCode });
    localStorage.removeItem(tokenKey(code));
    localStorage.removeItem("sa-current-campaign-code");
    clearAtbBrowserIdentity();
    location.href = "index.html";
  } catch (error) {
    showMessage(dom.message, error.message, "error");
  }
});

builtinNpcTemplates = await fetch("data/npc-templates.json", { cache: "no-store" }).then((response) => response.json()).catch(() => [NPC_BLANK]);
populateRulesControls();
renderScriptEditor("");
const initialCode = new URLSearchParams(location.search).get("campaign")?.toUpperCase() || (!SHOWCASE_MODE ? localStorage.getItem("sa-current-campaign-code") : "") || "";
if (initialCode) {
  const savedToken = (SHOWCASE_MODE ? sessionStorage : localStorage).getItem(tokenKey(initialCode)) || "";
  if (savedToken) {
    dom.code.value = initialCode;
    code = initialCode;
    token = savedToken;
    refreshCampaign().then(() => {
      if (campaign?.role === "gm") {
        openWorkspace(campaign, token);
        if (new URLSearchParams(location.search).get("showcase") === "1") {
          selectGmTab("atb");
          showEncounterLive();
        }
      }
    }).catch(() => {});
  }
}
