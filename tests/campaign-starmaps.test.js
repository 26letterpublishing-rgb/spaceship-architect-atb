'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),maps=require('../ship-map-core'),stations=require('../station-access'),transit=require('../ship-transit'),galaxy=require('../campaign-starmaps'),space=require('../space-objects');
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

function campaign(){const {a}=fixture(6);a.controlType='pc';return {starships:[a],privateNotes:[]};}
function cmd(c,b){return galaxy.command(c,{receipt:require('node:crypto').randomUUID(),...b},{gm:true,combatActive:false});}
function setup(){const c=campaign();cmd(c,{kind:'create',name:'Test galaxy'});const m=c.starmaps.maps[0];cmd(c,{kind:'star',mapId:m.id,q:2,r:0,name:'Destination',gmNotes:'Secret',planets:[{name:'Hidden',hidden:true}]});cmd(c,{kind:'position',mapId:m.id,shipId:'a',q:0,r:0});return {c,m,star:m.stars[0]};}
test('Galaxy scales accept hundredths and hide private star information',()=>{const {c,m,star}=setup();assert.equal(m.lightYearsPerHex,3.26);cmd(c,{kind:'scale',mapId:m.id,scale:.01});assert.equal(m.lightYearsPerHex,.01);assert.throws(()=>cmd(c,{kind:'scale',mapId:m.id,scale:.001}));const v=galaxy.view(c,false);assert.equal(v.maps[0].stars[0].gmNotes,undefined);assert.deepEqual(v.maps[0].stars[0].planets,[]);});
test('Galaxy travel spends fuel once, avoids the combat timer, and persists fractions and arrival',()=>{const {c,m,star}=setup(),ship=c.starships[0];const b={kind:'travel',mapId:m.id,starId:star.id,shipId:'a',receipt:'travel-once'};galaxy.command(c,b,{gm:true});galaxy.command(c,b,{gm:true});const w=ship.ship.warpState;assert.equal(transit.nextEvent({starships:[ship]}),Infinity);transit.advance({starships:[ship]},10000);assert.equal(w.phase,'activating');const before=structuredClone(ship.ship.warpFuel);galaxy.advance(c,w.total/60+5);assert.equal(w.phase,'traveling');assert.ok(c.starmaps.positions.a.q>0&&c.starmaps.positions.a.q<2);const reloaded=JSON.parse(JSON.stringify(c));galaxy.advance(reloaded,100);assert.equal(reloaded.starships[0].ship.warpState.phase,'arrived');assert.equal(reloaded.starmaps.positions.a.q,2);const fuel=structuredClone(reloaded.starships[0].ship.warpFuel),notes=reloaded.privateNotes.length;galaxy.advance(reloaded,100);assert.deepEqual(reloaded.starships[0].ship.warpFuel,fuel);assert.equal(reloaded.privateNotes.length,notes);assert.notDeepEqual(fuel,before);});
test('System maps preserve a central Sun and persist only their own encounter',()=>{const {c,m,star}=setup();cmd(c,{kind:'system',mapId:m.id,starId:star.id,objects:[]});assert.equal(star.system[0].kind,'sun');assert.equal(star.system[0].intensity,2);cmd(c,{kind:'openSystem',mapId:m.id,starId:star.id});galaxy.saveSystem(c,{spaceObjects:[{id:'unrelated',kind:'asteroid'}]});assert.equal(star.system[0].kind,'sun');assert.equal(space.normalize([{id:'object-sun-test',kind:'sun',name:'Sun',quantity:1,q:0,r:0,intensity:20}])[0].intensity,2);});

