const test=require('node:test'),assert=require('node:assert/strict'),catalog=require('../skill-catalog');
test('legacy saves preserve ratings, decimals, roll references, statistics and custom names',()=>{
 const old={identity:{characterName:'Pilot/Helm'},skills:{'Pilot/Helm':{tenths:27,creationDecimal:7},'Dodge/Block':{tenths:34,creationDecimal:4}},creation:{finalizationQueue:['base:Pilot/Helm'],skillPurchaseOrder:[{key:'base:Dodge/Block',cost:3}]},pendingRoll:{skillKey:'base:Pilot/Helm'},statistics:{skills:{'Dodge/Block':{count:3,total:40}}},customSkills:[{name:'Pilot/Helm',tenths:13}],skill:'Dodge/Block'};
 const migrated=catalog.migrate(old);assert.deepEqual(migrated.skills.Piloting,{tenths:27,creationDecimal:7});assert.equal(migrated.skills.Dodge.tenths,34);assert.equal(migrated.creation.finalizationQueue[0],'base:Piloting');assert.equal(migrated.creation.skillPurchaseOrder[0].key,'base:Dodge');assert.equal(migrated.pendingRoll.skillKey,'base:Piloting');assert.equal(migrated.statistics.skills.Dodge.count,3);assert.equal(migrated.skill,'Dodge');assert.equal(migrated.identity.characterName,'Pilot/Helm');assert.equal(migrated.customSkills[0].name,'Pilot/Helm');assert.ok(old.skills['Pilot/Helm']);assert.deepEqual(catalog.migrate(migrated),migrated);
});
test('all approved names exist once and canonical values win on mixed saves',()=>{
 for(const [old,name] of Object.entries(catalog.aliases)){assert.ok(catalog.names.includes(name),name);assert.ok(!catalog.names.includes(old),old);}
 assert.equal(catalog.names.length,new Set(catalog.names).size);assert.deepEqual(catalog.migrate({skills:{'Dodge/Block':2,Dodge:3}}),{skills:{Dodge:3}});
});

test('Grappling weapons retain automatic melee resolution for new and legacy saves',()=>{
 const rules=require('../combat-rules');
 for(const skill of ['Grappling','Wrestle/Disarm']){
  const plan=rules.attackPlan({toHit:'Dexterity + '+skill+' - 2',damage:'1D6',range:'1'},{attackType:'melee',distance:1});
  assert.equal(plan.attackSkill,'Grappling');assert.equal(plan.manualToHit,false);assert.equal(plan.printedModifier,-2);
 }
});
