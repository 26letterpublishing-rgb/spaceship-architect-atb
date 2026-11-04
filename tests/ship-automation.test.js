const test=require('node:test'),assert=require('node:assert/strict'),fixture=require('./helpers/crew-room-fixture.cjs'),ai=require('../ship-ai'),policy=require('../ship-automation'),runner=require('../automation-runner'),rooms=require('../ship-crew-rooms'),maps=require('../ship-map-core');
test('automation reserves one free bridge station, rejects occupied/reserved seats and Off releases it',()=>{
 const f=fixture();ai.configure(f.room,f.ship,'defense');ai.sync(f.room,b=>({...b,atb:0}));const u=f.room.units.find(u=>u.shipAi);assert.equal(u.automationMode,'defense');assert.equal(u.speed,10.5);assert.equal(u.commandWindow,94);assert.deepEqual(u.healthDice,[6,6,6,6]);assert.equal(u.engineeringSkill,2.5);
 ai.configure(f.room,f.ship,'off');ai.sync(f.room,b=>b);assert.equal(u.location.stationed,false);assert.equal(u.speed,0);
 for(const [i,seat]of policy.seats(f.ship).filter(s=>s.bridge).entries())f.room.units.push({id:'seat-'+i,timedAction:{stationOnArrival:true,destination:seat}});
 assert.throws(()=>ai.configure(f.room,f.ship,'offense'),/^Error: Free up one station first$/);assert.equal(u.automationMode,'off');
});
test('Ship AI is a bridge add-on with no floorplan footprint',()=>{const f=fixture(),before=maps.buildLayout(f.ship.ship);assert.equal(maps.definition('ship-ai').width,0);assert.equal(maps.definition('ship-ai').height,0);assert.equal(before.footprint.get(22).sicId,'bridge');assert.equal(maps.exteriorError(f.ship.ship),'');});
test('Defense prioritizes incoming locks before evasion',()=>{const f=fixture();ai.configure(f.room,f.ship,'defense');ai.sync(f.room,b=>b);const u=f.room.units.find(u=>u.shipAi);f.room.starships.push({...structuredClone(f.ship),id:'enemy',lockState:{targets:[{targetId:f.ship.id}]}});const c=policy.candidates(f.room,u);assert.equal(c[0].kind,'break');assert.equal(c[1].kind,'evade');});
test('AI room configuration is usable during combat and receipt binds the mode',()=>{const f=fixture();f.seat('bridge');const b={starshipId:f.ship.id,sicId:'ai',kind:'configure',automationMode:'defense',requestId:'ai-configure-test'};rooms.command(f.room,f.unit,b,{campaign:f.campaign});assert.equal(rooms.roomData(f.ship,'ai').automationMode,'defense');assert.equal(rooms.command(f.room,f.unit,b,{campaign:f.campaign}).duplicate,true);assert.throws(()=>rooms.command(f.room,f.unit,{...b,automationMode:'offense'},{campaign:f.campaign}),/receipt/);});
test('automatic dice are staged, preserve results through serialization and respect pause/manual waits',async()=>{
 const f=fixture(),u=f.unit;u.automationMode='npc';u.delayedAction={id:'automatic-roll',label:'Test scan',awaitingRoll:true,automated:true,rollSpec:{sides:[6,6,6,6],bonus:2.5,difficulty:12}};let calls=[];const helpers={act:async b=>{calls.push(b);u.delayedAction=null;f.room.activeId=null;return {ok:true};},publish(){},off(){}};
 f.room.hardPaused=true;await runner.step(f.room,10,helpers);assert.equal(u.automationPresentation,undefined);f.room.hardPaused=false;
 await runner.step(f.room,.1,helpers);const values=[...u.automationPresentation.values];assert.equal(calls.length,0);f.room.units.push({id:'human',delayedAction:{awaitingRoll:true}});await runner.step(f.room,10,helpers);assert.equal(calls.length,0);f.room.units.pop();
 u.automationPresentation=JSON.parse(JSON.stringify(u.automationPresentation));await runner.step(f.room,20,helpers);assert.equal(calls.length,0,'Never apply results before the physical animation finishes');u.automationPresentation.animationComplete=true;for(let i=0;i<8;i++)await runner.step(f.room,.5,helpers);assert.equal(calls.length,1);assert.deepEqual(calls[0].diceResults,values);assert.equal(calls[0].exertion,0);assert.equal(u.automationPresentation.phase,'complete');
});
test('NPC unstationed route selects a bridge and every step obeys doorway geometry',()=>{const f=fixture();f.unit.team='npc';f.unit.location.stationed=false;const c=policy.candidates(f.room,f.unit),route=c[0].route;assert.equal(c[0].stationOnArrival,true);assert.equal(route.at(-1).sicId,'bridge');let prev=f.unit.location;const layout=maps.buildLayout(f.ship.ship);for(const p of route){assert.ok(maps.meshStepAllowed(layout,prev,p));prev=p;}});
function combat(){
 const make=require('../showcase-ships'),a=make('a','Wayfinder','pc',[],146),b=make('b','Enemy','gm',[],146);
 for(const s of [a,b])Object.assign(s,{currentHullHp:100,maximumHullHp:100,currentShieldHp:0,sensorScenarioMasking:10});
 const seat=policy.seats(a).find(s=>s.bridge),unit={id:'ai',team:'npc',shipAi:true,automationMode:'offense',location:seat,atb:100,weaponSystemsSkill:2.5,pilotSkill:2.5,sensorSkill:2.5,dexterityDice:[6,6,6,6],currentHp:20};
 const room={starships:[a,b],units:[unit],activeId:unit.id,threshold:100,hasEngagedClock:true,showcase:true,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0}],log:[]};require('../ship-power').refresh(room,{reset:true});require('../ship-sensors').refresh(room);return {room,a,b,unit};
}
test('Offense chooses lock against shields, missiles without shields, and highest usable zero-AU SICs',()=>{
 const f=combat();f.b.currentShieldHp=30;let choices=policy.candidates(f.room,f.unit);assert.equal(choices[0].kind,'lock');const shots=choices.filter(c=>c.action==='weaponCommand');assert.ok(shots.length);assert.equal(shots[0].sicId,'a-beam');assert.ok(!shots.some(c=>['a-laser','a-ion'].includes(c.sicId)));
 f.b.currentShieldHp=0;choices=policy.candidates(f.room,f.unit);assert.equal(choices[0].missile,true);assert.equal(choices[0].ammunition,'missile-1');
 f.a.ship.sicInventory.find(i=>i.id==='a-beam').impaired=true;f.a.weaponState={repeatWindow:{'a-ripple':12}};choices=policy.candidates(f.room,f.unit);assert.ok(!choices.some(c=>['a-beam','a-ripple'].includes(c.sicId)));
});
test('AI action validators prohibit AU even if an internal policy candidate is wrong',()=>{
 const f=combat(),before=f.a.auState.current;assert.match(require('../ship-weapons').queue(f.room,f.unit,{sicId:'a-laser',targetId:'b',requestId:'ai-forbidden-au'}).error,/never spends AU/);assert.equal(f.a.auState.current,before);
 f.a.ship.sicInventory.find(i=>i.id==='a-lock').type='lock-on-2';require('../ship-locks').state(f.a).targets.push({targetId:'other',systemId:'a-lock'});f.b.currentShieldHp=10;
 assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.kind==='lock'));
});
test('NPC ready shots precede progression; completed analysis and locks are not repeated',()=>{
 const f=npc();let choices=policy.candidates(f.room,f.unit);assert.equal(choices[0].action,'weaponCommand');assert.ok(choices.some(c=>c.kind==='analysis'));assert.ok(choices.some(c=>c.kind==='lock'));
 require('../ship-sensors').knowledge(f.a).analyses.b={targetId:'b',layout:structuredClone(f.b.ship)};
 require('../ship-locks').state(f.a).targets.push({targetId:'b',systemId:'a-lock'});choices=policy.candidates(f.room,f.unit);assert.ok(!choices.some(c=>['analysis','lock'].includes(c.kind)));assert.equal(choices[0].action,'weaponCommand');
});
test('NPC repair arrival enters the real station before issuing a valid repair',()=>{
 const f=fixture();f.unit.team='npc';f.unit.location.stationed=false;f.unit.automationRepairTarget='med';f.ship.ship.sicInventory.find(i=>i.id==='med').impairmentPoints=1;
 assert.equal(policy.candidates(f.room,f.unit)[0].kind,'enterStation');f.unit.location.stationed=true;
 const c=policy.candidates(f.room,f.unit)[0];assert.deepEqual(c,{action:'shipMaintenance',kind:'repair',sicId:'med'});
 assert.equal(require('../ship-maintenance').queue(f.room,f.unit,{...c,requestId:'npc-repair-test'}).ok,true);
});
test('AI can share its host square with another plus add-on and reserve it outside combat',()=>{const f=fixture();f.ship.ship.sicInventory.push({id:'destruct',type:'self-destruct'});f.ship.ship.placements.push({sicId:'destruct',cell:22});assert.equal(maps.exteriorError(f.ship.ship),'');ai.configure(f.room,f.ship,'offense');assert.ok(ai.reservedSeat(f.ship));ai.configure(f.room,f.ship,'off');assert.equal(ai.reservedSeat(f.ship),null);});
test('every fallback station is a real accessible station, including rotated split weapons',()=>{const f=combat();for(const loc of policy.seats(f.a)){const u={...f.unit,shipAi:false,location:loc};assert.ok(require('../station-access').station(f.room,u),JSON.stringify(loc));}f.unit.shipAi=false;f.unit.location.stationed=false;assert.equal(policy.candidates(f.room,f.unit)[0].kind,'enterStation');});
test('launched automatic missile still rolls once when its NPC operator has been removed',async()=>{const f=combat();f.room.units=[];const m={id:'orphan-missile',sourceId:'a',targetId:'b',unitId:'removed-npc',name:'Missile 1',automated:true,phase:'impact',dice:2};require('../ship-missiles').state(f.a).flights.push(m);let calls=0;const h={act:async body=>{calls++;assert.equal(body.action,'missileDamage');assert.ok(body.score>=2&&body.score<=16);m.phase='exploded';return {ok:true};},publish(){},off(){}};await runner.step(f.room,.5,h);assert.equal(calls,0);m.automationPresentation.animationComplete=true;for(let i=0;i<8;i++)await runner.step(f.room,.5,h);assert.equal(calls,1);assert.equal(m.automationPresentation.displayScore,m.automationPresentation.score*5);});

