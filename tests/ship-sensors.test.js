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
  for(let i=1;i<=9;i++){const d=maps.definition(`sensors-${i}`);assert.equal(d.range,6+i*2);assert.equal(d.impairedRange,ranges[i-1]);assert.equal(d.stations.length,1);assert.equal(d.width,i<5?1:2);assert.equal(d.height,i<8?1:2);}
});

test('Scan Area reaches 50 percent farther for two active seconds and retains successful contacts',()=>{
 const {room,a,b,unit}=fixture(3);room.shipPositions[1].q=15;sensors.refresh(room);assert.notEqual(a.sensorState.contacts.b?.level,'detected');
 assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'area',requestId:'pulse-range-scan'}).ok,true);assert.equal(a.sensorState.pulse,undefined);
 const roll=()=>6;roll.submittedScore=16;sensors.resolveInput(room,unit,roll);
 assert.equal(a.sensorState.contacts.b.level,'detected');assert.equal(sensors.pulseRange(a),18);assert.equal(sensors.rangeAgainst(room,a,b),12,'Lock and hacking ranges remain normal');
 sensors.advance(room,.5,()=>3);assert.equal(a.sensorState.pulse.remaining,1.5);
 const restored=JSON.parse(JSON.stringify(room)),own=restored.starships[0];sensors.advance(restored,1.5,()=>3);assert.equal(own.sensorState.pulse,undefined);sensors.refresh(restored);assert.equal(own.sensorState.contacts.b.level,'detected');assert.equal(sensors.pulseRange(own),12);
 assert.equal(sensors.view(room,'b').starships.find(s=>s.id==='a')?.sensorState,undefined);
});

test('pulse reuses the check for arriving targets, requires a sufficient score, expires, and does not stack',()=>{
 const {room,a,b,unit}=fixture(3);room.shipPositions[1].q=20;const roll=()=>6;roll.submittedScore=16;
 sensors.queue(room,unit,{sicId:'sn',kind:'area',requestId:'pulse-arrival-one'});sensors.resolveInput(room,unit,roll);assert.notEqual(a.sensorState.contacts.b?.level,'detected');
 room.shipPositions[1].q=17;sensors.advance(room,.5,()=>3);assert.notEqual(a.sensorState.contacts.b?.level,'detected');
 room.shipPositions[1].q=15;sensors.advance(room,.5,()=>3);assert.equal(a.sensorState.contacts.b.level,'detected');
 sensors.queue(room,unit,{sicId:'sn',kind:'area',requestId:'pulse-arrival-two'});sensors.resolveInput(room,unit,roll);assert.equal(a.sensorState.pulse.remaining,2);assert.equal(sensors.pulseRange(a),18);
 sensors.advance(room,2,()=>3);delete a.sensorState.contacts.b;room.shipPositions[1].q=13;sensors.refresh(room);sensors.advance(room,.1,()=>3);assert.notEqual(a.sensorState.contacts.b?.level,'detected');
});

test('Systems Analysis report processing uses 12 minus sensor grade, separately from input',()=>{
  for(const tier of [1,3,5,9]){
    const {room,a,b,unit}=fixture(tier);b.sensorScenarioMasking=1;
    room.shipPositions[1].q=2;sensors.refresh(room);
    assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'tier-analysis-'+tier}).ok,true);
    assert.ok(unit.delayedAction);assert.equal(unit.queuedEffects,undefined);
    sensors.resolveInput(room,unit,()=>6);
    assert.equal(unit.queuedEffects[0].rate,100/(12-tier));
    assert.match(unit.queuedEffects[0].label,/processing report/);
    assert.ok(a.sensorState.reports[0].text.includes(`${12-tier} combat seconds`));
  }
});

