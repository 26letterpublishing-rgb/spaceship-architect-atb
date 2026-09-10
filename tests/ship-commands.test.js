const test=require('node:test'),assert=require('node:assert/strict');
const commands=require('../ship-commands'),cooperation=require('../ship-cooperation'),sensors=require('../ship-sensors'),maintenance=require('../ship-maintenance'),power=require('../ship-power'),shields=require('../ship-shields');
const navigation=require('../ship-navigation');
function fixture(){
  const make=id=>({id,title:id,crewCharacterIds:[id+'pc'],currentHullHp:30,maximumHullHp:30,ship:{gridCells:Array.from({length:24},(_,i)=>42+Math.floor(i/6)*20+i%6),sicInventory:[{id:'c',type:'cockpit-1'},{id:'en',type:'en-engine-1'},{id:'sn',type:'sensors-3'},{id:'t',type:'exhaust-thruster-1'},{id:'sh',type:'shield-1'}],placements:[{sicId:'c',cell:42},{sicId:'en',cell:43},{sicId:'sn',cell:44},{sicId:'t',cell:41},{sicId:'sh',cell:45}]}});
  const a=make('a'),b=make('b');
  const pilot={id:'p',characterId:'apc',characterName:'Pilot',team:'pc',atb:100,pilotSkill:2,mathematicsSkill:3,sensorSkill:2,intellectDice:[6,6],engineeringSkill:4,location:{starshipId:'a',square:42,mesh:0,sicId:'c',stationed:true}};
  const room={showcase:true,activeId:'p',units:[pilot],starships:[a,b],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:0,r:0}],threshold:100,log:[]};
  a.sensorScenarioMasking=1;b.sensorScenarioMasking=1;power.refresh(room,{reset:true});shields.refresh(room,{reset:true});sensors.refresh(room);
  return {room,a,b,pilot};
}
test('command input validates turn, seat, receipt and disclosed location',()=>{
  const {room,pilot}=fixture(),body={kind:'hail',targetId:'b',disclosedPosition:{q:2,r:0},requestId:'hail-test'};
  room.activeId='other';assert.equal(commands.queue(room,pilot,body).ok,false);room.activeId='p';
  assert.equal(commands.queue(room,pilot,{...body,disclosedPosition:{q:6,r:0}}).ok,false);
  assert.equal(commands.queue(room,pilot,body).ok,true);assert.equal(commands.queue(room,pilot,body).duplicate,true);
  pilot.location.stationed=false;commands.resolveInput(room,pilot,()=>4);assert.match(room.starships[0].sensorState.reports[0].text,/interrupted/);
});
test('hail replies are free between turns and do not expose true coordinates',()=>{
  const {room,pilot,a,b}=fixture();commands.queue(room,pilot,{kind:'hail',targetId:'b',disclosedPosition:{q:4,r:0},requestId:'hail-test'});commands.resolveInput(room,pilot,()=>4);
  assert.deepEqual(b.commandSystems.calls[0].disclosedPosition,{q:4,r:0});
  const responder={...pilot,id:'r',characterId:'bpc',location:{...pilot.location,starshipId:'b'}};room.units.push(responder);room.activeId=null;
  assert.equal(commands.queue(room,responder,{kind:'accept',callId:'hail-test',requestId:'accept-test'}).free,true);
  assert.equal(a.commandSystems.calls[0].status,'connected');assert.equal(b.commandSystems.calls[0].status,'connected');
});
test('team fuses one pool and calculations stack then expire in combat time',()=>{
  const {room,pilot,a}=fixture();
  commands.queue(room,pilot,{kind:'team',preparedAction:'hex',requestId:'team-test'});commands.resolveInput(room,pilot,()=>4);
  const other={...pilot,id:'r'};room.units.push(other);
  const result=cooperation.roll(room,a,other,'hex',[4,4],1,()=>3,sensors.fusedTotal);
  assert.deepEqual(result.values,[3,3,3,3]);assert.equal(result.total,16);assert.equal(a.commandSystems.preparations.length,0);
  for(let i=0;i<2;i++){commands.queue(room,pilot,{kind:'calculation',preparedAction:'hex',requestId:'calc-test-'+i});commands.resolveInput(room,pilot,()=>4);}
  assert.equal(cooperation.roll(room,a,pilot,'hex',[4,4],2,()=>1,sensors.fusedTotal).total,8);
  commands.queue(room,pilot,{kind:'calculation',preparedAction:'hex',requestId:'calc-test-expire'});commands.resolveInput(room,pilot,()=>4);commands.advance(room,36);assert.equal(a.commandSystems.preparations.length,0);
});
test('evasion persists until attacked, collision requires same hex',()=>{
  const {room,pilot,a,b}=fixture();assert.equal(commands.queue(room,pilot,{kind:'evade',requestId:'evade-test'}).ok,true);commands.resolveInput(room,pilot,()=>4);
  assert.ok(a.commandSystems.evasions[0].defense>=1);commands.advance(room,300);assert.equal(a.commandSystems.evasions.length,1);
  room.shipPositions[1].q=2;assert.equal(commands.queue(room,pilot,{kind:'ram',targetId:b.id,requestId:'ram-test'}).ok,false);
  room.shipPositions[1].q=0;assert.equal(commands.queue(room,pilot,{kind:'ram',targetId:b.id,requestId:'ram-test'}).ok,true);commands.resolveInput(room,pilot,()=>12);assert.equal(a.currentHullHp,0);assert.equal(b.currentHullHp,0);
});
test('repair is local, removes one impairment and raises future difficulty',()=>{
  const {room,pilot,a}=fixture(),item=a.ship.sicInventory.find(i=>i.id==='en');item.impaired=true;item.impairmentPoints=2;
  assert.equal(maintenance.queue(room,pilot,{kind:'repair',sicId:'en',requestId:'repair-test'}).ok,false);
  pilot.location={starshipId:'a',square:43,mesh:4};assert.equal(maintenance.queue(room,pilot,{kind:'repair',sicId:'en',requestId:'repair-test'}).ok,true);
  assert.equal(pilot.delayedAction.rate,100/9);maintenance.resolve(room,pilot,()=>6);assert.equal(item.impairmentPoints,1);assert.equal(item.repairDifficulty,11);
});
test('diagnostics use 55 GM-passed minutes and cancel when operator leaves the room',()=>{
  const {a}=fixture();a.characterLocations={apc:{square:43,mesh:4}};const item=a.ship.sicInventory.find(i=>i.id==='en');item.impaired=true;
  maintenance.diagnostics(a,'apc');maintenance.passTime(a,54);assert.equal(item.impaired,true);maintenance.passTime(a,1);assert.equal(item.impaired,false);
  item.impaired=true;maintenance.diagnostics(a,'apc');a.characterLocations.apc.square=44;maintenance.passTime(a,55);assert.equal(item.impaired,true);assert.equal(a.ship.diagnostics.length,0);
});
test('conditional orders charge once, survive leaving after input, and expire without a trigger',()=>{
  const {room,pilot,a}=fixture();a.ship.sicInventory.push({id:'au',type:'au-engine-1'});a.ship.placements.push({sicId:'au',cell:46});power.refresh(room,{reset:true});a.auState.current=2;
  a.sensorState.reports.push({analysis:true,targetId:'b'});
  const body={kind:'evade',trigger:{kind:'movement',targetId:'b'},requestId:'conditional-test'};
  assert.equal(commands.queue(room,pilot,body).ok,true);commands.resolveInput(room,pilot,()=>4);assert.equal(a.auState.current,0);assert.ok(a.commandSystems.armed);
  pilot.location={starshipId:'a',square:43,mesh:4};const before=structuredClone(room.shipPositions);room.shipPositions[1].q=.5;
  commands.advance(room,1,before,()=>4);assert.equal(a.commandSystems.armed,null);assert.equal(pilot.pendingShipRolls.length,1);
  const ready=pilot.pendingShipRolls.shift();commands.resolveInput(room,{...pilot,location:ready.armed.location},()=>4,ready.armed.order);assert.equal(a.commandSystems.evasions.length,1);
  pilot.location={starshipId:'a',square:42,mesh:0,sicId:'c',stationed:true};a.auState.current=2;
  assert.equal(commands.queue(room,pilot,{...body,requestId:'conditional-expire'}).ok,true);commands.resolveInput(room,pilot,()=>4);commands.advance(room,12,structuredClone(room.shipPositions),()=>4);assert.equal(a.commandSystems.armed,null);assert.equal(a.commandSystems.evasions.length,1);
});
test('restarting a powered-down SIC stays offline until the bridge timer completes',()=>{
  const {room,pilot,a}=fixture();pilot.location={starshipId:'a',square:43,mesh:4};const item=a.ship.sicInventory.find(i=>i.id==='en');
  assert.equal(maintenance.queue(room,pilot,{kind:'off',sicId:'en',requestId:'power-off-test'}).ok,true);assert.equal(item.disabled,true);
  assert.equal(maintenance.queue(room,pilot,{kind:'on',sicId:'en',requestId:'power-on-test'}).ok,true);assert.ok(item.bootRemaining>0);
  const remaining=item.bootRemaining;maintenance.advance(a,remaining-.1);assert.equal(item.disabled,true);maintenance.advance(a,.1);assert.equal(item.disabled,false);
});

