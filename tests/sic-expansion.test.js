const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),power=require('../ship-power'),drones=require('../ship-drones'),sensors=require('../ship-sensors'),targets=require('../ship-targets'),delays=require('../delay-rules');
const fixture=require('./helpers/crew-room-fixture.cjs');
test('all Repair Drone grades use printed dice, defenses and thresholds, shared timing, serializable rolls and no overflow healing',()=>{
 for(let tier=1;tier<=5;tier++){
  const f=fixture(),type='repair-drone-'+tier,d=maps.definition(type);
  f.ship.ship.sicInventory.push({id:'bay',type});f.ship.ship.placements.push({sicId:'bay',cell:35});
  f.ship.currentHullHp=100;f.ship.maximumHullHp=200;drones.reconcile(f.room);
  const drone=f.ship.ship.droneState.drones.bay,interval=100/delays.calculate(delays.repairDroneSettings(tier)).rate;
  assert.equal(d.price,450+tier*300);assert.equal(d.repairDie,2+tier*2);assert.equal(d.masking,10+tier*2);assert.equal(d.threshold,11+tier*3);
  drones.advance(f.room,interval-.01,()=>{throw Error('Early repair');});
  const restored=JSON.parse(JSON.stringify(f.room));let calls=0;
  drones.advance(restored,.01,sides=>{calls++;assert.equal(sides,d.repairDie);return sides;});
  assert.equal(calls,1);assert.equal(restored.starships[0].currentHullHp,100+d.repairDie);
  assert.equal(restored.starships[0].ship.droneState.reports[0].die,d.repairDie);
  const target=targets.find(f.room,drone.id);assert.equal(target.title,d.name);assert.equal(target.defenseScore,d.masking);assert.equal(target.maximumHullHp,d.threshold);
  assert.equal(targets.hit(f.room,drone.id,d.threshold-1),false);assert.equal(targets.hit(f.room,drone.id,d.threshold),true);
  assert.equal(f.ship.currentHullHp,100);assert.equal(targets.find(f.room,drone.id),undefined);
  restored.starships[0].currentHullHp=199;drones.advance(restored,interval,()=>d.repairDie);assert.equal(restored.starships[0].currentHullHp,200);
 }
});
test('antenna dice participate in ordinary fusion and range stacks only for installed online equipment',()=>{
 const f=fixture();f.ship.ship.sicInventory.push({id:'sensor',type:'sensors-1'});f.ship.ship.placements.push({sicId:'sensor',cell:100});
 for(let tier=1;tier<=4;tier++){
  f.ship.ship.sicInventory.push({id:'ant'+tier,type:'antenna-'+tier});f.ship.ship.placements.push({sicId:'ant'+tier,cell:tier});
 }
 const stats=maps.sensorStats(f.ship);assert.deepEqual(stats.dice,[4,4,6,8,10,12]);assert.equal(stats.range,18);assert.deepEqual(sensors.installed(f.ship).dice,stats.dice);
 assert.equal(sensors.fusedTotal([4,4,6]),14,'antenna die is part of the fused pool');
 for(let tier=1;tier<=4;tier++)f.ship.ship.sicInventory.find(i=>i.id==='ant'+tier).impairmentPoints=1;
 assert.deepEqual(sensors.installed(f.ship).dice,[4,4,4,4,6,6]);assert.equal(maps.sensorStats(f.ship).range,18);
 f.ship.ship.sicInventory.find(i=>i.id==='ant1').disabled=true;f.ship.ship.sicInventory.find(i=>i.id==='ant2').status='destroyed';f.ship.ship.placements=f.ship.ship.placements.filter(p=>p.sicId!=='ant3');
 assert.deepEqual(sensors.installed(f.ship).dice,[4,4,6]);assert.equal(maps.sensorStats(f.ship).range,12);
 f.ship.ship.sicInventory.find(i=>i.id==='sensor').disabled=true;assert.equal(sensors.installed(f.ship),null);assert.deepEqual(maps.sensorStats(f.ship).dice,[]);assert.equal(maps.sensorStats(f.ship).range,0);
});
test('antenna upgrades keep uncertain sensor rolls manual and update automatic scan bounds',()=>{
 const f=fixture();f.ship.ship.sicInventory.push({id:'sensor',type:'sensors-1'},{id:'ant',type:'antenna-4'});f.ship.ship.placements.push({sicId:'sensor',cell:100},{sicId:'ant',cell:0});
 const enemy={id:'enemy',title:'Enemy',currentHullHp:20,maximumHullHp:20,sensorScenarioMasking:20,ship:{gridCells:[0,1,20,21],sicInventory:[],placements:[]}};
 f.room.starships.push(enemy);f.room.showcase=true;f.room.shipPositions=[{id:f.ship.id,q:0,r:0},{id:'enemy',q:2,r:0}];f.unit.sensorSkill=0;
 const order={shipId:f.ship.id,kind:'analysis',targetId:'enemy'};
 assert.equal(sensors.automaticScan(f.room,f.unit,order),null);
 f.ship.ship.sicInventory.find(i=>i.id==='ant').disabled=true;
 assert.deepEqual(sensors.automaticScan(f.room,f.unit,order),{success:false});
});
test('Backup Generator keeps its three EN while impaired, stops when disabled or destroyed, and enforces engine spacing',()=>{
 const ship={gridCells:maps.rectangleCells({},21,8,8),sicInventory:[{id:'g',type:'backup-generator'},{id:'e',type:'en-engine-1'}],placements:[{sicId:'g',cell:21},{sicId:'e',cell:23}]};
 assert.equal(power.output(ship).en,8);assert.equal(maps.exteriorError(ship),'');
 ship.sicInventory[0].impaired=true;ship.sicInventory[0].impairmentPoints=2;ship.sicInventory[0].status='impaired';ship.sicInventory[1].disabled=true;
 assert.equal(power.output(ship).en,3);assert.equal(power.designBudget(ship).output,8);
 ship.sicInventory[0].disabled=true;assert.equal(power.output(ship).en,0);ship.sicInventory[0].disabled=false;ship.sicInventory[0].status='destroyed';assert.equal(power.output(ship).en,0);
 ship.placements[1].cell=22;assert.match(maps.exteriorError(ship),/clear grid square/);
 ship.sicInventory[1].type='en-engine-3';ship.placements[1].cell=24;assert.match(maps.exteriorError(ship),/3 clear/);ship.placements[1].cell=25;assert.equal(maps.exteriorError(ship),'');
});
test('detected upgraded drones retain correct public grade and Defense without exposing owner interiors',()=>{
 const f=fixture();f.ship.ship.sicInventory.push({id:'bay',type:'repair-drone-5'});f.ship.ship.placements.push({sicId:'bay',cell:35});f.ship.currentHullHp=100;drones.reconcile(f.room);
 const drone=f.ship.ship.droneState.drones.bay;sensors.refresh(f.room);const visible=sensors.view(f.room,f.ship.id).starships.find(s=>s.id===drone.id);
 assert.equal(visible.droneTier,5);assert.equal(visible.defenseScore,20);assert.equal(visible.maximumHullHp,26);assert.equal(visible.droneSprite,'repair-drone-5-sprite.webp');assert.deepEqual(visible.ship.sicInventory,[]);
});