test('analysis retry bonus is included once in the reported total',()=>{
  const {room,a,b,unit}=fixture();sensors.refresh(room);
  const die=()=>4;die.submittedScore=40;
  assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'hex',hex:{q:10,r:0},requestId:'retry-detect'}).ok,true);sensors.resolveInput(room,unit,die);
  b.ship.defenseScore=20;die.submittedScore=5;
  assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'retry-first'}).ok,true);sensors.resolveInput(room,unit,die);assert.equal(a.sensorState.reports[0].total,5);
  assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'retry-second'}).ok,true);sensors.resolveInput(room,unit,die);assert.equal(a.sensorState.reports[0].total,6);
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
  assert.equal(state.starships[1].title,'Unknown Object');assert.equal(state.shipPositions[1].q,10);
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
test('detection announcement contains class and affiliation without repeating every tick',()=>{
  const {room,a,b}=fixture();b.ship.class='8x7 Systems Test Craft';b.sensorScenarioMasking=10;
  sensors.refresh(room);
  assert.match(a.sensorState.reports[0].text,/Secret b Class 8x7 Systems Test Craft Starship detected. Affiliation: Hidden Faction/);
  sensors.refresh(room);assert.equal(a.sensorState.reports.filter(r=>r.detected).length,1);
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
  assert.equal(unit.queuedEffects[0].rate,100/9);unit.location.stationed=false;sensors.resolveReport(room,unit,unit.queuedEffects[0]);
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

test('analysis survives feed overflow, serialization and Share Data without exposing new enemy equipment',()=>{
  const {room,a,b,unit}=fixture();b.sensorScenarioMasking=1;sensors.refresh(room);
  sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'persistent-layout'});sensors.resolveInput(room,unit,()=>6);sensors.resolveReport(room,unit,unit.queuedEffects[0]);
  const captured=structuredClone(sensors.analysis(a,'b'));
  for(let i=0;i<35;i++){sensors.queue(room,unit,{sicId:'sn',kind:'area',requestId:'overflow-scan-'+i});sensors.resolveInput(room,unit,()=>6);}
  assert.equal(a.sensorState.reports.some(r=>r.analysis),false);assert.deepEqual(sensors.analysis(a,'b'),captured);
  b.ship.sicInventory.push({id:'secret-new',type:'darkveil-10'});b.ship.placements.push({sicId:'secret-new',cell:44});
  const saved=structuredClone(room),visible=sensors.view(saved,'a');assert.equal(visible.starships.find(s=>s.id==='b').analyzedContact,true);assert.ok(!JSON.stringify(visible).includes('secret-new'));
  sensors.queue(room,unit,{sicId:'sn',kind:'share',targetIds:['b'],requestId:'share-archived-analysis'});sensors.resolveInput(room,unit,()=>6);
  assert.equal(sensors.analysis(b,'b').sharedBy,a.title);
  const legacy=structuredClone(a);delete legacy.sensorState.analyses;legacy.sensorState.reports=[captured];assert.deepEqual(sensors.analysis(legacy,'b'),captured);
});
test('analysis reveals layout but Life Scan gates anonymous real ATB and never reveals locations',()=>{
  const {room,a,b,unit}=fixture();b.sensorScenarioMasking=1;room.units[1].atb=73;room.units[1].speed=4;room.activeId='enemy';sensors.refresh(room);
  room.units.unshift({id:'hidden-ai',shipAi:true,characterName:'Secret AI',atb:99,speed:5,location:{starshipId:'b'}});
  assert.equal(sensors.view(room,'a').hiddenActiveTurn,true);room.activeId=unit.id;
  sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'layout-analysis'});sensors.resolveInput(room,unit,()=>6);sensors.resolveReport(room,unit,unit.queuedEffects[0]);
  let view=sensors.view(room,'a');assert.equal(view.starships[1].analyzedContact,true);assert.equal(view.units.length,1);
  sensors.queue(room,unit,{sicId:'sn',kind:'life',hex:{q:10,r:0},requestId:'life-anonymous'});sensors.resolveInput(room,unit,()=>6);
  view=sensors.view(room,'a');assert.equal(view.units[1].atb,73);assert.equal(view.units[1].characterName,'Lifeform 1');assert.deepEqual(view.units[1].location,{starshipId:'b'});assert.ok(!JSON.stringify(view).includes('Secret Crew'));
  assert.equal(sensors.view(room,null).starships.length,0);
});
test('unknown contacts hide defense; detected contacts reveal the current score',()=>{
  const {room,unit}=fixture();sensors.refresh(room);
  assert.equal(sensors.difficulty(room,'a','hex','b',{q:10,r:0}).value,null);
  sensors.queue(room,unit,{sicId:'sn',kind:'hex',hex:{q:10,r:0},requestId:'learn-mask'});sensors.resolveInput(room,unit,()=>6);
  assert.equal(sensors.difficulty(room,'a','hex','b',{q:10,r:0}).value,8);
  assert.equal(sensors.difficulty(room,'a','analysis','b').value,18);
});

test('failed analysis adds a retry bonus, while successful detection clears uncertainty',()=>{
  const {room,a,b,unit}=fixture();sensors.refresh(room);assert.equal(a.sensorState.contacts.b.uncertainty,5);
  sensors.queue(room,unit,{sicId:'sn',kind:'hex',hex:{q:10,r:0},requestId:'resolve-unknown'});sensors.resolveInput(room,unit,()=>6);
  assert.equal(a.sensorState.contacts.b.uncertainty,undefined);
  b.sensorScenarioMasking=5;
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

test('Life Scan combines other ships in the hex, excluding own crew, Androids and digital AI',()=>{
  const {room,a,b,unit}=fixture();room.shipPositions[1].q=0;
  const c=structuredClone(b);c.id='c';room.starships.push(c);room.shipPositions.push({id:'c',q:0,r:0});
  room.units.push({id:'android',raceId:'android',location:{starshipId:'b'}},{id:'other',raceId:'human',location:{starshipId:'c'}});
  room.units.push({id:'ai',shipAi:true,location:{starshipId:'b'}});
  assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'life',hex:{q:0,r:0},requestId:'life-count-test'}).ok,true);
  sensors.resolveInput(room,unit,()=>4);assert.equal(a.sensorState.reports[0].count,2);
  assert.equal(a.sensorState.reports[0].pending,undefined);
});

