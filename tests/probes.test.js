const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),probes=require('../ship-probes'),targets=require('../ship-targets'),sensors=require('../ship-sensors'),power=require('../ship-power'),stations=require('../station-access');
function fixture(){
 const f=require('./helpers/crew-room-fixture.cjs')(),s=f.ship.ship;
 s.sicInventory.push({id:'launcher',type:'probe-launcher'},{id:'sensors',type:'sensors-3'},...Array.from({length:4},(_,i)=>({id:'probe'+i,type:'probe-'+(i+1),attachTo:'launcher'})));
 s.placements.push({sicId:'launcher',cell:33},{sicId:'sensors',cell:111},...Array.from({length:4},(_,i)=>({sicId:'probe'+i,cell:33})));
 f.room.shipPositions=[{id:f.ship.id,q:0,r:0}];f.seat('bridge');power.refresh(f.room,{reset:true});probes.reconcile(f.room);return f;
}
function order(f,kind='launch',extra={}){return {sicId:'launcher',kind,probeId:f.ship.ship.probeState.probes.probe0.id,destination:{q:4,r:0},receipt:'probe-test-'+Math.random().toString(36).slice(2),...extra};}
function payloadFixture(){
 const f=fixture(),s=f.ship.ship;for(const type of ['shield-breacher','hacking-bug','warp-bubble-inhibitor']){s.sicInventory.push({id:type,type,attachTo:'probe0'});s.placements.push({sicId:type,cell:33});}
 s.sicInventory.find(i=>i.id==='engine').type='en-au-engine-6';power.refresh(f.room,{reset:true});
 f.enemy={id:'target',title:'Target',currentHullHp:100,currentShieldHp:20,ship:{gridCells:[42],sicInventory:[{id:'target-life',type:'life-support'}],placements:[{sicId:'target-life',cell:42}]}};
 f.room.starships.push(f.enemy);f.room.shipPositions.push({id:'target',q:4,r:0});sensors.detect(f.room,f.ship,f.enemy);
 f.p=s.probeState.probes.probe0;f.p.phase='holding';f.p.position={q:4,r:0};probes.reconcile(f.room);
 f.run=(kind,extra={})=>{const r=probes.command(f.room,f.unit,order(f,kind,{targetId:'target',...extra}));assert.equal(r.ok,true,r.error);probes.resolveInput(f.room,f.unit);};return f;
}
test('all three printed probe attachments stack inside a probe without floor space and require a valid host chain',()=>{
 const f=payloadFixture();assert.equal(maps.exteriorError(f.ship.ship),'');
 for(const [type,price,en]of [['shield-breacher',900,0],['hacking-bug',275,1],['warp-bubble-inhibitor',1750,0]]){const d=maps.definition(type);assert.equal(d.price,price);assert.equal(d.energyCost,en);assert.equal(d.threshold,null);assert.equal(maps.placementSquares(f.ship.ship,{type},{cell:33}).length,0);}
 f.ship.ship.sicInventory.find(i=>i.id==='probe0').attachTo='bridge';assert.match(maps.exteriorError(f.ship.ship),/attached/);
});
test('shield breaching waits two rounds, follows current target positions, preserves standard hacking and charges AU only after activation',()=>{
 const f=payloadFixture(),hack=require('../ship-hacking');
 f.ship.ship.sicInventory.push({id:'hack',type:'hacking-module-5'});f.ship.ship.placements.push({sicId:'hack',cell:116});f.unit.hackingSkill=5;
 f.run('attach');probes.advance(f.room,.01);assert.equal(f.p.phase,'breaching');assert.equal(f.p.breachRemaining,24);
 f.room.hardPaused=true;probes.advance(f.room,12);assert.equal(f.p.breachRemaining,24);f.room.hardPaused=false;
 probes.advance(f.room,12);assert.equal(f.p.phase,'breaching');assert.equal(probes.nextEvent(f.room),12);
 probes.advance(f.room,12);assert.equal(f.p.phase,'attached');assert.equal(f.p.bugActive,false);
 const before=f.ship.auState.current;f.run('bugOn');assert.equal(f.ship.auState.current,before-1);assert.equal(probes.bugLink(f.room,f.ship,f.enemy),true);
 const session={id:'session',unitId:f.unit.id,sourceId:f.ship.id,targetId:f.enemy.id,moduleId:'hack',sicId:'target-life',station:stations.station(f.room,f.unit).key};
 f.enemy.ship.sicInventory.push({id:'wired',type:'wired-downgrade'});f.enemy.ship.placements.push({sicId:'wired',cell:42});
 assert.equal(hack.connected(f.room,session),true);f.p.bugActive=false;assert.equal(hack.connected(f.room,session),false);f.p.bugActive=true;
 probes.advance(f.room,11);assert.equal(f.ship.auState.current,before-1);probes.advance(f.room,1);assert.equal(f.ship.auState.current,before-2);
 const restored=JSON.parse(JSON.stringify(f.room));assert.equal(probes.bugLink(restored,restored.starships[0],restored.starships[1]),true);
 f.room.shipPositions[1].q=5;probes.advance(f.room,.1);assert.equal(f.p.position.q,5);
 f.ship.auState.current=0;power.refresh(f.room);probes.advance(f.room,12);assert.equal(f.p.bugActive,false);assert.match(f.ship.ship.probeState.reports[0].text,/no AU/);
 f.run('return');assert.equal(f.p.targetId,null);assert.equal(probes.bugLink(f.room,f.ship,f.enemy),false);
});
test('shield attachment rejects missing breacher, lost link stops hacking and destroyed probe loses its payloads',()=>{
 const f=payloadFixture(),breach=f.ship.ship.sicInventory.find(i=>i.id==='shield-breacher');breach.disabled=true;
 assert.match(probes.command(f.room,f.unit,order(f,'attach',{targetId:'target'})).error,/Shield Breacher/);
 breach.disabled=false;f.p.phase='attached';f.p.targetId='target';f.p.bugActive=true;f.room.shipPositions[0].q=100;probes.reconcile(f.room);assert.equal(f.p.bugActive,false);
 f.room.shipPositions[0].q=0;assert.equal(probes.hit(f.room,f.p.id,10),true);assert.equal(breach.status,'destroyed');assert.equal(probes.warpBlocked(f.room,f.enemy),false);
});
test('inhibitor arms in one active round, blocks every ship within two Units and prevents movement until deactivated',()=>{
 const f=payloadFixture(),transit=require('../ship-transit');f.p.position={q:1,r:0};f.room.shipPositions[1].q=3;
 f.ship.ship.sicInventory.push({id:'warp',type:'warp-drive-1'});f.ship.ship.placements.push({sicId:'warp',cell:117});f.ship.ship.warpFuel={F:2};
 f.run('inhibit');probes.advance(f.room,11);assert.equal(probes.warpBlocked(f.room,f.ship),false);probes.advance(f.room,1);
 assert.equal(probes.warpBlocked(f.room,f.ship),true);assert.equal(probes.warpBlocked(f.room,f.enemy),true);
 const started=transit.command(f.room,f.unit,{kind:'warpStart',shipId:f.ship.id,sicId:'warp',distanceLY:.1,requestId:'blocked-warp-start'});assert.match(started.error,/Warp Bubble Inhibitor/);
 f.room.shipPositions[1].q=3.01;assert.equal(probes.warpBlocked(f.room,f.enemy),false);
 assert.match(probes.command(f.room,f.unit,order(f,'move')).error,/Deactivate/);
 f.run('inhibitOff');assert.equal(probes.warpBlocked(f.room,f.ship),false);f.run('return');assert.equal(f.p.phase,'returning');
});
test('printed probe grades, four-slot attachment limit, and zero floorplan are shared construction rules',()=>{
 const f=fixture(),s=f.ship.ship;
 assert.equal(maps.exteriorError(s),'');assert.equal(stations.access(f.room,f.unit,'launcher').remote,true);
 for(let i=1;i<=5;i++){const d=maps.definition('probe-'+i);assert.equal(d.price,[100,250,450,700,1000][i-1]);assert.equal(d.threshold,5+5*i);assert.equal(d.masking,8+2*i);assert.equal(d.moveSpeed,2+2*i);assert.equal(d.energyCost,0);assert.deepEqual(d.probeDice,[[8,8,8],[10,10,10],[10,10,10,10],[12,12,12],[12,12,12,12]][i-1]);}
 assert.equal(maps.placementSquares(s,s.sicInventory.at(-1),s.placements.at(-1)).length,0);
 s.sicInventory.push({id:'fifth',type:'probe-5',attachTo:'launcher'});s.placements.push({sicId:'fifth',cell:33});assert.match(maps.exteriorError(s),/four probes/);
 s.sicInventory.at(-1).attachTo='bridge';assert.match(maps.exteriorError(s),/attached/);
});
test('launch uses a receipt-safe input, 12 active second cooldown, grade speed and recall',()=>{
 const f=fixture(),body=order(f);assert.equal(probes.command(f.room,f.unit,body).ok,true);const pending=f.unit.delayedAction;
 assert.equal(f.ship.ship.probeState.probes.probe0.phase,'docked');assert.equal(probes.command(f.room,f.unit,body).duplicate,true);assert.equal(f.unit.delayedAction,pending);
 assert.equal(probes.command(f.room,f.unit,{...body,kind:'scan'}).ok,false);
 probes.resolveInput(f.room,f.unit);let p=f.ship.ship.probeState.probes.probe0;assert.equal(p.phase,'flying');assert.equal(f.ship.ship.probeState.launchers.launcher.cooldown,12);
 probes.advance(f.room,6);assert.equal(p.position.q,2);assert.equal(f.ship.ship.probeState.launchers.launcher.cooldown,6);
 assert.equal(probes.command(f.room,f.unit,order(f,'launch',{probeId:f.ship.ship.probeState.probes.probe1.id})).ok,false);
 probes.advance(f.room,6);assert.equal(p.phase,'holding');assert.equal(p.position.q,4);
 assert.equal(probes.command(f.room,f.unit,order(f,'return')).ok,true);probes.resolveInput(f.room,f.unit);probes.advance(f.room,12);assert.equal(p.phase,'docked');
});
test('out-of-range destinations are rejected before input and rechecked when input completes',()=>{
 const f=fixture(),range=maps.sensorStats(f.ship).range;
 for(const destination of [null,{q:.5,r:0},{q:10001,r:0},{q:range+1,r:0}]){const r=probes.command(f.room,f.unit,order(f,'launch',{destination}));assert.equal(r.ok,false);assert.equal(f.unit.delayedAction,undefined);}
 assert.equal(probes.command(f.room,f.unit,order(f,'launch',{destination:{q:range,r:0}})).ok,true);
 f.room.shipPositions[0].q=-2;probes.resolveInput(f.room,f.unit);const p=f.ship.ship.probeState.probes.probe0;
 assert.equal(p.phase,'docked');assert.match(f.ship.ship.probeState.reports[0].text,/sensor range/);assert.equal(f.ship.ship.probeState.launchers.launcher.cooldown,0);
 f.room.shipPositions[0].q=0;probes.command(f.room,f.unit,order(f));probes.resolveInput(f.room,f.unit);
 assert.match(probes.command(f.room,f.unit,order(f,'move',{destination:{q:range+1,r:0}})).error,/sensor range/);
});

