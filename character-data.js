export const ATTRIBUTE_POINTS = 195;
export const BASE_SKILL_POINTS = 35;
export const MAX_STARTING_SKILL = 3;

export const DICE_NAMES = ["D4", "D6", "D8", "D10", "D12"];
export const DICE_FACES = [4, 6, 8, 10, 12];
export const HOME_PLANETS = [
  "Earth",
  "Antropica",
  "Axioum-9",
  "Cornillia 4",
  "Darlasia",
  "Darmania",
  "Del-84",
  "Djoser-1",
  "Dorris",
  "Flaxen",
  "Gauson",
  "Goltron Armanna",
  "Grommin's Center",
  "Kalmavia-44",
  "LV-426",
  "Malo",
  "Mars",
  "Mercury",
  "Mizutaria",
  "Murcurus",
  "Plunto",
  "Pluto",
  "Rythune",
  "SR-388",
  "Tal-son",
  "Tarinian Volkmire",
  "The Planet of Endless Mist",
  "Tittleman's Crest",
  "Undiscovered Worlds",
  "Urbana 6",
  "Varu s-9",
  "Venus",
  "Water Planet",
];
export const ATTRIBUTE_COSTS = [
  [0, 15, 30, 60, 120],
  [0, 15, 30, 60, 120],
  [15, 30, 60, 120, 240],
  [15, 30, 60, 120, 240],
];

export const ATTRIBUTE_DEFS = [
  { key: "strength", label: "Strength", color: "#ff5b58" },
  { key: "health", label: "Health", color: "#39e58f" },
  { key: "perception", label: "Perception", color: "#ffd05a" },
  { key: "dexterity", label: "Dexterity", color: "#35c9ff" },
  { key: "luck", label: "Luck", color: "#a86cff" },
  { key: "charisma", label: "Charisma", color: "#ff68b8" },
  { key: "intellect", label: "Intellect", color: "#4f83ff" },
  { key: "willpower", label: "Willpower", color: "#ff984d" },
];

