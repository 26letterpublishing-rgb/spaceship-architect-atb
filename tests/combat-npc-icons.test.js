const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),catalog=require('../data/npc-templates.json'),art=require('../token-art');
function catalogLoader(fetch){const context={fetch,applyNpcDefaultPreview(){},npcDefaultBag:[]};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let npcDefaults = []'),source.indexOf('function safeLocalStorageSet'))+';this.load=loadNpcDefaults;',context);return context;}
const start=source.indexOf('  try {const result=await action({',source.indexOf('gmAddUnit.addEventListener'));
const body=source.slice(start+'  try {const result=await action('.length,source.indexOf("},'tap'",start)+1);
function payload(template,team='npc'){
 const field=value=>({value}),context={npcTemplate:template,savedNpc:template,usingNpcDefault:team==='npc',gmTeam:field(team),gmPlayerName:field('GM'),gmCharacterName:field(template?.name||template?.characterName||'Custom'),gmSpeedRating:field(5),gmCommandWindow:field(30),gmColor:field('#39e58f'),combatShip:null,firstSquare:0};
 return vm.runInNewContext('('+body+')',context);
}
test('Combat quick defaults use precisely the existing canonical NPC atlas mappings',async()=>{
 const requests=[],loader=catalogLoader(async url=>{requests.push(url);return{ok:true,json:async()=>structuredClone(catalog)}});const defaults=await loader.load();assert.deepEqual(requests,['data/npc-templates.json']);assert.equal(defaults.length,8);await loader.load();assert.equal(requests.length,1);
 for(const npc of defaults){const canonical=catalog.find(n=>n.name===npc.characterName);assert.ok(canonical);assert.equal(npc.iconRace,canonical.iconRace);assert.equal(npc.iconVariant,canonical.iconVariant);assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',art.atlas(npc.iconRace))));const sent=payload(npc);assert.equal(sent.iconRace,canonical.iconRace);for(const field of ['maximumHp','moveSpeed','physicalAttribute','mentalAttribute','physicalSkill','mentalSkill','allyNpc'])assert.equal(sent[field],canonical[field]);assert.equal(sent.weapons[0].weaponId,canonical.heldWeaponId);}
});
test('Add Unit preserves explicit saved icon and variant without changing unrelated stats',()=>{
 const saved={name:'Custom NPC',iconRace:'human',iconVariant:1,maximumHp:43,moveSpeed:7,heldWeaponId:'unarmed'};
 const sent=payload(saved);assert.equal(sent.iconRace,'human');assert.equal(sent.iconVariant,1);assert.equal(sent.maximumHp,43);assert.equal(sent.moveSpeed,7);
 assert.equal(payload({name:'Unknown custom'}).iconRace,undefined);assert.equal(payload(saved,'pc').iconRace,undefined);
});

test('sample loading coalesces requests and failed loads remain retryable',async()=>{
 let calls=0,release;const loader=catalogLoader(()=>{calls++;return new Promise(resolve=>{release=resolve;});});
 const first=loader.load(),second=loader.load();assert.equal(first,second);assert.equal(calls,1);release({ok:false});await assert.rejects(first,/could not be loaded/);
 const retry=loader.load();assert.equal(calls,2);release({ok:true,json:async()=>catalog});assert.equal((await retry).length,8);
});