test('link loss recovers to the nearest owner hex at grade speed, pauses and never relays through another probe',()=>{
 const f=fixture(),range=maps.sensorStats(f.ship).range;
 probes.command(f.room,f.unit,order(f,'launch',{destination:{q:range,r:0}}));probes.resolveInput(f.room,f.unit);probes.advance(f.room,120);
 const p=f.ship.ship.probeState.probes.probe0;f.room.shipPositions[0].q=-4;probes.reconcile(f.room);
 assert.equal(p.linked,false);assert.deepEqual(probes.sources(f.room,f.ship),[]);assert.match(probes.command(f.room,f.unit,order(f,'scan')).error,/sensor link/);
 const neighbor=f.ship.ship.probeState.probes.probe1;neighbor.phase='holding';neighbor.position={q:range-4,r:0};probes.reconcile(f.room);assert.equal(neighbor.linked,true);assert.equal(p.linked,false);
 f.room.hardPaused=true;probes.advance(f.room,12);assert.equal(p.position.q,range);f.room.hardPaused=false;
 probes.advance(f.room,3);assert.equal(p.phase,'recovering');assert.equal(p.position.q,range-1);assert.deepEqual(p.destination,{q:range-4,r:0});assert.ok(targets.find(f.room,p.id));
 f.room.shipPositions[0].q=-6;probes.maintainRange(f.room);assert.deepEqual(p.destination,{q:range-6,r:0});
 const restored=structuredClone(f.room);probes.advance(restored,15);const result=restored.starships[0].ship.probeState.probes.probe0;assert.equal(result.phase,'holding');assert.equal(result.linked,true);assert.equal(result.position.q,range-6);
});

