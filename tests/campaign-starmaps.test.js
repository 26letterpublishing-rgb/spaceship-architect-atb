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
  assert.equal(galaxy.seedShowcase(c),true);assert.equal(c.starmaps.maps[0].stars.length,5);assert.equal(galaxy.view(c,false).maps[0].stars.length,4);
  const map=c.starmaps.maps[0],home=map.stars.find(s=>s.name==='Haven');assert.deepEqual(c.starmaps.positions.a,{mapId:map.id,q:home.q,r:home.r});
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
test('descent consumes one turn, blocks duplicate starts, and completes after sixty active seconds',()=>{const descent=require('../ship-descent'),{room,a,p}=fixture();a.ship.sicInventory.push({id:'hover',type:'decent-hover'});a.ship.placements.push({sicId:'hover',cell:22,mountCells:[22,23,24,25]});room.spaceObjects=[{id:'object-planet-test',kind:'planet',name:'Home',q:0,r:0}];const body={sicId:'bridge-a',kind:'descend',targetId:'object-planet-test',requestId:'descend-once'};const result=descent.queue(room,p,body);assert.equal(result.ok,true,result.error);assert.equal(p.atb,0);assert.equal(descent.queue(room,p,body).duplicate,true);assert.deepEqual(descent.advance(room,59),[]);assert.equal(descent.advance(room,1)[0].kind,'planetLanded');assert.deepEqual(descent.advance(room,60),[]);assert.equal(a.ship.descentState.awaitingGm,true);});

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
 for(const counts of [{},{[choice.grade]:99999},{[choice.grade]:-1},{[choice.grade]:1.5},{Bogus:1}])assert.throws(()=>cmd(c,{kind:'quote',...args,fuelCounts:counts}));
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