test('conditional navigation launches from the current position after the pilot leaves',()=>{
  const {room,pilot,a}=fixture();a.ship.sicInventory.push({id:'au',type:'au-engine-1'});a.ship.placements.push({sicId:'au',cell:46});power.refresh(room,{reset:true});a.auState.current=2;
  a.sensorState.reports.push({analysis:true,targetId:'b'});
  const trigger=commands.validateTrigger(room,a,{kind:'distance',targetId:'b',distance:1});assert.equal(trigger.ok,true);
  assert.equal(navigation.queue(room,pilot,{destination:{q:5,r:0},boostIds:[]}).ok,true);
  pilot.delayedAction.shipOrder.trigger=trigger.trigger;
  assert.equal(commands.validateTrigger(room,a,trigger.trigger).ok,false);
  commands.armExternal(room,pilot,'pilot');assert.equal(a.auState.current,0);assert.equal(a.navigation,undefined);
  pilot.location={starshipId:'a',square:43,mesh:4};const before=structuredClone(room.shipPositions);room.shipPositions[0].q=1;room.shipPositions[1].q=1;
  commands.advance(room,1,before,()=>4);assert.equal(a.commandSystems.armed,null);assert.equal(a.navigation.phase,'powered');assert.deepEqual(a.navigation.target,{q:5,r:0});assert.ok(a.navigation.remaining>0);
});