test('retract overrides recovery, disables payloads, follows a moving owner without a sensor link and docks',()=>{
 const f=payloadFixture(),range=maps.sensorStats(f.ship).range;
 f.p.inhibitor='active';f.room.shipPositions[0].q=-range-3;probes.reconcile(f.room);
 f.run('return');assert.equal(f.p.phase,'returning');assert.equal(f.p.inhibitor,'off');assert.equal(f.p.bugActive,false);
 probes.advance(f.room,3);assert.equal(f.p.position.q,3);f.room.shipPositions[0].q=-range-5;
 probes.maintainRange(f.room);assert.equal(f.p.destination.q,-range-5);probes.advance(f.room,120);assert.equal(f.p.phase,'docked');assert.equal(f.p.position.q,-range-5);
});

test('automatic recovery leaves attachments, turns off stationary payloads and spends no AU',()=>{
 const f=payloadFixture(),range=maps.sensorStats(f.ship).range,before=f.ship.auState.current;
 f.p.phase='attached';f.p.targetId='target';f.p.bugActive=true;f.p.bugRemaining=.1;f.p.inhibitor='active';
 f.room.shipPositions[0].q=-range;probes.advance(f.room,3);
 assert.equal(f.p.phase,'recovering');assert.equal(f.p.targetId,null);assert.equal(f.p.bugActive,false);assert.equal(f.p.inhibitor,'off');assert.equal(f.ship.auState.current,before);assert.equal(f.p.position.q,3);
});

