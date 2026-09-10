const test = require('node:test');
const assert = require('node:assert/strict');
const shields = require('../ship-shields');
const access = require('../station-access');
const maps = require('../ship-map-core');
const power = require('../ship-power');
const combat = require('../combat-engine');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);
function fixture() {
  const ship = { id:'ship', currentHullHp:20, ship:{ gridCells:[21,22,23,24,41,42,43,44], sicInventory:[
    {id:'shield',type:'shield-1'}, {id:'bridge',type:'cockpit-2'}, {id:'au',type:'au-engine-6'},
  ], placements:[{sicId:'shield',cell:21},{sicId:'bridge',cell:22},{sicId:'au',cell:44}] } };
  const local = {id:'local',speed:5,atb:25,engineeringSkill:0,location:{starshipId:'ship',sicId:'shield',square:21,mesh:0,stationed:true}};
  const remote = {id:'remote',speed:5,atb:60,engineeringSkill:6,location:{starshipId:'ship',sicId:'bridge',square:22,mesh:0,stationed:true}};
  const room = {units:[local,remote],starships:[ship],threshold:100};
  shields.refresh(room); power.refresh(room,{reset:true});
  return {room,ship,local,remote,s:ship.shieldSystems.shield};
}
let serial=0;
test('additional installed shields add five EN per prior shield; storage draws none',()=>{
  const ship={sicInventory:[{id:'a',type:'shield-1'},{id:'b',type:'shield-1'},{id:'c',type:'shield-1'}],placements:[{sicId:'a',cell:1},{sicId:'b',cell:2}]};
  assert.equal(power.demand(ship),15);ship.placements.push({sicId:'c',cell:3});assert.equal(power.demand(ship),30);
});
const order=(room,unit,kind,amount=1) => shields.command(room,unit,{sicId:'shield',kind,amount,requestId:`request-${++serial}`});

