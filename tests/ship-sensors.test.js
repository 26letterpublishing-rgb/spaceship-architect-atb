const test=require('node:test'),assert=require('node:assert/strict');
const sensors=require('../ship-sensors'),maps=require('../ship-map-core'),stations=require('../station-access');
function fixture(tier=3){
  const ship=id=>({id,title:`Secret ${id}`,currentHullHp:33,maximumHullHp:40,currentShieldHp:5,maximumShieldHp:10,
    ship:{gridCells:[42,43,44,62,63,64],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43}],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:`sensors-${tier}`}],doorStates:{},affiliation:'Hidden Faction'}});
  const a=ship('a'),b=ship('b');a.sensorScenarioMasking=18;b.sensorScenarioMasking=18;
  const unit={id:'u',characterId:'c',team:'pc',speed:5,atb:100,sensorSkill:0,location:{starshipId:'a',sicId:'cp',square:42,mesh:0,stationed:true}};
  const room={showcase:true,activeId:'u',starships:[a,b],units:[unit,{id:'enemy',characterName:'Secret Crew',location:{starshipId:'b'}}],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:10,r:0}],log:[],threshold:100};
  return {room,a,b,unit};
}
test('all nine sensor tiers retain source dimensions and corrected impaired ranges',()=>{
  const ranges=[4,6,8,10,12,15,16,18,20];
  for(let i=1;i<=9;i++){const d=maps.definition(`sensors-${i}`);assert.equal(d.range,6+i*2);assert.equal(d.impairedRange,ranges[i-1]);assert.equal(d.stations.length,0);assert.equal(d.width,i<5?1:2);assert.equal(d.height,i<8?1:2);}
});
test('sensor access requires a real bridge seat, not sensor room occupancy',()=>{
  const {room,unit}=fixture();assert.equal(stations.access(room,unit,'sn').kind,'sensor');
  unit.location={starshipId:'a',square:43,sicId:'sn',mesh:0,stationed:true};assert.equal(stations.consoles(room,unit).length,0);
});
test('only one installed sensor, but purchased storage is unlimited',()=>{
  const {a}=fixture();a.ship.sicInventory.push({id:'extra',type:'sensors-1'});assert.equal(maps.exteriorError(a.ship),'');
  a.ship.placements.push({sicId:'extra',cell:44});assert.match(maps.exteriorError(a.ship),/one installed Sensor/);
});
test('passive unknown contacts never reveal identity, crew, layout, route or true position',()=>{
  const {room,b}=fixture();room.starships[0].ship.affiliation='Own faction';room.shipPositions[1].q=9;b.navigation={target:{q:40,r:10}};sensors.refresh(room);
  assert.equal(room.starships[0].sensorState.contacts.b.level,'unknown');
  const state=sensors.view({...room,shipDistances:[]},'a'),text=JSON.stringify(state);
  assert.equal(state.starships[1].title,'Unknown contact');assert.equal(state.shipPositions[1].q,10);
  for(const hidden of ['Secret b','Secret Crew','Hidden Faction','"q":40'])assert.ok(!text.includes(hidden));
  assert.equal(state.units.length,1);assert.deepEqual(state.starships[1].ship.sicInventory,[]);
});
test('passive detection, no contact above 30, zero Masking and tracking boundaries',()=>{
  const {room,a,b}=fixture();b.sensorScenarioMasking=10;sensors.refresh(room);assert.equal(a.sensorState.contacts.b.level,'detected');
  room.shipPositions[1].q=24;sensors.refresh(room);assert.ok(a.sensorState.contacts.b);
  room.shipPositions[1].q=24.01;sensors.refresh(room);assert.equal(a.sensorState.contacts.b,undefined);
  room.shipPositions[1].q=10;b.sensorScenarioMasking=31;sensors.refresh(room);assert.equal(a.sensorState.contacts.b,undefined);
  b.sensorScenarioMasking=0;room.shipPositions[1].q=24;sensors.refresh(room);assert.equal(a.sensorState.contacts.b.level,'detected');
});
test('impairment uses lower dice/range, offline sensors lose contacts',()=>{
  const {room,a}=fixture(1);a.ship.sicInventory[1].impaired=true;assert.deepEqual(sensors.installed(a).dice,[2,2]);assert.equal(sensors.installed(a).range,4);
  sensors.refresh(room);assert.deepEqual(a.sensorState.contacts,{});a.ship.sicInventory[1].disabled=true;assert.equal(sensors.installed(a),null);
});
test('sensor input has no skill bonus to speed and increases Quality across tiers',()=>{
  const rates=[];for(let i=1;i<=9;i++){const {a}=fixture(i);const s=sensors.inputSettings(a);assert.equal(s.factors.Ingenuity,0);rates.push(s.rate);}
  assert.deepEqual(rates,[10,10,13,13,15.1,15.1,19.4,19.4,19.4]);
});
test('fusion follows pairs, and command receipts reject duplicate effects and forged targets',()=>{
  assert.equal(sensors.fusedTotal([3,3,2]),8);assert.equal(sensors.fusedTotal([4,4,4,4]),16);
  assert.equal(sensors.fusedTotal([2,2,4]),8,'Fused pairs cannot fuse a second time');
  const {room,unit}=fixture();assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'test-invalid'}).ok,false);
  const body={sicId:'sn',kind:'hex',hex:{q:9,r:0},requestId:'test-receipt'};
  assert.equal(sensors.queue(room,unit,body).ok,true);assert.equal(sensors.queue(room,unit,body).duplicate,true);
  sensors.resolveInput(room,unit,()=>6);assert.equal(room.starships[0].sensorState.contacts.b.level,'detected');assert.equal(unit.delayedAction,null);
});
test('input cancellation, queued analysis survives leaving, and reports are timestamped snapshots',()=>{
  const {room,a,b,unit}=fixture();b.sensorScenarioMasking=1;sensors.refresh(room);
  assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'analysis-first'}).ok,true);
  unit.location.stationed=false;sensors.resolveInput(room,unit,()=>6);assert.equal(unit.queuedEffects,undefined);
  unit.location.stationed=true;sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'analysis-second'});sensors.resolveInput(room,unit,()=>6);
  assert.equal(unit.queuedEffects[0].rate,100/12);unit.location.stationed=false;sensors.resolveReport(room,unit,unit.queuedEffects[0]);
  assert.equal(a.sensorState.reports[0].hull.current,33);b.currentHullHp=1;assert.equal(a.sensorState.reports[0].hull.current,33);
  assert.ok(a.sensorState.reports[0].at);assert.equal(unit.queuedEffects.length,0);
});
test('knowledge persists through serialization and disappears from unrelated ship views',()=>{
  const {room,a,b,unit}=fixture();b.sensorScenarioMasking=1;sensors.refresh(room);
  sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'persist-analysis'});sensors.resolveInput(room,unit,()=>6);
  sensors.resolveReport(room,unit,unit.queuedEffects[0]);const saved=JSON.parse(JSON.stringify(room));sensors.refresh(saved);
  assert.equal(saved.starships[0].sensorState.reports[0].hull.current,33);
  assert.ok(!JSON.stringify(sensors.view(saved,'b')).includes('"hull":{"current":33'));
});