test('nearest linked hex is optimal for fractional and diagonal owner positions',()=>{
 const distance=require('../ship-distances').hexDistance;
 for(const origin of [{q:0,r:0},{q:.4,r:-.7},{q:-2.8,r:3.1}])for(const range of [1,2,4.2])for(const point of [{q:9,r:-6},{q:-7.3,r:9.1},{q:0,r:11},{q:.8,r:-.4}]){
  const chosen=probes.nearestInRange(origin,point,range);let shortest=Infinity;
  for(let q=-10;q<=10;q++)for(let r=-10;r<=10;r++)if(distance(origin,{q,r})<=range+1e-7)shortest=Math.min(shortest,distance(point,{q,r}));
  assert.ok(distance(origin,chosen)<=range+1e-7);assert.ok(Math.abs(distance(point,chosen)-shortest)<1e-7,JSON.stringify({origin,point,range,chosen,shortest}));
 }
 assert.equal(probes.nearestInRange({q:.5,r:0},{q:4,r:0},0),null);
});

test('probe scans require confirmed normal dice, extend only the owner picture and omit sibling probes',()=>{
 const f=fixture(),range=maps.sensorStats(f.ship).range;
 probes.command(f.room,f.unit,order(f,'launch',{destination:{q:range,r:0}}));probes.resolveInput(f.room,f.unit);probes.advance(f.room,120);
 const enemy={id:'enemy',title:'Hidden target',ship:{gridCells:[42],sicInventory:[],placements:[]},currentHullHp:1};f.room.starships.push(enemy);f.room.shipPositions.push({id:enemy.id,q:range*2,r:0});
 sensors.refresh(f.room);assert.ok(sensors.knowledge(f.ship).contacts.enemy);
 assert.equal(probes.command(f.room,f.unit,order(f,'scan')).ok,true);assert.deepEqual(probes.rollSpec(f.room,f.unit,f.unit.delayedAction.probeOrder).sides,[8,8,8]);
 probes.resolveInput(f.room,f.unit);assert.match(f.ship.ship.probeState.reports[0].text,/confirmed standard dice/);
 assert.equal(probes.command(f.room,f.unit,order(f,'scan')).ok,true);f.unit.delayedAction.rollConfirmed=true;f.unit.delayedAction.submittedRoll={score:16,values:[8,8,1]};probes.resolveInput(f.room,f.unit);assert.match(f.ship.ship.probeState.reports[0].text,/1 contact/);
 const view=sensors.view(f.room,enemy.id);assert.equal(view.starships.some(s=>s.ship.probeState),false);
});
test('deployed probes use Masking as Defense and one threshold hit destroys without harming owner',()=>{
 const f=fixture();probes.command(f.room,f.unit,order(f));probes.resolveInput(f.room,f.unit);const p=f.ship.ship.probeState.probes.probe0,hp=f.ship.currentHullHp;
 assert.equal(sensors.defense(f.room,targets.find(f.room,p.id)),10);assert.equal(targets.hit(f.room,p.id,9),false);assert.equal(targets.hit(f.room,p.id,10),true);assert.equal(targets.find(f.room,p.id),undefined);assert.equal(f.ship.currentHullHp,hp);
 assert.equal(f.ship.ship.sicInventory.find(i=>i.id==='probe0').status,'destroyed');probes.reconcile(f.room);assert.equal(p.phase,'destroyed');
});
test('launcher impairments destroy one docked probe per point once, while powered-down probes survive',()=>{
 const f=fixture(),s=f.ship.ship;s.sicInventory.find(i=>i.id==='probe0').disabled=true;probes.reconcile(f.room);assert.equal(s.probeState.probes.probe0.phase,'docked');
 s.sicInventory.find(i=>i.id==='launcher').impairmentPoints=2;probes.reconcile(f.room);assert.equal(Object.values(s.probeState.probes).filter(p=>p.phase==='destroyed').length,2);
 const restored=JSON.parse(JSON.stringify(f.room));probes.reconcile(restored);assert.equal(Object.values(restored.starships[0].ship.probeState.probes).filter(p=>p.phase==='destroyed').length,2);
});
test('local station gets existing input bonus and loss of station cancels launch',()=>{
 const f=fixture();f.seat('launcher');probes.command(f.room,f.unit,order(f));const rate=f.unit.delayedAction.rate;stations.adjustInputs(f.room);assert.equal(f.unit.delayedAction.rate,rate/.9);
 f.unit.location.stationed=false;probes.resolveInput(f.room,f.unit);assert.equal(f.ship.ship.probeState.probes.probe0.phase,'docked');assert.match(f.ship.ship.probeState.reports[0].text,/station/);
});
test('weapons can hit detected enemy probes on a Defense tie and component locks are disallowed',()=>{
 const f=fixture(),weapons=require('../ship-weapons'),locks=require('../ship-locks'),enemy=structuredClone(f.ship);enemy.id='enemy';delete enemy.ship.probeState;f.room.starships.push(enemy);f.room.shipPositions.push({id:'enemy',q:3,r:0});probes.reconcile(f.room);
 const p=enemy.ship.probeState.probes.probe0;p.phase='holding';p.position={q:3,r:0};sensors.refresh(f.room);
 f.ship.ship.sicInventory.push({id:'gun',type:'rapid-laser-1'},{id:'lock',type:'lock-on-1'});f.ship.ship.placements.push({sicId:'gun',cell:13},{sicId:'lock',cell:112});f.unit.weaponSystemsSkill=6;f.unit.dexterityDice=[12,12];
 f.ship.ship.sicInventory.find(i=>i.id==='engine').type='en-au-engine-6';power.refresh(f.room,{reset:true});
 assert.match(locks.queue(f.room,f.unit,{sicId:'lock',targetId:p.id,kind:'sic',targetSicId:'fake',requestId:'probe-component-lock'}).error,/whole-target/);
 const queued=weapons.queue(f.room,f.unit,{sicId:'gun',targetId:p.id,requestId:'probe-target-shot'});assert.equal(queued.ok,true,queued.error);
 const roll=()=>10;roll.submittedScore=10;weapons.resolveInput(f.room,f.unit,roll,()=>{throw Error('damage must remain manual');});assert.ok(f.unit.delayedAction.weaponDamage);assert.equal(f.unit.delayedAction.weaponDamage.defense,10);
 const damage=f.unit.delayedAction.weaponDamage;damage.count=2;damage.dieSides=12;weapons.resolveDamage(f.room,f.unit,[5,5]);assert.equal(p.phase,'destroyed');
});

test('recovery replots if a moving owner brings the probe in range but leaves its old destination outside',()=>{
 const f=fixture(),p=f.ship.ship.probeState.probes.probe0;
 Object.assign(p,{phase:'recovering',position:{q:0,r:0},destination:{q:-12,r:0}});f.room.shipPositions[0].q=11;
 probes.maintainRange(f.room);assert.deepEqual(p.destination,{q:0,r:0});probes.advance(f.room,.1);assert.equal(p.phase,'holding');assert.equal(p.linked,true);
});
