const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const galaxy=require('../campaign-starmaps'),navigation=require('../campaign-navigation'),maps=require('../ship-map-core');
function fixture(){const ship=require('../showcase-starters')('pc','pc',['nova']);const c={showcase:true,starships:[ship],characters:[{id:'nova',character:{identity:{characterName:'Nova'},attributes:{},health:{current:30}}}],npcRoster:[],privateNotes:[]};galaxy.seedShowcase(c);const map=c.starmaps.maps[0],star=map.stars[0],bridge=ship.ship.placements.find(p=>maps.definition(ship.ship.sicInventory.find(i=>i.id===p.sicId).type).bridge),layout=maps.buildLayout(ship.ship),cell=layout.footprint.get(bridge.cell),station=cell.stations.find(s=>s.x===0&&s.y===0);ship.characterLocations.nova={starshipId:ship.id,square:bridge.cell,mesh:station.mesh,sicId:bridge.sicId,stationed:true};return {c,ship,map,star,planet:star.system.find(o=>o.kind==='planet')};}
function send(f,kind,extra={},gm=false){return galaxy.command(f.c,{kind,mapId:f.map.id,starId:f.star.id,shipId:f.ship.id,receipt:randomUUID(),...extra},{gm,characterId:'nova',combatActive:false});}
test('GM placement preserves one nested vessel location and leaves party and inventory alone',()=>{
 const f=fixture(),s=f.c.starmaps,w=require('../campaign-planets').surface(f.star,f.planet);
 w.regions['100']={name:'Acquisition site',seed:'site',hexes:{}};
 s.party={mapId:f.map.id,starId:f.star.id,planetId:f.planet.id,hex:'200',regionId:'',regionHex:''};
 const party=structuredClone(s.party),ship=structuredClone(f.ship),place=extra=>send(f,'systemPosition',{placementOnly:true,...extra},true);
 place({phase:'galaxy',q:7,r:8});assert.deepEqual(s.positions.pc,{mapId:f.map.id,q:7,r:8});assert.equal(s.localPositions.pc,undefined);
 place({phase:'system',q:2,r:3});assert.equal(s.localPositions.pc.starId,f.star.id);assert.equal(s.positions.pc.q,f.star.q);
 place({phase:'surface',planetId:f.planet.id,surfaceHex:'100'});assert.equal(s.localPositions.pc.surfaceHex,'100');assert.equal(s.localPositions.pc.regionId,'');
 place({phase:'surface',planetId:f.planet.id,surfaceHex:'100',regionId:'100',regionHex:'82'});
 const nested=structuredClone(s.localPositions.pc);assert.equal(nested.regionHex,'82');assert.equal(nested.q,f.planet.q);
 const restored=JSON.parse(JSON.stringify(f.c));navigation.state(restored);assert.deepEqual(restored.starmaps.localPositions.pc,nested);
 place({phase:'surface',planetId:f.planet.id,surfaceHex:'100',regionId:'100',regionHex:'82'});assert.deepEqual(s.localPositions.pc,nested);
 assert.deepEqual(s.party,party);assert.deepEqual(f.ship.ship.sicInventory,ship.ship.sicInventory);assert.deepEqual(f.ship.crewCharacterIds,ship.crewCharacterIds);assert.deepEqual(f.ship.characterLocations,ship.characterLocations);
});
test('invalid or unauthorized hierarchical placement has no location or movement effects',()=>{
 const f=fixture(),s=f.c.starmaps;require('../campaign-planets').surface(f.star,f.planet).regions['100']={seed:'site',hexes:{}};
 const valid={placementOnly:true,phase:'surface',planetId:f.planet.id,surfaceHex:'100',regionId:'100',regionHex:'82'};
 navigation.state(f.c);const before=JSON.stringify([s.positions,s.localPositions,s.localJourneys]);
 for(const extra of [{surfaceHex:'999999'},{surfaceHex:'101'},{regionId:'101',surfaceHex:'101'},{regionHex:'999999'},{planetId:'wrong-parent'},{starId:'other-star'},{mapId:'other-sector'},{regionId:'',regionHex:'82'}])assert.throws(()=>send(f,'systemPosition',{...valid,...extra},true));
 assert.throws(()=>send(f,'systemPosition',valid,false),/Only the GM/);
 assert.throws(()=>navigation.command(f.c,{kind:'systemPosition',shipId:f.ship.id,...valid},{gm:true,combatActive:true}),/End the encounter/);
 assert.equal(JSON.stringify([s.positions,s.localPositions,s.localJourneys]),before);
});
test('Lantern matches the approved loadout, cost, hull, five fuel cells and direct Farpoint budget',()=>{const f=fixture();assert.equal(f.ship.title,'Lantern');assert.equal(f.ship.ship.gridCells.length,96);assert.equal(require('../ship-budget').cost(f.ship.ship),139800);assert.deepEqual(f.ship.crewCharacterIds,['nova']);assert.deepEqual(f.ship.ship.minerals,{});const far=f.map.stars.find(s=>s.name==='Farpoint'),unknown={...far,id:'test-unknown',q:25};assert.equal(galaxy.quote(f.c,'pc',far.id,f.map.id).plan.targetLY,69.51);const plan=galaxy.quote(f.c,'pc',far.id,f.map.id).plan;assert.equal(Object.values(plan.counts).reduce((a,b)=>a+b),5);f.map.stars.push(unknown);assert.equal(galaxy.quote(f.c,'pc',unknown.id,f.map.id).plan.partial,true);});
test('system movement interpolates without fuel, pauses for combat, then orbit/descent/leave persist',()=>{const f=fixture(),fuel=structuredClone(f.ship.ship.warpFuel);send(f,'enterSystem');const p=f.c.starmaps.localPositions.pc;send(f,'systemMove',{q:f.planet.q,r:f.planet.r});const j=f.c.starmaps.localJourneys.pc,start=j.clockAt;galaxy.tick(f.c,start+1000,false);assert.ok(p.q>0&&p.q<f.planet.q);const before=p.q;galaxy.tick(f.c,start+100000,true);assert.equal(p.q,before);galaxy.advance(f.c,1);assert.equal(p.q,f.planet.q);send(f,'orbit',{planetId:f.planet.id});send(f,'descend');galaxy.advance(f.c,1);assert.equal(p.phase,'surface');assert.ok(f.c.privateNotes.some(n=>n.direction==='to-gm'&&n.message.includes('landed')));send(f,'leavePlanet');galaxy.advance(f.c,1);assert.equal(p.phase,'orbit');assert.deepEqual(f.ship.ship.warpFuel,fuel);});
test('station, propulsion, visibility, and GM override cannot be bypassed by direct requests',()=>{const f=fixture();send(f,'enterSystem');f.ship.characterLocations.nova.stationed=false;assert.throws(()=>send(f,'systemMove',{q:1,r:4}),/Bridge/);f.ship.characterLocations.nova.stationed=true;for(const i of f.ship.ship.sicInventory)if(maps.definition(i.type).thruster)i.status='powered-down';assert.throws(()=>send(f,'systemMove',{q:1,r:4}),/thrusters/);send(f,'navigation',{mode:'surface',planetId:f.planet.id,allowed:{galaxy:false,system:false,orbit:false,surface:true}},true);const v=galaxy.view(f.c,false);assert.equal(v.maps[0].stars.length,1);assert.deepEqual(v.maps[0].stars[0].system.map(o=>o.id),[f.planet.id]);assert.throws(()=>send(f,'enterSystem'),/not made/);send(f,'systemPosition',{q:2,r:2,phase:'system'},true);assert.equal(f.c.starmaps.localPositions.pc.q,2);});
test('GM teleport cancels existing warp and local timers without refunding fuel',()=>{const f=fixture();send(f,'travel',{starId:f.map.stars[1].id},true);galaxy.advance(f.c,5);const fuel=structuredClone(f.ship.ship.warpFuel);send(f,'systemPosition',{q:3,r:3},true);assert.equal(f.c.starmaps.journeys.pc,undefined);assert.equal(f.ship.ship.warpState.phase,'exited');assert.deepEqual(f.ship.ship.warpFuel,fuel);});
test('galaxy files load as independent maps with regenerated identities and reject invalid scales',()=>{const f=fixture(),file={format:'sa2-galaxy',version:1,map:f.map};send(f,'loadGalaxy',{data:file},true);const m=f.c.starmaps.maps[1];assert.notEqual(m.id,f.map.id);assert.notEqual(m.stars[0].id,f.star.id);assert.equal(m.stars[0].system[0].id,'object-star-'+m.stars[0].id);assert.throws(()=>navigation.normalizeFile({...file,map:{...f.map,lightYearsPerHex:0}}));assert.throws(()=>send(f,'loadGalaxy',{data:file}));});
test('surface actors retain saved ship berths and do not produce ship oxygen warnings',()=>{const f=fixture(),saved=structuredClone(f.ship.characterLocations.nova),units=[{id:'unit',characterId:'nova',location:{arenaId:'surface',square:4}}];require('../ship-state').locations(f.c.starships,units);assert.deepEqual(f.ship.characterLocations.nova,saved);assert.deepEqual(require('../ship-oxygen').people(f.c,{units}),[]);});

