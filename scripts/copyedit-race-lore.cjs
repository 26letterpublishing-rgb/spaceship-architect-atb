// Exact transcription repairs only; never normalize lore names or mechanics.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, '..', 'race-lore-data.js');
const replacements = {
  'artif icial':'artificial', 'Artif icial':'Artificial', 'Specif ic':'Specific',
  'conf lict':'conflict', 'clarif ication':'clarification', 'signif icant':'significant',
  'scientif ic':'scientific', 'dif ferent':'different', 'ef forts':'efforts',
  'Color and patters offur varies greatly.':'Colors and patterns of fur vary greatly.',
  'a baron wasteland':'a barren wasteland', 'Weather or not':'Whether or not',
  'bazaar laws':'bizarre laws', 'dear-headed':'deer-headed', 'view the them':'view them',
  'magnif icent':'magnificent', 'prof it':'profit', 'dif ficult':'difficult',
  'ef ficiency':'efficiency', 'scientif fic':'scientific', 'inf luenced':'influenced',
  'inf iltrated':'infiltrated', 'ref lective':'reflective', 'unverif ied':'unverified',
  'ef fects':'effects', 'af fected':'affected', 'swordf ights':'swordfights',
  'benef it':'benefit', 'camouf lage':'camouflage', 'af fairs':'affairs',
  'zombif ied':'zombified', 'conf irm':'confirm', 'ref ined':'refined', 'Mastif f':'Mastiff',
  'offeeling':'of feeling', 'offew':'of few', 'offive':'of five', 'offlight':'of flight',
  'offrog':'of frog', 'offunctionality':'of functionality', 'offof':'off of',
};
let text = fs.readFileSync(file, 'utf8'), changed = 0;
for (const [from, to] of Object.entries(replacements)) {
  const count = text.split(from).length - 1;
  if (count) { text = text.split(from).join(to); changed += count; }
}
if (changed) fs.writeFileSync(file, text);
console.log(`${changed} exact lore transcription repairs.`);
