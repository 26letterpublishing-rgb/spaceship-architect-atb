const test=require('node:test'),assert=require('node:assert/strict'),policy=require('../ship-automation'),sensors=require('../ship-sensors'),maps=require('../ship-map-core'),E=require('../combat-engine');
function fixture(){
 const a=require('../showcase-starters')('own','pc'),b=require('../showcase-starters')('hidden','gm');
 const u={id:'crew',team:'npc',allyNpc:true,currentHp:30,automationMode:'npc',location:policy.seats(a).find(s=>s.bridge)};E.migrateUnitCombat(u);
 const room={starships:[a,b],units:[u],shipPositions:[{id:a.id,q:0,r:0},{id:b.id,q:25,r:0}],spaceObjects:[],activeId:u.id};return {room,a,b,u};
}
test('one new-position scan then a valid bounded search, no hidden position dependence',()=>{
 const {room,a,b,u}=fixture();assert.equal(policy.candidates(room,u)[0].kind,'area');
 sensors.knowledge(a).lastScan={origin:{q:0,r:0},range:sensors.installed(a).range,found:0,serial:1};
 const before=policy.candidates(room,u);assert.equal(before[0].kind,'moveStarship');assert.ok(require('../ship-distances').hexDistance({q:0,r:0},before[0].destination)<=4,'search must not introduce long-leg drift');
 room.shipPositions[1]={id:b.id,q:-999,r:777};b.controlType='pc';assert.deepEqual(policy.candidates(room,u),before);
 assert.equal(require('../ship-navigation').queue(room,u,before[0]).ok,true);policy.acceptedSearch(room,u,before[0]);assert.deepEqual(policy.candidates(room,u),[]);
});
test('search budget survives reload and does not restart on repeated evaluation or automation toggles',()=>{
 const {room,a,u}=fixture();sensors.knowledge(a).lastScan={origin:{q:0,r:0},range:sensors.installed(a).range,found:0};sensors.knowledge(a).automationSearch={origin:{q:0,r:0},legs:6};
 for(let i=0;i<3;i++){assert.deepEqual(policy.candidates(room,u),[]);assert.match(u.automationSearchReason,/Search completed/);u.automationMode=i%2?'off':'npc';}
 const restored=JSON.parse(JSON.stringify(room));assert.deepEqual(policy.candidates(restored,restored.units[0]),[]);
 restored.encounterId='new-battle';assert.equal(policy.candidates(restored,restored.units[0])[0].kind,'area','a genuinely new encounter must not inherit an exhausted search');
});
test('unknown position is investigated without treating it as an attack target',()=>{
 const {room,a,u}=fixture();const k=sensors.knowledge(a);k.lastScan={origin:{q:0,r:0},range:sensors.installed(a).range,found:0};k.contacts.mystery={id:'unknown-public',level:'unknown',position:{q:8,r:2},uncertainty:0};
 const order=policy.candidates(room,u)[0];assert.equal(order.kind,'hex');assert.deepEqual(order.hex,{q:8,r:2});assert.equal(order.targetId,undefined);policy.acceptedSearch(room,u,order);
 assert.equal(policy.candidates(room,u)[0].kind,'moveStarship');
 k.contacts.mystery.uncertainty=10;k.automationSearch.hexScan='';assert.equal(policy.candidates(room,u)[0].kind,'moveStarship','broad uncertain areas must not trigger endless single-hex scans');
 k.automationSearch.legs=12;assert.deepEqual(policy.candidates(room,u),[]);assert.match(u.automationSearchReason,/exhausted/);
});
test('unpowered ship waits explicitly; changing sensor capability permits a new scan',()=>{
 const {room,a,u}=fixture();const k=sensors.knowledge(a);k.lastScan={origin:{q:0,r:0},range:sensors.installed(a).range,found:0};
 for(const item of maps.installedItems(a))if(maps.definition(item.type).thruster)item.disabled=true;
 assert.deepEqual(policy.candidates(room,u),[]);assert.match(u.automationSearchReason,/operational pilot/);
 k.lastScan.range=1;assert.equal(policy.candidates(room,u)[0].kind,'area');
});
test('pending crew movement prevents duplicate orders and bounded empty arena search',()=>{
 const {room,a,u}=fixture();room.starships=[a];const k=sensors.knowledge(a);k.lastScan={origin:{q:0,r:0},range:sensors.installed(a).range,found:0};
 room.units.push({id:'other',delayedAction:{shipOrder:{shipId:a.id}}});assert.deepEqual(policy.candidates(room,u),[]);room.units.pop();
 for(let i=0;i<6;i++){const c=policy.candidates(room,u)[0];assert.equal(c.kind,'moveStarship');policy.acceptedSearch(room,u,c);}assert.deepEqual(policy.candidates(room,u),[]);
});
