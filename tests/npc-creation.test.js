const test=require('node:test'),assert=require('node:assert/strict');
const stats=require('../npc-statistics'),art=require('../token-art'),engine=require('../combat-engine'),arena=require('../arena-files');
test('NPC creation uses existing Attribute dice progression and character-derived defaults',()=>{
  assert.deepEqual(stats.attributeDice(2),[4,4]);assert.deepEqual(stats.attributeDice(8),[6,6,6,6]);assert.deepEqual(stats.attributeDice(9),[8,6,6,6]);assert.deepEqual(stats.attributeDice(20),[12,12,12,12]);
  assert.deepEqual(stats.derived({physicalAttribute:9,physicalSkill:3,mentalAttribute:6,mentalSkill:2}),{speed:8,moveSpeed:5,maximumHp:46});
  assert.deepEqual(stats.derived({physicalAttribute:14,physicalSkill:2.5,mentalAttribute:12,mentalSkill:1.5}),{speed:13.5,moveSpeed:6.5,maximumHp:56});
});
test('manual overrides are independent and survive subsequent Attribute changes and reload',()=>{
  let npc=stats.calculate({physicalAttribute:8,physicalSkill:2,mentalAttribute:6,mentalSkill:1,statOverrides:{}});
  npc.maximumHp=99;stats.edit(npc,'maximumHp');npc.physicalAttribute=16;stats.edit(npc,'physicalAttribute');npc.mentalSkill=3;stats.edit(npc,'mentalSkill');
  assert.equal(npc.maximumHp,99);assert.equal(npc.speed,9);assert.equal(npc.moveSpeed,8);
  npc=stats.calculate(JSON.parse(JSON.stringify(npc)));assert.equal(npc.maximumHp,99);
  stats.calculate(npc,true);assert.equal(npc.maximumHp,60);assert.equal(npc.statOverrides.maximumHp,undefined);
});
test('existing presets keep deliberately configured stats until Recalculate',()=>{
  const npc={physicalAttribute:8,physicalSkill:2,mentalAttribute:6,mentalSkill:1,speed:5,moveSpeed:3,maximumHp:36};
  stats.calculate(npc);npc.physicalAttribute=9;stats.edit(npc,'physicalAttribute');assert.equal(npc.speed,5);assert.equal(npc.maximumHp,36);assert.equal(npc.moveSpeed,3);
  stats.calculate(npc,true);assert.equal(npc.maximumHp,46);assert.equal(npc.speed,7);assert.equal(npc.moveSpeed,4);
});
test('all token appearances are available to NPCs without granting a race or changing PC disguise rules',()=>{
  for(const iconRace of art.allRaces)for(const iconVariant of [0,1]){const npc={team:'npc',iconRace,iconVariant};assert.deepEqual(art.character(npc),{race:iconRace,variant:iconVariant});assert(art.figure(iconRace,iconVariant).includes('crew-atlas-'+iconRace));assert.equal(npc.raceId,undefined);}
  assert.equal(art.character({raceId:'human',iconRace:'bruggle'}).race,'human');assert.equal(art.character({raceId:'draco-prime',iconRace:'spiddix'}).race,'draco-prime');assert.equal(art.character({team:'npc',iconRace:'bad'}).race,'');
});
test('NPC icons and calculation overrides survive arena export and combat normalization',()=>{
  const npc={id:'guard',name:'Guard',team:'npc',iconRace:'yuhorn-symitron-lava',iconVariant:1,speed:8,moveSpeed:5,maximumHp:80,physicalAttribute:9,mentalAttribute:6,physicalSkill:3,mentalSkill:2,statOverrides:{maximumHp:true}};
  const file=arena.parse(arena.create({mode:'surface',arena:{width:3,height:3,floors:[0,1,2]},npcs:[npc]}));
  assert.equal(file.npcs[0].iconRace,npc.iconRace);assert.equal(file.npcs[0].iconVariant,1);assert.deepEqual(file.npcs[0].statOverrides,npc.statOverrides);
  const unit={...npc};engine.migrateUnitCombat(unit);assert.equal(art.character(unit).race,npc.iconRace);assert.equal(unit.maximumHp,80);assert.equal(unit.statOverrides.maximumHp,true);assert.equal(unit.raceId,'');
});
test('NPC template saves and roster imports preserve icons, manual values and automatic field choices',async()=>{
  const {CampaignApi}=require('../campaign-api'),records=new Map(),api=new CampaignApi({store:{get:async k=>structuredClone(records.get(k)||null),create:async c=>{records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]}});
  async function call(path,body,status=200){let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,s,v)=>{assert.equal(s,status,JSON.stringify(v));result=v;});return result;}
  const room=await call('v03/create',{name:'NPC QA'},201),auth={code:room.campaign.code,token:room.token};
  const npc={id:'custom',name:'Guard',...stats.calculate({physicalAttribute:9,physicalSkill:3,mentalAttribute:6,mentalSkill:2,statOverrides:{}}),maximumHp:91,statOverrides:{maximumHp:true},iconRace:'spiddix',iconVariant:1,allyNpc:true};
  const saved=await call('npc-templates',{...auth,templates:[npc]});assert.equal(saved.campaign.npcTemplates[0].maximumHp,91);assert.equal(saved.campaign.npcTemplates[0].statOverrides.speed,false);assert.equal(saved.campaign.npcRoster[0].iconRace,'spiddix');
  const loaded=await call('content/load',{...auth,file:{format:'sa2roster',version:1,characters:[],npcs:saved.campaign.npcTemplates}});const imported=loaded.campaign.npcTemplates.find(n=>n.id!==npc.id);assert.equal(imported.iconRace,'spiddix');assert.equal(imported.iconVariant,1);assert.equal(imported.maximumHp,91);assert.equal(imported.statOverrides.speed,false);
  const pc=await call('v03/join',{code:auth.code,name:'PC'});await call('npc-templates',{code:auth.code,token:pc.token,templates:[]},403);
});