test('planet starts validate capability before saving position and orbit can return to system movement',()=>{const f=fixture();send(f,'navigation',{mode:'surface',planetId:f.planet.id,allowed:{galaxy:false,system:false,orbit:true,surface:true}},true);f.ship.characterLocations.nova.stationed=false;assert.throws(()=>send(f,'leavePlanet'),/Bridge/);assert.equal(f.c.starmaps.localPositions.pc,undefined);f.ship.characterLocations.nova.stationed=true;send(f,'leavePlanet');galaxy.advance(f.c,1);assert.equal(f.c.starmaps.localPositions.pc.phase,'orbit');send(f,'navigation',{mode:'orbit',planetId:f.planet.id,allowed:{system:true}},true);send(f,'enterSystem');assert.equal(f.c.starmaps.localPositions.pc.phase,'system');send(f,'systemMove',{q:3,r:1});});
test('Transporter uses its physical station, persists surface passengers and respects shields',()=>{const f=fixture(),s=require('../showcase-everything')('pc',['nova']);f.c.starships=[s];f.ship=s;const i=s.ship.sicInventory.find(i=>i.type==='transporter'),p=s.ship.placements.find(p=>p.sicId===i.id),seat=maps.componentDefinition(i).stations[0];s.characterLocations.nova={starshipId:s.id,sicId:i.id,square:p.cell+seat.y*maps.gridColumns(s.ship)+seat.x,mesh:seat.mesh,stationed:true};send(f,'systemPosition',{phase:'orbit',planetId:f.planet.id},true);s.ship.currentShieldHp=1;assert.throws(()=>send(f,'beamDown',{sicId:i.id,passengerIds:['nova'],diceResults:[]}),/shields/);s.ship.currentShieldHp=0;send(f,'beamDown',{sicId:i.id,passengerIds:['nova'],diceResults:[]});galaxy.advance(f.c,.2);assert.equal(s.characterLocations.nova.environment,'surface');assert.equal(s.characterLocations.nova.planetId,f.planet.id);assert.deepEqual(require('../ship-oxygen').people(f.c),[]);assert.ok(f.c.privateNotes.some(n=>n.message.includes('Transport completed')));});
test('both approved Explore designs remain saveable with valid exterior mounts and airlocks',()=>{for(const side of ['pc','gm']){const s=require('../showcase-starters')(side,side);assert.equal(maps.exteriorError(s.ship),'');assert.equal(maps.ensureAirlocks(s),'');assert.equal(s.ship.gridCells.length+s.ship.triangleCells.length,96);assert.equal(s.ship.mapIcon,side==='pc'?1:2);}});

