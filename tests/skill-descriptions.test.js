const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,name),'utf8')).toString('base64'));
test('every standard character skill has a description and First Aid retains its source attribute',async()=>{
  const {GENERAL_SKILLS,SPACECRAFT_SKILLS}=await load('character-data.js');
  const {SKILL_DESCRIPTIONS}=await load('skill-descriptions.js');
  for(const name of [...GENERAL_SKILLS,...SPACECRAFT_SKILLS])assert.ok(SKILL_DESCRIPTIONS[name]?.length>20,`Missing ${name}`);
  assert.match(SKILL_DESCRIPTIONS['Anatomy/First Aid'],/Intellect/);
  assert.match(SKILL_DESCRIPTIONS.Initiative,/ATB/);
});
test('race text no longer contains the identified PDF split-word artifacts',()=>{
  const source=fs.readFileSync(path.join(root,'race-lore-data.js'),'utf8');
  assert.doesNotMatch(source,/artif icial|conf lict|dif ficult|offeeling|scientif fic|Weather or not/);
});