test('Ship AI holds at its reserved bridge without automation acting, then resumes',async()=>{
 const f=combat(),hold=require('../console-hold'),loc=structuredClone(f.unit.location);let actions=0;
 const h={pushLog(){},clearActiveCommand(){},moveToNextTurnOrClock(){}};
 assert.equal(hold.resolve(f.room,f.unit,'holdConsole',h).ok,true);assert.equal(f.unit.atb,99);
 await runner.step(f.room,1,{act:async()=>{actions++;return {ok:true};},publish(){},off(){}});
 assert.equal(actions,0);assert.deepEqual(f.unit.location,loc);assert.equal(f.unit.automationMode,'offense');
 assert.equal(hold.resolve(f.room,f.unit,'resumeConsole',h).ok,true);assert.equal(f.unit.consoleHold,null);
});


test('new Ship AI defaults to Automatic and idle turns keep automation armed',async()=>{
 const f=fixture();delete rooms.roomData(f.ship,'ai').automationMode;ai.sync(f.room,b=>({...b,atb:100}));const u=f.room.units.find(u=>u.shipAi);assert.equal(u.automationMode,'automatic');
 ai.configure(f.room,f.ship,'off');ai.sync(f.room,b=>b);assert.equal(u.automationMode,'off','explicit Off survives sync');
 const x=combat();x.unit.automationMode='automatic';x.room.starships=[x.a];x.a.ship.sicInventory=x.a.ship.sicInventory.filter(i=>!maps.definition(i.type).sensor);
 let stopped=false,waited=false;await runner.step(x.room,.1,{act:async b=>{waited=b.action==='completeTurn';return {ok:true};},publish(){},off(){stopped=true;}});assert.equal(stopped,false);assert.equal(waited,true);assert.equal(x.unit.automationMode,'automatic');
});