test('takeoff takes twenty active seconds, survives reload, blocks repeat launch and cancels safely if equipment fails',()=>{
 const f=fixture();send(f,'systemPosition',{phase:'surface',planetId:f.planet.id},true);send(f,'leavePlanet');let j=f.c.starmaps.localJourneys.pc;assert.equal(j.kind,'ascend');assert.equal(j.remaining,20);assert.equal(f.c.starmaps.localPositions.pc.phase,'surface');assert.throws(()=>send(f,'leavePlanet'),/current movement/);assert.throws(()=>send(f,'enterSystem'),/surface/);
 navigation.tick(f.c,j.clockAt+5000,true);assert.equal(j.remaining,20);navigation.advance(f.c,10);assert.equal(j.remaining,10);
 const restored=JSON.parse(JSON.stringify(f.c));navigation.advance(restored,10);assert.equal(restored.starmaps.localPositions.pc.phase,'orbit');assert.equal(restored.starmaps.localJourneys.pc,undefined);assert.equal(restored.starmaps.party,undefined);
 f.ship.ship.currentHullHp=0;navigation.advance(f.c,10);assert.equal(f.c.starmaps.localPositions.pc.phase,'surface');assert.equal(f.c.starmaps.localJourneys.pc,undefined);
});
test('local travel points the ship along its axial course and retains heading after arrival',()=>{
 const f=fixture();send(f,'enterSystem');const from={...f.c.starmaps.localPositions.pc};for(const to of [{q:4,r:4},{q:-2,r:4},{q:0,r:-3}]){const p=f.c.starmaps.localPositions.pc;const expected=maps.shipHeading({navigation:{direction:{q:to.q-p.q,r:to.r-p.r}}});send(f,'systemMove',to);assert.equal(maps.shipHeading(f.ship),expected);navigation.advance(f.c,1000);assert.equal(maps.shipHeading(f.ship),expected);}
});

function runway(ship){
 const hover=ship.ship.sicInventory.find(i=>maps.definition(i.type).landing==='hover');hover.disabled=true;
 // Lantern's larger hull needs one additional test-only thruster for Aerofoil's minimum Move 5.
 ship.ship.sicInventory.push({id:'runway-thruster',type:'exhaust-thruster-2',status:'installed'});
 ship.ship.placements.push({sicId:'runway-thruster',cell:ship.ship.gridCells[0]-maps.gridColumns(ship.ship)});
 ship.ship.sicInventory.push({id:'test-aerofoil',type:'decent-aerofoil',status:'installed'},{id:'test-wheels',type:'land-wheels',status:'installed'});
 ship.ship.placements.push({sicId:'test-aerofoil',cell:ship.ship.gridCells[0]},{sicId:'test-wheels',mountCells:Array.from({length:maps.gridColumns(ship.ship)*maps.gridRows(ship.ship)},(_,n)=>n).filter(n=>maps.exteriorPlacement(ship.ship,'land-wheels',n,'test-wheels')).slice(0,4)});
 return hover;
}

