import {
  ATTRIBUTE_POINTS,
  BASE_SKILL_POINTS,
  MAX_STARTING_SKILL,
  DICE_NAMES,
  DICE_FACES,
  HOME_PLANETS,
  ATTRIBUTE_COSTS,
  ATTRIBUTE_DEFS,
  SPACECRAFT_SKILLS,
  GENERAL_SKILLS,
  BOLD_SKILLS,
  INTELLECT_SKILL_POINT_BONUSES,
  RACE_DEFS,
  raceById,
  CLASS_DEFS,
  classById,
} from "./character-data.js?v=20260807-tabs-2";
import { FUBS_CHAIN_RESULTS, fubsEntry } from "./fubs-data.js?v=20260807-tabs-2";
import { PhysicalDiceRoller } from "./dice-roller.js?v=20260807-tabs-2";
import { openPrintableCharacterSheet } from "./character-print.js?v=20260807-tabs-2";
import { WEAPONS, weaponById } from "./weapon-data.js?v=20260809-weapons-1";

const STORAGE_KEY = "sa2e-character-library-v1";
const CAMPAIGN_CACHE_PREFIX = "sa-character-campaign-cache-v1-";
const CAMPAIGN_CHARACTER_PREFIX = "sa-character-local-v1-";
const ACTIVE_KEY = "sa2e-active-character-v1";
const RECOVERY_KEY = "sa2e-character-recovery-v1";
const LAYOUT_MODE_KEY = "sa2e-character-layout-v1";
const HUD_VISIBILITY_KEY = "sa2e-character-hud-visible-v1";
const SKILL_SORT_KEY = "sa2e-character-skill-sort-v1";
const SHEET_SECTIONS = new Set(["identity", "attributes", "skills", "substats", "resources", "supplies"]);
const SKILL_SORT_MODES = new Set(["alphabetical", "attribute", "level", "importance", "basic"]);
const SKILL_ASSOCIATED_ATTRIBUTE = Object.freeze({
  "Acting/Lie": "charisma",
  "Anatomy/First Aid": "intellect",
  "Architecture": "intellect",
  "Art/Music": "charisma",
  "Astronomy": "intellect",
  "Athletics/Endurance": "health",
  "Awareness": "perception",
  "Break Free/Escape": "strength",
  "Caretaking/Nurture": "charisma",
  "Catch/Throw": "dexterity",
  "Climb": "strength",
  "Common Knowledge": "intellect",
  "Cooking": "intellect",
  "Demolitions": "intellect",
  "Disguise/Mimic": "charisma",
  "Dodge/Block": "dexterity",
  "Drive/Small Vehicle": "dexterity",
  "Fashion/Etiquette": "charisma",
  "Forgotten Languages": "intellect",
  "Gambling": "luck",
  "History/Lore": "intellect",
  "Identify Taste/Smell": "perception",
  "Initiative": "intellect",
  "Intimidate/Taunt": "charisma",
  "Intuition/Empathy": "perception",
  "Jump": "strength",
  "Law/Politics": "intellect",
  "Leadership": "charisma",
  "Lift/Push/Pull": "strength",
  "Lock-picking": "dexterity",
  "Mathematics": "intellect",
  "Melee": "strength",
  "Navigate": "perception",
  "Negotiation/Persuade": "charisma",
  "Occult": "intellect",
  "Pickpocket": "dexterity",
  "Projectile": "dexterity",
  "Psychology": "intellect",
  "Religion": "intellect",
  "Research": "intellect",
  "Resist Distress": "willpower",
  "Science/Physics": "intellect",
  "Self-Control": "willpower",
  "Showmanship": "charisma",
  "Stealth/Hide": "dexterity",
  "Survival/Tracking": "perception",
  "Swim": "strength",
  "Tame Animal": "charisma",
  "Teaching": "charisma",
  "Technology": "intellect",
  "Vehicle Mechanics": "intellect",
  "Weapon Mechanics": "intellect",
  "Wrestle/Disarm": "strength",
  "Writing": "intellect",
});
const PHYSICAL_SKILLS = new Set([
  "Athletics/Endurance",
  "Break Free/Escape",
  "Catch/Throw",
  "Climb",
  "Dodge/Block",
  "Drive/Small Vehicle",
  "Identify Taste/Smell",
  "Jump",
  "Lift/Push/Pull",
  "Lock-picking",
  "Melee",
  "Pickpocket",
  "Projectile",
  "Stealth/Hide",
  "Swim",
  "Wrestle/Disarm",
]);
const FORMAT_NAME = "spaceship-architect-2e-character";
const FORMAT_VERSION = 6;
const ALL_SKILLS = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
const DEBUG_CONTROLS_ENABLED = false;
const PAGE_PARAMS = new URLSearchParams(window.location.search);
const CAMPAIGN_READ_ONLY_VIEW = PAGE_PARAMS.get("campaignView") === "1";
const $ = (selector) => document.querySelector(selector);

const dom = {
  characterPicker: $("#characterPicker"),
  newCharacter: $("#newCharacter"),
  duplicateCharacter: $("#duplicateCharacter"),
  exportCharacter: $("#exportCharacter"),
  importCharacter: $("#importCharacter"),
  deleteCharacter: $("#deleteCharacter"),
  localShowPcCode: $("#localShowPcCode"),
  localPrintCharacter: $("#localPrintCharacter"),
  characterSheet: $("#characterSheet"),
  tabbedToolbar: $("#tabbedCharacterToolbar"),
  sheetSectionTabs: $("#sheetSectionTabs"),
  globalCharacterHud: $("#globalCharacterHud"),
  tabStatusExperience: $("#tabStatusExperience"),
  tabStatusHp: $("#tabStatusHp"),
  tabStatusReverence: $("#tabStatusReverence"),
  tabStatusExertion: $("#tabStatusExertion"),
  tabStatusCredits: $("#tabStatusCredits"),
  saveStatus: $("#saveStatus"),
  identityPanel: $(".identity-panel"),
  identityCallsign: $("#identityCallsign"),
  racePicker: $("#racePicker"),
  raceCustom: $("#raceCustom"),
  raceTypeField: $("#raceTypeField"),
  raceTypePicker: $("#raceTypePicker"),
  classPicker: $("#classPicker"),
  automaticModifiers: $("#automaticModifiers"),
  phaseBadge: $("#phaseBadge"),
  nextRequirement: $("#nextRequirement"),
  workflowDetail: $("#workflowDetail"),
  workflowBar: $(".workflow-bar"),
  workflowExperience: $("#workflowExperience"),
  workflowAttributeRemaining: $("#workflowAttributeRemaining"),
  workflowSkillRemaining: $("#workflowSkillRemaining"),
  workflowCredits: $("#workflowCredits"),
  finalizeCharacter: $("#finalizeCharacter"),
  spendExperience: $("#spendExperience"),
  attributeBudget: $("#attributeBudget"),
  attributeBudgetFormula: $("#attributeBudgetFormula"),
  skillBudget: $("#skillBudget"),
  skillBudgetFormula: $("#skillBudgetFormula"),
  xpAvailable: $("#xpAvailable"),
  xpTotal: $("#xpTotal"),
  xpFormula: $("#xpFormula"),
  xpGrantAmount: $("#xpGrantAmount"),
  grantXp: $("#grantXp"),
  homePlanetPicker: $("#homePlanetPicker"),
  homePlanetCustom: $("#homePlanetCustom"),
  creatorNotice: $("#creatorNotice"),
  attributeGrid: $("#attributeGrid"),
  spacecraftSkills: $("#spacecraftSkills"),
  generalSkills: $("#generalSkills"),
  customSkills: $("#customSkills"),
  customSkillsEmpty: $("#customSkillsEmpty"),
  addCustomSkill: $("#addCustomSkill"),
  skillSearch: $("#skillSearch"),
  skillSort: $("#skillSort"),
  skillLockNotice: $("#skillLockNotice"),
  derivedSpeed: $("#derivedSpeed"),
  derivedSpeedFormula: $("#derivedSpeedFormula"),
  speedPreview: $("#speedPreview"),
  speedPreviewFill: $("#speedPreviewFill"),
  speedPreviewReadout: $("#speedPreviewReadout"),
  derivedCommand: $("#derivedCommand"),
  derivedCommandFormula: $("#derivedCommandFormula"),
  maximumHp: $("#maximumHp"),
  maximumHpFormula: $("#maximumHpFormula"),
  permanentHpBonus: $("#permanentHpBonus"),
  permanentHpFormula: $("#permanentHpFormula"),
  damageReduction: $("#damageReduction"),
  damageReductionFormula: $("#damageReductionFormula"),
  currentHp: $("#currentHp"),
  currentHpMaximum: $("#currentHpMaximum"),
  restoreHp: $("#restoreHp"),
  marineHeal: $("#marineHeal"),
  exertionMeter: $("#exertionMeter"),
  exertionFormula: $("#exertionFormula"),
  restExertion: $("#restExertion"),
  moveSpeedValue: $("#moveSpeedValue"),
  moveSpeedFormula: $("#moveSpeedFormula"),
  creditsValue: $("#creditsValue"),
  creditsFormula: $("#creditsFormula"),
  dramaCardsValue: $("#dramaCardsValue"),
  specialAbilitiesCard: $("#specialAbilitiesCard"),
  specialAbilityActions: $("#specialAbilityActions"),
  reverenceCurrent: $("#reverenceCurrent"),
  reverenceMeter: $("#reverenceMeter"),
  maxHpBonus: $("#maxHpBonus"),
  manualAttributeReroll: $("#manualAttributeReroll"),
  characterAtbColor: $("#characterAtbColor"),
  debugReverence: $("#debugReverence"),
  crewRoster: $("#crewRoster"),
  addCrewRow: $("#addCrewRow"),
  weaponInventory: $("#weaponInventory"),
  addWeaponRow: $("#addWeaponRow"),
  confirmModal: $("#confirmModal"),
  confirmTitle: $("#confirmTitle"),
  confirmMessage: $("#confirmMessage"),
  confirmPreview: $("#confirmPreview"),
  confirmCancel: $("#confirmCancel"),
  confirmAccept: $("#confirmAccept"),
  wipeOverlay: $("#wipeOverlay"),
  fubsButton: $("#fubsButton"),
  fubsDebugValue: $("#fubsDebugValue"),
  fubsDebugRoll: $("#fubsDebugRoll"),
  fubsModal: $("#fubsModal"),
  fubsDialog: $(".fubs-dialog"),
  fubsRollChain: $("#fubsRollChain"),
  fubsEntryText: $("#fubsEntryText"),
  fubsReroll: $("#fubsReroll"),
  fubsExit: $("#fubsExit"),
  skillCheckModal: $("#skillCheckModal"),
  skillCheckTitle: $("#skillCheckTitle"),
  skillCheckKicker: $("#skillCheckKicker"),
  skillCheckSubtitle: $("#skillCheckSubtitle"),
  skillCheckClose: $("#skillCheckClose"),
  skillAttributeStage: $("#skillAttributeStage"),
  skillAttributeChoices: $("#skillAttributeChoices"),
  skillSetupStage: $("#skillSetupStage"),
  changeSkillAttribute: $("#changeSkillAttribute"),
  selectedAttributeName: $("#selectedAttributeName"),
  selectedDicePool: $("#selectedDicePool"),
  selectedSkillBonus: $("#selectedSkillBonus"),
  skillExertionBlock: $("#skillExertionBlock"),
  skillExertionReadout: $("#skillExertionReadout"),
  skillExertionMeter: $("#skillExertionMeter"),
  skillDifficulty: $("#skillDifficulty"),
  manualSkillScore: $("#manualSkillScore"),
  cancelSkillCheck: $("#cancelSkillCheck"),
  calculateManualSkill: $("#calculateManualSkill"),
  rollSkillCheck: $("#rollSkillCheck"),
  skillResultStage: $("#skillResultStage"),
  skillResultLabel: $("#skillResultLabel"),
  skillResultScore: $("#skillResultScore"),
  skillResultEquation: $("#skillResultEquation"),
  skillResultOutcome: $("#skillResultOutcome"),
  skillFusionResults: $("#skillFusionResults"),
  skillFusionChoices: $("#skillFusionChoices"),
  skillFusionWarning: $("#skillFusionWarning"),
  rerollSkillCheck: $("#rerollSkillCheck"),
  freeRuleReroll: $("#freeRuleReroll"),
  exitSkillResult: $("#exitSkillResult"),
  rollResultToast: $("#rollResultToast"),
  campaignGate: $("#characterCampaignGate"),
  campaignEntryPrompt: $("#campaignEntryPrompt"),
  campaignForm: $("#characterCampaignForm"),
  campaignCode: $("#characterCampaignCode"),
  campaignMessage: $("#characterCampaignMessage"),
  campaignLobby: $("#campaignRosterLobby"),
  lobbyCampaignCode: $("#lobbyCampaignCode"),
  lobbyCampaignName: $("#lobbyCampaignName"),
  campaignRosterCards: $("#campaignRosterCards"),
  campaignSheetViewer: $("#campaignSheetViewer"),
  campaignSheetViewerName: $("#campaignSheetViewerName"),
  campaignSheetViewerPosition: $("#campaignSheetViewerPosition"),
  campaignSheetFrame: $("#campaignSheetFrame"),
  closeCampaignSheetViewer: $("#closeCampaignSheetViewer"),
  previousCampaignSheet: $("#previousCampaignSheet"),
  nextCampaignSheet: $("#nextCampaignSheet"),
  campaignPrivateNotes: $("#campaignPrivateNotes"),
  changeCampaign: $("#changeCampaign"),
  createCampaignCharacter: $("#createCampaignCharacter"),
  importCampaignCharacter: $("#importCampaignCharacter"),
  characterWorkspace: $("#characterWorkspace"),
  campaignAccessBar: $("#campaignAccessBar"),
  activeCampaignLabel: $("#activeCampaignLabel"),
  campaignAccessRole: $("#campaignAccessRole"),
  previousCampaignCharacter: $("#previousCampaignCharacter"),
  nextCampaignCharacter: $("#nextCampaignCharacter"),
  campaignCharacterPosition: $("#campaignCharacterPosition"),
  unlockCampaignCharacter: $("#unlockCampaignCharacter"),
  openPrivateNotes: $("#openPrivateNotes"),
  privateNoteCount: $("#privateNoteCount"),
  openCampaignBank: $("#openCampaignBank"),
  campaignBankSummary: $("#campaignBankSummary"),
  campaignBankCard: $("#campaignBankCard"),
  saveAndSyncCharacter: $("#saveAndSyncCharacter"),
  showCharacterPin: $("#showCharacterPin"),
  printCharacterSheet: $("#printCharacterSheet"),
  returnToCampaignRoster: $("#returnToCampaignRoster"),
  campaignPinModal: $("#campaignPinModal"),
  campaignPinTitle: $("#campaignPinTitle"),
  campaignPinMessage: $("#campaignPinMessage"),
  campaignPinDisplay: $("#campaignPinDisplay"),
  campaignPinEntryWrap: $("#campaignPinEntryWrap"),
  campaignPinEntry: $("#campaignPinEntry"),
  campaignPinCancel: $("#campaignPinCancel"),
  campaignPinConfirm: $("#campaignPinConfirm"),
  privateNotesModal: $("#privateNotesModal"),
  privateNotesList: $("#privateNotesList"),
  closePrivateNotes: $("#closePrivateNotes"),
  campaignBankModal: $("#campaignBankModal"),
  bankPersonalCredits: $("#bankPersonalCredits"),
  bankShipCredits: $("#bankShipCredits"),
  bankAuthority: $("#bankAuthority"),
  bankOperation: $("#bankOperation"),
  bankTargetWrap: $("#bankTargetWrap"),
  bankTarget: $("#bankTarget"),
  bankAmountLabel: $("#bankAmountLabel"),
  bankAmount: $("#bankAmount"),
  bankCancel: $("#bankCancel"),
  bankConfirm: $("#bankConfirm"),
  campaignRollPrompt: $("#campaignRollPrompt"),
  campaignRollPromptTitle: $("#campaignRollPromptTitle"),
  campaignRollPromptDifficulty: $("#campaignRollPromptDifficulty"),
  openCampaignRoll: $("#openCampaignRoll"),
  skillDiceResults: $("#skillDiceResults"),
  skillDiceTypes: $("#skillDiceTypes"),
  skillDiceValues: $("#skillDiceValues"),
  tabs: $("#characterTabs"),
  roomCode: $("#characterRoomCode"),
  roomCodeValue: $("#characterRoomCodeValue"),
  backToMain: $("#backToMainMenu"),
  joinCampaignPanel: $("#joinCampaignPanel"),
  joinCampaignForm: $("#joinCampaignForm"),
  joinCampaignRoomCode: $("#joinCampaignRoomCode"),
  joinCampaignStatus: $("#joinCampaignStatus"),
  playerInboxPanel: $("#playerInboxPanel"),
  playerInboxCount: $("#playerInboxCount"),
  playerInboxList: $("#playerInboxList"),
  messageGmForm: $("#messageGmForm"),
  messageGmText: $("#messageGmText"),
  playerSettingsPanel: $("#playerSettingsPanel"),
  characterLayoutToggle: $("#characterLayoutToggle"),
  resourceHudToggle: $("#resourceHudToggle"),
  versionUpdateCard: $("#versionUpdateCard"),
  versionUpdateMessage: $("#versionUpdateMessage"),
  updateCharacterVersion: $("#updateCharacterVersion"),
  settingsLoadCharacter: $("#settingsLoadCharacter"),
  settingsExportCharacter: $("#settingsExportCharacter"),
  settingsNewCharacter: $("#settingsNewCharacter"),
  settingsLeaveCampaign: $("#settingsLeaveCampaign"),
  settingsLogout: $("#settingsLogout"),
  playerAtbPanel: $("#playerAtbPanel"),
  launchPlayerAtb: $("#launchPlayerAtb"),
  angilurosSpeedBoost: $("#angilurosSpeedBoost"),
  playerAtbFrame: $("#playerAtbFrame"),
  playerAtbStatus: $("#playerAtbStatus"),
  pcCodeModal: $("#pcCodeModal"),
  pcCodeFirst: $("#pcCodeFirst"),
  pcCodeConfirm: $("#pcCodeConfirm"),
  pcCodeMessage: $("#pcCodeMessage"),
  pcCodeCancel: $("#pcCodeCancel"),
  pcCodeAccept: $("#pcCodeAccept"),
};

let characterAudioContext = null;
let diceRollNoiseBuffer = null;

function ensureCharacterAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  if (!characterAudioContext) characterAudioContext = new Context();
  if (characterAudioContext.state === "suspended") characterAudioContext.resume().catch(() => {});
  return characterAudioContext;
}

function scheduleTone(audio, frequency, start, duration, gainValue, type = "sine") {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const begins = audio.currentTime + start;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, begins);
  gain.gain.setValueAtTime(0.0001, begins);
  gain.gain.exponentialRampToValueAtTime(gainValue, begins + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, begins + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(begins);
  oscillator.stop(begins + duration + 0.02);
}

function scheduleSweep(audio, from, to, start, duration, gainValue, type = "sine") {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const begins = audio.currentTime + start;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, from), begins);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), begins + duration);
  gain.gain.setValueAtTime(0.0001, begins);
  gain.gain.exponentialRampToValueAtTime(gainValue, begins + Math.min(0.025, duration * 0.18));
  gain.gain.exponentialRampToValueAtTime(0.0001, begins + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(begins);
  oscillator.stop(begins + duration + 0.02);
}

function playPurchaseSound(attributeKey = "") {
  const audio = ensureCharacterAudio();
  if (!audio) return;
  switch (attributeKey) {
    case "strength":
      scheduleSweep(audio, 230, 72, 0, 0.24, 0.055, "sawtooth");
      scheduleTone(audio, 92, 0.045, 0.22, 0.035, "sine");
      break;
    case "health":
      scheduleSweep(audio, 210, 610, 0, 0.28, 0.038, "sine");
      scheduleSweep(audio, 320, 790, 0.035, 0.25, 0.022, "triangle");
      break;
    case "perception":
      scheduleTone(audio, 720, 0, 0.12, 0.026, "sine");
      scheduleTone(audio, 1180, 0.085, 0.18, 0.036, "sine");
      scheduleTone(audio, 1680, 0.13, 0.12, 0.012, "sine");
      break;
    case "dexterity":
      scheduleTone(audio, 1320, 0, 0.13, 0.045, "sine");
      scheduleTone(audio, 1980, 0.018, 0.09, 0.018, "triangle");
      break;
    case "luck": {
      const offset = [0, 70, 145, 240][Math.floor(Math.random() * 4)];
      scheduleTone(audio, 660 + offset, 0, 0.15, 0.025, "triangle");
      scheduleTone(audio, 940 + offset, 0.06, 0.2, 0.03, "sine");
      scheduleSweep(audio, 1380 + offset, 920 + offset, 0.11, 0.17, 0.014, "sine");
      break;
    }
    case "charisma":
      scheduleTone(audio, 440, 0, 0.27, 0.021, "sine");
      scheduleTone(audio, 550, 0.025, 0.26, 0.021, "sine");
      scheduleTone(audio, 660, 0.05, 0.25, 0.021, "sine");
      break;
    case "intellect":
      scheduleTone(audio, 520, 0, 0.08, 0.025, "square");
      scheduleTone(audio, 700, 0.055, 0.09, 0.024, "triangle");
      scheduleTone(audio, 940, 0.11, 0.12, 0.03, "sine");
      break;
    case "willpower":
      scheduleSweep(audio, 180, 430, 0, 0.3, 0.044, "triangle");
      scheduleTone(audio, 430, 0.12, 0.21, 0.025, "sine");
      scheduleTone(audio, 860, 0.16, 0.17, 0.014, "sine");
      break;
    default:
      scheduleTone(audio, 520, 0, 0.07, 0.025, "triangle");
      scheduleTone(audio, 840, 0.045, 0.12, 0.032, "sine");
      scheduleTone(audio, 1120, 0.1, 0.09, 0.018, "sine");
      break;
  }
}

function playDiceRollSound() {
  const audio = ensureCharacterAudio();
  if (!audio) return;
  const duration = 0.72;
  if (!diceRollNoiseBuffer || diceRollNoiseBuffer.sampleRate !== audio.sampleRate) {
    const length = Math.ceil(audio.sampleRate * duration);
    diceRollNoiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = diceRollNoiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      const clatter = index % Math.max(80, Math.floor(audio.sampleRate * 0.047)) < 90 ? 1.45 : 0.58;
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 1.45) * clatter;
    }
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = diceRollNoiseBuffer;
  filter.type = "bandpass";
  filter.frequency.value = 1450;
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.055, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start();
  for (let bounce = 0; bounce < 8; bounce += 1) {
    const start = 0.045 + bounce * 0.073 + Math.random() * 0.018;
    scheduleTone(audio, 1040 - bounce * 72 + Math.random() * 110, start, 0.022, 0.016 * (1 - bounce / 10), "square");
  }
}

const diceRoller = new PhysicalDiceRoller({
  shell: $("#diceRoller"),
  stage: $(".dice-stage"),
  title: $("#diceTitle"),
  subtitle: $("#diceSubtitle"),
  result: $("#diceResult"),
  actions: $("#diceActions"),
  canvasHost: $("#diceCanvas"),
  onRollStart: playDiceRollSound,
});

let saveTimer = null;
let noticeTimer = null;
let confirmResolver = null;
let pcCodeResolver = null;
let finalizationPresentationActive = false;
let campaignViewerCharacterId = "";
let fubsRollInProgress = false;
let rollToastTimer = null;
let skillCheck = null;
let speedPreviewFrame = null;
let speedPreviewStartedAt = performance.now();
let speedPreviewValue = null;
let speedPreviewCharacterId = null;
let campaignCode = "";
let campaignState = null;
let campaignEvents = null;
let campaignCharacterId = "";
let campaignToken = "";
let campaignPin = "";
let campaignEditable = false;
let campaignDirty = false;
let campaignSaving = false;
let campaignBaselineCredits = 0;
let campaignBaselineHp = null;
let campaignSaveTimer = null;
let suppressCampaignSave = false;
let pinModalMode = "display";
let pendingPinCharacterId = "";
let activeCampaignRollRequest = null;

function showRollResultToast(message) {
  if (!dom.rollResultToast) return;
  window.clearTimeout(rollToastTimer);
  dom.rollResultToast.textContent = message;
  dom.rollResultToast.hidden = false;
  dom.rollResultToast.style.animation = "none";
  void dom.rollResultToast.offsetWidth;
  dom.rollResultToast.style.animation = "";
  rollToastTimer = window.setTimeout(() => {
    dom.rollResultToast.hidden = true;
  }, 1160);
}

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
      raceId: "",
      raceKind: "preset",
      raceType: "",
      classId: "",
      className: "No Class",
      homePlanet: "",
      homePlanetKind: "preset",
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
      raceGrantsApplied: false,
      classAttributeChoice: "",
      raceSkillChoices: [],
      raceAttributeChoice: "",
      racialSkillGrants: {},
      freeAttributeUpgradeApplied: false,
    },
    fubs: {
      status: "unrolled",
      rolls: [],
      rerollUsed: false,
    },
    pendingRoll: null,
    health: { current: null, permanentBonus: 0 },
    resources: {
      exertionCurrent: 1,
      exertionMax: 1,
      reverence: 0,
      creditsBase: 0,
      mechanicalExperience: 0,
      dramaCards: 0,
    },
    presentation: { atbColor: "#39e58f" },
    access: { pcCode: "" },
    campaignLink: { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" },
    localInbox: [],
    session: {
      number: 1,
      freeRerollsUsed: {},
      marineHealingUsed: false,
      psychopathAwardsUsed: 0,
      tacticianReverenceGiven: 0,
      peacekeeperDramaCardsEarned: 0,
    },
    crew: Array.from({ length: 3 }, () => ({ name: "", title: "" })),
    weapons: [{ id: uid(), weaponId: "", held: false }],
    advantagesNotes: "",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function classIdFromName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return CLASS_DEFS.find((entry) => entry.name.toLowerCase() === normalized)?.id || "";
}

