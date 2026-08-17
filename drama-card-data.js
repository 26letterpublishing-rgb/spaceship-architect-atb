(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  if (root) root.SA_DRAMA_CARDS = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DRAMA_CARD_COST = 4;
  const DRAMA_CARD_HAND_LIMIT = 7;
  const DRAMA_CARDS = Object.freeze([
  {
    "id": "drama-001",
    "number": 1,
    "name": "PRACTICE ROLL",
    "category": "Rule Breaker",
    "text": "Play after any roll is resolved. Reroll it and use the new result.",
    "handling": "Reveal, resolve, then discard.",
    "tags": [
      "Reroll",
      "Any Roll"
    ]
  },
  {
    "id": "drama-002",
    "number": 2,
    "name": "FLASHBACK",
    "category": "Social Change",
    "text": "Immediately add or revise one fact in your character's backstory. The new fact is true and may affect the current story, provided it does not erase an established event.",
    "handling": "Reveal, record the new fact, then discard.",
    "tags": [
      "Backstory",
      "Narrative Authority"
    ]
  },
  {
    "id": "drama-003",
    "number": 3,
    "name": "CAME PREPARED",
    "category": "Deus Ex Machina",
    "text": "Choose any standard item you could normally purchase. Pay its normal Credit cost and add it to your carried inventory immediately, as if you had it all along.",
    "handling": "Add the item as Purchased, reveal, then discard.",
    "tags": [
      "Inventory",
      "Credits",
      "Retroactive"
    ]
  },
  {
    "id": "drama-004",
    "number": 4,
    "name": "DRAMATIC SAVE",
    "category": "Spotlight",
    "text": "Play when a friendly character within 8 units would take projectile damage. Move adjacent to that character and intercept the attack. They take no damage; you take half the attack's final damage, rounded up. Draw 1 Drama Card.",
    "handling": "Resolve the interception, draw 1 from the shared deck, then discard this card.",
    "tags": [
      "Projectile",
      "Damage Intercept",
      "Draw"
    ]
  },
  {
    "id": "drama-005",
    "number": 5,
    "name": "GLITCH",
    "category": "Deus Ex Machina",
    "text": "Choose an electronic device within 15 meters. It immediately malfunctions for a short time; the GM determines the exact failure and duration.",
    "handling": "Reveal, GM resolves the malfunction, then discard.",
    "tags": [
      "Electronics",
      "Malfunction"
    ]
  },
  {
    "id": "drama-006",
    "number": 6,
    "name": "LEVEL UP",
    "category": "Jackpot",
    "text": "Play after the GM announces an Experience award. Double the Experience awarded to your character.",
    "handling": "Apply the additional Experience as part of the same award, then discard.",
    "tags": [
      "Experience",
      "Award"
    ]
  },
  {
    "id": "drama-007",
    "number": 7,
    "name": "SONIC SPEED",
    "category": "Spotlight",
    "text": "Play at any time, even during another character's action. Immediately Move up to three times your Move Speed without changing your ATB. Alternatively, play when you are attacked to automatically succeed on that Dodge/Block Check.",
    "handling": "Resolve immediately as an interrupt, then discard.",
    "tags": [
      "Move",
      "Interrupt",
      "Dodge/Block"
    ]
  },
  {
    "id": "drama-008",
    "number": 8,
    "name": "JUST A HUNCH",
    "category": "Rule Breaker",
    "text": "Play after the GM says your character cannot attempt an action because the idea came from out-of-character knowledge. Your character attempts it anyway; the GM still determines how the action is resolved.",
    "handling": "Reveal before resolving the attempted action, then discard.",
    "tags": [
      "Metagame",
      "Player Agency"
    ]
  },
  {
    "id": "drama-009",
    "number": 9,
    "name": "LOCKED AND LOADED",
    "category": "Rule Breaker",
    "text": "Play when you choose Fire Gun. Before the attack is resolved, set your held projectile weapon to its Max Charge. The attack consumes those Charges normally.",
    "handling": "Set the held weapon to Max Charge, resolve the attack, then discard.",
    "tags": [
      "Weapon Charge",
      "Fire Gun"
    ]
  },
  {
    "id": "drama-010",
    "number": 10,
    "name": "RANDOM NOISE",
    "category": "Social Change",
    "text": "A sudden loud noise or commotion grabs everyone's attention. The GM describes its source and immediate consequences.",
    "handling": "Reveal, GM describes the event, then discard.",
    "tags": [
      "Distraction",
      "Scene Change"
    ]
  },
  {
    "id": "drama-011",
    "number": 11,
    "name": "THAT WAS QUICK",
    "category": "Spotlight",
    "text": "Play when your character begins a task represented by a Delay Timer, Delayed Resolution, or Queued Effect. Reduce its remaining time to 10%, rounded up to the nearest tenth of a second.",
    "handling": "Edit the active timer, reveal, then discard.",
    "tags": [
      "Delay Timer",
      "Delayed Resolution",
      "Queued Effect"
    ]
  },
  {
    "id": "drama-012",
    "number": 12,
    "name": "DON’T LOOK",
    "category": "Fate",
    "text": "Play immediately after an explosion is triggered, before damage is applied. Double both its Damage and its effect radius.",
    "handling": "Modify the explosion, resolve it, then discard.",
    "tags": [
      "Explosion",
      "Damage",
      "Radius"
    ]
  },
  {
    "id": "drama-013",
    "number": 13,
    "name": "I KNOW A GUY",
    "category": "Deus Ex Machina",
    "text": "Name a field of specialized knowledge. You know an NPC in the current sector who is an expert in that field. Work with the GM to establish who they are and how you can contact them.",
    "handling": "Record the contact, then discard.",
    "tags": [
      "Contact",
      "NPC",
      "Expertise"
    ]
  },
  {
    "id": "drama-014",
    "number": 14,
    "name": "REVENGEANCE",
    "category": "Spotlight",
    "text": "Play after an attack reduces your HP. Record the final HP damage you suffered. The next time you deal damage this session, add the recorded amount to the final damage, then clear it.",
    "handling": "Place in Active Effects until triggered or the session ends, then discard.",
    "tags": [
      "Stored Damage",
      "Session Effect"
    ]
  },
  {
    "id": "drama-015",
    "number": 15,
    "name": "ALL OR NOTHING",
    "category": "Rule Breaker",
    "text": "Play before an Attribute Check. Do not roll dice. Flip a coin instead: heads is a Critical Success; tails is a Critical Failure.",
    "handling": "Resolve the coin flip, then discard.",
    "tags": [
      "Attribute Check",
      "Critical Result",
      "Coin"
    ]
  },
  {
    "id": "drama-016",
    "number": 16,
    "name": "I ALMOST FORGOT",
    "category": "Jackpot",
    "text": "Play before making a Check with a Skill rated 1.9 or lower. Roll 2D6 and permanently add both results as tenths to that Skill. This increase costs no Experience.",
    "handling": "Apply the permanent Skill increase, reveal, then discard.",
    "tags": [
      "Skill Advancement",
      "Permanent",
      "2D6"
    ]
  },
  {
    "id": "drama-017",
    "number": 17,
    "name": "H.A.A.R.P.",
    "category": "Fate",
    "text": "Immediately change the local weather or natural environment to conditions of your choosing. This may be used in a planet's atmosphere or in outer space. The GM determines the mechanical effects.",
    "handling": "Reveal, establish the new conditions, then discard.",
    "tags": [
      "Environment",
      "Weather",
      "Space"
    ]
  },
  {
    "id": "drama-018",
    "number": 18,
    "name": "ENVIRONMENTAL HAZARD",
    "category": "Spotlight",
    "text": "Play after you attack an enemy near a useful environmental feature. That feature causes additional damage, forced movement, or another hindrance chosen by the GM.",
    "handling": "GM resolves the added consequence, then discard.",
    "tags": [
      "Environment",
      "Attack",
      "Hindrance"
    ]
  },
  {
    "id": "drama-019",
    "number": 19,
    "name": "BLIND SPOT",
    "category": "Rule Breaker",
    "text": "Play when an NPC would spot you. They fail to detect you, and you may immediately Move up to three times your Move Speed without changing your ATB.",
    "handling": "Resolve the escape immediately, then discard.",
    "tags": [
      "Detection",
      "Move",
      "Interrupt"
    ]
  },
  {
    "id": "drama-020",
    "number": 20,
    "name": "WEAK POINT",
    "category": "Spotlight",
    "text": "Play after you deal damage to an enemy. If the attack was a Critical Success, the next two times that enemy's ATB reaches 100%, reset it to 0% without giving them a turn. Otherwise, double the attack's final damage.",
    "handling": "Create a two-trigger status or modify damage, then discard.",
    "tags": [
      "Critical Success",
      "Skip Turn",
      "Double Damage"
    ]
  },
  {
    "id": "drama-021",
    "number": 21,
    "name": "CARRY INJURED",
    "category": "Spotlight",
    "text": "Play when you Move while carrying or supporting an injured ally. Increase the maximum distance of that Move by your Move Speed, and the ally moves with you.",
    "handling": "Resolve the extended Move, then discard.",
    "tags": [
      "Move",
      "Ally",
      "Carry"
    ]
  },
  {
    "id": "drama-022",
    "number": 22,
    "name": "FAMOUS",
    "category": "Social Change",
    "text": "Play when you meet an NPC for the first time. Although you have never personally met, they already know of you for a factual reason you choose.",
    "handling": "Establish the fact, then discard.",
    "tags": [
      "NPC",
      "Reputation",
      "First Meeting"
    ]
  },
  {
    "id": "drama-023",
    "number": 23,
    "name": "HIDDEN PASSAGE",
    "category": "Deus Ex Machina",
    "text": "You immediately discover a concealed route through a nearby wall, floor, ceiling, or ventilation system. The GM describes where it leads.",
    "handling": "Reveal, GM places the route, then discard.",
    "tags": [
      "Exploration",
      "Secret Route"
    ]
  },
  {
    "id": "drama-024",
    "number": 24,
    "name": "THE ONE",
    "category": "Spotlight",
    "text": "For the next five attacks that target you, triple the final Score of your Dodge/Block Check. Remove this effect after the fifth attack or when Combat ends.",
    "handling": "Place in Active Effects with five uses, then discard.",
    "tags": [
      "Dodge/Block",
      "Persistent Combat Effect"
    ]
  },
  {
    "id": "drama-025",
    "number": 25,
    "name": "MALFUNCTION",
    "category": "Deus Ex Machina",
    "text": "Play when a character chooses Fire Gun. Their held weapon loses all stored Charges and cannot fire. The GM decides whether it requires ammunition or a Reload/Recovery Delay before it works again.",
    "handling": "Apply the weapon status, then discard.",
    "tags": [
      "Weapon",
      "Malfunction",
      "Reload/Recovery"
    ]
  },
  {
    "id": "drama-026",
    "number": 26,
    "name": "FART",
    "category": "Social Change",
    "text": "Choose a character. They fart. Everyone nearby notices.",
    "handling": "Reveal, endure the consequences, then discard.",
    "tags": [
      "Social",
      "Distraction",
      "Extremely Serious"
    ]
  },
  {
    "id": "drama-027",
    "number": 27,
    "name": "LONG SHOT",
    "category": "Deus Ex Machina",
    "text": "Play after you roll a Critical Failure. Change it to a Critical Success, resolved in the luckiest plausible way possible.",
    "handling": "Replace the result, then discard.",
    "tags": [
      "Critical Failure",
      "Critical Success",
      "Luck"
    ]
  },
  {
    "id": "drama-028",
    "number": 28,
    "name": "BRUTE HACK",
    "category": "Spotlight",
    "text": "Make a gun attack against an electronic device. On a hit, cause one plausible electronic effect of your choosing instead of dealing normal damage.",
    "handling": "Declare the desired effect before the attack, resolve it, then discard.",
    "tags": [
      "Projectile",
      "Electronics",
      "Alternate Effect"
    ]
  },
  {
    "id": "drama-029",
    "number": 29,
    "name": "PERSONAL EMERGENCY",
    "category": "Social Change",
    "text": "Choose an NPC. They receive an urgent personal message and must leave the scene immediately. The GM determines how they depart.",
    "handling": "Remove the NPC from the scene, then discard.",
    "tags": [
      "NPC",
      "Scene Exit"
    ]
  },
  {
    "id": "drama-030",
    "number": 30,
    "name": "ENOUGH!",
    "category": "Spotlight",
    "text": "Everyone in the scene stops long enough to hear what you have to say. Pause Combat immediately. After you speak, Combat ends unless someone has an unavoidable reason to continue fighting.",
    "handling": "Pause the clock, resolve the speech, then discard.",
    "tags": [
      "Combat Pause",
      "Speech",
      "Scene Control"
    ]
  },
  {
    "id": "drama-031",
    "number": 31,
    "name": "JUST THE RIGHT ANGLE",
    "category": "Rule Breaker",
    "text": "Play after your starship damages another starship. Randomly select one installed SIC on the target. That SIC gains 1D4 Impairment.",
    "handling": "Randomize an installed target SIC, apply Impairment, then discard.",
    "tags": [
      "Starship",
      "SIC",
      "Impairment"
    ]
  },
  {
    "id": "drama-032",
    "number": 32,
    "name": "DIFFERENT WAY OF DOING THINGS",
    "category": "Rule Breaker",
    "text": "Choose one: Before a Check, convince the GM to let you use a different Attribute or Skill. If the GM agrees and you make the Check that way, draw 2 Drama Cards. OR gain 3 Reverence.",
    "handling": "Resolve the chosen mode, then discard.",
    "tags": [
      "Alternate Check",
      "Draw",
      "Reverence"
    ]
  },
  {
    "id": "drama-033",
    "number": 33,
    "name": "HEY! CHECK THIS OUT!",
    "category": "Deus Ex Machina",
    "text": "Name a non-unique standard item that would be perfect for the current situation. You look down and find one beside your foot. Add it to your inventory as Received.",
    "handling": "Add the item as Received, then discard.",
    "tags": [
      "Item",
      "Discovery",
      "Inventory"
    ]
  },
  {
    "id": "drama-034",
    "number": 34,
    "name": "FTL ESCAPE",
    "category": "Rule Breaker",
    "text": "Play when an FTL jump begins its Delayed Resolution. Resolve the jump instantly, before any ATB meters advance.",
    "handling": "Resolve the jump immediately, then discard.",
    "tags": [
      "Starship",
      "FTL",
      "Delayed Resolution"
    ]
  },
  {
    "id": "drama-035",
    "number": 35,
    "name": "NEVER MISS",
    "category": "Spotlight",
    "text": "Play before an attack roll or after an attack misses. The attack hits automatically and ignores the target's Damage Reduction.",
    "handling": "Override the attack result, then discard.",
    "tags": [
      "Automatic Hit",
      "Ignore Damage Reduction"
    ]
  },
  {
    "id": "drama-036",
    "number": 36,
    "name": "DEJA VU",
    "category": "Fate",
    "text": "Your character immediately knows the complete architectural layout of the structure they currently occupy, including all ordinary entrances, exits, and rooms.",
    "handling": "GM reveals the known layout, then discard.",
    "tags": [
      "Exploration",
      "Map Knowledge"
    ]
  },
  {
    "id": "drama-037",
    "number": 37,
    "name": "THOUGHT DWELL",
    "category": "Social Change",
    "text": "Play after speaking to an NPC. Choose one thing you said; that statement remains important to them indefinitely. The GM decides how it changes their behavior.",
    "handling": "Record the lasting statement, then discard.",
    "tags": [
      "NPC",
      "Lasting Impression"
    ]
  },
  {
    "id": "drama-038",
    "number": 38,
    "name": "SWITCHEROO",
    "category": "Deus Ex Machina",
    "text": "Play after you give an object to another character. Reveal that the object was a convincing fake; the original is still in your inventory.",
    "handling": "Restore the original to inventory and mark the transferred copy as fake, then discard.",
    "tags": [
      "Item",
      "Deception",
      "Retroactive"
    ]
  },
  {
    "id": "drama-039",
    "number": 39,
    "name": "NEAR MISS",
    "category": "Rule Breaker",
    "text": "Play after your final incoming damage is announced, before HP is reduced. Replace that damage with 1D6 damage.",
    "handling": "Roll 1D6, apply that damage, then discard.",
    "tags": [
      "Damage Replacement",
      "1D6"
    ]
  },
  {
    "id": "drama-040",
    "number": 40,
    "name": "OLD FRIEND",
    "category": "Deus Ex Machina",
    "text": "An old ally unexpectedly arrives and helps with the current situation. Work with the GM to identify the ally and explain how they reached you.",
    "handling": "Introduce the ally, then discard.",
    "tags": [
      "Ally",
      "NPC",
      "Rescue"
    ]
  },
  {
    "id": "drama-041",
    "number": 41,
    "name": "SAW THIS COMING",
    "category": "Deus Ex Machina",
    "text": "Choose a character in the scene. Reveal a trap you secretly prepared earlier; they are immediately caught in it. The GM determines the escape Check or Delay Timer required to break free.",
    "handling": "Apply the trap status, then discard.",
    "tags": [
      "Trap",
      "Retroactive",
      "Delay Timer"
    ]
  },
  {
    "id": "drama-042",
    "number": 42,
    "name": "NEVER LUCKY",
    "category": "Rule Breaker",
    "text": "Play before an Attribute Check. Add your full Luck dice pool to that Check.",
    "handling": "Add Luck dice to the roll, then discard.",
    "tags": [
      "Attribute Check",
      "Luck Dice"
    ]
  },
  {
    "id": "drama-043",
    "number": 43,
    "name": "OH, NOW I REMEMBER",
    "category": "Jackpot",
    "text": "Play after resolving a Check with a Skill rated 0.9 or lower. Permanently increase that Skill by +2.0.",
    "handling": "Apply the permanent Skill increase, then discard.",
    "tags": [
      "Skill Advancement",
      "Permanent"
    ]
  },
  {
    "id": "drama-044",
    "number": 44,
    "name": "MISTAKEN IDENTITY",
    "category": "Social Change",
    "text": "Play when you encounter an NPC. They mistake you for someone else, such as their commander, a distant relative, or another person you name.",
    "handling": "Establish the mistaken identity, then discard.",
    "tags": [
      "NPC",
      "Identity",
      "Social"
    ]
  },
  {
    "id": "drama-045",
    "number": 45,
    "name": "CRITICAL MOMENT",
    "category": "Deus Ex Machina",
    "text": "Play after the GM resolves a Check for an NPC. Change that result to a Critical Failure.",
    "handling": "Replace the NPC result, then discard.",
    "tags": [
      "NPC",
      "Critical Failure",
      "Result Override"
    ]
  },
  {
    "id": "drama-046",
    "number": 46,
    "name": "BULLET TIME",
    "category": "Spotlight",
    "text": "Play at any time during Combat. Pause the current resolution, set your ATB to 100%, and take a turn immediately. Your ATB resets normally when that turn ends, then the interrupted resolution continues.",
    "handling": "Create an interrupt turn, resolve it, then discard.",
    "tags": [
      "ATB",
      "Interrupt",
      "Immediate Turn"
    ]
  },
  {
    "id": "drama-047",
    "number": 47,
    "name": "SHARE THE WEALTH",
    "category": "Jackpot",
    "text": "Play at any time. Every PC draws 1 Drama Card from the shared deck.",
    "handling": "Each PC draws 1; reshuffle the discard pile if needed; discard this card afterward.",
    "tags": [
      "Shared Deck",
      "Group Draw"
    ]
  },
  {
    "id": "drama-048",
    "number": 48,
    "name": "MEXICAN STANDOFF",
    "category": "Social Change",
    "text": "An enemy of your enemy suddenly enters the scene. They are hostile to both sides, creating a three-way conflict.",
    "handling": "GM introduces the third faction, then discard.",
    "tags": [
      "New Faction",
      "Encounter Escalation"
    ]
  },
  {
    "id": "drama-049",
    "number": 49,
    "name": "FLAMMABLE",
    "category": "Deus Ex Machina",
    "text": "Play after a character takes projectile damage. They gain Burning at Intensity 5.",
    "handling": "Apply Burning 5, then discard.",
    "tags": [
      "Projectile",
      "Burning",
      "Intensity 5"
    ]
  },
  {
    "id": "drama-050",
    "number": 50,
    "name": "CONCENTRATION",
    "category": "Rule Breaker",
    "text": "Play before an Attribute Check. Add 4D12 to its dice pool.",
    "handling": "Add the dice to the Check, then discard.",
    "tags": [
      "Attribute Check",
      "Bonus Dice",
      "4D12"
    ]
  },
  {
    "id": "drama-051",
    "number": 51,
    "name": "POWERFLUX",
    "category": "Rule Breaker",
    "text": "Play before a ship operation creates or advances a Delay Timer, Delayed Resolution, or Queued Effect. Add +10 Speed to that operation's meter after all other modifiers.",
    "handling": "Apply +10 Speed to the selected operation, then discard.",
    "tags": [
      "Starship",
      "Operation Speed",
      "Delay"
    ]
  },
  {
    "id": "drama-052",
    "number": 52,
    "name": "REFLECT DAMAGE",
    "category": "Rule Breaker",
    "text": "Play after an enemy's attack would deal final damage to you. You take none of that damage. The attacker instead suffers half that amount, rounded up. This works in character or starship Combat.",
    "handling": "Redirect the damage, then discard.",
    "tags": [
      "Damage Reflection",
      "Character",
      "Starship"
    ]
  },
  {
    "id": "drama-053",
    "number": 53,
    "name": "WILD CARD",
    "category": "Fate",
    "text": "Play this card without knowing its effect. The GM immediately triggers a special event they prepared for WILD CARD.",
    "handling": "GM triggers the prepared event, then discard.",
    "tags": [
      "GM Event",
      "Unknown Effect"
    ]
  },
  {
    "id": "drama-054",
    "number": 54,
    "name": "WHAT DOESN’T KILL YOU",
    "category": "Jackpot",
    "text": "Play after your HP is reduced by damage. Permanently increase your Maximum HP by the final HP damage divided by 4, rounded down.",
    "handling": "Apply the permanent Maximum HP increase, then discard.",
    "tags": [
      "Maximum HP",
      "Permanent",
      "Damage"
    ]
  },
  {
    "id": "drama-055",
    "number": 55,
    "name": "GOOD ADVICE",
    "category": "Spotlight",
    "text": "Play before another PC makes an Attribute Check. That Check is automatically a Critical Success; no dice are rolled.",
    "handling": "Set the Check result, then discard.",
    "tags": [
      "Ally",
      "Attribute Check",
      "Critical Success"
    ]
  },
  {
    "id": "drama-056",
    "number": 56,
    "name": "DOUBLING SEASON",
    "category": "Rule Breaker",
    "text": "Play immediately after another player plays a Drama Card. Double its numeric effects or resolve its effect twice. The GM decides which interpretation is possible. DOUBLING SEASON cannot copy itself.",
    "handling": "Resolve against the previously played card, then discard both normally.",
    "tags": [
      "Drama Card",
      "Copy Effect"
    ]
  },
  {
    "id": "drama-057",
    "number": 57,
    "name": "FIRST SIGHT",
    "category": "Social Change",
    "text": "Play when you first meet an NPC. Your Charisma Checks involving that NPC are Critical Successes for as long as their fascination with you remains intact. Even an enemy may try to befriend you.",
    "handling": "Record the relationship effect, then discard.",
    "tags": [
      "NPC",
      "Charisma",
      "Persistent Relationship"
    ]
  },
  {
    "id": "drama-058",
    "number": 58,
    "name": "BEEN SAVING THIS FOR CLOSE ENCOUNTERS",
    "category": "Deus Ex Machina",
    "text": "Play at any time while you are carrying at least one weapon. Choose a standard weapon costing fewer than 5,000 Credits. Add it to your inventory as Received and make it your held weapon; you had it hidden all along.",
    "handling": "Add the weapon as Received, equip it, then discard.",
    "tags": [
      "Weapon",
      "Inventory",
      "Retroactive"
    ]
  },
  {
    "id": "drama-059",
    "number": 59,
    "name": "SPEAK FRIEND AND YOU MAY ENTER",
    "category": "Spotlight",
    "text": "Play when you must guess, bypass, or hack a password. You identify the correct password on your first attempt.",
    "handling": "Bypass the password, then discard.",
    "tags": [
      "Password",
      "Hacking",
      "Automatic Success"
    ]
  },
  {
    "id": "drama-060",
    "number": 60,
    "name": "FATE POINT",
    "category": "Spotlight",
    "text": "Play when your Combat turn begins. Resolve up to five consecutive actions before your ATB resets. Every Check during those actions is a Critical Success, and the GM allows a cinematic interpretation of physics. You cannot perform ship operations during this sequence.",
    "handling": "Track five actions, reset ATB after the fifth, then discard.",
    "tags": [
      "ATB",
      "Five Actions",
      "Critical Success",
      "Cinematic"
    ]
  },
  {
    "id": "drama-061",
    "number": 61,
    "name": "BANK ERROR IN YOUR FAVOR",
    "category": "Jackpot",
    "text": "Play after the GM sends your character a Credit award. Double that award before you claim it.",
    "handling": "Double the pending Credit reward, claim it, then discard.",
    "tags": [
      "Credits",
      "Reward Claim"
    ]
  },
  {
    "id": "drama-062",
    "number": 62,
    "name": "PHOENIX",
    "category": "Deus Ex Machina",
    "text": "Play on another character immediately after they reach 0 HP, before the next active turn begins. Restore that character to full HP.",
    "handling": "Cancel removal if needed, restore full HP, then discard.",
    "tags": [
      "Revive",
      "Full HP",
      "Another Character"
    ]
  },
  {
    "id": "drama-063",
    "number": 63,
    "name": "GO FISH",
    "category": "Rule Breaker",
    "text": "Deal 1 face-down Drama Card from the shared deck into a central pool for each PC. Each player may secretly add any number of cards from their hand. Shuffle the pool. Each player draws 1 card, plus the number of cards they contributed.",
    "handling": "Create a temporary shuffled pool; distribute every card as described; discard GO FISH afterward.",
    "tags": [
      "Shared Deck",
      "Hidden Contribution",
      "Redistribution"
    ]
  },
  {
    "id": "drama-064",
    "number": 64,
    "name": "FORGOTTEN PLANET",
    "category": "Fate",
    "text": "Play while traveling through space. The group discovers a planet previously known only through legend. The GM decides what is true about it and what happens next.",
    "handling": "GM introduces the planet, then discard.",
    "tags": [
      "Exploration",
      "Planet",
      "Campaign Event"
    ]
  },
  {
    "id": "drama-065",
    "number": 65,
    "name": "SCRY 3",
    "category": "Rule Breaker",
    "text": "Play at the beginning of a session. For the rest of that session, whenever a player would draw a Drama Card, they privately view the top 3 cards, keep 1, and place the other 2 on the bottom of the shared deck in either order.",
    "handling": "Place in Active Effects until session end, then discard. Reshuffle the discard pile first if fewer than 3 cards remain.",
    "tags": [
      "Shared Deck",
      "Scry",
      "Session Effect"
    ]
  },
  {
    "id": "drama-066",
    "number": 66,
    "name": "LIMIT BREAKER",
    "category": "Spotlight",
    "text": "Play after your HP falls below 1. Set your HP to 5 and your ATB to 100%. For your next five turns, double your ATB Speed and reset your ATB to 50% instead of 0% when your turn ends.",
    "handling": "Place in Active Effects with five uses, then discard.",
    "tags": [
      "Last Stand",
      "ATB Speed",
      "Five Turns"
    ]
  },
  {
    "id": "drama-067",
    "number": 67,
    "name": "LOG JITSU",
    "category": "Deus Ex Machina",
    "text": "Play when you die or your starship is destroyed. Reveal that the destruction was an elaborate illusion meant to lower the enemy's guard. If used on your character, reposition up to four times your Move Speed. If used on your starship, it reappears with 0 Shields. Explain how the illusion worked; the better the explanation, the more HP the GM restores.",
    "handling": "Cancel defeat, reposition, restore GM-determined HP, then discard.",
    "tags": [
      "False Death",
      "Reposition",
      "Starship",
      "GM Reward"
    ]
  },
  {
    "id": "drama-068",
    "number": 68,
    "name": "WHEEL OF FORTUNE",
    "category": "Fate",
    "text": "Play immediately when drawn. Each player chooses one: discard their entire hand and draw 7 Drama Cards, or opt out by discarding down to 1 card and drawing nothing.",
    "handling": "Resolve every player's choice; reshuffle the discard pile whenever the draw pile empties; discard WHEEL OF FORTUNE after resolution.",
    "tags": [
      "Mandatory",
      "Shared Deck",
      "Hand Reset"
    ]
  },
  {
    "id": "drama-069",
    "number": 69,
    "name": "SALVAGE",
    "category": "Jackpot",
    "text": "Play after winning a starship battle. Choose up to three undamaged SICs from the defeated enemy starship and add them to the group's salvage inventory. They may be installed when normal ship-building rules allow.",
    "handling": "Transfer up to three eligible SICs to group salvage, then discard.",
    "tags": [
      "Starship",
      "SIC",
      "Salvage",
      "Group Inventory"
    ]
  },
  {
    "id": "drama-070",
    "number": 70,
    "name": "VISION",
    "category": "Deus Ex Machina",
    "text": "Rewind the story by 2 in-game hours. Only your character remembers the erased events. Work with the GM to explain the vision, prediction, or time anomaly. After the rewind is established, discard your entire Drama Card hand.",
    "handling": "Resolve the rewind, discard the player's entire hand including this card, and place all discarded cards in the discard pile.",
    "tags": [
      "Time Rewind",
      "Memory",
      "Discard Hand"
    ]
  },
  {
    "id": "drama-071",
    "number": 71,
    "name": "MASSIVE PLOT TWIST",
    "category": "Deus Ex Machina",
    "text": "Declare one specific change to the current situation. It becomes true, and the GM must explain how the story adapts. Discard your entire Drama Card hand, then remove MASSIVE PLOT TWIST from the campaign's deck permanently.",
    "handling": "Discard the rest of the hand; move this card to Removed From Campaign, not the discard pile.",
    "tags": [
      "Narrative Authority",
      "Discard Hand",
      "Remove Permanently"
    ]
  },
  {
    "id": "drama-072",
    "number": 72,
    "name": "JACKPOT",
    "category": "Jackpot",
    "text": "Play before the group's next Mineral Quantity roll. Roll 1D4 instead of percentile dice, then add +1 to the final Mineral quantity.",
    "handling": "Place in Active Effects until the next Mineral Quantity roll, then discard.",
    "tags": [
      "Minerals",
      "Quantity",
      "1D4"
    ]
  }
].map((card) => Object.freeze(card)));
  return Object.freeze({ DRAMA_CARD_COST, DRAMA_CARD_HAND_LIMIT, DRAMA_CARDS });
});
