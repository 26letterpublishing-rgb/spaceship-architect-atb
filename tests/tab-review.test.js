const test=require('node:test'),assert=require('node:assert/strict');
test('Everything migrates once, stays inactive and cannot acquire custom pricing',()=>{
 const shops=require('../campaign-shops'),c={};let s=shops.state(c).list[0];assert.equal(s.name,'Everything');assert.equal(s.active,false);shops.state(c);assert.equal(c.shops.list.length,1);
 assert.throws(()=>shops.manage(c,{operation:'save',shop:{...s,modifier:-100}}),/standard prices/);
 shops.manage(c,{operation:'activate',shopId:s.id,active:true});assert.equal(shops.offers(c).length,shops.catalog.length);for(const offer of shops.offers(c))assert.equal(offer.price,shops.byId.get(offer.id).basePrice);
 const saved=JSON.parse(JSON.stringify(c));assert.equal(shops.state(saved).list[0].active,true);
});
test('attached story appends tabs and renames conflicting keywords without changing old commands',()=>{
 const files=require('../story-files'),c={scriptChapters:[{id:'old',name:'Old',script:'::Keyword:Cache::'}],conditionalActions:[{id:'a',keyword:'Cache'}]},file={format:'sa2story',version:1,chapters:[{id:'old',name:'New',script:'::Keyword:Cache::'}],actions:[{id:'a',keyword:'Cache'}]};let n=0;
 const next=files.append(c,file,()=>String(++n));assert.equal(next.chapters[0].script,c.scriptChapters[0].script);assert.equal(next.chapters[1].script,'::Keyword:Cache 2::');assert.equal(next.actions[1].keyword,'Cache 2');assert.notEqual(next.chapters[0].id,next.chapters[1].id);assert.equal(c.scriptChapters.length,1);
});
test('location attachments survive normalization and never enter player projection',()=>{
 const planets=require('../campaign-planets'),world=planets.normalizeWorld({hexes:{'2':{label:'Secret ally',attachments:{npc:{format:'sa2roster',version:1,characters:[],npcs:[{name:'Scout'}]}}}},regions:{}},'seed');assert.equal(world.hexes['2'].attachments.npc.npcs[0].allyNpc,true);
 const s={maps:[{stars:[{system:[{id:'p',kind:'planet'}],surfaces:{p:world}}]}]};planets.project(s,false);assert.equal(world.hexes['2'].attachments,undefined);
 assert.throws(()=>require('../planet-attachments').normalize({encounter:{format:'bad'}}));
});
test('attribute statistics exclude bonuses and receipt retries',()=>{
 const stats=require('../character-statistics'),c={};stats.roll(c,'Engineering',22,'r1','intellect',14);stats.roll(c,'Engineering',22,'r1','intellect',14);stats.roll(c,'Engineering',18,'r2','intellect',10);
 assert.deepEqual(c.statistics.attributes.intellect,{count:2,total:24});assert.deepEqual(c.statistics.skills.Engineering,{count:2,total:40});
});
test('walking retains its final facing at arrival',()=>{
 const walk=require('../ship-walking'),job={startedAt:0,columns:20,steps:[{from:{square:0,mesh:4},to:{square:0,mesh:5},begin:0,end:100}],destination:{square:0,mesh:5}};
 assert.equal(walk.sample(job,50).heading,90);assert.equal(walk.sample(job,100).heading,90);
 const r={ship:{},characterLocations:{pc:{}},characterWalks:{pc:job}};walk.advance(r,100);assert.equal(r.characterLocations.pc.heading,90);
});

test('appended stories isolate case-insensitive keywords and existing shop commands',()=>{
 const files=require('../story-files'),c={scriptChapters:[{id:'old',script:'::Keyword:CACHE:: ::Shop:store::'}],conditionalActions:[{id:'old',keyword:'Cache'}],shops:{list:[{id:'store',name:'Supplies',modifier:25}]}},file={format:'sa2story',version:1,chapters:[{id:'new',script:'::Keyword:cache:: then ::Keyword:cache:: ::Shop:store::'}],actions:[{keyword:'cache'}],shops:[{id:'store',name:'Supplies',modifier:0}]};let id=0;const result=files.append(c,file,()=>String(++id));assert.match(result.chapters[1].script,/::Keyword:cache 2:: then ::Keyword:cache 2::/);assert.ok(!result.chapters[1].script.includes('::Shop:store::'));assert.equal(c.shops.list[0].modifier,25);assert.equal(result.chapters[0].script,c.scriptChapters[0].script);
});