test('mixed Phazon and ordinary launchers purchase ten missiles without losing storage',()=>{const ammo=require('../missile-ammunition'),ship={groupCredits:10000,sicInventory:[{id:'torpedo',type:'phazon-torpedo-launcher'},{id:'missiles',type:'missile-launcher-1'}],placements:[{sicId:'torpedo',cell:0},{sicId:'missiles',cell:1}]};const result=ammo.purchase(ship,'missile-1',10,maps.definition);assert.equal(result.loaded,3);assert.equal(result.stored,7);assert.equal(JSON.parse(JSON.stringify(ship)).missileStorage['missile-1'],7);assert.equal(ship.missileAmmo.torpedo,undefined);});
test('Sun destroys only a center entrant and an active Gravity Absolution Field protects it',()=>{const gravity=require('../ship-black-holes'),sun={id:'object-sun-123',kind:'sun',name:'Sun',intensity:2,q:0,r:0},ship={id:'s',title:'Ship',currentHullHp:20,ship:{gridCells:[0],sicInventory:[],placements:[]}},room={starships:[ship],units:[],shipPositions:[{id:'s',q:1,r:0}],spaceObjects:[sun]};gravity.advance(room,.01);assert.equal(ship.currentHullHp,20);room.shipPositions[0].q=0;gravity.advance(room,.01);assert.equal(ship.currentHullHp,0);ship.currentHullHp=20;ship.ship.sicInventory=[{id:"g",type:"gravity-absolution-field"},{id:"shield",type:"shield-1"}];ship.ship.placements=[{sicId:"g",cell:0},{sicId:"shield",cell:1}];ship.ship.gravityFieldState={active:true,sicId:"g",remaining:12};gravity.advance(room,.01);assert.equal(ship.currentHullHp,20);});
test('cancelled travel retains spent fuel and fractional position',()=>{const {c,m,star}=setup();cmd(c,{kind:'travel',mapId:m.id,starId:star.id,shipId:'a'});galaxy.advance(c,6);const p=structuredClone(c.starmaps.positions.a),fuel=structuredClone(c.starships[0].ship.warpFuel);cmd(c,{kind:'exit',shipId:'a'});galaxy.advance(c,10000);assert.deepEqual(c.starmaps.positions.a,p);assert.deepEqual(c.starships[0].ship.warpFuel,fuel);});
test('dragging a star preserves its saved system, private notes and visibility',()=>{
  const {c,m,star}=setup();star.hidden=true;star.lore='Published lore';
  cmd(c,{kind:'system',mapId:m.id,starId:star.id,objects:[{id:'object-planet-kept',kind:'planet',name:'Keep Me',q:5,r:0,quantity:1}]});
  const before=structuredClone(star);
  cmd(c,{kind:'moveStar',mapId:m.id,starId:star.id,q:-3,r:4});
  assert.deepEqual(star,{...before,q:-3,r:4});
  assert.throws(()=>cmd(c,{kind:'star',mapId:m.id,name:'Pileup',q:-3,r:4}),/already occupies/);
  cmd(c,{kind:'star',mapId:m.id,name:'Other',q:8,r:8});
  assert.throws(()=>cmd(c,{kind:'moveStar',mapId:m.id,starId:star.id,q:8,r:8}),/already occupies/);
  assert.equal(star.q,-3);
});
test('moving and deleting stars remain GM-only and reject active journey destinations',()=>{
  const {c,m,star}=setup();
  for(const kind of ['moveStar','deleteStar'])assert.throws(()=>galaxy.command(c,{kind,mapId:m.id,starId:star.id,q:3,r:0,receipt:'player-attempt-'+kind},{gm:false}),/Only the GM/);
  cmd(c,{kind:'travel',mapId:m.id,starId:star.id,shipId:'a'});
  for(const kind of ['moveStar','deleteStar'])assert.throws(()=>cmd(c,{kind,mapId:m.id,starId:star.id,q:3,r:0}),/journeys/);
  cmd(c,{kind:'star',mapId:m.id,starId:star.id,q:star.q,r:star.r,name:star.name,lore:'New report during travel'});
  assert.equal(m.stars[0].lore,'New report during travel');
});
test('deleting a star preserves ship positions and cannot erase the active battle system',()=>{
  const {c,m,star}=setup();cmd(c,{kind:'openSystem',mapId:m.id,starId:star.id});
  assert.throws(()=>galaxy.command(c,{kind:'deleteStar',mapId:m.id,starId:star.id,receipt:'delete-active-system'},{gm:true,combatActive:true}),/End the current encounter/);
  const position=structuredClone(c.starmaps.positions.a);cmd(c,{kind:'deleteStar',mapId:m.id,starId:star.id});
  assert.deepEqual(c.starmaps.positions.a,position);assert.equal(m.stars.length,0);assert.equal(c.activeSystem,undefined);
});
test('renaming a star updates its central Sun without erasing authored planets',()=>{
  const {c,m,star}=setup();cmd(c,{kind:'system',mapId:m.id,starId:star.id,objects:[{id:'object-planet-kept',kind:'planet',name:'Keep Me',q:5,r:0,quantity:1}]});
  cmd(c,{kind:'star',mapId:m.id,starId:star.id,q:star.q,r:star.r,name:'New Name'});
  assert.equal(m.stars[0].system.find(o=>o.kind==='sun').name,'New Name');assert.equal(m.stars[0].system.find(o=>o.kind==='planet').name,'Keep Me');
});
test('Explore seeds a usable galaxy once and does not leak its secret star to players',()=>{
  const c=campaign();assert.equal(galaxy.seedShowcase(c),false);c.showcase=true;
  assert.equal(galaxy.seedShowcase(c),true);assert.equal(c.starmaps.maps[0].stars.length,3);assert.equal(galaxy.view(c,false).maps[0].stars.length,3);
  const map=c.starmaps.maps[0],home=map.stars.find(s=>s.name==='Haven');map.stars[1].hidden=true;assert.equal(galaxy.view(c,false).maps[0].stars.length,2);assert.deepEqual(c.starmaps.positions.a,{mapId:map.id,q:home.q,r:home.r});
  assert.ok(home.system.some(o=>o.kind==='planet'));assert.ok(home.system.some(o=>o.kind==='asteroid'));
  home.lore='Authored by GM';assert.equal(galaxy.seedShowcase(c),false);assert.equal(home.lore,'Authored by GM');
});
test('journey review reports actual impaired and instant drive activation durations',()=>{
  const {c,m,star}=setup(),ship=c.starships[0],drive=ship.ship.sicInventory.find(i=>maps.definition(i.type).warp);drive.impairmentPoints=1;
  const result=cmd(c,{kind:'quote',mapId:m.id,starId:star.id,shipId:ship.id});
  cmd(c,{kind:'travel',mapId:m.id,starId:star.id,shipId:ship.id});assert.equal(result.quote.activationSeconds,ship.ship.warpState.total);
  cmd(c,{kind:'exit',shipId:ship.id});drive.impairmentPoints=0;drive.type='ew-ftl-drive';
  assert.equal(cmd(c,{kind:'quote',mapId:m.id,starId:star.id,shipId:ship.id}).quote.activationSeconds,120);
});
test('combat descent is rejected without spending a turn',()=>{const descent=require('../ship-descent'),{room,a,p}=fixture(),before=structuredClone(room);const result=descent.queue(room,p,{kind:'descend',requestId:'descend-once'});assert.equal(result.ok,false);assert.match(result.error,/cannot escape combat/);assert.deepEqual(room,before);});

