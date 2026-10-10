(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SASkillCatalog=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
const attributes = Object.freeze({
  "Computer Systems":"intellect", "Engineering":"intellect", "Hacking":"intellect", "Piloting":"dexterity", "Sensor Systems":"perception", "Weapon Systems":"dexterity",
  "Deception": "charisma",
  "First Aid": "intellect",
  "Architecture": "intellect",
  "Arts": "charisma",
  "Astronomy": "intellect",
  "Athletics": "health",
  "Awareness": "perception",
  "Escape": "strength",
  "Caretaking": "charisma",
  "Coordination": "dexterity",
  "Climb": "strength",
  "Common Knowledge": "intellect",
  "Cooking": "intellect",
  "Demolitions": "intellect",
  "Impersonation": "charisma",
  "Dodge": "dexterity",
  "Driving": "dexterity",
  "Etiquette": "charisma",
  "Forgotten Languages": "intellect",
  "Gambling": "luck",
  "Lore": "intellect",
  "Taste & Smell": "perception",
  "Initiative": "intellect",
  "Intimidation": "charisma",
  "Insight": "perception",
  "Jump": "strength",
  "Politics": "intellect",
  "Leadership": "charisma",
  "Brute Force": "strength",
  "Lock-picking": "dexterity",
  "Mathematics": "intellect",
  "Melee": "strength",
  "Navigate": "perception",
  "Persuasion": "charisma",
  "Occult": "intellect",
  "Pickpocket": "dexterity",
  "Projectile": "dexterity",
  "Psychology": "intellect",
  "Religion": "intellect",
  "Research": "intellect",
  "Resist Distress": "willpower",
  "Science": "intellect",
  "Self-Control": "willpower",
  "Showmanship": "charisma",
  "Stealth": "dexterity",
  "Survival": "perception",
  "Swim": "strength",
  "Tame Animal": "charisma",
  "Teaching": "charisma",
  "Technology": "intellect",
  "Vehicle Mechanics": "intellect",
  "Weapon Mechanics": "intellect",
  "Grappling": "strength",
  "Writing": "intellect",
});
const aliases=Object.freeze({"Acting/Lie": "Deception", "Anatomy/First Aid": "First Aid", "Athletics/Endurance": "Athletics", "Art/Music": "Arts", "Break Free/Escape": "Escape", "Caretaking/Nurture": "Caretaking", "Catch/Throw": "Coordination", "Disguise/Mimic": "Impersonation", "Dodge/Block": "Dodge", "Drive/Small Vehicle": "Driving", "Fashion/Etiquette": "Etiquette", "History/Lore": "Lore", "Identify Taste/Smell": "Taste & Smell", "Intimidate/Taunt": "Intimidation", "Intuition/Empathy": "Insight", "Law/Politics": "Politics", "Lift/Push/Pull": "Brute Force", "Negotiation/Persuade": "Persuasion", "Pilot/Helm": "Piloting", "Science/Physics": "Science", "Stealth/Hide": "Stealth", "Survival/Tracking": "Survival", "Wrestle/Disarm": "Grappling"});
function canonical(name){return aliases[name]||name;}
// Rewrite only skill-shaped records/references; preserve player-authored identity and prose.
function migrate(value,field=''){
  if(typeof value==='string'){
    if(value.startsWith('base:'))return 'base:'+canonical(value.slice(5));
    return ['skill','skillName','skillId','raceSkillChoice','classSkillChoice','skillChoices'].includes(field)?canonical(value):value;
  }
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(item=>migrate(item,field));
  const out={};
  for(const [key,item]of Object.entries(value)){
    const next=canonical(key);
    // A canonical entry is authoritative if both formats occur in a partially migrated save.
    if(next!==key&&Object.prototype.hasOwnProperty.call(value,next))continue;
    out[next]=migrate(item,key);
  }
  return out;
}
const groups=Object.freeze(['strength','health','perception','dexterity','luck','charisma','intellect','willpower'].map(key=>({key,label:key[0].toUpperCase()+key.slice(1)})));
return Object.freeze({aliases,canonical,migrate,attributes,groups,names:Object.freeze(Object.keys(attributes))});
}));
