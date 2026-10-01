const test=require('node:test'),assert=require('node:assert/strict');
const hacking=require('../ship-hacking'),sensors=require('../ship-sensors'),stations=require('../station-access'),weapons=require('../ship-weapons'),engine=require('../combat-engine');
const navigation=require('../ship-navigation'),commands=require('../ship-commands');
function fixture(){
  const make=id=>({id,title:id,currentHullHp:100,maximumHullHp:100,currentShieldHp:0,ship:{gridCells:[42,43,44,45,62,63,64,65,82,83,84,85],placements:[{sicId:id+'-cp',cell:42},{sicId:id+'-sn',cell:43},{sicId:id+'-hack',cell:44},{sicId:id+'-laser',cell:45}],sicInventory:[{id:id+'-cp',type:'cockpit-1'},{id:id+'-sn',type:'sensors-3'},{id:id+'-hack',type:'hacking-module-5'},{id:id+'-laser',type:'rapid-laser-1'}],doorStates:{}}});
  const a=make('a'),b=make('b'),unit={id:'u',characterId:'c',team:'pc',hackingSkill:4,currentHp:20,atb:100,turnSerial:7,speed:10,location:{starshipId:'a',sicId:'a-cp',square:42,mesh:0,stationed:true}};
  const room={starships:[a,b],units:[unit],activeId:'u',threshold:100,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:2,r:0}],log:[]};
  room.showcase=true;a.sensorScenarioMasking=2;b.sensorScenarioMasking=2;
  sensors.refresh(room);sensors.knowledge(a).analyses.b={analysis:true,targetId:'b',layout:structuredClone(b.ship)};
  const open=()=>hacking.command(room,unit,{kind:'open',sicId:'a-hack',targetId:'b',targetSicId:'b-laser',requestId:'open-000001'});
  return {room,a,b,unit,open};
}
test('captured bridge grants the whole ship, remote helm and commands; only reboot restores defenders after signal loss',()=>{
  const {room,a,b,unit}=fixture();
  b.ship.sicInventory.push({id:'power',type:'en-au-engine-1'},{id:'thruster',type:'exhaust-thruster-1'});
  b.ship.placements.push({sicId:'power',cell:82},{sicId:'thruster',cell:41});
  require('../ship-power').refresh(room);b.auState.current=b.auState.maximum;
  const opened=hacking.command(room,unit,{kind:'open',sicId:'a-hack',targetId:'b',targetSicId:'b-cp',requestId:'capture-bridge-open'});
  hacking.command(room,unit,{kind:'guess',sessionId:opened.sessionId,guess:hacking.challenge(room,hacking.state(room).sessions[0]).answer,turnSerial:7,requestId:'capture-bridge-guess'});
  for(const id of ['b-cp','b-sn','b-laser'])assert.equal(stations.access(room,unit,id).controlled,true,id);
  assert.equal(stations.access(room,unit,'b-cp').kind,'pilot');
  let queued=navigation.queue(room,unit,{sicId:'b-cp',destination:{q:3,r:0}});assert.equal(queued.ok,true,queued.error);
  assert.equal(unit.delayedAction.shipOrder.shipId,'b');assert.equal(navigation.resolveInput(room,unit).ok,true);assert.equal(b.navigation.pilotId,unit.id);assert.equal(a.navigation,undefined);
  queued=commands.queue(room,unit,{sicId:'b-cp',kind:'evade',requestId:'remote-bridge-evade'});assert.equal(queued.ok,true,queued.error);
  const manual=()=>6;manual.submittedScore=20;commands.resolveInput(room,unit,manual);assert.equal(b.commandSystems.evasions[0].defense,20+require('../ship-map-core').propulsion(b).hsm);
  unit.hackingSessions=hacking.project(room,unit);
  const visible=hacking.capturedView(sensors.view(room,'a'),room,'c');
  const remote=visible.starships.find(s=>s.id==='b');assert.equal(remote.navigation.pilotId,unit.id);assert.equal(stations.access(visible,visible.units[0],'b-cp').controlled,true);
  room.shipPositions[1].q=100;hacking.refresh(room);assert.equal(b.hackedSystems[0].bridge,true);assert.equal(stations.access(room,unit,'b-cp'),null);
  b.ship.sicInventory[0].disabled=true;hacking.refresh(room);assert.equal(b.hackedSystems.length,0);assert.equal(hacking.project(room,unit)[0].invalidated,true);
});
test('empty and deterministic scans never call dice; uncertain contacts still require a roll',()=>{
  const {room,a,b,unit}=fixture(),order={shipId:'a',sicId:'a-sn',kind:'area',station:stations.station(room,unit).key};
  room.shipPositions[1].q=100;assert.deepEqual(sensors.automaticScan(room,unit,order),[]);
  unit.delayedAction={sensorOrder:order};sensors.resolveInput(room,unit,()=>{throw Error('Unnecessary dice');});
  assert.equal(a.sensorState.reports[0].text,'No contacts resolved in the scanned area. Unknown markers indicate approximate locations. No map objects within sensor range.');assert.equal(a.sensorState.reports[0].total,undefined);
  room.shipPositions[1].q=2;b.sensorScenarioMasking=25;assert.equal(sensors.automaticScan(room,unit,order),null);
  b.sensorScenarioMasking=100;assert.deepEqual(sensors.automaticScan(room,unit,order),[]);
  b.sensorScenarioMasking=-10;assert.equal(sensors.automaticScan(room,unit,order)[0].id,'b');
});
test('guaranteed Systems Analysis skips dice but retains processing and impossible checks retain retry progress',()=>{
  const {room,a,b,unit}=fixture(),order={shipId:'a',sicId:'a-sn',kind:'analysis',targetId:'b',station:stations.station(room,unit).key};
  unit.sensorSkill=5.5;b.sensorScenarioMasking=8;
  assert.deepEqual(sensors.automaticScan(room,unit,order),{success:true});unit.delayedAction={sensorOrder:order};sensors.resolveInput(room,unit,()=>{throw Error('Unnecessary dice');});
  assert.ok(unit.queuedEffects[0].sensorReport);assert.equal(unit.queuedEffects[0].sensorReport.total,undefined);
  b.commandSystems={evasions:[{defense:100,remaining:20}]};unit.delayedAction={sensorOrder:order};sensors.resolveInput(room,unit,()=>{throw Error('Impossible dice');});
  assert.equal(a.sensorState.failures.b,1);assert.match(a.sensorState.reports[0].text,/insufficient sensor resolution/);
});
test('a captured bridge includes its Hacking Module, and relayed control is revoked when that bridge reboots',()=>{
  const {room,b,unit}=fixture(),c=structuredClone(b);c.id='c';c.title='C';
  c.ship.sicInventory.forEach(i=>i.id=i.id.replace(/^b-/,'c-'));c.ship.placements.forEach(p=>p.sicId=p.sicId.replace(/^b-/,'c-'));room.starships.push(c);room.shipPositions.push({id:'c',q:4,r:0});sensors.refresh(room);
  sensors.knowledge(b).analyses.c={layout:structuredClone(c.ship)};
  function capture(module,target,sic,receipt){const opened=hacking.command(room,unit,{kind:'open',sicId:module,targetId:target,targetSicId:sic,requestId:receipt+'-open'}),session=hacking.state(room).sessions.find(s=>s.id===opened.sessionId);hacking.command(room,unit,{kind:'guess',sessionId:session.id,guess:hacking.challenge(room,session).answer,turnSerial:7,requestId:receipt+'-guess'});return session;}
  const parent=capture('a-hack','b','b-cp','relay-bridge');assert.equal(stations.access(room,unit,'b-hack').kind,'hacking');
  const child=capture('b-hack','c','c-laser','relay-module');assert.equal(child.relayId,parent.id);assert.equal(stations.access(room,unit,'c-laser').controlled,true);
  b.ship.sicInventory.find(i=>i.id==='b-cp').disabled=true;hacking.refresh(room);assert.equal(stations.access(room,unit,'c-laser'),null);assert.equal(child.control,false);
});
test('live module access, manual guesses, one-letter floor and retry receipts',()=>{
  const {room,unit,open}=fixture();assert.equal(stations.access(room,unit,'a-hack').kind,'hacking');
  const opened=open(),s=hacking.state(room).sessions[0],board=hacking.challenge(room,s);
  assert.equal(board.length,1);assert.equal(opened.spent,false);
  const body={kind:'guess',sessionId:opened.sessionId,guess:board.answer,turnSerial:7,requestId:'guess-00001'};
  assert.equal(hacking.command(room,unit,body).spent,true);
  unit.atb=0;room.activeId=null;
  assert.equal(hacking.command(room,unit,body).duplicate,true);assert.equal(s.history.length,1);
  assert.throws(()=>hacking.command(room,unit,{...body,requestId:'guess-00002'}),/earned turn/);
  assert.throws(()=>hacking.command(room,unit,{...body,guess:[board.answer[0]==='Z'?'Y':'Z']}),/receipt/);
  const json=JSON.stringify(hacking.project(room,unit));for(const field of ['password','answer','decoys','secretId','reduction','version'])assert.ok(!json.includes(`"${field}"`),field);
});
test('invalid guesses preserve the earned action and require matching turn identity',()=>{
  const {room,unit,open}=fixture(),s=open();
  const body={kind:'guess',sessionId:s.sessionId,guess:['A','A'],turnSerial:7,requestId:'guess-invalid'};
  assert.throws(()=>hacking.command(room,unit,body),/Fill all/);assert.equal(unit.atb,100);
  assert.throws(()=>hacking.command(room,unit,{...body,turnSerial:6}),/earned turn/);
});
test('captured console blocks the crew while the hacker retains captured access; range loss and reboot recover it',()=>{
  const {room,b,unit,open}=fixture(),s=open();
  hacking.command(room,unit,{kind:'guess',sessionId:s.sessionId,guess:hacking.challenge(room,hacking.state(room).sessions[0]).answer,turnSerial:7,requestId:'capture-0001'});
  const defender={...unit,id:'d',location:{starshipId:'b',square:42,mesh:0,sicId:'b-cp',stationed:true}};room.units.push(defender);
  assert.equal(stations.access(room,defender,'b-laser').blocked,true);
  assert.equal(stations.access(room,unit,'b-laser').controlled,true);
  assert.equal(weapons.queue(room,defender,{sicId:'b-laser'}).ok,false);
  room.shipPositions[1].q=100;hacking.refresh(room);assert.equal(b.hackedSystems.length,0);assert.equal(stations.access(room,unit,'b-laser'),null);
  room.shipPositions[1].q=2;hacking.refresh(room);assert.equal(b.hackedSystems.length,0,'range regain cannot restore control for free');
  b.ship.sicInventory.find(i=>i.id==='b-laser').disabled=true;hacking.refresh(room);assert.equal(hacking.project(room,unit)[0].invalidated,true);
});
test('firewall is the strongest installed operational CPU and current puzzle survives impairment',()=>{
  const {room,a,b,unit,open}=fixture();
  b.ship.sicInventory.push({id:'cpu',type:'cpu-security-8'},{id:'backup',type:'cpu-security-6'});b.ship.placements.push({sicId:'cpu',cell:62},{sicId:'backup',cell:82});
  assert.equal(hacking.firewall(b),8);open();const before=hacking.project(room,unit)[0];
  b.ship.sicInventory.find(i=>i.id==='cpu').impairmentPoints=5;
  a.ship.sicInventory.find(i=>i.id==='a-hack').impairmentPoints=2;
  hacking.refresh(room);assert.equal(hacking.firewall(b),6);assert.deepEqual(hacking.project(room,unit)[0].candidates,before.candidates);
});
test('counter-hacking requires a manual D6, applies strict threshold and swaps without revoking captured control',()=>{
  const {room,a,unit}=fixture();unit.hackingSkill=3.1;
  hacking.command(room,unit,{kind:'counter',sicId:'a-cp',turnSerial:7,requestId:'counter-0001'});
  assert.equal(unit.delayedAction.awaitingRoll,true);assert.equal(unit.delayedAction.rollSpec.damage,undefined);
  assert.throws(()=>hacking.counterRoll(room,unit,7),/D6/);assert.ok(unit.delayedAction);
  hacking.counterRoll(room,unit,3);assert.ok(unit.counterHackSwap);
  const secret=hacking.state(room).secrets[JSON.stringify(['a','a-cp'])],before=[...secret.password],id=unit.counterHackSwap.id;
  hacking.swap(room,unit,{swapId:id,first:0,second:1},false);assert.equal(secret.password[0],before[1]);assert.equal(secret.password[1],before[0]);
  assert.equal(unit.counterHackSwap,null);assert.equal(a.hackedSystems.length,0);
});
test('zero health disables initiative and station access; unknown HP is not zero HP',()=>{
  const {room,unit}=fixture();unit.currentHp=0;assert.equal(engine.effectiveSpeed(unit),0);assert.equal(stations.station(room,unit),null);
  unit.currentHp=-2;assert.equal(engine.effectiveSpeed(unit),0);unit.currentHp=null;assert.equal(engine.effectiveSpeed(unit),10);
});
test('approximate sweeps consume only supplied combat time, use anonymous ten-unit regions, and reset stationary bonuses',()=>{
  const {room,a,b}=fixture();room.showcase=true;b.sensorScenarioMasking=100;room.shipPositions[1].q=20;sensors.knowledge(a).contacts={};sensors.refresh(room);
  const pick=()=>0;sensors.advance(room,11.9,pick);assert.equal(Object.keys(a.sensorState.contacts).length,0);
  sensors.advance(room,.1,pick);const contact=a.sensorState.contacts.b;assert.equal(contact.title,'Unknown Object');assert.equal(contact.uncertainty,10);assert.notEqual(contact.id,'b');
  assert.ok(require('../ship-distances').hexDistance(contact.position,room.shipPositions[1])<=10);
  const before=JSON.stringify(contact);sensors.refresh(room);assert.equal(JSON.stringify(a.sensorState.contacts.b),before);
  const view=sensors.view(room,'a');assert.ok(!view.starships.some(s=>s.id==='b'));assert.equal(view.starships[1].ship.sicInventory.length,0);
  a.sensorState.sweep.bonus=3;room.shipPositions[0].q=.1;sensors.refresh(room);assert.equal(a.sensorState.sweep.bonus,0);
});