function raceIdFromName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return RACE_DEFS.find((entry) => entry.name.toLowerCase() === normalized)?.id || "";
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
  const sourceVersion = Math.max(1, Math.round(Number(source.version) || 1));
  const legacy = sourceVersion < 4;
  const identity = { ...base.identity, ...(source.identity || {}) };
  identity.classId = identity.classId || classIdFromName(identity.className);
  identity.className = classById(identity.classId).name;
  identity.race = String(identity.race || "");
  identity.raceId = identity.raceId || raceIdFromName(identity.race);
  identity.raceKind = identity.raceKind === "other"
    || (identity.race && !identity.raceId)
    ? "other"
    : "preset";
  identity.raceType = String(identity.raceType || "");
  if (identity.raceId) identity.race = raceById(identity.raceId)?.name || identity.race;
  const raceDefinition = raceById(identity.raceId);
  if (!raceDefinition?.types?.some((type) => type.id === identity.raceType)) identity.raceType = "";
  identity.homePlanet = String(identity.homePlanet || "");
  identity.homePlanetKind = identity.homePlanetKind === "other"
    || (identity.homePlanet && !HOME_PLANETS.includes(identity.homePlanet))
    ? "other"
    : "preset";

  const normalized = {
    ...base,
    ...source,
    id: source.id || uid(),
    version: sourceVersion,
    phase: ["draft", "finalizing", "finalized"].includes(source.phase) ? source.phase : "draft",
    advancementOpen: Boolean(source.advancementOpen),
    legacyDraft: Boolean(source.legacyDraft),
    identity,
    experience: { ...base.experience, ...(source.experience || {}) },
    attributes: { ...base.attributes },
    skills: blankSkills(),
    customSkills: [],
    creation: { ...base.creation, ...(source.creation || {}) },
    fubs: { ...base.fubs, ...(source.fubs || {}) },
    pendingRoll: source.pendingRoll || null,
    health: { ...base.health, ...(source.health || {}) },
    resources: {
      ...base.resources,
      ...(source.resources || {}),
      creditsBase: source.resources?.creditsBase ?? source.resources?.credits ?? 0,
    },
    presentation: { ...base.presentation, ...(source.presentation || {}) },
    access: { ...base.access, ...(source.access || {}) },
    campaignLink: { ...base.campaignLink, ...(source.campaignLink || {}) },
    localInbox: (Array.isArray(source.localInbox) ? source.localInbox : []).slice(-20).map((note) => ({
      id: String(note?.id || uid()),
      kind: "system",
      direction: "to-character",
      message: String(note?.message || "").slice(0, 1000),
      createdAt: note?.createdAt || new Date().toISOString(),
      readAt: note?.readAt || null,
    })).filter((note) => note.message),
    session: {
      ...base.session,
      ...(source.session || {}),
      freeRerollsUsed: { ...base.session.freeRerollsUsed, ...(source.session?.freeRerollsUsed || {}) },
    },
    crew: Array.isArray(source.crew) ? source.crew.slice(0, 24) : base.crew,
    weapons: Array.isArray(source.weapons) ? source.weapons.slice(0, 24) : base.weapons,
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
  normalized.creation.classGrantsApplied = Boolean(source.creation?.classGrantsApplied);
  normalized.creation.raceGrantsApplied = Boolean(source.creation?.raceGrantsApplied);
  if (!/^#[0-9a-f]{6}$/i.test(normalized.presentation.atbColor)) normalized.presentation.atbColor = base.presentation.atbColor;
  normalized.access.pcCode = String(normalized.access.pcCode || source.pcCode || "").slice(0, 120);
  normalized.campaignLink.roomCode = String(normalized.campaignLink.roomCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  normalized.campaignLink.campaignName = String(normalized.campaignLink.campaignName || "").slice(0, 80);
  normalized.campaignLink.status = ["unlinked", "pending", "linked"].includes(normalized.campaignLink.status)
    ? normalized.campaignLink.status
    : "unlinked";
  normalized.campaignLink.requestId = String(normalized.campaignLink.requestId || "");
  normalized.campaignLink.message = String(normalized.campaignLink.message || "").slice(0, 1000);
  normalized.fubs.status = ["unrolled", "complete", "not-activated"].includes(normalized.fubs.status)
    ? normalized.fubs.status
    : "unrolled";
  normalized.fubs.rolls = (Array.isArray(normalized.fubs.rolls) ? normalized.fubs.rolls : [])
    .map((value) => Math.round(Number(value) || 0))
    .filter((value) => value >= 1 && value <= 100)
    .slice(0, 20);
  normalized.fubs.rerollUsed = Boolean(normalized.fubs.rerollUsed);
  if (normalized.fubs.status === "complete" && !normalized.fubs.rolls.length) normalized.fubs.status = "unrolled";
  if (normalized.phase === "draft" && normalized.fubs.status === "not-activated") normalized.fubs.status = "unrolled";
  if (normalized.phase === "finalized" && normalized.fubs.status === "unrolled") normalized.fubs.status = "not-activated";

  while (normalized.crew.length < 3) normalized.crew.push({ name: "", title: "" });
  normalized.crew = normalized.crew.map((member) => ({ name: String(member?.name || ""), title: String(member?.title || "") }));
  if (!normalized.weapons.length) normalized.weapons.push({ id: uid(), weaponId: "", held: false });
  let heldWeaponClaimed = false;
  normalized.weapons = normalized.weapons.map((entry) => {
    const weaponId = weaponById(entry?.weaponId) ? String(entry.weaponId) : "";
    const held = Boolean(weaponId && entry?.held && !heldWeaponClaimed);
    if (held) heldWeaponClaimed = true;
    return {
      id: String(entry?.id || uid()),
      weaponId,
      held,
    };
  });
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
  normalized.advantagesNotes = typeof source.advantagesNotes === "string" ? source.advantagesNotes : "";
  normalized.notes = typeof source.notes === "string" ? source.notes : "";
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
  return rawLibrary().map(normalizeCharacter);
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
  const computed = derivedValues();
  character.computed = {
    speed: computed.speed,
    commandWindow: computed.command,
    maximumHp: maximumHp(),
    moveSpeed: calculatedMoveSpeed(),
    damageReduction: damageReductionDetails().value,
  };
  if (!CAMPAIGN_READ_ONLY_VIEW) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    localStorage.setItem(ACTIVE_KEY, activeId);
    if (campaignCode && campaignCharacterId) cacheCampaignCharacter();
  }
  dom.saveStatus.textContent = campaignCode ? (campaignEditable ? "Saving to campaign..." : "Campaign view") : message;
  dom.saveStatus.classList.remove("saving");
  if (campaignCode && campaignCharacterId && campaignEditable && !suppressCampaignSave) {
    campaignDirty = true;
    queueCampaignCharacterSave();
  }
}

function queueSave() {
  dom.saveStatus.textContent = "Saving...";
  dom.saveStatus.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLibrary(), 160);
}

function campaignTokenKey(code, characterId) {
  return `sa-character-token-${String(code || "").toUpperCase()}-${characterId}`;
}

function campaignCacheKey(code) {
  return `${CAMPAIGN_CACHE_PREFIX}${String(code || "").toUpperCase()}`;
}

function localCampaignCharacterKey(code, characterId) {
  return `${CAMPAIGN_CHARACTER_PREFIX}${String(code || "").toUpperCase()}-${characterId}`;
}

function cacheCampaign(nextState) {
  if (!nextState?.code) return;
  try {
    localStorage.setItem(campaignCacheKey(nextState.code), JSON.stringify({ savedAt: new Date().toISOString(), campaign: nextState }));
  } catch {
    // The character-specific local copy is smaller and remains the primary device backup.
  }
}

function cacheCampaignCharacter() {
  if (!campaignCode || !campaignCharacterId || !character) return;
  try {
    localStorage.setItem(localCampaignCharacterKey(campaignCode, campaignCharacterId), JSON.stringify({
      savedAt: new Date().toISOString(),
      character,
    }));
  } catch {
    notice("Local storage is full. Export this character to preserve a separate backup.", "error");
  }
}

async function campaignRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Campaign request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function campaignCharacterName(record) {
  return record?.character?.identity?.characterName || "Unnamed Character";
}

function campaignPlayerName(record) {
  return record?.character?.identity?.playerName || "Player";
}

function updateCampaignCharacterNavigation() {
  const records = campaignState?.characters || [];
  const index = records.findIndex((entry) => entry.id === campaignCharacterId);
  const hasSeveral = records.length > 1 && index >= 0;
  dom.campaignCharacterPosition.textContent = index >= 0 ? `${index + 1} / ${records.length}` : `0 / ${records.length}`;
  dom.previousCampaignCharacter.disabled = !hasSeveral;
  dom.nextCampaignCharacter.disabled = !hasSeveral;
}

