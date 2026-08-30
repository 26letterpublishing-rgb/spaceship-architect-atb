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
} from "./character-data.js?v=20260816-atb-2e";
import { FUBS_CHAIN_RESULTS, fubsEntry } from "./fubs-data.js?v=20260807-tabs-2";
import { PhysicalDiceRoller } from "./dice-roller.js?v=20260813-feedback-2";
import { openPrintableCharacterSheet } from "./character-print.js?v=20260807-tabs-2";
import { WEAPONS, weaponById } from "./weapon-data.js?v=20260816-atb-2e";
import { GEAR, gearById } from "./gear-data.js?v=20260814-items-1";

const {
  DRAMA_CARD_COST = 4,
  DRAMA_CARD_HAND_LIMIT = 7,
} = globalThis.SA_DRAMA_CARDS || {};

const STORAGE_KEY = "sa2e-character-library-v1";
const RACE_CARD_PROFILES = {
  bruggle: {
    image: "race-bruggle.png",
    preview: "Powerful amphibious socialites built for rough climates and rougher company.",
    description: "Bruggles are towering, powerfully built amphibians descended from Antropic Fins on Tarinian Volkmire. Their dense muscles developed under intense gravity, while their patterned hides range from swamp greens and earth browns to rare yellows and oranges. Bruggle culture is loud, social, and fiercely physical. Friendly arguments can become contests of strength, taverns are natural gathering places, and a hard fight is often remembered as fondly as a good meal. They are carnivorous, comfortable in punishing heat or cold, and equally at home on land or underwater.",
    focus: "center top",
  },
  grey: {
    image: "race-grey.png",
    preview: "Ancient, observant telepaths who study developing civilizations from the dark.",
    description: "Greys are short, slender humanoids recognized by smooth gray skin, oversized heads, narrow mouths, nose slits, and enormous black eyes. Their civilization has observed younger species for ages, recording discoveries and enforcing a strict principle of noninterference until a world develops warp travel. Greys favor simple, close-fitting clothing and quiet efficiency. Their intelligence and telekinetic gifts make them formidable observers, while their fragile bodies and unfamiliar relationship with physical force shape the way they survive direct conflict.",
    focus: "center top",
  },
  human: {
    image: "race-human.png",
    preview: "Adaptable newcomers whose flexibility becomes experience after creation.",
    description: "Humans are ambitious, adaptable, and unusually quick to turn hard-won experience into practical skill. They lack the dramatic biological gifts of many starfaring species, but compensate with curiosity, cultural variety, and a stubborn talent for surviving unfamiliar situations. Human crews can be found in nearly every role, from explorers and diplomats to engineers and soldiers.",
    focus: "center top",
  },
  android: {
    image: "race-android.png",
    preview: "Engineered synthetic people with tireless bodies and customizable forms.",
    description: "Androids are constructed people whose bodies range from convincingly organic replicas to visibly mechanical robots. They do not age, breathe, eat, sleep, or suffer ordinary disease, but must periodically recharge and depend on Credits rather than Experience for personal development. Their chosen construction type defines how convincingly human or deliberately mechanical they appear.",
    focus: "center top",
    subtypes: {
      "perfect-android": {
        image: "race-android-perfect-android.webp",
        description: "Perfect Androids are synthetic people built to pass as organic humans. Artificial skin, hair, expression, and movement conceal a precision-engineered body beneath the surface. Their human appearance makes them natural infiltrators and diplomats, although medical scans and physical damage can reveal the machinery within.",
      },
      "imperfect-android": {
        image: "race-android-imperfect-android.webp",
        description: "Imperfect Androids resemble humans without attempting to hide their construction. Visible seams, mechanical joints, synthetic eyes, and exposed components make their nature obvious. Many embrace that identity, combining an approachable humanoid silhouette with the durability and adaptability of a machine.",
      },
      "perfect-robot": {
        image: "race-android-perfect-robot.webp",
        description: "Perfect Robots are openly mechanical people housed in pristine, purpose-built bodies. They make no attempt to imitate organic life. Their elegant frames are designed for efficiency, durability, and specialized work, often appearing more like advanced spacecraft technology than a conventional humanoid.",
      },
      "imperfect-robot": {
        image: "race-android-imperfect-robot.webp",
        description: "Imperfect Robots inhabit practical machine bodies assembled for function rather than beauty. Industrial plating, replacement parts, repair seams, and mismatched components are common. Their rugged construction makes them easy to maintain and gives every Imperfect Robot a visibly unique history.",
      },
    },
  },
  antropic: {
    image: "race-antropic.png",
    preview: "A diverse evolutionary family whose Fangs, Feathers, Fins, and Fluffy forms differ sharply.",
    description: "Antropics are a broad family of related humanoids shaped by radically different environments. Fangs are nocturnal predators, Feathers are agile fliers, Fins are aquatic regenerators, and Fluffy Antropics are quick, expressive, and difficult to pin down. Choose a form to see the specific advantages and disadvantages carried by that branch of the species.",
    focus: "center top",
    subtypes: {
      fangs: {
        image: "race-antropic-fangs.webp",
        description: "Antropic Fangs are nocturnal hunters distinguished by large ears, predatory teeth, and senses adapted to darkness. Their bodies are built for stalking prey and sudden close-range violence. Some enter long hibernation cycles, but when awake they are alert, patient, and exceptionally dangerous without a weapon.",
      },
      feather: {
        image: "race-antropic-feather.webp",
        description: "Antropic Feathers are lightweight avian humanoids with broad wings, plumage, and hollow bones. They are agile in the air and unusually quick on the ground, but their delicate frames cannot absorb punishment like heavier species. Armor and sealed spaces can limit the freedom their wings normally provide.",
      },
      fins: {
        image: "race-antropic-fins.webp",
        description: "Antropic Fins are aquatic humanoids with gills, webbed hands, and bodies adapted to life beneath the surface. Their remarkable regenerative biology slowly restores injuries, and they move through water with effortless speed. Away from water they remain capable, but their unusual senses and anatomy mark them immediately.",
      },
      fluffy: {
        image: "race-antropic-fluffy.webp",
        description: "Fluffy Antropics are fur-covered mammalian humanoids known for quick movement, expressive behavior, and deceptive resilience. Their insulating coats protect them from harsh climates, while their reflexes make them difficult to catch or restrain. Their appearance varies widely, but their energy rarely does.",
      },
    },
  },
  garmoc: {
    image: "race-garmoc.png",
    preview: "Massive armored predators whose fused physical dice can awaken D20 power.",
    description: "Garmocs are imposing reptilian predators protected by dense natural armor and formidable reserves of health. Their physical resilience makes them terrifying in direct conflict, and exceptional physical fusions can add independent D20 results to a roll. Their biology is less suited to delicate intellectual and social work, where very high results are limited and dice cannot fuse.",
    focus: "center top",
  },
  pattanilia: {
    image: "race-pattanilia.png",
    preview: "Aquatic multispectrum observers with extraordinary technical intuition.",
    description: "Pattanilia are graceful aquatic humanoids whose senses extend far beyond ordinary visible light. They can breathe underwater, perceive heat, radio, sound, radiation, and other spectra, and display an exceptional instinct for starship systems. Their slight frames are vulnerable in direct physical combat, but their perception, intellect, willpower, and technical adaptability make them remarkably capable explorers.",
    focus: "center top",
  },
  angiluros: {
    image: "race-angiluros.webp",
    preview: "Proud feline warriors who craft their own path, their own weapons, and their own honor.",
    description: "Angiluros are tall feline humanoids whose patterned fur, handmade jewelry, and tribal garments reflect a culture shaped by a devastated homeworld. They prize honor, self-reliance, spiritual discipline, and craftsmanship. An Angiluros is expected to make their own weapons rather than trust metalwork produced by outsiders, and many carry that conviction into space with fierce pride.",
    focus: "center top",
  },
  spiddix: {
    image: "race-spiddix.webp",
    preview: "Brilliant living brains who rely on customizable mechanical bodies to navigate the galaxy.",
    description: "Spiddix are enormous living brains with eyes, mouths, and small vestigial appendages. To interact with the physical world they inhabit mechanical cradles ranging from humanoid frames to many-legged industrial bodies. Their machines can be rebuilt and improved, but separation leaves the organic Spiddix almost immobile and dangerously vulnerable.",
    focus: "center top",
  },
  "yetuak-zune": {
    image: "race-yetuak-zune.webp",
    preview: "Long-lived ice mystics who balance ritual, logic, and an intimate understanding of the cold.",
    description: "Ye'tuak Zune are long-lived, elf-like beings from a frozen world. Their skin ranges through blue, violet, and near-black hues, and their pointed ears and dark ceremonial robes reflect an ancient spiritual culture. They approach unfamiliar problems with ritual precision and cool logic, endure extreme cold without fear, and see clearly through darkness and heat.",
    focus: "center top",
  },
};

const CLASS_CARD_PROFILES = {
  "": { icon: "?", preview: "Still deciding what kind of trouble suits you.", color: "#8293a2" },
  "ambassador-spy": { icon: "&#9678;", preview: "Always knows what to say, and what not to say.", color: "#e774c8" },
  blessed: { icon: "&#10022;", preview: "Seems luck is on your side.", color: "#f4d75d" },
  "corporate-worker": { icon: "$", preview: "Everything has a price, especially loyalty.", color: "#70dc9c" },
  decker: { icon: "&lt;/&gt;", preview: "Treats locked systems as personal invitations.", color: "#4ed8ed" },
  "demolition-specialist": { icon: "&#10038;", preview: "Used to play with lighters as a kid.", color: "#ff774f" },
  engineer: { icon: "&#128295;", preview: "Keeps machines alive through talent and stubbornness.", color: "#58d8aa" },
  gunner: { icon: "&#8853;", preview: "Good with guns and weapon stations.", color: "#ff5c70" },
  heavy: { icon: "&#9646;", preview: "Carries the weapon everyone else called impractical.", color: "#b6a58b" },
  informant: { icon: "&#8981;", preview: "Knows somebody everywhere.", color: "#9aa8ff" },
  "marine-soldier": { icon: "&#9733;", preview: "Trained to keep fighting when everyone else stops.", color: "#83b777" },
  mastermind: { icon: "&#9004;", preview: "Already planned for this three problems ago.", color: "#b783ff" },
  "medical-officer": { icon: "+", preview: "Keeps the crew breathing despite their best efforts.", color: "#62e2b3" },
  "navigator-sensor-tech": { icon: "&#8982;", preview: "Finds the path and sees trouble coming.", color: "#5bc7ff" },
  ninja: { icon: "&#9670;", preview: "Was never there. Definitely did not touch anything.", color: "#8d7ed2" },
  peacekeeper: { icon: "&#9774;", preview: "Prefers words, but came prepared.", color: "#7ee0d9" },
  pirate: { icon: "&#9760;", preview: "Finders keepers is a professional philosophy.", color: "#d59a61" },
  "playboy-minx": { icon: "&#128139;", preview: "Charm first. Consequences later.", color: "#ff73b6" },
  psychopath: { icon: "!", preview: "Violence is rarely the first answer.", color: "#df5268" },
  "robotics-worker": { icon: "&#9881;", preview: "Understands machines better than most people.", color: "#69c8d8" },
  "rogue-drifter": { icon: "&#8605;", preview: "Never stays anywhere long enough to be blamed.", color: "#d0b278" },
  "science-officer": { icon: "&#9879;", preview: "Has a hypothesis and very little fear.", color: "#62b4ff" },
  "scout-sniper": { icon: "&#9673;", preview: "Sees the danger before it sees the crew.", color: "#92c66f" },
  smuggler: { icon: "&#9671;", preview: "Can get almost anything past almost anyone.", color: "#e1a65c" },
  tactician: { icon: "&#9823;", preview: "Turns a group of individuals into a plan.", color: "#8fa8ff" },
  other: { icon: "?", preview: "Does not fit cleanly into anyone else's category.", color: "#d27ee8" },
};
const CAMPAIGN_CACHE_PREFIX = "sa-character-campaign-cache-v1-";
const CAMPAIGN_CHARACTER_PREFIX = "sa-character-local-v1-";
const ACTIVE_KEY = "sa2e-active-character-v1";
const RECOVERY_KEY = "sa2e-character-recovery-v1";
const ACTIVE_DRAFT_KEY = "sa2e-active-draft-v1";
const SHOWCASE_MODE = new URLSearchParams(location.search).get("showcase") === "1";
const LAYOUT_MODE_KEY = "sa2e-character-layout-v1";
const HUD_VISIBILITY_KEY = "sa2e-character-hud-visible-v1";
const PLAYER_BANNER_MODE_KEY = "sa-player-banner-mode-v1";
const PLAYER_SOUND_KEY = "sa-atb-alerts";
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
const FORMAT_VERSION = 7;
const ALL_SKILLS = [...SPACECRAFT_SKILLS, ...GENERAL_SKILLS];
const DEBUG_CONTROLS_ENABLED = false;
const PAGE_PARAMS = new URLSearchParams(window.location.search);
const CAMPAIGN_READ_ONLY_VIEW = PAGE_PARAMS.get("campaignView") === "1";
const GM_ADJUSTMENT_MODE = PAGE_PARAMS.get("gmAdjust") === "1";
const $ = (selector) => document.querySelector(selector);

const dom = {
  characterPicker: $("#characterPicker"),
  newCharacter: $("#newCharacter"),
  duplicateCharacter: $("#duplicateCharacter"),
  exportCharacter: $("#exportCharacter"),
  openImportMenu: $("#openImportMenu"),
  importCharacter: $("#importCharacter"),
  deleteCharacter: $("#deleteCharacter"),
  localShowPcCode: $("#localShowPcCode"),
  localPrintCharacter: $("#localPrintCharacter"),
  characterSheet: $("#characterSheet"),
  tabbedToolbar: $("#tabbedCharacterToolbar"),
  sheetSectionTabs: $("#sheetSectionTabs"),
  globalCharacterHud: $("#globalCharacterHud"),
  tabStatusHearts: $("#tabStatusHearts"),
  tabStatusExperience: $("#tabStatusExperience"),
  tabStatusHp: $("#tabStatusHp"),
  tabStatusReverence: $("#tabStatusReverence"),
  tabStatusExertion: $("#tabStatusExertion"),
  tabStatusCredits: $("#tabStatusCredits"),
  hudWeaponOverload: $("#hudWeaponOverload"),
  syncIndicator: $("#syncIndicator"),
  characterBanner: $("#characterBanner"),
  creatorTitle: $("#creatorTitle"),
  creatorCampaignTitle: $("#creatorCampaignTitle"),
  creatorRoleLabel: $("#creatorRoleLabel"),
  gmAdjustmentBar: $("#gmAdjustmentBar"),
  gmAdjustmentCharacterName: $("#gmAdjustmentCharacterName"),
  saveGmAdjustment: $("#saveGmAdjustment"),
  cancelGmAdjustment: $("#cancelGmAdjustment"),
  saveStatus: $("#saveStatus"),
  identityPanel: $(".identity-panel"),
  identityCallsign: $("#identityCallsign"),
  racePicker: $("#racePicker"),
  raceCardPickerButton: $("#raceCardPickerButton"),
  raceGalleryModal: $("#raceGalleryModal"),
  raceGalleryChooser: $("#raceGalleryChooser"),
  raceGalleryGrid: $("#raceGalleryGrid"),
  raceGalleryFallback: $("#raceGalleryFallback"),
  closeRaceGallery: $("#closeRaceGallery"),
  raceCardDetail: $("#raceCardDetail"),
  raceCardDetailImage: $("#raceCardDetailImage"),
  raceCardDetailName: $("#raceCardDetailName"),
  raceCardDetailDescription: $("#raceCardDetailDescription"),
  raceCardAdvantages: $("#raceCardAdvantages"),
  raceCardDisadvantages: $("#raceCardDisadvantages"),
  raceSubtypeControls: $("#raceSubtypeControls"),
  previousRaceSubtype: $("#previousRaceSubtype"),
  nextRaceSubtype: $("#nextRaceSubtype"),
  raceSubtypeName: $("#raceSubtypeName"),
  backToRaceGallery: $("#backToRaceGallery"),
  chooseRaceCard: $("#chooseRaceCard"),
  raceCustom: $("#raceCustom"),
  raceTypeField: $("#raceTypeField"),
  raceTypePicker: $("#raceTypePicker"),
  classPicker: $("#classPicker"),
  classCardPickerButton: $("#classCardPickerButton"),
  classGalleryModal: $("#classGalleryModal"),
  classGalleryGrid: $("#classGalleryGrid"),
  closeClassGallery: $("#closeClassGallery"),
  classGalleryChooser: $("#classGalleryChooser"),
  classCardDetail: $("#classCardDetail"),
  classCardDetailName: $("#classCardDetailName"),
  classCardDetailIcon: $("#classCardDetailIcon"),
  classCardDetailSummary: $("#classCardDetailSummary"),
  classCardDetailNotes: $("#classCardDetailNotes"),
  backToClassGallery: $("#backToClassGallery"),
  chooseClassCard: $("#chooseClassCard"),
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
  spendOneExertion: $("#spendOneExertion"),
  moveSpeedValue: $("#moveSpeedValue"),
  moveSpeedFormula: $("#moveSpeedFormula"),
  creditsValue: $("#creditsValue"),
  creditsFormula: $("#creditsFormula"),
  manualDataPanel: $("#manualDataPanel"),
  dramaCardsValue: $("#dramaCardsValue"),
  dramaCardsFormula: $("#dramaCardsFormula"),
  purchaseDramaCard: $("#purchaseDramaCard"),
  dramaCardHandPanel: $("#dramaCardHandPanel"),
  dramaCardHandStatus: $("#dramaCardHandStatus"),
  dramaCardHand: $("#dramaCardHand"),
  dramaCardModal: $("#dramaCardModal"),
  dramaCardDisplay: $("#dramaCardDisplay"),
  dramaCardCategory: $("#dramaCardCategory"),
  dramaCardNumber: $("#dramaCardNumber"),
  dramaCardDialogTitle: $("#dramaCardDialogTitle"),
  dramaCardRules: $("#dramaCardRules"),
  dramaCardHandling: $("#dramaCardHandling"),
  dramaCardAlertByline: $("#dramaCardAlertByline"),
  closeDramaCard: $("#closeDramaCard"),
  playDramaCard: $("#playDramaCard"),
  specialAbilitiesCard: $("#specialAbilitiesCard"),
  specialAbilityActions: $("#specialAbilityActions"),
  reverenceCurrent: $("#reverenceCurrent"),
  reverenceMeter: $("#reverenceMeter"),
  giftReverence: $("#giftReverence"),
  spendOneReverence: $("#spendOneReverence"),
  maxHpBonus: $("#maxHpBonus"),
  characterAtbColor: $("#characterAtbColor"),
  debugReverence: $("#debugReverence"),
  crewRoster: $("#crewRoster"),
  addCrewRow: $("#addCrewRow"),
  weaponInventory: $("#weaponInventory"),
  addWeaponRow: $("#addWeaponRow"),
  weaponSlotPyramid: $("#weaponSlotPyramid"),
  weaponSlotAssignments: $("#weaponSlotAssignments"),
  weaponSlotStatus: $("#weaponSlotStatus"),
  weaponSlotWarning: $("#weaponSlotWarning"),
  gearPickerModal: $("#gearPickerModal"),
  gearCatalogSearch: $("#gearCatalogSearch"),
  gearCatalogPicker: $("#gearCatalogPicker"),
  gearCatalogStatus: $("#gearCatalogStatus"),
  gearPickerName: $("#gearPickerName"),
  gearPickerDescription: $("#gearPickerDescription"),
  gearPickerCost: $("#gearPickerCost"),
  gearPickerError: $("#gearPickerError"),
  gearPickerCancel: $("#gearPickerCancel"),
  gearPickerReceive: $("#gearPickerReceive"),
  gearPickerPurchase: $("#gearPickerPurchase"),
  reverenceGiftModal: $("#reverenceGiftModal"),
  reverenceGiftTarget: $("#reverenceGiftTarget"),
  reverenceGiftAmount: $("#reverenceGiftAmount"),
  reverenceGiftError: $("#reverenceGiftError"),
  reverenceGiftCancel: $("#reverenceGiftCancel"),
  reverenceGiftSend: $("#reverenceGiftSend"),
  gearInventory: $("#gearInventory"),
  gearInventoryEmpty: $("#gearInventoryEmpty"),
  addGearRow: $("#addGearRow"),
  storedGearInventory: $("#storedGearInventory"),
  storedGearEmpty: $("#storedGearEmpty"),
  storeGearButton: $("#storeGearButton"),
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
  skillEquipmentBlock: $("#skillEquipmentBlock"),
  skillEquipmentChoices: $("#skillEquipmentChoices"),
  skillDifficulty: $("#skillDifficulty"),
  manualSkillScore: $("#manualSkillScore"),
  cancelSkillCheck: $("#cancelSkillCheck"),
  calculateManualSkill: $("#calculateManualSkill"),
  rollSkillCheck: $("#rollSkillCheck"),
  skillResultStage: $("#skillResultStage"),
  skillResultLabel: $("#skillResultLabel"),
  skillResultScore: $("#skillResultScore"),
  skillResultEquation: $("#skillResultEquation"),
  skillResultRules: $("#skillResultRules"),
  skillResultOutcome: $("#skillResultOutcome"),
  skillFusionResults: $("#skillFusionResults"),
  skillFusionChoices: $("#skillFusionChoices"),
  skillFusionWarning: $("#skillFusionWarning"),
  rerollSkillCheck: $("#rerollSkillCheck"),
  freeRuleReroll: $("#freeRuleReroll"),
  exitSkillResult: $("#exitSkillResult"),
  combatDamageModal: $("#combatDamageModal"),
  combatDamageTitle: $("#combatDamageTitle"),
  combatDamageSubtitle: $("#combatDamageSubtitle"),
  combatDamageCritical: $("#combatDamageCritical"),
  combatDamageWeapon: $("#combatDamageWeapon"),
  combatDamageFormula: $("#combatDamageFormula"),
  combatDamageTarget: $("#combatDamageTarget"),
  combatDamageManual: $("#combatDamageManual"),
  combatDamageResult: $("#combatDamageResult"),
  combatDamageError: $("#combatDamageError"),
  submitManualCombatDamage: $("#submitManualCombatDamage"),
  rollCombatDamage: $("#rollCombatDamage"),
  exitCombatDamageResult: $("#exitCombatDamageResult"),
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
  campaignStarshipRoster: $("#campaignStarshipRoster"),
  campaignStarshipCards: $("#campaignStarshipCards"),
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
  bannerVisibilityToggle: $("#bannerVisibilityToggle"),
  playerSoundToggle: $("#playerSoundToggle"),
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
  importChoiceModal: $("#importChoiceModal"),
  importFileChoice: $("#importFileChoice"),
  manualInputChoice: $("#manualInputChoice"),
  cancelImportChoice: $("#cancelImportChoice"),
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

function playRewardChime(resource = "experience") {
  if (!playerSoundsEnabled) return;
  const audio = ensureCharacterAudio();
  if (!audio) return;
  const patterns = {
    experience: [[520, 0], [780, 0.09], [1040, 0.18], [1560, 0.29]],
    credits: [[1250, 0], [1760, 0.08], [1320, 0.17], [1980, 0.26]],
    reverence: [[392, 0], [588, 0.05], [784, 0.1], [1176, 0.2], [1568, 0.31]],
    dramaCards: [[330, 0], [495, 0.06], [660, 0.12], [990, 0.2], [1320, 0.3]],
    attributePoints: [[260, 0], [520, 0.08], [780, 0.16], [1040, 0.25]],
    skillPoints: [[440, 0], [660, 0.08], [880, 0.16], [1320, 0.25]],
    shipCredits: [[220, 0], [330, 0.07], [440, 0.14], [660, 0.24]],
  };
  (patterns[resource] || patterns.experience).forEach(([frequency, start], index) => {
    scheduleTone(audio, frequency, start, 0.25 + index * 0.025, 0.026, index % 2 ? "triangle" : "sine");
  });
}

function playDramaCardUseSound() {
  if (!playerSoundsEnabled) return;
  const audio = ensureCharacterAudio();
  if (!audio) return;
  [[392, 0], [523.25, 0.07], [659.25, 0.14], [987.77, 0.23], [1318.5, 0.34]].forEach(([frequency, start], index) => {
    scheduleTone(audio, frequency, start, 0.3 + index * 0.02, 0.024, index % 2 ? "triangle" : "sine");
  });
  const duration = 0.32;
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const progress = index / data.length;
    data[index] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress) * 0.32;
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(480, audio.currentTime + 0.2);
  filter.frequency.exponentialRampToValueAtTime(2600, audio.currentTime + 0.5);
  gain.gain.setValueAtTime(0.0001, audio.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.13, audio.currentTime + 0.27);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.52);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start(audio.currentTime + 0.2);
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
let pendingCombatRequest = null;
let lastReceivedCombatRequestKey = "";
let activeCombatDamageRequest = null;
let combatDamageSubmitted = false;
let combatDeathSequenceUntil = 0;
let combatDeathSequenceTimer = null;
let suspendedSkillPromptForDefeat = false;
let suspendedDamagePromptForDefeat = false;
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
let lastCampaignSyncAt = null;
let campaignBaselineCredits = 0;
let campaignBaselineHp = null;
let campaignSaveTimer = null;
let suppressCampaignSave = false;
let gmAdjustmentSnapshot = null;
let pinModalMode = "display";
let pendingPinCharacterId = "";
let activeCampaignRollRequest = null;
let dramaEventCampaignCode = "";
let knownDramaPlayIds = new Set();
let dramaAlertQueue = [];
let activeDramaAlert = null;
let selectedDramaCard = null;
let advancementAttributePurchases = [];