test('live intrusion cannot open outside combat and local counter-hacking remains available under bridge capture',()=>{
  const {room,unit,open}=fixture();room.hasEngagedClock=false;assert.throws(open,/Begin combat/);room.hasEngagedClock=true;
  const enemy={...unit,id:'enemy',location:{...unit.location,starshipId:'b',sicId:'b-cp'}};room.units.push(enemy);room.activeId=enemy.id;
  sensors.knowledge(room.starships[1]).analyses.a={layout:structuredClone(room.starships[0].ship)};
  const s=hacking.command(room,enemy,{kind:'open',sicId:'b-hack',targetId:'a',targetSicId:'a-cp',requestId:'bridge-open-1'});
  hacking.command(room,enemy,{kind:'guess',sessionId:s.sessionId,guess:hacking.challenge(room,hacking.state(room).sessions[0]).answer,turnSerial:7,requestId:'bridge-guess-1'});
  assert.equal(room.starships[0].hackedSystems[0].bridge,true);room.activeId=unit.id;
  assert.equal(hacking.command(room,unit,{kind:'counter',sicId:'a-cp',turnSerial:7,requestId:'bridge-counter-1'}).spent,true);
  hacking.counterRoll(room,unit,1);assert.ok(unit.counterHackSwap);
  room.starships[0].ship.sicInventory[0].disabled=true;hacking.refresh(room);assert.equal(unit.counterHackSwap,null);
});