async function browseCampaignCharacter(offset) {
  const records = campaignState?.characters || [];
  if (records.length < 2) return;
  await saveCampaignCharacter();
  const currentIndex = Math.max(0, records.findIndex((entry) => entry.id === campaignCharacterId));
  const nextIndex = (currentIndex + offset + records.length) % records.length;
  showCampaignCharacter(records[nextIndex], { editable: false });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function queueCampaignCharacterSave(delay = 280) {
  clearTimeout(campaignSaveTimer);
  campaignSaveTimer = setTimeout(saveCampaignCharacter, delay);
}

async function saveCampaignCharacter({ force = false } = {}) {
  if (force && campaignCode && campaignCharacterId && campaignEditable) campaignDirty = true;
  if (!campaignCode || !campaignCharacterId || !campaignEditable || !campaignDirty || campaignSaving) return false;
  campaignSaving = true;
  campaignDirty = false;
  try {
    const payload = await campaignRequest("/api/campaign/character/save", {
      method: "POST",
      body: JSON.stringify({
        code: campaignCode,
        token: campaignToken,
        characterId: campaignCharacterId,
        baseCredits: campaignBaselineCredits,
        baseCurrentHp: campaignBaselineHp,
        character,
      }),
    });
    if (Number.isFinite(Number(payload.creditsBase))) {
      character.resources.creditsBase = Number(payload.creditsBase);
      campaignBaselineCredits = Number(payload.creditsBase);
      renderResources();
    }
    if (Number.isFinite(Number(payload.currentHp))) {
      character.health.current = Number(payload.currentHp);
      campaignBaselineHp = Number(payload.currentHp);
      renderDerived();
      renderTabbedStatus();
    }
    if (payload.updatedAt) character.updatedAt = payload.updatedAt;
    dom.saveStatus.textContent = "Saved to campaign";
    dom.saveStatus.classList.remove("saving");
    cacheCampaignCharacter();
    return true;
  } catch (error) {
    campaignDirty = true;
    dom.saveStatus.textContent = error.message;
    dom.saveStatus.classList.add("saving");
    return false;
  } finally {
    campaignSaving = false;
    if (campaignDirty) queueCampaignCharacterSave(5000);
  }
}

let activeCharacterTab = "sheet";
let activeSheetSection = "identity";
let characterLayoutMode = localStorage.getItem(LAYOUT_MODE_KEY) === "tabs" ? "tabs" : "sheet";
let resourceHudVisible = localStorage.getItem(HUD_VISIBILITY_KEY) !== "hidden";
const storedSkillSort = localStorage.getItem(SKILL_SORT_KEY);
let skillSortMode = SKILL_SORT_MODES.has(storedSkillSort) ? storedSkillSort : "alphabetical";
let joinStatusTimer = null;
let playerAtbLoading = false;

function creationLayoutForced() {
  return character.phase !== "finalized" || finalizationPresentationActive || CAMPAIGN_READ_ONLY_VIEW;
}

function isTabbedCharacterLayout() {
  return !creationLayoutForced() && characterLayoutMode === "tabs";
}

function updateLibraryVisibility() {
  const libraryBar = dom.characterPicker.closest(".library-bar");
  if (!libraryBar) return;
  const localSheet = !campaignCode && !CAMPAIGN_READ_ONLY_VIEW && activeCharacterTab === "sheet";
  const sectionAllowsLibrary = !isTabbedCharacterLayout() || activeSheetSection === "identity";
  libraryBar.hidden = !(localSheet && sectionAllowsLibrary);
}

function renderVersionUpdate() {
  if (!dom.versionUpdateCard) return;
  const version = Math.max(1, Math.round(Number(character.version) || 1));
  const editable = !campaignCode || campaignEditable;
  const outdated = version < FORMAT_VERSION;
  dom.versionUpdateCard.hidden = !outdated || !editable || CAMPAIGN_READ_ONLY_VIEW;
  if (outdated) dom.versionUpdateMessage.textContent = `This character uses version ${version}. Update its formulas and combat data to version ${FORMAT_VERSION}.`;
}

function renderTabbedStatus() {
  const maximum = maximumHp();
  const current = character.health.current === null || character.health.current === undefined
    ? maximum
    : Math.min(maximum, Math.max(-9999, Math.round(Number(character.health.current) || 0)));
  dom.tabStatusExperience.textContent = Math.max(0, Number(character.experience.available) || 0) + " / " + Math.max(0, Number(character.experience.totalGained) || 0);
  dom.tabStatusHp.textContent = current + " / " + maximum;
  dom.tabStatusReverence.textContent = Math.max(0, Number(character.resources.reverence) || 0) + " / 10";
  dom.tabStatusExertion.textContent = Math.max(0, Number(character.resources.exertionCurrent) || 0) + " / " + Math.max(0, Number(character.resources.exertionMax) || 0);
  dom.tabStatusCredits.textContent = Math.max(0, Number(character.resources.creditsBase) || 0).toLocaleString();

  const visible = resourceHudVisible && character.phase === "finalized" && !CAMPAIGN_READ_ONLY_VIEW;
  dom.globalCharacterHud.hidden = !visible;
  document.body.classList.toggle("resource-hud-visible", visible);
  dom.resourceHudToggle?.querySelectorAll("[data-hud-visible]").forEach((button) => {
    const selected = (button.dataset.hudVisible === "true") === resourceHudVisible;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function showSheetSection(section = "identity", { scroll = false } = {}) {
  activeSheetSection = SHEET_SECTIONS.has(section) ? section : "identity";
  const tabbed = isTabbedCharacterLayout();
  dom.characterSheet.dataset.activeSection = activeSheetSection;
  dom.characterSheet.querySelectorAll("[data-sheet-section]").forEach((panel) => {
    panel.hidden = tabbed && panel.dataset.sheetSection !== activeSheetSection;
  });
  dom.sheetSectionTabs.querySelectorAll("[data-sheet-section-tab]").forEach((button) => {
    const selected = button.dataset.sheetSectionTab === activeSheetSection;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  updateLibraryVisibility();

  if (scroll && activeCharacterTab === "sheet") {
    dom.characterSheet.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderCharacterLayout() {
  const tabbed = isTabbedCharacterLayout();
  const creationActive = character.phase !== "finalized" || finalizationPresentationActive;
  document.body.classList.toggle("character-creation-active", creationActive);
  document.body.classList.toggle("campaign-sheet-embed", CAMPAIGN_READ_ONLY_VIEW);
  dom.characterWorkspace.classList.toggle("tabbed-layout", tabbed);
  dom.characterWorkspace.classList.toggle("character-finalized", character.phase === "finalized");
  dom.tabbedToolbar.hidden = !tabbed;
  dom.characterLayoutToggle.querySelectorAll("[data-layout-mode]").forEach((button) => {
    const selected = button.dataset.layoutMode === characterLayoutMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", String(selected));
    button.disabled = creationActive || CAMPAIGN_READ_ONLY_VIEW;
    button.title = creationActive ? "Character creation uses the full sheet. This preference applies after finalization." : "";
  });
  renderTabbedStatus();
  renderVersionUpdate();
  showSheetSection(activeSheetSection);
}
async function loadPlayerAtb({ reload = false } = {}) {
  const ownId = campaignState?.ownCharacterId || campaignCharacterId;
  if (!campaignCode || !ownId || !dom.playerAtbFrame || playerAtbLoading) return;
  const expectedBase = `index.html?embedded=player&campaign=${encodeURIComponent(campaignCode)}&character=${encodeURIComponent(ownId)}`;
  if (!reload && dom.playerAtbFrame.dataset.encounterBase === expectedBase && dom.playerAtbFrame.getAttribute("src")) return;
  playerAtbLoading = true;
  dom.playerAtbStatus.textContent = "Synchronizing your character and opening the live encounter...";
  dom.launchPlayerAtb.disabled = true;
  try {
    await saveCampaignCharacter({ force: true });
    dom.playerAtbFrame.dataset.encounterBase = expectedBase;
    dom.playerAtbFrame.src = `${expectedBase}&view=${Date.now()}`;
  } catch (error) {
    dom.playerAtbStatus.textContent = error.message;
  } finally {
    playerAtbLoading = false;
    dom.launchPlayerAtb.disabled = false;
  }
}

function showCharacterPanel(tab = "sheet") {
  const available = [...dom.tabs.querySelectorAll("[data-character-tab]")].find((button) => button.dataset.characterTab === tab && !button.hidden);
  const previousTab = activeCharacterTab;
  activeCharacterTab = available ? tab : "sheet";
  if (activeCharacterTab === "roster" && previousTab !== "roster") campaignViewerCharacterId = "";
  document.querySelectorAll("[data-character-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.characterPanel !== activeCharacterTab;
  });
  dom.tabs.querySelectorAll("[data-character-tab]").forEach((button) => button.classList.toggle("active", button.dataset.characterTab === activeCharacterTab));
  if (activeCharacterTab === "sheet") renderCharacterLayout();
  if (activeCharacterTab === "roster") renderCampaignRoster();
  if (activeCharacterTab === "atb") void loadPlayerAtb();
  renderTabbedStatus();
  updateLibraryVisibility();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderCharacterNavigation() {
  const linked = Boolean(campaignCode && campaignCharacterId && campaignState);
  const pending = character.campaignLink?.status === "pending";
  const mayJoin = character.phase === "finalized" && !linked;
  const gmView = campaignState?.role === "gm";
  dom.tabs.hidden = false;
  for (const button of dom.tabs.querySelectorAll("[data-character-tab]")) {
    const tab = button.dataset.characterTab;
    if (tab === "sheet" || tab === "settings") button.hidden = false;
    if (tab === "roster" || tab === "atb") button.hidden = !linked || gmView;
  }
  dom.joinCampaignPanel.hidden = gmView || (!mayJoin && !pending);
  dom.joinCampaignForm.hidden = pending;
  const roomCode = linked ? campaignCode : character.campaignLink?.roomCode || "";
  dom.roomCode.hidden = !roomCode;
  dom.roomCodeValue.textContent = roomCode || "----";
  dom.backToMain.hidden = linked;
  dom.settingsLeaveCampaign.disabled = (!linked && !pending) || gmView;
  dom.messageGmForm.hidden = !linked || gmView;
  dom.launchPlayerAtb.disabled = !linked || gmView;
  dom.angilurosSpeedBoost.hidden = !linked || gmView || character.identity.raceId !== "angiluros";
  dom.angilurosSpeedBoost.disabled = character.resources.exertionCurrent < 2;
  dom.campaignPrivateNotes.hidden = !linked || gmView;
  dom.campaignBankCard.hidden = !linked;
  dom.saveAndSyncCharacter.hidden = !linked || gmView;
  dom.saveAndSyncCharacter.disabled = !campaignEditable;
  dom.showCharacterPin.hidden = character.phase !== "finalized"
    || gmView
    || !(campaignPin || character.access?.pcCode)
    || (linked && !campaignEditable);
  dom.printCharacterSheet.disabled = character.phase !== "finalized";
  if (pending) {
    dom.joinCampaignStatus.innerHTML = `<strong>Awaiting GM Approval</strong><span>${escapeHtml(character.campaignLink.campaignName || "Campaign")} | Room ${escapeHtml(roomCode)}</span><p>${escapeHtml(character.campaignLink.message || "The character will link automatically after approval.")}</p>`;
  } else if (!linked) {
    dom.joinCampaignStatus.innerHTML = "";
  }
  if (![...dom.tabs.querySelectorAll("[data-character-tab]")].some((button) => button.dataset.characterTab === activeCharacterTab && !button.hidden)) {
    activeCharacterTab = "sheet";
  }
  renderTabbedStatus();
  showCharacterPanel(activeCharacterTab);
}

function campaignViewerRecords() {
  return campaignState?.characters || [];
}

function openCampaignSheetViewer(recordId) {
  const records = campaignViewerRecords();
  const index = records.findIndex((entry) => entry.id === recordId);
  if (index < 0) return;
  const record = records[index];
  campaignViewerCharacterId = record.id;
  dom.campaignLobby.hidden = true;
  dom.campaignPrivateNotes.hidden = true;
  dom.campaignSheetViewer.hidden = false;
  dom.campaignSheetViewerName.textContent = campaignCharacterName(record).toUpperCase();
  dom.campaignSheetViewerPosition.textContent = `${index + 1} / ${records.length}`;
  dom.previousCampaignSheet.disabled = records.length < 2;
  dom.nextCampaignSheet.disabled = records.length < 2;
  const src = `character.html?campaign=${encodeURIComponent(campaignCode)}&character=${encodeURIComponent(record.id)}&embedded=1&campaignView=1`;
  if (dom.campaignSheetFrame.dataset.characterId !== record.id) {
    dom.campaignSheetFrame.dataset.characterId = record.id;
    dom.campaignSheetFrame.style.height = "900px";
    dom.campaignSheetFrame.src = src;
  }
}

function closeCampaignSheetViewer() {
  campaignViewerCharacterId = "";
  dom.campaignSheetViewer.hidden = true;
  dom.campaignSheetFrame.removeAttribute("src");
  dom.campaignSheetFrame.dataset.characterId = "";
  dom.campaignLobby.hidden = false;
  dom.campaignPrivateNotes.hidden = campaignState?.role === "gm";
}

function stepCampaignSheet(direction) {
  const records = campaignViewerRecords();
  if (records.length < 2) return;
  const current = Math.max(0, records.findIndex((entry) => entry.id === campaignViewerCharacterId));
  openCampaignSheetViewer(records[(current + direction + records.length) % records.length].id);
}

function renderCampaignRoster() {
  if (!campaignState) {
    dom.campaignPrivateNotes.hidden = true;
    dom.campaignSheetViewer.hidden = true;
    return;
  }
  dom.campaignEntryPrompt.hidden = true;
  dom.lobbyCampaignCode.textContent = campaignState.code;
  dom.lobbyCampaignName.textContent = campaignState.name;
  const records = campaignViewerRecords();
  dom.campaignRosterCards.innerHTML = records.length ? records.map((record) => {
    const name = campaignCharacterName(record);
    const player = campaignPlayerName(record);
    return `<article class="campaign-character-card" style="--character-color:${escapeAttribute(record.character?.presentation?.atbColor || "#39e58f")}">
      <div><span>${escapeHtml(player)}</span><strong>${escapeHtml(name)}</strong></div>
      <div class="campaign-character-card-actions">
        <button type="button" data-campaign-view="${record.id}">View Sheet</button>
      </div>
    </article>`;
  }).join("") : '<p class="campaign-empty-roster">No characters have joined this campaign yet.</p>';
  if (campaignViewerCharacterId && records.some((record) => record.id === campaignViewerCharacterId)) {
    openCampaignSheetViewer(campaignViewerCharacterId);
  } else {
    campaignViewerCharacterId = "";
    dom.campaignSheetViewer.hidden = true;
    dom.campaignLobby.hidden = false;
    dom.campaignPrivateNotes.hidden = campaignState.role === "gm";
  }
  refreshPrivateNotes();
}
function applyCampaignPermissions() {
  if (!campaignCode) return;
  const editable = campaignEditable;
  dom.campaignAccessRole.textContent = editable ? (campaignState?.role === "gm" ? "GM EDIT" : "UNLOCKED") : "VIEW ONLY";
  dom.unlockCampaignCharacter.hidden = editable;
  dom.showCharacterPin.hidden = character.phase !== "finalized" || !editable || !(campaignPin || character.access?.pcCode);
  dom.saveAndSyncCharacter.disabled = !editable;
  document.querySelectorAll("#characterSheet input, #characterSheet textarea, #characterSheet select, #characterSheet button, .workflow-bar button, .experience-panel button").forEach((control) => {
    if (control.closest("#campaignAccessBar")) return;
    if (!editable) control.disabled = true;
  });
  document.body.classList.toggle("campaign-view-only", !editable);
}

function showCampaignCharacter(record, { editable = false, token = "", pin = "" } = {}) {
  suppressCampaignSave = true;
  const opened = normalizeCharacter(deepCopy(record.character || {}));
  opened.id = record.id;
  if (CAMPAIGN_READ_ONLY_VIEW) {
    character = opened;
  } else {
    library = [opened];
    activeId = opened.id;
    character = opened;
  }
  campaignBaselineCredits = Number(opened.resources?.creditsBase) || 0;
  campaignBaselineHp = Number.isFinite(Number(opened.health?.current)) ? Number(opened.health.current) : Number(opened.computed?.maximumHp) || 0;
  campaignCharacterId = record.id;
  campaignToken = token || "";
  campaignPin = pin || record.pcCode || opened.access?.pcCode || "";
  campaignEditable = editable;
  campaignDirty = false;
  if (!CAMPAIGN_READ_ONLY_VIEW) {
    localStorage.setItem(ACTIVE_KEY, activeId);
    if (campaignToken) localStorage.setItem(campaignTokenKey(campaignCode, campaignCharacterId), campaignToken);
  }
  opened.campaignLink = { roomCode: campaignCode, campaignName: campaignState.name, status: "linked", requestId: "", message: "" };
  opened.access = { ...(opened.access || {}), pcCode: campaignPin };
  dom.campaignAccessBar.hidden = false;
  dom.activeCampaignLabel.textContent = `${campaignState.name} / ${campaignCode}`;
  dom.characterPicker.closest(".library-bar").hidden = true;
  renderAll();

  updateCampaignCharacterNavigation();
  applyCampaignPermissions();
  refreshPrivateNotes();
  renderCampaignBank();
  refreshCampaignRollPrompt();
  renderCharacterNavigation();
  suppressCampaignSave = false;
}

function showPinDisplay({ title = "PC Code", message = "This PC Code opens the character after it joins a campaign." } = {}) {
  pinModalMode = "display";
  dom.campaignPinTitle.textContent = title;
  dom.campaignPinMessage.textContent = message;
  dom.campaignPinDisplay.textContent = campaignPin || character.access?.pcCode || "----";
  dom.campaignPinDisplay.hidden = false;
  dom.campaignPinEntryWrap.hidden = true;
  dom.campaignPinCancel.hidden = true;
  dom.campaignPinConfirm.textContent = "Continue";
  dom.campaignPinModal.hidden = false;
}

function showPinEntry(characterId) {
  pinModalMode = "unlock";
  pendingPinCharacterId = characterId;
  dom.campaignPinTitle.textContent = "Unlock Character";
  dom.campaignPinMessage.textContent = "Enter this character's PC Code to edit the sheet and spend Experience.";
  dom.campaignPinDisplay.hidden = true;
  dom.campaignPinEntryWrap.hidden = false;
  dom.campaignPinEntry.value = "";
  dom.campaignPinCancel.hidden = false;
  dom.campaignPinConfirm.textContent = "Unlock Character";
  dom.campaignPinModal.hidden = false;
  setTimeout(() => dom.campaignPinEntry.focus(), 60);
}

function privateNoteActions(note) {
  if (note.kind !== "science-choice" || !Array.isArray(note.choices)) return "";
  return `<div class="private-note-actions">${note.choices.map((skill) => `<button type="button" data-science-choice="${escapeAttribute(skill)}" data-note-id="${escapeAttribute(note.id)}">+0.1 ${escapeHtml(skill)}</button>`).join("")}</div>`;
}

function refreshPrivateNotes() {
  const noteCharacterId = campaignState?.ownCharacterId || campaignCharacterId;
  const record = campaignState?.characters?.find((entry) => entry.id === noteCharacterId);
  const localNotes = noteCharacterId === campaignCharacterId ? (character.localInbox || []) : (record?.character?.localInbox || []);
  const notes = [...(record?.privateNotes || []), ...localNotes];
  const unread = notes.filter((note) => note.direction !== "to-gm" && !note.readAt).length;
  dom.privateNoteCount.textContent = `${unread} UNREAD`;
  dom.playerInboxCount.textContent = String(unread);
  dom.privateNotesList.innerHTML = notes.length ? notes.slice().reverse().map((note) => {
    const label = note.kind === "roll-request"
      ? "ROLL REQUEST"
      : note.kind === "damage"
        ? "COMBAT DAMAGE"
      : note.kind === "award"
        ? "GM AWARD"
        : note.kind === "system"
          ? "CAMPAIGN NOTICE"
          : note.direction === "to-gm"
            ? "MESSAGE SENT"
            : "PRIVATE GM MESSAGE";
    return `<article class="private-note ${note.direction !== "to-gm" && !note.readAt ? "unread" : "read"}" data-note-id="${note.id}">
      <small>${label} | ${new Date(note.createdAt).toLocaleString()}</small><p>${escapeHtml(note.message)}</p>${privateNoteActions(note)}<button type="button" data-delete-note="${note.id}">Delete</button>
    </article>`;
  }).join("") : '<p class="campaign-empty-roster">No private notes.</p>';
}

function renderCampaignBank() {
  dom.campaignBankCard.hidden = !campaignState || !campaignCharacterId;
  if (!campaignState || !campaignCharacterId) return;
  const record = campaignState.characters.find((entry) => entry.id === campaignCharacterId);
  const personal = Math.round(Number(record?.character?.resources?.creditsBase) || 0);
  const pool = Math.round(Number(campaignState.shipCredits) || 0);
  const banker = campaignState.characters.find((entry) => entry.id === campaignState.bankerCharacterId);
  const mayUsePool = campaignState.role === "gm" || !campaignState.bankerCharacterId || campaignState.bankerCharacterId === campaignCharacterId;
  dom.campaignBankSummary.textContent = pool.toLocaleString();
  dom.bankPersonalCredits.textContent = personal.toLocaleString();
  dom.bankShipCredits.textContent = pool.toLocaleString();
  dom.bankAuthority.textContent = banker
    ? `${campaignCharacterName(banker)} is the campaign banker.${mayUsePool ? " You may transfer Ship Pool credits." : " You may still give personal credits directly."}`
    : "No banker is assigned. Any unlocked character may transfer Ship Credit Pool funds.";
  if ((Number(record?.character?.resources?.mechanicalExperience) || 0) > 0) {
    dom.bankAuthority.textContent += ` ${Number(record.character.resources.mechanicalExperience)} mechanical XP remains available.`;
  }
  const classId = record?.character?.identity?.classId || "";
  const operations = [
    ["deposit", "Personal to Ship Pool"],
    ["withdraw", "Ship Pool to Personal"],
    ["giftPersonal", "Personal Credits to Another Character"],
    ["giftShip", "Ship Pool Credits to Another Character"],
    ["mechanicalExperience", `Buy Android / Spiddix XP (${classId === "robotics-worker" ? "discounted" : "standard"})`],
  ];
  if (classId === "tactician") operations.push(["giftReverence", "Tactician: Give Reverence"]);
  if (classId === "robotics-worker") operations.push(["roboticsGrant", "Robotics Worker: 1 Reverence for 8 XP"]);
  const previousOperation = dom.bankOperation.value;
  dom.bankOperation.innerHTML = operations.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
  if (operations.some(([value]) => value === previousOperation)) dom.bankOperation.value = previousOperation;
  const targetOperations = ["giftPersonal", "giftShip", "mechanicalExperience", "giftReverence", "roboticsGrant"];
  dom.bankTarget.innerHTML = campaignState.characters.filter((entry) => entry.id !== campaignCharacterId).map((entry) => `<option value="${entry.id}">${escapeHtml(campaignCharacterName(entry))}</option>`).join("");
  const poolRestricted = !mayUsePool && ["deposit", "withdraw", "giftShip"].includes(dom.bankOperation.value);
  dom.bankConfirm.disabled = !campaignEditable || poolRestricted;
  dom.bankConfirm.textContent = !campaignEditable ? "Enter PC Code to Transfer" : poolRestricted ? "Banker Authorization Required" : "Confirm Transfer";
  dom.bankTargetWrap.hidden = !targetOperations.includes(dom.bankOperation.value);
  dom.bankAmountLabel.textContent = dom.bankOperation.value === "giftReverence" || dom.bankOperation.value === "roboticsGrant" ? "Reverence" : "Credits";
  if (dom.bankOperation.value === "roboticsGrant") dom.bankAmount.value = "1";
}

function currentOpenRollRequest() {
  if (!campaignState || !campaignCharacterId) return null;
  return [...(campaignState.rollRequests || [])].reverse().find((request) => !request.closedAt && request.targetIds.includes(campaignCharacterId) && !request.results?.[campaignCharacterId]) || null;
}

function refreshCampaignRollPrompt() {
  activeCampaignRollRequest = currentOpenRollRequest();
  dom.campaignRollPrompt.hidden = !activeCampaignRollRequest || character.phase !== "finalized";
  if (!activeCampaignRollRequest) return;
  dom.campaignRollPromptTitle.textContent = `${activeCampaignRollRequest.attribute} + ${activeCampaignRollRequest.skill}`;
  dom.campaignRollPromptDifficulty.textContent = activeCampaignRollRequest.hideDifficulty
    ? "Difficulty hidden by GM"
    : activeCampaignRollRequest.difficulty === null ? "No Difficulty" : `Difficulty ${activeCampaignRollRequest.difficulty}`;
}

function receiveCampaignState(nextState) {
  campaignState = nextState;
  cacheCampaign(nextState);
  if (!campaignCharacterId) {
    renderCampaignRoster();
    return;
  }
  const remote = nextState.characters.find((entry) => entry.id === campaignCharacterId);
  if (!remote) {
    const removedName = campaignState?.name || character.campaignLink?.campaignName || "the campaign";
    character.campaignLink = { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" };
    campaignEvents?.close();
    campaignEvents = null;
    campaignCode = "";
    campaignState = null;
    campaignCharacterId = "";
    campaignToken = "";
    campaignPin = character.access?.pcCode || "";
    campaignEditable = false;
    dom.campaignAccessBar.hidden = true;
    dom.characterPicker.closest(".library-bar").hidden = false;
    document.body.classList.remove("campaign-view-only");
    saveLibrary("Character saved locally");
    renderAll();
    renderCharacterNavigation();
    showCharacterPanel("sheet");
    notice(`This character is no longer linked to ${removedName}.`, "error");
    return;
  }
  const remoteHp = Number(remote.character?.health?.current);
  if (campaignEditable && (campaignDirty || campaignSaving) && Number.isFinite(remoteHp)) {
    const localHp = Number(character.health?.current);
    const localDelta = Number.isFinite(localHp) && Number.isFinite(campaignBaselineHp) ? localHp - campaignBaselineHp : 0;
    character.health.current = Math.min(maximumHp(), Math.max(-9999, remoteHp + localDelta));
    campaignBaselineHp = remoteHp;
    renderDerived();
    renderTabbedStatus();
  }
  if (!campaignEditable && !campaignDirty) {
    suppressCampaignSave = true;
    character = normalizeCharacter(deepCopy(remote.character));
    campaignBaselineCredits = Number(character.resources?.creditsBase) || 0;
    campaignBaselineHp = Number.isFinite(Number(character.health?.current)) ? Number(character.health.current) : Number(character.computed?.maximumHp) || 0;
    character.id = remote.id;
    library = [character];
    activeId = character.id;
    renderAll();
    applyCampaignPermissions();
    suppressCampaignSave = false;
  } else if (campaignEditable && !campaignDirty && !campaignSaving) {
    const remoteRecordTime = Date.parse(remote.updatedAt || 0);
    const localTime = Date.parse(character.updatedAt || 0);
    if (remoteRecordTime > localTime + 50) {
      suppressCampaignSave = true;
      character = normalizeCharacter(deepCopy(remote.character));
      campaignBaselineCredits = Number(character.resources?.creditsBase) || 0;
      character.id = remote.id;
      library = [character];
      activeId = character.id;
      renderAll();
      applyCampaignPermissions();
      suppressCampaignSave = false;
    }
  }
  refreshPrivateNotes();
  renderCampaignBank();
  refreshCampaignRollPrompt();
  updateCampaignCharacterNavigation();
  renderCharacterNavigation();
}

function connectCampaignState() {
  campaignEvents?.close();
  if (!campaignCode) return;
  campaignEvents = new EventSource(`/campaign-events?code=${encodeURIComponent(campaignCode)}&token=${encodeURIComponent(campaignToken || "")}`);
  campaignEvents.addEventListener("campaign", (event) => receiveCampaignState(JSON.parse(event.data)));
  campaignEvents.addEventListener("campaign-deleted", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.character) character = normalizeCharacter(payload.character);
    const existing = library.findIndex((entry) => entry.id === character.id);
    if (existing >= 0) library[existing] = character;
    else library.push(character);
    activeId = character.id;
    campaignEvents?.close();
    campaignEvents = null;
    campaignCode = "";
    campaignState = null;
    campaignCharacterId = "";
    campaignToken = "";
    campaignEditable = false;
    character.campaignLink = { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" };
    localStorage.removeItem("sa-character-campaign-code");
    saveLibrary("Character preserved locally");
    renderAll();
    renderCharacterNavigation();
    showCharacterPanel("sheet");
    notice(`${payload.campaignName || "The campaign"} was deleted. Your character was preserved locally.`, "error");
  });
  campaignEvents.addEventListener("error", () => { dom.saveStatus.textContent = "Reconnecting to campaign..."; });
}

async function loadCampaign(code, token = "") {
  const normalized = String(code || "").trim().toUpperCase();
  let state;
  try {
    state = await campaignRequest(`/api/campaign/state?code=${encodeURIComponent(normalized)}&token=${encodeURIComponent(token)}`);
    cacheCampaign(state);
  } catch (error) {
    if (error.status === 404) throw error;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(campaignCacheKey(normalized)) || "null")?.campaign || null; } catch { cached = null; }
    if (!cached) throw error;
    state = cached;
    dom.campaignMessage.textContent = "Server unavailable. Showing the most recent local campaign copy.";
  }
  campaignCode = normalized;
  campaignToken = token;
  campaignState = state;
  localStorage.setItem("sa-character-campaign-code", campaignCode);
  connectCampaignState();
  return state;
}

function scheduleJoinStatusCheck(delay = 3000) {
  clearTimeout(joinStatusTimer);
  if (character.campaignLink?.status !== "pending") return;
  joinStatusTimer = setTimeout(checkJoinStatus, delay);
}

async function checkJoinStatus() {
  const link = character.campaignLink || {};
  if (link.status !== "pending" || !link.roomCode || !character.access?.pcCode) return;
  try {
    const result = await campaignRequest("/api/campaign/join/status", {
      method: "POST",
      body: JSON.stringify({
        code: link.roomCode,
        characterId: character.id,
        pcCode: character.access.pcCode,
        character,
      }),
    });
    if (result.status === "approved") {
      campaignCode = result.campaign.code;
      campaignToken = result.token;
      campaignState = result.campaign;
      campaignCharacterId = result.characterId;
      campaignPin = character.access.pcCode;
      localStorage.setItem("sa-character-campaign-code", campaignCode);
      localStorage.setItem(campaignTokenKey(campaignCode, campaignCharacterId), campaignToken);
      const record = campaignState.characters.find((entry) => entry.id === campaignCharacterId);
      if (record) showCampaignCharacter(record, { editable: true, token: campaignToken, pin: campaignPin });
      connectCampaignState();
      notice(`Character approved for ${campaignState.name}.`, "success");
      return;
    }
    if (result.status === "rejected") {
      const rejectionMessage = result.message || "The campaign request was rejected.";
      character.localInbox = [...(character.localInbox || []), {
        id: `local-${Date.now()}`,
        kind: "system",
        direction: "to-character",
        message: rejectionMessage,
        createdAt: new Date().toISOString(),
        readAt: null,
      }].slice(-20);
      character.campaignLink = {
        roomCode: "",
        campaignName: "",
        status: "unlinked",
        requestId: "",
        message: "",
      };
      saveLibrary("Campaign request updated");
      renderCharacterNavigation();
      refreshPrivateNotes();
      notice(rejectionMessage, "error");
      return;
    }
    character.campaignLink.message = result.message || "Awaiting GM approval.";
    saveLibrary("Campaign request pending");
    renderCharacterNavigation();
    scheduleJoinStatusCheck();
  } catch (error) {
    if (error.status === 404) {
      const campaignName = character.campaignLink?.campaignName || "That campaign";
      character.localInbox = [...(character.localInbox || []), {
        id: `local-${Date.now()}`,
        kind: "system",
        direction: "to-character",
        message: `${campaignName} is no longer available. Your character may join another campaign.`,
        createdAt: new Date().toISOString(),
        readAt: null,
      }].slice(-20);
      character.campaignLink = { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" };
      localStorage.removeItem("sa-character-campaign-code");
      saveLibrary("Unavailable campaign link cleared");
      renderCharacterNavigation();
      refreshPrivateNotes();
      notice(`${campaignName} is no longer available. Your character has been released.`, "error");
      return;
    }
    dom.joinCampaignStatus.textContent = error.message;
    scheduleJoinStatusCheck(7000);
  }
}

async function requestCampaignJoin(roomCode) {
  const normalized = String(roomCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!/^[A-Z0-9]{4}$/.test(normalized)) throw new Error("Enter the complete Campaign Code.");
  if (character.phase !== "finalized" || !character.access?.pcCode) throw new Error("Finalize this character and choose a PC Code first.");
  const result = await campaignRequest("/api/campaign/join/request", {
    method: "POST",
    body: JSON.stringify({ code: normalized, pcCode: character.access.pcCode, character }),
  });
  character.campaignLink = {
    roomCode: result.roomCode,
    campaignName: result.campaignName,
    status: "pending",
    requestId: result.requestId,
    message: "Awaiting GM approval.",
  };
  saveLibrary("Campaign request saved locally");
  renderCharacterNavigation();
  scheduleJoinStatusCheck(1200);
}

async function detachCurrentCharacter({ notify = true } = {}) {
  clearTimeout(joinStatusTimer);
  const previousCode = campaignCode || character.campaignLink?.roomCode || "";
  if (campaignCode && campaignCharacterId && campaignToken) {
    await saveCampaignCharacter({ force: true });
    const result = await campaignRequest("/api/campaign/character/leave", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId }),
    });
    character = normalizeCharacter(result.character || character);
    const index = library.findIndex((entry) => entry.id === activeId);
    if (index >= 0) library[index] = character;
  } else if (character.campaignLink?.status === "pending" && previousCode) {
    try {
      await campaignRequest("/api/campaign/join/cancel", {
        method: "POST",
        body: JSON.stringify({ code: previousCode, characterId: character.id, pcCode: character.access?.pcCode || "" }),
      });
    } catch {
      // The GM may already have resolved the request; the local character still detaches safely.
    }
  }
  campaignEvents?.close();
  campaignEvents = null;
  if (previousCode && campaignCharacterId) localStorage.removeItem(campaignTokenKey(previousCode, campaignCharacterId));
  localStorage.removeItem("sa-character-campaign-code");
  campaignCode = "";
  campaignState = null;
  campaignCharacterId = "";
  campaignToken = "";
  campaignPin = character.access?.pcCode || "";
  campaignEditable = false;
  campaignDirty = false;
  character.campaignLink = { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" };
  dom.campaignAccessBar.hidden = true;
  dom.characterPicker.closest(".library-bar").hidden = false;
  document.body.classList.remove("campaign-view-only");
  saveLibrary("Character detached from campaign");
  renderAll();
  renderCharacterNavigation();
  if (notify) notice("Character is no longer linked to a campaign.", "success");
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

function finalizedModifiersActive(characterObject = character) {
  return characterObject.phase === "finalized";
}

function rawClassEffects(characterObject = character) {
  return classById(characterObject.identity.classId).effects || {};
}

function rawRaceEffects(characterObject = character) {
  const definition = raceById(characterObject.identity.raceId);
  const type = definition?.types?.find((entry) => entry.id === characterObject.identity.raceType);
  const baseEffects = definition?.effects || {};
  const typeEffects = type?.effects || {};
  return {
    ...baseEffects,
    ...typeEffects,
    skillBonuses: {
      ...(baseEffects.skillBonuses || {}),
      ...(typeEffects.skillBonuses || {}),
    },
  };
}

function classEffects(characterObject = character) {
  return finalizedModifiersActive(characterObject) ? rawClassEffects(characterObject) : {};
}

function raceEffects(characterObject = character) {
  return finalizedModifiersActive(characterObject) ? rawRaceEffects(characterObject) : {};
}

function selectedRace(characterObject = character) {
  return raceById(characterObject.identity.raceId);
}

function selectedRaceType(characterObject = character) {
  const definition = selectedRace(characterObject);
  return definition?.types?.find((type) => type.id === characterObject.identity.raceType) || null;
}

function raceSelectionComplete(characterObject = character) {
  if (characterObject.identity.raceKind === "other") return Boolean(characterObject.identity.race.trim());
  const definition = selectedRace(characterObject);
  if (!definition) return false;
  return !definition.types?.length || Boolean(selectedRaceType(characterObject));
}

function boxesFilled(attributeKey, characterObject = character) {
  return characterObject.attributes[attributeKey].reduce((sum, value) => sum + Math.max(0, value + 1), 0);
}

function attributeStepCost(attributeKey, row, column, characterObject = character) {
  const base = ATTRIBUTE_COSTS[row]?.[column] ?? 0;
  const raceId = characterObject.identity.raceId;
  if ((raceId === "butchers-of-hellmouth" && attributeKey === "perception")
    || (raceId === "vinolio-paxton" && attributeKey === "willpower")) return base * 2;
  return base;
}

function mechanicalSpiddixAttribute(attributeKey, characterObject = character) {
  return characterObject.identity.raceId === "spiddix" && ["strength", "health", "dexterity"].includes(attributeKey);
}

function attributePointsSpent(characterObject = character) {
  return ATTRIBUTE_DEFS.reduce((total, definition) => total + characterObject.attributes[definition.key].reduce((subtotal, current, row) => {
    if (current < 0) return subtotal;
    return subtotal + Array.from({ length: current + 1 }, (_, column) => attributeStepCost(definition.key, row, column, characterObject)).reduce((sum, cost) => sum + cost, 0);
  }, 0), 0);
}

function attributePointBudget(characterObject = character) {
  return characterObject.identity.raceId === "spiddix" ? 135 : ATTRIBUTE_POINTS;
}

function skillPointBudget(characterObject = character) {
  const base = characterObject.identity.raceId === "spiddix" ? 20 : BASE_SKILL_POINTS;
  const racial = characterObject.identity.raceId === "angiluros" ? 60 : 0;
  return base + racial + characterObject.attributes.intellect.reduce((sum, dieIndex) => {
    return sum + (dieIndex >= 0 ? INTELLECT_SKILL_POINT_BONUSES[dieIndex] : 0);
  }, 0);
}

function skillCreationLevel(skill) {
  return Math.floor((Number(skill?.tenths) || 0) / 10);
}

const SPIDDIX_MECHANICAL_SKILLS = new Set([
  "Athletics/Endurance", "Break Free/Escape", "Catch/Throw", "Climb", "Dodge/Block", "Jump",
  "Lift/Push/Pull", "Lock-picking", "Melee", "Pickpocket", "Projectile", "Stealth/Hide", "Swim", "Wrestle/Disarm",
]);

function mechanicalSpiddixSkill(name, characterObject = character) {
  return characterObject.identity.raceId === "spiddix" && SPIDDIX_MECHANICAL_SKILLS.has(name);
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
  const classBonus = Number(classEffects(characterObject).skillBonuses?.[name]) || 0;
  const raceBonus = Number(raceEffects(characterObject).skillBonuses?.[name]) || 0;
  const chosenBonus = finalizedModifiersActive(characterObject) ? Number(characterObject.creation?.racialSkillGrants?.[name]) || 0 : 0;
  return classBonus + raceBonus + chosenBonus;
}

function skillBonusParts(name, characterObject = character) {
  const parts = [];
  const raceBonus = Number(raceEffects(characterObject).skillBonuses?.[name]) || 0;
  const classBonus = Number(classEffects(characterObject).skillBonuses?.[name]) || 0;
  const chosenBonus = finalizedModifiersActive(characterObject) ? Number(characterObject.creation?.racialSkillGrants?.[name]) || 0 : 0;
  if (raceBonus) parts.push({ value: raceBonus, source: "Race" });
  if (classBonus) parts.push({ value: classBonus, source: "Class" });
  if (chosenBonus) parts.push({ value: chosenBonus, source: "Chosen Race Bonus" });
  return parts;
}

function displayedSkillTenths(name, skill, characterObject = character) {
  return Math.round((Number(skill?.tenths) || 0) + skillBonusTenths(name, characterObject));
}

function ratingText(tenths) {
  return (Math.round(Number(tenths) || 0) / 10).toFixed(1);
}

function attributeFaces(attributeKey, characterObject = character) {
  return (characterObject.attributes[attributeKey] || [])
    .filter((index) => index >= 0)
    .map((index) => DICE_FACES[index] || 0);
}

function formulaDiceValue(formula, characterObject = character) {
  const faces = (formula?.attributes || ["health"]).flatMap((attributeKey) => attributeFaces(attributeKey, characterObject));
  if (formula?.kind === "top") {
    return faces.sort((a, b) => b - a).slice(0, Math.max(1, Number(formula.count) || 1)).reduce((sum, value) => sum + value, 0);
  }
  return faces.reduce((sum, value) => sum + value, 0);
}

function maximumHpDetails(characterObject = character) {
  const race = raceEffects(characterObject);
  const selectedFormula = race.hpFormula;
  const standardHealth = attributeFaces("health", characterObject).reduce((sum, value) => sum + value, 0);
  const racialBase = selectedFormula
    ? formulaDiceValue(selectedFormula, characterObject) + (Number(selectedFormula.bonus) || 0)
    : standardHealth + 20;
  const permanent = Number(characterObject.health.permanentBonus) || 0;
  const classBonus = Number(classEffects(characterObject).maxHpBonus) || 0;
  const parts = [selectedFormula?.label || "Health dice maximum +20"];
  if (classBonus) parts.push(`+${classBonus} ${classById(characterObject.identity.classId).name}`);
  if (permanent) parts.push(`+${permanent} permanent`);
  return { value: racialBase + classBonus + permanent, formula: parts.join(" ") };
}

function maximumHp(characterObject = character) {
  return maximumHpDetails(characterObject).value;
}

function calculatedExertionMax(characterObject = character) {
  return 1 + characterObject.attributes.willpower.filter((dieIndex) => dieIndex >= 3).length;
}

function calculatedMoveSpeedDetails(characterObject = character) {
  const dexterityBonus = characterObject.attributes.dexterity.filter((dieIndex) => dieIndex >= 3).length;
  const race = raceEffects(characterObject);
  const racialBonus = Number(race.moveSpeedModifier) || 0;
  const minimum = Number.isFinite(Number(race.moveSpeedMinimum)) ? Number(race.moveSpeedMinimum) : 0;
  const value = Math.max(minimum, 2 + dexterityBonus + racialBonus);
  const parts = ["Base 2", `+${dexterityBonus} DEX D10+`];
  if (racialBonus) parts.push(`${racialBonus > 0 ? "+" : ""}${racialBonus} ${selectedRace(characterObject)?.name || "Race"}`);
  if (minimum) parts.push(`minimum ${minimum}`);
  return { value, formula: parts.join(" ") };
}

function calculatedMoveSpeed(characterObject = character) {
  return calculatedMoveSpeedDetails(characterObject).value;
}

function damageReductionDetails(characterObject = character) {
  const reduction = raceEffects(characterObject).damageReduction;
  if (!reduction) return { value: 0, formula: "No natural Damage Reduction" };
  const value = reduction.kind === "flat"
    ? Number(reduction.value) || 0
    : formulaDiceValue(reduction, characterObject) + (Number(reduction.bonus) || 0);
  return { value, formula: reduction.label || "Racial Damage Reduction" };
}

function syncDerivedResources(previousMaxHp = null) {
  const nextExertion = calculatedExertionMax();
  const oldExertion = character.resources.exertionMax;
  if (nextExertion > oldExertion) character.resources.exertionCurrent += nextExertion - oldExertion;
  character.resources.exertionMax = nextExertion;
  character.resources.exertionCurrent = Math.round(clamp(character.resources.exertionCurrent, 0, nextExertion));

  const nextMaxHp = maximumHp();
  if (character.health.current === null || (previousMaxHp !== null && character.health.current === previousMaxHp)) character.health.current = nextMaxHp;
  character.health.current = Math.round(clamp(character.health.current, -9999, nextMaxHp));
}

function derivedValues() {
  const initiative = displayedSkillTenths("Initiative", character.skills.Initiative) / 10;
  const awareness = displayedSkillTenths("Awareness", character.skills.Awareness) / 10;
  const mastermind = finalizedModifiersActive() && character.identity.classId === "mastermind";
  return {
    speed: boxesFilled("intellect") + initiative * (mastermind ? 1.5 : 1),
    command: boxesFilled("perception") * 8 + awareness * (mastermind ? 45 : 12),
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
  const attributeBudget = attributePointBudget();
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
  const homePlanetComplete = Boolean(character.identity.homePlanet.trim());
  const raceComplete = raceSelectionComplete();
  const fullIdentityComplete = identityComplete();
  const backstoryComplete = backgroundComplete();
  const raceClassCompatible = !(character.identity.classId === "robotics-worker" && ["android", "spiddix"].includes(character.identity.raceId));
  if (!raceComplete) {
    const definition = selectedRace();
    issues.push(definition?.types?.length ? `Choose a ${definition.name} type.` : "Choose a Race or enter a custom one.");
  }
  if (!homePlanetComplete) issues.push("Choose a Home Planet or enter a custom one.");
  if (!raceClassCompatible) issues.push("Robotics Worker / A.I. Psychologist cannot be combined with Android or Spiddix.");
  if (!fullIdentityComplete) issues.push("Fill in every Identity field and choose a Class.");
  if (!backstoryComplete) issues.push("Write a Character Background before finalizing.");
  if (attributeSpent !== attributeBudget) issues.push(`Attribute allocation is ${attributeSpent - attributeBudget > 0 ? `${attributeSpent - attributeBudget} over` : `${attributeBudget - attributeSpent} short`}.`);
  if (attributeSpent === attributeBudget && skillSpent !== skillBudget) issues.push(`Skill allocation is ${skillSpent - skillBudget > 0 ? `${skillSpent - skillBudget} over` : `${skillBudget - skillSpent} short`}.`);
  if (invalidSkills.size) issues.push(`${invalidSkills.size} skill entr${invalidSkills.size === 1 ? "y is" : "ies are"} invalid.`);
  return {
    attributeSpent,
    skillSpent,
    skillBudget,
    attributeBudget,
    invalidSkills,
    attributesComplete: attributeSpent === attributeBudget,
    skillsComplete: skillSpent === skillBudget,
    raceComplete,
    raceClassCompatible,
    homePlanetComplete,
    ready: raceComplete && raceClassCompatible && homePlanetComplete && fullIdentityComplete && backstoryComplete && attributeSpent === attributeBudget && skillSpent === skillBudget && invalidSkills.size === 0,
    issues,
  };
}

function backgroundComplete() {
  return Boolean(character.notes.trim());
}

function identityComplete() {
  const fields = ["playerName", "characterName", "homePlanet", "sex", "age", "height", "weight", "hair", "eyes", "description"];
  return Boolean(character.identity.classId)
    && raceSelectionComplete()
    && fields.every((field) => String(character.identity[field] ?? "").trim());
}

function renderWorkflowRequirements(items) {
  dom.nextRequirement.innerHTML = items.map(({ label, tone = "" }) => (
    `<span class="workflow-requirement ${tone}" role="listitem">${escapeHtml(label)}</span>`
  )).join("");
  dom.nextRequirement.setAttribute("aria-label", items.map((item) => item.label).join(". "));
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

function stableHash(value) {
  let hash = 0;
  for (const characterValue of String(value || "")) hash = ((hash << 5) - hash + characterValue.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function planetGradient(planet) {
  if (planet === "Earth") return ["#124c9b", "#1d8f55"];
  if (planet === "Mars") return ["#641725", "#f05a5f"];
  const palettes = [
    ["#2a3c86", "#a14fbd"],
    ["#0b6671", "#51a56d"],
    ["#78401c", "#d5ac3f"],
    ["#263f72", "#bd5867"],
    ["#4b3473", "#23a39a"],
    ["#6b213c", "#cb7540"],
    ["#31502e", "#aab83d"],
    ["#263a54", "#718fa9"],
    ["#6b314e", "#397b9e"],
    ["#4f3d20", "#b87348"],
  ];
  return palettes[stableHash(planet) % palettes.length];
}

function renderHomePlanet() {
  dom.homePlanetPicker.innerHTML = [
    '<option value="">(Choose One)</option>',
    ...HOME_PLANETS.map((planet) => `<option value="${escapeAttribute(planet)}">${escapeHtml(planet)}</option>`),
    '<option value="__other__">(Other)</option>',
  ].join("");
  const custom = character.identity.homePlanetKind === "other";
  dom.homePlanetPicker.value = custom ? "__other__" : character.identity.homePlanet;
  dom.homePlanetPicker.disabled = character.phase !== "draft";
  dom.homePlanetCustom.hidden = !custom;
  dom.homePlanetCustom.disabled = character.phase !== "draft";
  dom.homePlanetCustom.value = custom ? character.identity.homePlanet : "";
}

function renderRace() {
  dom.racePicker.innerHTML = [
    '<option value="">(Choose Race)</option>',
    ...RACE_DEFS.map((definition) => `<option value="${definition.id}">${escapeHtml(definition.name)}</option>`),
    '<option value="__other__">(Other)</option>',
  ].join("");
  const custom = character.identity.raceKind === "other";
  dom.racePicker.value = custom ? "__other__" : character.identity.raceId;
  dom.racePicker.disabled = character.phase !== "draft";
  dom.raceCustom.hidden = !custom;
  dom.raceCustom.disabled = character.phase !== "draft";
  dom.raceCustom.value = custom ? character.identity.race : "";

  const definition = selectedRace();
  const types = definition?.types || [];
  dom.raceTypeField.hidden = types.length === 0;
  dom.raceTypePicker.innerHTML = types.length
    ? [
      `<option value="">(Choose ${escapeHtml(definition.name)} Type)</option>`,
      ...types.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`),
    ].join("")
    : "";
  dom.raceTypePicker.value = types.some((type) => type.id === character.identity.raceType)
    ? character.identity.raceType
    : "";
  dom.raceTypePicker.disabled = character.phase !== "draft" || types.length === 0;
}

function renderBackgroundTheme() {
  const panel = $(".notes-panel");
  const planet = character.identity.homePlanet.trim();
  const [start, end] = planet ? planetGradient(planet) : ["#0d2032", "#101923"];
  panel.style.setProperty("--planet-start", start);
  panel.style.setProperty("--planet-end", end);
  panel.classList.toggle("planet-ready", Boolean(planet));
}

function renderFubs() {
  const fubs = character.fubs;
  const available = character.phase === "draft" && fubs.status === "unrolled" && !fubsRollInProgress;
  dom.fubsButton.className = "fubs-button";
  if (fubs.status === "complete") {
    const label = fubs.rolls.length > 1 ? "FUBS rolls" : "FUBS roll";
    dom.fubsButton.textContent = `${label}: ${fubs.rolls.join(" > ")}`;
    dom.fubsButton.classList.add("fubs-complete");
    dom.fubsButton.disabled = false;
  } else if (fubs.status === "not-activated" || character.phase !== "draft") {
    dom.fubsButton.textContent = "FUBS: (Not activated)";
    dom.fubsButton.classList.add("fubs-inactive");
    dom.fubsButton.disabled = true;
  } else {
    dom.fubsButton.textContent = fubsRollInProgress ? "Rolling FUBS..." : "Roll on FUBS Chart";
    dom.fubsButton.classList.add("fubs-unrolled");
    dom.fubsButton.disabled = !available;
  }
  $(".fubs-debug-tools").hidden = !DEBUG_CONTROLS_ENABLED || character.phase !== "draft" || fubsRollInProgress;
}

function renderFields() {
  document.querySelectorAll("[data-field]").forEach((input) => {
    input.value = getPath(character, input.dataset.field) ?? "";
  });
  const callsign = character.identity.characterName || "Unnamed Character";
  const identityColor = character.presentation?.atbColor || "#39e58f";
  dom.identityPanel.style.setProperty("--identity-atb-color", identityColor);
  dom.identityCallsign.style.setProperty("--identity-atb-color", identityColor);
  dom.identityCallsign.textContent = character.phase === "finalized" ? callsign.toUpperCase() : callsign;
  dom.identityCallsign.classList.toggle("finalized-name", character.phase === "finalized");
  renderIdentityTheme();
  renderRace();
  renderHomePlanet();
  renderBackgroundTheme();
  renderFubs();
}

function modifierRulesMarkup(title, rules, tone) {
  const entries = rules?.length ? rules : [tone === "disadvantage" ? "No listed disadvantages." : "No listed advantages."];
  const sign = tone === "disadvantage" ? "-" : "+";
  return `
    <section class="modifier-rule-group ${tone}">
      <h3><span class="modifier-sign ${tone}">${sign}</span>${escapeHtml(title)}</h3>
      <ul>${entries.map((rule) => `<li><span class="modifier-sign ${tone}">${sign}</span><span>${escapeHtml(rule)}</span></li>`).join("")}</ul>
    </section>`;
}

function renderClass() {
  dom.classPicker.innerHTML = CLASS_DEFS.map((definition) => `<option value="${definition.id}">${escapeHtml(definition.name)}</option>`).join("");
  dom.classPicker.value = character.identity.classId;
  dom.classPicker.disabled = character.phase !== "draft";
  const classDefinition = classById(character.identity.classId);
  const raceDefinition = selectedRace();
  const raceType = selectedRaceType();
  const customRace = character.identity.raceKind === "other";
  const raceName = customRace
    ? character.identity.race.trim()
    : raceDefinition
      ? `${raceDefinition.name}${raceType ? ` - ${raceType.name}` : ""}`
      : "";
  const raceAdvantages = [...(raceDefinition?.advantages || []), ...(raceType?.advantages || [])];
  const raceDisadvantages = [...(raceDefinition?.disadvantages || []), ...(raceType?.disadvantages || [])];
  const raceContent = customRace
    ? `<p class="modifier-empty">Custom race rules can be recorded in the Unique Advantages / Disadvantages field below.</p>`
    : raceDefinition
      ? `${modifierRulesMarkup("Racial Advantages", raceAdvantages, "advantage")}${modifierRulesMarkup("Racial Disadvantages", raceDisadvantages, "disadvantage")}`
      : `<p class="modifier-empty">Choose a race to display its 1E advantages and disadvantages.</p>`;
  const classContent = character.identity.classId
    ? `${modifierRulesMarkup("Class Advantage", [classDefinition.summary], "advantage")}${modifierRulesMarkup("Class Disadvantages", [], "disadvantage")}`
    : `<p class="modifier-empty">Choose a class to display its 1E advantage.</p>`;
  dom.automaticModifiers.innerHTML = `
    <article class="modifier-summary race-modifier">
      <strong>${raceName ? escapeHtml(raceName) : "Racial Modifiers"}</strong>
      ${raceContent}
      ${raceDefinition ? `<small>${character.phase === "finalized" ? "Supported finalized effects are active; remaining rules are retained as reference." : "Supported racial effects activate after finalization."}</small>` : ""}
    </article>
    <article class="modifier-summary class-modifier">
      <strong>${escapeHtml(classDefinition.name)}</strong>
      ${classContent}
      ${classDefinition.manual ? `<small>${escapeHtml(classDefinition.manual)}</small>` : ""}
      ${character.identity.classId ? `<small>${character.phase === "finalized" ? "Supported finalized effects are active; remaining rules are retained as reference." : "Class effects activate after finalization."}</small>` : ""}
    </article>`;
}

function renderWorkflow() {
  const validation = draftValidation();
  dom.phaseBadge.className = `phase-badge ${character.phase}`;
  dom.workflowBar.classList.remove("invalid");
  dom.workflowBar.classList.toggle("draft-active", character.phase === "draft");
  dom.finalizeCharacter.hidden = character.phase === "finalized";
  dom.spendExperience.hidden = character.phase !== "finalized";

  if (character.phase === "finalizing") {
    const remaining = character.creation.finalizationQueue.length;
    dom.phaseBadge.textContent = "Finalizing";
    renderWorkflowRequirements([{ label: `Rolling Skill Decimals - ${remaining} remaining`, tone: "warning" }]);
    dom.workflowDetail.textContent = "Each completed result is saved immediately.";
    dom.finalizeCharacter.textContent = "Finalizing...";
    dom.finalizeCharacter.disabled = true;
    return;
  }

  if (character.phase === "finalized") {
    dom.phaseBadge.textContent = character.advancementOpen ? "Advancement" : "Finalized";
    dom.phaseBadge.classList.add("finalized");
    renderWorkflowRequirements([{
      label: character.advancementOpen ? `${character.experience.available} XP available to spend` : "Character Finalized",
      tone: "ready",
    }]);
    dom.workflowDetail.textContent = character.advancementOpen ? "Purchases are permanent. Finish spending when you are done." : "Race, Class, and creation allocations are locked.";
    dom.spendExperience.textContent = character.advancementOpen ? "Finish Spending" : "Spend EXP";
    dom.spendExperience.disabled = Boolean(character.pendingRoll);
    return;
  }

  dom.phaseBadge.textContent = character.legacyDraft ? "Legacy Draft" : "Draft";
  dom.finalizeCharacter.textContent = "Finalize Character";
  dom.finalizeCharacter.disabled = !validation.ready || fubsRollInProgress;
  const requirements = [];
  if (!character.identity.race.trim()) requirements.push({ label: "Choose Race" });
  else if (!validation.raceComplete) {
    const race = selectedRace();
    requirements.push({ label: `Choose ${race?.name || "Race"} Type` });
  }
  if (!character.identity.classId) requirements.push({ label: "Choose Class" });
  if (!validation.raceClassCompatible) requirements.push({ label: "Change incompatible Race or Class", tone: "warning" });
  if (!validation.homePlanetComplete) requirements.push({ label: "Choose Home Planet" });
  if (!validation.attributesComplete) {
    const difference = validation.attributeBudget - validation.attributeSpent;
    requirements.push({
      label: difference > 0 ? `Spend ${difference} Attribute Points` : `Refund ${Math.abs(difference)} Attribute Points`,
      tone: difference < 0 ? "warning" : "",
    });
  } else if (!validation.skillsComplete || validation.invalidSkills.size) {
    const difference = validation.skillBudget - validation.skillSpent;
    requirements.push({
      label: difference > 0 ? `Spend ${difference} Skill Points` : difference < 0 ? `Refund ${Math.abs(difference)} Skill Points` : `Resolve ${validation.invalidSkills.size} invalid skill ${validation.invalidSkills.size === 1 ? "entry" : "entries"}`,
      tone: difference < 0 || validation.invalidSkills.size ? "warning" : "",
    });
  }
  if (!backgroundComplete()) requirements.push({ label: "Write Backstory" });
  else if (character.fubs.status === "unrolled" && !fubsRollInProgress) requirements.push({ label: "Roll on FUBS Chart" });
  if (!identityComplete()) requirements.push({ label: "Fill in Identity" });
  if (validation.ready) requirements.push({ label: "Ready to Finalize", tone: "ready" });
  renderWorkflowRequirements(requirements);
  dom.workflowDetail.textContent = validation.ready
    ? "Finalization is available. Any remaining identity or FUBS steps are shown above."
    : validation.attributesComplete
      ? "All currently available creation steps are shown."
      : `Skills unlock after Attribute allocation is exactly ${validation.attributeBudget} points.`;
  if (!validation.ready && (validation.attributeSpent > validation.attributeBudget || validation.skillSpent > validation.skillBudget || validation.invalidSkills.size)) dom.workflowBar.classList.add("invalid");
}

function renderExperience() {
  const validation = draftValidation();
  const attributeRemaining = character.phase === "draft" ? validation.attributeBudget - validation.attributeSpent : 0;
  const skillRemaining = character.phase === "draft" ? validation.skillBudget - validation.skillSpent : 0;
  dom.attributeBudget.textContent = `${attributeRemaining} / ${validation.attributeBudget}`;
  dom.attributeBudget.className = attributeRemaining === 0 ? "complete" : attributeRemaining < 0 ? "invalid" : "";
  dom.skillBudget.textContent = validation.attributesComplete || character.phase !== "draft"
    ? `${skillRemaining} / ${validation.skillBudget}`
    : "Locked";
  const intellectSkillBonus = character.attributes.intellect.reduce((sum, dieIndex) => sum + (dieIndex >= 0 ? INTELLECT_SKILL_POINT_BONUSES[dieIndex] : 0), 0);
  const baseSkillBudget = character.identity.raceId === "spiddix" ? 20 : BASE_SKILL_POINTS;
  const racialSkillBudget = character.identity.raceId === "angiluros" ? 60 : 0;
  dom.attributeBudgetFormula.textContent = character.identity.raceId === "spiddix"
    ? "Spiddix starting allocation: 135"
    : "Standard starting allocation: 195";
  dom.skillBudgetFormula.textContent = [
    `Base ${baseSkillBudget}`,
    `+${intellectSkillBonus} Intellect`,
    ...(racialSkillBudget ? [`+${racialSkillBudget} Angiluros`] : []),
  ].join(" ");
  dom.xpAvailable.textContent = character.experience.available;
  dom.xpTotal.textContent = character.experience.totalGained;
  const xpGrantParts = [];
  if (finalizedModifiersActive()) {
    const racialXp = Number(rawRaceEffects().xpOnFinalize) || 0;
    const classXp = Number(rawClassEffects().xpOnFinalize) || 0;
    if (racialXp) xpGrantParts.push(`+${racialXp} ${selectedRace()?.name}`);
    if (classXp) xpGrantParts.push(`+${classXp} ${classById(character.identity.classId).name}`);
  }
  const mechanicalXp = Math.max(0, Math.round(Number(character.resources.mechanicalExperience) || 0));
  dom.xpFormula.textContent = xpGrantParts.length
    ? `Unspent / Total Gained | Includes ${xpGrantParts.join(" and ")} finalization grant${mechanicalXp ? ` | ${mechanicalXp} mechanical XP` : ""}`
    : `Unspent / Total Gained${mechanicalXp ? ` | ${mechanicalXp} mechanical XP` : ""}`;
  dom.workflowExperience.textContent = `${character.experience.available} / ${character.experience.totalGained}`;
  dom.workflowAttributeRemaining.textContent = `${attributeRemaining} / ${validation.attributeBudget}`;
  dom.workflowAttributeRemaining.className = attributeRemaining === 0 ? "complete" : attributeRemaining < 0 ? "invalid" : "";
  dom.workflowSkillRemaining.textContent = validation.attributesComplete || character.phase !== "draft"
    ? `${skillRemaining} / ${validation.skillBudget}`
    : "Locked";
  dom.workflowSkillRemaining.className = validation.attributesComplete && skillRemaining === 0 ? "complete" : skillRemaining < 0 ? "invalid" : "";
  const credits = character.resources.creditsBase + (Number(classEffects().creditsBonus) || 0);
  dom.workflowCredits.textContent = credits.toLocaleString();
}

function dieSvg(column, cost, purchased) {
  const shapes = [
    `<path class="die-shape" d="M24 5 43 40H5Z" />`,
    `<path class="die-shape" d="m24 4 18 10v20L24 44 6 34V14Z" /><path class="die-detail" d="m6 14 18 10 18-10M24 24v20" />`,
    `<path class="die-shape" d="m24 3 20 20-20 22L4 23Z" /><path class="die-detail" d="M4 23h40M24 3 13 23l11 22 11-22Z" />`,
    `<path class="die-shape" d="m24 3 20 19-20 23L4 22Z" /><path class="die-detail" d="m24 3 8 17-8 25-8-25ZM4 22l12-2h16l12 2" />`,
    `<path class="die-shape" d="m24 3 17 10 2 20-19 12L5 33l2-20Z" /><path class="die-inner" d="m24 7 11 7-4 13H17l-4-13Z" />`,
  ];
  return `<svg viewBox="-4 -4 56 56" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${shapes[column]}${purchased ? "" : `<text class="die-cost" x="24" y="16">${cost}</text><text class="die-xp" x="24" y="24">XP</text>`}</svg>`;
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
        const cost = attributeStepCost(definition.key, row, column);
        const raceBlocked = character.identity.raceId === "tamalori" && definition.key === "strength" && column === 4;
        const allowedDraft = character.phase === "draft" && (next || column === current) && !lockedFree
          && !(character.identity.raceId === "tamalori" && definition.key === "strength" && column === 4);
        const advancementFunds = mechanicalSpiddixAttribute(definition.key) ? Number(character.resources.mechanicalExperience) || 0 : character.experience.available;
        const allowedAdvancement = advancement && next && advancementFunds >= cost && !raceBlocked;
        const disabled = !interactive || !(allowedDraft || allowedAdvancement);
        let title = purchased ? `${dieName} purchased` : `Purchase ${dieName} for ${cost}`;
        if (lockedFree) title = `${dieName} is a free starting die`;
        else if (character.phase === "draft" && column === current) title = `Refund ${cost} Attribute Points`;
        else if (advancement && next) title = `Spend ${cost} ${mechanicalSpiddixAttribute(definition.key) ? "mechanical XP" : "XP"} to upgrade to ${dieName}`;
        return `<button class="attribute-die ${purchased ? "purchased" : ""} ${next ? "next" : ""}" type="button" data-attribute="${definition.key}" data-row="${row}" data-column="${column}" title="${escapeAttribute(title)}" ${disabled ? "disabled" : ""}>${dieSvg(column, cost, purchased)}</button>`;
      }).join("");
      const wave = current >= 0 ? `<span class="attribute-purchased-wave" aria-hidden="true"></span>` : "";
      return `<div class="attribute-row" style="--progress:${progress}%">${wave}${buttons}</div>`;
    }).join("");
    const attributeRollable = character.phase === "finalized" && !character.advancementOpen && !character.pendingRoll
      && !diceRoller.isActive() && (!campaignCode || campaignEditable);
    const header = attributeRollable
      ? `<button type="button" class="attribute-card-head rollable" data-roll-attribute="${definition.key}" aria-label="Roll ${escapeAttribute(definition.label)} without a Skill"><strong>${definition.label}</strong><span>${diceSummary(definition.key)} | ${boxesFilled(definition.key)} boxes</span></button>`
      : `<div class="attribute-card-head"><strong>${definition.label}</strong><span>${diceSummary(definition.key)} | ${boxesFilled(definition.key)} boxes</span></div>`;
    return `<article class="attribute-card ${character.phase === "draft" && validation.attributeSpent > validation.attributeBudget ? "invalid" : ""}" style="--attribute:${definition.color}">${header}<div class="attribute-rows">${rowMarkup}</div></article>`;
  }).join("");
}

function formatSkillName(name) {
  return escapeHtml(name).replaceAll(" ", "&nbsp;").replaceAll("/", "/<wbr>");
}

function skillRuleIndicators(name) {
  const positive = [];
  const negative = [];
  const add = (tone, label) => {
    const list = tone === "negative" ? negative : positive;
    if (!list.includes(label)) list.push(label);
  };
  const rawRaceBonus = Number(rawRaceEffects().skillBonuses?.[name]) || 0;
  const rawClassBonus = Number(rawClassEffects().skillBonuses?.[name]) || 0;
  const chosenRaceBonus = Number(character.creation?.racialSkillGrants?.[name]) || 0;
  if (rawRaceBonus || chosenRaceBonus) add((rawRaceBonus + chosenRaceBonus) < 0 ? "negative" : "positive", "RACE");
  if (rawClassBonus) add(rawClassBonus < 0 ? "negative" : "positive", "CLASS");

  const raceId = character.identity.raceId;
  const raceType = character.identity.raceType;
  const classId = character.identity.classId;
  if (raceId === "android" && name === "Initiative") add("positive", "ANDROID +5 ROLL");
  if (raceId === "angiluros" && ["Jump", "Climb"].includes(name)) add("positive", "OUTCOME UPGRADE");
  if (raceId === "antropic" && raceType === "fluffy" && name === "Jump") add("positive", "FLUFFY +5");
  if (raceId === "kabuto" && name === "Resist Distress") add("positive", "CRITICAL SUCCESS");
  if (raceId === "skeder" && name === "Jump") add("positive", "SKED'ER +3");
  if (raceId === "xithx" && name === "Stealth/Hide") add("negative", "REMOVE HIGHEST DIE");

  if (classId === "mastermind" && name === "Initiative") add("positive", "SPEED x1.5");
  if (classId === "decker" && name === "Computer Systems") add("positive", "3 FREE REROLLS/SESSION");
  if (classId === "demolition-specialist" && name === "Demolitions") add("positive", "FIRE INTENSITY");
  if (classId === "gunner" && name === "Weapon Systems") add("positive", "EXTRA DEX/INT DIE");
  if (classId === "marine-soldier" && name === "Projectile") add("positive", "TRIPLE FUSION");
  if (classId === "navigator-sensor-tech" && ["Pilot/Helm", "Navigate", "Awareness", "Sensor Systems"].includes(name)) add("positive", "COMBINED CLASS SKILL");
  if (classId === "ninja" && name === "Stealth/Hide") add("positive", "EXERTION +5 EACH");
  if (classId === "peacekeeper" && name === "Negotiation/Persuade") add("positive", "+1D12");
  if (classId === "pirate" && ["Projectile", "Melee"].includes(name)) add("positive", "+3.0 VS UNARMED");
  if (classId === "playboy-minx" && ["Negotiation/Persuade", "Acting/Lie"].includes(name)) add("positive", "COMBINED CLASS SKILL");
  if (classId === "science-officer" && ["Research", "Science/Physics", "Mathematics"].includes(name)) add("positive", "SESSION GROWTH");

  return { positive, negative };
}

function renderSkillRow(name, skill, key) {
  const validation = draftValidation();
  const bonus = skillBonusTenths(name);
  const bonusParts = skillBonusParts(name);
  const displayed = displayedSkillTenths(name, skill);
  const level = skillCreationLevel(skill);
  const advancement = character.phase === "finalized" && character.advancementOpen;
  const draftBuying = character.phase === "draft" && validation.attributesComplete;
  const nextCost = advancement ? advancementSkillCost(skill.tenths) : level + 1;
  const mechanical = mechanicalSpiddixSkill(name);
  const advancementFunds = mechanical ? Number(character.resources.mechanicalExperience) || 0 : character.experience.available;
  const canIncrease = !character.pendingRoll && ((draftBuying && level < MAX_STARTING_SKILL && validation.skillSpent + nextCost <= validation.skillBudget) || (advancement && advancementFunds >= nextCost));
  const canDecrease = character.phase === "draft" && level > 0 && !character.pendingRoll;
  const invalid = character.phase === "draft" && validation.invalidSkills.has(key);
  const locked = !(draftBuying || advancement);
  const rollable = character.phase === "finalized" && !character.advancementOpen && !character.pendingRoll && (!campaignCode || campaignEditable);
  const indicators = skillRuleIndicators(name);
  const markerMarkup = `${indicators.positive.length ? `<b class="skill-rule-sign positive" aria-label="Race or Class bonus">+</b>` : ""}${indicators.negative.length ? `<b class="skill-rule-sign negative" aria-label="Race or Class penalty">-</b>` : ""}`;
  const indicatorDetails = [...indicators.positive, ...indicators.negative].join(" | ");
  return `<div class="skill-row ${BOLD_SKILLS.has(name) ? "key-skill" : ""} ${invalid ? "invalid" : ""} ${locked ? "locked" : ""} ${rollable ? "rollable" : ""}" data-skill-key="${escapeAttribute(key)}" data-search-name="${escapeAttribute(name.toLowerCase())}" ${rollable ? `data-roll-skill="${escapeAttribute(key)}" role="button" tabindex="0" aria-label="Roll ${escapeAttribute(name)}"` : ""}>
    <span class="skill-name" title="${escapeAttribute(name)}"><span>${formatSkillName(name)}</span>${markerMarkup}</span>
    <button class="skill-refund" type="button" data-skill-action="decrease" data-skill-key="${escapeAttribute(key)}" aria-label="Decrease ${escapeAttribute(name)}" ${canDecrease ? "" : "disabled"}>-</button>
    <span class="skill-value"><strong>${ratingText(displayed)}</strong><small>${[bonus ? bonusParts.map((part) => `+${ratingText(part.value)} ${part.source.toUpperCase()}`).join(" ") : "", indicatorDetails].filter(Boolean).join(" | ")}</small></span>
    <button class="skill-buy" type="button" data-skill-action="increase" data-skill-key="${escapeAttribute(key)}" aria-label="Spend ${nextCost} ${advancement && mechanical ? "mechanical XP" : advancement ? "XP" : "Skill Points"} to increase ${escapeAttribute(name)}" ${canIncrease ? "" : "disabled"}><strong>${nextCost}</strong><small>${advancement && mechanical ? "MXP" : advancement ? "XP" : "SP"}</small></button>
  </div>`;
}

function sortedGeneralSkills() {
  const names = [...GENERAL_SKILLS];
  if (skillSortMode === "level") {
    return names.sort((a, b) => displayedSkillTenths(b, character.skills[b]) - displayedSkillTenths(a, character.skills[a]) || a.localeCompare(b));
  }
  if (skillSortMode === "importance") {
    return names.sort((a, b) => {
      const aIndicators = skillRuleIndicators(a);
      const bIndicators = skillRuleIndicators(b);
      const aRank = (BOLD_SKILLS.has(a) ? 2 : 0) + (aIndicators.positive.length || aIndicators.negative.length ? 1 : 0);
      const bRank = (BOLD_SKILLS.has(b) ? 2 : 0) + (bIndicators.positive.length || bIndicators.negative.length ? 1 : 0);
      return bRank - aRank || displayedSkillTenths(b, character.skills[b]) - displayedSkillTenths(a, character.skills[a]) || a.localeCompare(b);
    });
  }
  return names.sort((a, b) => a.localeCompare(b));
}

function renderGeneralSkillCollection() {
  const renderRows = (names) => names.map((name) => renderSkillRow(name, character.skills[name], skillKeyForBase(name))).join("");
  if (skillSortMode === "attribute") {
    dom.generalSkills.classList.add("grouped-skill-list");
    dom.generalSkills.innerHTML = ATTRIBUTE_DEFS.map((definition) => {
      const names = GENERAL_SKILLS.filter((name) => SKILL_ASSOCIATED_ATTRIBUTE[name] === definition.key).sort((a, b) => a.localeCompare(b));
      if (!names.length) return "";
      return `<section class="skill-sort-group" style="--skill-group-color:${definition.color}"><h3>${definition.label}</h3>${renderRows(names)}</section>`;
    }).join("");
    return;
  }
  if (skillSortMode === "basic") {
    dom.generalSkills.classList.add("grouped-skill-list", "basic-skill-groups");
    const physical = GENERAL_SKILLS.filter((name) => PHYSICAL_SKILLS.has(name)).sort((a, b) => a.localeCompare(b));
    const mental = GENERAL_SKILLS.filter((name) => !PHYSICAL_SKILLS.has(name)).sort((a, b) => a.localeCompare(b));
    dom.generalSkills.innerHTML = `<section class="skill-sort-group mental-skill-group"><h3>Mental</h3>${renderRows(mental)}</section><section class="skill-sort-group physical-skill-group"><h3>Physical</h3>${renderRows(physical)}</section>`;
    return;
  }
  dom.generalSkills.classList.remove("grouped-skill-list", "basic-skill-groups");
  dom.generalSkills.innerHTML = renderRows(sortedGeneralSkills());
}

function sortedCustomSkills() {
  const skills = [...character.customSkills];
  if (skillSortMode === "level") {
    return skills.sort((a, b) => b.tenths - a.tenths || (a.name || "Custom Skill").localeCompare(b.name || "Custom Skill"));
  }
  return skills.sort((a, b) => (a.name || "Custom Skill").localeCompare(b.name || "Custom Skill"));
}

function renderSkills() {
  const validation = draftValidation();
  const sheetEditable = !campaignCode || campaignEditable;
  const canManageCustomSkills = sheetEditable && !character.pendingRoll
    && ((character.phase === "draft" && validation.attributesComplete) || character.phase === "finalized");
  dom.skillLockNotice.hidden = validation.attributesComplete || character.phase !== "draft";
  dom.skillSort.value = skillSortMode;
  dom.spacecraftSkills.innerHTML = SPACECRAFT_SKILLS.map((name) => renderSkillRow(name, character.skills[name], skillKeyForBase(name))).join("");
  renderGeneralSkillCollection();
  dom.customSkills.innerHTML = sortedCustomSkills().map((skill) => {
    const key = skillKeyForCustom(skill.id);
    const row = renderSkillRow(skill.name || "Custom Skill", skill, key);
    const editableName = canManageCustomSkills
      ? `<input data-custom-name="${skill.id}" value="${escapeAttribute(skill.name)}" placeholder="Custom Skill" aria-label="Custom skill name" />`
      : `<span class="skill-name" title="${escapeAttribute(skill.name || "Custom Skill")}"><span>${formatSkillName(skill.name || "Custom Skill")}</span></span>`;
    let customRow = row.replace(
      /<span class="skill-name"[\s\S]*?<button class="skill-refund"/,
      `${editableName}
    <button class="skill-refund"`,
    );
    customRow = customRow.replace("<div class=\"skill-row", `<div class="skill-row custom-skill-row ${validation.invalidSkills.has(key) ? "invalid" : ""}`);
    customRow = customRow.replace(/\n\s*<\/div>$/, `
    <button class="row-remove" type="button" data-remove-custom-skill="${skill.id}" aria-label="Remove custom skill" ${(canManageCustomSkills && skill.tenths === 0) ? "" : "disabled"}>-</button>
  </div>`);
    return `<div class="custom-skill-row-wrapper">${customRow}</div>`;
  }).join("");
  dom.customSkillsEmpty.hidden = character.customSkills.length > 0;
  dom.addCustomSkill.disabled = !canManageCustomSkills;
  applySkillSearch();
}

function exertionMeterMarkup(current, maximum, { selectable = false, selected = 0 } = {}) {
  const slots = 5;
  return Array.from({ length: slots }, (_, index) => {
    const capacity = index < maximum;
    const filled = capacity && index < current;
    const spend = filled ? current - index : 0;
    const chosen = selected > 0 && index >= current - selected && index < current;
    const element = selectable ? "button" : "span";
    const attributes = selectable && filled
      ? `type="button" data-exertion-spend="${spend}" aria-label="${chosen ? "Cancel" : "Stage"} ${spend} Exertion"`
      : selectable ? "type=\"button\" disabled" : "aria-hidden=\"true\"";
    return `<${element} class="exertion-unit ${capacity ? "has-capacity" : "inactive"} ${filled ? "filled available" : ""} ${chosen ? "selected" : ""}" ${attributes}><span class="exertion-charge"></span><span class="exertion-capacity"></span></${element}>`;
  }).join("");
}

function renderResources() {
  syncDerivedResources();
  const move = calculatedMoveSpeedDetails();
  const race = raceEffects();
  const classDefinition = classById(character.identity.classId);
  const classCredits = Number(classEffects().creditsBonus) || 0;
  const maxHpCost = Number(race.maxHpReverenceCost) || 6;
  const maxHpForbidden = Boolean(race.forbidMaxHpReverence);
  dom.exertionMeter.innerHTML = exertionMeterMarkup(character.resources.exertionCurrent, character.resources.exertionMax);
  dom.restExertion.disabled = character.resources.exertionCurrent >= character.resources.exertionMax || Boolean(character.pendingRoll);
  dom.exertionFormula.textContent = "Base 1 + each Willpower die at D10 or higher";
  dom.moveSpeedValue.textContent = move.value;
  dom.moveSpeedFormula.textContent = move.formula;
  const finalizedRaceCredits = finalizedModifiersActive() ? Number(rawRaceEffects().creditsOnFinalize) || 0 : 0;
  const finalizedClassCredits = finalizedModifiersActive() ? Number(rawClassEffects().creditsOnFinalize) || 0 : 0;
  dom.creditsValue.textContent = Number(character.resources.creditsBase || 0).toLocaleString();
  const creditParts = ["Awarded and saved credits"];
  if (finalizedRaceCredits) creditParts.push(`includes +${finalizedRaceCredits.toLocaleString()} ${selectedRace()?.name} finalization grant`);
  if (finalizedClassCredits) creditParts.push(`includes +${finalizedClassCredits.toLocaleString()} ${classDefinition.name} finalization grant`);
  dom.creditsFormula.textContent = creditParts.join(" ");
  dom.reverenceCurrent.textContent = character.resources.reverence;
  dom.reverenceMeter.innerHTML = Array.from({ length: 10 }, (_, index) => `<span class="reverence-slot ${index < character.resources.reverence ? "filled" : ""}" aria-hidden="true"></span>`).join("");
  dom.maxHpBonus.disabled = character.phase !== "finalized" || maxHpForbidden || character.resources.reverence < maxHpCost || Boolean(character.pendingRoll);
  dom.maxHpBonus.title = maxHpForbidden ? `${selectedRace()?.name || "This race"} cannot purchase Maximum HP with Reverence.` : `Spend ${maxHpCost} Reverence for +2 Maximum HP`;
  dom.maxHpBonus.querySelector("small").textContent = maxHpForbidden ? "Unavailable to this race" : `Spend ${maxHpCost} for +2 HP`;
  dom.manualAttributeReroll.disabled = character.phase !== "finalized" || character.resources.reverence < 2 || Boolean(character.pendingRoll) || diceRoller.isActive();
  dom.characterAtbColor.value = character.presentation.atbColor;
  dom.speedPreview.style.setProperty("--atb-preview-color", character.presentation.atbColor);
  dom.dramaCardsValue.textContent = Math.max(0, Number(character.resources.dramaCards) || 0);
  const specialActions = [];
  if (character.identity.classId === "marine-soldier") {
    const marineUsed = Boolean(character.session.marineHealingUsed);
    specialActions.push("<button type=\"button\" data-special-action=\"marine-recovery\" " + (marineUsed || diceRoller.isActive() ? "disabled" : "") + ">" + (marineUsed ? "Marine Recovery Used" : "Marine Recovery") + "</button>");
  }
  dom.specialAbilityActions.innerHTML = specialActions.join("");
  dom.specialAbilitiesCard.hidden = specialActions.length === 0;
  renderTabbedStatus();
}

function attributeDiceSides(attributeKey) {
  return character.attributes[attributeKey].filter((value) => value >= 0).map((value) => DICE_FACES[value]);
}

function highestAttributeDie(attributeKey) {
  return Math.max(0, ...attributeDiceSides(attributeKey));
}

function combinedSkillBonusTenths(name, skill) {
  let total = displayedSkillTenths(name, skill);
  const classId = character.identity.classId;
  if (classId === "navigator-sensor-tech") {
    if (name === "Pilot/Helm") total += displayedSkillTenths("Navigate", character.skills.Navigate);
    if (name === "Navigate") total += displayedSkillTenths("Pilot/Helm", character.skills["Pilot/Helm"]);
    if (name === "Awareness") total += displayedSkillTenths("Sensor Systems", character.skills["Sensor Systems"]);
    if (name === "Sensor Systems") total += displayedSkillTenths("Awareness", character.skills.Awareness);
  }
  if (classId === "playboy-minx") {
    if (name === "Negotiation/Persuade") total += displayedSkillTenths("Acting/Lie", character.skills["Acting/Lie"]);
    if (name === "Acting/Lie") total += displayedSkillTenths("Negotiation/Persuade", character.skills["Negotiation/Persuade"]);
  }
  return total;
}

function rollDicePool(attributeKey, skillName) {
  let sides = attributeDiceSides(attributeKey);
  const classId = character.identity.classId;
  const raceId = character.identity.raceId;
  if (classId === "ambassador-spy" && attributeKey === "charisma") sides.push(highestAttributeDie("luck"));
  if (classId === "ambassador-spy" && attributeKey === "luck") sides.push(highestAttributeDie("charisma"));
  if (classId === "gunner" && skillName === "Weapon Systems") {
    sides.push(Math.max(highestAttributeDie("dexterity"), highestAttributeDie("intellect")));
  }
  if (classId === "science-officer" && attributeKey === "perception") sides.push(...attributeDiceSides("intellect"));
  if (classId === "peacekeeper" && skillName === "Negotiation/Persuade") sides.push(12);
  if (classId === "smuggler" && attributeKey === "charisma") sides.push(...attributeDiceSides("intellect").sort((a, b) => b - a).slice(0, 2));
  if (classId === "smuggler" && attributeKey === "intellect") sides.push(...attributeDiceSides("charisma").sort((a, b) => b - a).slice(0, 2));
  if (raceId === "flavilin" && attributeKey === "perception") sides.push(12);
  if (raceId === "nordic-flaxen" && attributeKey === "charisma") sides.push(...attributeDiceSides("luck"));
  if (raceId === "tamalori" && attributeKey === "dexterity") sides = [...sides, ...sides];
  if (raceId === "krax-gny-vtek" && attributeKey === "dexterity" && maximumHp() - character.health.current >= 5) sides = sides.slice(0, 3);
  if (raceId === "butchers-of-hellmouth" && attributeKey === "perception") sides = sides.slice(0, 2);
  return sides.filter(Boolean);
}

function rollRuleProfile() {
  const resolved = skillCheckResolvedSkill();
  const attributeKey = skillCheck?.attributeKey || "";
  const skillName = resolved?.name || "";
  const raceId = character.identity.raceId;
  const classId = character.identity.classId;
  return {
    raceId,
    classId,
    skillName,
    attributeKey,
    noFusion: (raceId === "garmoc" && ["charisma", "intellect"].includes(attributeKey))
      || (raceId === "yetuak-zune" && attributeKey === "charisma"),
    fusionLimit: raceId === "draco-prime" ? 1 : Infinity,
    chainFusion: raceId === "horus" && attributeKey === "perception",
    tripleFusion: classId === "marine-soldier" && skillName === "Projectile",
  };
}

function fusionResults(results, profile = {}) {
  if (profile.noFusion) return { fusions: [], leftovers: [...results] };
  const groups = new Map();
  results.forEach((value, index) => {
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(index);
  });
  const used = new Set();
  const fusions = [];
  [...groups.entries()].sort((a, b) => b[0] - a[0]).forEach(([value, indices]) => {
    if (fusions.length >= (profile.fusionLimit ?? Infinity)) return;
    if (profile.tripleFusion && indices.length >= 3) {
      const sourceIndices = indices.slice(0, 3);
      sourceIndices.forEach((index) => used.add(index));
      fusions.push({ id: uid(), value: value * 3, sourceValue: value, sourceIndices });
      indices = indices.slice(3);
    }
    for (let offset = 0; offset + 1 < indices.length; offset += 2) {
      if (fusions.length >= (profile.fusionLimit ?? Infinity)) break;
      const sourceIndices = [indices[offset], indices[offset + 1]];
      sourceIndices.forEach((index) => used.add(index));
      fusions.push({
        id: uid(),
        value: value * 2,
        sourceValue: value,
        sourceIndices,
      });
    }
  });
  let leftovers = results.filter((_, index) => !used.has(index));
  if (profile.chainFusion) {
    const values = [...fusions.map((fusion) => ({ ...fusion })), ...leftovers.map((value, index) => ({ id: uid(), value, sourceValue: value, sourceIndices: [index], loose: true }))];
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let left = 0; left < values.length; left += 1) {
        for (let right = left + 1; right < values.length; right += 1) {
          if (values[left].value !== values[right].value) continue;
          const merged = {
            id: uid(),
            value: values[left].value * 2,
            sourceValue: values[left].value,
            sourceIndices: [...values[left].sourceIndices, ...values[right].sourceIndices],
          };
          values.splice(right, 1);
          values.splice(left, 1, merged);
          changed = true;
          break outer;
        }
      }
    }
    return { fusions: values.filter((value) => !value.loose), leftovers: values.filter((value) => value.loose).map((value) => value.value) };
  }
  return { fusions, leftovers };
}

function skillOutcome(score, difficulty) {
  if (!Number.isFinite(difficulty) || difficulty <= 0) return "";
  if (score >= difficulty * 2) return "Critical Success";
  if (score >= difficulty) return "Success";
  if (score <= Math.floor(difficulty / 2)) return "Critical Failure";
  return "Failure";
}

function adjustedSkillOutcome(score, difficulty) {
  let outcome = skillOutcome(score, difficulty);
  if (!outcome || !skillCheck) return outcome;
  const profile = rollRuleProfile();
  if (profile.raceId === "angiluros" && ["Jump", "Climb"].includes(profile.skillName)) {
    if (outcome === "Success") outcome = "Critical Success";
    if (outcome === "Critical Failure") outcome = "Failure";
  }
  if (profile.raceId === "kabuto" && profile.skillName === "Resist Distress" && ["Success", "Critical Success"].includes(outcome)) {
    outcome = "Critical Success";
  }
  if (profile.raceId === "skeder" && profile.attributeKey === "charisma" && outcome !== "Critical Success") outcome = "Failure";
  return outcome;
}

function skillCheckAttribute() {
  return ATTRIBUTE_DEFS.find((definition) => definition.key === skillCheck?.attributeKey) || null;
}

function skillCheckResolvedSkill() {
  if (!skillCheck) return null;
  if (skillCheck.attributeOnly) {
    const definition = ATTRIBUTE_DEFS.find((entry) => entry.key === skillCheck.attributeKey);
    return definition ? { name: `${definition.label} Check`, skill: { tenths: 0 } } : null;
  }
  return resolveSkill(character, skillCheck.skillKey);
}

function skillCheckPoolLabel() {
  if (!skillCheck) return "No dice";
  const labels = skillCheck.activeSides.map((sides) => `D${sides}`);
  for (let index = 0; index < skillCheck.stagedExertion; index += 1) labels.push("D12");
  return labels.length ? labels.join(" + ") : "No dice";
}

function renderSkillExertion() {
  if (!skillCheck) return;
  const resolved = skillCheckResolvedSkill();
  const physical = ["strength", "dexterity", "health", "willpower"].includes(skillCheck.attributeKey)
    || (character.identity.raceId === "spiddix" && skillCheck.attributeKey === "intellect")
    || (character.identity.classId === "ninja" && resolved?.name === "Stealth/Hide");
  dom.skillExertionBlock.hidden = !physical;
  if (!physical) {
    skillCheck.stagedExertion = 0;
    return;
  }
  const ninjaStealth = character.identity.classId === "ninja" && resolved?.name === "Stealth/Hide";
  dom.skillExertionReadout.textContent = skillCheck.stagedExertion
    ? `Stage ${skillCheck.stagedExertion}: +${skillCheck.stagedExertion}D12 and +${skillCheck.stagedExertion * (ninjaStealth ? 5 : 1)}`
    : skillCheck.committedExertion
      ? `${skillCheck.committedExertion} already committed`
      : "None selected";
  dom.skillExertionMeter.innerHTML = exertionMeterMarkup(
    character.resources.exertionCurrent,
    character.resources.exertionMax,
    { selectable: true, selected: skillCheck.stagedExertion },
  );
}

function renderSkillSetup() {
  if (!skillCheck) return;
  const definition = skillCheckAttribute();
  const resolved = skillCheckResolvedSkill();
  if (!definition || !resolved) return;
  dom.skillCheckKicker.textContent = skillCheck.attributeOnly ? "Attribute Check" : "Attribute + Skill Check";
  dom.skillCheckTitle.textContent = resolved.name;
  dom.skillCheckSubtitle.textContent = skillCheck.attributeOnly
    ? "Roll the Attribute by itself, then resolve it physically or enter your completed Score."
    : "Choose the dice, then roll physically or enter your completed Score.";
  dom.changeSkillAttribute.hidden = Boolean(skillCheck.attributeOnly);
  dom.skillSetupStage.classList.toggle("attribute-only", Boolean(skillCheck.attributeOnly));
  dom.skillAttributeStage.hidden = true;
  dom.skillSetupStage.hidden = false;
  dom.skillResultStage.hidden = true;
  dom.selectedAttributeName.textContent = definition.label;
  dom.selectedAttributeName.style.color = definition.color;
  dom.selectedDicePool.textContent = skillCheckPoolLabel();
  dom.selectedSkillBonus.textContent = skillCheck.attributeOnly ? "NO SKILL" : `+${ratingText(combinedSkillBonusTenths(resolved.name, resolved.skill))}`;
  dom.skillDifficulty.value = skillCheck.difficulty;
  dom.manualSkillScore.value = "";
  renderSkillExertion();
  dom.selectedDicePool.textContent = skillCheckPoolLabel();
}

function renderSkillAttributeChoices() {
  if (!skillCheck) return;
  const resolved = skillCheckResolvedSkill();
  dom.skillCheckKicker.textContent = "Attribute + Skill Check";
  dom.changeSkillAttribute.hidden = false;
  dom.skillSetupStage.classList.remove("attribute-only");
  dom.skillCheckTitle.textContent = resolved?.name || "Skill Check";
  dom.skillCheckSubtitle.textContent = "Choose the Attribute that best matches the action.";
  dom.skillAttributeChoices.innerHTML = ATTRIBUTE_DEFS.map((definition) => `
    <button class="skill-attribute-choice" type="button" data-skill-attribute="${definition.key}" style="--attribute:${definition.color}">
      <strong>${escapeHtml(definition.label)}</strong>
      <small>${escapeHtml(diceSummary(definition.key))}</small>
    </button>`).join("");
  dom.skillAttributeStage.hidden = false;
  dom.skillSetupStage.hidden = true;
  dom.skillResultStage.hidden = true;
}

function openSkillCheck(skillKey) {
  if ((campaignCode && !campaignEditable) || character.phase !== "finalized" || character.advancementOpen || character.pendingRoll || diceRoller.isActive()) return;
  const resolved = resolveSkill(character, skillKey);
  if (!resolved) return;
  skillCheck = {
    skillKey,
    attributeOnly: false,
    attributeKey: null,
    difficulty: "",
    stagedExertion: 0,
    committedExertion: 0,
    preservedFusions: [],
    newFusions: [],
    selectedFusionIds: new Set(),
    activeSides: [],
    currentRollSides: [],
    result: null,
    manual: false,
    freeRerollUsed: false,
    lastResults: [],
  };
  dom.skillCheckModal.hidden = false;
  document.body.classList.add("skill-check-open");
  renderSkillAttributeChoices();
}

function openAttributeCheck(attributeKey) {
  if ((campaignCode && !campaignEditable) || character.phase !== "finalized" || character.advancementOpen || character.pendingRoll || diceRoller.isActive()) return;
  const definition = ATTRIBUTE_DEFS.find((entry) => entry.key === attributeKey);
  if (!definition) return;
  skillCheck = {
    skillKey: null,
    attributeOnly: true,
    attributeKey,
    difficulty: "",
    stagedExertion: 0,
    committedExertion: 0,
    preservedFusions: [],
    newFusions: [],
    selectedFusionIds: new Set(),
    activeSides: rollDicePool(attributeKey, ""),
    currentRollSides: [],
    result: null,
    manual: false,
    freeRerollUsed: false,
    lastResults: [],
  };
  dom.skillCheckModal.hidden = false;
  document.body.classList.add("skill-check-open");
  renderSkillSetup();
}

function closeSkillCheck() {
  if (diceRoller.isActive()) return;
  skillCheck = null;
  dom.skillCheckModal.hidden = true;
  document.body.classList.remove("skill-check-open", "skill-roll-active");
}

function selectSkillAttribute(attributeKey) {
  if (!skillCheck || !character.attributes[attributeKey]) return;
  skillCheck.attributeKey = attributeKey;
  skillCheck.stagedExertion = 0;
  const resolved = skillCheckResolvedSkill();
  skillCheck.activeSides = rollDicePool(attributeKey, resolved?.name || "");
  renderSkillSetup();
}

function commitSkillCheckCosts() {
  if (!skillCheck) return false;
  const spend = skillCheck.stagedExertion;
  if (spend > character.resources.exertionCurrent) {
    notice("The selected Exertion is no longer available.", "error");
    renderSkillSetup();
    return false;
  }
  if (spend > 0) {
    character.resources.exertionCurrent -= spend;
    skillCheck.committedExertion += spend;
    for (let index = 0; index < spend; index += 1) skillCheck.activeSides.push(12);
    skillCheck.stagedExertion = 0;
    queueSave();
    renderResources();
  }
  return true;
}

function showSkillResult({ score, equation, outcome, newFusions = [], manual = false, diceResults = [] }) {
  if (!skillCheck) return;
  skillCheck.result = score;
  skillCheck.newFusions = newFusions;
  skillCheck.selectedFusionIds = new Set();
  skillCheck.manual = manual;
  dom.skillAttributeStage.hidden = true;
  dom.skillSetupStage.hidden = true;
  dom.skillResultStage.hidden = false;
  dom.skillResultLabel.textContent = outcome || "Final Score";
  dom.skillResultScore.textContent = formatNumber(score);
  dom.skillResultEquation.textContent = equation;
  dom.skillResultOutcome.textContent = outcome;
  dom.skillResultOutcome.className = outcome.toLowerCase().replaceAll(" ", "-");
  const resultSides = skillCheck.currentRollSides || [];
  dom.skillDiceTypes.textContent = manual
    ? "MANUAL ROLL"
    : diceResults.length
      ? `DICE: ${diceResults.map((result, index) => `D${resultSides[index] || "?"}`).join("  |  ")}`
      : "NO ATTRIBUTE DICE";
  dom.skillDiceValues.textContent = manual
    ? `ENTERED SCORE: ${formatNumber(score)}`
    : diceResults.length
      ? `VALUES: ${diceResults.join("  |  ")}`
      : "VALUES: NONE";
  const allFusions = [...skillCheck.preservedFusions.map((fusion) => ({ ...fusion, locked: true })), ...newFusions];
  dom.skillFusionResults.hidden = manual || allFusions.length === 0;
  dom.skillFusionChoices.innerHTML = allFusions.map((fusion) => `
    <button type="button" class="fusion-choice ${fusion.locked ? "locked selected" : ""}" data-fusion-id="${fusion.id}" ${(fusion.locked || skillCheck.preservedFusions.length) ? "disabled" : ""}>
      <span>${Array.from({ length: fusion.sourceIndices.length }, () => fusion.sourceValue).join(" + ")}</span>
      <strong>${fusion.value}</strong>
      <small>${fusion.locked ? "Preserved" : skillCheck.preservedFusions.length ? "One pair already kept" : "Keep on reroll"}</small>
    </button>`).join("");
  renderFusionSelectionState();
  const rerollCost = reverenceRerollCost();
  dom.rerollSkillCheck.disabled = character.resources.reverence < rerollCost;
  dom.rerollSkillCheck.textContent = character.resources.reverence >= rerollCost
    ? `Spend ${rerollCost} Reverence to Reroll`
    : `${rerollCost} Reverence Required`;
  const freeRule = manual ? null : availableFreeReroll();
  dom.freeRuleReroll.hidden = !freeRule;
  dom.freeRuleReroll.textContent = freeRule?.label || "Use Free Reroll";
  submitCampaignRollResult({ score, outcome, manual, diceResults });
}

async function submitCampaignRollResult({ score, outcome, manual, diceResults }) {
  const requestId = skillCheck?.campaignRequestId;
  if (!requestId || !campaignCode || !campaignCharacterId || !campaignToken || skillCheck.campaignSubmitted) return;
  skillCheck.campaignSubmitted = true;
  try {
    await campaignRequest("/api/campaign/roll/respond", {
      method: "POST",
      body: JSON.stringify({
        code: campaignCode,
        token: campaignToken,
        requestId,
        characterId: campaignCharacterId,
        score,
        outcome,
        mode: manual ? "manual" : "automatic",
        diceResults,
      }),
    });
    notice("Roll result sent to the GM.", "success");
  } catch (error) {
    skillCheck.campaignSubmitted = false;
    notice(error.message, "error");
  }
 }

function renderFusionSelectionState() {
  if (!skillCheck) return;
  dom.skillFusionChoices.querySelectorAll("[data-fusion-id]").forEach((button) => {
    if (button.classList.contains("locked")) return;
    button.classList.toggle("selected", skillCheck.selectedFusionIds.has(button.dataset.fusionId));
  });
  const preserved = skillCheck.preservedFusions[0];
  const selectedId = [...skillCheck.selectedFusionIds][0];
  const selected = skillCheck.newFusions.find((fusion) => fusion.id === selectedId);
  dom.skillFusionWarning.classList.toggle("active", Boolean(preserved || selected));
  if (preserved) {
    dom.skillFusionWarning.textContent = `Fusion ${preserved.value} is preserved. This reroll rolls ${preserved.sourceIndices.length} fewer dice.`;
  } else if (selected) {
    dom.skillFusionWarning.textContent = `Keeping fusion ${selected.value}: this reroll will roll ${selected.sourceIndices.length} fewer dice.`;
  } else {
    dom.skillFusionWarning.textContent = "No fusion selected. The full dice pool will be rerolled.";
  }
}

function resolvePhysicalSkillRoll(results) {
  if (!skillCheck) return;
  skillCheck.lastResults = [...results];
  const profile = rollRuleProfile();
  let adjustedResults = [...results];
  if (profile.raceId === "garmoc" && ["charisma", "intellect"].includes(profile.attributeKey)) {
    adjustedResults = adjustedResults.map((value) => Math.min(8, value));
  }
  if (profile.raceId === "everliving-brethren" && profile.attributeKey === "perception" && adjustedResults.length) {
    const highestIndex = adjustedResults.indexOf(Math.max(...adjustedResults));
    adjustedResults.splice(highestIndex, 1);
  }
  if (profile.raceId === "xithx" && profile.skillName === "Stealth/Hide" && adjustedResults.length) {
    const highestIndex = adjustedResults.indexOf(Math.max(...adjustedResults));
    adjustedResults.splice(highestIndex, 1);
  }
  const analyzed = fusionResults(adjustedResults, profile);
  const values = [
    ...skillCheck.preservedFusions.map((fusion) => fusion.value),
    ...analyzed.fusions.map((fusion) => fusion.value),
    ...analyzed.leftovers,
  ].sort((a, b) => b - a);
  const top = values.slice(0, 2);
  const diceTotal = top.reduce((sum, value) => sum + value, 0);
  const resolved = skillCheckResolvedSkill();
  const skillBonus = skillCheck.attributeOnly ? 0 : combinedSkillBonusTenths(resolved.name, resolved.skill) / 10;
  let flatBonus = skillCheck.committedExertion;
  if (profile.classId === "ninja" && profile.skillName === "Stealth/Hide") flatBonus += skillCheck.committedExertion * 4;
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy") {
    if (profile.attributeKey === "strength") flatBonus -= 2;
    if (profile.skillName === "Jump") flatBonus += 5;
  }
  if (profile.raceId === "skeder" && profile.skillName === "Jump") flatBonus += 3;
  if (profile.raceId === "android" && profile.skillName === "Initiative") flatBonus += 5;
  if (profile.raceId === "epoc" && ["strength", "health", "dexterity", "perception"].includes(profile.attributeKey)) {
    flatBonus -= adjustedResults.filter((value) => value === 1).length;
  }
  let unusedDiceBonus = 0;
  if (profile.classId === "other" && character.creation.classAttributeChoice === profile.attributeKey) {
    unusedDiceBonus = values.slice(2).reduce((sum, value) => sum + value, 0) / 10;
  }
  const score = diceTotal + skillBonus + flatBonus + unusedDiceBonus;
  const difficulty = Number(skillCheck.difficulty);
  const outcome = adjustedSkillOutcome(score, difficulty);
  const equationParts = [`Top two: ${top.length ? top.join(" + ") : "0"}`];
  if (!skillCheck.attributeOnly) equationParts.push(`Skill +${ratingText(combinedSkillBonusTenths(resolved.name, resolved.skill))}`);
  if (skillCheck.committedExertion) equationParts.push(`Exertion +${profile.classId === "ninja" && profile.skillName === "Stealth/Hide" ? skillCheck.committedExertion * 5 : skillCheck.committedExertion}`);
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy" && profile.attributeKey === "strength") equationParts.push("Fluffy Strength -2");
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy" && profile.skillName === "Jump") equationParts.push("Fluffy Jump +5");
  if (profile.raceId === "skeder" && profile.skillName === "Jump") equationParts.push("Sked'er Jump +3");
  if (profile.raceId === "android" && profile.skillName === "Initiative") equationParts.push("Android Initiative +5");
  if (unusedDiceBonus) equationParts.push(`Unused dice +${formatNumber(unusedDiceBonus)}`);
  showSkillResult({
    score,
    equation: equationParts.join(" | "),
    outcome,
    newFusions: analyzed.fusions,
    diceResults: adjustedResults,
  });
}

function calculateManualSkillResult() {
  if (!skillCheck) return;
  const score = Number(dom.manualSkillScore.value);
  if (dom.manualSkillScore.value.trim() === "" || !Number.isFinite(score)) {
    notice("Enter the completed Final Score from your physical dice.", "error");
    dom.manualSkillScore.focus();
    return;
  }
  if (!commitSkillCheckCosts()) return;
  skillCheck.difficulty = dom.skillDifficulty.value;
  const outcome = adjustedSkillOutcome(score, Number(skillCheck.difficulty));
  const committed = skillCheck.committedExertion ? ` | ${skillCheck.committedExertion} Exertion committed` : "";
  showSkillResult({
    score,
    equation: `Manual Final Score${committed}`,
    outcome,
    manual: true,
    diceResults: [],
  });
}

function rollSkillCheck() {
  if (!skillCheck || !skillCheck.attributeKey) return;
  skillCheck.difficulty = dom.skillDifficulty.value;
  if (!commitSkillCheckCosts()) return;
  skillCheck.currentRollSides = [...skillCheck.activeSides];
  if (!skillCheck.currentRollSides.length) {
    resolvePhysicalSkillRoll([]);
    return;
  }
  const resolved = skillCheckResolvedSkill();
  dom.skillCheckModal.hidden = true;
  document.body.classList.add("skill-roll-active");
  diceRoller.rollPool({
    sides: skillCheck.currentRollSides,
    title: skillCheck.attributeOnly ? resolved.name : `${resolved.name} + ${skillCheckAttribute().label}`,
    subtitle: skillCheck.attributeOnly
      ? `${skillCheckPoolLabel()} | Use the top two`
      : `${skillCheckPoolLabel()} | Top two + ${ratingText(combinedSkillBonusTenths(resolved.name, resolved.skill))}`,
    fusion: true,
    onResolved: () => {},
    onSettled: (results) => {
      document.body.classList.remove("skill-roll-active");
      diceRoller.stop();
      dom.skillCheckModal.hidden = false;
      resolvePhysicalSkillRoll(results);
    },
  });
}

function reverenceRerollCost() {
  return character.identity.raceId === "spiddix" && skillCheck?.attributeKey === "intellect" ? 1 : 2;
}

function beginSkillReroll() {
  const cost = reverenceRerollCost();
  if (!skillCheck || character.resources.reverence < cost) return;
  character.resources.reverence -= cost;
  if (!skillCheck.manual) {
    const selected = skillCheck.preservedFusions.length
      ? []
      : skillCheck.newFusions.filter((fusion) => skillCheck.selectedFusionIds.has(fusion.id)).slice(0, 1);
    if (selected.length) skillCheck.preservedFusions = selected;
    const removed = new Set(selected.flatMap((fusion) => fusion.sourceIndices));
    skillCheck.activeSides = skillCheck.currentRollSides.filter((_, index) => !removed.has(index));
  } else {
    const resolved = skillCheckResolvedSkill();
    skillCheck.activeSides = [
      ...rollDicePool(skillCheck.attributeKey, resolved?.name || ""),
      ...Array.from({ length: skillCheck.committedExertion }, () => 12),
    ];
  }
  skillCheck.newFusions = [];
  skillCheck.selectedFusionIds = new Set();
  skillCheck.stagedExertion = 0;
  skillCheck.result = null;
  skillCheck.manual = false;
  queueSave();
  renderResources();
  renderSkillSetup();
  notice(skillCheck.preservedFusions.length
    ? `${cost} Reverence spent. One fused pair remains and two fewer dice will be rerolled.`
    : `${cost} Reverence spent. The full dice pool will be rerolled.`, "success");
}

function animateSpeedPreview(now) {
  const speed = Math.max(0, Number(speedPreviewValue) || 0);
  let progress = 0;
  let ready = false;
  if (speed > 0) {
    const fillDuration = 100000 / speed;
    const cycleDuration = fillDuration + 2000;
    const elapsed = Math.max(0, now - speedPreviewStartedAt) % cycleDuration;
    ready = elapsed >= fillDuration;
    progress = ready ? 1 : Math.min(1, elapsed / fillDuration);
  }
  dom.speedPreviewFill.style.transform = `scaleX(${progress})`;
  dom.speedPreview.classList.toggle("ready", ready);
  dom.speedPreview.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  speedPreviewFrame = requestAnimationFrame(animateSpeedPreview);
}

function syncSpeedPreview(speed) {
  const normalizedSpeed = Math.max(0, Number(speed) || 0);
  dom.speedPreviewReadout.textContent = `${formatNumber(normalizedSpeed)}%`;
  if (speedPreviewValue !== normalizedSpeed || speedPreviewCharacterId !== character.id) {
    speedPreviewValue = normalizedSpeed;
    speedPreviewCharacterId = character.id;
    speedPreviewStartedAt = performance.now();
    dom.speedPreviewFill.style.transform = "scaleX(0)";
    dom.speedPreview.classList.remove("ready");
  }
  if (speedPreviewFrame === null) speedPreviewFrame = requestAnimationFrame(animateSpeedPreview);
}

function renderDerived() {
  const derived = derivedValues();
  const hp = maximumHpDetails();
  const reduction = damageReductionDetails();
  const initiativeParts = skillBonusParts("Initiative");
  const awarenessParts = skillBonusParts("Awareness");
  const intellectBoxes = boxesFilled("intellect");
  const initiativeRating = displayedSkillTenths("Initiative", character.skills.Initiative) / 10;
  const mastermind = character.identity.classId === "mastermind" && finalizedModifiersActive();
  dom.derivedSpeed.textContent = formatNumber(derived.speed);
  dom.derivedSpeedFormula.textContent = `Intellect boxes ${intellectBoxes} + Initiative ${formatNumber(initiativeRating)}${mastermind ? " x1.5 Mastermind" : ""}${initiativeParts.length ? ` (${initiativeParts.map((part) => `+${ratingText(part.value)} ${part.source}`).join(", ")})` : ""}`;
  syncSpeedPreview(derived.speed);
  dom.derivedCommand.textContent = `${formatNumber(derived.command)} sec`;
  const awarenessSeconds = character.identity.classId === "mastermind" && finalizedModifiersActive() ? 45 : 12;
  const perceptionBoxes = boxesFilled("perception");
  const awarenessRating = displayedSkillTenths("Awareness", character.skills.Awareness) / 10;
  dom.derivedCommandFormula.textContent = `Perception boxes ${perceptionBoxes} x8 + Awareness ${formatNumber(awarenessRating)} x${awarenessSeconds}${awarenessParts.length ? ` (${awarenessParts.map((part) => `+${ratingText(part.value)} ${part.source}`).join(", ")})` : ""}`;
  dom.maximumHp.textContent = hp.value;
  dom.maximumHpFormula.textContent = hp.formula;
  dom.permanentHpBonus.textContent = character.health.permanentBonus;
  dom.permanentHpFormula.textContent = raceEffects().forbidMaxHpReverence
    ? `${selectedRace()?.name || "Race"} cannot purchase this bonus with Reverence`
    : "Reverence and other permanent effects";
  dom.damageReduction.textContent = reduction.value;
  dom.damageReductionFormula.textContent = reduction.formula;
  dom.currentHp.value = character.health.current;
  dom.currentHpMaximum.textContent = hp.value;
  dom.currentHp.classList.toggle("invalid", character.health.current < 1);
  dom.marineHeal.hidden = character.phase !== "finalized" || character.identity.classId !== "marine-soldier";
  dom.marineHeal.disabled = Boolean(character.session.marineHealingUsed) || diceRoller.isActive();
  dom.marineHeal.textContent = character.session.marineHealingUsed ? "Marine Recovery Used" : "Marine Recovery";
  renderTabbedStatus();
}

function weaponOptions(selectedId) {
  return [
    `<option value="">Choose a weapon</option>`,
    ...WEAPONS.map((weapon) => `<option value="${escapeAttribute(weapon.id)}" ${weapon.id === selectedId ? "selected" : ""}>${escapeHtml(weapon.name)}</option>`),
  ].join("");
}

function weaponStat(value) {
  const text = String(value || "").trim();
  return text && !["N/A", "None"].includes(text) ? text : text || "-";
}

function renderWeapons() {
  const onlyRow = character.weapons.length <= 1;
  dom.weaponInventory.innerHTML = character.weapons.map((entry) => {
    const weapon = weaponById(entry.weaponId);
    const emptyClass = weapon ? "" : " weapon-empty-stat";
    const chargeTime = weapon?.chargeMode === "movement" ? "Movement" : weapon?.chargeTime || "-";
    return `<div class="weapon-table-row" role="row" data-weapon-row="${escapeAttribute(entry.id)}">
      <select data-weapon-select="${escapeAttribute(entry.id)}" aria-label="Choose weapon">${weaponOptions(entry.weaponId)}</select>
      <button type="button" class="weapon-held-button ${entry.held ? "active" : ""}" data-hold-weapon="${escapeAttribute(entry.id)}" ${weapon ? "" : "disabled"} aria-pressed="${entry.held ? "true" : "false"}"><span>${entry.held ? "Held" : "Hold"}</span></button>
      <span class="weapon-stat${emptyClass}" data-label="To-Hit">${escapeHtml(weaponStat(weapon?.toHit))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Damage">${escapeHtml(weaponStat(weapon?.damage))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Charge Bonus">${escapeHtml(weaponStat(weapon?.chargeBonus))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Max Charge">${escapeHtml(weaponStat(weapon?.maxCharge))}</span>
      <span class="weapon-stat charge-time${emptyClass}" data-label="Charge Time">${escapeHtml(String(chargeTime))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Element">${escapeHtml(weaponStat(weapon?.element))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Range">${escapeHtml(weaponStat(weapon?.range))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Size">${escapeHtml(weaponStat(weapon?.sizeClass))}</span>
      <span class="weapon-stat special${emptyClass}" data-label="Special">${escapeHtml(weaponStat(weapon?.special))}</span>
      <button type="button" class="weapon-row-remove" data-remove-weapon="${escapeAttribute(entry.id)}" ${onlyRow ? "disabled" : ""} aria-label="Remove weapon">-</button>
    </div>`;
  }).join("");
}

function heldWeaponSnapshot() {
  const entry = character.weapons.find((weapon) => weapon.held && weapon.weaponId);
  const weapon = weaponById(entry?.weaponId);
  if (!entry || !weapon) return null;
  return {
    inventoryId: entry.id,
    ...weapon,
  };
}

function renderCrew() {
  const atMinimum = character.crew.length <= 3;
  dom.crewRoster.innerHTML = character.crew.map((member, index) => `<div class="crew-row"><input data-crew-index="${index}" data-crew-field="name" value="${escapeAttribute(member.name)}" placeholder="Crewmember" aria-label="Crewmember ${index + 1} name" /><input data-crew-index="${index}" data-crew-field="title" value="${escapeAttribute(member.title)}" placeholder="Title / Station" aria-label="Crewmember ${index + 1} title" /><button class="row-remove" type="button" data-remove-crew="${index}" ${atMinimum ? "disabled" : ""} aria-label="Remove crew row ${index + 1}">-</button></div>`).join("");
}

function printableCharacterData() {
  const values = derivedValues();
  const hp = maximumHpDetails();
  const move = calculatedMoveSpeedDetails();
  const reduction = damageReductionDetails();
  const raceDefinition = selectedRace();
  const raceType = selectedRaceType();
  const classDefinition = classById(character.identity.classId);
  const raceName = character.identity.raceKind === "other"
    ? character.identity.race.trim() || "Custom Race"
    : raceDefinition
      ? `${raceDefinition.name}${raceType ? ` - ${raceType.name}` : ""}`
      : "No Race";
  const raceAdvantages = [...(raceDefinition?.advantages || []), ...(raceType?.advantages || [])];
  const raceDisadvantages = [...(raceDefinition?.disadvantages || []), ...(raceType?.disadvantages || [])];
  const modifierGroups = [
    { title: "Racial Advantages", entries: raceAdvantages },
    { title: "Racial Disadvantages", entries: raceDisadvantages },
    { title: "Class", entries: character.identity.classId ? [classDefinition.summary, classDefinition.manual].filter(Boolean) : [] },
    { title: "Unique", entries: character.advantagesNotes.trim() ? [character.advantagesNotes.trim()] : [] },
  ].filter((group) => group.entries.length);
  const skills = [
    ...SPACECRAFT_SKILLS.map((name) => ({ name, value: ratingText(displayedSkillTenths(name, character.skills[name])), group: "Spacecraft", bold: BOLD_SKILLS.has(name) })),
    ...GENERAL_SKILLS.map((name) => ({ name, value: ratingText(displayedSkillTenths(name, character.skills[name])), group: "General", bold: BOLD_SKILLS.has(name) })),
    ...character.customSkills.filter((skill) => skill.name.trim()).map((skill) => ({ name: skill.name.trim(), value: ratingText(skill.tenths), group: "Custom", bold: false })),
  ];
  const classCredits = Number(classEffects().creditsBonus) || 0;
  return {
    identity: {
      playerName: character.identity.playerName,
      characterName: character.identity.characterName || "Unnamed Character",
      race: raceName,
      className: classDefinition.name,
      homePlanet: character.identity.homePlanet,
      sex: character.identity.sex,
      age: character.identity.age,
      height: character.identity.height,
      weight: character.identity.weight,
      hair: character.identity.hair,
      eyes: character.identity.eyes,
      description: character.identity.description,
    },
    phase: character.phase,
    campaign: campaignState?.name || character.campaignLink?.campaignName || "",
    roomCode: campaignCode || character.campaignLink?.roomCode || "",
    atbColor: character.presentation.atbColor,
    experience: { ...character.experience },
    attributes: ATTRIBUTE_DEFS.map((definition) => ({
      name: definition.label,
      dice: character.attributes[definition.key].filter((value) => value >= 0).map((value) => DICE_NAMES[value]),
    })),
    skills,
    stats: {
      speed: formatNumber(values.speed),
      command: `${formatNumber(values.command)} sec`,
      maximumHp: hp.value,
      damageReduction: reduction.value,
      moveSpeed: move.value,
    },
    resources: {
      exertionMax: character.resources.exertionMax,
      reverence: character.resources.reverence,
      credits: character.resources.creditsBase + classCredits,
      dramaCards: character.resources.dramaCards,
    },
    modifiers: modifierGroups,
    crew: character.crew.map((member) => ({ name: member.name.trim(), title: member.title.trim() })),
    fubs: character.fubs.status === "complete" ? character.fubs.rolls.join(" > ") : "Not activated",
  };
}

function availableFreeReroll() {
  if (!skillCheck || skillCheck.manual || !skillCheck.lastResults.length) return null;
  const profile = rollRuleProfile();
  const used = character.session.freeRerollsUsed || {};
  if (profile.classId === "decker" && profile.skillName === "Computer Systems" && (used.deckerComputer || 0) < 3) {
    return { key: "deckerComputer", maximum: 3, count: skillCheck.lastResults.length, label: `Free Computer Reroll (${3 - (used.deckerComputer || 0)} left)` };
  }
  if (profile.raceId === "grey" && profile.attributeKey === "intellect" && (used.greyIntellect || 0) < 1) {
    return { key: "greyIntellect", maximum: 1, count: 1, label: "Free Grey Intellect Reroll" };
  }
  if (profile.raceId === "yetuak-zune" && ["intellect", "perception"].includes(profile.attributeKey)) {
    const key = `yetuak-${profile.attributeKey}`;
    if ((used[key] || 0) < 2) return { key, maximum: 2, count: 1, label: `Free ${skillCheckAttribute().label} Reroll (${2 - (used[key] || 0)} left)` };
  }
  if (skillCheck.freeRerollUsed) return null;
  if (profile.raceId === "bruggle" && ["strength", "dexterity"].includes(profile.attributeKey)) return { count: 2, label: "Reroll Two Lowest Dice" };
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy" && ["charisma", "dexterity"].includes(profile.attributeKey)) return { count: 2, label: "Reroll Two Lowest Dice" };
  if (profile.raceId === "epoc" && ["luck", "charisma", "willpower", "intellect"].includes(profile.attributeKey)) return { count: 2, label: "Reroll Two Lowest Dice" };
  if (profile.raceId === "pattanilia" && ["perception", "intellect", "willpower"].includes(profile.attributeKey)) return { count: 2, label: "Reroll Two Lowest Dice" };
  if (profile.raceId === "slyn-tanni" && ["dexterity", "charisma"].includes(profile.attributeKey)) return { count: 1, label: "Reroll Lowest Die" };
  return null;
}

function useFreeRuleReroll() {
  const rule = availableFreeReroll();
  if (!rule || diceRoller.isActive()) return;
  const ranked = skillCheck.lastResults.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index);
  const rerollIndices = new Set(ranked.slice(0, Math.max(1, rule.count)).map((entry) => entry.index));
  const rerollSides = skillCheck.currentRollSides.filter((_, index) => rerollIndices.has(index));
  const kept = skillCheck.lastResults.map((value, index) => ({ value, index })).filter((entry) => !rerollIndices.has(entry.index));
  if (!rerollSides.length) return;
  if (rule.key) character.session.freeRerollsUsed[rule.key] = (character.session.freeRerollsUsed[rule.key] || 0) + 1;
  else skillCheck.freeRerollUsed = true;
  queueSave();
  dom.skillCheckModal.hidden = true;
  document.body.classList.add("skill-roll-active");
  diceRoller.rollPool({
    sides: rerollSides,
    title: `${skillCheckResolvedSkill().name} Free Reroll`,
    subtitle: `${rerollSides.length} ${rerollSides.length === 1 ? "die" : "dice"} rerolled`,
    fusion: true,
    onResolved: () => {},
    onSettled: (fresh) => {
      const combined = Array(skillCheck.currentRollSides.length);
      kept.forEach((entry) => { combined[entry.index] = entry.value; });
      let cursor = 0;
      [...rerollIndices].sort((a, b) => a - b).forEach((index) => { combined[index] = fresh[cursor++]; });
      document.body.classList.remove("skill-roll-active");
      diceRoller.stop();
      dom.skillCheckModal.hidden = false;
      resolvePhysicalSkillRoll(combined);
    },
  });
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
  renderWeapons();
  renderCrew();
  renderCharacterLayout();
}

function applySkillSearch() {
  const query = dom.skillSearch.value.trim().toLowerCase();
  document.querySelectorAll(".skill-row[data-search-name]").forEach((row) => {
    row.classList.toggle("hidden-by-search", Boolean(query) && !row.dataset.searchName.includes(query));
  });
  document.querySelectorAll(".skill-sort-group").forEach((group) => {
    group.hidden = ![...group.querySelectorAll(".skill-row[data-search-name]")].some((row) => !row.classList.contains("hidden-by-search"));
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
      if (character.identity.raceId === "tamalori" && attributeKey === "strength" && column === 4) {
        notice("TaMalori cannot purchase D12 Strength dice.", "error");
        return;
      }
      const cost = attributeStepCost(attributeKey, row, column);
      if (attributePointsSpent() + cost > attributePointBudget()) {
        notice(`That purchase would exceed the ${attributePointBudget()}-point Attribute budget.`, "error");
        return;
      }
      character.attributes[attributeKey][row] = column;
      playPurchaseSound(attributeKey);
      notice(`${definition.label} upgraded to ${DICE_NAMES[column]} for ${cost} Attribute Points.`, "success");
    } else if (column === current) {
      if (row < 2 && column === 0) return;
      const refund = attributeStepCost(attributeKey, row, column);
      character.attributes[attributeKey][row] = current - 1;
      notice(`${refund} Attribute Points refunded.`, "success");
    } else {
      return;
    }
  } else if (character.phase === "finalized" && character.advancementOpen && column === current + 1) {
    if (character.identity.raceId === "tamalori" && attributeKey === "strength" && column === 4) {
      notice("TaMalori cannot purchase D12 Strength dice.", "error");
      return;
    }
    const cost = attributeStepCost(attributeKey, row, column);
    const mechanical = mechanicalSpiddixAttribute(attributeKey);
    if (!(mechanical ? spendMechanicalXp(cost, `${definition.label} ${DICE_NAMES[column]}`) : spendXp(cost, `${definition.label} ${DICE_NAMES[column]}`))) return;
    character.attributes[attributeKey][row] = column;
    playPurchaseSound(attributeKey);
    notice(`${definition.label} upgraded to ${DICE_NAMES[column]} for ${cost} ${mechanical ? "mechanical XP" : "XP"}.`, "success");
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
    notice(`Spend all ${validation.attributeBudget} Attribute Points before purchasing Skills.`, "error");
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
    playPurchaseSound();
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
    if ((skillCreationLevel(skill) > 0 || character.identity.raceId === "pattanilia") && skill.creationDecimal === null) keys.push(skillKeyForBase(name));
  }
  for (const skill of character.customSkills) {
    if (skillCreationLevel(skill) > 0 && skill.creationDecimal === null) keys.push(skillKeyForCustom(skill.id));
  }
  return keys;
}

function askConfirmation({ title, message, acceptLabel, cancelLabel = "Cancel", danger = false, previewHtml = "", singleAction = false }) {
  if (confirmResolver) confirmResolver(false);
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmAccept.textContent = acceptLabel || "Confirm";
  dom.confirmCancel.textContent = cancelLabel;
  dom.confirmAccept.hidden = singleAction;
  dom.confirmAccept.classList.toggle("danger", danger);
  dom.confirmPreview.innerHTML = previewHtml;
  dom.confirmPreview.hidden = !previewHtml;
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
  dom.confirmPreview.innerHTML = "";
  dom.confirmPreview.hidden = true;
  const resolver = confirmResolver;
  confirmResolver = null;
  resolver?.(result);
}

function requestPcCode({ title = "Choose a PC Code", acceptLabel = "Save PC Code and Finalize" } = {}) {
  if (pcCodeResolver) pcCodeResolver("");
  dom.pcCodeFirst.value = character.access?.pcCode || "";
  dom.pcCodeConfirm.value = "";
  dom.pcCodeMessage.textContent = "";
  dom.pcCodeModal.querySelector("#pcCodeTitle").textContent = title;
  dom.pcCodeAccept.textContent = acceptLabel;
  dom.pcCodeModal.hidden = false;
  setTimeout(() => dom.pcCodeFirst.focus(), 60);
  return new Promise((resolve) => { pcCodeResolver = resolve; });
}

function closePcCodeModal(value = "") {
  dom.pcCodeModal.hidden = true;
  const resolver = pcCodeResolver;
  pcCodeResolver = null;
  resolver?.(value);
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
  renderCharacterNavigation();
  notice("Fresh Character Draft created. The previous character remains saved.", "success");
}

function requestRuleChoices({ title, message, options, count = 1 }) {
  return new Promise((resolve) => {
    const shell = document.createElement("div");
    shell.className = "modal-shell rule-choice-modal";
    const rows = Array.from({ length: count }, (_, index) => `
      <label>${count > 1 ? `Choice ${index + 1}` : "Selection"}
        <select data-rule-choice="${index}"><option value="">Choose One</option>${options.map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join("")}</select>
      </label>`).join("");
    shell.innerHTML = `<section class="confirm-dialog" role="dialog" aria-modal="true"><span class="dialog-kicker">Finalization Choice</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="rule-choice-fields">${rows}</div><p class="dialog-error" role="status"></p><div class="dialog-actions"><button type="button" data-rule-cancel>Cancel</button><button type="button" class="primary-action" data-rule-confirm>Confirm</button></div></section>`;
    document.body.append(shell);
    const close = (value) => { shell.remove(); resolve(value); };
    shell.querySelector("[data-rule-cancel]").addEventListener("click", () => close(null));
    shell.querySelector("[data-rule-confirm]").addEventListener("click", () => {
      const values = [...shell.querySelectorAll("[data-rule-choice]")].map((select) => select.value);
      if (values.some((value) => !value) || new Set(values).size !== values.length) {
        shell.querySelector(".dialog-error").textContent = count > 1 ? "Choose different options in every field." : "Choose an option first.";
        return;
      }
      close(values);
    });
    shell.querySelector("select")?.focus();
  });
}

async function collectFinalizationChoices() {
  character.creation.racialSkillGrants = {};
  if (character.identity.classId === "other") {
    const values = await requestRuleChoices({
      title: "Other Class Attribute",
      message: "Choose the Attribute whose unused dice will add to the final Score as a decimal.",
      options: ATTRIBUTE_DEFS.map((entry) => ({ value: entry.key, label: entry.label })),
    });
    if (!values) return false;
    character.creation.classAttributeChoice = values[0];
  }
  if (character.identity.raceId === "nordic-flaxen") {
    const values = await requestRuleChoices({
      title: "Nordic Flaxen Skill",
      message: "Choose one non-bold Skill to receive +2.0 after finalization.",
      options: ALL_SKILLS.filter((name) => !BOLD_SKILLS.has(name)).map((name) => ({ value: name, label: name })),
    });
    if (!values) return false;
    character.creation.raceSkillChoices = values;
    character.creation.racialSkillGrants[values[0]] = 20;
  }
  if (character.identity.raceId === "skeder") {
    const values = await requestRuleChoices({
      title: "Sked'er Skills",
      message: "Choose two different Skills to receive +1.0 after finalization.",
      count: 2,
      options: ALL_SKILLS.map((name) => ({ value: name, label: name })),
    });
    if (!values) return false;
    character.creation.raceSkillChoices = values;
    values.forEach((name) => { character.creation.racialSkillGrants[name] = 10; });
  }
  if (character.identity.raceId === "slyn-tanni") {
    const options = ATTRIBUTE_DEFS.flatMap((definition) => character.attributes[definition.key].flatMap((current, row) => current < 4
      ? [{ value: `${definition.key}:${row}`, label: `${definition.label} row ${row + 1}: ${current < 0 ? "None" : DICE_NAMES[current]} to ${DICE_NAMES[current + 1]}` }]
      : []));
    const values = await requestRuleChoices({
      title: "Slyn Tanni Attribute Upgrade",
      message: "Choose one Attribute die to upgrade for free after finalization.",
      options,
    });
    if (!values) return false;
    character.creation.raceAttributeChoice = values[0];
  }
  return true;
}

function spendMechanicalXp(cost, description) {
  const available = Math.max(0, Math.round(Number(character.resources.mechanicalExperience) || 0));
  if (available < cost) {
    notice(`You need ${cost} mechanical XP for ${description}. ${available} mechanical XP is available.`, "error");
    return false;
  }
  character.resources.mechanicalExperience = available - cost;
  return true;
}

async function beginFinalization() {
  const validation = draftValidation();
  if (!validation.ready || character.phase !== "draft") {
    notice(validation.issues[0] || "Resolve the remaining creation requirements first.", "error");
    return;
  }
  const fubsMissing = character.fubs.status !== "complete";
  const accepted = await askConfirmation(fubsMissing ? {
    title: "You have not rolled FUBS yet. Are you sure?",
    message: "FUBS is optional, but finalizing without it permanently marks this character as FUBS: (Not activated).",
    acceptLabel: "Yes, Finalize Without FUBS",
    cancelLabel: "Return to Character",
    previewHtml: '<div class="fubs-reminder-preview"><span>Character Background</span><button type="button">Roll on FUBS Chart</button></div>',
  } : {
    title: "Finalize this character?",
    message: "Race, Class, Home Planet, Attribute allocation, and starting Skill levels will become permanent. Skill decimals will now be rolled in sheet order.",
    acceptLabel: "Begin Finalization",
    cancelLabel: "Continue Editing",
  });
  if (!accepted) {
    if (fubsMissing) {
      if (characterLayoutMode === "tabs") {
        showCharacterPanel("sheet");
        showSheetSection("identity");
      }
      $(".notes-panel").scrollIntoView({ behavior: "smooth", block: "center" });
      dom.fubsButton.classList.remove("fubs-attention");
      requestAnimationFrame(() => dom.fubsButton.classList.add("fubs-attention"));
    }
    return;
  }
  if (!await collectFinalizationChoices()) return;
  const pcCode = await requestPcCode();
  if (!pcCode) return;
  character.access.pcCode = pcCode;
  saveLibrary();
  snapshotRecovery("Before Finalization");
  finalizationPresentationActive = true;
  if (fubsMissing) character.fubs.status = "not-activated";
  character.phase = "finalizing";
  character.advancementOpen = false;
  character.creation.finalizationQueue = skillKeysForFinalization();
  character.pendingRoll = null;
  saveLibrary("Finalization started");
  renderAll();
  processFinalization();
}

let identityRevealToken = 0;

async function playFinalizedIdentityReveal() {
  const token = ++identityRevealToken;
  if (characterLayoutMode === "tabs") {
    showCharacterPanel("sheet");
    showSheetSection("identity");
  }
  const name = (character.identity.characterName || "Unnamed Character").toUpperCase();
  const color = character.presentation?.atbColor || "#39e58f";
  dom.identityPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
  await new Promise((resolve) => setTimeout(resolve, 620));
  if (token !== identityRevealToken) return;
  dom.identityPanel.style.setProperty("--identity-atb-color", color);
  dom.identityCallsign.style.setProperty("--identity-atb-color", color);
  dom.identityCallsign.innerHTML = [...name].map((letter, index) => `<span class="identity-name-letter" style="--letter-index:${index};--letter-direction:${index % 2 ? -1 : 1}">${letter === " " ? "&nbsp;" : escapeHtml(letter)}</span>`).join("");
  dom.identityCallsign.classList.add("finalized-name", "name-revealing");
  await new Promise((resolve) => setTimeout(resolve, 3600));
  if (token !== identityRevealToken) return;
  dom.identityCallsign.classList.add("name-reveal-complete");
  await new Promise((resolve) => setTimeout(resolve, 1800));
  if (token !== identityRevealToken) return;
  dom.identityCallsign.classList.remove("name-revealing", "name-reveal-complete");
  dom.identityCallsign.textContent = name;
}

function applyResourceGrant(effects) {
  const bonusXp = Number(effects.xpOnFinalize) || 0;
  if (bonusXp) {
    character.experience.available += bonusXp;
    character.experience.totalGained += bonusXp;
  }
  const bonusCredits = Number(effects.creditsOnFinalize) || 0;
  if (bonusCredits) character.resources.creditsBase += bonusCredits;
  if (effects.reverenceOnFinalize) character.resources.reverence = Math.max(character.resources.reverence, Math.min(10, effects.reverenceOnFinalize));
  if (effects.dramaCardsOnFinalize) character.resources.dramaCards += effects.dramaCardsOnFinalize;
}

async function finishFinalization() {
  finalizationPresentationActive = true;
  if (!character.creation.classGrantsApplied) {
    applyResourceGrant(rawClassEffects());
    character.creation.classGrantsApplied = true;
  }
  if (!character.creation.raceGrantsApplied) {
    applyResourceGrant(rawRaceEffects());
    if (character.identity.raceId === "slyn-tanni" && character.creation.raceAttributeChoice && !character.creation.freeAttributeUpgradeApplied) {
      const [attributeKey, rowText] = character.creation.raceAttributeChoice.split(":");
      const row = Number(rowText);
      if (character.attributes[attributeKey] && Number.isInteger(row) && character.attributes[attributeKey][row] < 4) {
        character.attributes[attributeKey][row] += 1;
        character.creation.freeAttributeUpgradeApplied = true;
      }
    }
    character.creation.raceGrantsApplied = true;
  }
  character.phase = "finalized";
  if (character.fubs.status === "unrolled") character.fubs.status = "not-activated";
  character.advancementOpen = false;
  character.legacyDraft = false;
  character.pendingRoll = null;
  character.creation.finalizationQueue = [];
  character.health.current = maximumHp();
  saveLibrary("Character finalized");
  renderAll();
  notice("Character finalized. Advancement rules are now active.", "success");
  await playFinalizedIdentityReveal();
  finalizationPresentationActive = false;
  renderCharacterLayout();
  renderCharacterNavigation();
}

function campaignSkillKey(skillName) {
  if (character.skills[skillName]) return skillKeyForBase(skillName);
  const custom = character.customSkills.find((entry) => entry.name.trim().toLowerCase() === String(skillName).trim().toLowerCase());
  return custom ? skillKeyForCustom(custom.id) : "";
}

function openRequestedCampaignRoll() {
  const request = activeCampaignRollRequest;
  if (!request) return;
  const skillKey = campaignSkillKey(request.skill);
  const attribute = ATTRIBUTE_DEFS.find((entry) => entry.label.toLowerCase() === String(request.attribute).toLowerCase());
  if (!skillKey || !attribute) {
    notice("This GM request references a Skill or Attribute that is not on this character sheet.", "error");
    return;
  }
  openSkillCheck(skillKey);
  if (!skillCheck) return;
  skillCheck.campaignRequestId = request.id;
  skillCheck.campaignSubmitted = false;
  skillCheck.difficulty = request.hideDifficulty || request.difficulty === null ? "" : String(request.difficulty);
  selectSkillAttribute(attribute.key);
  dom.skillCheckSubtitle.textContent = request.hideDifficulty
    ? "GM-requested roll. The Difficulty is hidden."
    : "GM-requested roll. The result will be returned automatically.";
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
      const resolved = resolveSkill(character, key);
      character.pendingRoll = {
        kind: "creation-d10",
        skillKey: key,
        result: null,
        config: null,
        pattaniliaUnpurchased: character.identity.raceId === "pattanilia" && skillCreationLevel(resolved?.skill) === 0,
      };
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
  const purchased = Number(resolved.skill.tenths) || 0;
  const cost = advancementSkillCost(purchased);
  const currency = mechanicalSpiddixSkill(resolved.name) ? "mechanical" : "standard";
  if (!(currency === "mechanical" ? spendMechanicalXp(cost, `${resolved.name} advancement`) : spendXp(cost, `${resolved.name} advancement`))) return;
  character.pendingRoll = {
    kind: "advancement-d6",
    skillKey: key,
    baseCost: cost,
    preRatingTenths: purchased,
    paidRerollUsed: false,
    result: null,
    config: null,
    sides: character.identity.raceId === "horus" ? 8 : 6,
    currency,
  };
  saveLibrary("Skill advancement roll prepared");
  renderAll();
  rollPending();
}

function pendingRollTitle(pending) {
  const resolved = resolveSkill(character, pending.skillKey);
  return resolved?.name || "Skill";
}

function skillRowFor(key) {
  return document.querySelector(`.skill-row[data-skill-key="${CSS.escape(key)}"]`);
}

function showPendingRollToast(pending, result) {
  const resolved = resolveSkill(character, pending.skillKey);
  if (!resolved) return;
  const projectedBase = pending.kind === "creation-d10"
    ? skillCreationLevel(resolved.skill) * 10 + (result === 10 ? 0 : result)
    : pending.preRatingTenths + result;
  const bonus = skillBonusTenths(resolved.name);
  const bonusNote = bonus ? ` (${ratingText(projectedBase)} purchased +${ratingText(bonus)} modifier)` : "";
  showRollResultToast(`${resolved.name}: ${ratingText(projectedBase + bonus)}${bonusNote}`);
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
  const anchor = skillRowFor(pending.skillKey);
  anchor?.scrollIntoView({ behavior: "auto", block: "center" });
  diceRoller.roll({
    sides: creation ? 10 : (pending.sides || 6),
    title: resolved.name,
    subtitle: creation ? `Finalization decimal roll - ${remaining} skill${remaining === 1 ? "" : "s"} remaining` : `Advancing from ${ratingText(pending.preRatingTenths)} - ${pending.baseCost} XP spent`,
    config: pending.config,
    anchor,
    onConfig: (config) => {
      character.pendingRoll.config = config;
      saveLibrary("Physical roll in progress");
    },
    onResolved: (result) => showPendingRollToast(pending, result),
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
    resolved.skill.tenths = pending.pattaniliaUnpurchased && result === 10
      ? 10
      : skillCreationLevel(resolved.skill) * 10 + decimal;
    resolved.skill.creationDecimal = decimal;
    character.creation.finalizationQueue = character.creation.finalizationQueue.filter((key, index) => !(index === 0 && key === pending.skillKey));
    character.pendingRoll = null;
    saveLibrary("Skill decimal finalized");
    renderAll();
    diceRoller.celebrate(420).then(processFinalization);
    return;
  }
  presentAdvancementDecision();
}

function presentAdvancementDecision() {
  const pending = character.pendingRoll;
  if (!pending || pending.kind !== "advancement-d6" || pending.result === null) return;
  const rerollsForbidden = character.identity.raceId === "draco-prime";
  const freeReroll = !rerollsForbidden && pending.preRatingTenths <= 9 && pending.result === 1;
  const rerollCost = Math.round(pending.baseCost / 5);
  const rerollFunds = pending.currency === "mechanical" ? Number(character.resources.mechanicalExperience) || 0 : character.experience.available;
  const paidReroll = !rerollsForbidden && pending.preRatingTenths >= 10 && !pending.paidRerollUsed && rerollFunds >= rerollCost;
  if (!freeReroll && !paidReroll) {
    acceptAdvancementResult();
    return;
  }
  diceRoller.showChoices([
    { label: freeReroll ? "Reroll Free" : `Reroll - ${rerollCost} XP`, className: "primary-action", action: () => rerollAdvancement(freeReroll ? 0 : rerollCost) },
    { label: "Keep", action: () => acceptAdvancementResult() },
  ]);
}

function rerollAdvancement(cost) {
  const pending = character.pendingRoll;
  if (!pending) return;
  if (cost > 0) {
    if (!(pending.currency === "mechanical" ? spendMechanicalXp(cost, "skill reroll") : spendXp(cost, "skill reroll"))) return;
    pending.paidRerollUsed = true;
  }
  pending.result = null;
  pending.config = null;
  saveLibrary("Reroll prepared");
  renderAll();
  diceRoller.reroll({
    sides: pending.sides || 6,
    title: pendingRollTitle(pending),
    subtitle: cost ? `${cost} XP reroll spent - this result is final` : "Free reroll of a 1",
    config: null,
    anchor: skillRowFor(pending.skillKey),
    onConfig: (config) => {
      character.pendingRoll.config = config;
      saveLibrary("Physical reroll in progress");
    },
    onResolved: (result) => showPendingRollToast(pending, result),
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
  playPurchaseSound();
  notice(`${resolved.name} increased by +0.${result}.`, "success");
  diceRoller.celebrate(420);
}

function showPersistedPendingResult() {
  const pending = character.pendingRoll;
  if (!pending) return;
  const displayedResult = pending.kind === "creation-d10" && pending.result === 10 ? 0 : pending.result;
  diceRoller.showPersistedResult({
    title: pendingRollTitle(pending),
    subtitle: "Recovered saved roll result",
    result: displayedResult,
    anchor: skillRowFor(pending.skillKey),
  });
  if (pending.kind === "advancement-d6") presentAdvancementDecision();
}

function showFubsResult() {
  if (character.fubs.status !== "complete" || !character.fubs.rolls.length) return;
  dom.fubsRollChain.innerHTML = character.fubs.rolls.map((roll, index) => {
    const arrow = index ? '<span class="fubs-roll-arrow">&gt;</span>' : "";
    return `${arrow}<span class="fubs-roll-chip">${roll}</span>`;
  }).join("");
  dom.fubsEntryText.innerHTML = character.fubs.rolls.map((roll) => (
    `<article class="fubs-entry"><strong>Roll ${roll}</strong>${escapeHtml(fubsEntry(roll))}</article>`
  )).join("");
  const canReroll = character.phase === "draft" && !character.fubs.rerollUsed && !fubsRollInProgress;
  dom.fubsReroll.hidden = !canReroll;
  $(".fubs-reroll-control small").hidden = !canReroll;
  dom.fubsModal.hidden = false;
  dom.fubsDialog.classList.remove("reveal");
  void dom.fubsDialog.offsetWidth;
  dom.fubsDialog.classList.add("reveal");
  dom.fubsExit.focus();
}

function closeFubsResult() {
  dom.fubsModal.hidden = true;
  dom.fubsDialog.classList.remove("reveal");
}

function randomTerminalFubsResult() {
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
    values[0] = values[0] % 100 + 1;
  } while (FUBS_CHAIN_RESULTS.has(values[0]));
  return values[0];
}

function rollFubsPercentile() {
  return new Promise((resolve, reject) => {
    diceRoller.rollPercentile({
      title: "FUBS Percentile",
      subtitle: "Red die: tens | Blue die: ones",
      anchor: dom.fubsButton,
      onResolved: (result) => showRollResultToast(`FUBS Result: ${result.total}`),
      onSettled: (result) => {
        diceRoller.celebrate(360).then(() => resolve(result.total));
      },
    }).catch(reject);
  });
}

async function buildFubsRollChain(forcedFirst = null) {
  const rolls = [];
  let forced = forcedFirst;
  for (let index = 0; index < 20; index += 1) {
    const result = forced ?? await rollFubsPercentile();
    forced = null;
    rolls.push(result);
    if (!FUBS_CHAIN_RESULTS.has(result)) return rolls;
  }
  rolls.push(randomTerminalFubsResult());
  return rolls;
}

async function performFubsRoll({ forcedFirst = null, reroll = false, debug = false } = {}) {
  if (!backgroundComplete()) {
    await showBackstoryRequired();
    return;
  }
  if (character.phase !== "draft" || fubsRollInProgress || character.pendingRoll || diceRoller.isActive()) return;
  const previousFubs = deepCopy(character.fubs);
  fubsRollInProgress = true;
  if (reroll) character.fubs.rerollUsed = true;
  if (debug) character.fubs.rerollUsed = false;
  saveLibrary("FUBS roll started");
  renderAll();
  $(".notes-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    const rolls = await buildFubsRollChain(forcedFirst);
    character.fubs.status = "complete";
    character.fubs.rolls = rolls;
    saveLibrary("FUBS result saved");
    fubsRollInProgress = false;
    renderAll();
    showFubsResult();
  } catch {
    character.fubs = previousFubs;
    fubsRollInProgress = false;
    saveLibrary("FUBS roll state restored");
    renderAll();
    notice("The FUBS dice could not start. Your previous FUBS state was preserved.", "error");
  }
}

async function showBackstoryRequired() {
  await askConfirmation({
    title: "Write Backstory First.",
    message: "FUBS can only be rolled after something has been written in the Character Background.",
    cancelLabel: "Exit",
    singleAction: true,
  });
  const background = document.querySelector('[data-field="notes"]');
  background?.scrollIntoView({ behavior: "smooth", block: "center" });
  background?.focus();
}

async function beginFubsRoll() {
  if (character.fubs.status !== "unrolled" || character.phase !== "draft") return;
  if (!backgroundComplete()) {
    await showBackstoryRequired();
    return;
  }
  const accepted = await askConfirmation({
    title: "Roll on the FUBS chart?",
    message: "Two D10s will create a percentile result and assign a permanent backstory prompt to this character.",
    acceptLabel: "Roll 2D10",
    cancelLabel: "Not Yet",
  });
  if (accepted) performFubsRoll();
}

async function rerollFubs() {
  if (character.phase !== "draft" || character.fubs.status !== "complete" || character.fubs.rerollUsed) return;
  if (!backgroundComplete()) {
    closeFubsResult();
    await showBackstoryRequired();
    return;
  }
  closeFubsResult();
  const accepted = await askConfirmation({
    title: "Reroll FUBS?",
    message: "This permanently replaces the current FUBS result. This character may use this option only once.",
    acceptLabel: "Use One-Time Reroll",
    cancelLabel: "Keep Current Result",
    danger: true,
  });
  if (!accepted) {
    showFubsResult();
    return;
  }
  performFubsRoll({ reroll: true });
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
      const name = field.value || "Unnamed Character";
      dom.identityCallsign.textContent = character.phase === "finalized" ? name.toUpperCase() : name;
      renderCharacterPicker();
    }
    if (field.dataset.field === "identity.sex") renderIdentityTheme();
    if (field.dataset.field === "identity.race") renderClass();
    queueSave();
    renderWorkflow();
    return;
  }

  const customName = event.target.closest("[data-custom-name]");
  if (customName && (!campaignCode || campaignEditable)) {
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
    character.health.current = Math.round(clamp(event.target.value, -9999, maximumHp()));
    queueSave();
    renderDerived();
  }
});

document.addEventListener("click", (event) => {
  const scienceChoice = event.target.closest("[data-science-choice]");
  if (scienceChoice) {
    if (!campaignEditable || !campaignToken) return;
    scienceChoice.disabled = true;
    campaignRequest("/api/campaign/session/science-choice", {
      method: "POST",
      body: JSON.stringify({
        code: campaignCode,
        token: campaignToken,
        characterId: campaignCharacterId,
        noteId: scienceChoice.dataset.noteId,
        skill: scienceChoice.dataset.scienceChoice,
      }),
    }).then((payload) => {
      receiveCampaignState(payload.campaign);
      notice(`${scienceChoice.dataset.scienceChoice} increased by +0.1.`, "success");
    }).catch((error) => {
      scienceChoice.disabled = false;
      notice(error.message, "error");
    });
    return;
  }
  const attributeButton = event.target.closest("[data-attribute]");
  if (attributeButton) {
    purchaseAttribute(attributeButton.dataset.attribute, Number(attributeButton.dataset.row), Number(attributeButton.dataset.column));
    return;
  }

  const skillButton = event.target.closest("[data-skill-action]");
  if (skillButton) {
    event.preventDefault();
    skillButton.blur();
    const key = skillButton.dataset.skillKey;
    if (skillButton.dataset.skillAction === "decrease") changeDraftSkill(key, -1);
    else if (character.phase === "draft") changeDraftSkill(key, 1);
    else startSkillAdvancement(key);
    return;
  }

  const rollableAttribute = event.target.closest("[data-roll-attribute]");
  if (rollableAttribute) {
    openAttributeCheck(rollableAttribute.dataset.rollAttribute);
    return;
  }

  const rollableSkill = event.target.closest("[data-roll-skill]");
  if (rollableSkill && !event.target.closest("button, input")) {
    openSkillCheck(rollableSkill.dataset.rollSkill);
    return;
  }

  const removeCustom = event.target.closest("[data-remove-custom-skill]");
  if (removeCustom && (!campaignCode || campaignEditable)) {
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

  const holdWeapon = event.target.closest("[data-hold-weapon]");
  if (holdWeapon && (!campaignCode || campaignEditable)) {
    const entry = character.weapons.find((weapon) => weapon.id === holdWeapon.dataset.holdWeapon);
    if (!entry?.weaponId) return;
    const nextHeld = !entry.held;
    character.weapons.forEach((weapon) => { weapon.held = false; });
    entry.held = nextHeld;
    queueSave();
    renderWeapons();
    notice(nextHeld ? `${weaponById(entry.weaponId).name} is now held.` : "Held weapon stowed.", "success");
    return;
  }

  const removeWeapon = event.target.closest("[data-remove-weapon]");
  if (removeWeapon && (!campaignCode || campaignEditable)) {
    if (character.weapons.length <= 1) return;
    const entry = character.weapons.find((weapon) => weapon.id === removeWeapon.dataset.removeWeapon);
    const name = weaponById(entry?.weaponId)?.name || "Weapon";
    character.weapons = character.weapons.filter((weapon) => weapon.id !== removeWeapon.dataset.removeWeapon);
    queueSave();
    renderWeapons();
    notice(`${name} removed from Supplies.`, "success");
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

  const hpButton = event.target.closest("[data-hp-change]");
  if (hpButton) {
    character.health.current = Math.round(clamp(character.health.current + Number(hpButton.dataset.hpChange), -9999, maximumHp()));
    queueSave();
    renderDerived();
  }
});

document.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const attribute = event.target.closest?.("[data-roll-attribute]");
  if (attribute) {
    event.preventDefault();
    openAttributeCheck(attribute.dataset.rollAttribute);
    return;
  }
  const row = event.target.closest?.("[data-roll-skill]");
  if (!row || event.target.closest("button, input")) return;
  event.preventDefault();
  openSkillCheck(row.dataset.rollSkill);
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-weapon-select]");
  if (!select || (campaignCode && !campaignEditable)) return;
  const entry = character.weapons.find((weapon) => weapon.id === select.dataset.weaponSelect);
  if (!entry) return;
  entry.weaponId = weaponById(select.value) ? select.value : "";
  if (!entry.weaponId) entry.held = false;
  queueSave();
  renderWeapons();
  notice(entry.weaponId ? `${weaponById(entry.weaponId).name} added to Supplies.` : "Weapon row cleared.", "success");
});

dom.racePicker.addEventListener("change", () => {
  if (character.phase !== "draft") return;
  character.identity.raceType = "";
  character.creation.raceSkillChoices = [];
  character.creation.raceAttributeChoice = "";
  character.creation.racialSkillGrants = {};
  if (dom.racePicker.value === "__other__") {
    character.identity.raceKind = "other";
    character.identity.raceId = "";
    character.identity.race = "";
  } else {
    const definition = raceById(dom.racePicker.value);
    character.identity.raceKind = "preset";
    character.identity.raceId = definition?.id || "";
    character.identity.race = definition?.name || "";
  }
  queueSave();
  renderAll();
  if (character.identity.raceKind === "other") dom.raceCustom.focus();
  else if (selectedRace()?.types?.length) dom.raceTypePicker.focus();
});

dom.raceCustom.addEventListener("input", () => {
  if (character.phase !== "draft" || character.identity.raceKind !== "other") return;
  character.identity.race = dom.raceCustom.value;
  queueSave();
  renderClass();
  renderWorkflow();
});

dom.raceTypePicker.addEventListener("change", () => {
  if (character.phase !== "draft") return;
  const definition = selectedRace();
  character.identity.raceType = definition?.types?.some((type) => type.id === dom.raceTypePicker.value)
    ? dom.raceTypePicker.value
    : "";
  queueSave();
  renderClass();
  renderWorkflow();
});

dom.classPicker.addEventListener("change", () => {
  if (character.phase !== "draft") return;
  const previousMaxHp = maximumHp();
  character.identity.classId = dom.classPicker.value;
  character.identity.className = classById(dom.classPicker.value).name;
  character.creation.classAttributeChoice = "";
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  notice(`${character.identity.className} selected. Class effects recalculated.`, "success");
});

dom.homePlanetPicker.addEventListener("change", () => {
  if (character.phase !== "draft") return;
  if (dom.homePlanetPicker.value === "__other__") {
    character.identity.homePlanetKind = "other";
    character.identity.homePlanet = "";
  } else {
    character.identity.homePlanetKind = "preset";
    character.identity.homePlanet = dom.homePlanetPicker.value;
  }
  queueSave();
  renderAll();
  if (character.identity.homePlanetKind === "other") dom.homePlanetCustom.focus();
});

dom.homePlanetCustom.addEventListener("input", () => {
  if (character.phase !== "draft" || character.identity.homePlanetKind !== "other") return;
  character.identity.homePlanet = dom.homePlanetCustom.value;
  queueSave();
  renderBackgroundTheme();
  renderWorkflow();
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
  renderCharacterNavigation();
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
  const validation = draftValidation();
  if ((campaignCode && !campaignEditable)
    || !((character.phase === "draft" && validation.attributesComplete) || character.phase === "finalized")
    || character.pendingRoll) return;
  const custom = { id: uid(), name: "", tenths: 0, creationDecimal: null };
  character.customSkills.push(custom);
  queueSave();
  renderSkills();
  dom.customSkills.querySelector(`input[data-custom-name="${custom.id}"]`)?.focus();
});

dom.addWeaponRow.addEventListener("click", () => {
  if ((campaignCode && !campaignEditable) || character.weapons.length >= 24) return;
  character.weapons.push({ id: uid(), weaponId: "", held: false });
  queueSave();
  renderWeapons();
  dom.weaponInventory.querySelector(".weapon-table-row:last-child select")?.focus();
});

dom.addCrewRow.addEventListener("click", () => {
  character.crew.push({ name: "", title: "" });
  queueSave();
  renderCrew();
  dom.crewRoster.querySelector(".crew-row:last-child input")?.focus();
});

dom.maxHpBonus.addEventListener("click", () => {
  const race = raceEffects();
  const cost = Number(race.maxHpReverenceCost) || 6;
  if (character.phase !== "finalized" || race.forbidMaxHpReverence || character.resources.reverence < cost) return;
  const previousMaxHp = maximumHp();
  character.resources.reverence -= cost;
  character.health.permanentBonus += 2;
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  notice(`${cost} Reverence spent. Maximum HP permanently increased by +2.`, "success");
});

dom.characterAtbColor.addEventListener("input", () => {
  character.presentation.atbColor = dom.characterAtbColor.value;
  dom.identityPanel.style.setProperty("--identity-atb-color", character.presentation.atbColor);
  dom.identityCallsign.style.setProperty("--identity-atb-color", character.presentation.atbColor);
  dom.speedPreview.style.setProperty("--atb-preview-color", character.presentation.atbColor);
  queueSave();
});

dom.manualAttributeReroll.addEventListener("click", async () => {
  if (character.phase !== "finalized" || character.resources.reverence < 2 || character.pendingRoll || diceRoller.isActive()) return;
  const accepted = await askConfirmation({
    title: "Spend two Reverence?",
    message: "Spend two Reverence to reroll your Skill Check? (manually rolled dice)",
    acceptLabel: "Spend 2 Reverence",
    cancelLabel: "Cancel",
  });
  if (!accepted || character.resources.reverence < 2) return;
  character.resources.reverence -= 2;
  queueSave();
  renderResources();
  notice("2 Reverence spent for a manually rolled Skill Check reroll.", "success");
});

dom.debugReverence.addEventListener("click", () => {
  character.resources.reverence = Math.min(10, character.resources.reverence + 1);
  queueSave();
  renderResources();
  notice("DEBUG: +1 Reverence.", "success");
});

dom.restExertion.addEventListener("click", async () => {
  if (character.resources.exertionCurrent >= character.resources.exertionMax) return;
  const accepted = await askConfirmation({
    title: "Rest for eight hours?",
    message: "A full eight-hour rest restores every spent Exertion point.",
    acceptLabel: "Rest and Restore",
    cancelLabel: "Keep Going",
  });
  if (!accepted) return;
  character.resources.exertionCurrent = character.resources.exertionMax;
  queueSave();
  renderResources();
  notice("Eight-hour rest complete. Exertion restored.", "success");
});

dom.skillAttributeChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-skill-attribute]");
  if (button) selectSkillAttribute(button.dataset.skillAttribute);
});

