const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),sensors=require('../ship-sensors'),stations=require('../station-access'),carry=require('../crew-carry'),rooms=require('../ship-crew-rooms'),fixture=require('./helpers/crew-room-fixture.cjs');
function scanFixture(){
 const a={id:'a',title:'Observer',ship:{gridCells:[42,43],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'}],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43}]}},b={id:'b',title:'Detected target',sensorScenarioMasking:20,ship:{gridCells:[42],sicInventory:[],placements:[]}},c={...structuredClone(b),id:'c',sensorScenarioMasking:35};
 const unit={id:'u',team:'pc',sensorSkill:0,location:{starshipId:'a',square:43,mesh:4,sicId:'sn',stationed:true}};
 return {room:{showcase:true,starships:[a,b,c],units:[unit],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:10,r:0},{id:'c',q:10,r:0}]},a,b,c,unit};
}
test('scan timing ignores a failed higher-difficulty contact',()=>{
 const {room}=scanFixture(),order={shipId:'a',kind:'area'},checks=sensors.scanChecks(room,order);assert.equal(checks.length,2);
 assert.ok(checks[0].difficulty<checks[1].difficulty);assert.equal(sensors.timingDifficulty(room,order,checks[0].difficulty+1),checks[0].difficulty);
 assert.equal(sensors.timingDifficulty(room,order,100),checks[1].difficulty);
});
test('remote hex checks add five and include adjacent hexes only',()=>{
 const {room}=scanFixture();room.shipPositions[1].q=20;room.shipPositions[2].q=21;
 let checks=sensors.scanChecks(room,{shipId:'a',kind:'hex',hex:{q:20,r:0}});assert.deepEqual(checks.map(c=>c.difficulty),[15,32]);
 room.shipPositions[2].q=22;assert.equal(sensors.scanChecks(room,{shipId:'a',kind:'hex',hex:{q:20,r:0}}).length,1);
 assert.equal(sensors.scanChecks(room,{shipId:'a',kind:'life',hex:{q:20,r:0}})[0].difficulty,15);
});
test('station bonus affects input exactly once and leaves ordinary ATB untouched',()=>{
 const {room,unit}=scanFixture();unit.atb=37;unit.delayedAction={remaining:100,rate:10,sensorOrder:{shipId:'a',sicId:'sn'}};
 stations.adjustInputs(room);assert.equal(100/unit.delayedAction.rate,9);stations.adjustInputs(room);assert.equal(100/unit.delayedAction.rate,9);assert.equal(unit.atb,37);
 unit.location={starshipId:'a',square:42,mesh:0,sicId:'cp',stationed:true};unit.delayedAction={remaining:100,rate:10,sensorOrder:{shipId:'a',sicId:'sn'}};stations.adjustInputs(room);assert.equal(unit.delayedAction.rate,10);
});
test('every interior console has a station, while EXT weapons remain remote',()=>{
 for(const d of Object.values(maps.catalog)){if(d.exterior&&d.weapon)assert.equal(d.stations.length,0);else if((d.shipControl||d.shield||d.sensor||d.weapon||d.lockOn||d.utility||d.hacking)&&!d.bridgeAddon&&d.width>0)assert.ok(d.stations.length,d.name);}
});
test('mesh paths cross the middle of doorways and cannot cross adjacent wall segments',()=>{
 const f=fixture(),layout=maps.buildLayout(f.ship.ship);let checked=0;
 for(const square of layout.hull)for(const side of layout.sides){const other=square+side.offset;if(!side.valid(square)||!layout.hull.has(other)||layout.edge(square,other).kind!=='door')continue;
  const pairs=side.name==='right'?[[2,0],[5,3],[8,6]]:side.name==='left'?[[0,2],[3,5],[6,8]]:side.name==='top'?[[0,6],[1,7],[2,8]]:[[6,0],[7,1],[8,2]];
  pairs.forEach(([a,b],i)=>assert.equal(maps.meshStepAllowed(layout,{square,mesh:a},{square:other,mesh:b}),i===1));checked++;
 }
 assert.ok(checked>0);const start={square:22,mesh:4},end={square:147,mesh:4},route=maps.meshRoute(layout,start,end);assert.ok(route?.length);let prior=start;for(const step of route){assert.ok(maps.meshStepAllowed(layout,prior,step));prior=step;}assert.deepEqual(prior,end);
});
test('carried unconscious crew follow movement, can revive in Medbay, and drop on carrier defeat',()=>{
 const f=fixture(),patient={id:'patient',characterName:'Patient',currentHp:0,maximumHp:10,location:{...f.unit.location,mesh:0}};f.room.units.push(patient);
 assert.equal(carry.candidates(f.room,f.unit).length,1);carry.command(f.room,f.unit,patient.id);f.unit.location.square++;carry.sync(f.room);assert.equal(patient.location.square,f.unit.location.square);assert.equal(patient.location.stationed,false);
 f.unit.currentHp=0;carry.sync(f.room);assert.equal(patient.carriedBy,null);assert.equal(f.unit.carryingId,null);
 f.unit.currentHp=10;f.seat('med');patient.location={...f.unit.location};carry.command(f.room,f.unit,patient.id);rooms.advance(f.room,f.campaign,63);carry.sync(f.room);assert.equal(patient.currentHp,1);assert.equal(f.unit.carryingId,null);
});
test('carry rejects living, distant and already carried patients',()=>{
 const f=fixture(),patient={id:'patient',currentHp:1,location:{...f.unit.location}};f.room.units.push(patient);assert.throws(()=>carry.command(f.room,f.unit,'patient'),/0 HP/);patient.currentHp=0;patient.location.square++;assert.throws(()=>carry.command(f.room,f.unit,'patient'),/same square/);patient.location.square--;patient.carriedBy='other';assert.throws(()=>carry.command(f.room,f.unit,'patient'),/same square/);
});

test('carry requires an actual shared ship square, not two missing locations',()=>{assert.deepEqual(carry.candidates({units:[{id:'down',currentHp:0}]},{id:'carrier',currentHp:10}),[]);});
