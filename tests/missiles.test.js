const test=require('node:test'),assert=require('node:assert/strict');
const missiles=require('../ship-missiles'),targets=require('../ship-targets'),weapons=require('../ship-weapons'),sensors=require('../ship-sensors'),locks=require('../ship-locks'),maps=require('../ship-map-core'),power=require('../ship-power'),shields=require('../ship-shields');
function fixture(){
  const make=id=>({id,title:id,maximumHullHp:200,currentHullHp:200,ship:{gridCells:[82,83,84,102,103,104,122,123,124],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-1'},{id:'lock',type:'lock-on-1'},{id:'gun',type:'rapid-laser-1'},{id:'launcher',type:'missile-launcher-1'},{id:'au',type:'au-engine-1'}],placements:[{sicId:'cp',cell:82},{sicId:'sn',cell:83},{sicId:'en',cell:124},{sicId:'lock',cell:84},{sicId:'gun',cell:62},{sicId:'launcher',cell:102,exteriorCell:100},{sicId:'au',cell:104}],missileAmmo:{launcher:{'missile-1':3,'spread-missiles-1':1,'missile-flares':1}}}});
  const a=make('a'),b=make('b'),unit={id:'u',characterId:'pc',team:'pc',currentHp:40,weaponSystemsSkill:6,dexterityDice:[12,12,12],atb:100,location:{starshipId:'a',sicId:'cp',square:82,mesh:0,stationed:true}};
  const room={starships:[a,b],units:[unit],threshold:100,activeId:'u',shipPositions:[{id:'a',q:0,r:0},{id:'b',q:2,r:0}],log:[],showcase:true};a.sensorScenarioMasking=b.sensorScenarioMasking=10;power.refresh(room,{reset:true});sensors.refresh(room);locks.state(a).targets=[{targetId:'b',systemId:'lock',remaining:12}];return {room,a,b,unit};
}
const order={sicId:'launcher',targetId:'b',ammunition:'missile-1',requestId:'missile-launch-test'};
function launch(f,ammunition='missile-1'){const r=weapons.queue(f.room,f.unit,{...order,ammunition});assert.equal(r.ok,true,r.error);missiles.resolveInput(f.room,f.unit);return targets.flights(f.room)[0];}
function tick(room,seconds){let left=seconds;while(left>1e-7&&!missiles.pending(room)){const step=Math.min(left,Math.max(.000001,missiles.nextEvent(room)));missiles.advance(room,step);left-=step;}}
test('all five launcher grades match capacity, placement and one-impairment rules',()=>{for(let n=1;n<=5;n++){const d=maps.definition('missile-launcher-'+n);assert.equal(d.capacity,[3,5,8,15,25][n-1]);assert.equal(d.energyCost,1);assert.equal(d.stations.length,1);assert.equal(d.destroyedOnImpairment,true);const parts=maps.placementParts({type:'missile-launcher-'+n},{cell:102,exteriorCell:100});assert.equal(parts[0].entry.width,1);assert.equal(parts[0].entry.height,2);assert.equal(parts[1].entry.width,n>=4?2:1);}});
test('launch requires Lock-On, consumes a round once, and creates no accuracy dice',()=>{const f=fixture();locks.state(f.a).targets=[];assert.equal(weapons.queue(f.room,f.unit,order).ok,false);assert.equal(f.a.ship.missileAmmo.launcher['missile-1'],3);locks.state(f.a).targets=[{targetId:'b',systemId:'lock'}];assert.equal(weapons.queue(f.room,f.unit,order).ok,true);assert.equal(weapons.queue(f.room,f.unit,order).duplicate,true);assert.equal(f.a.ship.missileAmmo.launcher['missile-1'],3);assert.equal(f.unit.delayedAction.rollConfirmed,true);assert.equal(f.unit.delayedAction.rollSpec,undefined);});
test('homing survives broken locks and a lost operator; acceleration caps on the fifth round',()=>{const f=fixture();f.room.shipPositions[1].q=100;f.a.ship.sicInventory.find(i=>i.id==='sn').type='sensors-9';f.room.shipPositions[1].q=20;launch(f);locks.state(f.a).targets=[];f.room.units=[];f.room.shipPositions[1].q=100;tick(f.room,60);const m=targets.flights(f.room)[0];assert.equal(m.phase,'flying');assert.ok(Math.abs(m.position.q-15)<1e-6);assert.equal(m.speed,5);tick(f.room,12);assert.ok(Math.abs(m.position.q-20)<1e-6);});
test('launcher cooldown is shared by operators and cannot be bypassed with AU',()=>{const f=fixture();launch(f);assert.match(weapons.queue(f.room,f.unit,{...order,requestId:'missile-repeat'}).error,/once per 12/);tick(f.room,12);assert.equal(weapons.queue(f.room,f.unit,{...order,requestId:'missile-repeat'}).ok,true);});
test('impact pauses independently, survives JSON restart and waits for manual damage',()=>{const f=fixture(),m=launch(f);tick(f.room,18);assert.equal(m.phase,'impact');assert.equal(f.b.currentHullHp,200);const room=JSON.parse(JSON.stringify(f.room));assert.equal(missiles.pending(room),true);missiles.advance(room,100);assert.ok(Math.abs(targets.flights(room)[0].age-18)<1e-6);assert.equal(missiles.resolveDamage(room,m.id,17).ok,false);assert.equal(missiles.resolveDamage(room,m.id,8).ok,true);assert.equal(room.starships[1].currentHullHp,160);assert.equal(missiles.resolveDamage(room,m.id,8).duplicate,true);assert.equal(missiles.pending(room),false);});
test('shield hit uses unmultiplied dice and discards overflow',()=>{const f=fixture();f.b.ship.sicInventory.push({id:'shield',type:'shield-1'});f.b.ship.placements.push({sicId:'shield',cell:123});shields.refresh(f.room);shields.entries(f.b)[0].state.hp=1;const m=launch(f);tick(f.room,18);assert.equal(missiles.resolveDamage(f.room,m.id,16).ok,true);assert.equal(f.b.currentHullHp,200);assert.equal(f.b.currentShieldHp,0);});
test('spread launch creates four separately targetable projectiles and four damage requests',()=>{const f=fixture();launch(f,'spread-missiles-1');assert.equal(targets.flights(f.room).length,4);assert.equal(new Set(targets.flights(f.room).map(m=>m.id)).size,4);tick(f.room,18);for(const m of targets.flights(f.room)){assert.equal(m.dice,1);assert.equal(missiles.resolveDamage(f.room,m.id,1).ok,true);}assert.equal(f.b.currentHullHp,180);});
test('missiles can be detected, locked and intercepted with manually confirmed weapon damage',()=>{const f=fixture(),m=launch(f);sensors.refresh(f.room);assert.equal(f.a.sensorState.contacts[m.id].defenseScore,8);assert.equal(f.a.sensorState.contacts[m.id].nature,'Missile');f.a.auState.current=f.a.auState.maximum=20;f.a.ship.sicInventory.push({id:'au2',type:'au-engine-1'});f.a.ship.placements.push({sicId:'au2',cell:122});power.refresh(f.room,{reset:true});const r=weapons.queue(f.room,f.unit,{sicId:'gun',targetId:m.id,requestId:'intercept-missile'});assert.equal(r.ok,true,r.error);const roll=()=>{throw Error('No automatic dice');};roll.submittedScore=50;weapons.resolveInput(f.room,f.unit,roll);assert.equal(m.phase,'flying');weapons.resolveDamage(f.room,f.unit,Array(f.unit.delayedAction.weaponDamage.count).fill(1));assert.equal(m.phase,'destroyed');tick(f.room,60);assert.equal(f.b.currentHullHp,200);});
test('flares require three manual coin results and break pursuit only for winning flips',()=>{const f=fixture(),m=launch(f);sensors.refresh(f.room);missiles.state(f.a).cooldowns.launcher=0;const body={...order,requestId:'flare-test-order',ammunition:'missile-flares'};assert.equal(weapons.queue(f.room,f.unit,body).ok,false);body.flares=Array.from({length:3},()=>({targetId:m.id,result:'heads',direction:3}));assert.equal(weapons.queue(f.room,f.unit,body).ok,true);missiles.resolveInput(f.room,f.unit);tick(f.room,1);assert.equal(m.targetId,null);assert.ok(m.position.q<0);});
test('warped targets end pursuit, but destroying the source does not remove in-flight missiles',()=>{const f=fixture(),m=launch(f);f.a.currentHullHp=0;tick(f.room,1);assert.equal(m.phase,'flying');f.b.escapedAt=Date.now();tick(f.room,1);assert.equal(m.phase,'expired');assert.equal(missiles.pending(f.room),false);});
test('enemy projections disclose detected missile data without launcher crew or target orders',()=>{const f=fixture(),m=launch(f);sensors.refresh(f.room);const view=sensors.view(f.room,'b'),contact=view.starships.find(s=>s.id===m.id);assert.equal(contact.isMissile,true);assert.equal(contact.projectile,undefined);assert.equal(contact.ship.sicInventory.length,0);assert.equal(JSON.stringify(view).includes('"controller"'),false);});
module.exports={fixture};

test('a locked missile can be intercepted by another missile without damaging either ship',()=>{
  const f=fixture(),incoming={id:'incoming',name:'Missile 1',sourceId:'b',targetId:'a',phase:'flying',position:{q:1,r:0},age:0,acceleration:1,speed:1,masking:8,dice:2};
  missiles.state(f.b).flights.push(incoming);sensors.refresh(f.room);
  locks.state(f.a).targets=[{targetId:incoming.id,systemId:'lock'}];
  const queued=weapons.queue(f.room,f.unit,{...order,targetId:incoming.id});assert.equal(queued.ok,true,queued.error);
  missiles.resolveInput(f.room,f.unit);
  const interceptor=missiles.state(f.a).flights[0];assert.equal(interceptor.targetId,incoming.id);
  tick(f.room,6.3);assert.equal(interceptor.phase,'impact');
  assert.equal(missiles.resolveDamage(f.room,interceptor.id,2).ok,true);
  assert.equal(incoming.phase,'destroyed');assert.equal(missiles.pending(f.room),false);
  assert.equal(f.a.currentHullHp,200);assert.equal(f.b.currentHullHp,200);
});
test('interrupted input releases its reservation without destroying an unfired round',()=>{const f=fixture();assert.equal(weapons.queue(f.room,f.unit,order).ok,true);f.unit.location.stationed=false;missiles.resolveInput(f.room,f.unit);assert.equal(f.a.ship.missileAmmo.launcher['missile-1'],3);assert.equal(targets.flights(f.room).length,0);assert.equal(f.unit.delayedAction,null);});
test('capturing a launcher alone does not authorize use of uncaptured enemy locks',()=>{const f=fixture();f.b.ship.sicInventory.find(i=>i.id==='launcher').id='enemy-launcher';f.b.ship.placements.find(p=>p.sicId==='launcher').sicId='enemy-launcher';f.b.ship.missileAmmo['enemy-launcher']={'missile-1':2};f.room.hackingGrants=[{unitId:'u',sourceId:'a',targetId:'b',sicId:'enemy-launcher'}];f.b.hackedSystems=[{unitId:'u',sicId:'enemy-launcher'}];locks.state(f.b).targets=[{targetId:'a',systemId:'lock'}];const body={...order,sicId:'enemy-launcher',targetId:'a'};assert.match(weapons.queue(f.room,f.unit,body).error,/accessible target Lock-On/);f.b.hackedSystems.push({unitId:'u',sicId:'lock'});assert.equal(weapons.queue(f.room,f.unit,body).ok,true);});
test('ammunition lookup cannot accept inherited object properties',()=>{const ammo=require('../missile-ammunition');assert.equal(ammo.catalog.constructor,undefined);assert.deepEqual(ammo.magazine({missileAmmo:{}},'__proto__'),{});});
test('simultaneous interception waits are cancelled when another gunner destroys the missile',()=>{const f=fixture(),m=launch(f);sensors.refresh(f.room);f.unit.delayedAction={id:'intercept-a',weaponDamage:{shipId:f.a.id,targetId:m.id,count:1,dieSides:4},awaitingRoll:true};const second={...structuredClone(f.unit),id:'v'};second.delayedAction.id='intercept-b';f.room.units.push(second);weapons.resolveDamage(f.room,f.unit,[1]);assert.equal(weapons.cancelUnavailableDamage(f.room),1);assert.equal(second.delayedAction,null);assert.equal(m.phase,'destroyed');});
test('destroying an impact target cancels the manual wait instead of requiring meaningless dice',()=>{const f=fixture(),m=launch(f);tick(f.room,18);f.b.currentHullHp=0;assert.equal(missiles.reconcile(f.room),1);assert.equal(missiles.pending(f.room),false);assert.equal(m.phase,'expired');});
test('all ammunition grades continuously steer toward moving targets across turns and restored flight state',()=>{
 for(const spread of [false,true])for(let tier=1;tier<=5;tier++){
  let f=fixture();const kind=(spread?'spread-missiles-':'missile-')+tier;f.a.ship.missileAmmo.launcher[kind]=1;launch(f,kind);f.room.units=[];f.a.lockState.targets=[];
  for(let n=0;n<300;n++){
   const target=f.room.shipPositions.find(p=>p.id==='b'),angle=n/40;target.q=20+Math.cos(angle)*10;target.r=Math.sin(angle)*12;
   for(const m of targets.flights(f.room)){
    const previous={...m.position};missiles.advance({starships:[{...f.a,ship:{...f.a.ship,missileState:{flights:[m],cooldowns:{}}}},f.b],shipPositions:f.room.shipPositions,units:[]},.1);
    assert.equal(m.phase,'flying');assert.ok(Number.isFinite(m.heading));
    const expected=Math.atan2(1.5*(target.r-previous.r),Math.sqrt(3)*((target.q-previous.q)+(target.r-previous.r)/2))*180/Math.PI;assert.ok(Math.abs(m.heading-expected)<1e-8,kind+' follows current target');
   }
   if(n===149){f.room=JSON.parse(JSON.stringify(f.room));f.a=f.room.starships[0];f.b=f.room.starships[1];}
  }
  const stop=f.room.shipPositions.find(p=>p.id==='b');stop.q=3;stop.r=-4;tick(f.room,300);assert.equal(missiles.pending(f.room),true,kind+' eventually catches stopped target');
  for(const m of targets.flights(f.room)){assert.equal(m.phase,'impact');assert.ok(Math.abs(m.position.q-3)<1e-7);assert.ok(Math.abs(m.position.r+4)<1e-7);}
 }
});
test('warp departure during launcher input preserves the unfired ammunition',()=>{
 const f=fixture();assert.equal(weapons.queue(f.room,f.unit,order).ok,true);f.b.escapedAt=Date.now();missiles.resolveInput(f.room,f.unit);assert.equal(f.a.ship.missileAmmo.launcher['missile-1'],3);assert.equal(targets.flights(f.room).length,0);
});

test('missile reports omit zero damage channels while multipliers remain automatic and retry safe',()=>{
 for(const shielded of [false,true]){
  const f=fixture();if(shielded){f.b.ship.sicInventory.push({id:'shield',type:'shield-1'});f.b.ship.placements.push({sicId:'shield',cell:123});shields.refresh(f.room);shields.entries(f.b)[0].state.hp=10;}
  const m=launch(f);tick(f.room,18);missiles.resolveDamage(f.room,m.id,2);
  const report=f.a.weaponState.reports[0];assert.doesNotMatch(report.text,/\b0 shield damage/);assert.doesNotMatch(report.text,/\b0 hull damage/);
  assert.equal(report.damage,shielded?2:10);const hp=f.b.currentHullHp;assert.equal(missiles.resolveDamage(f.room,m.id,2).duplicate,true);assert.equal(f.b.currentHullHp,hp);
 }
});
test('a launched component missile retains its selected SIC through lock loss and impairs Life Support',()=>{
 const f=fixture();f.b.ship.sicInventory.push({id:'life',type:'life-support'});f.b.ship.placements.push({sicId:'life',cell:122});
 locks.state(f.a).targets[0].sicIds=['life','cp'];f.a.sensorState.analyses.b={layout:structuredClone(f.b.ship)};
 assert.equal(weapons.queue(f.room,f.unit,{...order,targetSicId:'life'}).ok,true);missiles.resolveInput(f.room,f.unit);
 const m=targets.flights(f.room)[0];assert.equal(m.targetSicId,'life');locks.state(f.a).targets=[];tick(f.room,18);
 assert.equal(missiles.resolveDamage(f.room,m.id,5).ok,true);const life=f.b.ship.sicInventory.find(i=>i.id==='life');assert.equal(life.impaired,true);assert.equal(life.impairmentPoints,Math.floor(25/maps.definition('life-support').threshold));assert.equal(maps.oxygenEnabled(f.b),false);assert.match(f.a.weaponState.reports[0].text,/Life Support damaged/);
 assert.equal(missiles.resolveDamage(f.room,m.id,5).duplicate,true);assert.equal(f.b.currentHullHp,175);
});
test('missiles reject forged component selection and cancel before ammunition is spent if its lock disappears',()=>{
 const f=fixture();assert.equal(weapons.queue(f.room,f.unit,{...order,targetSicId:'cp'}).ok,false);
 locks.state(f.a).targets[0].sicIds=['cp'];assert.equal(weapons.queue(f.room,f.unit,{...order,targetSicId:'cp'}).ok,true);locks.state(f.a).targets[0].sicIds=[];locks.state(f.a).targets[0].sicId=null;missiles.resolveInput(f.room,f.unit);assert.equal(targets.flights(f.room).length,0);assert.equal(f.a.ship.missileAmmo.launcher['missile-1'],3);
});