export const RACE_DEFS = [
  {
    id: "android",
    name: "Android",
    types: [
      { id: "perfect-android", name: "Perfect Android" },
      { id: "imperfect-android", name: "Imperfect Android" },
      { id: "perfect-robot", name: "Perfect Robot" },
      { id: "imperfect-robot", name: "Imperfect Robot" },
    ],
    disadvantages: [
      "You never gain Experience. You may still record total gained Experience for your next character.",
      "You can only simulate humor, morality, and emotions, if at all.",
      "Once per week you require a 30-minute recharge from an Engine that provides AU. Failing to recharge shuts down all systems until the recharge is performed.",
    ],
    advantages: [
      "Others may spend 75 Credits to spend 1 Experience on your character sheet for you.",
      "You do not need to eat, sleep, or breathe; you do not age; you can survive in nearly any temperature; and you cannot be poisoned or become sick.",
      "Add +5 to Initiative rolls.",
      "Mechanical devices and weapons may be attached to your body for an additional 25% of their cost. Attached items do not use Weapon Inventory slots.",
      "Each leg beyond two but below five adds +1 Move Speed and -1 Defense Score. Each arm beyond two but below five adds +1 to combat To-Hit rolls and -1 Defense Score. Additional limbs cost 1,000 Credits each.",
    ],
  },
  {
    id: "angiluros",
    name: "Angiluros",
    effects: { moveSpeedModifier: 1 },
    disadvantages: [
      "Whenever you fire or use a weapon made from metal or made by another character, lose one Willpower die and roll Willpower + Resist Distress against Difficulty 13. On a failure, take no further actions this CvC round or the following CvC round. Starship weapons do not cause this penalty.",
    ],
    advantages: [
      "When rolling Jump or Climb, treat regular successes as critical successes and critical failures as regular failures.",
      "Start with 60 additional points for purchasing starting Skills.",
      "Unarmed Melee Damage equals all Strength dice +3D6.",
      "Low-light vision.",
      "Reroll any one Attribute die up to four times per session.",
      "+1 Move Speed.",
      "Spend 2 Exertion to take an additional CvC Combat Action on your turn.",
    ],
  },
  {
    id: "antropic",
    name: "Antropic",
    types: [
      {
        id: "fangs",
        name: "Fangs",
        disadvantages: ["Colorblind. May go through hibernation cycles."],
        advantages: [
          "Night vision.",
          "Unarmed attacks give the opponent -3 Defense Score.",
          "Unarmed Melee Damage equals any three Strength dice plus two Health dice.",
        ],
      },
      {
        id: "feather",
        name: "Feather",
        effects: {
          moveSpeedModifier: 2,
          hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 20, label: "Two highest Health dice +20" },
        },
        disadvantages: [
          "Maximum HP equals the highest two purchased Health dice +20.",
          "You cannot fly while wearing a spacesuit or power armor.",
        ],
        advantages: [
          "Fly in most habitable environments for Move Speed x2 Combat rounds. This ability is lost for one week after taking Fire damage and is unavailable while wet.",
          "+2 Move Speed.",
        ],
      },
      {
        id: "fins",
        name: "Fins",
        disadvantages: [
          "Take x2 damage from the Ice property.",
          "Take one fewer Combat Action in a cold environment.",
        ],
        advantages: [
          "Triple Move Speed while swimming.",
          "Breathe underwater.",
          "Each Combat round, roll one Health die and heal that much HP.",
          "Reattach severed limbs.",
        ],
      },
      {
        id: "fluffy",
        name: "Fluffy",
        effects: { moveSpeedModifier: 2 },
        disadvantages: ["Take -2 to all Strength rolls."],
        advantages: [
          "Reroll up to two dice in Charisma and Dexterity on each roll.",
          "+2 Move Speed.",
          "Add +5 when calculating Jump height.",
        ],
      },
    ],
  },
  {
    id: "bruggle",
    name: "Bruggle",
    disadvantages: [
      "Take -2 Defense Score.",
      "Easily susceptible to alcoholism.",
    ],
    advantages: [
      "Reroll up to two dice in Strength, Dexterity, and Melee damage rolls.",
      "Breathe underwater.",
      "Harsh cold and hot environments do not cause discomfort.",
    ],
  },
  {
    id: "butchers-of-hellmouth",
    name: "Butchers of Hellmouth",
    effects: {
      hpFormula: { kind: "sum", attributes: ["health"], bonus: 40, label: "Health dice maximum +40" },
      maxHpReverenceCost: 3,
      skillBonuses: { "Intimidate/Taunt": 30 },
    },
    disadvantages: [
      "You are completely blind to objects 10 meters or farther away and cannot use binoculars or scopes.",
      "Roll no more than two Perception dice, and Perception dice cost twice as much.",
    ],
    advantages: [
      "Immune to Fire damage, although your body still retains Fire Intensity. While on fire, Melee attacks can ignite the opponent at the same Intensity.",
      "Maximum HP equals the maximum roll of all Health dice +40.",
      "Increasing Maximum HP by +2 costs 3 Reverence instead of 6.",
      "Spend 1 Exertion to restore HP equal to a Health + Athletics/Endurance roll.",
      "After character creation, add +3.0 to Intimidate/Taunt.",
      "Whenever you purchase a Strength die, gain another Strength die of equal or lower cost for free.",
    ],
  },
  {
    id: "draco-prime",
    name: "Draco Prime",
    disadvantages: [
      "When rolling any Attribute, ignore all but one set of fused dice.",
      "After character creation, Skill upgrade dice cannot be rerolled.",
    ],
    advantages: [
      "Shapeshift to resemble another race of roughly the same size, but not a specific person. Reptilian eyes may show while blinking, and the tongue may briefly revert while speaking.",
      "Draco Prime do not produce heat signatures.",
    ],
  },
  {
    id: "epoc",
    name: "Epoc",
    effects: {
      skillBonuses: {
        "Fashion/Etiquette": 20,
        "Art/Music": 20,
        "Intuition/Empathy": 20,
        Psychology: 20,
        Religion: 20,
        Showmanship: 20,
      },
    },
    disadvantages: [
      "For each 1 rolled in Strength, Health, Dexterity, or Perception, reduce the final Score by 1.",
    ],
    advantages: [
      "After any Luck, Charisma, Willpower, or Intellect roll, reroll up to two dice.",
      "While associated with a party, members of that party cannot critically fail Charisma rolls.",
      "After character creation, add +2.0 to Fashion/Etiquette, Art/Music, Intuition/Empathy, Psychology, Religion, and Showmanship.",
    ],
  },
  {
    id: "everliving-brethren",
    name: "Everliving Brethren",
    disadvantages: [
      "Take x2 damage from Fire and Fire Intensity dice.",
      "After rolling Perception, remove the die with the highest result from the pool.",
    ],
    advantages: [
      "Your race has no vital organs and does not need to breathe.",
      "Regenerate HP equal to your highest Health die type each CvC round, even while as low as -25 HP.",
      "Reattach severed limbs or replace them with stolen limbs.",
      "Each leg beyond two but below five adds +1 Move Speed and -1 Defense Score. Each arm beyond two but below five adds +1 to combat To-Hit rolls and -1 Defense Score.",
    ],
  },
  {
    id: "flavilin",
    name: "Flavilin",
    effects: {
      skillBonuses: {
        Engineering: 20,
        Awareness: 20,
        Technology: 20,
        "Vehicle Mechanics": 20,
        "Weapon Mechanics": 20,
      },
    },
    disadvantages: [
      "If stunned by a Light source, triple the duration.",
      "Dislikes bright environments.",
    ],
    advantages: [
      "Always add 1D12 to Perception rolls.",
      "After character creation, add +2.0 to Engineering, Awareness, Technology, Vehicle Mechanics, and Weapon Mechanics.",
    ],
  },
  {
    id: "garmoc",
    name: "Garmoc",
    effects: {
      hpFormula: { kind: "sum", attributes: ["health"], bonus: 30, label: "Health dice maximum +30" },
      damageReduction: { kind: "flat", value: 10, label: "Natural Damage Reduction 10" },
    },
    disadvantages: [
      "Charisma and Intellect dice results above 8 count as 8.",
      "Charisma and Intellect dice do not fuse.",
    ],
    advantages: [
      "When D10s or D12s fuse in a Strength, Willpower, or Health roll, add 1D20 to the pool.",
      "Natural Damage Reduction -10.",
      "Starting Maximum HP equals the maximum roll of all Health dice +30.",
      "Carnivorous predators often avoid attacking a Garmoc, even if they are not native to the same planet.",
    ],
  },
  {
    id: "grey",
    name: "Grey",
    effects: {
      moveSpeedModifier: -1,
      hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 0, label: "Two highest Health dice" },
    },
    disadvantages: [
      "Maximum HP equals the highest result of any two Health dice.",
      "-1 Move Speed.",
      "Do not add Strength dice to Melee damage.",
    ],
    advantages: [
      "Spend one Combat turn and 1 Exertion to skip a target character's next Combat turn within 60 meters and visual range. The target may spend Exertion to recover lost Combat Actions, one per point.",
      "Spend 2 Exertion to move an object within 60 meters and visual range as though beside it. Using the object as a weapon applies -5 To-Hit in addition to other modifiers.",
      "Reroll Intellect once per session.",
    ],
  },
  {
    id: "horus",
    name: "Horus",
    disadvantages: [],
    advantages: [
      "After character creation, roll 1D8 instead of 1D6 when purchasing a new Skill.",
      "Treat your eyes as built-in binoculars.",
      "310-degree vision, with the only blind spot directly behind the head.",
      "Perception dice can fuse multiple times. For example, results of 2, 2, and 4 become a single 8.",
    ],
  },
  {
    id: "human",
    name: "Human",
    effects: { xpOnFinalize: 200 },
    disadvantages: [],
    advantages: ["Start with +200 Experience."],
  },
  {
    id: "kabuto",
    name: "Kabuto",
    effects: {
      moveSpeedModifier: 2,
      hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 10, label: "Two highest Health dice +10" },
    },
    disadvantages: [
      "Cannot use or carry Size Class A or B weapons.",
      "Maximum HP equals the maximum roll of two Health dice +10.",
      "Cannot dual wield, gain Charge Bonus Damage from Melee weapons, or wear spacesuits or power armor.",
    ],
    advantages: [
      "+3 Reaction Defense and +2 Move Speed.",
      "Immune to falling damage and capable of limited gliding.",
      "You do not feel pain and critically succeed all Resist Distress rolls.",
      "If you die, your next character starts with 100% of this character's total gained Experience instead of 50%. If the new character is also Kabuto, retain Reverence, Drama Cards, and personal Credits. Offspring may retain the previous character's memories.",
    ],
  },
  {
    id: "krax-gny-vtek",
    name: "Krax G'ny V'Tek",
    effects: {
      moveSpeedModifier: 1,
      hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 10, label: "Two highest Health dice +10" },
      skillBonuses: { "Intimidate/Taunt": 30, "Stealth/Hide": 20 },
    },
    disadvantages: [
      "Maximum HP equals the highest result of any two Health dice +10.",
      "While missing 5 or more HP, you may roll no more than three Dexterity dice.",
    ],
    advantages: [
      "After character creation, add +3.0 to Intimidate/Taunt, +2.0 to Stealth/Hide, +2 Reaction Defense, and +1 Move Speed.",
      "Critically succeeding while avoiding a Melee attack grants one immediate free action.",
      "All successful unarmed Melee attacks count as Critical Hits.",
      "Nocturnal vision.",
      "Survive unprotected in the vacuum of space for up to 20 CvC rounds.",
    ],
  },
  {
    id: "nordic-flaxen",
    name: "Nordic Flaxen",
    effects: {
      hpFormula: { kind: "sum", attributes: ["health"], bonus: 32, label: "Health dice maximum +32" },
    },
    disadvantages: ["Take x2 damage from the Dark element."],
    advantages: [
      "Add all Luck dice to Charisma rolls.",
      "Maximum HP equals the maximum roll of all Health dice +32.",
      "After character creation, add +2.0 to one non-bold Skill of your choice.",
    ],
  },
  {
    id: "pattanilia",
    name: "Pattanilia",
    effects: {
      moveSpeedModifier: -1,
      hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 0, label: "Two highest Health dice" },
      skillBonuses: {
        "Pilot/Helm": 10,
        Navigate: 10,
        "Computer Systems": 10,
        Engineering: 10,
        "Sensor Systems": 10,
        "Weapon Systems": 10,
      },
    },
    disadvantages: [
      "Maximum HP equals the highest result of any two Health dice.",
      "-1 Move Speed.",
      "Do not add Strength dice to Melee damage.",
    ],
    advantages: [
      "Reroll up to two dice on every Perception, Intellect, and Willpower roll.",
      "Breathe underwater.",
      "After character creation, add +1.0 to every Spacecraft Skill.",
      "Immune to Light damage and able to shift visual spectrum at will, including heat, night, bright, color, radio-wave, sound, and radiation vision.",
      "After character creation, each unpurchased Skill gains a 1D10 decimal roll; a 10 starts that Skill at 1.0.",
      "Double all Attribute dice pools while inside Virtuocity.",
    ],
  },
  {
    id: "skeder",
    name: "Sked'er",
    effects: {
      damageReduction: { kind: "top", attributes: ["health"], count: 2, bonus: 0, label: "Two highest Health dice" },
    },
    disadvantages: [
      "Charisma rolls fail unless they are Critical Successes.",
      "Starship stations require 500-Credit Sked'er customization.",
      "Standard weapons take -5 To-Hit unless customized for an additional 25% of their cost.",
      "Difficulty speaking other languages.",
    ],
    advantages: [
      "Customized weapons impose -5 To-Hit when used by another race.",
      "+2 Reaction Defense.",
      "Natural Damage Reduction equals the maximum roll of any two Health dice.",
      "Add +3 when calculating Jump height.",
      "310-degree vision, with the only blind spot directly behind the head.",
      "After character creation, add +1.0 to any two Skills of your choice.",
    ],
  },
  {
    id: "slyn-tanni",
    name: "Slyn Tanni",
    effects: { skillBonuses: { "Dodge/Block": 20 } },
    disadvantages: [
      "Take x2 damage from the Ice property.",
      "Take one fewer Combat Action in a cold environment.",
    ],
    advantages: [
      "Breathe underwater.",
      "While falling, choose to fall only one meter per CvC round and fly at normal Move Speed.",
      "After character creation, add +2.0 to Dodge/Block.",
      "Reroll one Dexterity or Charisma die on each roll.",
      "Triple Move Speed in water.",
      "After character creation, gain one free Attribute die upgrade.",
    ],
  },
  {
    id: "spiddix",
    name: "Spiddix",
    effects: { creditsOnFinalize: 8000 },
    disadvantages: [
      "When detached from your mechanical device, Move Speed becomes 0 and all racial advantages are lost. Outside the device, Maximum HP equals your highest single Health die +5.",
      "The mechanical body takes x2 damage from Water and Electricity attacks.",
      "Start with 135 Attribute Points instead of 195 and 20 base Skill Points instead of 35.",
      "Session Experience cannot be spent on mechanical Attributes or Skills. Non-mechanical Attributes and Skills advance normally.",
      "Receive half of awarded Experience, rounded down; total gained Experience is not reduced.",
      "Mechanical Attributes: Strength, Health, and Dexterity.",
      "Mechanical Skills: Athletics/Endurance, Break Free/Escape, Catch/Throw, Climb, Dodge/Block, Jump, Lift/Push/Pull, Lock-picking, Melee, Pickpocket, Projectile, Stealth/Hide, Swim, and Wrestle/Disarm.",
    ],
    advantages: [
      "Start with +8,000 Credits.",
      "Spend Exertion on Intellect rolls.",
      "Rerolling Intellect with Reverence costs 1 instead of 2.",
      "Spend 100 Credits to buy one mechanical Experience point, used on mechanical Attributes and Skills at normal cost.",
      "Mechanical devices and weapons may be attached to your body for an additional 25% of their cost. Attached items do not use Weapon Inventory slots.",
      "Each leg beyond two but below five adds +1 Move Speed and -1 Defense Score. Each arm beyond two but below five adds +1 to combat To-Hit rolls and -1 Defense Score. Additional limbs cost 1,000 Credits each.",
    ],
  },
  {
    id: "tamalori",
    name: "TaMalori",
    effects: {
      hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 20, label: "Two highest Health dice +20" },
      forbidMaxHpReverence: true,
    },
    disadvantages: [
      "Maximum HP equals the highest result of any two Health dice +20.",
      "Enemy Critical Hits deal triple damage instead of double damage.",
      "Cannot purchase D12s in Strength or spend Reverence to increase Maximum HP.",
    ],
    advantages: [
      "Double the Dexterity dice pool. For example, 2D8 + 1D4 becomes 4D8 + 2D4.",
      "310-degree vision, with the only blind spot directly behind the head.",
    ],
  },
  {
    id: "vinolio-paxton",
    name: "Vinolio Paxton",
    disadvantages: ["Willpower dice cost twice as much."],
    advantages: [
      "Spend 1 Exertion to fly for one Combat round at normal Move Speed.",
      "Spend 1 Exertion to move an object within 30 meters and visual range as though beside it. Using the object as a weapon applies -5 To-Hit in addition to other modifiers.",
    ],
  },
  {
    id: "xithx",
    name: "Xithx",
    effects: {
      moveSpeedModifier: 2,
      hpFormula: { kind: "top", attributes: ["health"], count: 1, bonus: 0, label: "Highest Health die; no +20" },
      damageReduction: { kind: "top", attributes: ["health"], count: 2, bonus: 2, label: "Two highest Health dice +2" },
    },
    disadvantages: [
      "Maximum HP equals the highest roll among all Health dice, without adding 20.",
      "When rolling Stealth/Hide, ignore the highest result.",
    ],
    advantages: [
      "Natural Damage Reduction equals the maximum possible roll of any two Health dice +2. Critical Hits and Fire damage bypass this reduction.",
      "Recover one Exertion every 15 minutes instead of restoring all Exertion after sleep.",
      "Night vision, 360-degree vision, +2 Move Speed, and a slight telepathic connection with other Xithx.",
      "While unencumbered, stand or walk on water and most liquids at half Move Speed, rounded up.",
    ],
  },
  {
    id: "yetuak-zune",
    name: "Ye'tuak Zune",
    effects: {
      hpFormula: { kind: "top", attributes: ["health"], count: 2, bonus: 10, label: "Two highest Health dice +10" },
    },
    disadvantages: [
      "Maximum HP equals the highest two purchased Health dice +10.",
      "Charisma dice do not fuse.",
      "Take x2 damage from Fire and Fire Intensity.",
    ],
    advantages: [
      "Average lifespan of 300 Earth years.",
      "Reroll Intellect twice per session and Perception twice per session.",
      "Immune to the effects and damage of cold and ice.",
      "Night vision and heat vision.",
      "Survive unprotected in the vacuum of space for up to 15 CvC rounds.",
    ],
  },
  {
    id: "yuhorn-symitron",
    name: "Yuhorn Symitron",
    types: [
      {
        id: "ice",
        name: "Ice",
        effects: {
          moveSpeedModifier: -1,
          hpFormula: { kind: "sum", attributes: ["health", "strength"], bonus: 15, label: "Health and Strength dice maximum +15" },
          damageReduction: { kind: "top", attributes: ["willpower"], count: 2, bonus: 0, label: "Two highest Willpower dice" },
        },
        disadvantages: [
          "-1 Move Speed and -3 Defense Score.",
          "Cannot tolerate warm or hot environments.",
          "Take x2 damage from Fire and Fire Intensity.",
          "Cannot wear spacesuits or power armor.",
        ],
        advantages: [
          "Maximum HP equals the highest roll of all Health and Strength dice +15.",
          "Natural Damage Reduction equals the highest roll of the top two Willpower dice.",
          "Immune to Ice and Cold damage.",
          "Unarmed Melee and Wrestle attacks reduce the opponent's Combat Actions by one. The opponent may spend Exertion to restore lost actions.",
          "Does not produce a heat signature.",
        ],
      },
      {
        id: "lava",
        name: "Lava",
        effects: {
          moveSpeedModifier: -1,
          hpFormula: { kind: "sum", attributes: ["health", "strength"], bonus: 15, label: "Health and Strength dice maximum +15" },
          damageReduction: { kind: "top", attributes: ["willpower"], count: 1, bonus: 0, label: "Highest Willpower die" },
        },
        disadvantages: [
          "-1 Move Speed and -3 Defense Score.",
          "Cannot tolerate cold environments.",
          "Take x2 damage from Ice and cold.",
          "Cannot wear spacesuits or power armor.",
        ],
        advantages: [
          "Maximum HP equals the highest roll of all Health and Strength dice +15.",
          "Natural Damage Reduction equals the highest Willpower die type.",
          "Immune to Fire and Heat damage.",
          "Unarmed attacks deal all Strength dice in damage and cause Fire Intensity equal to the number of purchased Willpower dice.",
        ],
      },
      {
        id: "rock",
        name: "Rock",
        effects: {
          moveSpeedModifier: -2,
          moveSpeedMinimum: 1,
          hpFormula: { kind: "sum", attributes: ["health", "strength"], bonus: 15, label: "Health and Strength dice maximum +15" },
          damageReduction: { kind: "sum", attributes: ["willpower"], bonus: 2, label: "Willpower dice maximum +2" },
        },
        disadvantages: [
          "-2 Move Speed, to a minimum of 1, and -4 Defense Score.",
          "Eat raw minerals instead of food and must devour one Mineral twice every 24 hours.",
          "Cannot wear spacesuits or power armor.",
        ],
        advantages: [
          "Maximum HP equals the highest roll of all Health and Strength dice +15.",
          "Natural Damage Reduction equals the highest roll of all Willpower dice +2.",
        ],
      },
      {
        id: "wood",
        name: "Wood",
        effects: {
          moveSpeedModifier: -1,
          hpFormula: { kind: "sum", attributes: ["health", "strength"], bonus: 15, label: "Health and Strength dice maximum +15" },
          damageReduction: { kind: "top", attributes: ["willpower"], count: 1, bonus: 0, label: "Highest Willpower die" },
        },
        disadvantages: [
          "-1 Move Speed and -3 Defense Score.",
          "Take x2 damage from Fire and Fire Intensity.",
          "Cannot wear spacesuits or power armor.",
        ],
        advantages: [
          "Maximum HP equals the highest roll of all Health and Strength dice +15.",
          "Natural Damage Reduction equals the highest Willpower die type.",
          "Regenerate 3 HP per CvC round for each point of unspent Exertion.",
          "Spend 1 Exertion to heal half Maximum HP, rounded down. Fire damage cannot be regenerated this way.",
        ],
      },
    ],
  },
];