test('Automatic AI scans when no hostile is detected and breaks hostile locks first',()=>{
 const f=combat();f.unit.automationMode='automatic';f.a.sensorState.contacts={};assert.ok(policy.candidates(f.room,f.unit).some(c=>c.action==='sensorCommand'&&c.kind==='area'));
 require('../ship-locks').state(f.b).targets.push({targetId:f.a.id});assert.equal(policy.candidates(f.room,f.unit)[0].kind,'break');
});

function npc(){const f=combat();f.unit.shipAi=false;f.unit.automationMode='npc';return f;}
function onlyWeapons(f,ids){for(const i of f.a.ship.sicInventory)if(maps.definition(i.type).weapon&&!ids.includes(i.id))i.disabled=true;}
test('ordinary choices are deterministic and do not inspect hidden opponent loadout or exact health',()=>{
 const f=npc(),before=policy.candidates(f.room,f.unit);assert.deepEqual(before,policy.candidates(f.room,f.unit,()=>{throw Error('No random policy');}));
 f.b.currentShieldHp=999;f.b.currentHullHp=1;f.b.ship.sicInventory.push({id:'secret',type:'ion-disruptor'});
 assert.deepEqual(policy.candidates(f.room,f.unit),before,'unchanged disclosed contact yields unchanged choice');
 const snapshot=JSON.parse(JSON.stringify(f.room));assert.deepEqual(policy.candidates(snapshot,snapshot.units[0]),before);
});
test('AU reservations exclude unaffordable shots while leaving a useful alternative without spending',()=>{
 const f=npc();f.a.auState.current=20;f.a.auState.available=0;f.a.auState.reserved=20;
 const before=JSON.stringify(f.a.auState),choices=policy.candidates(f.room,f.unit);assert.ok(!choices.some(c=>['a-laser','a-ion'].includes(c.sicId)));assert.ok(choices.some(c=>c.action==='weaponCommand'));
 assert.equal(JSON.stringify(f.a.auState),before);
 f.a.auState.available=20;assert.ok(policy.candidates(f.room,f.unit).some(c=>c.sicId==='a-laser'));
});
test('unseen, last-known, destroyed, escaped and warping targets never receive NPC orders',()=>{
 for(const change of [f=>delete f.a.sensorState.contacts.b,f=>f.a.sensorState.contacts.b.level='last-known',f=>f.b.currentHullHp=0,f=>f.b.destroyedAt='now',f=>f.b.escapedAt='now',f=>f.b.ship.warpState={phase:'traveling'}]){
  const f=npc();change(f);assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.targetId==='b'));
 }
});
test('range-depleted weapons, cooldowns, empty ammunition and missing locks are skipped',()=>{
 const f=npc();onlyWeapons(f,['a-ripple']);f.a.sensorState.contacts.b.position={q:10000,r:0};assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.action==='weaponCommand'));
 const g=npc();assert.ok(!policy.candidates(g.room,g.unit).some(c=>c.missile||c.sicId==='a-beam'));
 require('../ship-locks').state(g.a).targets.push({targetId:'b',systemId:'a-lock'});assert.ok(policy.candidates(g.room,g.unit).some(c=>c.missile));
 const launcher=g.a.ship.sicInventory.find(i=>maps.definition(i.type).missileLauncher);g.a.ship.missileState={cooldowns:{[launcher.id]:12},flights:[]};assert.ok(!policy.candidates(g.room,g.unit).some(c=>c.sicId===launcher.id));
 g.a.ship.missileState.cooldowns={};g.a.ship.missileAmmo={};assert.ok(!policy.candidates(g.room,g.unit).some(c=>c.missile));
});
test('crew avoid pending locks, analysis inputs, report processing and area scans',()=>{
 const f=npc();f.room.units.push({id:'mate',delayedAction:{lockOrder:{shipId:'a',kind:'lock',targetId:'b'}}});assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.kind==='lock'));
 f.room.units[1].delayedAction={sensorOrder:{shipId:'a',kind:'analysis',targetId:'b'}};assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.kind==='analysis'));
 f.room.units[1].delayedAction=null;f.room.units[1].queuedEffects=[{sensorReport:{shipId:'a',targetId:'b'}}];assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.kind==='analysis'));
 f.a.sensorState.contacts={};f.room.units[1].delayedAction={sensorOrder:{shipId:'a',kind:'area'}};assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.kind==='area'));
 f.room.units[1].delayedAction.sensorOrder.shipId='b';assert.ok(policy.candidates(f.room,f.unit).some(c=>c.kind==='area'),'other ship scan does not suppress ours');
});
test('repair fallback beats an empty-field scan and skips another crewmember repair',()=>{
 const f=npc();f.a.sensorState.contacts={};const item=f.a.ship.sicInventory.find(i=>i.id===f.unit.location.sicId);item.impairmentPoints=1;
 assert.equal(policy.candidates(f.room,f.unit)[0].kind,'repair');
 f.room.units.push({id:'mate',delayedAction:{maintenanceOrder:{shipId:'a',sicId:item.id}}});assert.ok(!policy.candidates(f.room,f.unit).some(c=>c.kind==='repair'));
});
test('runner tries useful alternatives once and stops immediately for GM takeover',async()=>{
 const f=npc(),calls=[];await runner.step(f.room,.1,{act:async b=>{calls.push(b);if(calls.length===1)return {ok:false,error:'State changed'};return {ok:true};},publish(){},off(){}});assert.equal(calls.length,2);assert.notEqual(calls[0].sicId,calls[1].sicId);assert.ok(calls.every(c=>!c.exertion));
 const g=npc(),taken=[];await runner.step(g.room,.1,{act:async b=>{taken.push(b);g.unit.automationMode='off';return {ok:false,error:'GM took over'};},publish(){},off(){}});assert.equal(taken.length,1);assert.equal(g.unit.automationAction,undefined);
});
test('no legal ordinary action completes one turn without moving, spending or disabling automation',async()=>{
 const f=fixture();f.unit.team='npc';f.unit.automationMode='npc';assert.deepEqual(policy.candidates(f.room,f.unit),[]);const calls=[];
 await runner.step(f.room,.1,{act:async b=>{calls.push(b);return {ok:true};},publish(){},off(){throw Error('Must stay armed');}});assert.deepEqual(calls,[{action:'completeTurn',id:f.unit.id}]);assert.equal(f.unit.automationMode,'npc');
});