test('real-time warp is server-owned, pauses for combat, and resumes without catching up paused time',()=>{
 const {c,m,star}=setup();cmd(c,{kind:'travel',mapId:m.id,starId:star.id,shipId:'a'});const w=c.starships[0].ship.warpState,j=c.starmaps.journeys.a;let now=j.clockAt;
 galaxy.tick(c,now+5000);assert.equal(w.remaining,w.total-5);
 galaxy.tick(c,now+65000,true);assert.equal(w.remaining,w.total-5);
 galaxy.tick(c,now+66000);assert.equal(w.remaining,w.total-6);
 now+=66000;galaxy.tick(c,now+(w.remaining+10)*1000);assert.equal(w.phase,'traveling');assert.ok(c.starmaps.positions.a.q>0&&c.starmaps.positions.a.q<2);
 const fuel=structuredClone(c.starships[0].ship.warpFuel);galaxy.tick(c,j.clockAt);assert.deepEqual(c.starships[0].ship.warpFuel,fuel);
});
test('GM time acceleration and real-time ticks share one journey and preserve private ship positions',()=>{
 const {c,m,star}=setup();cmd(c,{kind:'travel',mapId:m.id,starId:star.id,shipId:'a'});const now=c.starmaps.journeys.a.clockAt;
 galaxy.advance(c,.1,{now:now+1000});const remaining=c.starships[0].ship.warpState.remaining;
 galaxy.tick(c,now+2000);assert.equal(c.starships[0].ship.warpState.remaining,remaining-1);
 c.starships.push({id:'secret',controlType:'gm',ship:{warpState:{campaignClock:true}}});c.starmaps.positions.secret={q:50,r:50,mapId:m.id};
 const packet=galaxy.travelPacket(c,false,now);assert.equal(packet.positions.secret,undefined);assert.ok(!packet.ships.some(s=>s.id==='secret'));
 galaxy.advance(c,10000);assert.equal(c.starships[0].ship.warpState.phase,'arrived');assert.equal(c.starmaps.positions.a.q,2);assert.deepEqual(c.starmaps.journeys,{});
});
test('galaxy activation uses the same stationed-engineer benefit as combat',()=>{
 const {c,m,star}=setup(),ship=c.starships[0],room={starships:c.starships,units:[]},u={id:'pc1',team:'pc',engineeringSkill:3};seat(room,u,ship,'warp-a',0);
 ship.characterLocations={pc1:u.location};c.characters=[{id:'pc1',character:{computed:{skills:{Engineering:3}}}}];
 const plan=galaxy.quote(c,'a',star.id,m.id).plan,expected=transit.activationSeconds({starships:c.starships,units:[u]},ship,plan);
 assert.equal(cmd(c,{kind:'quote',mapId:m.id,starId:star.id,shipId:'a'}).quote.activationSeconds,expected);
 cmd(c,{kind:'travel',mapId:m.id,starId:star.id,shipId:'a'});assert.equal(ship.ship.warpState.total,expected);
});