dom.changeSkillAttribute.addEventListener("click", () => {
  if (!skillCheck) return;
  skillCheck.attributeKey = null;
  skillCheck.stagedExertion = 0;
  skillCheck.activeSides = [];
  renderSkillAttributeChoices();
});

dom.skillExertionMeter.addEventListener("click", (event) => {
  const unit = event.target.closest("[data-exertion-spend]");
  if (!unit || !skillCheck) return;
  const spend = Number(unit.dataset.exertionSpend);
  skillCheck.stagedExertion = skillCheck.stagedExertion === spend ? 0 : spend;
  renderSkillExertion();
  dom.selectedDicePool.textContent = skillCheckPoolLabel();
});

dom.skillDifficulty.addEventListener("input", () => {
  if (skillCheck) skillCheck.difficulty = dom.skillDifficulty.value;
});

dom.skillFusionChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-fusion-id]");
  if (!button || button.disabled || !skillCheck) return;
  const id = button.dataset.fusionId;
  skillCheck.selectedFusionIds = skillCheck.selectedFusionIds.has(id) ? new Set() : new Set([id]);
  renderFusionSelectionState();
});

dom.campaignForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = dom.campaignCode.value.trim().toUpperCase();
  dom.campaignCode.value = code;
  try {
    await loadCampaign(code);
    dom.campaignMessage.textContent = "";
    renderCampaignRoster();
  } catch (error) {
    dom.campaignMessage.textContent = error.message;
    dom.campaignLobby.hidden = true;
  }
});