test('conditional analysis keeps the queued report on the real operator',()=>{
  const {room,pilot,a}=fixture();a.ship.sicInventory.push({id:'au',type:'au-engine-1'});a.ship.placements.push({sicId:'au',cell:46});power.refresh(room,{reset:true});a.auState.current=2;
  assert.equal(sensors.queue(room,pilot,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'conditional-analysis'}).ok,true);
  pilot.delayedAction.sensorOrder.trigger={kind:'movement',targetId:'b'};commands.armExternal(room,pilot,'sensor');
  pilot.location={starshipId:'a',square:43,mesh:4};const before=structuredClone(room.shipPositions);room.shipPositions[1].q=.5;
  commands.advance(room,1,before,()=>4);assert.equal(pilot.pendingShipRolls.length,1);assert.equal(pilot.delayedAction,null);
  const ready=pilot.pendingShipRolls.shift(),operator={...pilot,location:ready.armed.location,delayedAction:ready.armed.delayed,queuedEffects:pilot.queuedEffects ||= []};
  sensors.resolveInput(room,operator,()=>4);assert.ok(pilot.queuedEffects.some(e=>e.sensorReport));
});

test('powered-down shield reserves cannot absorb a collision',()=>{
  const {room,pilot,a,b}=fixture();a.ship.sicInventory.find(i=>i.id==='sh').disabled=true;shields.refresh(room);
  const stored=a.shieldSystems.sh.hp;
  commands.queue(room,pilot,{kind:'ram',targetId:b.id,requestId:'offline-ram-test'});commands.resolveInput(room,pilot,()=>12);
  assert.equal(a.shieldSystems.sh.hp,stored);assert.equal(a.currentHullHp,0);
});