function mayReceiveGearForFree() {
  return GM_ADJUSTMENT_MODE
    || (manualInputMode() && character.phase === "draft")
    || Boolean(campaignCode && campaignCharacterId && campaignEditable);
}

function renderSyncIndicator(state = "local") {
  if (!dom.syncIndicator) return;
  const normalized = ["local", "saving", "synced", "offline"].includes(state) ? state : "local";
  const labels = { local: "LOCAL", saving: "SAVING", synced: "SYNCED", offline: "OFFLINE" };
  dom.syncIndicator.className = `sync-indicator ${normalized}`;
  const timestamp = lastCampaignSyncAt
    ? lastCampaignSyncAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Not yet synchronized";
  const visibleLabel = normalized === "synced" && lastCampaignSyncAt
    ? `SYNCED ${timestamp}`
    : normalized === "offline" && lastCampaignSyncAt
      ? `OFFLINE ${timestamp}`
      : labels[normalized];
  dom.syncIndicator.querySelector("span").textContent = visibleLabel;
  dom.syncIndicator.title = normalized === "synced" ? `Last synchronized ${timestamp}` : labels[normalized];
}

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

function blankCharacter(name = "") {
  return {
    id: uid(),
    version: FORMAT_VERSION,
    phase: "draft",
    advancementOpen: false,
    importedDraft: false,
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
      manualInput: false,
    },
    fubs: {
      status: "unrolled",
      rolls: [],
      rerollUsed: false,
    },
    pendingRoll: null,
    health: { current: null, permanentBonus: 0 },
    gmAdjustments: { maximumHp: 0, exertionMax: 0, moveSpeed: 0, speed: 0, command: 0, damageReduction: 0 },
    resources: {
      exertionCurrent: 1,
      exertionMax: 1,
      reverence: 0,
      creditsBase: 500,
      mechanicalExperience: 0,
      dramaCards: 0,
      attributePoints: 0,
      skillPoints: 0,
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
    items: [],
    storedItems: [],
    statuses: { intoxicated: false },
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

function normalizeSkill(raw, preV4 = false) {
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
    creationDecimal: preV4 ? null : Math.round((numeric * 10) % 10),
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
  const preV4 = sourceVersion < 4;
  const identity = { ...base.identity, ...(source.identity || {}) };
  identity.characterName = String(identity.characterName || "").replace(/\s*\(Recovered\)\s*$/i, "");
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
    importedDraft: Boolean(source.importedDraft),
    identity,
    experience: { ...base.experience, ...(source.experience || {}) },
    attributes: { ...base.attributes },
    skills: blankSkills(),
    customSkills: [],
    creation: { ...base.creation, ...(source.creation || {}) },
    fubs: { ...base.fubs, ...(source.fubs || {}) },
    pendingRoll: source.pendingRoll || null,
    health: { ...base.health, ...(source.health || {}) },
    gmAdjustments: { ...base.gmAdjustments, ...(source.gmAdjustments || {}) },
    resources: {
      ...base.resources,
      ...(source.resources || {}),
      creditsBase: source.resources?.creditsBase ?? source.resources?.credits ?? base.resources.creditsBase,
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
    items: Array.isArray(source.items) ? source.items.slice(0, 200) : base.items,
    storedItems: Array.isArray(source.storedItems) ? source.storedItems.slice(0, 200) : base.storedItems,
    statuses: { ...base.statuses, ...(source.statuses || {}) },
  };

  for (const definition of ATTRIBUTE_DEFS) {
    const rows = source.attributes?.[definition.key];
    normalized.attributes[definition.key] = Array.from({ length: 4 }, (_, row) => {
      const fallback = row < 2 ? 0 : -1;
      return Math.round(clamp(Array.isArray(rows) ? rows[row] ?? fallback : fallback, -1, 4));
    });
    if (!normalized.creation.manualInput) {
      normalized.attributes[definition.key][0] = Math.max(0, normalized.attributes[definition.key][0]);
      normalized.attributes[definition.key][1] = Math.max(0, normalized.attributes[definition.key][1]);
    }
  }

  for (const name of ALL_SKILLS) normalized.skills[name] = normalizeSkill(source.skills?.[name], preV4);
  normalized.customSkills = (Array.isArray(source.customSkills) ? source.customSkills : []).slice(0, 24).map((entry) => {
    const value = normalizeSkill(entry, preV4);
    return { id: entry?.id || uid(), name: String(entry?.name || ""), ...value };
  });
  if (preV4) normalized.customSkills = normalized.customSkills.filter((skill) => skill.name.trim() || skill.tenths > 0);

  normalized.creation.skillPurchaseOrder = Array.isArray(source.creation?.skillPurchaseOrder)
    ? source.creation.skillPurchaseOrder.filter((entry) => entry && typeof entry.key === "string").map((entry) => ({ key: entry.key, cost: Math.max(1, Math.round(Number(entry.cost) || 1)) }))
    : rebuildPurchaseOrder(normalized);
  normalized.creation.finalizationQueue = Array.isArray(source.creation?.finalizationQueue)
    ? source.creation.finalizationQueue.filter((key) => typeof key === "string")
    : [];
  normalized.creation.classGrantsApplied = Boolean(source.creation?.classGrantsApplied);
  normalized.creation.raceGrantsApplied = Boolean(source.creation?.raceGrantsApplied);
  normalized.creation.manualInput = Boolean(source.creation?.manualInput);
  for (const key of Object.keys(base.gmAdjustments)) normalized.gmAdjustments[key] = Math.round(clamp(normalized.gmAdjustments[key], -999999, 999999) * 10) / 10;
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
  const normalizeItem = (entry) => {
    const catalog = gearById(entry?.catalogId);
    const chargesMax = Number.isFinite(Number(entry?.chargesMax)) ? Math.max(0, Number(entry.chargesMax)) : Number(catalog?.chargesMax) || null;
    return {
      id: String(entry?.id || uid()),
      catalogId: catalog?.id || "",
      name: String(entry?.name || catalog?.name || "Custom Item").slice(0, 120),
      description: String(entry?.description || catalog?.description || "").slice(0, 4000),
      quantity: Math.max(1, Math.min(9999, Math.round(Number(entry?.quantity) || 1))),
      unitCost: Math.round(clamp(entry?.unitCost ?? catalog?.cost ?? 0, 0, 999999999)),
      chargesMax,
      charges: chargesMax === null ? null : Math.max(0, Math.min(chargesMax, Number(entry?.charges ?? chargesMax))),
      chargeState: String(entry?.chargeState || catalog?.chargeStateMax || "").slice(0, 40),
      special: String(entry?.special || catalog?.special || "").slice(0, 80),
    };
  };
  normalized.items = normalized.items.map(normalizeItem);
  normalized.storedItems = normalized.storedItems.map(normalizeItem);
  normalized.statuses.intoxicated = Boolean(normalized.statuses.intoxicated);

  normalized.experience.available = Math.round(clamp(normalized.experience.available, 0, 9999999));
  normalized.experience.spent = Math.round(clamp(normalized.experience.spent, 0, 9999999));
  normalized.experience.totalGained = Math.max(
    Math.round(clamp(normalized.experience.totalGained, 0, 9999999)),
    normalized.experience.available + normalized.experience.spent,
  );
  normalized.resources.exertionMax = Math.round(clamp(normalized.resources.exertionMax, 0, 99));
  normalized.resources.exertionCurrent = Math.round(clamp(normalized.resources.exertionCurrent, 0, normalized.resources.exertionMax));
  normalized.resources.reverence = Math.round(clamp(normalized.resources.reverence, 0, 10));
  normalized.resources.creditsBase = Math.round(clamp(normalized.resources.creditsBase, -999999999, 999999999));
  normalized.resources.dramaCards = Math.round(clamp(normalized.resources.dramaCards, 0, 999));
  normalized.resources.attributePoints = Math.round(clamp(normalized.resources.attributePoints, 0, 999999));
  normalized.resources.skillPoints = Math.round(clamp(normalized.resources.skillPoints, 0, 999999));
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
  return rawLibrary().map(normalizeCharacter).filter((entry) => entry.phase === "finalized");
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

function draftRecoveryId(characterObject) {
  return `autosave-${characterObject.id}`;
}

function draftHasProgress(characterObject) {
  const identity = characterObject.identity || {};
  const identityFields = [
    "playerName", "characterName", "race", "raceId", "raceType", "classId",
    "homePlanet", "sex", "age", "height", "weight", "hair", "eyes", "description",
  ];
  const identityStarted = identityFields.some((field) => String(identity[field] || "").trim());
  const attributesChanged = Object.values(characterObject.attributes || {}).some((rows) => (
    JSON.stringify(rows) !== JSON.stringify([0, 0, -1, -1])
  ));
  const skillsStarted = Object.values(characterObject.skills || {}).some((skill) => Number(skill?.tenths) > 0);
  const customStarted = (characterObject.customSkills || []).some((skill) => String(skill?.name || "").trim() || Number(skill?.tenths) > 0);
  const crewStarted = (characterObject.crew || []).some((member) => String(member?.name || "").trim() || String(member?.title || "").trim());
  const weaponsStarted = (characterObject.weapons || []).some((entry) => entry?.weaponId);
  return identityStarted
    || attributesChanged
    || skillsStarted
    || customStarted
    || crewStarted
    || weaponsStarted
    || String(characterObject.notes || "").trim()
    || String(characterObject.advantagesNotes || "").trim()
    || characterObject.fubs?.status !== "unrolled";
}

function persistRecoveries() {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries));
}

function saveDraftRecovery() {
  const id = draftRecoveryId(character);
  recoveries = recoveries.filter((entry) => entry.id !== id);
  if (draftHasProgress(character)) {
    recoveries.unshift({
      id,
      label: `Autosaved Draft: ${character.identity.characterName || "Unnamed Character"}`,
      createdAt: new Date().toISOString(),
      character: deepCopy(character),
    });
  }
  recoveries = recoveries.slice(0, 2);
  persistRecoveries();
}

function clearDraftRecovery(characterId) {
  const id = `autosave-${characterId}`;
  const next = recoveries.filter((entry) => entry.id !== id);
  if (next.length === recoveries.length) return;
  recoveries = next;
  persistRecoveries();
}

let library = loadLibrary();
let recoveries = loadRecoveries();
const storedActiveDraftId = localStorage.getItem(ACTIVE_DRAFT_KEY);
const activeRecovery = storedActiveDraftId === "none"
  ? null
  : recoveries.find((entry) => entry.character?.id === storedActiveDraftId)
    || (storedActiveDraftId === null
      ? recoveries.find((entry) => String(entry.id || "").startsWith("autosave-"))
      : null);
if (activeRecovery?.character && activeRecovery.character.phase !== "finalized") {
  const resumedDraft = normalizeCharacter(deepCopy(activeRecovery.character));
  library = library.filter((entry) => entry.id !== resumedDraft.id);
  library.push(resumedDraft);
  localStorage.setItem(ACTIVE_DRAFT_KEY, resumedDraft.id);
}
if (!library.length) library.push(blankCharacter());
let activeId = activeRecovery?.character?.id || localStorage.getItem(ACTIVE_KEY) || library[0].id;
if (!library.some((entry) => entry.id === activeId)) activeId = library[0].id;
let character = library.find((entry) => entry.id === activeId) || library[0];
let gearDraft = null;
const pendingGearAdds = new Set();

function saveLibrary(message = "Saved locally") {
  character.updatedAt = new Date().toISOString();
  const computed = derivedValues({ includeCampaignBonus: false });
  const race = raceEffects();
  const recurringHealing = character.identity.raceId === "everliving-brethren"
    ? { amount: highestAttributeDie("health"), label: "Everliving Brethren" }
    : character.identity.raceId === "yuhorn-symitron" && character.identity.raceType === "wood"
      ? { amount: Math.max(0, Number(character.resources.exertionCurrent) || 0) * 3, label: "Wood Symitron" }
      : null;
  character.computed = {
    speed: computed.speed,
    commandWindow: computed.command,
    maximumHp: maximumHp(),
    moveSpeed: calculatedMoveSpeed(),
    damageReduction: damageReductionDetails().value,
    skills: Object.fromEntries(ALL_SKILLS.map((name) => [name, displayedSkillTenths(name, character.skills[name]) / 10])),
    defenseScoreModifier: Number(race.defenseScoreModifier) || 0,
    recurringHealingInterval: recurringHealing?.amount ? 6 : 0,
    recurringHealingAmount: recurringHealing?.amount || 0,
    recurringHealingLabel: recurringHealing?.label || "",
  };
  if (!CAMPAIGN_READ_ONLY_VIEW) {
    if (character.phase === "finalized") clearDraftRecovery(character.id);
    else saveDraftRecovery();
    const savedCharacters = library.filter((entry) => entry.phase === "finalized");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters));
    if (character.phase === "finalized") {
      localStorage.setItem(ACTIVE_KEY, activeId);
      localStorage.setItem(ACTIVE_DRAFT_KEY, "none");
    } else {
      localStorage.setItem(ACTIVE_DRAFT_KEY, character.id);
      const fallback = savedCharacters.find((entry) => entry.id === localStorage.getItem(ACTIVE_KEY)) || savedCharacters[0];
      if (fallback) localStorage.setItem(ACTIVE_KEY, fallback.id);
      else localStorage.removeItem(ACTIVE_KEY);
    }
    if (campaignCode && campaignCharacterId) cacheCampaignCharacter();
  }
  dom.saveStatus.textContent = campaignCode ? (campaignEditable ? "Saving to campaign..." : "Campaign view") : message;
  dom.saveStatus.classList.remove("saving");
  renderSyncIndicator(campaignCode ? (campaignEditable ? "saving" : "synced") : "local");
  if (campaignCode && campaignCharacterId && campaignEditable && !suppressCampaignSave) {
    campaignDirty = true;
    queueCampaignCharacterSave();
  }
}

function queueSave() {
  if (GM_ADJUSTMENT_MODE) {
    campaignDirty = true;
    dom.saveStatus.textContent = "Unsaved GM changes";
    dom.saveStatus.classList.add("saving");
    return;
  }
  dom.saveStatus.textContent = "Saving...";
  dom.saveStatus.classList.add("saving");
  renderSyncIndicator(campaignCode ? "saving" : "local");
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
  void 0;
}

function queueCampaignCharacterSave(delay = 280) {
  if (GM_ADJUSTMENT_MODE) {
    campaignDirty = true;
    return;
  }
  clearTimeout(campaignSaveTimer);
  campaignSaveTimer = setTimeout(saveCampaignCharacter, delay);
}