test('runner bounds duplicate rejected candidates to one attempt per decision',async()=>{
 const f=npc(),original=policy.candidates,order={action:'weaponCommand',sicId:'same',targetId:'b'},calls=[];
 try{policy.candidates=()=>[order,{...order}];await runner.step(f.room,.1,{act:async b=>{calls.push(b);return {ok:b.action==='completeTurn',error:'Rejected'};},publish(){},off(){}});}finally{policy.candidates=original;}
 assert.deepEqual(calls.map(c=>c.action),['weaponCommand','completeTurn']);
});

 test('assigned allied engine operator seeks Bridge without changing crew security',()=>{
 const f=fixture();f.unit.team='npc';f.unit.allyNpc=true;f.ship.crewNpcUnitIds=[f.unit.id];f.seat('engine');
 assert.equal(require('../ship-surveillance').hostile(f.room,f.ship,f.unit),false);
 const choices=policy.candidates(f.room,f.unit);assert.ok(choices.length);assert.ok(choices.every(c=>c.route?.at(-1).sicId==='bridge'));assert.ok(choices.every(c=>c.stationOnArrival));
 const copy=structuredClone(f.room);assert.deepEqual(policy.candidates(copy,copy.units[0]),choices);
 f.unit.timedAction={kind:'move'};assert.deepEqual(policy.candidates(f.room,f.unit),[]);
 });
 test('idle crew do not steal occupied Bridge seats or circulate among inert stations',()=>{
 const f=fixture();f.unit.team='npc';f.unit.allyNpc=true;f.ship.crewNpcUnitIds=[f.unit.id];f.seat('engine');
 for(const s of policy.seats(f.ship).filter(s=>s.bridge))f.room.units.push({id:'occupied-'+s.mesh,location:s});
 const choices=policy.candidates(f.room,f.unit);assert.ok(choices.every(c=>c.route?.at(-1).sicId!=='bridge'));
 if(!choices.length)assert.match(f.unit.automationSearchReason,/No available reachable Bridge/);
 });