test('local and remote access share a shield, but remote presence grants no Engineering',()=>{
  const {room,local,remote,s}=fixture();
  assert.equal(access.access(room,local,'shield').remote,false);
  assert.equal(access.access(room,remote,'shield').remote,true);
  near(s.regenerationSeconds,12);
  local.engineeringSkill=3.8;shields.refresh(room);near(s.regenerationSeconds,7.5);
  remote.location.mesh=4;assert.equal(access.access(room,remote,'shield'),null);
});
test('staffing overflows at half and quarter strength with fractional bars',()=>{
  const factors=shields.staffing([6,6,6,3].map(engineeringSkill=>({engineeringSkill})));
  assert.deepEqual(factors,{Ingenuity:4,Efficiency:4,Performance:.5});
  near(shields.timing(12,{}),12);
  assert.ok(shields.timing(120,factors)<shields.timing(120,{Ingenuity:4}));
});
test('normal regeneration is fractional, capped, and never freezes initiative',()=>{
  const {room,ship,local,s}=fixture();s.hp=5;
  shields.advance(room,6);near(s.hp,5.5);assert.equal(combat.effectiveSpeed(local),5);
  shields.advance(room,120);near(s.hp,10);near(ship.currentShieldHp,10);
  s.hp=0;shields.advance(room,12);near(s.hp,0);
});
test('AU reservation prevents duplicate spending and commits exactly once',()=>{
  const {room,ship,local,remote,s}=fixture();ship.auState.current=5;s.hp=5;
  const body={sicId:'shield',kind:'restore',amount:1,requestId:'same-command-1'};
  assert.equal(shields.command(room,local,body).ok,true);
  assert.equal(shields.command(room,local,body).duplicate,true);
  assert.equal(order(room,remote,'restore').ok,false);
  assert.equal(power.spend(room,'ship',1),false);
  assert.equal(ship.auState.current,5);assert.equal(ship.auState.available,0);
  shields.advanceInputs(room,1);near(s.hp,5);assert.equal(combat.effectiveSpeed(local),5);
  shields.advanceInputs(room,.5);near(s.hp,6);assert.equal(ship.auState.current,0);
  shields.advanceInputs(room,10);near(s.hp,6);
});
test('leaving cancels input and releases reserved AU, including remote operators',()=>{
  for(const operator of ['local','remote']) {
    const f=fixture();f.s.hp=4;f.ship.auState.current=8;
    assert.equal(order(f.room,f[operator],'restore').ok,true);
    f[operator].location.stationed=false;shields.advanceInputs(f.room,2);
    near(f.s.hp,4);assert.equal(f.ship.auState.current,8);assert.equal(f.ship.auState.reserved,0);
  }
});
test('reinforcement stacks until the original expiry without extending it',()=>{
  const {room,local,remote,s}=fixture();
  order(room,local,'reinforce',2);shields.advanceInputs(room,1.5);
  shields.advance(room,5);near(s.protectionRemaining,7);
  order(room,remote,'reinforce',1);shields.advanceInputs(room,1.5);
  near(s.protection,3);near(s.protectionRemaining,7);
  shields.advance(room,7);near(s.protection,0);
  order(room,remote,'reinforce',1);shields.advanceInputs(room,1.5);near(s.protectionRemaining,12);
});
test('each hit receives reinforcement, shield burst discards overflow, impaired shield doubles damage',()=>{
  const {room,ship,s}=fixture();s.protection=2;s.protectionRemaining=12;
  shields.damage(room,'ship',5);near(s.hp,8);
  shields.damage(room,'ship',5);near(s.hp,6);
  shields.damage(room,'ship',100);near(s.hp,0);near(ship.currentHullHp,20);
  shields.damage(room,'ship',5);near(ship.currentHullHp,15);
  s.hp=10;ship.ship.sicInventory[0].impaired=true;shields.damage(room,'ship',3);near(s.hp,6);
});
test('restabilization requires physical access and freezes local crew only',()=>{
  const {room,local,remote,s}=fixture();s.hp=0;
  assert.equal(order(room,remote,'restabilize').ok,false);
  assert.equal(order(room,local,'restabilize').ok,true);
  assert.equal(combat.effectiveSpeed(local),0);assert.equal(combat.effectiveSpeed(remote),5);
  assert.equal(combat.resolvePlayerCombatAction(room,local,{kind:'holdConsole'},{}).ok,false);
});
test('restabilization pauses on AU starvation, keeps work, resumes and restores full HP',()=>{
  const {room,ship,local,s}=fixture();s.hp=0;ship.auState.current=1;
  ship.ship.sicInventory.find(i=>i.id==='au').disabled=true;
  // Use a small operational generator so its stored AU survives, but recharge takes 100 sec.
  ship.ship.sicInventory.find(i=>i.id==='au').type='au-en-engine-1';ship.ship.sicInventory.find(i=>i.id==='au').disabled=false;
  order(room,local,'restabilize');shields.advance(room,12);
  near(s.restabilization.progress,.05);assert.equal(s.restabilization.paused,'Waiting for AU');
  local.location.stationed=false;shields.advance(room,20);near(s.restabilization.progress,.05);assert.equal(local.shieldRestabilizing,null);
  local.location.stationed=true;ship.ship.sicInventory.find(i=>i.id==='au').type='au-engine-6';power.refresh(room,{reset:true});
  shields.advance(room,114);near(s.hp,10);assert.equal(s.restabilization,null);assert.equal(local.atb,0);
});
test('Engineering reduces duration but preserves total restabilization AU cost',()=>{
  const {room,ship,local,s}=fixture();s.hp=0;local.engineeringSkill=6;
  order(room,local,'restabilize');const duration=s.restoreSeconds;
  assert.ok(duration<120);
  const r=s.restabilization;shields.advance(room,duration);
  near(s.hp,10);assert.equal(r.auSpent,20);
});
test('hard pause holds AU input; saved state retains pending input and reserved AU',()=>{
  const {room,ship,local,s}=fixture();s.hp=5;order(room,local,'restore');
  room.hardPaused=true;shields.advanceInputs(room,10);near(ship.auCommands[0].remaining,1.5);
  const restored=JSON.parse(JSON.stringify(room));restored.hardPaused=false;
  shields.advanceInputs(restored,1.5);near(restored.starships[0].shieldSystems.shield.hp,6);
});
test('all bridge tiers have their printed station count, distinct valid stations, and complete EDG footprints',()=>{
  const counts={'cockpit-1':1,'cockpit-2':2,'bridge-1':3,'bridge-2':4,'bridge-3':5,'bridge-4':6,'bridge-5':7,'bridge-6':8,'bridge-7':10,'bridge-8':12};
  for(const [type,count] of Object.entries(counts))for(const rotation of [0,90]) {
    const d=maps.componentDefinition({type,stationLayout:'corners-v1',rotation});
    assert.equal(d.stations.length,count,type);
    assert.equal(new Set(d.stations.map(p=>`${p.x}:${p.y}:${p.mesh}`)).size,count);
    assert.ok(d.stations.every(p=>p.x>=0&&p.x<d.width&&p.y>=0&&p.y<d.height&&p.mesh>=0&&p.mesh<9));
  }
  const hull={gridCells:Array.from({length:16},(_,i)=>21+Math.floor(i/4)*20+i%4)};
  assert.equal(maps.componentAtEdge(hull,42,{type:'bridge-1'}),false);
  assert.equal(maps.componentAtEdge(hull,43,{type:'bridge-1'}),true);
});