async function saveCampaignCharacter({ force = false, exact = false } = {}) {
  if (force && campaignCode && campaignCharacterId && campaignEditable) campaignDirty = true;
  if (!campaignCode || !campaignCharacterId || !campaignEditable || !campaignDirty || campaignSaving) return false;
  campaignSaving = true;
  campaignDirty = false;
  renderSyncIndicator("saving");
  try {
    const payload = await campaignRequest("/api/campaign/character/save", {
      method: "POST",
      body: JSON.stringify({
        code: campaignCode,
        token: campaignToken,
        characterId: campaignCharacterId,
        baseCredits: campaignBaselineCredits,
        baseCurrentHp: campaignBaselineHp,
        exact: Boolean(exact && GM_ADJUSTMENT_MODE),
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
    lastCampaignSyncAt = new Date();
    renderSyncIndicator("synced");
    cacheCampaignCharacter();
    return true;
  } catch (error) {
    campaignDirty = true;
    dom.saveStatus.textContent = error.message;
    dom.saveStatus.classList.add("saving");
    renderSyncIndicator("offline");
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
const storedPlayerBannerMode = localStorage.getItem(PLAYER_BANNER_MODE_KEY);
let playerBannerMode = ["hidden", "show", "exit"].includes(storedPlayerBannerMode) ? storedPlayerBannerMode : "show";
let playerSoundsEnabled = localStorage.getItem(PLAYER_SOUND_KEY) === "on";
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
  const hpRatio = maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
  const heartUnits = Math.round(hpRatio * 6);
  dom.tabStatusHearts.innerHTML = Array.from({ length: 3 }, (_, index) => {
    const units = Math.max(0, Math.min(2, heartUnits - index * 2));
    const empty = units === 2 ? "0%" : units === 1 ? "50%" : "100%";
    return `<svg class="hud-heart" style="--heart-empty:${empty}" viewBox="0 0 24 22" aria-hidden="true"><path class="hud-heart-base" d="M12 21C10.4 18.9 1 13.2 1 6.8 1 2.4 6.3-.2 12 4.1 17.7-.2 23 2.4 23 6.8 23 13.2 13.6 18.9 12 21Z"/><path class="hud-heart-fill" d="M12 21C10.4 18.9 1 13.2 1 6.8 1 2.4 6.3-.2 12 4.1 17.7-.2 23 2.4 23 6.8 23 13.2 13.6 18.9 12 21Z"/></svg>`;
  }).join("");
  dom.tabStatusHearts.closest(".hud-health")?.classList.toggle("half-heart-emergency", heartUnits === 1 && current > 0);
  dom.tabStatusHearts.closest(".hud-health")?.classList.toggle("zero-heart-emergency", heartUnits === 0 && maximum > 0);
  dom.tabStatusReverence.textContent = Math.max(0, Number(character.resources.reverence) || 0) + " / 10";
  dom.tabStatusExertion.textContent = Math.max(0, Number(character.resources.exertionCurrent) || 0) + " / " + Math.max(0, Number(character.resources.exertionMax) || 0);
  dom.tabStatusCredits.textContent = (Number(character.resources.creditsBase) || 0).toLocaleString();
  if (dom.hudWeaponOverload) dom.hudWeaponOverload.hidden = !weaponSlotAllocation().overloaded;

  const visible = resourceHudVisible && character.phase === "finalized" && !CAMPAIGN_READ_ONLY_VIEW;
  dom.globalCharacterHud.hidden = !visible;
  document.body.classList.toggle("resource-hud-visible", visible);
  dom.resourceHudToggle?.querySelectorAll("[data-hud-visible]").forEach((button) => {
    const selected = (button.dataset.hudVisible === "true") === resourceHudVisible;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function renderBannerVisibility() {
  document.body.classList.toggle("interface-banner-hidden", playerBannerMode === "hidden");
  dom.characterBanner?.classList.toggle("banner-exits", playerBannerMode === "exit");
  dom.characterBanner?.setAttribute("aria-label", playerBannerMode === "exit" ? "Exit campaign or character screen" : "Spaceship Architect banner");
  dom.bannerVisibilityToggle?.querySelectorAll("[data-banner-mode]").forEach((button) => {
    const selected = button.dataset.bannerMode === playerBannerMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function setGmAdjustmentTarget(key, target, baseValue) {
  character.gmAdjustments[key] = Math.round((Number(target) - Number(baseValue)) * 10) / 10;
}

function enableGmAdjustmentMode() {
  if (!GM_ADJUSTMENT_MODE) return;
  document.body.classList.add("gm-adjustment-mode");
  dom.gmAdjustmentBar.hidden = false;
  dom.gmAdjustmentCharacterName.textContent = character.identity.characterName || "Unnamed Character";
  suppressCampaignSave = false;
  campaignDirty = false;
  gmAdjustmentSnapshot = deepCopy(character);
}

async function saveGmAdjustments() {
  if (!GM_ADJUSTMENT_MODE) return;
  dom.saveGmAdjustment.disabled = true;
  saveLibrary("Preparing GM adjustments");
  const saved = await saveCampaignCharacter({ force: true, exact: true });
  dom.saveGmAdjustment.disabled = false;
  if (!saved) {
    notice("GM changes could not be saved. Keep this window open and try again.", "error");
    return;
  }
  window.parent.postMessage({ type: "sa-gm-adjustment-saved", characterId: campaignCharacterId }, location.origin);
}

function cancelGmAdjustments() {
  if (!GM_ADJUSTMENT_MODE) return;
  if (gmAdjustmentSnapshot) character = normalizeCharacter(deepCopy(gmAdjustmentSnapshot));
  window.parent.postMessage({ type: "sa-gm-adjustment-cancelled", characterId: campaignCharacterId }, location.origin);
}

function renderCharacterHeader() {
  const linked = Boolean(campaignCode && (campaignState || character.campaignLink?.status === "linked"));
  const gm = campaignState?.role === "gm" || GM_ADJUSTMENT_MODE;
  const role = gm ? "(GM)" : "(PC)";
  const title = linked ? String(campaignState?.name || character.campaignLink?.campaignName || "Campaign").toUpperCase() : "JOIN A GAME";
  dom.creatorRoleLabel.textContent = "";
  dom.creatorCampaignTitle.innerHTML = `${escapeHtml(title)} <small>${role}</small>`;
  dom.creatorTitle.disabled = gm || linked;
  dom.creatorTitle.title = !gm && !linked ? "Open Settings and join a campaign" : "";
}

function renderPlayerSoundSetting() {
  dom.playerSoundToggle?.querySelectorAll("[data-player-sounds]").forEach((button) => {
    const selected = (button.dataset.playerSounds === "true") === playerSoundsEnabled;
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
    void 0;
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
  renderBannerVisibility();
  renderPlayerSoundSetting();
  renderCharacterHeader();
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
  void 0;
}
function renderCharacterNavigation() {
  const linked = Boolean(campaignCode && campaignCharacterId && (campaignState || character.campaignLink?.status === "linked"));
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
  dom.roomCodeValue.textContent = roomCode && campaignState?.settings?.hideRoomCode ? "••••" : roomCode || "----";
  if (dom.backToMain) dom.backToMain.hidden = linked;
  dom.settingsLeaveCampaign.disabled = false;
  dom.settingsLeaveCampaign.closest("section").hidden = gmView;
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
  renderCharacterHeader();
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
  const starships = campaignState.starships || [];
  dom.campaignStarshipRoster.hidden = starships.length === 0;
  dom.campaignStarshipCards.innerHTML = starships.map((record) => {
    const ship = record.ship || {};
    const hull = ship.confirmed?.gridCells?.length ?? ship.gridCells?.length ?? 0;
    const engines = ship.confirmed?.placements?.length ?? ship.placements?.length ?? 0;
    const characterQuery = campaignState.ownCharacterId ? `&character=${encodeURIComponent(campaignState.ownCharacterId)}` : "";
    return `<article class="campaign-starship-card">
      <div><span>PC CONTROLLED</span><strong>${escapeHtml(record.title || "Untitled Starship")}</strong><small>${escapeHtml(ship.class || "Unclassified")} | Hull ${hull} | EN ${engines * 5}</small></div>
      <a href="starship.html?campaign=${encodeURIComponent(campaignState.code)}&ship=${encodeURIComponent(record.id)}${characterQuery}">Open Starship</a>
    </article>`;
  }).join("");
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
  if (note.kind === "award" && note.rewardStatus === "pending") {
    return `<div class="private-note-actions reward-claim-actions"><button type="button" class="claim-reward" data-claim-reward="${escapeAttribute(note.id)}">Receive Reward</button><small>Applied once to this character when claimed.</small></div>`;
  }
  if (note.kind !== "science-choice" || !Array.isArray(note.choices)) return "";
  return `<div class="private-note-actions">${note.choices.map((skill) => `<button type="button" data-science-choice="${escapeAttribute(skill)}" data-note-id="${escapeAttribute(note.id)}">+0.1 ${escapeHtml(skill)}</button>`).join("")}</div>`;
}

function refreshPrivateNotes() {
  const noteCharacterId = campaignState?.ownCharacterId || campaignCharacterId;
  const record = campaignState?.characters?.find((entry) => entry.id === noteCharacterId);
  const localNotes = noteCharacterId === campaignCharacterId ? (character.localInbox || []) : (record?.character?.localInbox || []);
  const notes = [...(record?.privateNotes || []), ...localNotes];
  const unread = notes.filter((note) => note.direction !== "to-gm" && !note.readAt).length;
  const unclaimedReward = notes.some((note) => note.kind === "award" && note.rewardStatus === "pending");
  dom.privateNoteCount.textContent = `${unread} UNREAD`;
  dom.playerInboxCount.textContent = String(unread);
  dom.playerInboxCount.classList.toggle("reward-ready", unclaimedReward);
  dom.playerInboxCount.closest("button")?.classList.toggle("reward-ready", unclaimedReward);
  dom.privateNotesList.innerHTML = notes.length ? notes.slice().reverse().map((note) => {
    const label = note.kind === "roll-request"
      ? "ROLL REQUEST"
      : note.kind === "damage"
        ? "COMBAT DAMAGE"
      : note.kind === "award"
        ? note.rewardStatus === "pending" ? "REWARD READY" : "GM AWARD"
        : note.kind === "system"
          ? "CAMPAIGN NOTICE"
          : note.direction === "to-gm"
            ? "MESSAGE SENT"
            : "PRIVATE GM MESSAGE";
    const pendingReward = note.kind === "award" && note.rewardStatus === "pending";
    return `<article class="private-note ${note.direction !== "to-gm" && !note.readAt ? "unread" : "read"} ${pendingReward ? "pending-reward" : ""}" data-note-id="${note.id}">
      <small>${label} | ${new Date(note.createdAt).toLocaleString()}</small><p>${escapeHtml(note.message)}</p>${privateNoteActions(note)}${pendingReward ? "" : `<button type="button" data-delete-note="${note.id}">Delete</button>`}
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
    : "No banker is assigned. Any unlocked character may transfer Group Credits funds.";
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
  processDramaPlayEvents(nextState);
  campaignState = nextState;
  cacheCampaign(nextState);
  if (!campaignCharacterId) {
    renderCampaignRoster();
    return;
  }
  const remote = nextState.characters.find((entry) => entry.id === campaignCharacterId);
  if (!remote) {
    dom.saveStatus.textContent = "Campaign synchronization interrupted; link preserved";
    dom.saveStatus.classList.add("saving");
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
  renderDerived();
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
  campaignEvents.addEventListener("character-kicked", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.character) character = normalizeCharacter(payload.character);
    resetCombatInterfaceState({ clearFrame: true });
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
    saveLibrary("Character removed from campaign");
    renderAll();
    renderCharacterNavigation();
    showCharacterPanel("sheet");
    notice(`The GM removed this character from ${payload.campaignName || "the campaign"}.`, "error");
  });
  campaignEvents.addEventListener("campaign-deleted", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.character) character = normalizeCharacter(payload.character);
    resetCombatInterfaceState({ clearFrame: true });
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
      character.campaignLink.message = `${campaignName} is temporarily unavailable. The campaign link is preserved.`;
      saveLibrary("Campaign link preserved while unavailable");
      renderCharacterNavigation();
      notice(`${campaignName} is unavailable right now. Your character remains linked and will retry.`, "error");
      scheduleJoinStatusCheck(15000);
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
  resetCombatInterfaceState({ clearFrame: true });
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

function notice(message, type = "", duration = 4800) {
  dom.creatorNotice.textContent = message;
  dom.creatorNotice.className = `creator-notice ${type}`.trim();
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    dom.creatorNotice.textContent = "";
    dom.creatorNotice.className = "creator-notice";
  }, duration);
}

function dramaCardMiniMarkup(card) {
  return `<article class="drama-card-mini-face" data-category="${escapeAttribute(card.category || "")}">
    <header><span>${escapeHtml(card.category || "Drama Card")}</span><b>#${String(card.number || 0).padStart(2, "0")}</b></header>
    <div class="drama-card-mini-core"><span class="drama-card-mini-sigil" aria-hidden="true">SA</span><h4>${escapeHtml(card.name || "Drama Card")}</h4><p>${escapeHtml(card.text || "")}</p></div>
    <footer>${escapeHtml(card.handling || "Reveal, resolve, then discard.")}</footer>
  </article>`;
}

function fillDramaCard(card) {
  if (!card) return;
  dom.dramaCardDisplay.dataset.category = card.category || "";
  dom.dramaCardCategory.textContent = card.category || "Drama Card";
  dom.dramaCardNumber.textContent = `#${String(card.number || 0).padStart(2, "0")}`;
  dom.dramaCardDialogTitle.textContent = card.name || "Drama Card";
  dom.dramaCardRules.textContent = card.text || "";
  dom.dramaCardHandling.textContent = card.handling || "Reveal, resolve, then discard.";
}

function openDramaCard(card, { alert = null, receipt = false } = {}) {
  if (!card) return;
  selectedDramaCard = alert || receipt ? null : card;
  activeDramaAlert = alert;
  fillDramaCard(card);
  dom.dramaCardDisplay.classList.remove("playing");
  dom.dramaCardModal.dataset.mode = receipt ? "receipt" : alert ? "alert" : "hand";
  dom.dramaCardAlertByline.hidden = !alert;
  dom.dramaCardAlertByline.textContent = alert
    ? `${alert.playerName || "A player"} played ${card.name} as ${alert.characterName || "their character"}.`
    : "";
  dom.playDramaCard.hidden = Boolean(alert) || receipt;
  dom.playDramaCard.disabled = false;
  dom.playDramaCard.dataset.confirming = "false";
  dom.playDramaCard.textContent = "Play Card";
  dom.closeDramaCard.textContent = receipt ? "Confirm" : alert ? "Dismiss" : "Close";
  dom.dramaCardModal.hidden = false;
  requestAnimationFrame(() => dom.closeDramaCard.focus());
}

function animateDramaCardDeparture() {
  playDramaCardUseSound();
  dom.dramaCardDisplay.classList.remove("playing");
  void dom.dramaCardDisplay.offsetWidth;
  dom.dramaCardDisplay.classList.add("playing");
  return new Promise((resolve) => setTimeout(resolve, 920));
}

function syncDramaCampaignState(nextState) {
  receiveCampaignState(nextState);
  const remote = nextState?.characters?.find((entry) => entry.id === campaignCharacterId);
  if (remote?.character?.resources) {
    character.resources.reverence = Math.max(0, Number(remote.character.resources.reverence) || 0);
    character.resources.dramaCards = Math.max(0, Number(remote.character.resources.dramaCards) || 0);
  }
  renderResources();
}

function showNextDramaAlert() {
  if (!dom.dramaCardModal.hidden || !dramaAlertQueue.length) return;
  const alert = dramaAlertQueue.shift();
  openDramaCard(alert.card, { alert });
}

function closeDramaCard() {
  const dismissedAlert = Boolean(activeDramaAlert);
  dom.dramaCardModal.hidden = true;
  dom.dramaCardDisplay.classList.remove("playing");
  delete dom.dramaCardModal.dataset.mode;
  dom.playDramaCard.dataset.confirming = "false";
  activeDramaAlert = null;
  selectedDramaCard = null;
  if (dismissedAlert) requestAnimationFrame(showNextDramaAlert);
}

function processDramaPlayEvents(nextState) {
  const events = Array.isArray(nextState?.dramaDeck?.playEvents) ? nextState.dramaDeck.playEvents : [];
  if (dramaEventCampaignCode !== nextState?.code) {
    dramaEventCampaignCode = nextState?.code || "";
    knownDramaPlayIds = new Set(events.map((event) => event.id));
    dramaAlertQueue = [];
    return;
  }
  for (const event of events) {
    if (!event?.id || knownDramaPlayIds.has(event.id)) continue;
    knownDramaPlayIds.add(event.id);
    if (event.characterId === nextState.ownCharacterId || !event.card) continue;
    dramaAlertQueue.push(event);
  }
  showNextDramaAlert();
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
    postFinalizeSkillBonuses: {
      ...(baseEffects.postFinalizeSkillBonuses || {}),
      ...(typeEffects.postFinalizeSkillBonuses || {}),
    },
  };
}

function classEffects(characterObject = character) {
  return finalizedModifiersActive(characterObject) ? rawClassEffects(characterObject) : {};
}

function raceEffects(characterObject = character) {
  const effects = rawRaceEffects(characterObject);
  return {
    ...effects,
    skillBonuses: {
      ...(effects.skillBonuses || {}),
      ...(finalizedModifiersActive(characterObject) ? effects.postFinalizeSkillBonuses || {} : {}),
    },
  };
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

function manualInputMode(characterObject = character) {
  return Boolean(characterObject?.creation?.manualInput);
}

function skillBonusTenths(name, characterObject = character) {
  if (manualInputMode(characterObject)) return 0;
  const classBonus = Number(classEffects(characterObject).skillBonuses?.[name]) || 0;
  const raceBonus = Number(raceEffects(characterObject).skillBonuses?.[name]) || 0;
  const chosenBonus = finalizedModifiersActive(characterObject) ? Number(characterObject.creation?.racialSkillGrants?.[name]) || 0 : 0;
  return classBonus + raceBonus + chosenBonus;
}

function skillBonusParts(name, characterObject = character) {
  if (manualInputMode(characterObject)) return [];
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
  const gmBonus = Number(characterObject.gmAdjustments?.maximumHp) || 0;
  const parts = [selectedFormula?.label || "Health dice maximum +20"];
  if (classBonus) parts.push(`+${classBonus} ${classById(characterObject.identity.classId).name}`);
  if (permanent) parts.push(`+${permanent} permanent`);
  if (gmBonus) parts.push(`${gmBonus > 0 ? "+" : ""}${gmBonus} GM adjustment`);
  return { value: Math.max(0, racialBase + classBonus + permanent + gmBonus), formula: parts.join(" ") };
}

function maximumHp(characterObject = character) {
  return maximumHpDetails(characterObject).value;
}

function calculatedExertionMax(characterObject = character) {
  return Math.max(0, 1 + characterObject.attributes.willpower.filter((dieIndex) => dieIndex >= 3).length + (Number(characterObject.gmAdjustments?.exertionMax) || 0));
}

function calculatedMoveSpeedDetails(characterObject = character) {
  const dexterityBonus = characterObject.attributes.dexterity.filter((dieIndex) => dieIndex >= 3).length;
  const race = raceEffects(characterObject);
  const racialBonus = Number(race.moveSpeedModifier) || 0;
  const gmBonus = Number(characterObject.gmAdjustments?.moveSpeed) || 0;
  const minimum = Number.isFinite(Number(race.moveSpeedMinimum)) ? Number(race.moveSpeedMinimum) : 0;
  const value = Math.max(0, minimum, 2 + dexterityBonus + racialBonus + gmBonus);
  const parts = ["Base 2", `+${dexterityBonus} DEX D10+`];
  if (racialBonus) parts.push(`${racialBonus > 0 ? "+" : ""}${racialBonus} ${selectedRace(characterObject)?.name || "Race"}`);
  if (minimum) parts.push(`minimum ${minimum}`);
  if (gmBonus) parts.push(`${gmBonus > 0 ? "+" : ""}${gmBonus} GM adjustment`);
  return { value, formula: parts.join(" ") };
}

function calculatedMoveSpeed(characterObject = character) {
  return calculatedMoveSpeedDetails(characterObject).value;
}

function damageReductionDetails(characterObject = character) {
  const reduction = raceEffects(characterObject).damageReduction;
  const gmBonus = Number(characterObject.gmAdjustments?.damageReduction) || 0;
  if (!reduction) return { value: Math.max(0, gmBonus), formula: gmBonus ? `No natural Damage Reduction ${gmBonus > 0 ? "+" : ""}${gmBonus} GM adjustment` : "No natural Damage Reduction" };
  const value = (reduction.kind === "flat"
    ? Number(reduction.value) || 0
    : formulaDiceValue(reduction, characterObject) + (Number(reduction.bonus) || 0)) + gmBonus;
  return { value: Math.max(0, value), formula: `${reduction.label || "Racial Damage Reduction"}${gmBonus ? ` ${gmBonus > 0 ? "+" : ""}${gmBonus} GM adjustment` : ""}` };
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

function campaignCommandWindowBonus() {
  return Math.max(0, Number(campaignState?.settings?.commandWindowBonus) || 0);
}

function derivedValues({ includeCampaignBonus = true } = {}) {
  const initiative = displayedSkillTenths("Initiative", character.skills.Initiative) / 10;
  const awareness = displayedSkillTenths("Awareness", character.skills.Awareness) / 10;
  const mastermind = finalizedModifiersActive() && character.identity.classId === "mastermind";
  const commandBase = boxesFilled("perception") * 8 + awareness * (mastermind ? 45 : 12);
  const speedBeforeLoad = Math.max(0, boxesFilled("intellect") + initiative * (mastermind ? 1.5 : 1) + (Number(character.gmAdjustments?.speed) || 0));
  const weaponOverloaded = weaponSlotAllocation().overloaded;
  return {
    speed: Math.max(0, speedBeforeLoad * (weaponOverloaded ? 0.7 : 1)),
    speedBeforeLoad,
    weaponOverloaded,
    command: Math.max(0, commandBase + (includeCampaignBonus ? campaignCommandWindowBonus() : 0) + (Number(character.gmAdjustments?.command) || 0)),
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
  if (manualInputMode()) {
    return {
      attributeSpent,
      skillSpent,
      skillBudget,
      attributeBudget,
      invalidSkills: new Set(),
      attributesComplete: true,
      skillsComplete: true,
      raceComplete: raceSelectionComplete(),
      raceSelectionValid: true,
      raceClassCompatible: true,
      homePlanetComplete: Boolean(character.identity.homePlanet.trim()),
      fullIdentityComplete: identityComplete(),
      backstoryComplete: backgroundComplete(),
      ready: true,
      issues: [],
    };
  }
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
  const raceStarted = character.identity.raceKind === "other"
    || Boolean(character.identity.raceId || character.identity.race.trim());
  const raceSelectionValid = !raceStarted || raceComplete;
  const fullIdentityComplete = identityComplete();
  const backstoryComplete = backgroundComplete();
  const raceClassCompatible = !(character.identity.classId === "robotics-worker" && ["android", "spiddix"].includes(character.identity.raceId));
  if (!raceSelectionValid) {
    const definition = selectedRace();
    issues.push(definition?.types?.length ? `Choose a ${definition.name} type.` : "Finish entering the selected Race.");
  }
  if (!raceClassCompatible) issues.push("Robotics Worker / A.I. Psychologist cannot be combined with Android or Spiddix.");
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
    raceSelectionValid,
    raceClassCompatible,
    homePlanetComplete,
    fullIdentityComplete,
    backstoryComplete,
    ready: raceSelectionValid && raceClassCompatible && attributeSpent === attributeBudget && skillSpent === skillBudget && invalidSkills.size === 0,
    issues,
  };
}

function backgroundComplete() {
  return Boolean(character.notes.trim());
}

function identityComplete() {
  const fields = ["playerName", "characterName", "homePlanet", "sex", "age", "height", "weight", "hair", "eyes", "description"];
  return fields.every((field) => String(character.identity[field] ?? "").trim());
}

let previousWorkflowRequirements = new Map();
let workflowRequirementCharacterId = "";
let workflowGhostDirection = 1;

function animateCompletedWorkflowRequirements(removed, previousRects) {
  for (const item of removed) {
    const rect = previousRects.get(item.key);
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    const ghost = document.createElement("span");
    ghost.className = `workflow-completion-ghost ${workflowGhostDirection > 0 ? "whiz-right" : "whiz-left"}`;
    workflowGhostDirection *= -1;
    ghost.textContent = item.label;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.append(ghost);
    window.setTimeout(() => ghost.remove(), 850);
  }
}

function renderWorkflowRequirements(items) {
  const normalized = items.map((item, index) => ({
    ...item,
    key: item.key || `requirement-${index}-${item.label}`,
  }));
  const previousRects = new Map();
  dom.nextRequirement.querySelectorAll("[data-workflow-key]").forEach((element) => {
    previousRects.set(element.dataset.workflowKey, element.getBoundingClientRect());
  });
  const sameDraft = workflowRequirementCharacterId === character.id && character.phase === "draft";
  const nextKeys = new Set(normalized.map((item) => item.key));
  const removed = sameDraft
    ? [...previousWorkflowRequirements.values()].filter((item) => !nextKeys.has(item.key) && item.tone !== "ready")
    : [];

  dom.nextRequirement.innerHTML = normalized.map(({ key, label, tone = "", target = "" }) => (
    `<button class="workflow-requirement ${tone}" type="button" data-workflow-key="${escapeAttribute(key)}"${target ? ` data-workflow-target="${escapeAttribute(target)}"` : ""}>${escapeHtml(label)}</button>`
  )).join("");
  dom.nextRequirement.setAttribute("aria-label", normalized.map((item) => item.label).join(". "));
  previousWorkflowRequirements = new Map(normalized.map((item) => [item.key, item]));
  workflowRequirementCharacterId = character.id;
  if (removed.length) animateCompletedWorkflowRequirements(removed, previousRects);
}

function firstIncompleteIdentityTarget() {
  const fields = ["playerName", "characterName", "sex", "age", "height", "weight", "hair", "eyes", "description"];
  const missing = fields.find((field) => !String(character.identity[field] ?? "").trim());
  return missing ? `[data-field="identity.${missing}"]` : ".identity-panel";
}

function scrollToWorkflowTarget(selector) {
  if (!selector) return;
  const target = document.querySelector(selector);
  if (!target) return;
  const section = target.closest("[data-sheet-section]")?.dataset.sheetSection;
  if (section && isTabbedCharacterLayout()) showSheetSection(section);
  window.requestAnimationFrame(() => {
    const currentTarget = document.querySelector(selector);
    if (!currentTarget) return;
    const highlight = currentTarget.matches("input, select, textarea, button")
      ? currentTarget.closest("label, .panel-heading") || currentTarget
      : currentTarget;
    currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    highlight.classList.remove("workflow-target-pulse");
    void highlight.offsetWidth;
    highlight.classList.add("workflow-target-pulse");
    window.setTimeout(() => highlight.classList.remove("workflow-target-pulse"), 1500);
  });
}

function renderCharacterPicker() {
  const currentDraft = character.phase === "finalized"
    ? ""
    : `<optgroup label="Current Draft"><option value="current:${character.id}">${escapeHtml(character.identity.characterName || "Unnamed Character")} (autosaved)</option></optgroup>`;
  const saved = library.filter((entry) => entry.phase === "finalized").map((entry) => `<option value="saved:${entry.id}">${escapeHtml(entry.identity.characterName || "Unnamed Character")}${entry.importedDraft ? " [Imported Draft]" : ""}</option>`).join("");
  const recovery = recoveries.map((entry) => {
    const time = new Date(entry.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `<option value="recovery:${entry.id}">${escapeHtml(entry.label)} - ${escapeHtml(time)}</option>`;
  }).join("");
  dom.characterPicker.innerHTML = `${currentDraft}<optgroup label="Saved Characters">${saved}</optgroup>${recovery ? `<optgroup label="Recovery Drafts">${recovery}</optgroup>` : ""}`;
  dom.characterPicker.value = character.phase === "finalized" ? `saved:${activeId}` : `current:${activeId}`;
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

function renderAmbientEasterEggs() {
  document.body.classList.remove("towel-red", "towel-blue", "towel-white", "homeworld-earth");
  const carried = new Set((character.items || []).filter((entry) => Number(entry.quantity) > 0).map((entry) => entry.catalogId));
  if (carried.has("red-towel")) document.body.classList.add("towel-red");
  else if (carried.has("blue-towel")) document.body.classList.add("towel-blue");
  else if (carried.has("white-towel")) document.body.classList.add("towel-white");
  if (String(character.identity.homePlanet || "").trim().toLowerCase() === "earth") document.body.classList.add("homeworld-earth");
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
  dom.raceCardPickerButton.disabled = character.phase !== "draft";
  dom.raceCardPickerButton.textContent = character.identity.race.trim() || "Choose Race";
  dom.raceCardPickerButton.classList.toggle("has-selection", Boolean(character.identity.race.trim()));
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

let activeRaceCardId = "";
let activeRaceSubtypeIndex = 0;
let raceSubtypeTransitioning = false;
let activeClassCardId = "";

function applyRaceSelection(value, raceType = "") {
  if (character.phase !== "draft") return;
  const previousMaxHp = maximumHp();
  character.identity.raceType = "";
  character.creation.raceSkillChoices = [];
  character.creation.raceAttributeChoice = "";
  character.creation.racialSkillGrants = {};
  if (value === "__other__") {
    character.identity.raceKind = "other";
    character.identity.raceId = "";
    character.identity.race = "";
  } else {
    const definition = raceById(value);
    character.identity.raceKind = "preset";
    character.identity.raceId = definition?.id || "";
    character.identity.race = definition?.name || "";
    character.identity.raceType = definition?.types?.some((type) => type.id === raceType) ? raceType : "";
  }
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  if (character.identity.raceKind === "other") dom.raceCustom.focus();
  else if (character.identity.race.trim()) scrollToCreationModifiers();
  else if (selectedRace()?.types?.length) dom.raceTypePicker.focus();
}

function raceRuleList(items) {
  return (items?.length ? items : ["None listed."])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderRaceGallery() {
  dom.raceGalleryGrid.innerHTML = Object.entries(RACE_CARD_PROFILES).map(([id, profile]) => {
    const definition = raceById(id);
    const selected = character.identity.raceId === id;
    return `<button class="race-preview-card${selected ? " selected" : ""}" style="--race-focus:${escapeAttribute(profile.focus || "center top")}" type="button" data-race-card="${id}" aria-label="Inspect ${escapeAttribute(definition.name)}">
      <img src="${escapeAttribute(profile.image)}" alt="${escapeAttribute(definition.name)}" />
      <span class="race-preview-shade"></span>
      <strong>${escapeHtml(definition.name)}</strong>
      <small>${escapeHtml(profile.preview)}</small>
      <b>${selected ? "Selected" : "View Race"}</b>
    </button>`;
  }).join("");
  dom.raceGalleryFallback.innerHTML = [
    '<option value="">Choose from the complete race list</option>',
    ...RACE_DEFS.map((definition) => `<option value="${definition.id}">${escapeHtml(definition.name)}</option>`),
    '<option value="__other__">(Other)</option>',
  ].join("");
  dom.raceGalleryFallback.value = RACE_CARD_PROFILES[character.identity.raceId] ? "" : character.identity.raceKind === "other" ? "__other__" : character.identity.raceId;
}

function renderRaceCardRules() {
  const definition = raceById(activeRaceCardId);
  const profile = RACE_CARD_PROFILES[activeRaceCardId];
  if (!definition || !profile) return;
  const subtype = definition.types?.[activeRaceSubtypeIndex] || null;
  const subtypeProfile = subtype ? profile.subtypes?.[subtype.id] : null;
  const advantages = [...(definition.advantages || []), ...(subtype?.advantages || [])];
  const disadvantages = [...(definition.disadvantages || []), ...(subtype?.disadvantages || [])];
  dom.raceSubtypeControls.hidden = !definition.types?.length;
  dom.previousRaceSubtype.hidden = !definition.types?.length;
  dom.nextRaceSubtype.hidden = !definition.types?.length;
  dom.raceSubtypeName.textContent = subtype?.name || "";
  dom.raceCardDetailImage.src = subtypeProfile?.image || profile.image;
  dom.raceCardDetailImage.alt = `${definition.name}${subtype ? ` ${subtype.name}` : ""} full-body appearance`;
  dom.raceCardDetailName.textContent = definition.name;
  dom.raceCardDetailDescription.textContent = subtypeProfile?.description || profile.description;
  dom.raceCardAdvantages.innerHTML = raceRuleList(advantages);
  dom.raceCardDisadvantages.innerHTML = raceRuleList(disadvantages);
  dom.chooseRaceCard.textContent = `Choose ${definition.name}${subtype ? ` - ${subtype.name}` : ""}`;
}

function showRaceCardDetail(raceId) {
  const definition = raceById(raceId);
  const profile = RACE_CARD_PROFILES[raceId];
  if (!definition || !profile) return;
  activeRaceCardId = raceId;
  const selectedIndex = definition.types?.findIndex((type) => type.id === character.identity.raceType) ?? -1;
  activeRaceSubtypeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  renderRaceCardRules();
  dom.raceGalleryChooser.hidden = true;
  dom.raceCardDetail.hidden = false;
  dom.raceCardDetail.classList.remove("race-card-entering");
  requestAnimationFrame(() => dom.raceCardDetail.classList.add("race-card-entering"));
}

function openRaceGallery() {
  if (character.phase !== "draft") return;
  activeRaceCardId = "";
  renderRaceGallery();
  dom.raceCardDetail.hidden = true;
  dom.raceGalleryChooser.hidden = false;
  dom.raceGalleryModal.hidden = false;
  document.body.classList.add("race-gallery-open");
  dom.closeRaceGallery.focus();
}

function closeRaceGallery() {
  dom.raceGalleryModal.hidden = true;
  document.body.classList.remove("race-gallery-open");
  activeRaceCardId = "";
  dom.raceCardPickerButton.focus({ preventScroll: true });
}

function changeRaceSubtype(direction) {
  const definition = raceById(activeRaceCardId);
  const count = definition?.types?.length || 0;
  if (count < 2 || raceSubtypeTransitioning) return;
  const panels = dom.raceCardDetail.querySelectorAll(".race-card-art, .race-card-copy");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const updateProfile = () => {
    activeRaceSubtypeIndex = (activeRaceSubtypeIndex + direction + count) % count;
    renderRaceCardRules();
  };
  if (reducedMotion) {
    updateProfile();
    return;
  }
  raceSubtypeTransitioning = true;
  const outClass = direction > 0 ? "subtype-profile-out-left" : "subtype-profile-out-right";
  const inClass = direction > 0 ? "subtype-profile-in-right" : "subtype-profile-in-left";
  panels.forEach((panel) => panel.classList.add(outClass));
  setTimeout(() => {
    updateProfile();
    panels.forEach((panel) => {
      panel.classList.remove(outClass);
      panel.classList.add(inClass);
    });
    setTimeout(() => {
      panels.forEach((panel) => panel.classList.remove(inClass));
      raceSubtypeTransitioning = false;
    }, 330);
  }, 220);
}

function applyClassSelection(value) {
  if (character.phase !== "draft") return;
  const previousMaxHp = maximumHp();
  character.identity.classId = value;
  character.identity.className = classById(value).name;
  character.creation.classAttributeChoice = "";
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  if (character.identity.classId) scrollToCreationModifiers();
  notice(`${character.identity.className} selected. Class effects will apply during finalization.`, "success");
}

function renderClassGallery() {
  dom.classGalleryGrid.innerHTML = CLASS_DEFS.map((definition) => {
    const profile = CLASS_CARD_PROFILES[definition.id] || CLASS_CARD_PROFILES[""];
    const selected = character.identity.classId === definition.id;
    return `<button class="class-preview-card${selected ? " selected" : ""}" style="--class-accent:${escapeAttribute(profile.color)}" type="button" data-class-card="${escapeAttribute(definition.id)}">
      <span class="class-card-icon" aria-hidden="true">${profile.icon}</span><strong>${escapeHtml(definition.name)}</strong><small>${escapeHtml(profile.preview)}</small><b>${selected ? "Selected" : "View Class"}</b>
    </button>`;
  }).join("");
}

function showClassCardDetail(classId) {
  const definition = classById(classId);
  const profile = CLASS_CARD_PROFILES[definition.id] || CLASS_CARD_PROFILES[""];
  activeClassCardId = definition.id;
  dom.classCardDetail.style.setProperty("--class-accent", profile.color);
  dom.classCardDetailName.textContent = definition.name;
  dom.classCardDetailIcon.innerHTML = profile.icon;
  dom.classCardDetailSummary.textContent = definition.summary;
  const notes = [definition.manual, definition.pendingAtb ? "Some dedicated ATB prompts are still resolved at the table until their station or combat interface is added." : ""].filter(Boolean);
  dom.classCardDetailNotes.innerHTML = notes.length ? notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("") : "<li>All currently automated effects apply during finalization.</li>";
  dom.chooseClassCard.textContent = definition.id ? `Choose ${definition.name}` : "Choose No Class";
  dom.classGalleryChooser.hidden = true;
  dom.classCardDetail.hidden = false;
  dom.classCardDetail.classList.remove("class-card-entering");
  requestAnimationFrame(() => dom.classCardDetail.classList.add("class-card-entering"));
}

function openClassGallery() {
  if (character.phase !== "draft") return;
  activeClassCardId = "";
  renderClassGallery();
  dom.classCardDetail.hidden = true;
  dom.classGalleryChooser.hidden = false;
  dom.classGalleryModal.hidden = false;
  document.body.classList.add("class-gallery-open");
  dom.closeClassGallery.focus();
}

function closeClassGallery() {
  dom.classGalleryModal.hidden = true;
  document.body.classList.remove("class-gallery-open");
  activeClassCardId = "";
  dom.classCardPickerButton.focus({ preventScroll: true });
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
  dom.classCardPickerButton.disabled = character.phase !== "draft";
  dom.classCardPickerButton.textContent = character.identity.classId ? classDefinition.name : "Choose Class";
  dom.classCardPickerButton.classList.toggle("has-selection", Boolean(character.identity.classId));
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
      ? raceDefinition.types?.length && !raceType
        ? `<p class="modifier-empty race-type-required">choose race type from secondary drop down menu</p>`
        : `${modifierRulesMarkup("Racial Advantages", raceAdvantages, "advantage")}${modifierRulesMarkup("Racial Disadvantages", raceDisadvantages, "disadvantage")}`
      : `<p class="modifier-empty">Choose a race to display its advantages and disadvantages.</p>`;
  const classContent = character.identity.classId
    ? `${modifierRulesMarkup("Class Advantage", [classDefinition.summary], "advantage")}${modifierRulesMarkup("Class Disadvantages", [], "disadvantage")}`
    : `<p class="modifier-empty">Choose a class to display its advantages.</p>`;
  dom.automaticModifiers.innerHTML = `
    <article class="modifier-summary race-modifier">
      <strong>${raceName ? escapeHtml(raceName) : "Racial Modifiers"}</strong>
      ${raceContent}
      ${raceDefinition ? `<small>${character.phase === "finalized" ? "Automated effects are active; other listed rules remain available for table resolution." : "Creation effects are active now. Rules marked after character creation apply during finalization."}</small>` : ""}
    </article>
    <article class="modifier-summary class-modifier">
      <strong>${escapeHtml(classDefinition.name)}</strong>
      ${classContent}
      ${classDefinition.manual ? `<small>${escapeHtml(classDefinition.manual)}</small>` : ""}
      ${character.identity.classId ? `<small>${character.phase === "finalized" ? "Automated effects are active; other listed rules remain available for table resolution." : "Class effects apply during finalization."}</small>` : ""}
    </article>`;
}
function scrollToCreationModifiers() {
  if (character.phase !== "draft") return;
  requestAnimationFrame(() => {
    const panel = document.querySelector(".advantages-panel");
    if (!panel) return;
    panel.classList.remove("modifier-reveal");
    void panel.offsetWidth;
    panel.classList.add("modifier-reveal");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => panel.classList.remove("modifier-reveal"), 1700);
  });
}


function renderWorkflow() {
  const validation = draftValidation();
  dom.phaseBadge.className = `phase-badge ${character.phase}`;
  dom.workflowBar.classList.remove("invalid");
  dom.workflowBar.classList.toggle("draft-active", character.phase === "draft");
  dom.finalizeCharacter.hidden = character.phase === "finalized";
  dom.finalizeCharacter.classList.remove("finalize-spectrum");
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
    const attributePoints = Math.max(0, Math.round(Number(character.resources.attributePoints) || 0));
    const skillPoints = Math.max(0, Math.round(Number(character.resources.skillPoints) || 0));
    const available = [
      character.experience.available > 0 ? `${character.experience.available} XP` : "",
      attributePoints > 0 ? `${attributePoints} Attribute Points` : "",
      skillPoints > 0 ? `${skillPoints} Skill Points` : "",
    ].filter(Boolean);
    dom.phaseBadge.textContent = character.advancementOpen ? "Advancement" : "Finalized";
    dom.phaseBadge.classList.add("finalized");
    renderWorkflowRequirements([{
      label: character.advancementOpen ? `${available.join(" | ") || "No advancement points"} available to spend` : "Character Finalized",
      tone: "ready",
    }]);
    dom.workflowDetail.textContent = character.advancementOpen ? "Purchases are permanent. Finish spending when you are done." : "Race, Class, and creation allocations are locked.";
    dom.spendExperience.textContent = character.advancementOpen ? "Finish Spending" : attributePoints || skillPoints ? "Spend Advancement" : "Spend EXP";
    dom.spendExperience.disabled = Boolean(character.pendingRoll);
    return;
  }

  if (manualInputMode()) {
    dom.phaseBadge.textContent = "Manual Data Entry";
    dom.finalizeCharacter.textContent = "Finalize Character";
    dom.finalizeCharacter.disabled = false;
    dom.finalizeCharacter.classList.remove("finalize-spectrum");
    renderWorkflowRequirements([
      { label: "Copy Physical Character Data" },
      { label: "Ready to Finalize", tone: "ready" },
    ]);
    dom.workflowDetail.textContent = "Creation budgets are bypassed. Derived values update from the data entered below.";
    return;
  }

  dom.phaseBadge.textContent = character.importedDraft ? "Imported Draft" : "Draft";
  dom.finalizeCharacter.textContent = "Finalize Character";
  dom.finalizeCharacter.disabled = !validation.ready || fubsRollInProgress;
  const requirements = [];
  if (!character.identity.race.trim()) requirements.push({ key: "race", label: "Choose Race", target: "#raceCardPickerButton" });
  else if (!validation.raceComplete) {
    const race = selectedRace();
    requirements.push({ key: "race", label: `Choose ${race?.name || "Race"} Type`, target: "#raceTypePicker" });
  }
  if (!character.identity.classId) requirements.push({ key: "class", label: "Choose Class", target: "#classCardPickerButton" });
  if (!validation.raceClassCompatible) requirements.push({ key: "compatibility", label: "Change incompatible Race or Class", tone: "warning", target: "#raceCardPickerButton" });
  if (!validation.attributesComplete) {
    const difference = validation.attributeBudget - validation.attributeSpent;
    requirements.push({
      key: "attributes",
      label: difference > 0 ? `Spend ${difference} Attribute Points` : `Refund ${Math.abs(difference)} Attribute Points`,
      tone: difference < 0 ? "warning" : "",
      target: ".attributes-panel",
    });
  } else if (!validation.skillsComplete || validation.invalidSkills.size) {
    const difference = validation.skillBudget - validation.skillSpent;
    requirements.push({
      key: "skills",
      label: difference > 0 ? `Spend ${difference} Skill Points` : difference < 0 ? `Refund ${Math.abs(difference)} Skill Points` : `Resolve ${validation.invalidSkills.size} invalid skill ${validation.invalidSkills.size === 1 ? "entry" : "entries"}`,
      tone: difference < 0 || validation.invalidSkills.size ? "warning" : "",
      target: ".skills-panel",
    });
  }
  if (!identityComplete()) requirements.push({ key: "identity", label: "Fill in Identity", target: !validation.homePlanetComplete ? "#homePlanetPicker" : firstIncompleteIdentityTarget() });
  if (!backgroundComplete()) requirements.push({ key: "backstory", label: "Write Backstory", target: ".notes-panel" });
  else if (character.fubs.status === "unrolled" && !fubsRollInProgress) requirements.push({ key: "fubs", label: "Roll on FUBS Chart", target: "#fubsButton" });
  dom.finalizeCharacter.classList.toggle("finalize-spectrum", validation.ready && requirements.length === 0 && !fubsRollInProgress);
  renderWorkflowRequirements(requirements);
  dom.workflowDetail.textContent = validation.ready && requirements.length === 0
    ? "All creation tasks are complete. This character is ready to finalize."
    : validation.ready
      ? "Finalization is available. Optional creation tasks are still shown above."
    : validation.attributesComplete
      ? "All currently available creation steps are shown."
      : `Skills unlock after Attribute allocation is exactly ${validation.attributeBudget} points.`;
  if (!validation.ready && (validation.attributeSpent > validation.attributeBudget || validation.skillSpent > validation.skillBudget || validation.invalidSkills.size)) dom.workflowBar.classList.add("invalid");
}

function renderExperience() {
  const validation = draftValidation();
  const awardedAttributePoints = Math.max(0, Math.round(Number(character.resources.attributePoints) || 0));
  const awardedSkillPoints = Math.max(0, Math.round(Number(character.resources.skillPoints) || 0));
  const showAttributePoints = character.phase !== "finalized" || awardedAttributePoints > 0;
  const showSkillPoints = character.phase !== "finalized" || awardedSkillPoints > 0;
  dom.attributeBudget.closest("div").hidden = !showAttributePoints;
  dom.skillBudget.closest("div").hidden = !showSkillPoints;
  dom.workflowAttributeRemaining.closest("div").hidden = !showAttributePoints;
  dom.workflowSkillRemaining.closest("div").hidden = !showSkillPoints;
  dom.characterWorkspace.classList.toggle("has-awarded-points", character.phase === "finalized" && (awardedAttributePoints > 0 || awardedSkillPoints > 0));
  if (manualInputMode() && character.phase === "draft") {
    dom.attributeBudget.textContent = "Manual";
    dom.attributeBudget.className = "complete";
    dom.skillBudget.textContent = "Manual";
    dom.skillBudget.className = "complete";
    dom.attributeBudgetFormula.textContent = "Copied from a physical character sheet";
    dom.skillBudgetFormula.textContent = "Enter exact decimal Skill ratings";
    dom.xpAvailable.textContent = character.experience.available;
    dom.xpTotal.textContent = character.experience.totalGained;
    dom.xpFormula.textContent = "Unspent / Total Gained";
    dom.workflowExperience.textContent = `${character.experience.available} / ${character.experience.totalGained}`;
    dom.workflowAttributeRemaining.textContent = "Manual";
    dom.workflowAttributeRemaining.className = "complete";
    dom.workflowSkillRemaining.textContent = "Manual";
    dom.workflowSkillRemaining.className = "complete";
    dom.workflowCredits.textContent = (Number(character.resources.creditsBase) || 0).toLocaleString();
    return;
  }
  const attributeRemaining = character.phase === "draft" ? validation.attributeBudget - validation.attributeSpent : awardedAttributePoints;
  const skillRemaining = character.phase === "draft" ? validation.skillBudget - validation.skillSpent : awardedSkillPoints;
  if (character.phase === "finalized") {
    dom.attributeBudget.textContent = `${attributeRemaining} available`;
    dom.attributeBudget.className = attributeRemaining > 0 ? "" : "complete";
    dom.skillBudget.textContent = `${skillRemaining} available`;
    dom.skillBudget.className = skillRemaining > 0 ? "" : "complete";
    dom.attributeBudgetFormula.textContent = "Awarded by the GM; spend at printed creation costs";
    dom.skillBudgetFormula.textContent = "Awarded by the GM; each full Skill level costs its new level";
    dom.xpAvailable.textContent = character.experience.available;
    dom.xpTotal.textContent = character.experience.totalGained;
    dom.xpFormula.textContent = "Unspent / Total Gained";
    dom.workflowExperience.textContent = `${character.experience.available} / ${character.experience.totalGained}`;
    dom.workflowAttributeRemaining.textContent = String(attributeRemaining);
    dom.workflowAttributeRemaining.className = attributeRemaining > 0 ? "" : "complete";
    dom.workflowSkillRemaining.textContent = String(skillRemaining);
    dom.workflowSkillRemaining.className = skillRemaining > 0 ? "" : "complete";
    dom.workflowCredits.textContent = Number(character.resources.creditsBase || 0).toLocaleString();
    return;
  }
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
  const manualDraft = manualInputMode() && character.phase === "draft";
  const advancement = character.phase === "finalized" && character.advancementOpen;
  const awardedPoints = Math.max(0, Math.round(Number(character.resources.attributePoints) || 0));
  const interactive = (canPurchaseAttributes() || GM_ADJUSTMENT_MODE) && !character.pendingRoll;
  dom.attributeGrid.innerHTML = ATTRIBUTE_DEFS.map((definition) => {
    const rows = character.attributes[definition.key];
    const rowMarkup = rows.map((current, row) => {
      const progress = ((current + 1) / 5) * 100;
      const buttons = DICE_NAMES.map((dieName, column) => {
        const purchased = column <= current;
        const next = column === current + 1;
        const lockedFree = !manualDraft && row < 2 && column === 0;
        const cost = attributeStepCost(definition.key, row, column);
        const raceBlocked = character.identity.raceId === "tamalori" && definition.key === "strength" && column === 4;
        const allowedDraft = character.phase === "draft" && (next || column === current) && !lockedFree
          && !(character.identity.raceId === "tamalori" && definition.key === "strength" && column === 4);
        const advancementFunds = mechanicalSpiddixAttribute(definition.key) ? Number(character.resources.mechanicalExperience) || 0 : character.experience.available;
        const useAwardedPoints = awardedPoints >= cost;
        const refundableAdvancement = advancement && purchased && Boolean(lastRefundableAttributePurchase(definition.key, row, column));
        const allowedAdvancement = advancement && ((next && (useAwardedPoints || advancementFunds >= cost) && !raceBlocked) || refundableAdvancement);
        const disabled = !interactive || (!GM_ADJUSTMENT_MODE && !(allowedDraft || allowedAdvancement));
        let title = purchased ? `${dieName} purchased` : `Purchase ${dieName} for ${cost}`;
        if (lockedFree) title = `${dieName} is a free starting die`;
        else if (manualDraft && next) title = `Set this row to ${dieName}`;
        else if (manualDraft && column === current) title = `Remove ${dieName} from this row`;
        else if (character.phase === "draft" && column === current) title = `Refund ${cost} Attribute Points`;
        else if (refundableAdvancement) title = "Undo the most recent Attribute purchase";
        else if (advancement && next) title = `Spend ${cost} ${useAwardedPoints ? "Attribute Points" : mechanicalSpiddixAttribute(definition.key) ? "mechanical XP" : "XP"} to upgrade to ${dieName}`;
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
  const manualDraft = manualInputMode() && character.phase === "draft";
  const directSkillEntry = manualDraft || GM_ADJUSTMENT_MODE;
  const bonus = skillBonusTenths(name);
  const bonusParts = skillBonusParts(name);
  const displayed = displayedSkillTenths(name, skill);
  const level = skillCreationLevel(skill);
  const advancement = character.phase === "finalized" && character.advancementOpen;
  const draftBuying = character.phase === "draft" && validation.attributesComplete && !manualDraft;
  const creationPointCost = level + 1;
  const awardedSkillPoints = Math.max(0, Math.round(Number(character.resources.skillPoints) || 0));
  const usingAwardedSkillPoints = advancement && awardedSkillPoints >= creationPointCost;
  const nextCost = advancement ? usingAwardedSkillPoints ? creationPointCost : advancementSkillCost(skill.tenths) : creationPointCost;
  const mechanical = mechanicalSpiddixSkill(name);
  const advancementFunds = mechanical ? Number(character.resources.mechanicalExperience) || 0 : character.experience.available;
  const canIncrease = !character.pendingRoll && (GM_ADJUSTMENT_MODE || (draftBuying && level < MAX_STARTING_SKILL && validation.skillSpent + nextCost <= validation.skillBudget) || (advancement && (usingAwardedSkillPoints || advancementFunds >= nextCost)));
  const canDecrease = !character.pendingRoll && (GM_ADJUSTMENT_MODE ? skill.tenths > 0 : character.phase === "draft" && level > 0 && !manualDraft);
  const invalid = character.phase === "draft" && validation.invalidSkills.has(key);
  const locked = !(draftBuying || advancement || manualDraft);
  const rollable = character.phase === "finalized" && !character.advancementOpen && !character.pendingRoll && (!campaignCode || campaignEditable);
  const indicators = skillRuleIndicators(name);
  const markerMarkup = `${indicators.positive.length ? `<b class="skill-rule-sign positive" aria-label="Race or Class bonus">+</b>` : ""}${indicators.negative.length ? `<b class="skill-rule-sign negative" aria-label="Race or Class penalty">-</b>` : ""}`;
  const indicatorDetails = [...indicators.positive, ...indicators.negative].join(" | ");
  return `<div class="skill-row ${BOLD_SKILLS.has(name) ? "key-skill" : ""} ${invalid ? "invalid" : ""} ${locked ? "locked" : ""} ${rollable ? "rollable" : ""}" data-skill-key="${escapeAttribute(key)}" data-search-name="${escapeAttribute(name.toLowerCase())}" ${rollable ? `data-roll-skill="${escapeAttribute(key)}" role="button" tabindex="0" aria-label="Roll ${escapeAttribute(name)}"` : ""}>
    <span class="skill-name" title="${escapeAttribute(name)}"><span>${formatSkillName(name)}</span>${markerMarkup}</span>
    <button class="skill-refund" type="button" data-skill-action="decrease" data-skill-key="${escapeAttribute(key)}" aria-label="Decrease ${escapeAttribute(name)}" ${canDecrease ? "" : "disabled"}>-</button>
    <span class="skill-value">${directSkillEntry
      ? `<input class="manual-skill-rating${GM_ADJUSTMENT_MODE ? " gm-skill-rating" : ""}" ${GM_ADJUSTMENT_MODE ? `data-gm-skill-key="${escapeAttribute(key)}"` : `data-manual-skill-key="${escapeAttribute(key)}"`} type="number" min="0" step="0.1" inputmode="decimal" value="${GM_ADJUSTMENT_MODE ? ratingText(displayed) : (Number(skill.tenths || 0) / 10).toFixed(1)}" aria-label="${escapeAttribute(name)} rating" />`
      : `<strong>${ratingText(displayed)}</strong><small>${[bonus ? bonusParts.map((part) => `+${ratingText(part.value)} ${part.source.toUpperCase()}`).join(" ") : "", indicatorDetails].filter(Boolean).join(" | ")}</small>`}</span>
    <button class="skill-buy${GM_ADJUSTMENT_MODE ? " gm-skill-step" : ""}" type="button" data-skill-action="increase" data-skill-key="${escapeAttribute(key)}" aria-label="${GM_ADJUSTMENT_MODE ? `Increase ${escapeAttribute(name)} by 0.1` : `Spend ${nextCost} ${usingAwardedSkillPoints ? "Skill Points" : advancement && mechanical ? "mechanical XP" : advancement ? "XP" : "Skill Points"} to increase ${escapeAttribute(name)}`}" ${canIncrease ? "" : "disabled"}>${GM_ADJUSTMENT_MODE ? "<strong>+</strong>" : `<strong>${nextCost}</strong><small>${usingAwardedSkillPoints ? "SP" : advancement && mechanical ? "MXP" : advancement ? "XP" : "SP"}</small>`}</button>
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
  const manualDraft = manualInputMode() && character.phase === "draft";
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
    <button class="row-remove" type="button" data-remove-custom-skill="${skill.id}" aria-label="Remove custom skill" ${(canManageCustomSkills && (manualDraft || skill.tenths === 0)) ? "" : "disabled"}>-</button>
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
    return `<${element} class="exertion-unit ${capacity ? "has-capacity" : "inactive"} ${filled ? "filled available" : ""} ${chosen ? "selected" : ""}" ${attributes}><span class="exertion-charge" ${GM_ADJUSTMENT_MODE ? "data-gm-direct-edit=\"exertionCurrent\"" : ""}></span><span class="exertion-capacity" ${GM_ADJUSTMENT_MODE ? "data-gm-direct-edit=\"exertionMax\"" : ""}></span></${element}>`;
  }).join("");
}

function renderResources() {
  syncDerivedResources();
  const manualDraft = manualInputMode() && character.phase === "draft";
  dom.manualDataPanel.hidden = !manualDraft;
  if (manualDraft) {
    dom.manualDataPanel.querySelectorAll("[data-manual-resource]").forEach((input) => {
      if (document.activeElement !== input) input.value = getPath(character, input.dataset.manualResource) ?? 0;
    });
  }
  const move = calculatedMoveSpeedDetails();
  const race = raceEffects();
  const classDefinition = classById(character.identity.classId);
  const classCredits = Number(classEffects().creditsBonus) || 0;
  const maxHpCost = Number(race.maxHpReverenceCost) || 6;
  const maxHpForbidden = Boolean(race.forbidMaxHpReverence);
  dom.exertionMeter.innerHTML = exertionMeterMarkup(character.resources.exertionCurrent, character.resources.exertionMax);
  if (GM_ADJUSTMENT_MODE) dom.exertionMeter.dataset.gmDirectEdit = "exertionCurrent";
  dom.restExertion.disabled = character.resources.exertionCurrent >= character.resources.exertionMax || Boolean(character.pendingRoll);
  dom.spendOneExertion.disabled = character.phase !== "finalized" || character.resources.exertionCurrent < 1 || Boolean(character.pendingRoll) || (Boolean(campaignCode) && !campaignEditable);
  const gmExertion = Number(character.gmAdjustments?.exertionMax) || 0;
  dom.exertionFormula.textContent = `Base 1 + each Willpower die at D10 or higher${gmExertion ? ` ${gmExertion > 0 ? "+" : ""}${gmExertion} GM adjustment` : ""}`;
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
  dom.reverenceMeter.innerHTML = Array.from({ length: 10 }, (_, index) => `<span class="reverence-slot ${index < character.resources.reverence ? "filled" : ""}" ${GM_ADJUSTMENT_MODE ? `data-gm-reverence="${index + 1}"` : "aria-hidden=\"true\""}></span>`).join("");
  dom.maxHpBonus.disabled = character.phase !== "finalized" || maxHpForbidden || character.resources.reverence < maxHpCost || Boolean(character.pendingRoll);
  dom.maxHpBonus.title = maxHpForbidden ? `${selectedRace()?.name || "This race"} cannot purchase Maximum HP with Reverence.` : `Spend ${maxHpCost} Reverence for +2 Maximum HP`;
  dom.maxHpBonus.querySelector("small").textContent = maxHpForbidden ? "Unavailable to this race" : `Spend ${maxHpCost} for +2 HP`;
  dom.spendOneReverence.disabled = character.phase !== "finalized" || character.resources.reverence < 1 || Boolean(character.pendingRoll) || (Boolean(campaignCode) && !campaignEditable);
  const giftTargets = (campaignState?.characters || []).filter((record) => record.id !== campaignCharacterId);
  dom.giftReverence.disabled = character.phase !== "finalized" || !campaignCode || !campaignEditable || giftTargets.length === 0;
  dom.giftReverence.title = giftTargets.length ? "Suggest a Reverence reward for another character" : "No other campaign characters are available";
  dom.characterAtbColor.value = character.presentation.atbColor;
  dom.speedPreview.style.setProperty("--atb-preview-color", character.presentation.atbColor);
  const dramaHand = campaignState?.role === "character" && campaignState.ownCharacterId === campaignCharacterId && character.id === campaignCharacterId
    ? campaignState.dramaDeck?.hand || []
    : [];
  const dramaCount = dramaHand.length || Math.max(0, Number(character.resources.dramaCards) || 0);
  dom.dramaCardsValue.textContent = dramaCount;
  dom.dramaCardsFormula.textContent = campaignState?.role === "character"
    ? `${dramaCount}/${DRAMA_CARD_HAND_LIMIT} purchase limit; card effects may exceed it`
    : "Join a campaign to use its shared deck";
  dom.dramaCardHandStatus.textContent = dramaHand.length
    ? `${dramaHand.length} card${dramaHand.length === 1 ? "" : "s"} held`
    : "No cards held";
  dom.dramaCardHand.innerHTML = dramaHand.map((card) => `<button type="button" class="drama-card-mini" data-drama-card="${escapeAttribute(card.id)}" data-category="${escapeAttribute(card.category)}" aria-label="Open ${escapeAttribute(card.name)}">${dramaCardMiniMarkup(card)}</button>`).join("");
  const mayPurchaseDrama = character.phase === "finalized"
    && campaignState?.role === "character"
    && campaignEditable
    && dramaHand.length < DRAMA_CARD_HAND_LIMIT
    && character.resources.reverence >= DRAMA_CARD_COST;
  dom.purchaseDramaCard.disabled = !mayPurchaseDrama;
  dom.purchaseDramaCard.querySelector("small").textContent = `Spend ${DRAMA_CARD_COST} Reverence`;
  dom.purchaseDramaCard.title = !campaignState
    ? "Join a campaign to draw from its shared deck."
    : dramaHand.length >= DRAMA_CARD_HAND_LIMIT
      ? `Purchase limit reached (${DRAMA_CARD_HAND_LIMIT}).`
      : character.resources.reverence < DRAMA_CARD_COST
        ? `Requires ${DRAMA_CARD_COST} Reverence.`
        : "Draw one unique card from the campaign deck.";
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
    const borrowedDie = attributeKey === "dexterity"
      ? highestAttributeDie("intellect")
      : attributeKey === "intellect"
        ? highestAttributeDie("dexterity")
        : Math.max(highestAttributeDie("dexterity"), highestAttributeDie("intellect"));
    sides.push(borrowedDie);
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

const SKILL_EQUIPMENT = [
  { catalogId: "advanced-climbing-gear", skill: "Climb", bonus: 4, label: "Adv. Climbing Gear", detail: "+4 while used" },
  { catalogId: "electronics-toolkit", skill: "Engineering", bonus: 2, label: "Electronics Toolkit", detail: "+2; spends 1 use", consumableUse: true },
  { catalogId: "chameleon-cloak", skill: "Stealth/Hide", bonus: 4, label: "Chameleon Cloak", detail: "+4 while immobile" },
  { catalogId: "vr-headset", skill: "Computer Systems", bonus: 2, label: "VR Headset", detail: "+2 at an adapted terminal" },
];

function relevantSkillEquipment() {
  if (!skillCheck || skillCheck.attributeOnly) return [];
  const skillName = skillCheckResolvedSkill()?.name || "";
  return SKILL_EQUIPMENT.flatMap((rule) => {
    if (rule.skill !== skillName) return [];
    const item = (character.items || []).find((entry) => entry.catalogId === rule.catalogId && Number(entry.quantity) > 0);
    if (!item) return [];
    const uses = rule.consumableUse ? Math.max(0, Number(item.charges ?? 5)) : null;
    if (rule.consumableUse && uses <= 0) return [];
    return [{ ...rule, item, uses }];
  });
}

function selectedSkillEquipment() {
  const selected = skillCheck?.selectedEquipment || new Set();
  return relevantSkillEquipment().filter((rule) => selected.has(rule.catalogId));
}

function renderSkillEquipment() {
  const choices = relevantSkillEquipment();
  dom.skillEquipmentBlock.hidden = choices.length === 0;
  dom.skillEquipmentChoices.innerHTML = choices.map((rule) => {
    const active = skillCheck.selectedEquipment.has(rule.catalogId);
    const remaining = rule.consumableUse ? ` | ${rule.uses}/5 uses` : "";
    return `<button type="button" class="skill-equipment-choice ${active ? "active" : ""}" data-skill-equipment="${escapeAttribute(rule.catalogId)}" aria-pressed="${active}"><strong>${escapeHtml(rule.label)}</strong><small>${escapeHtml(rule.detail + remaining)}</small></button>`;
  }).join("");
}

function rollRuleExplanations() {
  if (!skillCheck) return [];
  const profile = rollRuleProfile();
  const lines = [];
  const raceName = raceById(profile.raceId)?.name || "Race";
  const className = classById(profile.classId)?.name || "Class";
  const add = (source, text) => lines.push(`${source}: ${text}`);

  if (profile.classId === "ambassador-spy" && ["charisma", "luck"].includes(profile.attributeKey)) add(className, `adds the highest ${profile.attributeKey === "charisma" ? "Luck" : "Charisma"} die.`);
  if (profile.classId === "gunner" && profile.skillName === "Weapon Systems") add(className, `adds the highest ${profile.attributeKey === "dexterity" ? "Intellect" : "Dexterity"} die to this Weapon Systems pool.`);
  if (profile.classId === "science-officer" && profile.attributeKey === "perception") add(className, "adds every Intellect die to Perception rolls.");
  if (profile.classId === "peacekeeper" && profile.skillName === "Negotiation/Persuade") add(className, "adds 1D12 to Negotiation/Persuade.");
  if (profile.classId === "smuggler" && ["charisma", "intellect"].includes(profile.attributeKey)) add(className, `adds the two highest ${profile.attributeKey === "charisma" ? "Intellect" : "Charisma"} dice.`);
  if (profile.classId === "ninja" && profile.skillName === "Stealth/Hide" && skillCheck.committedExertion) add(className, `each Exertion adds 1D12 and +5; ${skillCheck.committedExertion} spent.`);
  if (profile.classId === "marine-soldier" && profile.skillName === "Projectile") add(className, "three matching Projectile dice may fuse together.");
  if (profile.classId === "other" && character.creation.classAttributeChoice === profile.attributeKey) add(className, "unused Attribute dice add their results as decimals.");

  if (profile.raceId === "flavilin" && profile.attributeKey === "perception") add(raceName, "adds 1D12 to Perception rolls.");
  if (profile.raceId === "nordic-flaxen" && profile.attributeKey === "charisma") add(raceName, "adds every Luck die to Charisma rolls.");
  if (profile.raceId === "tamalori" && profile.attributeKey === "dexterity") add(raceName, "doubles the Dexterity dice pool.");
  if (profile.raceId === "krax-gny-vtek" && profile.attributeKey === "dexterity" && maximumHp() - character.health.current >= 5) add(raceName, "injury limits this Dexterity pool to three dice.");
  if (profile.raceId === "butchers-of-hellmouth" && profile.attributeKey === "perception") add(raceName, "limits Perception rolls to two dice.");
  if (profile.raceId === "garmoc" && ["charisma", "intellect"].includes(profile.attributeKey)) add(raceName, "these dice cannot fuse and die results cannot exceed 8.");
  if (profile.raceId === "garmoc" && ["strength", "health", "willpower"].includes(profile.attributeKey)) add(raceName, "each qualifying D10/D12 fusion adds one independent D20 that cannot fuse.");
  if (profile.raceId === "yetuak-zune" && profile.attributeKey === "charisma") add(raceName, "Charisma dice cannot fuse.");
  if (profile.raceId === "draco-prime") add(raceName, "only one pair of dice may fuse.");
  if (profile.raceId === "horus" && profile.attributeKey === "perception") add(raceName, "Perception fusions may chain.");
  if (profile.raceId === "everliving-brethren" && profile.attributeKey === "perception") add(raceName, "removes the highest Perception die result before resolving.");
  if (profile.raceId === "xithx" && profile.skillName === "Stealth/Hide") add(raceName, "removes the highest die result from Stealth/Hide.");
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy" && profile.attributeKey === "strength") add("Fluffy Antropic", "applies -2 to Strength rolls.");
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy" && profile.skillName === "Jump") add("Fluffy Antropic", "applies +5 to Jump.");
  if (profile.raceId === "skeder" && profile.skillName === "Jump") add(raceName, "applies +3 to Jump.");
  if (profile.raceId === "skeder" && profile.attributeKey === "charisma") add(raceName, "Charisma succeeds only on a Critical Success.");
  if (profile.raceId === "android" && profile.skillName === "Initiative") add(raceName, "applies +5 to Initiative checks.");
  if (profile.raceId === "epoc" && ["strength", "health", "dexterity", "perception"].includes(profile.attributeKey)) add(raceName, "each die result of 1 applies -1 to the final Score.");
  if (profile.raceId === "angiluros" && ["Jump", "Climb"].includes(profile.skillName)) add(raceName, "ordinary successes become Critical Successes; Critical Failures become Failures.");
  if (profile.raceId === "kabuto" && profile.skillName === "Resist Distress") add(raceName, "every successful Resist Distress check becomes a Critical Success.");
  selectedSkillEquipment().forEach((rule) => add(rule.label, `${rule.detail}${rule.consumableUse ? "; one use was spent." : "."}`));
  return lines;
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
  renderSkillEquipment();
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
    selectedEquipment: new Set(),
    equipmentCommitted: false,
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
    selectedEquipment: new Set(),
    equipmentCommitted: false,
  };
  dom.skillCheckModal.hidden = false;
  document.body.classList.add("skill-check-open");
  renderSkillSetup();
}

function closeSkillCheck(options = {}) {
  if (diceRoller.isActive()) return;
  const discardCombat = options?.discardCombat === true;
  const abandonedCombatRequest = !discardCombat && skillCheck?.combatRequest && !skillCheck.combatSubmitted
    ? { type: "roll", ...skillCheck.combatRequest }
    : null;
  skillCheck = null;
  dom.skillCheckModal.hidden = true;
  document.body.classList.remove("skill-check-open", "skill-roll-active");
  if (abandonedCombatRequest) pendingCombatRequest = abandonedCombatRequest;
  setTimeout(processPendingCombatRequest, 0);
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
  if (!skillCheck.equipmentCommitted) {
    for (const rule of selectedSkillEquipment()) {
      if (!rule.consumableUse) continue;
      const current = Math.max(0, Number(rule.item.charges ?? 5));
      if (current < 1) {
        notice(`${rule.label} has no uses remaining.`, "error");
        renderSkillSetup();
        return false;
      }
      rule.item.charges = current - 1;
    }
    skillCheck.equipmentCommitted = true;
    if (skillCheck.selectedEquipment.size) queueSave();
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
  const ruleLines = rollRuleExplanations();
  dom.skillResultRules.hidden = ruleLines.length === 0;
  dom.skillResultRules.innerHTML = ruleLines.map((line) => `<small>${escapeHtml(line)}</small>`).join("");
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
  submitCombatRollResult({ score, manual, diceResults });
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

function submitCombatRollResult({ score, manual, diceResults }) {
  const request = skillCheck?.combatRequest;
  if (!request || skillCheck.combatSubmitted || !dom.playerAtbFrame?.contentWindow) return;
  skillCheck.combatSubmitted = true;
  dom.playerAtbFrame.contentWindow.postMessage({
    type: "sa-combat-roll-result",
    attackId: request.attackId,
    rollRole: request.rollRole,
    score,
    mode: manual ? "manual" : "automatic",
    diceResults,
  }, window.location.origin);
}

function damageFormulaPool(formula) {
  const source = String(formula || "").replace(/\s+/g, "");
  const dice = [];
  const counts = new Map();
  const pattern = /([+-]?)(\d+)D(4|6|8|10|12|20)/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const sides = Number(match[3]);
    const signedCount = (match[1] === "-" ? -1 : 1) * Number(match[2]);
    counts.set(sides, (counts.get(sides) || 0) + signedCount);
  }
  for (const [sides, count] of counts) {
    for (let index = 0; index < Math.max(0, count); index += 1) dice.push(sides);
  }
  const withoutDice = source.replace(pattern, "");
  const flat = (withoutDice.match(/[+-]?\d+(?:\.\d+)?/g) || []).reduce((sum, value) => sum + Number(value), 0);
  const supported = /^(?:[+-]?(?:\d+D(?:4|6|8|10|12|20)|\d+(?:\.\d+)?))+$/.test(source);
  return { dice, flat, supported };
}

function openCombatSkillRequest(request) {
  const skillKey = campaignSkillKey(request.skill);
  if (!skillKey) return;
  openSkillCheck(skillKey);
  if (!skillCheck) return;
  skillCheck.combatRequest = request;
  skillCheck.combatSubmitted = false;
  skillCheck.difficulty = request.difficulty === null || request.difficulty === undefined ? "" : String(request.difficulty);
  selectSkillAttribute(request.attribute || "dexterity");
  for (const sides of request.bonusDice || []) {
    const value = Number(sides);
    if ([4, 6, 8, 10, 12, 20].includes(value)) skillCheck.activeSides.push(value);
  }
  renderSkillSetup();
  const firstAid = request.rollRole === "firstAid";
  dom.skillCheckKicker.textContent = firstAid ? "First Aid Resolution" : request.rollRole === "attacker" ? "Combat To-Hit" : "Combat Defense";
  dom.skillCheckTitle.textContent = firstAid
    ? "Intellect + Anatomy/First Aid"
    : request.rollRole === "attacker" ? "Dexterity + " + (request.skill || "Projectile") : "Dexterity + Dodge/Block";
  dom.skillDifficulty.value = skillCheck.difficulty;
  dom.skillCheckSubtitle.textContent = request.subtitle || "Submit the completed Score. The app applies weapon and Range modifiers afterward.";
  dom.changeSkillAttribute.hidden = true;
}

function openCombatDamageRequest(request) {
  activeCombatDamageRequest = request;
  combatDamageSubmitted = false;
  const parsed = damageFormulaPool(request.damageFormula);
  request.parsedDamage = parsed;
  const healing = Boolean(request.healing);
  dom.combatDamageTitle.textContent = healing ? "Roll First Aid Healing" : "Roll " + request.weaponName + " Damage";
  dom.combatDamageSubtitle.textContent = healing
    ? `Add every healing die.${request.addScore ? ` The First Aid Score (${request.addScore}) is added automatically.` : ""}`
    : "Add every Damage die. Damage dice do not fuse.";
  dom.combatDamageWeapon.textContent = healing ? "First Aid" : request.weaponName;
  dom.combatDamageFormula.textContent = request.damageFormula;
  dom.combatDamageTarget.textContent = request.targetName;
  dom.combatDamageManual.value = "";
  dom.combatDamageManual.disabled = false;
  dom.submitManualCombatDamage.hidden = false;
  dom.rollCombatDamage.hidden = false;
  dom.exitCombatDamageResult.hidden = true;
  dom.combatDamageResult.hidden = true;
  dom.combatDamageResult.textContent = "";
  dom.combatDamageError.textContent = parsed.supported ? "" : "This card uses an unusual formula. Enter the completed Damage total manually.";
  dom.rollCombatDamage.disabled = !parsed.supported;
  dom.combatDamageCritical.hidden = healing || !request.critical;
  dom.combatDamageCritical.textContent = request.calledShot
    ? "CRITICAL EFFECT - DAMAGE IS NOT DOUBLED"
    : request.criticalDamageDisabled
      ? "CRITICAL HIT - THIS CARD PREVENTS DOUBLING"
      : "CRITICAL HIT - DAMAGE DOUBLED";
  dom.combatDamageModal.hidden = false;
  document.body.classList.add("skill-check-open");
}

function combatDeathSequenceActive() {
  return Date.now() < combatDeathSequenceUntil;
}

function beginCombatDeathSequence(duration) {
  combatDeathSequenceUntil = Math.max(combatDeathSequenceUntil, Date.now() + Math.max(0, Number(duration) || 5600));
  document.body.classList.add("combat-death-sequence");
  suspendedSkillPromptForDefeat = false;
  suspendedDamagePromptForDefeat = false;

  if (skillCheck && !diceRoller.isActive()) {
    if (!dom.skillResultStage.hidden) closeSkillCheck({ discardCombat: true });
    else if (!dom.skillCheckModal.hidden) {
      dom.skillCheckModal.hidden = true;
      document.body.classList.remove("skill-check-open");
      suspendedSkillPromptForDefeat = true;
    }
  }
  if (!dom.combatDamageModal.hidden) {
    if (combatDamageSubmitted && !dom.exitCombatDamageResult.hidden) closeCombatDamageResult({ processNext: false });
    else {
      dom.combatDamageModal.hidden = true;
      document.body.classList.remove("skill-check-open");
      suspendedDamagePromptForDefeat = true;
    }
  }

  showCharacterPanel("atb");
  window.clearTimeout(combatDeathSequenceTimer);
  combatDeathSequenceTimer = window.setTimeout(() => {
    combatDeathSequenceTimer = null;
    document.body.classList.remove("combat-death-sequence");
    if (suspendedSkillPromptForDefeat && skillCheck) {
      dom.skillCheckModal.hidden = false;
      document.body.classList.add("skill-check-open");
    }
    if (suspendedDamagePromptForDefeat && activeCombatDamageRequest && !combatDamageSubmitted) {
      dom.combatDamageModal.hidden = false;
      document.body.classList.add("skill-check-open");
    }
    suspendedSkillPromptForDefeat = false;
    suspendedDamagePromptForDefeat = false;
    processPendingCombatRequest();
  }, Math.max(0, combatDeathSequenceUntil - Date.now()) + 40);
}

function processPendingCombatRequest() {
  if (combatDeathSequenceActive() || !pendingCombatRequest || skillCheck || diceRoller.isActive() || !dom.combatDamageModal.hidden) return;
  const request = pendingCombatRequest;
  pendingCombatRequest = null;
  if (request.type === "damage") openCombatDamageRequest(request);
  else openCombatSkillRequest(request);
}

function finishCombatDamage(rolledDamage, mode, diceResults = []) {
  if (!activeCombatDamageRequest || combatDamageSubmitted) return;
  combatDamageSubmitted = true;
  dom.combatDamageResult.hidden = false;
  dom.combatDamageResult.textContent = diceResults.length
    ? "DICE: " + diceResults.join(" + ") + (activeCombatDamageRequest.parsedDamage.flat ? " | FLAT " + activeCombatDamageRequest.parsedDamage.flat : "") + " = " + formatNumber(rolledDamage)
    : `${activeCombatDamageRequest.healing ? "MANUAL HEALING" : "MANUAL DAMAGE"}: ${formatNumber(rolledDamage)}`;
  dom.combatDamageManual.disabled = true;
  dom.submitManualCombatDamage.hidden = true;
  dom.rollCombatDamage.hidden = true;
  dom.exitCombatDamageResult.hidden = false;
  dom.playerAtbFrame?.contentWindow?.postMessage(activeCombatDamageRequest.healing ? {
    type: "sa-combat-healing-result",
    resolutionId: activeCombatDamageRequest.resolutionId || activeCombatDamageRequest.attackId,
    rolledHealing: rolledDamage,
    mode,
    diceResults,
  } : {
    type: "sa-combat-damage-result",
    attackId: activeCombatDamageRequest.attackId,
    rolledDamage,
    mode,
    diceResults,
  }, window.location.origin);
}

function closeCombatDamageResult(options = {}) {
  const processNext = options?.processNext !== false;
  dom.combatDamageModal.hidden = true;
  document.body.classList.remove("skill-check-open", "skill-roll-active");
  activeCombatDamageRequest = null;
  combatDamageSubmitted = false;
  dom.exitCombatDamageResult.hidden = true;
  if (processNext) processPendingCombatRequest();
}

function resetCombatInterfaceState({ clearFrame = false } = {}) {
  window.clearTimeout(combatDeathSequenceTimer);
  combatDeathSequenceTimer = null;
  combatDeathSequenceUntil = 0;
  suspendedSkillPromptForDefeat = false;
  suspendedDamagePromptForDefeat = false;
  document.body.classList.remove("combat-death-sequence");
  pendingCombatRequest = null;
  lastReceivedCombatRequestKey = "";
  if (skillCheck?.combatRequest) closeSkillCheck({ discardCombat: true });
  closeCombatDamageResult({ processNext: false });
  if (clearFrame && dom.playerAtbFrame) {
    dom.playerAtbFrame.removeAttribute("src");
    delete dom.playerAtbFrame.dataset.campaignCode;
  }
}

function submitManualCombatDamage() {
  if (!activeCombatDamageRequest || combatDamageSubmitted) return;
  const value = Number(dom.combatDamageManual.value);
  if (dom.combatDamageManual.value.trim() === "" || !Number.isFinite(value) || value < 0) {
    dom.combatDamageError.textContent = "Enter the completed Damage total.";
    dom.combatDamageManual.focus();
    return;
  }
  finishCombatDamage(value, "manual", []);
}

function rollCombatDamage() {
  if (!activeCombatDamageRequest || combatDamageSubmitted || diceRoller.isActive()) return;
  const parsed = activeCombatDamageRequest.parsedDamage;
  if (!parsed?.supported) return;
  if (!parsed.dice.length) {
    finishCombatDamage(Math.max(0, parsed.flat), "automatic", []);
    return;
  }
  dom.combatDamageModal.hidden = true;
  document.body.classList.add("skill-roll-active");
  diceRoller.rollPool({
    sides: parsed.dice,
    title: activeCombatDamageRequest.weaponName + " Damage",
    subtitle: "Add every die. No fusion.",
    fusion: false,
    onResolved: () => {},
    onSettled: (results) => {
      document.body.classList.remove("skill-roll-active");
      diceRoller.stop();
      const deathActive = combatDeathSequenceActive();
      if (!deathActive) dom.combatDamageModal.hidden = false;
      finishCombatDamage(Math.max(0, results.reduce((sum, value) => sum + value, 0) + parsed.flat), "automatic", results);
      if (deathActive) closeCombatDamageResult({ processNext: false });
    },
  });
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

async function resolvePhysicalSkillRoll(results) {
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
  const garmocBonusCount = profile.raceId === "garmoc" && ["strength", "health", "willpower"].includes(profile.attributeKey)
    ? analyzed.fusions.filter((fusion) => fusion.sourceIndices.some((index) => [10, 12].includes(Number(skillCheck.currentRollSides[index])))).length
    : 0;
  let garmocBonusResults = [];
  if (garmocBonusCount) {
    dom.skillCheckModal.hidden = true;
    document.body.classList.add("skill-roll-active");
    garmocBonusResults = await new Promise((resolve) => diceRoller.rollPool({
      sides: Array.from({ length: garmocBonusCount }, () => 20), title: "Garmoc Fusion Bonus",
      subtitle: `${garmocBonusCount} independent D20${garmocBonusCount === 1 ? "" : "s"}; these dice cannot fuse.`, fusion: false,
      onResolved: () => {}, onSettled: (bonusResults) => {
        document.body.classList.remove("skill-roll-active"); diceRoller.stop(); dom.skillCheckModal.hidden = false; resolve(bonusResults);
      },
    }));
  }
  const values = [
    ...skillCheck.preservedFusions.map((fusion) => fusion.value),
    ...analyzed.fusions.map((fusion) => fusion.value),
    ...analyzed.leftovers,
    ...garmocBonusResults,
  ].sort((a, b) => b - a);
  const top = values.slice(0, 2);
  const diceTotal = top.reduce((sum, value) => sum + value, 0);
  const resolved = skillCheckResolvedSkill();
  const skillBonus = skillCheck.attributeOnly ? 0 : combinedSkillBonusTenths(resolved.name, resolved.skill) / 10;
  let flatBonus = skillCheck.committedExertion;
  const equipmentRules = selectedSkillEquipment();
  const equipmentBonus = equipmentRules.reduce((sum, rule) => sum + rule.bonus, 0);
  flatBonus += equipmentBonus;
  const intoxicationBonus = character.statuses?.intoxicated
    ? (["charisma", "willpower"].includes(profile.attributeKey) ? 2 : ["dexterity", "intellect"].includes(profile.attributeKey) ? -3 : 0)
    : 0;
  flatBonus += intoxicationBonus;
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
  if (garmocBonusResults.length) equationParts.push(`Garmoc fusion bonus: ${garmocBonusResults.map((value) => `D20=${value}`).join(", ")}`);
  if (intoxicationBonus) equationParts.push(`STILL DRUNK ${intoxicationBonus > 0 ? "+" : ""}${intoxicationBonus}`);
  if (equipmentBonus) equationParts.push(`Equipment +${equipmentBonus}`);
  const allOnes = results.length > 0 && results.every((value) => value === 1);
  if (allOnes) {
    equationParts.push("INPUT QUALITY: QUESTIONABLE");
    document.body.classList.add("dice-input-flicker");
    showRollResultToast("INPUT QUALITY: QUESTIONABLE");
    setTimeout(() => document.body.classList.remove("dice-input-flicker"), 760);
  }
  showSkillResult({
    score,
    equation: equationParts.join(" | "),
    outcome,
    newFusions: analyzed.fusions,
    diceResults: [...adjustedResults, ...garmocBonusResults],
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
  const equipment = selectedSkillEquipment();
  const equipmentReminder = equipment.length ? ` | Include ${equipment.map((rule) => `${rule.label} +${rule.bonus}`).join(", ")} in this entered Score` : "";
  showSkillResult({
    score,
    equation: `Manual Final Score${committed}${equipmentReminder}${character.statuses?.intoxicated ? " | STILL DRUNK (include the printed Attribute modifier)" : ""}`,
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
  const gmSpeed = Number(character.gmAdjustments?.speed) || 0;
  dom.derivedSpeedFormula.textContent = `Intellect boxes ${intellectBoxes} + Initiative ${formatNumber(initiativeRating)}${mastermind ? " x1.5 Mastermind" : ""}${initiativeParts.length ? ` (${initiativeParts.map((part) => `+${ratingText(part.value)} ${part.source}`).join(", ")})` : ""}${gmSpeed ? ` ${gmSpeed > 0 ? "+" : ""}${gmSpeed} GM adjustment` : ""}${derived.weaponOverloaded ? " x0.70 Weapon Slot overload" : ""}`;
  syncSpeedPreview(derived.speed);
  dom.derivedCommand.textContent = `${formatNumber(derived.command)} sec`;
  const awarenessSeconds = character.identity.classId === "mastermind" && finalizedModifiersActive() ? 45 : 12;
  const perceptionBoxes = boxesFilled("perception");
  const awarenessRating = displayedSkillTenths("Awareness", character.skills.Awareness) / 10;
  const gmCommandBonus = campaignCommandWindowBonus();
  const gmCommand = Number(character.gmAdjustments?.command) || 0;
  dom.derivedCommandFormula.textContent = `Perception boxes ${perceptionBoxes} x8 + Awareness ${formatNumber(awarenessRating)} x${awarenessSeconds}${awarenessParts.length ? ` (${awarenessParts.map((part) => `+${ratingText(part.value)} ${part.source}`).join(", ")})` : ""}${gmCommandBonus ? ` + GM bonus ${gmCommandBonus} sec` : ""}${gmCommand ? ` ${gmCommand > 0 ? "+" : ""}${gmCommand} GM adjustment` : ""}`;
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
  if (GM_ADJUSTMENT_MODE) {
    [dom.derivedSpeed, dom.derivedCommand, dom.maximumHp, dom.permanentHpBonus, dom.damageReduction, dom.currentHp, dom.moveSpeedValue, dom.creditsValue, dom.reverenceCurrent, dom.xpAvailable, dom.xpTotal]
      .filter(Boolean).forEach((element) => { element.dataset.gmDirectEdit = element.id; });
  }
}

function requestGmNumber(label, current, { min = -999999, max = 999999, step = "0.1" } = {}) {
  return new Promise((resolve) => {
    const shell = document.createElement("div");
    shell.className = "modal-shell";
    shell.innerHTML = `<section class="confirm-dialog" role="dialog" aria-modal="true"><span class="dialog-kicker">GM Adjustment</span><h2>${escapeHtml(label)}</h2><label>New Value<input data-gm-number type="number" min="${min}" max="${max}" step="${step}" value="${escapeAttribute(current)}" /></label><div class="dialog-actions"><button type="button" data-gm-number-action="cancel">Cancel</button><button class="primary-action" type="button" data-gm-number-action="save">Apply</button></div></section>`;
    document.body.append(shell);
    const input = shell.querySelector("[data-gm-number]");
    const close = (value) => { shell.remove(); resolve(value); };
    shell.addEventListener("click", (event) => {
      const action = event.target.closest("[data-gm-number-action]")?.dataset.gmNumberAction;
      if (action === "cancel") close(null);
      if (action === "save") close(Math.max(min, Math.min(max, Number(input.value))));
    });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") close(Math.max(min, Math.min(max, Number(input.value)))); });
    input.focus({ preventScroll: true });
    input.select();
  });
}

async function handleGmDirectEdit(element) {
  if (!GM_ADJUSTMENT_MODE) return false;
  const key = element.dataset.gmDirectEdit;
  const details = {
    derivedSpeed: ["ATB Speed", derivedValues().speed, 0, 9999, "0.1"],
    derivedCommand: ["Command Window (seconds)", derivedValues().command, 0, 999999, "0.1"],
    maximumHp: ["Maximum HP", maximumHp(), 0, 999999, "1"],
    permanentHpBonus: ["Permanent HP Bonus", character.health.permanentBonus, -9999, 999999, "1"],
    damageReduction: ["Damage Reduction", damageReductionDetails().value, 0, 999999, "0.1"],
    currentHp: ["Current HP", character.health.current, -9999, maximumHp(), "1"],
    moveSpeedValue: ["Move Speed", calculatedMoveSpeed(), 0, 9999, "0.1"],
    creditsValue: ["Credits", character.resources.creditsBase, -999999999, 999999999, "1"],
    reverenceCurrent: ["Reverence", character.resources.reverence, 0, 10, "1"],
    xpAvailable: ["Unspent Experience", character.experience.available, 0, 999999999, "1"],
    xpTotal: ["Total Experience Received", character.experience.totalGained, 0, 999999999, "1"],
    exertionCurrent: ["Current Exertion", character.resources.exertionCurrent, 0, character.resources.exertionMax, "1"],
    exertionMax: ["Maximum Exertion", character.resources.exertionMax, 0, 99, "1"],
  }[key];
  if (!details) return false;
  const [label, current, min, max, step] = details;
  const value = await requestGmNumber(label, current, { min, max, step });
  if (value === null || !Number.isFinite(value)) return true;
  if (key === "derivedSpeed") {
    const derived = derivedValues();
    const loadMultiplier = derived.weaponOverloaded ? 0.7 : 1;
    const baseWithoutGm = derived.speedBeforeLoad - (Number(character.gmAdjustments.speed) || 0);
    setGmAdjustmentTarget("speed", value / loadMultiplier, baseWithoutGm);
  }
  if (key === "derivedCommand") setGmAdjustmentTarget("command", value, derivedValues().command - (Number(character.gmAdjustments.command) || 0));
  if (key === "maximumHp") setGmAdjustmentTarget("maximumHp", value, maximumHp() - (Number(character.gmAdjustments.maximumHp) || 0));
  if (key === "damageReduction") setGmAdjustmentTarget("damageReduction", value, damageReductionDetails().value - (Number(character.gmAdjustments.damageReduction) || 0));
  if (key === "moveSpeedValue") setGmAdjustmentTarget("moveSpeed", value, calculatedMoveSpeed() - (Number(character.gmAdjustments.moveSpeed) || 0));
  if (key === "permanentHpBonus") character.health.permanentBonus = Math.round(value);
  if (key === "currentHp") character.health.current = Math.round(value);
  if (key === "creditsValue") character.resources.creditsBase = Math.round(value);
  if (key === "reverenceCurrent") character.resources.reverence = Math.round(value);
  if (key === "xpAvailable") character.experience.available = Math.round(value);
  if (key === "xpTotal") character.experience.totalGained = Math.max(character.experience.available, Math.round(value));
  if (key === "exertionCurrent") character.resources.exertionCurrent = Math.round(value);
  if (key === "exertionMax") {
    const base = 1 + character.attributes.willpower.filter((dieIndex) => dieIndex >= 3).length;
    setGmAdjustmentTarget("exertionMax", Math.round(value), base);
  }
  character.experience.spent = Math.max(0, character.experience.totalGained - character.experience.available);
  syncDerivedResources();
  campaignDirty = true;
  renderAll();
  return true;
}

function weaponOptions(selectedId) {
  return [
    `<option value="">Choose a weapon</option>`,
    ...WEAPONS.map((weapon) => `<option value="${escapeAttribute(weapon.id)}" ${weapon.id === selectedId ? "selected" : ""}>${escapeHtml(weapon.name)} - ${weaponCreditCost(weapon).toLocaleString()} Credits</option>`),
  ].join("");
}

const WEAPON_SLOT_COUNTS = Object.freeze({ A: 1, B: 2, C: 4, D: 8 });
const WEAPON_SLOT_ORDER = Object.freeze(["A", "B", "C", "D"]);

function weaponSlotAllocation(characterObject = character) {
  const slots = WEAPON_SLOT_ORDER.flatMap((sizeClass) => Array.from({ length: WEAPON_SLOT_COUNTS[sizeClass] }, (_, index) => ({
    id: `${sizeClass}${index + 1}`,
    sizeClass,
    weapon: null,
  })));
  const weapons = (characterObject.weapons || []).flatMap((entry) => {
    const weapon = weaponById(entry?.weaponId);
    return weapon && WEAPON_SLOT_ORDER.includes(weapon.sizeClass) ? [{ entry, weapon }] : [];
  }).sort((left, right) => WEAPON_SLOT_ORDER.indexOf(left.weapon.sizeClass) - WEAPON_SLOT_ORDER.indexOf(right.weapon.sizeClass));
  const overflow = [];
  for (const carried of weapons) {
    const weaponRank = WEAPON_SLOT_ORDER.indexOf(carried.weapon.sizeClass);
    let assigned = null;
    for (let slotRank = weaponRank; slotRank >= 0 && !assigned; slotRank -= 1) {
      assigned = slots.find((slot) => !slot.weapon && slot.sizeClass === WEAPON_SLOT_ORDER[slotRank]) || null;
    }
    if (assigned) assigned.weapon = carried;
    else overflow.push(carried);
  }
  return { slots, overflow, overloaded: overflow.length > 0, weaponCount: weapons.length };
}

function weaponInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function renderWeaponSlots() {
  if (!dom.weaponSlotPyramid) return;
  const allocation = weaponSlotAllocation();
  dom.weaponSlotPyramid.innerHTML = WEAPON_SLOT_ORDER.map((sizeClass) => {
    const slots = allocation.slots.filter((slot) => slot.sizeClass === sizeClass);
    return `<div class="weapon-slot-row weapon-slot-row-${sizeClass.toLowerCase()}"><span class="weapon-slot-class">${sizeClass}</span><div class="weapon-slot-cells">${slots.map((slot) => {
      const weapon = slot.weapon?.weapon;
      const substituted = weapon && weapon.sizeClass !== slot.sizeClass;
      const label = weapon ? `${slot.id}: ${weapon.name}, Class ${weapon.sizeClass}${substituted ? ` stored in larger Class ${slot.sizeClass} slot` : ""}` : `${slot.id}: Empty Class ${slot.sizeClass} slot`;
      return `<div class="weapon-slot ${weapon ? "occupied" : "empty"} ${substituted ? "substituted" : ""}" data-slot-class="${slot.sizeClass}" title="${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}"><small>${slot.id}</small><strong>${weapon ? escapeHtml(weaponInitials(weapon.name)) : ""}</strong>${weapon ? `<span>${escapeHtml(weapon.sizeClass)}</span>` : ""}</div>`;
    }).join("")}</div></div>`;
  }).join("");
  const assigned = allocation.slots.filter((slot) => slot.weapon);
  dom.weaponSlotAssignments.innerHTML = [
    ...assigned.map((slot) => `<span class="weapon-slot-assignment"><b>${slot.id}</b>${escapeHtml(slot.weapon.weapon.name)}</span>`),
    ...allocation.overflow.map(({ weapon }) => `<span class="weapon-slot-assignment illegal"><b>ILLEGAL</b>${escapeHtml(weapon.name)} (${escapeHtml(weapon.sizeClass)})</span>`),
  ].join("");
  dom.weaponSlotStatus.textContent = allocation.overloaded
    ? "OVERLOADED - ATB SPEED REDUCED 30%"
    : `${assigned.length} / ${allocation.slots.length} SLOTS OCCUPIED`;
  dom.weaponSlotStatus.classList.toggle("overloaded", allocation.overloaded);
  dom.weaponSlotWarning.classList.toggle("overloaded", allocation.overloaded);
  dom.weaponSlotWarning.textContent = allocation.overloaded
    ? `${allocation.overflow.length} weapon${allocation.overflow.length === 1 ? " has" : "s have"} no legal slot. The character's final ATB Speed is multiplied by 0.70.`
    : "Larger slots may hold smaller weapons. Ordinary Gear and Class F items do not use Weapon Slots.";
}

function weaponStat(value) {
  const text = String(value || "").trim();
  return text && !["N/A", "None"].includes(text) ? text : text || "-";
}

function renderWeapons() {
  const onlyRow = character.weapons.length <= 1;
  const editable = ["draft", "finalized"].includes(character.phase) && (!campaignCode || campaignEditable);
  dom.weaponInventory.innerHTML = character.weapons.map((entry) => {
    const weapon = weaponById(entry.weaponId);
    const emptyClass = weapon ? "" : " weapon-empty-stat";
    const chargeTime = weapon?.chargeMode === "movement" ? "Movement" : weapon?.chargeTime || "-";
    return `<div class="weapon-table-row" role="row" data-weapon-row="${escapeAttribute(entry.id)}">
      <select data-weapon-select="${escapeAttribute(entry.id)}" aria-label="Choose weapon" ${editable ? "" : "disabled"}>${weaponOptions(entry.weaponId)}</select>
      <button type="button" class="weapon-held-button ${entry.held ? "active" : ""}" data-hold-weapon="${escapeAttribute(entry.id)}" ${weapon && editable ? "" : "disabled"} aria-pressed="${entry.held ? "true" : "false"}"><span>${entry.held ? "Held" : "Hold"}</span></button>
      <span class="weapon-stat${emptyClass}" data-label="To-Hit">${escapeHtml(weaponStat(weapon?.toHit))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Damage">${escapeHtml(weaponStat(weapon?.damage))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Charge Bonus">${escapeHtml(weaponStat(weapon?.chargeBonus))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Max Charge">${escapeHtml(weaponStat(weapon?.maxCharge))}</span>
      <span class="weapon-stat charge-time${emptyClass}" data-label="Charge Time">${escapeHtml(String(chargeTime))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Element">${escapeHtml(weaponStat(weapon?.element))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Range">${escapeHtml(weaponStat(weapon?.range))}</span>
      <span class="weapon-stat${emptyClass}" data-label="Size">${escapeHtml(weaponStat(weapon?.sizeClass))}</span>
      <span class="weapon-stat special${emptyClass}" data-label="Special">${escapeHtml(weaponStat(weapon?.special))}</span>
      <button type="button" class="weapon-row-remove" data-remove-weapon="${escapeAttribute(entry.id)}" ${onlyRow || !editable ? "disabled" : ""} aria-label="Remove weapon">-</button>
    </div>`;
  }).join("");
  renderWeaponSlots();
}

function weaponCreditCost(weapon) {
  const value = Number(String(weapon?.cost || "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function requestWeaponMode(weapon) {
  if (GM_ADJUSTMENT_MODE || (manualInputMode() && character.phase === "draft")) return Promise.resolve("receive");
  const canReceive = mayReceiveGearForFree();
  return new Promise((resolve) => {
    const shell = document.createElement("div");
    shell.className = "modal-shell weapon-acquire-modal";
    const cost = weaponCreditCost(weapon);
    shell.innerHTML = `<section class="confirm-dialog" role="dialog" aria-modal="true">
      <span class="dialog-kicker">Add Weapon</span>
      <h2>${escapeHtml(weapon.name)}</h2>
      <p>${canReceive ? `Was this weapon purchased for ${cost.toLocaleString()} Credits, or received with GM oversight?` : `This unlinked character must purchase the weapon for ${cost.toLocaleString()} Credits.`}</p>
      <div class="weapon-acquire-actions"><button type="button" data-weapon-mode="cancel">Cancel</button>${canReceive ? '<button type="button" class="receive" data-weapon-mode="receive">Receive</button>' : ""}<button type="button" class="purchase" data-weapon-mode="purchase">Purchase</button></div>
    </section>`;
    document.body.append(shell);
    const close = (value) => { shell.remove(); resolve(value); };
    shell.addEventListener("click", (event) => {
      const button = event.target.closest("[data-weapon-mode]");
      if (button) close(button.dataset.weaponMode === "cancel" ? null : button.dataset.weaponMode);
    });
    shell.addEventListener("keydown", (event) => { if (event.key === "Escape") close(null); });
    shell.querySelector('[data-weapon-mode="purchase"]')?.focus({ preventScroll: true });
  });
}

async function acquireWeapon(entry, weapon, mode, previousWeaponId) {
  mode = GM_ADJUSTMENT_MODE || (manualInputMode() && character.phase === "draft") ? "receive" : mode;
  if (mode === "receive" && !mayReceiveGearForFree()) {
    notice("Link this character to a campaign before receiving weapons for free.", "error");
    return false;
  }
  const cost = mode === "purchase" ? weaponCreditCost(weapon) : 0;
  if (cost > Number(character.resources.creditsBase || 0)) {
    const accepted = await askConfirmation({
      title: "Not Enough Credits",
      message: `This weapon costs ${cost} Credits, but the character has ${character.resources.creditsBase}. Continue with a negative balance?`,
      acceptLabel: "Continue", cancelLabel: "Cancel", danger: true,
    });
    if (!accepted) return false;
  }
  if (campaignCode && campaignCharacterId && campaignEditable) {
    const payload = await campaignRequest("/api/campaign/item/transaction", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, mode, inventoryType: "weapon", item: { id: entry.id, weaponId: weapon.id, previousWeaponId, name: weapon.name, unitCost: weaponCreditCost(weapon) } }),
    });
    const remote = payload.campaign?.characters?.find((record) => record.id === campaignCharacterId)?.character;
    if (remote) {
      character.resources.creditsBase = Number(remote.resources?.creditsBase) || 0;
      character.weapons = deepCopy(remote.weapons || character.weapons);
      campaignBaselineCredits = character.resources.creditsBase;
      campaignDirty = false;
    }
    if (payload.campaign) receiveCampaignState(payload.campaign);
    renderResources();
    renderWeapons();
  } else {
    entry.weaponId = weapon.id;
    entry.held = false;
    if (mode === "purchase") character.resources.creditsBase -= cost;
    queueSave();
  }
  return true;
}
function itemChargeLabel(entry) {
  if (entry.chargesMax !== null && entry.chargesMax !== undefined) return `${formatNumber(entry.charges)}/${formatNumber(entry.chargesMax)} charges`;
  if (entry.chargeState) return entry.chargeState;
  return "";
}

function matchingGearCatalog(query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return [...GEAR].sort((a, b) => a.name.localeCompare(b.name));
  return GEAR.map((entry) => {
    const name = entry.name.toLowerCase();
    const words = name.split(/\s+/);
    const rank = name === text ? 0 : name.startsWith(text) ? 1 : words.some((word) => word.startsWith(text)) ? 2 : name.includes(text) ? 3 : 99;
    return { entry, rank };
  }).filter((result) => result.rank < 99).sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name)).map((result) => result.entry);
}

function blankGearDraft() {
  return { id: uid(), catalogId: "", name: "", description: "", quantity: 1, unitCost: 0, charges: null, chargesMax: null, chargeState: "", special: "" };
}

function gearDraftFromCatalog(catalog) {
  return {
    ...catalog,
    id: uid(),
    catalogId: catalog.id,
    quantity: 1,
    unitCost: catalog.cost,
    chargesMax: catalog.chargesMax ?? null,
    charges: catalog.chargesMax ?? null,
    chargeState: catalog.chargeStateMax || "",
  };
}

function updateGearPickerActions() {
  const valid = Boolean(gearDraft?.name.trim());
  const manualReceive = GM_ADJUSTMENT_MODE || (manualInputMode() && character.phase === "draft");
  const canReceive = mayReceiveGearForFree();
  dom.gearPickerPurchase.hidden = manualReceive;
  dom.gearPickerReceive.hidden = !canReceive;
  dom.gearPickerReceive.textContent = manualReceive ? "Add Received Item" : "Receive";
  dom.gearPickerPurchase.disabled = !valid;
  dom.gearPickerReceive.disabled = !valid;
  dom.gearPickerError.textContent = valid ? "" : "Choose an item or enter a custom name.";
}

function renderGearPickerFields() {
  if (!gearDraft) return;
  dom.gearPickerName.value = gearDraft.name || "";
  dom.gearPickerDescription.value = gearDraft.description || "";
  dom.gearPickerCost.value = Math.max(0, Number(gearDraft.unitCost) || 0);
  updateGearPickerActions();
}

function populateGearCatalogPicker(query = "", selectedId = "") {
  const matches = matchingGearCatalog(query);
  dom.gearCatalogPicker.innerHTML = [
    `<option value="">Choose from ${matches.length} matching item${matches.length === 1 ? "" : "s"}</option>`,
    ...matches.map((entry) => `<option value="${escapeAttribute(entry.id)}">${escapeHtml(entry.name)} - ${Number(entry.cost || 0).toLocaleString()} Credits</option>`),
    '<option value="__custom__">Custom Item</option>',
  ].join("");
  dom.gearCatalogPicker.value = matches.some((entry) => entry.id === selectedId) ? selectedId : "";
  dom.gearCatalogStatus.textContent = matches.length
    ? `${matches.length} catalog item${matches.length === 1 ? "" : "s"} match. Select one below or choose Custom Item.`
    : "No catalog items match. Choose Custom Item to enter your own.";
}

function applyGearPickerChoice(catalogId) {
  if (catalogId === "__custom__") {
    gearDraft = blankGearDraft();
    renderGearPickerFields();
    dom.gearPickerName.focus({ preventScroll: true });
    return;
  }
  const catalog = GEAR.find((entry) => entry.id === catalogId);
  if (!catalog) return;
  gearDraft = gearDraftFromCatalog(catalog);
  renderGearPickerFields();
}

function openGearPicker() {
  gearDraft = blankGearDraft();
  dom.gearCatalogSearch.value = "";
  dom.gearPickerError.textContent = "";
  populateGearCatalogPicker();
  renderGearPickerFields();
  dom.gearPickerModal.hidden = false;
  setTimeout(() => dom.gearCatalogSearch.focus({ preventScroll: true }), 60);
}

function closeGearPicker() {
  dom.gearPickerModal.hidden = true;
  gearDraft = null;
}
function renderGear() {
  if (!dom.gearInventory) return;
  const editable = ["draft", "finalized"].includes(character.phase) && (!campaignCode || campaignEditable);
  document.querySelector(".gear-panel")?.classList.toggle("locked", !editable);
  dom.addGearRow.disabled = !editable;
  dom.storeGearButton.disabled = !editable || !character.items.length;
  const manualReceive = GM_ADJUSTMENT_MODE || (manualInputMode() && character.phase === "draft");
  const canReceive = mayReceiveGearForFree();
  const rows = character.items.map((entry) => {
    const pending = pendingGearAdds.has(entry.id);
    const charge = itemChargeLabel(entry);
    return `<div class="gear-row" data-gear-row="${escapeAttribute(entry.id)}">
      <input class="gear-name" data-gear-field="name" autocomplete="off" value="${escapeAttribute(entry.name)}" aria-label="Item name" ${editable ? "" : "disabled"} />
      <textarea class="gear-description" data-gear-field="description" aria-label="Item description" ${editable ? "" : "disabled"}>${escapeHtml(entry.description)}</textarea>
      <div class="gear-quantity"><button type="button" data-gear-minus="${escapeAttribute(entry.id)}" ${editable ? "" : "disabled"}>-1</button><strong>${entry.quantity}</strong><button type="button" data-gear-plus="${escapeAttribute(entry.id)}" ${editable ? "" : "disabled"}>+1</button></div>
      <label class="gear-cost"><input data-gear-field="unitCost" type="number" min="0" step="1" value="${entry.unitCost * entry.quantity}" aria-label="Total item cost" />${charge ? `<small class="gear-charge">${escapeHtml(charge)}</small>` : ""}</label>
      <div class="gear-actions">${pending
        ? `${manualReceive ? "" : `<button class="purchase" type="button" data-gear-add-mode="purchase" data-gear-id="${escapeAttribute(entry.id)}">Purchase +1</button>`}${canReceive ? `<button class="receive" type="button" data-gear-add-mode="receive" data-gear-id="${escapeAttribute(entry.id)}">Receive +1</button>` : ""}<button type="button" data-gear-cancel-add="${escapeAttribute(entry.id)}">Cancel</button>`
        : `<button class="store" type="button" data-store-gear="${escapeAttribute(entry.id)}" ${editable ? "" : "disabled"}>Store 1</button>`}</div>
    </div>`;
  });
  dom.gearInventory.innerHTML = rows.join("");
  dom.gearInventoryEmpty.hidden = Boolean(rows.length);
  const canGive = Boolean(campaignCode && campaignCharacterId && campaignEditable && campaignState?.characters?.some((record) => record.id !== campaignCharacterId));
  dom.storedGearInventory.innerHTML = character.storedItems.map((entry) => `<div class="stored-gear-row" data-stored-gear="${escapeAttribute(entry.id)}">
    <strong>${escapeHtml(entry.name)}</strong><p>${escapeHtml(entry.description)}</p><span class="storage-qty">x${entry.quantity}</span>
    <div class="storage-actions"><button type="button" data-return-gear="${escapeAttribute(entry.id)}" ${editable ? "" : "disabled"}>Return 1</button>${canGive ? `<button type="button" class="give" data-give-gear="${escapeAttribute(entry.id)}">Give 1</button>` : ""}</div>
  </div>`).join("");
  dom.storedGearEmpty.hidden = Boolean(character.storedItems.length);
  renderAmbientEasterEggs();
}

function gearPayload(entry) {
  return {
    id: entry.id, catalogId: entry.catalogId || "", name: entry.name, description: entry.description,
    quantity: entry.quantity || 1, unitCost: Number(entry.unitCost) || 0,
    charges: entry.charges, chargesMax: entry.chargesMax, chargeState: entry.chargeState || "", special: entry.special || "",
  };
}

function mergeItemInto(list, item, quantity = 1) {
  const matching = list.find((entry) => entry.catalogId === item.catalogId
    && entry.name === item.name && entry.description === item.description && entry.unitCost === item.unitCost
    && entry.charges === item.charges && entry.chargesMax === item.chargesMax && entry.chargeState === item.chargeState);
  if (matching) matching.quantity += quantity;
  else list.push({ ...gearPayload(item), id: uid(), quantity });
}

function requestStorageRecipient(item) {
  const recipients = (campaignState?.characters || []).filter((record) => record.id !== campaignCharacterId);
  if (!recipients.length) {
    notice("No other approved campaign characters are available.", "error");
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    const shell = document.createElement("div");
    shell.className = "modal-shell storage-give-modal";
    shell.innerHTML = `<section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="storageGiveTitle">
      <span class="dialog-kicker">Items in Storage</span>
      <h2 id="storageGiveTitle">Give 1 ${escapeHtml(item.name)}</h2>
      <p>The item will be placed directly into the other character's storage. Credits are not changed.</p>
      <label>Give To<select data-storage-recipient>${recipients.map((record) => `<option value="${escapeAttribute(record.id)}">${escapeHtml(campaignCharacterName(record))}${record.connected ? " - Online" : " - Offline"}</option>`).join("")}</select></label>
      <div class="dialog-actions storage-give-actions"><button type="button" data-storage-give-cancel>Cancel</button><button type="button" class="give" data-storage-give-confirm>Give Item</button></div>
    </section>`;
    document.body.append(shell);
    const finish = (value) => { shell.remove(); resolve(value); };
    shell.querySelector("[data-storage-give-cancel]")?.addEventListener("click", () => finish(""));
    shell.querySelector("[data-storage-give-confirm]")?.addEventListener("click", () => finish(shell.querySelector("[data-storage-recipient]")?.value || ""));
    shell.addEventListener("keydown", (event) => { if (event.key === "Escape") finish(""); });
    shell.querySelector("[data-storage-recipient]")?.focus({ preventScroll: true });
  });
}

async function addGearItem(item, mode) {
  mode = GM_ADJUSTMENT_MODE || (manualInputMode() && character.phase === "draft") ? "receive" : mode;
  if (mode === "receive" && !mayReceiveGearForFree()) {
    notice("Link this character to a campaign before receiving items for free.", "error");
    return false;
  }
  const cost = mode === "purchase" ? Math.max(0, Number(item.unitCost) || 0) : 0;
  if (!item.name.trim()) { notice("Enter an item name first.", "error"); return false; }
  if (mode === "purchase" && cost > 0 && cost > Number(character.resources.creditsBase || 0)) {
    const accepted = await askConfirmation({
      title: "Not Enough Credits",
      message: `This purchase costs ${cost} Credits, but the character has ${character.resources.creditsBase}. Continue with a negative balance?`,
      acceptLabel: "Continue", cancelLabel: "Cancel", danger: true,
    });
    if (!accepted) return false;
  }
  if (campaignCode && campaignCharacterId && campaignEditable) {
    const payload = await campaignRequest("/api/campaign/item/transaction", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, mode, item: gearPayload(item) }),
    });
    const remote = payload.campaign?.characters?.find((record) => record.id === campaignCharacterId)?.character;
    if (remote) {
      character.resources.creditsBase = Number(remote.resources?.creditsBase) || 0;
      character.items = deepCopy(remote.items || character.items);
      campaignBaselineCredits = character.resources.creditsBase;
      campaignDirty = false;
    }
    if (payload.campaign) receiveCampaignState(payload.campaign);
    renderResources();
    renderGear();
  } else {
    mergeItemInto(character.items, item, 1);
    if (mode === "purchase") character.resources.creditsBase -= cost;
    queueSave();
  }
  return true;
}

async function removeCarriedItem(entry, { reason = "removed" } = {}) {
  if (!entry) return;
  if (entry.catalogId === "intoxicating-liquid") {
    const drinking = await askConfirmation({
      title: "Are You Drinking This Item?",
      message: "Drinking applies +2 to Charisma and Willpower rolls and -3 to Dexterity and Intellect rolls until the GM ends the session.",
      acceptLabel: "Drink It", cancelLabel: "Remove Without Drinking",
    });
    if (drinking) character.statuses.intoxicated = true;
  }
  entry.quantity -= 1;
  if (entry.quantity <= 0) character.items = character.items.filter((item) => item.id !== entry.id);
  queueSave();
  await saveCampaignCharacter({ force: true });
  if (campaignCode && campaignEditable) {
    campaignRequest("/api/campaign/item/activity", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, message: `${character.identity.characterName || "Character"} ${reason} 1 ${entry.name}.` }),
    }).catch(() => {});
  }
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
  if (profile.raceId === "bruggle" && ["strength", "dexterity"].includes(profile.attributeKey)) return { count: 2, label: "Bruggle: Reroll Two Lowest Dice" };
  if (profile.raceId === "antropic" && character.identity.raceType === "fluffy" && ["charisma", "dexterity"].includes(profile.attributeKey)) return { count: 2, label: "Fluffy Antropic: Reroll Two Lowest Dice" };
  if (profile.raceId === "epoc" && ["luck", "charisma", "willpower", "intellect"].includes(profile.attributeKey)) return { count: 2, label: "Epoc: Reroll Two Lowest Dice" };
  if (profile.raceId === "pattanilia" && ["perception", "intellect", "willpower"].includes(profile.attributeKey)) return { count: 2, label: "Pattanilia: Reroll Two Lowest Dice" };
  if (profile.raceId === "slyn-tanni" && ["dexterity", "charisma"].includes(profile.attributeKey)) return { count: 1, label: "Slyn Tanni: Reroll Lowest Die" };
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
  renderGear();
  renderAmbientEasterEggs();
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

function renderWithoutViewportJump() {
  const left = window.scrollX;
  const top = window.scrollY;
  document.activeElement?.blur?.();
  renderAll();
  const restore = () => window.scrollTo({ left, top, behavior: "auto" });
  requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); });
  setTimeout(restore, 80);
}

function lastRefundableAttributePurchase(attributeKey, row, column) {
  const transaction = advancementAttributePurchases.at(-1);
  if (!transaction) return null;
  return transaction.changes.some((change) => change.attributeKey === attributeKey && change.row === row && change.after === column)
    ? transaction
    : null;
}

async function applyAmbassadorFreeAttribute(paidCost, transaction) {
  if (character.identity.classId !== "ambassador-spy") return true;
  const options = ["charisma", "luck"].flatMap((attributeKey) => character.attributes[attributeKey].flatMap((current, row) => {
    const column = current + 1;
    if (column > 4 || attributeStepCost(attributeKey, row, column) > paidCost) return [];
    const label = ATTRIBUTE_DEFS.find((entry) => entry.key === attributeKey)?.label || attributeKey;
    return [{ value: `${attributeKey}:${row}`, label: `${label} row ${row + 1}: ${current < 0 ? "None" : DICE_NAMES[current]} to ${DICE_NAMES[column]}` }];
  }));
  if (!options.length) {
    notice("Ambassador / Spy: no equal-or-lower Charisma or Luck die upgrade is currently available.", "success");
    return true;
  }
  const values = await requestRuleChoices({
    title: "Ambassador / Spy Free Die",
    message: "Your paid Charisma or Luck die grants one free equal-or-lower die in Charisma or Luck.",
    options,
  });
  if (!values?.[0]) return false;
  const [attributeKey, rowText] = values[0].split(":");
  const row = Number(rowText);
  const before = character.attributes[attributeKey][row];
  character.attributes[attributeKey][row] = before + 1;
  transaction.changes.push({ attributeKey, row, before, after: before + 1, free: true });
  playPurchaseSound(attributeKey);
  notice(`Ambassador / Spy granted a free ${DICE_NAMES[before + 1]} die.`, "success");
  return true;
}

async function purchaseAttribute(attributeKey, row, column) {
  if (!canPurchaseAttributes() || character.pendingRoll) return;
  const current = character.attributes[attributeKey][row];
  const definition = ATTRIBUTE_DEFS.find((entry) => entry.key === attributeKey);
  if (!definition) return;
  const previousMaxHp = maximumHp();

  if (character.phase === "draft" && manualInputMode()) {
    if (column === current + 1) {
      character.attributes[attributeKey][row] = column;
      playPurchaseSound(attributeKey);
    } else if (column === current) {
      character.attributes[attributeKey][row] = current - 1;
    } else {
      return;
    }
    notice(`${definition.label} row set to ${character.attributes[attributeKey][row] >= 0 ? DICE_NAMES[character.attributes[attributeKey][row]] : "empty"}.`, "success");
  } else if (character.phase === "draft") {
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
  } else if (character.phase === "finalized" && character.advancementOpen && column === current) {
    const transaction = lastRefundableAttributePurchase(attributeKey, row, column);
    if (!transaction) return;
    [...transaction.changes].reverse().forEach((change) => {
      character.attributes[change.attributeKey][change.row] = change.before;
    });
    if (transaction.currency === "attributePoints") character.resources.attributePoints += transaction.cost;
    else if (transaction.currency === "mechanical") {
      character.resources.mechanicalExperience += transaction.cost;
      character.experience.spent = Math.max(0, character.experience.spent - transaction.cost);
    } else {
      character.experience.available += transaction.cost;
      character.experience.spent = Math.max(0, character.experience.spent - transaction.cost);
    }
    advancementAttributePurchases.pop();
    notice(`${transaction.cost} ${transaction.currency === "attributePoints" ? "Attribute Points" : "XP"} refunded.`, "success");
  } else if (character.phase === "finalized" && character.advancementOpen && column === current + 1) {
    if (character.identity.raceId === "tamalori" && attributeKey === "strength" && column === 4) {
      notice("TaMalori cannot purchase D12 Strength dice.", "error");
      return;
    }
    const cost = attributeStepCost(attributeKey, row, column);
    const mechanical = mechanicalSpiddixAttribute(attributeKey);
    const awardedPoints = Math.max(0, Math.round(Number(character.resources.attributePoints) || 0));
    const usingAwardedPoints = awardedPoints >= cost;
    if (usingAwardedPoints) character.resources.attributePoints = awardedPoints - cost;
    else if (!(mechanical ? spendMechanicalXp(cost, `${definition.label} ${DICE_NAMES[column]}`) : spendXp(cost, `${definition.label} ${DICE_NAMES[column]}`))) return;
    character.attributes[attributeKey][row] = column;
    const transaction = {
      cost,
      currency: usingAwardedPoints ? "attributePoints" : mechanical ? "mechanical" : "xp",
      changes: [{ attributeKey, row, before: current, after: column, free: false }],
    };
    advancementAttributePurchases.push(transaction);
    playPurchaseSound(attributeKey);
    notice(`${definition.label} upgraded to ${DICE_NAMES[column]} for ${cost} ${usingAwardedPoints ? "Attribute Points" : mechanical ? "mechanical XP" : "XP"}.`, "success");
    if (["charisma", "luck"].includes(attributeKey)) {
      const freeDieApplied = await applyAmbassadorFreeAttribute(cost, transaction);
      if (!freeDieApplied) {
        character.attributes[attributeKey][row] = current;
        advancementAttributePurchases.pop();
        if (usingAwardedPoints) character.resources.attributePoints += cost;
        else if (mechanical) {
          character.resources.mechanicalExperience += cost;
          character.experience.spent = Math.max(0, character.experience.spent - cost);
        } else {
          character.experience.available += cost;
          character.experience.spent = Math.max(0, character.experience.spent - cost);
        }
        notice("Attribute purchase canceled because the Ambassador / Spy free die was not selected.", "error");
      }
    }
  } else {
    return;
  }
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderWithoutViewportJump();
}

function gmAdjustAttribute(attributeKey, row, column) {
  if (!GM_ADJUSTMENT_MODE) return false;
  const current = character.attributes[attributeKey]?.[row];
  if (!Number.isFinite(current)) return true;
  character.attributes[attributeKey][row] = column === current ? current - 1 : column;
  syncDerivedResources();
  campaignDirty = true;
  renderAll();
  return true;
}

function gmAdjustSkill(key, direction) {
  if (!GM_ADJUSTMENT_MODE) return false;
  const resolved = resolveSkill(character, key);
  if (!resolved) return true;
  resolved.skill.tenths = Math.max(0, Math.round((Number(resolved.skill.tenths) || 0) + direction));
  resolved.skill.creationDecimal = resolved.skill.tenths % 10;
  campaignDirty = true;
  renderAll();
  return true;
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
  renderWithoutViewportJump();
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
    const next = blankCharacter();
    library.push(next);
    activeId = next.id;
    character = next;
    dom.skillSearch.value = "";
    saveLibrary("New character saved locally");
  });
  renderCharacterNavigation();
  notice("Fresh Character Draft created. The previous character remains saved.", "success");
  showDraftIntroduction();
}

const WORKFLOW_TUTORIALS = {
  race: ["Choose Your Race", "First pick your Race. It determines important advantages, disadvantages, and some character-creation rules."],
  class: ["Choose Your Class", "Now pick your Class. It establishes your primary party role and what your character is naturally good at."],
  attributes: ["Build Your Attributes", "Spend all 195 Attribute Points on dice. More dice improve consistency; larger dice raise the maximum result you can roll."],
  skills: ["Choose Your Skills", "After Attributes are complete, spend every Skill Point. Skill ratings are added to the top two dice of an associated Attribute roll."],
  identity: ["Fill In Identity", "Complete the Identity section, including Home Planet. These details identify the player and give the finished character a place in the setting."],
  backstory: ["Write A Backstory", "Write a Character Background before using the optional FUBS prompt. A few useful sentences are enough to begin."],
  fubs: ["Roll On FUBS", "FUBS is an optional, one-time complication for the backstory you already wrote. Read the result and incorporate it into the character's history."],
  compatibility: ["Resolve The Conflict", "This Race and Class combination conflicts with a listed rule. Change one selection before finalizing."],
};

function showWorkflowTutorial(key, target = "") {
  const copy = WORKFLOW_TUTORIALS[key];
  if (!copy) return;
  const shell = document.createElement("div");
  shell.className = "modal-shell workflow-tutorial-modal";
  shell.innerHTML = `<section class="confirm-dialog" role="dialog" aria-modal="true"><span class="dialog-kicker">Character Creation</span><h2>${escapeHtml(copy[0])}</h2><p>${escapeHtml(copy[1])}</p><div class="dialog-actions"><button type="button" class="primary-action">Got It</button></div></section>`;
  document.body.append(shell);
  shell.querySelector("button").addEventListener("click", () => { shell.remove(); if (target) scrollToWorkflowTarget(target); });
}

function activateNextDraftTask() {
  const task = dom.nextRequirement.querySelector("[data-workflow-key]");
  if (!task) return;
  showWorkflowTutorial(task.dataset.workflowKey, task.dataset.workflowTarget || "");
}

function showDraftIntroduction() {
  if (character.phase !== "draft" || manualInputMode()) return;
  const shell = document.createElement("div");
  shell.className = "modal-shell draft-introduction-modal";
  shell.innerHTML = `<section class="confirm-dialog" role="dialog" aria-modal="true"><div class="draft-guide-demo"><span class="draft-guide-copy">Draft</span><span class="draft-guide-arrow" aria-hidden="true">&#8592;</span></div><h2>Click Draft</h2><p>Click this button to know what you need to do next! The Draft button stays at the top left at all times.</p><div class="dialog-actions"><button type="button" class="primary-action">OK</button></div></section>`;
  document.body.append(shell);
  dom.phaseBadge.classList.add("draft-guide-target");
  shell.querySelector("button").addEventListener("click", () => { shell.remove(); dom.phaseBadge.classList.remove("draft-guide-target"); dom.phaseBadge.focus({ preventScroll: true }); });
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
  const manual = manualInputMode();
  const fubsMissing = !manual && character.fubs.status !== "complete";
  const accepted = await askConfirmation(manual ? {
    title: "Finalize Manual Character?",
    message: "The copied values will be locked as this character's starting record. Creation budgets and Skill decimal rolls are bypassed.",
    acceptLabel: "Finalize Manual Character",
    cancelLabel: "Continue Editing",
  } : fubsMissing ? {
    title: "You have not rolled FUBS yet. Are you sure?",
    message: "FUBS is optional, but finalizing without it permanently marks this character as FUBS: (Not activated).",
    acceptLabel: "Yes, Finalize Without FUBS",
    cancelLabel: "Return to Character",
    previewHtml: '<div class="fubs-reminder-preview"><span>Character Background</span><button type="button">Roll on FUBS Chart</button></div>',
  } : {
    title: "Finalize this character?",
    message: "Any selected Race, Class, and Home Planet become permanent alongside Attribute allocation and starting Skill levels. Skill decimals will now be rolled in sheet order.",
    acceptLabel: "Begin Finalization",
    cancelLabel: "Continue Editing",
  });
  if (!accepted) {
    if (fubsMissing) {
      if (characterLayoutMode === "tabs") {
        showCharacterPanel("sheet");
        showSheetSection("identity");
      }
      void 0;
      dom.fubsButton.classList.remove("fubs-attention");
      requestAnimationFrame(() => dom.fubsButton.classList.add("fubs-attention"));
    }
    return;
  }
  if (!manual && !await collectFinalizationChoices()) return;
  const pcCode = await requestPcCode();
  if (!pcCode) return;
  character.access.pcCode = pcCode;
  saveLibrary();
  snapshotRecovery("Before Finalization");
  finalizationPresentationActive = true;
  if (fubsMissing) character.fubs.status = "not-activated";
  if (manual) {
    character.creation.classGrantsApplied = true;
    character.creation.raceGrantsApplied = true;
  }
  character.phase = "finalizing";
  character.advancementOpen = false;
  character.creation.finalizationQueue = manual ? [] : skillKeysForFinalization();
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
  await new Promise((resolve) => setTimeout(resolve, 720));
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
  character.importedDraft = false;
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
  const creationPointCost = skillCreationLevel(resolved.skill) + 1;
  const awardedSkillPoints = Math.max(0, Math.round(Number(character.resources.skillPoints) || 0));
  if (awardedSkillPoints >= creationPointCost) {
    character.resources.skillPoints = awardedSkillPoints - creationPointCost;
    resolved.skill.tenths = purchased + 10;
    playPurchaseSound();
    queueSave();
    renderWithoutViewportJump();
    notice(`${resolved.name} increased to ${ratingText(resolved.skill.tenths)} for ${creationPointCost} Skill Point${creationPointCost === 1 ? "" : "s"}.`, "success");
    return;
  }
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
  renderWithoutViewportJump();
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
  const anchor = creation ? skillRowFor(pending.skillKey) : null;
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
  void 0;
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
  void 0;
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

async function exportCurrentCharacter() {
  saveLibrary();
  const payload = { format: FORMAT_NAME, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), character };
  const json = JSON.stringify(payload, null, 2);
  const baseName = filenameForCharacter();
  const mobileDevice = Boolean(navigator.userAgentData?.mobile) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const sharedFile = mobileDevice && typeof File === "function"
    ? new File([json], `${baseName}.sa2character.json`, { type: "application/json" })
    : null;

  if (sharedFile && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [sharedFile] })) {
    try {
      await navigator.share({
        files: [sharedFile],
        title: `${character.identity.characterName || "Spaceship Architect"} Character`,
      });
      notice("Character export opened. Choose Save to Files or another destination.", "success");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${baseName}.sa2character`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
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

  const manualSkill = event.target.closest("[data-manual-skill-key]");
  if (manualSkill && manualInputMode() && character.phase === "draft") {
    const resolved = resolveSkill(character, manualSkill.dataset.manualSkillKey);
    if (!resolved) return;
    const rating = clamp(Number(manualSkill.value) || 0, 0, 99999);
    resolved.skill.tenths = Math.round(rating * 10);
    resolved.skill.creationDecimal = resolved.skill.tenths % 10;
    queueSave();
    renderExperience();
    renderDerived();
    return;
  }

  const gmSkill = event.target.closest("[data-gm-skill-key]");
  if (gmSkill && GM_ADJUSTMENT_MODE) {
    const resolved = resolveSkill(character, gmSkill.dataset.gmSkillKey);
    if (!resolved) return;
    const desiredTenths = Math.round(clamp(Number(gmSkill.value) || 0, 0, 99999) * 10);
    resolved.skill.tenths = Math.max(0, desiredTenths - skillBonusTenths(resolved.name));
    resolved.skill.creationDecimal = resolved.skill.tenths % 10;
    campaignDirty = true;
    renderDerived();
    return;
  }

  const manualResource = event.target.closest("[data-manual-resource]");
  if (manualResource && manualInputMode() && character.phase === "draft") {
    const path = manualResource.dataset.manualResource;
    let value = Math.round(Number(manualResource.value) || 0);
    if (path === "resources.reverence") value = clamp(value, 0, 10);
    if (["resources.exertionCurrent", "resources.dramaCards", "health.permanentBonus", "experience.available", "experience.totalGained"].includes(path)) value = Math.max(0, value);
    setPath(character, path, value);
    if (path.startsWith("experience.")) {
      character.experience.totalGained = Math.max(character.experience.available, character.experience.totalGained);
      character.experience.spent = Math.max(0, character.experience.totalGained - character.experience.available);
    }
    queueSave();
    renderExperience();
    renderResources();
    renderDerived();
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
  const gmDirectEdit = event.target.closest("[data-gm-direct-edit]");
  if (gmDirectEdit && GM_ADJUSTMENT_MODE) {
    event.preventDefault();
    void handleGmDirectEdit(gmDirectEdit);
    return;
  }
  const gmReverence = event.target.closest("[data-gm-reverence]");
  if (gmReverence && GM_ADJUSTMENT_MODE) {
    character.resources.reverence = Number(gmReverence.dataset.gmReverence);
    campaignDirty = true;
    renderResources();
    return;
  }
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
    if (gmAdjustAttribute(attributeButton.dataset.attribute, Number(attributeButton.dataset.row), Number(attributeButton.dataset.column))) return;
    purchaseAttribute(attributeButton.dataset.attribute, Number(attributeButton.dataset.row), Number(attributeButton.dataset.column));
    return;
  }

  const skillButton = event.target.closest("[data-skill-action]");
  if (skillButton) {
    event.preventDefault();
    skillButton.blur();
    const key = skillButton.dataset.skillKey;
    if (gmAdjustSkill(key, skillButton.dataset.skillAction === "decrease" ? -1 : 1)) return;
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
    if (custom.tenths > 0 && !manualInputMode()) {
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
  renderGear();
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
    renderGear();
    renderDerived();
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

document.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-weapon-select]");
  if (!select || !["draft", "finalized"].includes(character.phase) || (campaignCode && !campaignEditable)) return;
  const entry = character.weapons.find((weapon) => weapon.id === select.dataset.weaponSelect);
  if (!entry) return;
  const previousWeaponId = entry.weaponId || "";
  const weapon = weaponById(select.value);
  if (!weapon) {
    entry.weaponId = "";
    entry.held = false;
    queueSave();
    renderWeapons();
    renderDerived();
    notice("Weapon row cleared.", "success");
    return;
  }
  if (weapon.id === previousWeaponId) return;
  const mode = await requestWeaponMode(weapon);
  if (!mode) { renderWeapons(); return; }
  try {
    if (await acquireWeapon(entry, weapon, mode, previousWeaponId)) {
      renderAll();
      notice(`${weapon.name} ${mode === "purchase" ? "purchased" : "received"}.`, "success");
    } else renderWeapons();
  } catch (error) {
    renderWeapons();
    notice(error.message, "error");
  }
});

dom.racePicker.addEventListener("change", () => applyRaceSelection(dom.racePicker.value));
dom.raceCardPickerButton.addEventListener("click", openRaceGallery);
dom.closeRaceGallery.addEventListener("click", closeRaceGallery);
dom.raceGalleryModal.addEventListener("click", (event) => {
  if (event.target === dom.raceGalleryModal) closeRaceGallery();
});
dom.raceGalleryGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-race-card]");
  if (card) showRaceCardDetail(card.dataset.raceCard);
});
dom.raceGalleryFallback.addEventListener("change", () => {
  const value = dom.raceGalleryFallback.value;
  if (!value) return;
  if (RACE_CARD_PROFILES[value]) showRaceCardDetail(value);
  else {
    applyRaceSelection(value);
    closeRaceGallery();
  }
});
dom.backToRaceGallery.addEventListener("click", () => {
  activeRaceCardId = "";
  dom.raceCardDetail.hidden = true;
  dom.raceGalleryChooser.hidden = false;
  renderRaceGallery();
});
dom.previousRaceSubtype.addEventListener("click", () => changeRaceSubtype(-1));
dom.nextRaceSubtype.addEventListener("click", () => changeRaceSubtype(1));
dom.chooseRaceCard.addEventListener("click", () => {
  if (!activeRaceCardId) return;
  const subtype = raceById(activeRaceCardId)?.types?.[activeRaceSubtypeIndex]?.id || "";
  applyRaceSelection(activeRaceCardId, subtype);
  closeRaceGallery();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || dom.raceGalleryModal.hidden) return;
  if (!dom.raceCardDetail.hidden) {
    activeRaceCardId = "";
    dom.raceCardDetail.hidden = true;
    dom.raceGalleryChooser.hidden = false;
    renderRaceGallery();
    return;
  }
  closeRaceGallery();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || dom.classGalleryModal.hidden) return;
  if (!dom.classCardDetail.hidden) {
    activeClassCardId = "";
    dom.classCardDetail.hidden = true;
    dom.classGalleryChooser.hidden = false;
    renderClassGallery();
    return;
  }
  closeClassGallery();
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
  const previousMaxHp = maximumHp();
  const definition = selectedRace();
  character.identity.raceType = definition?.types?.some((type) => type.id === dom.raceTypePicker.value)
    ? dom.raceTypePicker.value
    : "";
  syncDerivedResources(previousMaxHp);
  queueSave();
  renderAll();
  if (character.identity.raceType) scrollToCreationModifiers();
});

dom.classPicker.addEventListener("change", () => applyClassSelection(dom.classPicker.value));
dom.classCardPickerButton.addEventListener("click", openClassGallery);
dom.closeClassGallery.addEventListener("click", closeClassGallery);
dom.classGalleryModal.addEventListener("click", (event) => {
  if (event.target === dom.classGalleryModal) closeClassGallery();
});
dom.classGalleryGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-class-card]");
  if (card) showClassCardDetail(card.dataset.classCard || "");
});
dom.backToClassGallery.addEventListener("click", () => {
  activeClassCardId = "";
  dom.classCardDetail.hidden = true;
  dom.classGalleryChooser.hidden = false;
  renderClassGallery();
});
dom.chooseClassCard.addEventListener("click", () => {
  applyClassSelection(activeClassCardId);
  closeClassGallery();
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
  if (kind === "current") {
    return;
  } else if (kind === "recovery") {
    const recovery = recoveries.find((entry) => entry.id === id);
    if (!recovery) return;
    const restored = normalizeCharacter(deepCopy(recovery.character));
    restored.id = uid();
    restored.identity.characterName = restored.identity.characterName || "Character";
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
    localStorage.setItem(ACTIVE_DRAFT_KEY, "none");
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
dom.nextRequirement.addEventListener("click", (event) => {
  const task = event.target.closest("[data-workflow-key]");
  if (!task) return;
  showWorkflowTutorial(task.dataset.workflowKey, task.dataset.workflowTarget || "");
});
dom.phaseBadge.addEventListener("click", activateNextDraftTask);
dom.phaseBadge.setAttribute("role", "button");
dom.phaseBadge.setAttribute("tabindex", "0");
dom.phaseBadge.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activateNextDraftTask();
});

dom.spendExperience.addEventListener("click", () => {
  if (character.phase !== "finalized" || character.pendingRoll) return;
  character.advancementOpen = !character.advancementOpen;
  if (!character.advancementOpen) advancementAttributePurchases = [];
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

dom.addGearRow?.addEventListener("click", () => {
  if (!["draft", "finalized"].includes(character.phase) || (campaignCode && !campaignEditable)) return;
  openGearPicker();
});

dom.gearCatalogSearch?.addEventListener("input", () => {
  populateGearCatalogPicker(dom.gearCatalogSearch.value, dom.gearCatalogPicker.value);
});

dom.gearCatalogPicker?.addEventListener("change", () => {
  applyGearPickerChoice(dom.gearCatalogPicker.value);
});

[dom.gearPickerName, dom.gearPickerDescription, dom.gearPickerCost].forEach((field) => {
  field?.addEventListener("input", () => {
    if (!gearDraft) return;
    gearDraft.name = dom.gearPickerName.value;
    gearDraft.description = dom.gearPickerDescription.value;
    gearDraft.unitCost = Math.max(0, Math.round(Number(dom.gearPickerCost.value) || 0));
    updateGearPickerActions();
  });
});

dom.gearPickerCancel?.addEventListener("click", closeGearPicker);

async function confirmGearPicker(mode) {
  mode = GM_ADJUSTMENT_MODE || (manualInputMode() && character.phase === "draft") ? "receive" : mode;
  if (!gearDraft?.name.trim()) {
    updateGearPickerActions();
    dom.gearPickerName.focus({ preventScroll: true });
    return;
  }
  dom.gearPickerPurchase.disabled = true;
  dom.gearPickerReceive.disabled = true;
  const item = { ...gearDraft };
  // A negative-balance confirmation must replace the picker, not sit underneath it.
  dom.gearPickerModal.hidden = true;
  try {
    if (await addGearItem(item, mode)) {
      const itemName = item.name;
      closeGearPicker();
      renderAll();
      notice(`${itemName} ${mode === "purchase" ? "purchased" : "received"}.`, "success");
    } else {
      dom.gearPickerModal.hidden = false;
    }
  } catch (error) {
    dom.gearPickerModal.hidden = false;
    dom.gearPickerError.textContent = error.message;
  } finally {
    if (!dom.gearPickerModal.hidden) updateGearPickerActions();
  }
}

dom.gearPickerReceive?.addEventListener("click", () => confirmGearPicker("receive"));
dom.gearPickerPurchase?.addEventListener("click", () => confirmGearPicker("purchase"));

dom.storeGearButton?.addEventListener("click", () => {
  if (!character.items.length) return;
  notice("Choose Store 1 beside the item you want to move into storage.", "success");
  dom.gearInventory.classList.add("storage-selecting");
  setTimeout(() => dom.gearInventory.classList.remove("storage-selecting"), 2600);
});

dom.gearInventory?.addEventListener("input", (event) => {
  const field = event.target.closest("[data-gear-field]");
  const row = field?.closest("[data-gear-row]");
  const entry = character.items.find((item) => item.id === row?.dataset.gearRow);
  if (!field || !entry) return;
  if (field.dataset.gearField === "unitCost") entry.unitCost = Math.max(0, Math.round((Number(field.value) || 0) / Math.max(1, entry.quantity)));
  else entry[field.dataset.gearField] = field.value;
  queueSave();
});


dom.gearInventory?.addEventListener("click", async (event) => {
  const plus = event.target.closest("[data-gear-plus]");
  if (plus) { pendingGearAdds.add(plus.dataset.gearPlus); renderGear(); return; }
  const cancelAdd = event.target.closest("[data-gear-cancel-add]");
  if (cancelAdd) { pendingGearAdds.delete(cancelAdd.dataset.gearCancelAdd); renderGear(); return; }
  const addMode = event.target.closest("[data-gear-add-mode]");
  if (addMode) {
    const entry = character.items.find((item) => item.id === addMode.dataset.gearId);
    if (!entry) return;
    addMode.disabled = true;
    try {
      if (await addGearItem({ ...entry, quantity: 1 }, addMode.dataset.gearAddMode)) {
        pendingGearAdds.delete(entry.id);
        renderAll();
      }
    } catch (error) { notice(error.message, "error"); addMode.disabled = false; }
    return;
  }
  const minus = event.target.closest("[data-gear-minus]");
  if (minus) {
    const entry = character.items.find((item) => item.id === minus.dataset.gearMinus);
    await removeCarriedItem(entry, { reason: "removed" });
    renderAll();
    return;
  }
  const store = event.target.closest("[data-store-gear]");
  if (store) {
    const entry = character.items.find((item) => item.id === store.dataset.storeGear);
    if (!entry) return;
    mergeItemInto(character.storedItems, entry, 1);
    entry.quantity -= 1;
    if (entry.quantity <= 0) character.items = character.items.filter((item) => item.id !== entry.id);
    queueSave();
    await saveCampaignCharacter({ force: true });
    renderAll();
    notice(`${entry.name} moved to storage.`, "success");
  }
});

dom.storedGearInventory?.addEventListener("click", async (event) => {
  const giveButton = event.target.closest("[data-give-gear]");
  if (giveButton) {
    const entry = character.storedItems.find((item) => item.id === giveButton.dataset.giveGear);
    if (!entry || !campaignCode || !campaignCharacterId || !campaignEditable) return;
    const targetCharacterId = await requestStorageRecipient(entry);
    if (!targetCharacterId) return;
    giveButton.disabled = true;
    try {
      const payload = await campaignRequest("/api/campaign/item/give", {
        method: "POST",
        body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, targetCharacterId, itemId: entry.id }),
      });
      if (payload.campaign) receiveCampaignState(payload.campaign);
      renderAll();
      notice(`1 ${entry.name} moved to the other character's storage.`, "success");
    } catch (error) {
      giveButton.disabled = false;
      notice(error.message, "error");
    }
    return;
  }
  const button = event.target.closest("[data-return-gear]");
  const entry = character.storedItems.find((item) => item.id === button?.dataset.returnGear);
  if (!button || !entry) return;
  mergeItemInto(character.items, entry, 1);
  entry.quantity -= 1;
  if (entry.quantity <= 0) character.storedItems = character.storedItems.filter((item) => item.id !== entry.id);
  queueSave();
  await saveCampaignCharacter({ force: true });
  renderAll();
  notice(`${entry.name} returned to carried supplies.`, "success");
});


dom.addWeaponRow.addEventListener("click", () => {
  if ((campaignCode && !campaignEditable) || character.weapons.length >= 24) return;
  character.weapons.push({ id: uid(), weaponId: "", held: false });
  queueSave();
  renderWeapons();
  renderGear();
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

dom.spendOneReverence.addEventListener("click", async () => {
  if (character.phase !== "finalized" || character.resources.reverence < 1 || (campaignCode && !campaignEditable)) return;
  character.resources.reverence -= 1;
  queueSave();
  renderResources();
  notice("1 Reverence spent.", "success");
  if (!campaignCode || !campaignCharacterId || !campaignEditable) return;
  try {
    await saveCampaignCharacter({ force: true });
    const payload = await campaignRequest("/api/campaign/reverence/spent", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, amount: 1 }),
    });
    receiveCampaignState(payload.campaign);
  } catch (error) {
    notice(`Reverence was spent, but the GM notification failed: ${error.message}`, "error");
  }
});

dom.spendOneExertion.addEventListener("click", async () => {
  if (character.phase !== "finalized" || character.resources.exertionCurrent < 1 || (campaignCode && !campaignEditable)) return;
  character.resources.exertionCurrent -= 1;
  queueSave();
  renderResources();
  notice("1 Exertion spent.", "success");
  if (!campaignCode || !campaignCharacterId || !campaignEditable) return;
  try {
    await saveCampaignCharacter({ force: true });
    const payload = await campaignRequest("/api/campaign/exertion/spent", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, amount: 1 }),
    });
    receiveCampaignState(payload.campaign);
  } catch (error) {
    notice(`Exertion was spent, but the GM notification failed: ${error.message}`, "error");
  }
});

function closeReverenceGift() {
  dom.reverenceGiftModal.hidden = true;
  dom.reverenceGiftError.textContent = "";
}

dom.giftReverence.addEventListener("click", () => {
  if (!campaignCode || !campaignEditable) return;
  const targets = (campaignState?.characters || []).filter((record) => record.id !== campaignCharacterId);
  dom.reverenceGiftTarget.innerHTML = targets.map((record) => `<option value="${escapeAttribute(record.id)}">${escapeHtml(record.character?.identity?.characterName || "Unnamed Character")}</option>`).join("");
  if (!targets.length) return;
  dom.reverenceGiftAmount.value = "1";
  dom.reverenceGiftError.textContent = "";
  dom.reverenceGiftModal.hidden = false;
});

dom.reverenceGiftCancel.addEventListener("click", closeReverenceGift);
dom.reverenceGiftSend.addEventListener("click", async () => {
  const amount = Math.max(1, Math.min(10, Math.round(Number(dom.reverenceGiftAmount.value) || 0)));
  const targetCharacterId = dom.reverenceGiftTarget.value;
  if (!targetCharacterId) {
    dom.reverenceGiftError.textContent = "Choose another campaign character.";
    return;
  }
  dom.reverenceGiftSend.disabled = true;
  try {
    const payload = await campaignRequest("/api/campaign/reverence-gift", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, action: "request", targetCharacterId, amount }),
    });
    if (payload.campaign) receiveCampaignState(payload.campaign);
    closeReverenceGift();
    notice(`Suggested a ${amount} Reverence reward for ${payload.targetName || "the selected character"}.`, "success");
  } catch (error) {
    dom.reverenceGiftError.textContent = error.message;
  } finally {
    dom.reverenceGiftSend.disabled = false;
  }
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
  const before = character.resources.exertionCurrent;
  character.resources.exertionCurrent = character.resources.exertionMax;
  queueSave();
  renderResources();
  notice("Eight-hour rest complete. Exertion restored.", "success");
  if (!campaignCode || !campaignCharacterId || !campaignEditable) return;
  try {
    await saveCampaignCharacter({ force: true });
    const payload = await campaignRequest("/api/campaign/exertion/rest", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, before, maximum: character.resources.exertionMax }),
    });
    receiveCampaignState(payload.campaign);
  } catch (error) {
    notice(`Rest completed, but the GM notification failed: ${error.message}`, "error");
  }
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