dom.campaignCode?.addEventListener("input", () => {
  dom.campaignCode.value = dom.campaignCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
});

dom.campaignRosterCards?.addEventListener("click", (event) => {
  const view = event.target.closest("[data-campaign-view]");
  const recordId = view?.dataset.campaignView;
  if (recordId) openCampaignSheetViewer(recordId);
});

dom.closeCampaignSheetViewer?.addEventListener("click", closeCampaignSheetViewer);
dom.previousCampaignSheet?.addEventListener("click", () => stepCampaignSheet(-1));
dom.nextCampaignSheet?.addEventListener("click", () => stepCampaignSheet(1));

dom.createCampaignCharacter?.addEventListener("click", async () => {
  if (!campaignCode) return;
  try {
    const created = await campaignRequest("/api/campaign/character/create", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, character: blankCharacter(), imported: false }),
    });
    campaignToken = created.token;
    campaignPin = created.pin;
    campaignState = await campaignRequest(`/api/campaign/state?code=${encodeURIComponent(campaignCode)}&token=${encodeURIComponent(campaignToken)}`);
    showCampaignCharacter(created.record, { editable: true, token: campaignToken, pin: campaignPin });
    connectCampaignState();
    showPinDisplay({ title: "New Character PIN", message: "Keep this PIN. It unlocks this character for editing and Experience spending." });
  } catch (error) {
    dom.campaignMessage.textContent = error.message;
  }
});