test('captured weapons spend the physical ship AU and keep damage manual',()=>{
  const {room,a,b,unit,open}=fixture(),power=require('../ship-power');
  for(const ship of [a,b]){ship.ship.sicInventory.push({id:ship.id+'-engine',type:'en-au-engine-4'});ship.ship.placements.push({sicId:ship.id+'-engine',cell:82});}
  power.refresh(room);for(const ship of [a,b])ship.auState.current=ship.auState.maximum;
  const opened=open();hacking.command(room,unit,{kind:'guess',sessionId:opened.sessionId,guess:hacking.challenge(room,hacking.state(room).sessions[0]).answer,turnSerial:7,requestId:'capture-fire-1'});
  const before=[a.auState.current,b.auState.current];
  const queued=weapons.queue(room,unit,{sicId:'b-laser',targetId:'a',requestId:'captured-shot-1'});assert.equal(queued.ok,true,queued.error);
  assert.equal(a.auState.current,before[0]);assert.equal(b.auState.current,before[1]-5);
  const manual=()=>{throw Error('No automatic dice');};manual.submittedScore=100;
  weapons.resolveInput(room,unit,manual,manual);assert.ok(unit.delayedAction.weaponDamage);assert.equal(unit.delayedAction.rollSpec.damage,true);
  assert.equal(a.currentHullHp,100);assert.equal(unit.delayedAction.weaponDamage.shipId,'b');
});