dom.skillEquipmentChoices?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-skill-equipment]");
  if (!button || !skillCheck || skillCheck.equipmentCommitted) return;
  const id = button.dataset.skillEquipment;
  if (skillCheck.selectedEquipment.has(id)) skillCheck.selectedEquipment.delete(id);
  else skillCheck.selectedEquipment.add(id);
  renderSkillEquipment();
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
  void 0;
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
dom.bannerVisibilityToggle?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-banner-mode]");
  if (!button) return;
  playerBannerMode = ["hidden", "show", "exit"].includes(button.dataset.bannerMode) ? button.dataset.bannerMode : "show";
  localStorage.setItem(PLAYER_BANNER_MODE_KEY, playerBannerMode);
  renderBannerVisibility();
  notice({ hidden: "Interface banner hidden on this device.", show: "Interface banner shown without navigation.", exit: "The banner can now exit after confirmation." }[playerBannerMode], "success");
});
dom.playerSoundToggle?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-sounds]");
  if (!button) return;
  playerSoundsEnabled = button.dataset.playerSounds === "true";
  localStorage.setItem(PLAYER_SOUND_KEY, playerSoundsEnabled ? "on" : "off");
  dom.playerAtbFrame?.contentWindow?.postMessage({ type: "sa-player-sound-enabled", enabled: playerSoundsEnabled }, window.location.origin);
  renderPlayerSoundSetting();
  notice(playerSoundsEnabled ? "Player combat sounds enabled." : "All player combat sounds muted.", "success");
});
dom.characterBanner?.addEventListener("click", async () => {
  if (playerBannerMode !== "exit") return;
  const accepted = await askConfirmation({
    title: campaignCode ? "Exit campaign?" : "Return to the main menu?",
    message: campaignCode ? "Your character remains linked and saved. You can log back in from the main menu." : "Current character data is saved locally.",
    acceptLabel: "Exit",
    cancelLabel: "Stay Here",
  });
  if (accepted) window.location.href = "index.html";
});
window.addEventListener("storage", (event) => {
  if (event.key === PLAYER_BANNER_MODE_KEY) {
    playerBannerMode = ["hidden", "show", "exit"].includes(event.newValue) ? event.newValue : "show";
    renderBannerVisibility();
  }
  if (event.key === PLAYER_SOUND_KEY) {
    playerSoundsEnabled = event.newValue === "on";
    renderPlayerSoundSetting();
    dom.playerAtbFrame?.contentWindow?.postMessage({ type: "sa-player-sound-enabled", enabled: playerSoundsEnabled }, window.location.origin);
  }
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
  const upgraded = normalizeCharacter({ ...deepCopy(character), version: FORMAT_VERSION, importedDraft: false });
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
  await replaceCurrentCharacter(blankCharacter());
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
  resetCombatInterfaceState({ clearFrame: true });
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
    dom.campaignSheetFrame.style.height = height + "px";
    return;
  }
  if (event.source !== dom.playerAtbFrame?.contentWindow) return;
  if (event.data?.type === "sa-player-sound-enabled") {
    playerSoundsEnabled = Boolean(event.data.enabled);
    localStorage.setItem(PLAYER_SOUND_KEY, playerSoundsEnabled ? "on" : "off");
    renderPlayerSoundSetting();
    notice(playerSoundsEnabled ? "Player combat sounds enabled." : "All player combat sounds muted.", "success");
    return;
  }
  if (event.data?.type === "sa-combat-defeat-sequence") {
    beginCombatDeathSequence(event.data.duration);
    return;
  }
  if (event.data?.type === "sa-combat-layout") {
    const preview = Boolean(event.data.preview);
    dom.playerAtbFrame.closest(".player-atb-live")?.classList.toggle("combat-preview", preview);
    dom.playerAtbStatus.textContent = preview
      ? "No active encounter. Showing your live Speed preview."
      : "Live Combat connected. Use the tabs above at any time.";
    return;
  }
  if (event.data?.type === "sa-combat-request-cleared") {
    const attackId = String(event.data.attackId || "");
    if (!attackId || pendingCombatRequest?.attackId === attackId) pendingCombatRequest = null;
    if ((!attackId || skillCheck?.combatRequest?.attackId === attackId) && !skillCheck?.combatSubmitted) {
      closeSkillCheck({ discardCombat: true });
    }
    if ((!attackId || activeCombatDamageRequest?.attackId === attackId) && !combatDamageSubmitted) {
      closeCombatDamageResult({ processNext: false });
    }
    if (!attackId || lastReceivedCombatRequestKey.startsWith(attackId + ":")) lastReceivedCombatRequestKey = "";
    return;
  }
  if (["sa-combat-roll-request", "sa-combat-damage-request", "sa-combat-healing-request"].includes(event.data?.type)) {
    const request = {
      ...event.data,
      attackId: event.data.attackId || event.data.resolutionId,
      type: event.data.type === "sa-combat-roll-request" ? "roll" : "damage",
      healing: event.data.type === "sa-combat-healing-request",
    };
    const requestKey = request.attackId + ":" + request.type + ":" + (request.rollRole || "damage");
    const sameRollOpen = request.type === "roll" && skillCheck?.combatRequest?.attackId === request.attackId && skillCheck?.combatRequest?.rollRole === request.rollRole;
    const sameDamageOpen = request.type === "damage" && activeCombatDamageRequest?.attackId === request.attackId;
    if (requestKey === lastReceivedCombatRequestKey && (sameRollOpen || sameDamageOpen || pendingCombatRequest?.attackId === request.attackId)) return;
    lastReceivedCombatRequestKey = requestKey;
    pendingCombatRequest = request;
    const completedMatchingAttackRoll = request.type === "damage"
      && !request.healing
      && skillCheck?.combatRequest?.attackId === request.attackId
      && skillCheck.combatRequest.rollRole === "attacker"
      && skillCheck.combatSubmitted
      && !diceRoller.isActive();
    if (completedMatchingAttackRoll) closeSkillCheck({ discardCombat: true });
    else processPendingCombatRequest();
    return;
  }
  if (event.data?.type === "sa-combat-roll-timer" && skillCheck?.combatRequest?.attackId === event.data.attackId && skillCheck.combatRequest.rollRole === "defender") {
    const remaining = Math.max(0, Number(event.data.remaining) || 0);
    dom.skillCheckSubtitle.textContent = event.data.expired
      ? "DEFENSE WINDOW EXPIRED - respond now before the GM resolves it."
      : "Defense Command Window: " + Math.ceil(remaining) + " seconds remaining.";
  }
});
let playerAtbResizeObserver = null;