dom.importCampaignCharacter?.addEventListener("change", async () => {
  const file = dom.importCampaignCharacter.files?.[0];
  if (!file || !campaignCode) return;
  try {
    const parsed = JSON.parse(await file.text());
    const source = parsed?.format === FORMAT_NAME ? parsed.character : parsed.character || parsed;
    if (!source?.identity || !source?.attributes) throw new Error("That file does not contain a valid character.");
    const imported = normalizeCharacter(source);
    imported.id = uid();
    const created = await campaignRequest("/api/campaign/character/create", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, character: imported, imported: true }),
    });
    campaignToken = created.token;
    campaignPin = created.pin;
    campaignState = await campaignRequest(`/api/campaign/state?code=${encodeURIComponent(campaignCode)}&token=${encodeURIComponent(campaignToken)}`);
    showCampaignCharacter(created.record, { editable: true, token: campaignToken, pin: campaignPin });
    connectCampaignState();
    showPinDisplay({ title: "Imported Character PIN", message: "This imported sheet can be edited now, but it must be approved by the GM before campaign play." });
  } catch (error) {
    dom.campaignMessage.textContent = error.message;
  } finally {
    dom.importCampaignCharacter.value = "";
  }
});

dom.campaignPinEntry?.addEventListener("input", () => {
  dom.campaignPinMessage.textContent = "";
});