test('failed analysis adds a retry bonus, while successful detection clears uncertainty',()=>{
  const {room,a,b,unit}=fixture();sensors.refresh(room);assert.equal(a.sensorState.contacts.b.uncertainty,5);
  sensors.queue(room,unit,{sicId:'sn',kind:'hex',hex:{q:10,r:0},requestId:'resolve-unknown'});sensors.resolveInput(room,unit,()=>6);
  assert.equal(a.sensorState.contacts.b.uncertainty,undefined);
  b.ship.defenseScore=5;
  for(let attempt=0;attempt<2;attempt++){
    sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:`retry-analysis-${attempt}`});sensors.resolveInput(room,unit,()=>1);
  }
  assert.equal(a.sensorState.failures.b,2);
  sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'retry-analysis-final'});sensors.resolveInput(room,unit,()=>1);
  assert.equal(a.sensorState.failures.b,0);assert.equal(unit.queuedEffects.length,1);
});

test('hex life scan resolves automatically, and console input cannot overlap an AU command',()=>{
  const {room,a,unit}=fixture();a.auCommands=[{unitId:unit.id}];
  const body={sicId:'sn',kind:'life',hex:{q:0,r:0},requestId:'life-area-report'};
  assert.equal(sensors.queue(room,unit,body).ok,false);a.auCommands=[];
  assert.equal(sensors.queue(room,unit,body).ok,true);sensors.resolveInput(room,unit,()=>1);
  assert.equal(a.sensorState.reports[0].pending,undefined);assert.match(a.sensorState.reports[0].text,/Life Scan at 0, 0/);
});

test('sensor mode survives loss of all hardware, and all tier assets exist',()=>{
  const fs=require('node:fs'),path=require('node:path'),{room,a,b}=fixture();sensors.refresh(room);
  a.ship.sicInventory=[];b.ship.sicInventory=[];sensors.refresh(room);assert.equal(room.sensorMode,true);assert.deepEqual(a.sensorState.contacts,{});
  for(let tier=1;tier<=9;tier++)for(const suffix of ['card.png','floor-plan.png','card-web.webp','floor-plan-web.webp'])assert.ok(fs.statSync(path.join(__dirname,'..',`sensors-${tier}-${suffix}`)).size>0);
});

test('Life Scan combines other ships in the hex, excluding own crew and Androids',()=>{
  const {room,a,b,unit}=fixture();room.shipPositions[1].q=0;
  const c=structuredClone(b);c.id='c';room.starships.push(c);room.shipPositions.push({id:'c',q:0,r:0});
  room.units.push({id:'android',raceId:'android',location:{starshipId:'b'}},{id:'other',raceId:'human',location:{starshipId:'c'}});
  assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'life',hex:{q:0,r:0},requestId:'life-count-test'}).ok,true);
  sensors.resolveInput(room,unit,()=>4);assert.equal(a.sensorState.reports[0].count,2);
  assert.equal(a.sensorState.reports[0].pending,undefined);
});
