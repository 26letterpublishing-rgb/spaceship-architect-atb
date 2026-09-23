const test=require('node:test'),assert=require('node:assert/strict');
const drones=require('../ship-drones'),targets=require('../ship-targets'),sensors=require('../ship-sensors'),weapons=require('../ship-weapons'),power=require('../ship-power'),shields=require('../ship-shields');
function fixture(){
 const ships=['a','b'].map(id=>({id,title:id,currentHullHp:40,maximumHullHp:56,ship:{gridCells:Array.from({length:56},(_,n)=>42+Math.floor(n/8)*20+n%8),doorStates:{},sicInventory:[{id:id+'-bay',type:'repair-drone-1'},{id:id+'-en',type:'en-au-engine-4'},{id:id+'-cp',type:'cockpit-1'},{id:id+'-sn',type:'sensors-3'},{id:id+'-gun',type:'rapid-laser-1'}],placements:[{sicId:id+'-cp',cell:42},{sicId:id+'-sn',cell:43},{sicId:id+'-bay',cell:49},{sicId:id+'-en',cell:85},{sicId:id+'-gun',cell:22}]}}));
 const unit={id:'u',team:'pc',characterId:'pc',currentHp:30,atb:100,weaponSystemsSkill:6,dexterityDice:[12,12],location:{starshipId:'a',square:42,mesh:0,sicId:'a-cp',stationed:true}};
 const room={starships:ships,units:[unit],activeId:'u',shipPositions:[{id:'a',q:0,r:0},{id:'b',q:0,r:0}]};
 power.refresh(room,{reset:true});sensors.refresh(room);return {room,a:ships[0],b:ships[1],unit};
}
test('drone repairs exactly at Slow + Quality 1 completion, remains serializable, caps Hull then docks',()=>{
 const {room,a,b}=fixture();b.currentHullHp=b.maximumHullHp;let rolls=0;
 drones.advance(room,12.4,()=>{rolls++;return 4;});assert.equal(a.currentHullHp,40);assert.equal(rolls,0);
 const restored=JSON.parse(JSON.stringify(room));drones.advance(restored,.1,()=>{rolls++;return 4;});assert.equal(restored.starships[0].currentHullHp,44);assert.equal(rolls,1);
 drones.advance(restored,37.5,()=>4);assert.equal(restored.starships[0].currentHullHp,56);assert.equal(drones.entries(restored)[0].drone.phase,'returning');
 drones.advance(restored,1.5,()=>{throw Error('no roll at full Hull');});assert.equal(drones.entries(restored)[0].drone.phase,'docked');
 assert.equal(restored.starships[0].ship.droneState.reports.length,4);
});
test('drone is independently targetable, Defense 12, threshold 14, no damage to owner',()=>{
 const {room,a,b}=fixture();b.currentHullHp=b.maximumHullHp;drones.reconcile(room);const d=drones.entries(room)[0].drone;
 assert.equal(targets.find(room,d.id).defenseScore,12);assert.equal(sensors.defense(room,targets.find(room,d.id)),12);
 assert.equal(targets.hit(room,d.id,13),false);assert.ok(targets.find(room,d.id));
 assert.equal(targets.hit(room,d.id,14),true);assert.equal(targets.find(room,d.id),undefined);assert.equal(a.currentHullHp,40);
 drones.advance(room,100,()=>{throw Error('destroyed drone rolled');});
});
test('same-hex repair orders are receipt-safe, then return to owner when ships separate',()=>{
 const {room,a,b,unit}=fixture();a.currentHullHp=56;
 const body={sicId:'a-bay',targetId:'b',receipt:'repair-once-123'};
 assert.equal(drones.command(room,unit,body).ok,true);drones.advance(room,5,()=>4);
 assert.equal(drones.command(room,unit,body).duplicate,true);assert.equal(a.ship.droneState.drones['a-bay'].progress,40);
 room.shipPositions[1].q=1;drones.reconcile(room);assert.equal(a.ship.droneState.drones['a-bay'].targetId,'a');assert.equal(a.ship.droneState.drones['a-bay'].phase,'docked');
 assert.equal(drones.command(room,unit,{...body,receipt:'another-receipt'}).ok,false);
});
test('offline drone bay stops work without altering manual oxygen settings',()=>{
 const {room,a,b}=fixture();b.currentHullHp=b.maximumHullHp;drones.reconcile(room);a.ship.sicInventory[0].disabled=true;
 drones.advance(room,30,()=>{throw Error('offline drone rolled');});assert.equal(a.currentHullHp,40);assert.equal(a.ship.droneState.drones['a-bay'].phase,'docked');
});
test('manual shot ties against drone Defense hit and retain manual damage confirmation',()=>{
 const {room,a,b,unit}=fixture();drones.reconcile(room);const drone=b.ship.droneState.drones['b-bay'];
 sensors.knowledge(a).contacts[drone.id]={id:drone.id,level:'detected',defenseScore:12,position:{q:0,r:0}};
 assert.equal(weapons.queue(room,unit,{sicId:'a-gun',targetId:drone.id,requestId:'drone-test-shot'}).ok,true);
 const roll=()=>12;roll.submittedScore=12;weapons.resolveInput(room,unit,roll,()=>{throw Error('damage must remain manual');});
 assert.equal(unit.delayedAction.weaponDamage.defense,12);assert.equal(unit.delayedAction.awaitingRoll,true);
});

test('drone lock skips accuracy, manual range penalty uses its host position, and destruction cancels follow-up damage',()=>{
 const locks=require('../ship-locks'),{room,a,b,unit}=fixture();
 a.ship.sicInventory.push({id:'a-lock',type:'lock-on-1'});a.ship.placements.push({sicId:'a-lock',cell:44});
 room.shipPositions[1].q=3;drones.reconcile(room);const drone=b.ship.droneState.drones['b-bay'];
 sensors.knowledge(a).contacts[drone.id]={id:drone.id,level:'detected',defenseScore:12,position:{q:3,r:0}};
 const spec=weapons.rollSpec(room,unit,{shipId:a.id,targetId:drone.id,sicId:'a-gun'});assert.equal(spec.range,3);
 assert.equal(spec.bonus,unit.weaponSystemsSkill+require('../ship-map-core').propulsion(a).hsm-3);
 locks.state(a).targets.push({targetId:drone.id,systemId:'a-lock',remaining:12});
 assert.equal(weapons.queue(room,unit,{sicId:'a-gun',targetId:drone.id,requestId:'drone-locked-shot'}).ok,true);assert.equal(unit.delayedAction.rollConfirmed,true);
 weapons.resolveInput(room,unit,()=>{throw Error('Locked shot must skip accuracy');});assert.ok(unit.delayedAction.weaponDamage);
 targets.hit(room,drone.id,14);assert.equal(weapons.cancelUnavailableDamage(room),1);assert.equal(unit.delayedAction,null);locks.refresh(room);assert.equal(locks.state(a).targets.length,0);
});

test('repair options include only powered, detected, damaged ships sharing the hex',()=>{
 const {room,a,b}=fixture();drones.reconcile(room);assert.deepEqual(drones.repairTargets(room,a),[{id:b.id,title:b.title}]);
 b.escapedAt=1;assert.deepEqual(drones.repairTargets(room,a),[]);delete b.escapedAt;
 b.currentHullHp=b.maximumHullHp;assert.deepEqual(drones.repairTargets(room,a),[]);b.currentHullHp=40;
 a.ship.sicInventory.find(i=>i.id==='a-bay').disabled=true;assert.deepEqual(drones.repairTargets(room,a),[]);
});