test('explicit warp fuel choices validate stock and compatibility and survive journey start',()=>{
 const {c,m,star}=setup(),ship=c.starships[0],args={mapId:m.id,starId:star.id,shipId:ship.id};
 const initial=cmd(c,{kind:'quote',...args}).quote;assert.ok(initial.driveName);assert.ok(initial.fuelOptions.length);
 const choice=initial.fuelOptions.find(o=>o.available>0&&o.rangeLY*o.available>=initial.targetLY);assert.ok(choice);
 const fuelCounts={[choice.grade]:Math.ceil(initial.targetLY/choice.rangeLY)};
 const q=cmd(c,{kind:'quote',...args,fuelCounts}).quote;assert.deepEqual(Object.fromEntries(Object.entries(q.counts).filter(([,n])=>n)),fuelCounts);
 for(const counts of [{[choice.grade]:99999},{[choice.grade]:-1},{[choice.grade]:1.5},{Bogus:1}])assert.throws(()=>cmd(c,{kind:'quote',...args,fuelCounts:counts}));
 cmd(c,{kind:'travel',...args,fuelCounts});assert.equal(ship.ship.warpState.phase,'activating');
});

test('second installed drive is rejected even powered off, while storage is allowed',()=>{
 const {c,m,star}=setup(),ship=c.starships[0],args={kind:'quote',mapId:m.id,starId:star.id,shipId:ship.id};
 ship.ship.sicInventory.push({id:'extra',type:'ew-ftl-drive',powered:false});
 assert.ok(cmd(c,args).quote.driveName);
 ship.ship.placements.push({sicId:'extra',cell:200});assert.throws(()=>cmd(c,args),/one Warp Drive may be installed/);
 assert.match(maps.exteriorError(ship.ship),/one installed Warp Drive/);
 ship.ship.placements.pop();assert.ok(cmd(c,args).quote.driveName);
});