test('productive Bridge operator stays and disabled Bridge cannot be selected',()=>{
 const f=npc();const choices=policy.candidates(f.room,f.unit);assert.ok(choices.some(c=>c.action==='weaponCommand'));assert.ok(!choices.some(c=>c.kind==='move'));
 const g=fixture();g.unit.team='npc';g.unit.allyNpc=true;g.ship.crewNpcUnitIds=[g.unit.id];g.seat('engine');g.ship.ship.sicInventory.find(i=>i.id==='bridge').disabled=true;
 assert.ok(!policy.candidates(g.room,g.unit).some(c=>c.route?.at(-1).sicId==='bridge'));
});

test('automated suction preserves saved dice through reload, resolves once, and respects takeover',async()=>{
 const f=npc(),u=f.unit;u.currentHp=30;u.pendingShipRolls=[{id:'suction-test',label:'Resist suction',breachCheck:{shipId:f.a.id},rollSpec:{sides:[4,4],bonus:1,difficulty:16}}];let calls=[];
 const h={act:async b=>{calls.push(b);u.pendingShipRolls=[];return {ok:true};},publish(){},off(){}};
 await runner.step(f.room,.1,h);assert.equal(calls.length,0);const saved=structuredClone(u.automationPresentation);u.automationPresentation=JSON.parse(JSON.stringify(saved));u.automationMode='off';await runner.step(f.room,2,h);assert.equal(calls.length,0);u.automationMode='npc';u.automationPresentation.animationComplete=true;
 for(let i=0;i<4;i++)await runner.step(f.room,.5,h);assert.equal(calls.filter(c=>c.action==='rollShipAction').length,1);assert.deepEqual(calls[0].diceResults,saved.values);assert.equal(calls[0].exertion,0);
});
test('player and manual NPC environmental checks stay manual',async()=>{
 for(const change of [u=>u.team='pc',u=>u.automationMode='off',u=>u.automationSuspended=true]){const f=npc();f.unit.currentHp=30;change(f.unit);f.unit.pendingShipRolls=[{id:'manual',breachCheck:{},rollSpec:{sides:[4],difficulty:16}}];let calls=0;await runner.step(f.room,1,{act:async()=>{calls++;},publish(){},off(){}});assert.equal(calls,0);assert.equal(f.unit.automationPresentation,undefined);}
});
test('automated oxygen uses authoritative resolver and applies damage once',async()=>{
 const f=npc(),u=f.unit,O=require('../ship-oxygen');u.currentHp=30;u.physicalAttribute=2;u.physicalSkill=0;u.allyNpc=true;f.a.ship.oxygenState={crew:{[u.id]:{id:u.id,oxygen:0,phase:'breath',difficulty:100,request:{id:'oxygen-test',dice:[4],skill:0,difficulty:100}}},receipts:[]};let resolutions=0;
 const h={act:async()=>({ok:true}),oxygen:async b=>{resolutions++;return O.resolve(f.room.starships,O.people({starships:f.room.starships,characters:[]},f.room),b);},publish(){},off(){}};
 await runner.step(f.room,.1,h);assert.equal(u.automationPresentation.environmentCheck,'oxygen');u.automationPresentation.animationComplete=true;for(let i=0;i<3;i++)await runner.step(f.room,.5,h);
 assert.equal(resolutions,1);assert.equal(u.currentHp,25);assert.equal(f.a.ship.oxygenState.crew[u.id].phase,'suffocating');assert.equal(f.a.ship.oxygenState.crew[u.id].request,null);assert.deepEqual(f.a.ship.oxygenState.receipts,['oxygen-test']);
});

test('oxygen automation eligibility follows takeover and breathing immunity without changing PC ownership',()=>{
 const f=npc(),O=require('../ship-oxygen');f.unit.currentHp=30;f.unit.raceId='android';const campaign={starships:f.room.starships,characters:[]};let people=O.people(campaign,f.room);assert.equal(people.find(p=>p.id===f.unit.id).immune,true);assert.equal(people.find(p=>p.id===f.unit.id).automated,true);
 f.unit.automationMode='off';people=O.people(campaign,f.room);assert.equal(people.find(p=>p.id===f.unit.id).automated,false);f.unit.raceId='human';assert.equal(O.people(campaign,f.room).find(p=>p.id===f.unit.id).immune,false);
});

test('manual environmental resolution clears a stale automatic animation',async()=>{
 const f=npc();f.unit.currentHp=30;f.unit.automationMode='off';f.unit.automationPresentation={id:'resolved-manually',environmentCheck:'suction',phase:'rolling',values:[2,3]};f.unit.pendingShipRolls=[];
 await runner.step(f.room,.1,{act:async()=>({ok:true}),publish(){},off(){}});assert.equal(f.unit.automationPresentation,undefined);
});