function syncMobilePlayerAtbHeight() {
  if (!dom.playerAtbFrame || !matchMedia("(max-width: 650px)").matches) {
    dom.playerAtbFrame?.style.removeProperty("height");
    return;
  }
  const frameDocument = dom.playerAtbFrame.contentDocument;
  if (!frameDocument) return;
  const height = Math.max(frameDocument.documentElement?.scrollHeight || 0, frameDocument.body?.scrollHeight || 0, 540);
  dom.playerAtbFrame.style.height = `${height}px`;
}

function watchMobilePlayerAtbHeight() {
  playerAtbResizeObserver?.disconnect();
  const frameDocument = dom.playerAtbFrame?.contentDocument;
  if (!frameDocument) return;
  playerAtbResizeObserver = new ResizeObserver(syncMobilePlayerAtbHeight);
  playerAtbResizeObserver.observe(frameDocument.documentElement);
  if (frameDocument.body) playerAtbResizeObserver.observe(frameDocument.body);
  syncMobilePlayerAtbHeight();
}

dom.playerAtbFrame?.addEventListener("load", () => {
  dom.playerAtbStatus.textContent = "Live encounter connected. Use the tabs above at any time; combat will remain open here.";
  dom.playerAtbFrame.contentWindow?.postMessage({ type: "sa-player-sound-enabled", enabled: playerSoundsEnabled }, window.location.origin);
  requestAnimationFrame(watchMobilePlayerAtbHeight);
});
window.addEventListener("resize", syncMobilePlayerAtbHeight);

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
  const claimButton = event.target.closest("[data-claim-reward]");
  if (claimButton && campaignEditable) {
    claimButton.disabled = true;
    const originalLabel = claimButton.textContent;
    claimButton.textContent = "Receiving...";
    try {
      const saved = await saveCampaignCharacter({ force: true });
      if (!saved && campaignDirty) throw new Error("Save the character before receiving this reward.");
      const payload = await campaignRequest("/api/campaign/award/claim", {
        method: "POST",
        body: JSON.stringify({ code: campaignCode, token: campaignToken, noteId: claimButton.dataset.claimReward }),
      });
      campaignState = payload.campaign;
      cacheCampaign(payload.campaign);
      const remote = payload.campaign?.characters?.find((entry) => entry.id === campaignCharacterId);
      if (remote) showCampaignCharacter(remote, { editable: true, token: campaignToken, pin: campaignPin });
      else receiveCampaignState(payload.campaign);
      const amount = Number(payload.appliedAmount) || 0;
      const rewardName = payload.resource === "credits"
        ? "Credits"
        : payload.resource === "reverence"
          ? "Reverence"
          : payload.resource === "dramaCards"
            ? "Drama Cards"
            : payload.resource === "attributePoints"
              ? "Attribute Points"
              : payload.resource === "skillPoints"
                ? "Skill Points"
          : payload.resource === "shipCredits"
            ? "Group Credits"
            : "Experience";
      playRewardChime(payload.resource);
      notice(amount > 0 ? `${amount.toLocaleString()} ${rewardName} received.` : "Reward processed.", "success");
    } catch (error) {
      claimButton.disabled = false;
      claimButton.textContent = originalLabel;
      notice(error.message, "error");
    }
    return;
  }
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
dom.submitManualCombatDamage?.addEventListener("click", submitManualCombatDamage);
dom.rollCombatDamage?.addEventListener("click", rollCombatDamage);
dom.exitCombatDamageResult?.addEventListener("click", closeCombatDamageResult);
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

