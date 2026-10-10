'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maps = require('../ship-map-core');
const power = require('../ship-power');
const shields = require('../ship-shields');
const stations = require('../station-access');
const transit = require('../ship-transit');
const LY = transit.PARSEC_LY;
const seconds = [30*86400,7*86400,86400,36000,10800,3600,600];
const rounds = [7,6,5,4,4,4,3];
const thrusters = [1,2,2,2,2,3,4];
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-7, `${a} != ${b}`);
const clone = value => JSON.parse(JSON.stringify(value));
function typeFor(tier) {
  const type = Object.keys(maps.catalog).find(type => maps.definition(type).warp && maps.definition(type).tier === tier);
  assert.ok(type, `Catalog must define warp tier ${tier}`); return type;
}
function fixture(tier = 0) {
  const a = { id:'a', title:'Alpha', crewCharacterIds:['pc1','pc2'], crewNpcUnitIds:['q'], maximumHullHp:43, currentHullHp:43,
    ship:{ gridCells:Array.from({length:256},(_,i) => (2+Math.floor(i/16))*20+2+i%16),
      sicInventory:[{id:'bridge-a',type:'bridge-1'},{id:'en-a',type:'en-engine-6'},{id:'warp-a',type:typeFor(tier)},
        {id:'destruct-a',type:'self-destruct'},...Array.from({length:4},(_,i) => ({id:`thruster-${i}`,type:'exhaust-thruster-1'}))],
      placements:[{sicId:'bridge-a',cell:42},{sicId:'en-a',cell:162},{sicId:'warp-a',cell:48},{sicId:'destruct-a',cell:146},
        ...Array.from({length:4},(_,i) => ({sicId:`thruster-${i}`,cell:41+i*20}))], warpFuel:{F:12,D:12,C:12,B:12,A:12,S:12} } };
  const p = { id:'p', characterId:'pc1', team:'pc', currentHp:10, engineeringSkill:3, atb:100 };
  const q = { id:'q', templateId:'npc1', team:'npc', currentHp:10, engineeringSkill:3, atb:100 };
  const b = { id:'b', title:'Beta', currentHullHp:100, maximumHullHp:100, ship:{gridCells:[42],sicInventory:[],placements:[]} };
  const c = { id:'c', title:'Gamma', currentHullHp:100, maximumHullHp:100, ship:{gridCells:[42],sicInventory:[],placements:[]} };
  const room = { units:[p,q], activeId:p.id, starships:[a,b,c], shipPositions:[{id:'a',q:0,r:0},{id:'b',q:2,r:0},{id:'c',q:3,r:0}] };
  seat(room,p,a,'bridge-a',0); seat(room,q,a,'bridge-a',1);
  return {room,a,b,c,p,q};
}
function seat(room, unit, ship, sicId, index = 0) {
  const item = ship.ship.sicInventory.find(i => i.id === sicId), placement = ship.ship.placements.find(p => p.sicId === sicId);
  const station = maps.componentDefinition(item).stations[index];
  assert.ok(station, `Physical station ${index} on ${sicId}`);
  unit.location = { starshipId:ship.id, sicId, square:placement.cell + station.y*maps.gridColumns(ship.ship)+station.x, mesh:station.mesh, stationed:true };
  assert.ok(stations.station(room,unit));
}
function start(f, options = {}) {
  return transit.command(f.room,f.p,{kind:'warpStart',shipId:'a',sicId:'warp-a',distanceLY:LY,requestId:'warp-start-1',...options});
}
function approve(f, unit, requestId, countdownSeconds = 0) {
  f.room.activeId = unit.id;
  return transit.command(f.room,unit,{kind:'destructApprove',shipId:'a',sicId:'destruct-a',countdownSeconds,requestId});
}
function arm(f, countdown = 0) {
  assert.equal(approve(f,f.p,'approve-one',countdown).ok,true);
  const result = approve(f,f.q,'approve-two',countdown); assert.equal(result.ok,true); return result;
}
function depart(f, distanceLY = LY) {
  assert.equal(start(f,{distanceLY}).ok,true);
  assert.equal(transit.advance(f.room,f.a.ship.warpState.total)[0].kind,'warpDeparted');
}