test('capturing a weapon does not grant the enemy targeting systems or their locks',()=>{
  const {room,b,unit,open}=fixture(),locks=require('../ship-locks');
  b.ship.sicInventory.push({id:'b-lock',type:'lock-on-1'});b.ship.placements.push({sicId:'b-lock',cell:84});
  const opened=open();hacking.command(room,unit,{kind:'guess',sessionId:opened.sessionId,guess:hacking.challenge(room,hacking.state(room).sessions[0]).answer,turnSerial:7,requestId:'capture-weapon-only'});
  locks.state(b).targets.push({systemId:'b-lock',targetId:'a'});
  assert.equal(weapons.weaponLock(room,unit,b,'a',true),undefined);
  assert.equal(stations.access(room,unit,'b-lock'),null);
  b.hackedSystems.push({sicId:'b-lock',unitId:unit.id});assert.ok(weapons.weaponLock(room,unit,b,'a',true));
  b.hackedSystems=b.hackedSystems.filter(h=>h.sicId!=='b-lock');assert.equal(weapons.weaponLock(room,unit,b,'a',true),undefined);
});

test('hacking secrets, receipt deduplication and fixed puzzles survive serialization; public views omit secrets',()=>{
  const {room,unit,open}=fixture(),opened=open(),s=hacking.state(room).sessions[0];
  const body={kind:'guess',sessionId:opened.sessionId,guess:hacking.challenge(room,s).answer,turnSerial:7,requestId:'persist-guess-1'};
  hacking.command(room,unit,body);const restored=structuredClone(room),person=restored.units[0];
  hacking.refresh(restored);assert.equal(hacking.command(restored,person,body).duplicate,true);assert.equal(person.hackingSkill,unit.hackingSkill);
  assert.deepEqual(hacking.project(restored,person),hacking.project(room,unit));
  const full={...room,units:room.units.map(u=>({...u,hackingSessions:hacking.project(room,u)}))},visible=sensors.view(full,'a');
  full.starships[0].sensorState.contacts['hidden-real-id']={id:'opaque-ping',level:'unknown',title:'Unknown Object',position:{q:10,r:0}};
  const captured=hacking.capturedView(visible,full,unit.characterId);assert.ok(!JSON.stringify(captured.starships).includes('hidden-real-id'));
});