dom.openImportMenu?.addEventListener("click", () => {
  dom.importChoiceModal.hidden = false;
  dom.importFileChoice.focus({ preventScroll: true });
});
dom.cancelImportChoice?.addEventListener("click", () => { dom.importChoiceModal.hidden = true; });
dom.importFileChoice?.addEventListener("click", () => {
  dom.importChoiceModal.hidden = true;
  dom.importCharacter.click();
});
dom.manualInputChoice?.addEventListener("click", () => {
  dom.importChoiceModal.hidden = true;
  if (character.phase !== "finalized") {
    snapshotRecovery("Before Manual Data Entry");
    library = library.filter((entry) => entry.id !== character.id);
  }
  const manual = blankCharacter();
  manual.creation.manualInput = true;
  manual.health.current = maximumHp(manual);
  library.push(manual);
  activeId = manual.id;
  character = manual;
  dom.skillSearch.value = "";
  saveLibrary("Manual character entry started");
  renderAll();
  renderCharacterNavigation();
  showCharacterPanel("sheet");
  notice("Manual Data Entry is active. Copy the physical sheet, then finalize at any time.", "success");
});

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

dom.dramaCardHand?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-drama-card]");
  if (!button) return;
  const card = campaignState?.dramaDeck?.hand?.find((entry) => entry.id === button.dataset.dramaCard);
  if (card) openDramaCard(card);
});