dom.campaignPinCancel?.addEventListener("click", () => { dom.campaignPinModal.hidden = true; });
dom.campaignPinConfirm?.addEventListener("click", async () => {
  if (pinModalMode === "display") {
    dom.campaignPinModal.hidden = true;
    return;
  }
  try {
    const enteredPin = dom.campaignPinEntry.value;
    const unlocked = await campaignRequest("/api/campaign/character/unlock", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, characterId: pendingPinCharacterId, pcCode: enteredPin }),
    });
    campaignToken = unlocked.token;
    campaignPin = enteredPin;
    campaignState = await campaignRequest(`/api/campaign/state?code=${encodeURIComponent(campaignCode)}&token=${encodeURIComponent(campaignToken)}`);
    dom.campaignPinModal.hidden = true;
    showCampaignCharacter(unlocked.record, { editable: true, token: campaignToken, pin: campaignPin });
    connectCampaignState();
  } catch (error) {
    dom.campaignPinMessage.textContent = error.message;
    dom.campaignPinEntry.select();
  }
});

dom.unlockCampaignCharacter?.addEventListener("click", () => showPinEntry(campaignCharacterId));
dom.showCharacterPin?.addEventListener("click", () => showPinDisplay());
dom.printCharacterSheet?.addEventListener("click", () => {
  openPrintableCharacterSheet(printableCharacterData());
});
dom.localShowPcCode?.addEventListener("click", () => showPinDisplay({
  message: "This PC Code will identify the character after it joins a campaign.",
}));
dom.localPrintCharacter?.addEventListener("click", () => {
  openPrintableCharacterSheet(printableCharacterData());
});
dom.previousCampaignCharacter?.addEventListener("click", () => browseCampaignCharacter(-1));
dom.nextCampaignCharacter?.addEventListener("click", () => browseCampaignCharacter(1));
dom.returnToCampaignRoster?.addEventListener("click", async () => {
  await saveCampaignCharacter();
  campaignCharacterId = "";
  campaignEditable = false;
  campaignPin = "";
  dom.characterWorkspace.hidden = true;
  dom.campaignGate.hidden = false;
  dom.campaignEntryPrompt.hidden = true;
  renderCampaignRoster();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

dom.changeCampaign?.addEventListener("click", () => {
  campaignEvents?.close();
  campaignEvents = null;
  campaignCode = "";
  campaignToken = "";
  campaignState = null;
  campaignCharacterId = "";
  campaignEditable = false;
  dom.campaignLobby.hidden = true;
  dom.campaignEntryPrompt.hidden = false;
  dom.campaignMessage.textContent = "";
  dom.campaignCode.value = "";
  localStorage.removeItem("sa-character-campaign-code");
  dom.campaignCode.focus();
});

dom.sheetSectionTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sheet-section-tab]");
  if (!button) return;
  showSheetSection(button.dataset.sheetSectionTab, { scroll: true });
});