test('Scan Area improves the automatic chance only when stationary throughout input',()=>{
  const {room,a,unit}=fixture();
  assert.equal(sensors.queue(room,unit,{kind:'area',sicId:'a-sn',requestId:'scan-stationary-1'}).ok,true);sensors.resolveInput(room,unit,()=>6);assert.equal(a.sensorState.sweep.bonus,1);
  assert.equal(sensors.queue(room,unit,{kind:'area',sicId:'a-sn',requestId:'scan-moving-1'}).ok,true);room.shipPositions[0].q=.2;sensors.resolveInput(room,unit,()=>6);assert.equal(a.sensorState.sweep.bonus,0);
  for(let i=0;i<6;i++){sensors.queue(room,unit,{kind:'area',sicId:'a-sn',requestId:'scan-cap-'+i});sensors.resolveInput(room,unit,()=>6);}assert.equal(a.sensorState.sweep.bonus,3);
});


test('captured SIC shutdown is receipt-safe; Bridge can restart but cannot remotely power on',()=>{
 const {room,a,b,unit,open}=fixture(),maintenance=require('../ship-maintenance');
 const sessionId=open().sessionId,session=hacking.state(room).sessions[0];
 assert.throws(()=>hacking.command(room,unit,{kind:'off',sessionId,turnSerial:7,requestId:'denied-off-001'}),/Capture/);
 hacking.command(room,unit,{kind:'guess',sessionId,guess:hacking.challenge(room,session).answer,turnSerial:7,requestId:'solve-for-off-001'});
 const body={kind:'off',sessionId,turnSerial:7,requestId:'captured-off-001'},item=b.ship.sicInventory.find(i=>i.id==='b-laser');
 const result=hacking.command(room,unit,body);assert.equal(result.spent,true);assert.equal(item.status,'powered-down');assert.equal(item.disabled,true);assert.equal(maintenance.points(item),0);assert.equal(session.control,false);
 assert.equal(hacking.command(room,unit,body).duplicate,true);
 b.crewNpcUnitIds=['defender'];const defender={id:'defender',team:'npc',currentHp:20,location:{starshipId:'b',square:42,mesh:0,stationed:false}};room.units.push(defender);room.activeId=defender.id;
 assert.equal(maintenance.queue(room,defender,{sicId:item.id,kind:'on',requestId:'remote-on-denied'}).ok,false);
 defender.location={starshipId:'b',square:42,mesh:0,stationed:true};
 assert.equal(maintenance.queue(room,defender,{sicId:item.id,kind:'on',requestId:'stationed-remote-denied'}).ok,false);
 const restored=maintenance.queue(room,defender,{sicId:item.id,kind:'restart',requestId:'remote-restart-success'});assert.equal(restored.ok,true,restored.error);assert.ok(item.bootRemaining>0);maintenance.advance(b,item.bootRemaining);assert.equal(item.disabled,false);assert.equal(item.status,'online');assert.equal(maintenance.points(item),0);
});


test('captured shield shutdown removes protection without inflicting shield or hull damage',()=>{
 const {room,a,b,unit}=fixture(),shields=require('../ship-shields');
 b.ship.sicInventory.push({id:'b-shield',type:'shield-1'});b.ship.placements.push({sicId:'b-shield',cell:82});
 shields.refresh(room);sensors.knowledge(a).analyses.b.layout=structuredClone(b.ship);const hp=b.currentShieldHp;assert.ok(hp>0);
 const sessionId=hacking.command(room,unit,{kind:'open',sicId:'a-hack',targetId:'b',targetSicId:'b-shield',requestId:'shield-open-001'}).sessionId;
 const session=hacking.state(room).sessions.find(s=>s.id===sessionId);
 hacking.command(room,unit,{kind:'guess',sessionId,guess:hacking.challenge(room,session).answer,turnSerial:7,requestId:'shield-solve-001'});
 hacking.command(room,unit,{kind:'off',sessionId,turnSerial:7,requestId:'shield-off-001'});shields.refresh(room);
 assert.equal(b.currentShieldHp,0);assert.equal(b.maximumShieldHp,0);assert.equal(b.shieldSystems['b-shield'].hp,hp);assert.equal(b.currentHullHp,100);
});