dom.closeDramaCard?.addEventListener("click", closeDramaCard);

dom.playDramaCard?.addEventListener("click", async () => {
  if (!selectedDramaCard || !campaignEditable) return;
  if (dom.playDramaCard.dataset.confirming !== "true") {
    dom.playDramaCard.dataset.confirming = "true";
    dom.playDramaCard.textContent = "Confirm Play";
    dom.closeDramaCard.textContent = "Cancel";
    dom.dramaCardAlertByline.hidden = false;
    dom.dramaCardAlertByline.textContent = "Play this card now? It will move to the shared discard pile.";
    return;
  }
  dom.playDramaCard.disabled = true;
  try {
    const card = selectedDramaCard;
    const payload = await campaignRequest("/api/campaign/drama/play", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, cardId: card.id }),
    });
    syncDramaCampaignState(payload.campaign);
    await animateDramaCardDeparture();
    closeDramaCard();
    notice(`${payload.card.name} played. The table has been alerted.`, "success");
  } catch (error) {
    dom.playDramaCard.disabled = false;
    dom.playDramaCard.dataset.confirming = "false";
    dom.playDramaCard.textContent = "Play Card";
    dom.closeDramaCard.textContent = "Close";
    dom.dramaCardAlertByline.hidden = true;
    notice(error.message, "error");
  }
});