test('all seven catalog drives preserve printed speed, rounds, thrusters and compatibility', () => {
  const grades = [['F','D','C'],['F','D','C','B'],['F','D','C','B','A'],['F','D','C','B','A','S'],['D','C','B','A','S'],['C','B','A','S'],['B','A','S']];
  for (let tier=0;tier<7;tier++) {
    const f = fixture(tier), def = maps.definition(typeFor(tier));
    assert.equal(def.warpSecondsPerParsec,seconds[tier]); assert.equal(def.warpRounds,rounds[tier]); assert.equal(def.warpThrusters,thrusters[tier]);
    assert.deepEqual([...def.warpFuelGrades].sort(),grades[tier].sort());
    assert.equal(start(f).ok,true); assert.equal(f.a.ship.warpState.total,rounds[tier]*12);
    assert.equal(f.a.ship.warpState.secondsPerParsec,seconds[tier]);
    transit.advance(f.room,rounds[tier]*12); transit.passTime(f.a,seconds[tier]/120);
    close(f.a.ship.warpState.traveledLY,LY/2); assert.equal(f.a.ship.warpState.phase,'traveling');
    transit.passTime(f.a,seconds[tier]/120); assert.equal(f.a.ship.warpState.phase,'arrived');
    close(f.a.ship.warpState.elapsedSeconds,seconds[tier]);
  }
});
test('fuel plan uses largest fit, smaller remainders, then smallest overshoot, without mutation', () => {
  const {a} = fixture(3); a.ship.warpFuel = {F:1,D:1,C:1,B:1,A:1,S:1}; const before = clone(a);
  const result = transit.plan(a,17.1*LY);
  assert.equal(result.ok,true); assert.deepEqual(result.plan.map(e => [e.grade,e.count]),[['B',1],['C',1],['D',1],['F',1]]);
  assert.deepEqual(a,before); assert.equal(transit.plan(a,.1*LY).plan[0].grade,'F');
  a.ship.warpFuel = {C:1,A:1}; assert.equal(transit.plan(a,5*LY).plan[1].grade,'A');
});
test('incompatible, stored, offline and insufficient drives/fuel cannot plan a journey', () => {
  const {a} = fixture(0); a.ship.warpFuel = {S:20}; assert.equal(transit.plan(a,LY).ok,false);
  a.ship.warpFuel = {F:1}; assert.equal(transit.plan(a,LY).ok,false);
  a.ship.placements = a.ship.placements.filter(p => p.sicId !== 'warp-a'); assert.equal(transit.plan(a,LY).ok,false);
  const f = fixture(); f.a.ship.sicInventory.find(i => i.id === 'warp-a').disabled = true; assert.equal(transit.plan(f.a,LY).ok,false);
  for (const value of [0,-1,Infinity,NaN,'3.26']) assert.equal(transit.plan(f.a,value).ok,false);
});
test('impaired drive doubles activation and cell consumption without lowering its speed tier', () => {
  const f = fixture(2), item = f.a.ship.sicInventory.find(i => i.id === 'warp-a'); item.impaired = true;
  f.a.ship.warpFuel = {D:2}; assert.equal(start(f).ok,true);
  assert.equal(f.a.ship.warpState.total,120); assert.equal(f.a.ship.warpState.secondsPerParsec,86400);
  transit.advance(f.room,120); assert.equal(f.a.ship.warpFuel.D,1);
  transit.passTime(f.a,720); assert.equal(f.a.ship.warpFuel.D,1); assert.equal(f.a.ship.warpState.currentFuel,null);
  transit.passTime(f.a,720); assert.equal(f.a.ship.warpFuel.D,0); assert.equal(f.a.ship.warpState.phase,'arrived');
  close(f.a.ship.warpState.elapsedSeconds,86400);
});
test('only unique physical drive stations with Engineering >=3 reduce activation', () => {
  const f = fixture(6); seat(f.room,f.p,f.a,'warp-a',0); seat(f.room,f.q,f.a,'warp-a',1);
  const third = {...f.p,id:'third',characterId:'pc2'}; f.room.units.push(third); seat(f.room,third,f.a,'warp-a',2);
  f.room.units.push({...third,id:'duplicate'});
  assert.equal(start(f).ok,true); assert.equal(f.a.ship.warpState.engineers,3); assert.equal(f.a.ship.warpState.total,12);
  const g = fixture(0); seat(g.room,g.q,g.a,'warp-a'); g.q.engineeringSkill = 2.99;
  assert.equal(start(g).ok,true); assert.equal(g.a.ship.warpState.total,84);
});
test('station validity, consciousness, busy actions, turn and target ship are authoritative', () => {
  for (const change of [f => {f.p.location.stationed=false;},f => {f.p.location.mesh=4;},f => {f.p.currentHp=0;},
    f => {f.room.activeId='q';},f => {f.p.delayedAction={};},f => {f.a.hackedSystems=[{bridge:true}];}]) {
    const f = fixture(); change(f); assert.equal(start(f).ok,false);
  }
  const f = fixture(); assert.equal(start(f,{shipId:'b'}).ok,false);
  assert.equal(start(f,{requestId:'bad'}).ok,false);
  f.room.activeId = null;
  assert.equal(transit.command(f.room,f.p,{kind:'warpStart',shipId:'a',sicId:'warp-a',distanceLY:LY,requestId:'outside-start'},{outsideCombat:true}).ok,true);
});
test('operational thrusters and sufficient generated EN are required, including throughout activation', () => {
  const f = fixture(6); f.a.ship.sicInventory.find(i => i.id === 'thruster-0').impaired = true; assert.equal(start(f).ok,false);
  const g = fixture(); g.a.ship.sicInventory.find(i => i.id === 'en-a').disabled = true; assert.equal(start(g).ok,false);
  const h = fixture(); assert.equal(start(h).ok,true); h.a.ship.sicInventory.find(i => i.id === 'en-a').disabled = true;
  assert.equal(transit.advance(h.room,84)[0].kind,'warpInterrupted'); assert.equal(h.a.ship.warpFuel.D,12);
});
test('activation requires stopped navigation, respects pauses and does not consume campaign time or fuel early', () => {
  const f = fixture(); f.a.navigation = {phase:'powered',speed:10,remaining:5};
  assert.equal(start(f).ok,false); assert.equal(f.a.navigation.phase,'powered');
  f.a.navigation.phase = 'drift'; assert.equal(start(f).ok,false);
  f.a.navigation = {phase:'stopped',speed:0,remaining:0}; assert.equal(start(f).ok,true);
  const before = clone(f.a.ship.warpFuel); transit.passTime(f.a,100000); assert.equal(f.a.ship.warpState.remaining,84);
  f.room.hardPaused = true; assert.deepEqual(transit.advance(f.room,84),[]); assert.equal(f.a.ship.warpState.remaining,84);
  f.room.hardPaused = false; transit.advance(f.room,83.75); assert.deepEqual(f.a.ship.warpFuel,before);
  assert.equal(transit.advance(f.room,.25)[0].kind,'warpDeparted'); assert.equal(f.a.ship.warpFuel.D,11);
  transit.advance(f.room,60); close(f.a.ship.warpState.traveledLY,60*LY/seconds[0]); close(f.a.ship.warpState.elapsedSeconds,60);
  const traveled=f.a.ship.warpState.traveledLY;f.room.hardPaused=true;transit.advance(f.room,600);assert.equal(f.a.ship.warpState.traveledLY,traveled);f.room.hardPaused=false;transit.passTime(f.a,1);close(f.a.ship.warpState.traveledLY,traveled*2);
});
test('moving or changing drive impairment interrupts activation without silently replanning', () => {
  for (const change of [f => {f.room.shipPositions[0].q=1;},f => {f.a.ship.sicInventory.find(i=>i.id==='warp-a').impaired=true;}]) {
    const f = fixture(); assert.equal(start(f).ok,true); change(f);
    assert.equal(transit.advance(f.room,84)[0].kind,'warpInterrupted'); assert.equal(f.a.ship.warpFuel.D,12);
  }
});
test('cancelling activation is free, preserves fuel and survives duplicate receipt replay', () => {
  const f = fixture(); assert.equal(start(f).ok,true); f.room.activeId = null;
  const body = {kind:'warpCancel',shipId:'a',sicId:'warp-a',requestId:'cancel-warp'};
  assert.equal(transit.command(f.room,f.p,body).spent,false); assert.equal(f.a.ship.warpState.phase,'cancelled');
  assert.equal(transit.command(f.room,f.p,body).duplicate,true); assert.equal(f.a.ship.warpFuel.D,12);
  assert.deepEqual(transit.advance(f.room,100),[]);
});
test('fuel debits one cell at each needed start; early exit discards only the current remainder', () => {
  const f = fixture(2); f.a.ship.warpFuel = {D:3}; depart(f,3*LY);
  assert.equal(f.a.ship.warpFuel.D,2); transit.passTime(f.a,1440); assert.equal(f.a.ship.warpFuel.D,2);
  transit.passTime(f.a,720); assert.equal(f.a.ship.warpFuel.D,1); close(f.a.ship.warpState.traveledLY,1.5*LY);
  const result = transit.command(f.room,f.p,{kind:'warpExit',shipId:'a',sicId:'warp-a',requestId:'warp-exit-1'});
  assert.equal(result.ok,true); assert.equal(f.a.ship.warpFuel.D,1); close(f.a.ship.warpState.report.discardedLY,.5*LY);
  transit.passTime(f.a,1e8); assert.equal(f.a.ship.warpFuel.D,1); close(f.a.ship.warpState.traveledLY,1.5*LY);
});
test('missing future fuel cannot create distance, and oversized Pass Time stops at arrival', () => {
  const f = fixture(2); f.a.ship.warpFuel = {D:2}; depart(f,2*LY); f.a.ship.warpFuel.D = 0;
  transit.passTime(f.a,1e6); assert.equal(f.a.ship.warpState.phase,'interrupted'); close(f.a.ship.warpState.traveledLY,LY);
  const g = fixture(6); depart(g,.5*LY); transit.passTime(g.a,1e6);
  assert.equal(g.a.ship.warpState.phase,'arrived'); close(g.a.ship.warpState.elapsedSeconds,300); close(g.a.ship.warpState.traveledLY,.5*LY);
});
test('warp phases, fuel and actor-owned receipts survive JSON restart and module reload', () => {
  let f = fixture(2); assert.equal(start(f,{distanceLY:3*LY}).ok,true); transit.advance(f.room,30);
  let room = clone(f.room); delete require.cache[require.resolve('../ship-transit')]; const restarted = require('../ship-transit');
  let a = room.starships[0], p = room.units[0]; assert.equal(a.ship.warpState.remaining,30);
  assert.equal(restarted.command(room,p,{kind:'warpStart',shipId:'a',sicId:'warp-a',distanceLY:3*LY,requestId:'warp-start-1'}).duplicate,true);
  restarted.advance(room,30); restarted.passTime(a,720); room = clone(room); a = room.starships[0];
  restarted.passTime(a,3600); assert.equal(a.ship.warpState.phase,'arrived'); close(a.ship.warpState.elapsedSeconds,3*86400);
  assert.equal(a.ship.warpFuel.D,9);
});
test('receipts reject changed payloads and other actors without further spending', () => {
  const f = fixture(); assert.equal(start(f).ok,true);
  assert.equal(start(f,{distanceLY:2*LY}).ok,false);
  assert.equal(transit.command(f.room,f.q,{kind:'warpStart',shipId:'a',sicId:'warp-a',distanceLY:LY,requestId:'warp-start-1'}).ok,false);
  assert.equal(start(f).duplicate,true);
});
test('captured bridge grants allow remote warp but never remote self-destruct', () => {
  const f = fixture(); f.b.ship = clone(f.a.ship); f.b.ship.sicInventory.forEach(i => {i.id=i.id.replace('-a','-b');});
  f.b.ship.placements.forEach(p => {p.sicId=p.sicId.replace('-a','-b');}); f.b.crewCharacterIds = ['pc1'];
  f.room.hackingGrants = [{unitId:'p',targetId:'b',sicId:'bridge-b',sourceId:'a'}];
  assert.equal(stations.access(f.room,f.p,'warp-b').controlled,true);
  const body = {kind:'warpStart',shipId:'b',sicId:'warp-b',distanceLY:LY,requestId:'remote-warp'};
  assert.equal(transit.command(f.room,f.p,body).ok,true);
  assert.equal(transit.command(f.room,f.p,{kind:'destructApprove',shipId:'b',sicId:'destruct-b',requestId:'remote-destruct'}).ok,false);
});
test('two approvals require distinct registered identities, not cloned encounter unit IDs', () => {
  const f = fixture(); assert.equal(approve(f,f.p,'approve-one').ok,true);
  const duplicate = {...f.p,id:'duplicate',location:{...f.q.location}}; f.room.units.push(duplicate);
  assert.equal(approve(f,duplicate,'approve-copy').ok,false);
  f.a.crewNpcUnitIds = []; assert.equal(approve(f,f.q,'approve-stranger').ok,false);
  f.a.crewNpcUnitIds = ['q']; assert.equal(approve(f,f.q,'approve-real').events[0].kind,'needsBlastRoll');
});
test('self-destruct rejects AI, remote/offstation approvals, EN <=15 and changed countdowns', () => {
  for (const change of [f => {f.p.isAI=true;},f => {f.p.location.stationed=false;},f => {f.a.crewCharacterIds=[];},
    f => {f.a.ship.sicInventory.find(i=>i.id==='en-a').type='en-engine-2';}]) {
    const f = fixture(); change(f); assert.equal(approve(f,f.p,'approve-invalid').ok,false);
  }
  const f = fixture(); assert.equal(approve(f,f.p,'approve-one',5).ok,true);
  assert.equal(approve(f,f.q,'approve-change',6).ok,false);
  f.p.location.stationed = false; assert.equal(approve(f,f.q,'approve-left',5).ok,false);
  const g = fixture(); for (const n of [-1,NaN,Infinity,'5']) assert.equal(approve(g,g.p,'approve-invalid',n).ok,false);
});
test('a registered crew member can cancel approvals, countdown or pending blast offstation and out of turn', () => {
  for (const phase of ['approvals','countdown','blastPending']) {
    const f = fixture(); assert.equal(approve(f,f.p,'approve-one',phase === 'countdown' ? 5 : 0).ok,true);
    if (phase !== 'approvals') assert.equal(approve(f,f.q,'approve-two',phase === 'countdown' ? 5 : 0).ok,true);
    f.p.location.stationed = false; f.room.activeId = null;
    const result = transit.command(f.room,f.p,{kind:'destructCancel',shipId:'a',requestId:'cancel-destruct'});
    assert.equal(result.ok,true); assert.equal(result.spent,false); assert.equal(result.events[0].kind,'destructCancelled');
    assert.equal(transit.resolveBlast(f.room,'a',40).ok,false); assert.deepEqual(transit.advance(f.room,100),[]); assert.equal(f.a.currentHullHp,43);
  }
});
test('blast waits for a manual roll, freezes victims at zero and resolves normal damage only once', () => {
  const f = fixture(); arm(f,10); assert.equal(transit.advance(f.room,9).length,0); assert.equal(f.a.currentHullHp,43);
  const event = transit.advance(f.room,1)[0]; assert.equal(event.kind,'needsBlastRoll'); assert.equal(event.diceCount,10); assert.equal(event.die,12);
  assert.deepEqual(event.targetIds,['b']); assert.equal(f.b.currentHullHp,100); assert.equal(f.a.currentHullHp,43);
  f.room.shipPositions[1].q = 50; f.room.shipPositions[2].q = 1;
  assert.deepEqual(transit.advance(f.room,100),[]); assert.equal(transit.resolveBlast(f.room,'a',121).ok,false);
  assert.equal(transit.resolveBlast(f.room,'a',40).ok,true); assert.equal(f.b.currentHullHp,60); assert.equal(f.c.currentHullHp,100); assert.equal(f.a.currentHullHp,0);
  assert.equal(transit.resolveBlast(f.room,'a',40).duplicate,true); assert.equal(f.b.currentHullHp,60);
});
test('blast damage reuses normal burst shields, including reduction and discarded overflow', () => {
  const f = fixture(); f.b.ship.sicInventory = [{id:'shield-b',type:'shield-1'}]; f.b.ship.placements = [{sicId:'shield-b',cell:42}];
  shields.refresh(f.room,{reset:true}); arm(f); assert.equal(transit.resolveBlast(f.room,'a',100).ok,true);
  assert.equal(f.b.currentHullHp,100); assert.equal(f.b.currentShieldHp,0); assert.equal(f.a.currentHullHp,0);
});
test('self-destruct approval, countdown, pending roll, cancellation and settlement survive JSON restart', () => {
  let f = fixture(); assert.equal(approve(f,f.p,'approve-one',2).ok,true);
  let room = clone(f.room); f = {room,a:room.starships[0],p:room.units[0],q:room.units[1]};
  assert.equal(approve(f,f.q,'approve-two',2).ok,true); transit.advance(room,1);
  room = clone(room); assert.equal(room.starships[0].ship.destructState.remaining,1); transit.advance(room,1);
  room = clone(room); assert.equal(room.starships[0].ship.destructState.phase,'blastPending'); assert.deepEqual(transit.advance(room,10),[]);
  assert.equal(transit.resolveBlast(room,'a',50).ok,true); room = clone(room);
  assert.equal(transit.resolveBlast(room,'a',50).duplicate,true); assert.equal(room.starships[1].currentHullHp,50);
});
test('countdowns ignore invalid increments and halt on deliberate pause or lost destruct power', () => {
  const f = fixture(); arm(f,10);
  for (const n of [-1,NaN,Infinity,'10']) assert.deepEqual(transit.advance(f.room,n),[]);
  f.room.holdPaused = true; transit.advance(f.room,10); assert.equal(f.a.ship.destructState.remaining,10);
  f.room.holdPaused = false; f.a.ship.sicInventory.find(i=>i.id==='en-a').disabled = true;
  assert.equal(transit.advance(f.room,10)[0].kind,'destructCancelled'); assert.equal(f.a.currentHullHp,43);
});
test('blast uses maximum hull rather than damaged hull and falls back to unique mapped hull cells', () => {
  const f = fixture(); f.a.currentHullHp = 1; assert.equal(arm(f).events[0].diceCount,10);
  const g = fixture(); delete g.a.maximumHullHp; assert.equal(arm(g).events[0].diceCount,64);
});
test('nextEvent bounds activation/countdown exactly, excluding approvals, journeys and pending rolls', () => {
  const f = fixture(); assert.equal(transit.nextEvent(f.room),Infinity); assert.equal(start(f).ok,true);
  assert.equal(transit.nextEvent(f.room),84); transit.advance(f.room,83.75); assert.equal(transit.nextEvent(f.room),.25);
  transit.advance(f.room,transit.nextEvent(f.room)); assert.equal(transit.nextEvent(f.room),Infinity);
  const g = fixture(); assert.equal(approve(g,g.p,'approve-one',.25).ok,true); assert.equal(transit.nextEvent(g.room),Infinity);
  assert.equal(approve(g,g.q,'approve-two',.25).ok,true); assert.equal(transit.nextEvent(g.room),.25);
  g.room.hardPaused = true; assert.equal(transit.nextEvent(g.room),Infinity); g.room.hardPaused = false;
  assert.equal(transit.advance(g.room,transit.nextEvent(g.room))[0].kind,'needsBlastRoll'); assert.equal(transit.nextEvent(g.room),Infinity);
});
test('NPC crew registration uses deployed unit IDs, never reusable template IDs', () => {
  const f = fixture(); f.a.crewNpcUnitIds = ['npc1']; assert.equal(approve(f,f.q,'approve-template').ok,false);
  f.a.crewNpcUnitIds = ['q']; assert.equal(approve(f,f.q,'approve-unit').ok,true);
  const copy = {...f.q,id:'q-copy',location:{...f.p.location}}; f.room.units.push(copy);
  assert.equal(approve(f,copy,'approve-clone').ok,false);
});
test('self-destruct requires generated EN strictly greater than fifteen', () => {
  const f = fixture(); f.a.ship.sicInventory.find(i=>i.id==='en-a').type = 'en-engine-2';
  const engineer = {...f.q,id:'engineer',engineeringSkill:2}; f.room.units.push(engineer); seat(f.room,engineer,f.a,'en-a');
  assert.equal(power.output(f.a,f.room.units).en,15); assert.equal(approve(f,f.p,'approve-fifteen').ok,false);
  engineer.engineeringSkill = 2.1; assert.equal(power.output(f.a,f.room.units).en,15.1);
  assert.equal(approve(f,f.p,'approve-enough').ok,true);
});
test('pending blast cancellation is durable and old approvals cannot rearm it on retry', () => {
  const f = fixture(); const event = arm(f).events[0]; let room = clone(f.room);
  room.units[0].location.stationed = false;
  const body = {kind:'destructCancel',shipId:'a',requestId:'cancel-persist'};
  assert.equal(transit.command(room,room.units[0],body).events[0].id,event.id);
  room = clone(room); assert.equal(transit.command(room,room.units[0],body).duplicate,true);
  assert.equal(transit.resolveBlast(room,'a',40).ok,false);
  assert.equal(transit.command(room,room.units[1],{kind:'destructApprove',shipId:'a',sicId:'destruct-a',countdownSeconds:0,requestId:'approve-two'}).duplicate,true);
  assert.equal(room.starships[0].ship.destructState.phase,'cancelled'); assert.equal(room.starships[0].currentHullHp,43);
});
test('lost capture cannot issue another remote warp command, and an off-drive engineer gives no bonus', () => {
  const f = fixture(); seat(f.room,f.q,f.a,'en-a'); f.q.engineeringSkill=10;
  assert.equal(start(f).ok,true); assert.equal(f.a.ship.warpState.total,84);
  const g = fixture(); g.b.ship = clone(g.a.ship); g.b.ship.sicInventory.forEach(i=>{i.id=i.id.replace('-a','-b');});
  g.b.ship.placements.forEach(p=>{p.sicId=p.sicId.replace('-a','-b');});
  g.room.hackingGrants = [{unitId:'p',targetId:'b',sicId:'bridge-b',sourceId:'a'}];
  assert.equal(transit.command(g.room,g.p,{kind:'warpStart',shipId:'b',sicId:'warp-b',distanceLY:LY,requestId:'remote-start'}).ok,true);
  g.room.hackingGrants = [];
  assert.equal(transit.command(g.room,g.p,{kind:'warpCancel',shipId:'b',sicId:'warp-b',requestId:'remote-cancel'}).ok,false);
});

test('one large time advance completes activation and spends only remaining time on travel',()=>{
 const f=fixture(6);assert.equal(start(f,{distanceLY:LY}).ok,true);
 const activation=f.a.ship.warpState.remaining,travel=f.a.ship.warpState.secondsPerParsec;
 transit.advance(f.room,activation+travel/2);
 assert.equal(f.a.ship.warpState.phase,'traveling');close(f.a.ship.warpState.traveledLY,LY/2);
 transit.advance(f.room,travel/2);assert.equal(f.a.ship.warpState.phase,'arrived');
});