export function raceById(id) {
  return RACE_DEFS.find((entry) => entry.id === id) || null;
}

export const SPACECRAFT_SKILLS = [
  "Computer Systems",
  "Engineering",
  "Hacking",
  "Pilot/Helm",
  "Sensor Systems",
  "Weapon Systems",
];

export const BOLD_SKILLS = new Set([
  ...SPACECRAFT_SKILLS,
  "Awareness",
  "Dodge/Block",
  "Initiative",
  "Melee",
  "Projectile",
]);

export const GENERAL_SKILLS = [
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

export const INTELLECT_SKILL_POINT_BONUSES = [0, 3, 5, 10, 20];

export const CLASS_DEFS = [
  {
    id: "",
    name: "No Class",
    summary: "No class advantage is applied.",
  },
  {
    id: "ambassador-spy",
    name: "Ambassador / Spy",
    summary: "After character creation, purchasing a Charisma or Luck die grants a free die of equal or lower value in Charisma or Luck.",
    manual: "The free Attribute die choice will be automated with post-finalization Attribute advancement.",
  },
  {
    id: "blessed",
    name: "Blessed",
    summary: "Starts with full Reverence and five Drama Cards.",
    effects: { reverenceOnFinalize: 10, dramaCardsOnFinalize: 5 },
  },
  {
    id: "corporate-worker",
    name: "Corporate Worker / Citizen",
    summary: "Starts with an additional 15,000 credits.",
    effects: { creditsOnFinalize: 15000 },
  },
  {
    id: "decker",
    name: "Decker / Computer Specialist",
    summary: "Spend 2 Reverence while Hacking to reduce enemy Security Code digits by 1. Computer Systems may be rerolled up to three times per session.",
  },
  {
    id: "demolition-specialist",
    name: "Demolition Specialist / Pyro",
    summary: "Add +1 Fire Intensity to Fire Element attacks for every 1.0 in Demolitions. This may exceed Intensity 5.",
  },
  {
    id: "engineer",
    name: "Engineer",
    summary: "While stationed aboard a starship, add AU to an action equal to the highest Intellect die face.",
    manual: "Station AU will be automated when station interfaces are added.",
  },
  {
    id: "gunner",
    name: "Gunner",
    summary: "Weapon Systems rolls add one Dexterity or Intellect die. Each Reverence spent adds +2D10 to one damage roll.",
  },
  {
    id: "heavy",
    name: "Heavy",
    summary: "Treat all weapons as one Size Class lower and add +15 Maximum HP.",
    effects: { maxHpBonus: 15 },
  },
  {
    id: "informant",
    name: "Informant",
    summary: "Create up to five helpful NPC contacts. Add another contact whenever entering a new star system.",
  },
  {
    id: "marine-soldier",
    name: "Marine / Soldier",
    summary: "Projectile triples may fuse. Once per session, roll Willpower and heal the sum of all dice.",
  },
  {
    id: "mastermind",
    name: "Mastermind",
    summary: "Initiative contributes 1.5 times its rating to Speed. Awareness adds 45 seconds per level to the Command Window.",
  },
  {
    id: "medical-officer",
    name: "Medical Officer",
    summary: "Triple the effectiveness of HP healing. May heal someone below zero HP for up to 25 combat rounds while vital organs remain.",
  },
  {
    id: "navigator-sensor-tech",
    name: "Navigator / Sensor Tech",
    summary: "Pilot/Helm and Navigate are combined when rolling either. Awareness and Sensor Systems are combined when rolling either.",
  },
  {
    id: "ninja",
    name: "Ninja",
    summary: "Each Exertion spent on Stealth/Hide adds its normal +1D12 and +1, plus another +4 to the final Score. Legacy melee-defense, climbing, and Called Shot benefits remain for later combat automation.",
    pendingAtb: true,
  },
  {
    id: "peacekeeper",
    name: "Peacekeeper",
    summary: "Add 1D12 to Negotiation/Persuade. Draw a Drama Card for preventing combat, up to twice per session.",
  },
  {
    id: "pirate",
    name: "Pirate",
    summary: "Identify prices, gain +3.0 to Projectile and Melee against unarmed characters, ignore Disarm requirements, and salvage a random compatible SIC after defeating a starship.",
  },
  {
    id: "playboy-minx",
    name: "Playboy / Minx",
    summary: "Combine Negotiation/Persuade and Acting/Lie. Gain +5 XP and +1 Reverence for each new sexual partner.",
  },
  {
    id: "psychopath",
    name: "Psychopath",
    summary: "Gain +8 XP after killing a character, up to three times per session.",
  },
  {
    id: "robotics-worker",
    name: "Robotics Worker / A.I. Psychologist",
    summary: "Android and Spiddix upgrades cost 25 fewer credits per XP. Spend 1 Reverence to grant either race +8 XP. Cannot combine with those races.",
  },
  {
    id: "rogue-drifter",
    name: "Rogue / Drifter",
    summary: "Begins each combat with 99% ATB. The former Ambush Round and React wording is replaced by this ATB benefit.",
  },
  {
    id: "science-officer",
    name: "Science Officer",
    summary: "Add Intellect dice to Perception rolls. At session end, add +0.1 to Research, Science/Physics, or Mathematics.",
  },
  {
    id: "scout-sniper",
    name: "Scout / Sniper",
    summary: "After creation, add +2.0 to Survival/Tracking and Awareness. Legacy benefit spends Exertion for additional Aim actions.",
    pendingAtb: true,
    effects: { skillBonuses: { "Survival/Tracking": 20, Awareness: 20 } },
  },
  {
    id: "smuggler",
    name: "Smuggler",
    summary: "Charisma and Intellect may borrow up to two dice from each other. Six listed skills gain +2.0 after creation.",
    effects: {
      skillBonuses: {
        "Acting/Lie": 20,
        "Common Knowledge": 20,
        "History/Lore": 20,
        "Law/Politics": 20,
        Navigate: 20,
        "Negotiation/Persuade": 20,
      },
    },
  },
  {
    id: "tactician",
    name: "Tactician",
    summary: "Each session distribute up to the number of players +2 Reverence to other players. Personal Drama Cards may be given away at the beginning of a session.",
  },
  {
    id: "other",
    name: "Other",
    summary: "Choose one Attribute whose unused dice add to the result decimal. Gain +60 XP immediately after finalization.",
    effects: { xpOnFinalize: 60 },
  },
];

export function classById(id) {
  return CLASS_DEFS.find((entry) => entry.id === id) || CLASS_DEFS[0];
}