dom.purchaseDramaCard?.addEventListener("click", async () => {
  if (dom.purchaseDramaCard.disabled || !campaignEditable) return;
  const accepted = await askConfirmation({
    title: "Purchase a Drama Card?",
    message: `Spend ${DRAMA_CARD_COST} Reverence to draw one unique card from the campaign deck.`,
    acceptLabel: "Purchase Card",
    cancelLabel: "Cancel",
  });
  if (!accepted) return;
  dom.purchaseDramaCard.disabled = true;
  try {
    await saveCampaignCharacter({ force: true });
    const payload = await campaignRequest("/api/campaign/drama/draw", {
      method: "POST",
      body: JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId }),
    });
    syncDramaCampaignState(payload.campaign);
    openDramaCard(payload.card, { receipt: true });
    notice(`${payload.card.name} added to your hand.`, "success");
  } catch (error) {
    notice(error.message, "error");
    renderResources();
  }
});

window.addEventListener("beforeunload", () => {
  if (CAMPAIGN_READ_ONLY_VIEW || GM_ADJUSTMENT_MODE) return;
  saveLibrary();
  if (campaignCode && campaignCharacterId && campaignEditable && campaignDirty) {
    const body = JSON.stringify({ code: campaignCode, token: campaignToken, characterId: campaignCharacterId, baseCredits: campaignBaselineCredits, baseCurrentHp: campaignBaselineHp, character });
    navigator.sendBeacon?.("/api/campaign/character/save", new Blob([body], { type: "application/json" }));
  }
});

async function initializeCharacterApp() {
  const params = PAGE_PARAMS;
  const explicitNewCharacter = params.get("new") === "1";
  document.body.classList.toggle("embedded-sheet", params.get("embedded") === "1");
  const requestedCode = String(params.get("campaign") || (explicitNewCharacter ? "" : localStorage.getItem("sa-character-campaign-code")) || "").trim().toUpperCase();
  const requestedCharacter = String(params.get("character") || "");
  const gmAccess = params.get("gm") === "1";
  if (explicitNewCharacter && !requestedCode && !requestedCharacter) {
    const next = blankCharacter();
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
    const tokenStorage = SHOWCASE_MODE ? sessionStorage : localStorage;
    let token = gmAccess
      ? (SHOWCASE_MODE ? sessionStorage : localStorage).getItem(`sa-gm-token-${requestedCode}`) || ""
      : tokenStorage.getItem(campaignTokenKey(requestedCode, requestedCharacter)) || "";
    try {
      let state = await loadCampaign(requestedCode, token);
      if (!gmAccess && state.role !== "character") {
        const localRecord = library.find((entry) => entry.id === requestedCharacter) || character;
        const pcCode = localRecord?.access?.pcCode || "";
        if (pcCode) {
          const unlocked = await campaignRequest("/api/campaign/character/unlock", {
            method: "POST",
            body: JSON.stringify({ code: requestedCode, characterId: requestedCharacter, pcCode }),
          });
          token = unlocked.token;
          (SHOWCASE_MODE ? sessionStorage : localStorage).setItem(campaignTokenKey(requestedCode, requestedCharacter), token);
          state = await loadCampaign(requestedCode, token);
        }
      }
      const record = state.characters.find((entry) => entry.id === requestedCharacter);
      if (record) {
        const editable = state.role === "gm" || (state.role === "character" && state.ownCharacterId === requestedCharacter);
        showCampaignCharacter(record, { editable, token, pin: record.pcCode || "" });
        enableGmAdjustmentMode();
        if (editable && character.phase === "finalizing") window.setTimeout(processFinalization, 120);
        else if (editable && character.pendingRoll) window.setTimeout(rollPending, 120);
        else if (params.get("showcase") === "1") window.setTimeout(() => showCharacterPanel("atb"), 120);
        return;
      }
    } catch (error) {
      dom.campaignMessage.textContent = error.message;
      if (error.status === 404 && character.campaignLink?.roomCode === requestedCode) {
        character.campaignLink.message = "Campaign temporarily unavailable. Link preserved until you explicitly leave or the GM removes it.";
        saveLibrary("Campaign link preserved");
        notice("That campaign is unavailable right now. Your character remains linked.", "error");
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

dom.creatorTitle?.addEventListener("click", () => {
  if (dom.creatorTitle.disabled) return;
  showCharacterPanel("settings");
  requestAnimationFrame(() => {
    dom.joinCampaignPanel.hidden = false;
    dom.joinCampaignPanel.classList.remove("join-campaign-attention");
    void dom.joinCampaignPanel.offsetWidth;
    dom.joinCampaignPanel.classList.add("join-campaign-attention");
    dom.joinCampaignPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    dom.joinCampaignRoomCode.focus({ preventScroll: true });
  });
});
dom.saveGmAdjustment?.addEventListener("click", saveGmAdjustments);
dom.cancelGmAdjustment?.addEventListener("click", cancelGmAdjustments);

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
if (!CAMPAIGN_READ_ONLY_VIEW && character.phase === "draft" && !draftHasProgress(character) && sessionStorage.getItem(`sa-draft-guide-${character.id}`) !== "shown") {
  sessionStorage.setItem(`sa-draft-guide-${character.id}`, "shown");
  window.setTimeout(showDraftIntroduction, 250);
}


