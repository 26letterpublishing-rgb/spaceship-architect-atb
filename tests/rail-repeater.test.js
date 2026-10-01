const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),weapons=require('../ship-weapons'),power=require('../ship-power'),sensors=require('../ship-sensors'),shields=require('../ship-shields'),locks=require('../ship-locks'),stations=require('../station-access');
function fixture(iron=6){
 const make=id=>({id,title:id,currentHullHp:80,maximumHullHp:80,sensorScenarioMasking:10,ship:{minerals:{Iron:iron},gridCells:Array.from({length:80},(_,n)=>82+Math.floor(n/10)*20+n%10),sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-4'},{id:'lock',type:'lock-on-1'},{id:'gun',type:'ballistic-rail-repeater'}],placements:[{sicId:'cp',cell:82},{sicId:'sn',cell:83},{sicId:'en',cell:164},{sicId:'lock',cell:84},{sicId:'gun',cell:46}]}});
 const a=make('a'),b=make('b'),unit={id:'u',team:'pc',weaponSystemsSkill:6,dexterityDice:[8,6],atb:100,location:{starshipId:'a',sicId:'cp',square:82,mesh:0,stationed:true}},room={starships:[a,b],units:[unit],activeId:'u',threshold:100,showcase:true,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0}],log:[]};power.refresh(room,{reset:true});sensors.refresh(room);return {room,a,b,unit,gun:a.ship.sicInventory.find(i=>i.id==='gun')};
}
const command={sicId:'gun',targetId:'b',requestId:'rail-repeater-burst'};
function attack(room,unit,score=100){const die=()=>{throw Error('Every shot requires manual dice');};die.submittedScore=score;weapons.resolveInput(room,unit,die);}
test('B-103 printed stats and separate EXT/EDG footprints survive legal rotations',()=>{
 const d=maps.definition('ballistic-rail-repeater');assert.deepEqual([d.price,d.energyCost,d.security,d.threshold,d.burstShots,d.damageDie,d.impairedDamageDie],[800,0,2,18,4,10,6]);assert.equal(d.stations.length,1);assert.equal(d.manualOnly,true);assert.equal(d.noShieldDamage,true);
 for(const rotation of [0,90,180,270]){const item={id:'gun',type:'ballistic-rail-repeater',rotation},shape=maps.componentDefinition(item),origin=125,hull=[];for(let y=0;y<shape.height;y++)for(let x=0;x<shape.width;x++)if(!shape.exteriorCells.some(c=>c.x===x&&c.y===y))hull.push(origin+y*20+x);const ship={gridCells:hull,sicInventory:[item],placements:[{sicId:'gun',cell:origin}]};assert.equal(hull.length,1);assert.equal(shape.exteriorCells.length,2);assert.equal(maps.mixedPlacement(ship,item,origin),true);assert.equal(maps.exteriorError(ship),'');}
});
test('range increases target Defense once, rather than also subtracting it from accuracy',()=>{
 const {room,a,unit}=fixture();room.shipPositions[1].q=4.5;const spec=weapons.rollSpec(room,unit,{shipId:a.id,targetId:'b',sicId:'gun'});assert.equal(spec.difficulty,14.5);assert.equal(spec.bonus,6+maps.propulsion(a).hsm);weapons.queue(room,unit,command);attack(room,unit,14.5);assert.equal(unit.delayedAction.rollSpec.damage,true);
});
test('projected weapon previews preserve negative Defense and current evasion without changing tie resolution',()=>{
 const {room,a,b,unit}=fixture();b.sensorScenarioMasking=-3;sensors.refresh(room);
 const order={shipId:a.id,targetId:b.id,sicId:'gun'};
 for(const analyzed of [false,true]){
  if(analyzed)sensors.knowledge(a).analyses[b.id]={layout:structuredClone(b.ship)};
  const projected=sensors.view(room,a.id),target=projected.starships.find(s=>s.id===b.id);
  assert.equal(target.defenseScore,-3);assert.equal(Boolean(target.analyzedContact),analyzed);
  const preview=weapons.rollSpec(projected,unit,order),actual=weapons.rollSpec(room,unit,order);
  assert.equal(preview.difficulty,-2);assert.equal(preview.difficulty,actual.difficulty);assert.equal(preview.difficultyLabel,'Meet or exceed Defense -2');
 }
 assert.equal(weapons.queue(room,unit,command).ok,true);attack(room,unit,-2);assert.ok(unit.delayedAction.weaponDamage,'Equality still hits the target');
 b.commandSystems={evasions:[{defense:7,remaining:20}]};sensors.refresh(room);
 assert.equal(weapons.rollSpec(sensors.view(room,a.id),unit,order).difficulty,8);
 assert.equal(weapons.rollSpec(room,unit,order).difficulty,8);
});
test('four shots require four independent manual accuracy and damage stages with one input/turn',()=>{
 const {room,a,b,unit}=fixture();locks.state(a).targets.push({targetId:'b',systemId:'lock',controllerUnitId:'u'});assert.equal(weapons.queue(room,unit,command).ok,true);assert.equal(weapons.queue(room,unit,command).duplicate,true);assert.equal(a.ship.minerals.Iron,5);assert.equal(unit.delayedAction.consumeTurn,true);assert.equal(unit.delayedAction.rollConfirmed,undefined);
 const ids=new Set();for(let i=1;i<=4;i++){const pending=unit.delayedAction;assert.equal(pending.weaponOrder.burst.shot,i);assert.equal(pending.weaponOrder.locked,undefined);assert.equal(pending.consumeTurn,i===1);if(i>1){assert.equal(pending.remaining,0);assert.equal(pending.awaitingRoll,true);assert.equal(pending.rollBeforeDelay,false);}ids.add(pending.id);attack(room,unit,11);assert.equal(b.currentHullHp,80-3*(i-1));assert.deepEqual(unit.delayedAction.rollSpec.sides,[10]);assert.equal(unit.delayedAction.consumeTurn,false);ids.add(unit.delayedAction.id);weapons.resolveDamage(room,unit,[3]);}
 assert.equal(ids.size,8);assert.equal(unit.delayedAction,null);assert.equal(a.ship.minerals.Iron,2);assert.equal(b.currentHullHp,68);assert.equal(weapons.queue(room,unit,command).duplicate,true);assert.equal(a.ship.minerals.Iron,2);
});
test('misses continue with fresh manual rolls and insufficient ammo shortens the burst',()=>{
 for(const iron of [1,2,3,4]){const {room,a,b,unit}=fixture(iron);weapons.queue(room,unit,command);for(let i=0;i<iron;i++){assert.equal(unit.delayedAction.weaponOrder.burst.total,iron);attack(room,unit,0);}assert.equal(unit.delayedAction,null);assert.equal(a.ship.minerals.Iron,0);assert.equal(b.currentHullHp,80);assert.equal(a.weaponState.reports.filter(r=>r.shot).length,iron);}
});
test('impairment changes each shot to D6, including damage changes during input',()=>{
 const {room,b,unit,gun}=fixture();weapons.queue(room,unit,command);gun.impairmentPoints=1;attack(room,unit);assert.deepEqual(unit.delayedAction.rollSpec.sides,[6]);assert.throws(()=>weapons.resolveDamage(room,unit,[7]),/damage dice/);weapons.resolveDamage(room,unit,[6]);assert.equal(b.currentHullHp,74);gun.impairmentPoints=0;attack(room,unit);assert.deepEqual(unit.delayedAction.rollSpec.sides,[10]);
});
test('shields absorb all four hits without damage rolls, while zero EN/AU still permits firing',()=>{
 const {room,a,b,unit}=fixture();a.ship.sicInventory.find(i=>i.id==='en').status='powered-down';b.ship.sicInventory.push({id:'shield',type:'shield-1'});b.ship.placements.push({sicId:'shield',cell:85});shields.refresh(room);const before=b.currentShieldHp;assert.equal(power.output(a,room.units).en,0);assert.equal(weapons.queue(room,unit,command).ok,true);for(let i=0;i<4;i++)attack(room,unit);assert.equal(unit.delayedAction,null);assert.equal(b.currentShieldHp,before);assert.equal(b.currentHullHp,80);assert.equal(a.auState.current,0);assert.equal(a.ship.minerals.Iron,2);
});
test('target destruction or leaving the operating station cancels unfired shots without spending their Iron',()=>{
 const f=fixture();f.b.currentHullHp=3;weapons.queue(f.room,f.unit,command);attack(f.room,f.unit);weapons.resolveDamage(f.room,f.unit,[3]);assert.equal(f.unit.delayedAction,null);assert.equal(f.a.ship.minerals.Iron,5);
 const g=fixture();weapons.queue(g.room,g.unit,command);g.unit.location.stationed=false;attack(g.room,g.unit);assert.equal(g.unit.delayedAction,null);assert.equal(g.a.ship.minerals.Iron,5);assert.equal(g.b.currentHullHp,80);
});
test('serialized follow-up stages preserve GM ownership and automatic-roll presentation metadata',()=>{
 const f=fixture();weapons.queue(f.room,f.unit,command);f.unit.delayedAction.rollController='gm';f.unit.delayedAction.automated=true;attack(f.room,f.unit);const saved=structuredClone(f.room),unit=saved.units[0];assert.equal(unit.delayedAction.rollController,'gm');assert.equal(unit.delayedAction.automated,true);weapons.resolveDamage(saved,unit,[2]);assert.equal(unit.delayedAction.rollController,'gm');assert.equal(unit.delayedAction.automated,true);assert.equal(unit.delayedAction.weaponOrder.burst.shot,2);assert.equal(saved.starships[0].ship.minerals.Iron,4);assert.equal(stations.access(saved,unit,'gun').remote,true);
});
test('invalid ammunition, AU options and out-of-turn commands cannot spend resources',()=>{
 for(const iron of [0,-1,1.5,'4',NaN]){const {room,a,unit}=fixture(iron);assert.equal(weapons.queue(room,unit,command).ok,false);assert.equal(a.ship.minerals.Iron,iron);}
 for(const body of [{sacrifice:1},{boosts:1},{targetId:'a'}]){const {room,a,unit}=fixture();assert.equal(weapons.queue(room,unit,{...command,...body}).ok,false);assert.equal(a.ship.minerals.Iron,6);}
});