test('runway departure and descent validate authored strips without consuming travel or fuel',()=>{
 const f=fixture();runway(f.ship);send(f,'systemPosition',{phase:'orbit',planetId:f.planet.id},true);const fuel=JSON.stringify(f.ship.ship.warpFuel);
 assert.throws(()=>send(f,'descend'),/no authored Landing Strip/);assert.equal(f.c.starmaps.localJourneys.pc,undefined);assert.equal(f.c.starmaps.localPositions.pc.phase,'orbit');assert.equal(JSON.stringify(f.ship.ship.warpFuel),fuel);
 const world=require('../campaign-planets').surface(f.star,f.planet);world.hexes['100']={landingStrip:true};send(f,'descend');navigation.advance(f.c,20);assert.equal(f.c.starmaps.party.awaitingLanding,true);
 assert.throws(()=>send(f,'leavePlanet'),/departure hex/);assert.equal(f.c.starmaps.localJourneys.pc,undefined);
 galaxy.command(f.c,{kind:'planetLand',mapId:f.map.id,starId:f.star.id,planetId:f.planet.id,hex:'100',receipt:randomUUID()},{gm:false,characterId:'nova',combatActive:false});
 const j=f.c.starmaps.partyJourney;require('../planet-travel').tick(f.c,j.clockAt+4000,false);assert.equal(f.c.starmaps.localPositions.pc.surfaceHex,'100');
 // Restore the established pilot station after landing, as normal departure requires.
 const bridge=require('../ship-automation').seats(f.ship).find(s=>s.bridge);f.ship.characterLocations.nova={...bridge};
 world.hexes['100'].landingStrip=false;assert.throws(()=>send(f,'leavePlanet'),/departure hex/);world.hexes['100'].landingStrip=true;send(f,'leavePlanet');assert.equal(f.c.starmaps.localJourneys.pc.kind,'ascend');
});
test('only eligible installed Hover overrides runway restriction; installation EN is zero',()=>{
 const f=fixture(),hover=runway(f.ship);assert.equal(maps.requiresLandingStrip(f.ship),true);hover.disabled=false;assert.equal(maps.requiresLandingStrip(f.ship),false);
 hover.impaired=true;assert.equal(maps.requiresLandingStrip(f.ship),true);hover.impaired=false;hover.disabled=true;assert.equal(maps.requiresLandingStrip(f.ship),true);
 hover.disabled=false;const place=f.ship.ship.placements.find(p=>p.sicId===hover.id),saved=place.mountCells;place.mountCells=[];assert.equal(maps.requiresLandingStrip(f.ship),true);place.mountCells=saved;
 assert.equal(maps.definition('land-wheels').energyCost,0);assert.equal(maps.definition('decent-aerofoil').energyCost,0);assert.match(maps.capabilities(f.ship).find(c=>c.key==='land-wheels').detail,/1.6 EN/);
 f.ship.ship.placements=f.ship.ship.placements.filter(p=>!['test-aerofoil','test-wheels'].includes(p.sicId));hover.disabled=true;assert.equal(maps.requiresLandingStrip(f.ship),false,'stored gear does not impose rule');
});


test('regional strips permit descent and departure only at the exact nested site',()=>{
 const f=fixture();runway(f.ship);const planets=require('../campaign-planets'),w=planets.surface(f.star,f.planet);w.regions['100']={name:'Airfield',seed:'airfield',type:'temperate',hexes:{'82':{landingStrip:true}}};
 send(f,'systemPosition',{phase:'orbit',planetId:f.planet.id},true);send(f,'descend');navigation.advance(f.c,20);
 send(f,'planetLand',{hex:'100',planetId:f.planet.id});const j=f.c.starmaps.partyJourney;require('../planet-travel').tick(f.c,j.clockAt+4000,false);
 const loc=f.c.starmaps.localPositions.pc;assert.equal(loc.regionId,'100');assert.equal(loc.regionHex,'82');
 const seat=require('../ship-automation').seats(f.ship).find(s=>s.bridge);f.ship.characterLocations.nova={...seat};
 loc.regionHex='83';assert.throws(()=>send(f,'leavePlanet'),/departure hex/);loc.regionHex='82';send(f,'leavePlanet');assert.equal(f.c.starmaps.localJourneys.pc.kind,'ascend');
});
