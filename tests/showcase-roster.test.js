const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const roster=require('../data/showcase-roster.json'),art=require('../token-art');
test('approved Explore PCs retain legal creation receipts, racial resources and purchased equipment',()=>{
 assert.deepEqual(roster.pcs.map(c=>[c.identity.characterName,c.identity.raceId,c.presentation.iconVariant]),[['Mara Venn','human',0],['Kip Amber','kabuto',1]]);
 for(const c of roster.pcs){assert.equal(c.phase,'finalized');assert.equal(c.creation.manualInput,false);assert.equal(c.creation.validation.attributeSpent,195);assert.equal(c.creation.validation.skillSpent,c.creation.validation.skillBudget);assert.equal(c.creation.skillPurchaseOrder.reduce((n,p)=>n+p.cost,0),c.creation.validation.skillSpent);assert.equal(c.health.current,c.computed.maximumHp);assert.equal(c.resources.exertionCurrent,c.resources.exertionMax);assert.ok(c.creation.raceGrantsApplied);assert.ok(c.weapons.every(w=>w.weaponId==='standard-sidearm'));for(const skill of Object.values(c.skills))if(skill.tenths)assert.ok(Number.isInteger(skill.creationDecimal)&&skill.creationDecimal>=0&&skill.creationDecimal<=9);}
 assert.equal(roster.pcs[0].experience.totalGained,200);assert.equal(roster.pcs[0].resources.creditsBase,300);
 const kip=roster.pcs[1];assert.equal(kip.computed.defenseScoreModifier,3);assert.equal(kip.computed.moveSpeed,4);assert.equal(kip.computed.maximumHp,18);assert.equal(kip.resources.creditsBase,265);assert.equal(kip.items[0].catalogId,'first-aid-kit');assert.equal(kip.items[0].quantity,1);
});

const templates=require('../data/npc-templates.json'),statistics=require('../npc-statistics');
test('canonical eight enemy samples use current derived statistics and three strength tiers',()=>{
 assert.deepEqual(templates.map(n=>n.name),['Clatter','Rivet','Voss Undertow','Kettle-9','Afterimage','Basalt','Lumen','Morrow']);
 assert.deepEqual(['weak','average','boss'].map(t=>templates.filter(n=>n.tier===t).length),[3,3,2]);
 assert.deepEqual(templates.map(n=>[n.name,n.maximumHp,n.speed,n.moveSpeed]),[['Clatter',40,5,4],['Rivet',28,2,2],['Voss Undertow',38,8,4],['Kettle-9',40,8,4],['Afterimage',48,12,5],['Basalt',52,10,5],['Lumen',36,4,2],['Morrow',32,2,3]]);
 for(const n of templates){assert.ok(art.validIcon(n.iconRace));assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',art.atlas(n.iconRace))));assert.equal(n.iconVariant,0);assert.equal(n.allyNpc,false);assert.ok(n.physicalSkill<=4&&n.mentalSkill<=4);for(const [key,value] of Object.entries(statistics.derived(n)))assert.equal(n[key],value);}
 assert.deepEqual(roster.npcs.map(n=>n.id),templates.map(n=>n.id));assert.ok(roster.npcs.every(n=>Object.keys(n).every(k=>['id','shipSide'].includes(k))));
});

test('fresh Explore uses canonical enemies without duplicate saved templates or allied crew',async()=>{
 const {CampaignApi}=require('../campaign-api');const before=JSON.stringify(roster);const api=new CampaignApi({store:{get:async()=>null}});let response;
 await api.handle({method:'POST'},{},new URL('http://test/api/campaign/showcase/start'),async()=>({}),(_,status,payload)=>{response={status,payload}});
 assert.equal(response.status,200);const c=api.showcases.get(response.payload.code).campaign;
 assert.equal(c.npcRoster.length,8);assert.deepEqual(c.npcTemplates,[]);assert.deepEqual(c.characters.map(r=>r.character.identity.characterName),['Mara Venn','Kip Amber']);
 const encounter=api.showcases.get(response.payload.code).encounterTemplate;assert.equal(encounter.units.filter(u=>u.team==='npc').length,1);
 for(const n of c.npcRoster){assert.equal(n.team,'npc');assert.equal(n.allyNpc,false);assert.equal(n.exertionMax,Math.ceil(n.mentalAttribute/2)+1);assert.equal(n.exertionCurrent,n.exertionMax);const expected=templates.find(v=>v.id===n.templateId);assert.equal(n.iconRace,expected.iconRace);assert.equal(Boolean(n.location.starshipId),n.templateId==='showcase-kettle');}
 const own=c.starships.find(s=>s.controlType==='pc'),enemy=c.starships.find(s=>s.controlType==='gm');assert.deepEqual(own.crewNpcUnitIds,[]);assert.deepEqual(enemy.crewNpcUnitIds,['unit-showcase-kettle']);
 assert.equal(new Set(encounter.units.filter(u=>u.location.starshipId===own.id).map(u=>u.location.square)).size,2);assert.equal(JSON.stringify(roster),before);
 const credentials=response.payload,custom={...templates[0],id:'custom-kept',name:'My custom NPC',allyNpc:true};
 const save=async token=>{let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/npc-templates'),async()=>({code:credentials.code,token,templates:[custom]}),(_,status,payload)=>{result={status,payload}});return result;};
 assert.equal((await save(credentials.players[0].token)).status,403);
 assert.equal((await save(credentials.gmToken)).status,200);
 assert.equal(c.npcTemplates[0].name,'My custom NPC');assert.equal(c.npcTemplates[0].allyNpc,true);
 // Creating another disposable room must not migrate or replace the first room's custom records.
 await api.handle({method:'POST'},{},new URL('http://test/api/campaign/showcase/start'),async()=>({}),()=>{});
 assert.equal(c.npcTemplates[0].id,'custom-kept');assert.equal(JSON.stringify(roster),before);
});
