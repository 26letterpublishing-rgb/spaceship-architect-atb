const test=require('node:test');
const assert=require('node:assert/strict');
const navigation=require('../ship-navigation');
const maps=require('../ship-map-core');
const distances=require('../ship-distances');
const power=require('../ship-power');
const combat=require('../combat-engine');

function fixture() {
  const ship={id:'ship',title:'Flight Test',ship:{gridCells:[21,22,41,42],sicInventory:[{id:'cockpit',type:'cockpit-1'},{id:'thruster',type:'ionic-pulse-thruster-1'},{id:'au',type:'au-engine-1'}],placements:[{sicId:'cockpit',cell:21},{sicId:'thruster',cell:20},{sicId:'au',cell:42}]}};
  const unit={id:'pilot',characterName:'Pilot',atb:100,location:{environment:'starship',starshipId:'ship',square:21,mesh:0,sicId:'cockpit',stationed:true}};
  ship.ship.sicInventory.push({id:'en',type:'en-engine-1'});ship.ship.placements.push({sicId:'en',cell:22});
  const room={starships:[ship],shipPositions:[{id:'ship',q:0,r:0}],units:[unit],activeId:unit.id,threshold:100,pausedForTurn:true};
  power.refresh(room,{reset:true});
  const helpers={clearActiveCommand(){},pushLog(){},moveToNextTurnOrClock(){}};
  return {room,ship,unit,helpers};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('Cockpit 1 matches its printed construction stats and requires an outer interior edge',()=>{
  const def=maps.definition('cockpit-1');
  assert.deepEqual([def.price,def.energyCost,def.security,def.width,def.height,def.threshold,def.stations.length],[750,1,4,1,1,20,1]);
  const {ship}=fixture();assert.equal(maps.exteriorError(ship.ship),'');
  const large={gridCells:Array.from({length:25},(_,i)=>21+Math.floor(i/5)*20+i%5),sicInventory:[{id:'c',type:'cockpit-1'}],placements:[{sicId:'c',cell:63}]};
  assert.match(maps.exteriorError(large),/outer hull/);
  large.gridCells=large.gridCells.filter(c=>c!==64); // An enclosed courtyard is not space.
  assert.match(maps.exteriorError(large),/outer hull/);
  large.placements[0].cell=21;assert.equal(maps.exteriorError(large),'');
  large.sicInventory.push({id:'second',type:'cockpit-1'});large.placements.push({sicId:'second',cell:22});
  assert.match(maps.exteriorError(large),/only one/);
});

test('ship actions require an actual occupied operational cockpit and installed thruster',()=>{
  for(const mutate of [u=>u.location.stationed=false,u=>u.location.mesh=4,u=>u.location.sicId='au',u=>u.defeatedAt=1,u=>u.timedAction={kind:'move'}]) {
    const {room,unit}=fixture();assert.ok(navigation.access(room,unit));mutate(unit);assert.equal(navigation.access(room,unit),null);
  }
  for(const id of ['cockpit','thruster']) {const {room,ship,unit}=fixture();ship.ship.sicInventory.find(i=>i.id===id).impaired=true;assert.equal(navigation.access(room,unit),null);}
  const {room,ship,unit}=fixture();ship.ship.placements=ship.ship.placements.filter(p=>p.sicId!=='thruster');assert.equal(navigation.access(room,unit),null);
});

test('Move Starship freezes pilot ATB for input, then spends AU once and launches',()=>{
  const {room,ship,unit,helpers}=fixture();
  assert.equal(combat.resolvePlayerCombatAction(room,unit,{kind:'moveStarship',destination:{q:12,r:0},boostIds:['thruster']},helpers).ok,true);
  assert.equal(room.activeId,null);assert.equal(unit.atb,100);assert.equal(unit.timedAction,undefined);assert.equal(unit.location.stationed,true);
  assert.equal(ship.auState.current,3);assert.equal(ship.navigation,undefined);assert.ok(unit.delayedAction.shipOrder);
  assert.equal(combat.resolvePlayerCombatAction(room,unit,{kind:'moveStarship',destination:{q:30,r:0},boostIds:['thruster']},helpers).ok,false);
  assert.equal(ship.auState.current,3);
  assert.equal(navigation.resolveInput(room,unit).ok,true);assert.equal(ship.auState.current,1);assert.equal(ship.navigation.speed,12);
  navigation.advance(room,6);near(room.shipPositions[0].q,6);
});

test('invalid and unaffordable orders never consume AU or replace a current route',()=>{
  const {room,ship,unit}=fixture();
  navigation.order(room,unit,{destination:{q:20,r:0}});
  const old=JSON.stringify(ship.navigation);
  for(const body of [{destination:{q:NaN,r:0}},{destination:{q:1.2,r:0}},{destination:{q:10001,r:0}},{destination:{q:0,r:0}},{destination:{q:3,r:0},boostIds:['thruster','thruster']},{destination:{q:3,r:0},boostIds:['unknown']}]) {
    assert.equal(navigation.order(room,unit,body).ok,false);assert.equal(JSON.stringify(ship.navigation),old);assert.equal(ship.auState.current,3);
  }
  ship.auState.current=1;assert.equal(navigation.order(room,unit,{destination:{q:3,r:0},boostIds:['thruster']}).ok,false);assert.equal(JSON.stringify(ship.navigation),old);
});

test('departure and cockpit or base thruster impairment do not interrupt a valid order',()=>{
  const {room,ship,unit}=fixture();navigation.order(room,unit,{destination:{q:11,r:0}});
  unit.location.stationed=false;ship.ship.sicInventory.forEach(i=>i.impaired=true);
  navigation.advance(room,12);near(room.shipPositions[0].q,11);assert.equal(ship.navigation.phase,'drift');assert.equal(ship.navigation.speed,3);
  navigation.advance(room,12);near(room.shipPositions[0].q,14);assert.equal(ship.navigation.phase,'stopped');
});

test('lost boosts remove only remaining boosted speed and cannot reverse traveled distance',()=>{
  const {room,ship,unit}=fixture();navigation.order(room,unit,{destination:{q:24,r:0},boostIds:['thruster']});
  navigation.advance(room,6);near(room.shipPositions[0].q,6);
  ship.ship.sicInventory.find(i=>i.id==='thruster').impaired=true;
  navigation.advance(room,6);near(room.shipPositions[0].q,11.5);assert.equal(ship.navigation.speed,11);assert.equal(ship.navigation.boosts.length,0);
  ship.ship.sicInventory.find(i=>i.id==='thruster').impaired=false;
  navigation.advance(room,6);near(room.shipPositions[0].q,17);assert.equal(ship.navigation.speed,11);
});

test('inertia repeatedly floors half speed minus two every 12 combat seconds',()=>{
  const {room,ship,unit}=fixture();navigation.order(room,unit,{destination:{q:20,r:0}});
  ship.navigation.baseSpeed=20;
  navigation.advance(room,12);near(room.shipPositions[0].q,20);assert.equal(ship.navigation.speed,8);
  navigation.advance(room,12);near(room.shipPositions[0].q,28);assert.equal(ship.navigation.speed,2);
  navigation.advance(room,12);near(room.shipPositions[0].q,30);assert.equal(ship.navigation.speed,0);
  navigation.advance(room,99);near(room.shipPositions[0].q,30);
});

test('single large tick and fractional ticks produce the same powered route and drift',()=>{
  const {room,ship,unit}=fixture();navigation.order(room,unit,{destination:{q:20,r:-7}});ship.navigation.baseSpeed=20;
  const copy=structuredClone(room);navigation.advance(room,40);
  for(let i=0;i<400;i++)navigation.advance(copy,.1);
  near(room.shipPositions[0].q,copy.shipPositions[0].q);near(room.shipPositions[0].r,copy.shipPositions[0].r);assert.equal(copy.starships[0].navigation.phase,'stopped');
});

test('mid-route and mid-drift retargeting begins at the exact interpolated position',()=>{
  for(const seconds of [3.3,14]) {
    const {room,ship,unit}=fixture();navigation.order(room,unit,{destination:{q:11,r:0}});navigation.advance(room,seconds);
    const origin={...room.shipPositions[0]};assert.ok(origin.q>0);
    assert.equal(navigation.order(room,unit,{destination:{q:-5,r:8}}).ok,true);
    assert.deepEqual(room.shipPositions[0],origin);
    const duration=ship.navigation.remaining;navigation.advance(room,duration);
    near(room.shipPositions[0].q,-5);near(room.shipPositions[0].r,8);
  }
});

test('persisted fractional positions and navigation resume without resetting distance',()=>{
  const {room,unit}=fixture();navigation.order(room,unit,{destination:{q:20,r:5}});navigation.advance(room,2.35);
  const restored=JSON.parse(JSON.stringify(room));assert.deepEqual(distances.positions(restored.starships,restored.shipPositions),room.shipPositions);
  navigation.advance(room,18);navigation.advance(restored,18);assert.deepEqual(restored.shipPositions,room.shipPositions);
  assert.deepEqual(restored.shipDistances,distances.fromPositions(room.starships,room.shipPositions));
});