test('partial warp requires acknowledgment, consumes selected fuel and stops short of the star',()=>{
 const {c,m,star}=setup(),ship=c.starships[0],args={mapId:m.id,starId:star.id,shipId:ship.id};
 star.q=1000;star.r=0;ship.ship.warpFuel={S:1};
 const q=cmd(c,{kind:'quote',...args}).quote;
 assert.equal(q.partial,true);assert.ok(q.coveredLY>0&&q.coveredLY<q.targetLY);
 assert.throws(()=>cmd(c,{kind:'travel',...args}),/partial journey warning/);
 cmd(c,{kind:'travel',...args,acceptPartial:true});
 galaxy.advance(c,1e9);
 assert.equal(ship.ship.warpState.phase,'interrupted');
 assert.ok(c.starmaps.positions[ship.id].q>0&&c.starmaps.positions[ship.id].q<star.q);
 assert.ok(Math.abs(ship.ship.warpState.traveledLY-q.coveredLY)<1e-6);
 assert.equal(Object.keys(c.starmaps.journeys).length,0);
});
test('zero fuel still permits a travel quote but cannot start warp',()=>{
 const {c,m,star}=setup(),args={mapId:m.id,starId:star.id,shipId:'a',fuelCounts:{}};
 assert.equal(cmd(c,{kind:'quote',...args}).quote.coveredLY,0);
 assert.throws(()=>cmd(c,{kind:'travel',...args,acceptPartial:true}),/at least one/);
});


test('Console destination derives range and enforces map, visibility and local departure constraints',()=>{
 const {c,m,star}=setup(),ship=c.starships[0],dest={mapId:m.id,q:2,r:0};
 assert.equal(galaxy.consoleDestination(c,ship,dest).distanceLY,6.52);
 assert.equal(galaxy.consoleDestination(c,ship,dest).starId,star.id);
 star.hidden=true;assert.equal(galaxy.consoleDestination(c,ship,dest).starId,null);
 assert.throws(()=>galaxy.consoleDestination(c,ship,{...dest,q:Infinity}));
 assert.throws(()=>galaxy.consoleDestination(c,ship,{...dest,mapId:'other'}));
 assert.throws(()=>galaxy.consoleDestination(c,ship,{...dest,q:0}));
 assert.throws(()=>galaxy.consoleDestination(c,ship,{...dest,origin:{mapId:m.id,q:1,r:0}}));
 c.starmaps.localPositions={a:{phase:'surface'}};assert.throws(()=>galaxy.consoleDestination(c,ship,dest),/Leave the planet/);
 delete c.starmaps.localPositions.a;c.starmaps.navigation={allowed:{galaxy:false}};assert.throws(()=>galaxy.consoleDestination(c,ship,dest),/not available/);
});

test('Console Warp projects its sole authoritative journey, survives reload, and records one actual star visit',()=>{
 const {c,m,star}=setup(),ship=c.starships[0];
 const f=fixture(6);f.room.starships[0]=ship;seat(f.room,f.p,ship,'warp-a');
 const destination={mapId:m.id,q:2,r:0,origin:{...c.starmaps.positions.a}};
 const body={kind:'warpStart',shipId:'a',sicId:'warp-a',distanceLY:999,requestId:'destination-start',destination};
 const options={resolveDestination:(s,d)=>galaxy.consoleDestination(c,s,d,{gm:true})};
 assert.equal(transit.command(f.room,f.p,body,options).ok,true);
 assert.equal(ship.ship.warpState.targetLY,6.52);
 assert.equal(transit.command(f.room,f.p,body,options).duplicate,true);
 assert.equal(transit.command(f.room,f.p,{...body,destination:{...destination,q:3}},options).ok,false);
 galaxy.syncConsoleTravel(c);assert.deepEqual(c.starmaps.positions.a,destination.origin);
 transit.advance(f.room,ship.ship.warpState.total+10);galaxy.syncConsoleTravel(c);
 assert.ok(c.starmaps.positions.a.q>0&&c.starmaps.positions.a.q<2);
 assert.deepEqual(c.starmaps.journeys,{}); // never creates a second clock
 const loaded=JSON.parse(JSON.stringify(c)),room={...f.room,starships:loaded.starships};
 transit.advance(room,10000);galaxy.syncConsoleTravel(loaded);
 assert.equal(loaded.starmaps.positions.a.q,2);
 assert.equal(loaded.starmaps.warpVisits.a.length,1);
 assert.equal(loaded.starmaps.warpVisits.a[0].name,star.name);
 assert.equal(typeof loaded.starmaps.warpVisits.a[0].elapsedSeconds,'number');
 const fuel=structuredClone(loaded.starships[0].ship.warpFuel);galaxy.syncConsoleTravel(loaded);transit.advance(room,10000);galaxy.syncConsoleTravel(loaded);
 assert.deepEqual(loaded.starships[0].ship.warpFuel,fuel);assert.equal(loaded.starmaps.warpVisits.a.length,1);
 loaded.starmaps.positions.a.q=8;galaxy.syncConsoleTravel(loaded);assert.equal(loaded.starmaps.positions.a.q,8,'terminal synchronization cannot undo later placement');
});