test('analysis preserves expanded split-mount geometry without exposing crew or cargo',()=>{
  const {room,b,unit}=fixture();b.sensorScenarioMasking=1;
  b.ship={zoneColumns:28,zoneRows:28,thrusterDirection:90,gridCells:[292,293],placements:[{sicId:'gun',cell:292,exteriorCell:264}],
    sicInventory:[{id:'gun',type:'beam-laser-3',rotation:90,exteriorRotation:270,stationLayout:'corners-v1'},{id:'secret-cargo',type:'rapid-laser-1'}],doorStates:{},secret:'hidden'};
  sensors.refresh(room);assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'expanded-analysis'}).ok,true);
  sensors.resolveInput(room,unit,()=>6);sensors.resolveReport(room,unit,unit.queuedEffects[0]);
  const view=sensors.view(room,'a'),scanned=view.starships.find(s=>s.id==='b').ship;
  assert.equal(scanned.zoneColumns,28);assert.equal(scanned.zoneRows,28);assert.equal(scanned.thrusterDirection,90);
  assert.deepEqual(scanned.placements,b.ship.placements);assert.equal(scanned.sicInventory[0].exteriorRotation,270);
  assert.equal(maps.exteriorError(scanned),'');const geometry=ship=>[...maps.buildLayout(ship).footprint].map(([n,{sicId,column,row,width,height,segment,rotation,stations}])=>[n,{sicId,column,row,width,height,segment,rotation,stations}]);assert.deepEqual(geometry(scanned),geometry(b.ship));
  assert.equal(scanned.secret,undefined);assert.equal(scanned.sicInventory.length,1);assert.equal(view.units.length,1);
});
test('completed analysis blocks repeated actions and condition icons follow live damage privately',()=>{
 const {room,a,b,unit}=fixture();b.sensorScenarioMasking=1;sensors.refresh(room);
 sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'analyze-once'});sensors.resolveInput(room,unit,()=>6);sensors.resolveReport(room,unit,unit.queuedEffects[0]);
 assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'analyze-again'}).error,'Ship Already Analyzed');assert.equal(unit.delayedAction,null);
 b.currentHullHp=21;b.maximumHullHp=56;sensors.refresh(room);const contact=sensors.view(room,'a').starships.find(s=>s.id==='b');
 assert.deepEqual(require('../health-display').segments(contact.currentHullHp,contact.maximumHullHp),require('../health-display').segments(21,56));assert.notEqual(contact.maximumHullHp,56);
 assert.equal(a.sensorState.analyses.b.hull.current,33,'Historical analysis remains a snapshot');
});


test('area reports include scenery within pulse range, exclude collected and distant objects, and retain IDs',()=>{
 const {room,a,unit}=fixture(3);room.shipPositions[1].q=100;
 room.spaceObjects=[{id:'mineral',kind:'mineral',name:'Iron',q:1,r:0},{id:'planet',kind:'planet',name:'Twin',q:18,r:0},{id:'asteroid',kind:'asteroid',name:'Twin',q:0,r:18},{id:'debris',kind:'planet',name:'Vesper',q:2,r:0,destroyedAt:123},{id:'outside',name:'Far',q:19,r:0},{id:'collected',name:'Gone',q:0,r:0,collectedBy:'a'}];
 assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'area',requestId:'scenery-area'}).ok,true);
 sensors.resolveInput(room,unit,()=>{throw Error('Scenery must not require an extra roll');});
 const report=a.sensorState.reports[0];assert.deepEqual(report.objectRefs,[{id:'mineral',label:'Iron'},{id:'planet',label:'Twin'},{id:'asteroid',label:'Twin'},{id:'debris',label:'Vesper / Destroyed'}]);
 assert.match(report.text,/Objects within sensor range: Iron, Twin, Twin, Vesper \/ Destroyed\./);
 const restored=JSON.parse(JSON.stringify(room));assert.deepEqual(sensors.view(restored,'a').starships.find(s=>s.id==='a').sensorState.reports[0].objectRefs,report.objectRefs);
});