dom.characterLayoutToggle?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-layout-mode]");
  if (!button || creationLayoutForced()) return;
  const mode = button.dataset.layoutMode === "tabs" ? "tabs" : "sheet";
  if (mode === characterLayoutMode) return;
  characterLayoutMode = mode;
  localStorage.setItem(LAYOUT_MODE_KEY, characterLayoutMode);
  renderCharacterLayout();
  notice(characterLayoutMode === "tabs" ? "Tabbed character layout enabled." : "Full character sheet layout enabled.", "success");
});
dom.resourceHudToggle?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hud-visible]");
  if (!button) return;
  resourceHudVisible = button.dataset.hudVisible === "true";
  localStorage.setItem(HUD_VISIBILITY_KEY, resourceHudVisible ? "visible" : "hidden");
  renderTabbedStatus();
  notice(resourceHudVisible ? "Resource HUD enabled." : "Resource HUD hidden.", "success");
});

dom.specialAbilityActions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-special-action]");
  if (!button || button.disabled) return;
  if (button.dataset.specialAction === "marine-recovery") dom.marineHeal.click();
});

dom.tabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-character-tab]");
  if (!button || button.hidden) return;
  const tab = button.dataset.characterTab;
  if (tab === "settings" && campaignState?.role === "character" && campaignState.ownCharacterId && campaignCharacterId !== campaignState.ownCharacterId) {
    const own = campaignState.characters.find((entry) => entry.id === campaignState.ownCharacterId);
    if (own) showCampaignCharacter(own, { editable: true, token: campaignToken, pin: own.pcCode });
  }
  showCharacterPanel(tab);
  if (tab === "roster") {
    let localChanged = false;
    character.localInbox = (character.localInbox || []).map((note) => {
      if (note.readAt) return note;
      localChanged = true;
      return { ...note, readAt: new Date().toISOString() };
    });
    if (localChanged) saveLibrary("Campaign notices read");
    const own = campaignState?.characters.find((entry) => entry.id === campaignState.ownCharacterId);
    const unread = (own?.privateNotes || []).filter((note) => note.direction !== "to-gm" && !note.readAt);
    Promise.all(unread.map((note) => campaignRequest("/api/campaign/note/read", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, noteId: note.id }),
    }).catch(() => null))).then(() => refreshPrivateNotes());
  }
});

dom.joinCampaignRoomCode?.addEventListener("input", () => {
  dom.joinCampaignRoomCode.value = dom.joinCampaignRoomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
});

dom.joinCampaignForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  dom.joinCampaignStatus.textContent = "Sending request...";
  try {
    await requestCampaignJoin(dom.joinCampaignRoomCode.value);
  } catch (error) {
    if (error.message === "Error: Please try a different code") {
      const replacement = await requestPcCode({ title: "Choose a Different PC Code", acceptLabel: "Save New PC Code" });
      if (replacement) {
        character.access.pcCode = replacement;
        saveLibrary("PC Code updated");
        try {
          await requestCampaignJoin(dom.joinCampaignRoomCode.value);
          return;
        } catch (retryError) {
          dom.joinCampaignStatus.textContent = retryError.message;
          return;
        }
      }
    }
    dom.joinCampaignStatus.textContent = error.message;
  }
});

dom.messageGmForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ownId = campaignState?.ownCharacterId;
  if (!campaignCode || !campaignToken || !ownId) return;
  try {
    await campaignRequest("/api/campaign/note/send-to-gm", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: ownId, message: dom.messageGmText.value }),
    });
    dom.messageGmText.value = "";
    notice("Private message sent to the GM.", "success");
  } catch (error) {
    notice(error.message, "error");
  }
});

async function replaceCurrentCharacter(nextCharacter) {
  if (campaignCode || character.campaignLink?.status === "pending") await detachCurrentCharacter({ notify: false });
  snapshotRecovery("Before Character Replacement");
  const previousId = activeId;
  library = library.filter((entry) => entry.id !== previousId);
  const next = normalizeCharacter(nextCharacter);
  next.id = uid();
  next.campaignLink = { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" };
  library.push(next);
  activeId = next.id;
  character = next;
  dom.characterPicker.closest(".library-bar").hidden = false;
  saveLibrary("Replacement character saved locally");
  renderAll();
  renderCharacterNavigation();
  showCharacterPanel("sheet");
}

async function updateCurrentCharacterVersion() {
  if ((Number(character.version) || 1) >= FORMAT_VERSION || CAMPAIGN_READ_ONLY_VIEW) return;
  const accepted = await askConfirmation({
    title: "Update this character?",
    message: "The sheet will use the newest formulas and data format. If this character is in Combat, their ATB resets to 0% and an active Command Window closes. Delay Timers, Delayed Resolutions, and Queued Effects remain in place.",
    acceptLabel: "Update Character",
    cancelLabel: "Not Yet",
  });
  if (!accepted) return;

  const previousMaximum = maximumHp();
  const upgraded = normalizeCharacter({ ...deepCopy(character), version: FORMAT_VERSION, legacyDraft: false });
  upgraded.id = character.id;
  upgraded.phase = character.phase;
  const libraryIndex = library.findIndex((entry) => entry.id === character.id);
  if (libraryIndex >= 0) library[libraryIndex] = upgraded;
  character = upgraded;
  syncDerivedResources(previousMaximum);
  renderAll();
  saveLibrary(`Updated to character version ${FORMAT_VERSION}`);

  let combatReset = false;
  if (campaignCode && campaignCharacterId && campaignEditable) {
    await saveCampaignCharacter({ force: true });
    const timing = derivedValues();
    try {
      await campaignRequest("/api/action", {
        method: "POST",
        body: JSON.stringify({
          roomCode: campaignCode,
          characterId: campaignCharacterId,
          characterToken: campaignToken,
          action: "refreshCharacterVersion",
          characterName: character.identity.characterName,
          playerName: character.identity.playerName,
          color: character.presentation.atbColor,
          speed: timing.speed,
          commandWindow: timing.command,
        }),
      });
      combatReset = true;
      if (dom.playerAtbFrame?.getAttribute("src")) void loadPlayerAtb({ reload: true });
    } catch (error) {
      notice(`Character updated, but Combat could not refresh: ${error.message}`, "error");
    }
  }
  renderCharacterNavigation();
  notice(`Character updated to version ${FORMAT_VERSION}.${combatReset ? " Combat ATB reset to 0%." : ""}`, "success");
}

dom.updateCharacterVersion?.addEventListener("click", updateCurrentCharacterVersion);
dom.settingsExportCharacter?.addEventListener("click", exportCurrentCharacter);

dom.settingsLoadCharacter?.addEventListener("change", async () => {
  const file = dom.settingsLoadCharacter.files?.[0];
  if (!file) return;
  const accepted = await askConfirmation({
    title: "Replace the current character?",
    message: "This character will leave the campaign. Export Character Data first if you need a portable backup.",
    acceptLabel: "Load Replacement",
    cancelLabel: "Cancel",
    danger: true,
  });
  if (!accepted) { dom.settingsLoadCharacter.value = ""; return; }
  try {
    const parsed = JSON.parse(await file.text());
    const source = parsed?.format === FORMAT_NAME ? parsed.character : parsed.character || parsed;
    if (!source?.identity || !source?.attributes) throw new Error("That file does not contain a valid character.");
    await replaceCurrentCharacter(source);
    notice("Replacement character loaded. Use Join Campaign when ready.", "success");
  } catch (error) {
    notice(error.message, "error");
  } finally {
    dom.settingsLoadCharacter.value = "";
  }
});

dom.settingsNewCharacter?.addEventListener("click", async () => {
  const accepted = await askConfirmation({
    title: "Replace this character with a new one?",
    message: "This character will leave the campaign. Export Character Data first if you need a portable backup.",
    acceptLabel: "Make New Character",
    cancelLabel: "Cancel",
    danger: true,
  });
  if (!accepted) return;
  await replaceCurrentCharacter(blankCharacter("New Character"));
  notice("Fresh character created. The previous campaign link was removed.", "success");
});

dom.settingsLeaveCampaign?.addEventListener("click", async () => {
  const pending = character.campaignLink?.status === "pending";
  const accepted = await askConfirmation({
    title: pending ? "Cancel this campaign request?" : "Leave this campaign?",
    message: pending
      ? "The GM approval request will be cancelled and this character may request entry into a different campaign."
      : "This character will be removed from the campaign roster and may join a different campaign. Export Character Data first if you need a portable backup.",
    acceptLabel: pending ? "Cancel Request" : "Leave Campaign",
    cancelLabel: pending ? "Keep Waiting" : "Stay",
    danger: true,
  });
  if (!accepted) return;
  try {
    await detachCurrentCharacter();
    showCharacterPanel("sheet");
  } catch (error) {
    notice(error.message, "error");
  }
});

dom.settingsLogout?.addEventListener("click", async () => {
  await saveCampaignCharacter({ force: true });
  campaignEvents?.close();
  if (campaignCode && campaignCharacterId) localStorage.removeItem(campaignTokenKey(campaignCode, campaignCharacterId));
  localStorage.removeItem("sa-character-campaign-code");
  window.location.href = "index.html";
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source === dom.campaignSheetFrame?.contentWindow && event.data?.type === "sa-character-sheet-height") {
    const height = Math.max(500, Math.min(12000, Number(event.data.height) || 900));
    dom.campaignSheetFrame.style.height = `${height}px`;
    return;
  }
  if (event.source !== dom.playerAtbFrame?.contentWindow || event.data?.type !== "sa-combat-layout") return;
  const preview = Boolean(event.data.preview);
  dom.playerAtbFrame.closest(".player-atb-live")?.classList.toggle("combat-preview", preview);
  dom.playerAtbStatus.textContent = preview
    ? "No active encounter. Showing your live Speed preview."
    : "Live Combat connected. Use the tabs above at any time.";
});

dom.playerAtbFrame?.addEventListener("load", () => {
  dom.playerAtbStatus.textContent = "Live encounter connected. Use the tabs above at any time; combat will remain open here.";
});

dom.launchPlayerAtb?.addEventListener("click", () => {
  void loadPlayerAtb({ reload: true });
});

dom.angilurosSpeedBoost?.addEventListener("click", async () => {
  if (character.identity.raceId !== "angiluros" || character.resources.exertionCurrent < 2 || !campaignCharacterId) return;
  const accepted = await askConfirmation({
    title: "Spend 2 Exertion?",
    message: "This Angiluros gains +4 Speed until the current encounter ends.",
    acceptLabel: "Spend Exertion",
    cancelLabel: "Cancel",
  });
  if (!accepted) return;
  character.resources.exertionCurrent -= 2;
  queueSave();
  renderResources();
  try {
    await campaignRequest("/api/action", {
      method: "POST",
      body: JSON.stringify({ roomCode: campaignCode, characterId: campaignCharacterId, characterToken: campaignToken, action: "characterSpeedBoost" }),
    });
    dom.angilurosSpeedBoost.disabled = true;
    notice("+4 encounter Speed activated.", "success");
  } catch (error) {
    character.resources.exertionCurrent += 2;
    queueSave();
    renderResources();
    notice(error.message, "error");
  }
});

dom.privateNotesList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-note]");
  if (!button || !campaignEditable) return;
  try {
    await campaignRequest("/api/campaign/note/delete", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, noteId: button.dataset.deleteNote }),
    });
  } catch (error) { notice(error.message, "error"); }
});

dom.openCampaignBank?.addEventListener("click", () => {
  renderCampaignBank();
  dom.campaignBankModal.hidden = false;
});
dom.saveAndSyncCharacter?.addEventListener("click", async () => {
  if (!campaignEditable) return;
  snapshotRecovery("Session Save");
  saveLibrary("Saved locally");
  dom.saveAndSyncCharacter.disabled = true;
  dom.saveAndSyncCharacter.textContent = "Syncing...";
  const synced = await saveCampaignCharacter({ force: true });
  dom.saveAndSyncCharacter.disabled = false;
  dom.saveAndSyncCharacter.textContent = "Save & Sync";
  notice(synced ? "Character saved locally and synchronized with the campaign." : "Saved locally. Server synchronization will retry automatically.", synced ? "success" : "error");
});
dom.bankCancel?.addEventListener("click", () => { dom.campaignBankModal.hidden = true; });
dom.bankOperation?.addEventListener("change", renderCampaignBank);
dom.bankConfirm?.addEventListener("click", async () => {
  if (!campaignEditable || dom.bankConfirm.disabled) return;
  try {
    await saveCampaignCharacter();
    const payload = await campaignRequest("/api/campaign/credits/transfer", {
      method: "POST",
      body: JSON.stringify({
        code: campaignCode,
        token: campaignToken,
        characterId: campaignCharacterId,
        operation: dom.bankOperation.value,
        targetCharacterId: dom.bankTarget.value || null,
        amount: dom.bankAmount.value,
      }),
    });
    receiveCampaignState(payload.campaign);
    dom.campaignBankModal.hidden = true;
    notice("Campaign resource action completed.", "success");
  } catch (error) {
    dom.bankAuthority.textContent = error.message;
  }
});

dom.openCampaignRoll?.addEventListener("click", openRequestedCampaignRoll);

dom.calculateManualSkill.addEventListener("click", calculateManualSkillResult);
dom.rollSkillCheck.addEventListener("click", rollSkillCheck);
dom.rerollSkillCheck.addEventListener("click", beginSkillReroll);
dom.freeRuleReroll.addEventListener("click", useFreeRuleReroll);
dom.skillCheckClose.addEventListener("click", closeSkillCheck);
dom.cancelSkillCheck.addEventListener("click", closeSkillCheck);
dom.exitSkillResult.addEventListener("click", closeSkillCheck);

dom.fubsButton.addEventListener("click", () => {
  if (character.fubs.status === "complete") showFubsResult();
  else beginFubsRoll();
});

dom.fubsDebugRoll.addEventListener("click", async () => {
  const value = Math.round(Number(dom.fubsDebugValue.value) || 0);
  if (value < 1 || value > 100) {
    notice("DEBUG FUBS result must be from 1 to 100.", "error");
    return;
  }
  if (!backgroundComplete()) {
    await showBackstoryRequired();
    return;
  }
  performFubsRoll({ forcedFirst: value, debug: true });
});

dom.fubsReroll.addEventListener("click", rerollFubs);
dom.fubsExit.addEventListener("click", closeFubsResult);

dom.pcCodeCancel.addEventListener("click", () => closePcCodeModal(""));
dom.pcCodeAccept.addEventListener("click", () => {
  const first = dom.pcCodeFirst.value;
  const repeated = dom.pcCodeConfirm.value;
  if (!first) {
    dom.pcCodeMessage.textContent = "Choose a PC Code before continuing.";
    dom.pcCodeFirst.focus();
    return;
  }
  if (first !== repeated) {
    dom.pcCodeMessage.textContent = "The two PC Codes do not match. Type it again carefully.";
    dom.pcCodeConfirm.select();
    return;
  }
  closePcCodeModal(first);
});

dom.restoreHp.addEventListener("click", () => {
  character.health.current = maximumHp();
  queueSave();
  renderDerived();
});

dom.marineHeal.addEventListener("click", async () => {
  if (character.identity.classId !== "marine-soldier" || character.session.marineHealingUsed || diceRoller.isActive()) return;
  const accepted = await askConfirmation({
    title: "Use Marine Recovery?",
    message: "Roll every Willpower die and heal the sum. This can be used once per session.",
    acceptLabel: "Roll Willpower",
    cancelLabel: "Cancel",
  });
  if (!accepted) return;
  const sides = attributeDiceSides("willpower");
  character.session.marineHealingUsed = true;
  queueSave();
  diceRoller.rollPool({
    sides,
    title: "Marine Recovery",
    subtitle: "Every Willpower die restores HP",
    fusion: false,
    onResolved: () => {},
    onSettled: (results) => {
      const healing = results.reduce((sum, value) => sum + value, 0);
      character.health.current = Math.min(maximumHp(), character.health.current + healing);
      diceRoller.stop();
      saveLibrary("Marine Recovery applied");
      renderAll();
      notice(`Marine Recovery restored ${healing} HP.`, "success");
    },
  });
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
dom.skillSort?.addEventListener("change", () => {
  skillSortMode = SKILL_SORT_MODES.has(dom.skillSort.value) ? dom.skillSort.value : "alphabetical";
  localStorage.setItem(SKILL_SORT_KEY, skillSortMode);
  renderSkills();
});
window.addEventListener("beforeunload", () => {
  if (CAMPAIGN_READ_ONLY_VIEW) return;
  saveLibrary();
  if (campaignCode && campaignCharacterId && campaignEditable && campaignDirty) {
    const body = JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, baseCredits: campaignBaselineCredits, baseCurrentHp: campaignBaselineHp, character });
    navigator.sendBeacon?.("/api/campaign/character/save", new Blob([body], { type: "application/json" }));
  }
});

async function initializeCharacterApp() {
  const params = PAGE_PARAMS;
  document.body.classList.toggle("embedded-sheet", params.get("embedded") === "1");
  const requestedCode = String(params.get("campaign") || localStorage.getItem("sa-character-campaign-code") || "").trim().toUpperCase();
  const requestedCharacter = String(params.get("character") || "");
  const gmAccess = params.get("gm") === "1";
  if (params.get("new") === "1" && !requestedCode && !requestedCharacter) {
    const next = blankCharacter(`New Character ${library.length + 1}`);
    library.push(next);
    activeId = next.id;
    character = next;
    dom.skillSearch.value = "";
    saveLibrary("New character saved locally");
    window.history.replaceState({}, "", "character.html");
    renderAll();
  }
  dom.campaignCode.value = /^[A-Z0-9]{4}$/.test(requestedCode) ? requestedCode : "";
  dom.campaignGate.hidden = true;
  dom.characterWorkspace.hidden = false;
  if (requestedCode && requestedCharacter) {
    const token = gmAccess
      ? localStorage.getItem(`sa-gm-token-${requestedCode}`) || ""
      : localStorage.getItem(campaignTokenKey(requestedCode, requestedCharacter)) || "";
    try {
      const state = await loadCampaign(requestedCode, token);
      const record = state.characters.find((entry) => entry.id === requestedCharacter);
      if (record) {
        const editable = state.role === "gm" || (state.role === "character" && state.ownCharacterId === requestedCharacter);
        showCampaignCharacter(record, { editable, token, pin: record.pcCode || "" });
        if (editable && character.phase === "finalizing") window.setTimeout(processFinalization, 120);
        else if (editable && character.pendingRoll) window.setTimeout(rollPending, 120);
        return;
      }
    } catch (error) {
      dom.campaignMessage.textContent = error.message;
      if (error.status === 404 && character.campaignLink?.roomCode === requestedCode) {
        character.campaignLink = { roomCode: "", campaignName: "", status: "unlinked", requestId: "", message: "" };
        localStorage.removeItem("sa-character-campaign-code");
        saveLibrary("Character preserved locally");
        notice("That campaign was deleted. Your character remains saved on this device.", "error");
      }
    }
  }
  if (requestedCode && !requestedCharacter) {
    localStorage.removeItem("sa-character-campaign-code");
  }
  renderCharacterNavigation();
  showCharacterPanel("sheet");
  if (character.campaignLink?.status === "pending") scheduleJoinStatusCheck(800);
}

function publishEmbeddedCharacterHeight() {
  if (!CAMPAIGN_READ_ONLY_VIEW || window.parent === window) return;
  const height = Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  window.parent.postMessage({ type: "sa-character-sheet-height", height }, window.location.origin);
}

if (CAMPAIGN_READ_ONLY_VIEW && "ResizeObserver" in window) {
  const embeddedSizeObserver = new ResizeObserver(() => publishEmbeddedCharacterHeight());
  embeddedSizeObserver.observe(document.documentElement);
  window.addEventListener("load", publishEmbeddedCharacterHeight);
}
renderAll();
if (!CAMPAIGN_READ_ONLY_VIEW) saveLibrary("Saved locally");
initializeCharacterApp();