test('Console cancellation preserves local location and early exit preserves fractional sector position',()=>{
 const {c,m}=setup(),ship=c.starships[0],f=fixture(6);f.room.starships[0]=ship;seat(f.room,f.p,ship,'warp-a');
 const options={resolveDestination:(s,d)=>galaxy.consoleDestination(c,s,d,{gm:true})};
 c.starmaps.localPositions={a:{phase:'orbit',starId:'original'}};
 const start=requestId=>transit.command(f.room,f.p,{kind:'warpStart',shipId:'a',sicId:'warp-a',requestId,destination:{mapId:m.id,q:2,r:0}},options);
 assert.equal(start('first-start').ok,true);
 assert.equal(transit.command(f.room,f.p,{kind:'warpCancel',shipId:'a',sicId:'warp-a',requestId:'first-cancel'}).ok,true);
 galaxy.syncConsoleTravel(c);assert.equal(c.starmaps.localPositions.a.phase,'orbit');assert.equal(c.starmaps.warpVisits,undefined);
 assert.equal(start('second-start').ok,true);transit.advance(f.room,ship.ship.warpState.total+10);galaxy.syncConsoleTravel(c);
 const position=structuredClone(c.starmaps.positions.a);
 assert.equal(transit.command(f.room,f.p,{kind:'warpExit',shipId:'a',sicId:'warp-a',requestId:'second-exit'}).ok,true);
 galaxy.syncConsoleTravel(c);assert.deepEqual(c.starmaps.positions.a,position);assert.equal(c.starmaps.warpVisits,undefined);assert.equal(c.starmaps.localPositions.a,undefined);
});

test('Warp projections filter hidden and restricted destinations/history without mutating travel',()=>{
 const {c,m}=setup();const star=m.stars[0];star.hidden=true;
 const w={phase:'traveling',campaignDestination:{mapId:m.id,starId:star.id,name:star.name,to:{q:star.q,r:star.r}},traveledLY:1};const original=structuredClone(w);
 c.starmaps.warpVisits={a:[{mapId:m.id,starId:star.id,name:star.name}]};
 c.starmaps.journeys={a:{mapId:m.id,starId:star.id,from:{q:0,r:0},to:{q:star.q,r:star.r}}};
 assert.equal(galaxy.publicWarpState(w,c).campaignDestination.starId,undefined);assert.equal(galaxy.view(c,false,'pc1').warpVisits.a.length,0);assert.equal(galaxy.view(c,false,'pc1').journeys.a.starId,undefined);assert.deepEqual(w,original);
 star.hidden=false;assert.equal(galaxy.publicWarpState(w,c).campaignDestination.starId,star.id);assert.equal(galaxy.view(c,false,'pc1').warpVisits.a.length,1);
 c.starmaps.navigation.allowed.galaxy=false;c.starmaps.navigation.mapId='different';assert.equal(galaxy.publicWarpState(w,c).campaignDestination,undefined);assert.equal(galaxy.view(c,false,'pc1').warpVisits.a.length,0);
 assert.equal(galaxy.publicWarpState(w,null).campaignDestination.starId,undefined);assert.deepEqual(w,original);
});
