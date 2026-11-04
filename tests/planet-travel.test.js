const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const galaxy=require('../campaign-starmaps'),travel=require('../planet-travel'),boarding=require('../planet-boarding'),motion=require('../planet-motion');
function fixture(){const ship=require('../showcase-starters')('pc','pc',['nova','orion']),c={showcase:true,starships:[ship],characters:['nova','orion'].map(id=>({id,character:{identity:{characterName:id},attributes:{},health:{current:30}}})),npcRoster:[],privateNotes:[]};galaxy.seedShowcase(c);boarding.startExplore(c);const p=c.starmaps.party;return {c,ship,p,send:(kind,extra={},gm=true)=>galaxy.command(c,{kind,...p,...extra,receipt:randomUUID()},{gm,characterId:'nova',combatActive:false})};}
test('surface approval is GM-only, deduplicated, timed, reload-safe and boards only on arrival',()=>{
 const f=fixture(),hex=f.c.starmaps.localPositions.pc.surfaceHex;
 f.send('planetTravelRequest',{hex},false);const request=f.c.starmaps.travelRequests[0];assert.equal(request.status,'pending');assert.ok(f.c.privateNotes.some(n=>n.id===request.id));
 assert.throws(()=>f.send('planetTravelRequest',{hex},false),/already pending/);
 assert.throws(()=>f.send('planetTravelDecision',{requestId:request.id,approve:true},false),/Only the GM/);
 f.send('planetTravelDecision',{requestId:request.id,approve:true});assert.equal(boarding.atShip(f.c,f.ship),false);const j=f.c.starmaps.partyJourney;
 assert.throws(()=>f.send('planetTravelDecision',{requestId:request.id,approve:true}),/already been resolved/);
 const now=j.clockAt;galaxy.tick(f.c,now+10000,true);assert.equal(j.remaining,j.total);
 const copy=JSON.parse(JSON.stringify(f.c));galaxy.tick(copy,now+10000+j.total*1000,false);assert.equal(copy.starmaps.partyJourney,undefined);assert.equal(boarding.atShip(copy,copy.starships[0]),true);assert.equal(copy.starships[0].characterLocations.nova.environment,'starship');
});
test('stale destinations cannot be approved; declines leave the party in place',()=>{
 const f=fixture();f.send('planetTravelRequest',{hex:'12'},false);const r=f.c.starmaps.travelRequests[0];f.send('planetMoveParty',{hex:'13'});assert.throws(()=>f.send('planetTravelDecision',{requestId:r.id,approve:true}),/party has moved/);f.send('planetTravelDecision',{requestId:r.id,approve:false});assert.equal(f.c.starmaps.party.hex,'13');assert.equal(r.status,'declined');
});
test('wrapping planet path and bounded regional speed are deterministic',()=>{
 assert.equal(travel.route('0','1289').distance,1);assert.equal(travel.route('0','14',true).distance,14);
 const f=fixture();const base={...f.p,hex:'10'};f.c.starmaps.party=base;const j=travel.begin(f.c,{...base,hex:'12'});assert.equal(j.total,8);delete f.c.starmaps.partyJourney;f.c.starmaps.party={...base,regionId:'10',regionHex:'10'};assert.equal(travel.begin(f.c,{...f.c.starmaps.party,regionHex:'12'}).total,4);
});
test('travel across the planet seam survives reload and boards the saved ship at arrival',()=>{
 const f=fixture();f.send('planetMoveParty',{hex:'1170'});f.c.starmaps.localPositions.pc.surfaceHex='4799';
 f.send('planetTravelRequest',{hex:'4799'},false);const request=f.c.starmaps.travelRequests[0];
 f.send('planetTravelDecision',{requestId:request.id,approve:true});
 assert.equal(f.c.starmaps.partyJourney.route.distance,1);assert.equal(f.c.starmaps.partyJourney.total,4);
 const saved=JSON.parse(JSON.stringify(f.c)),j=saved.starmaps.partyJourney;
 galaxy.tick(saved,j.clockAt+j.total*1000,false);
 assert.equal(saved.starmaps.party.hex,'4799');assert.equal(boarding.atShip(saved,saved.starships[0]),true);
 assert.equal(saved.starships[0].characterLocations.nova.environment,'starship');
});
test('forced GM reposition requires confirmation and seats a PC on the bridge',()=>{
 const f=fixture(),map=f.c.starmaps.maps[0];assert.throws(()=>f.send('position',{mapId:map.id,shipId:'pc',q:2,r:3}),/Confirm/);assert.ok(f.c.starmaps.party);
 f.send('position',{mapId:map.id,shipId:'pc',q:2,r:3,forceParty:true});assert.equal(f.c.starmaps.party,undefined);assert.equal(galaxy.canPilot(f.c,f.ship,'nova'),true);assert.equal(f.c.starmaps.navigation.mode,'galaxy');assert.ok(f.ship.characterLocations.orion.square!==null);
});
test('landing decelerates and completes exactly on the destination; hover/aerofoil differ',()=>{
 const start=motion.surface(0,true),half=motion.surface(.5,true),late=motion.surface(.75,true),end=motion.surface(1,true);assert.ok(half.y-start.y>late.y-half.y);assert.ok(end.y===0);assert.equal(end.scale,1);assert.ok(motion.surface(1,false,'hover').y===0);assert.ok(motion.surface(1,false,'aerofoil').y<0);assert.deepEqual(motion.orbit(0),motion.orbit(0));
});
test('city strokes preserve terrain and lore, and undo checks concurrent landmark changes',()=>{
 const f=fixture();f.send('planetHex',{hex:'10',terrain:'desert',description:'Market',gmNotes:'Secret'});f.send('planetPaint',{edits:[{hex:'10',city:true,expectedCity:false}]});const h=f.c.starmaps.maps[0].stars[0].surfaces[f.p.planetId].hexes['10'];assert.equal(h.terrain,'desert');assert.equal(h.description,'Market');assert.equal(h.city,true);assert.throws(()=>f.send('planetPaint',{edits:[{hex:'10',city:false,expectedCity:false}]}),/changed/);f.send('planetPaint',{edits:[{hex:'10',city:false,expectedCity:true}]});assert.equal(h.gmNotes,'Secret');
});

test('hover burn strengthens with thrust, crossfades without blank frames and respects reduced motion',()=>{
 const low=motion.hover(.25,0),high=motion.hover(2.25,0);
 assert.ok(high.opacity>low.opacity);assert.ok(high.scale>low.scale);assert.equal(motion.hover(0,0).opacity,0);
 for(let t=0;t<2;t+=.025)for(let corner=0;corner<4;corner++){const p=motion.hover(2.25,t,corner);assert.ok(p.mix>=0&&p.mix<=1);assert.ok(p.opacity>0&&p.opacity<=1);assert.ok(p.scale>0);}
 assert.notEqual(motion.hover(1,0,0).mix,motion.hover(1,0,1).mix);
 assert.deepEqual(motion.hover(1,0,0,true),motion.hover(1,10,3,true));
});

const maps=require('../ship-map-core');

function runway(ship){
 const hover=ship.ship.sicInventory.find(i=>maps.definition(i.type).landing==='hover');hover.disabled=true;
 // Test-only propulsion meets the existing Aerofoil minimum Move 5.
 ship.ship.sicInventory.push({id:'runway-thruster',type:'exhaust-thruster-2',status:'installed'});
 ship.ship.placements.push({sicId:'runway-thruster',cell:ship.ship.gridCells[0]-maps.gridColumns(ship.ship)});
 ship.ship.sicInventory.push({id:'test-aerofoil',type:'decent-aerofoil',status:'installed'},{id:'test-wheels',type:'land-wheels',status:'installed'});
 ship.ship.placements.push({sicId:'test-aerofoil',cell:ship.ship.gridCells[0]},{sicId:'test-wheels',mountCells:Array.from({length:maps.gridColumns(ship.ship)*maps.gridRows(ship.ship)},(_,n)=>n).filter(n=>maps.exteriorPlacement(ship.ship,'land-wheels',n,'test-wheels')).slice(0,4)});
 return hover;
}

function landingFixture(){
 const f=fixture();runway(f.ship);const s=f.c.starmaps,planet=require('../campaign-planets'),p=s.localPositions.pc;delete s.partyJourney;delete p.surfaceHex;
 s.party={...f.p,shipId:f.ship.id,transport:false,awaitingLanding:true,landingOwnerId:'nova',regionId:''};
 const ctx=planet.context(f.c,s.party);planet.surface(ctx.star,ctx.planet).hexes['100']={landingStrip:true};
 f.send('planetLand',{...s.party,hex:'100'},false);return {...f,world:ctx.star.surfaces[ctx.planet.id]};
}
test('strip removal midlanding keeps ship and selection, explains recovery, and permits retry after reload',()=>{
 const f=landingFixture(),s=f.c.starmaps,j=s.partyJourney,oldHex=s.party.hex;f.world.hexes['100'].landingStrip=false;
 travel.tick(f.c,j.clockAt+5000,true);assert.equal(j.remaining,4);
 const c=JSON.parse(JSON.stringify(f.c));travel.tick(c,j.clockAt+9000,false);assert.equal(c.starmaps.partyJourney,undefined);assert.equal(c.starmaps.party.awaitingLanding,true);assert.equal(c.starmaps.party.hex,oldHex);assert.equal(c.starmaps.party.landingOwnerId,'nova');assert.equal(c.starmaps.localPositions.pc.surfaceHex,undefined);assert.equal(c.starships.length,1);
 assert.ok(c.privateNotes.some(n=>n.characterId==='nova'&&/Landing could not complete.*Landing Strip/.test(n.message)));assert.ok(c.privateNotes.some(n=>n.direction==='to-gm'&&/Landing could not complete/.test(n.message)));
 const count=c.privateNotes.length;travel.tick(c,j.clockAt+10000,false);assert.equal(c.privateNotes.length,count,'no repeated notice');
 const ctx=require('../campaign-planets').context(c,c.starmaps.party);ctx.star.surfaces[ctx.planet.id].hexes['100'].landingStrip=true;
 galaxy.command(c,{kind:'planetLand',...c.starmaps.party,hex:'100',receipt:randomUUID()},{gm:false,characterId:'nova',combatActive:false});const retry=c.starmaps.partyJourney;travel.tick(c,retry.clockAt+4000,false);assert.equal(c.starmaps.localPositions.pc.surfaceHex,'100');assert.equal(c.starmaps.party.awaitingLanding,false);
});
test('landing equipment failure retains retry state; restored Hover permits an unmarked site',()=>{
 const f=landingFixture();f.ship.ship.sicInventory.find(i=>i.id==='test-aerofoil').disabled=true;const j=f.c.starmaps.partyJourney;travel.tick(f.c,j.clockAt+4000,false);assert.equal(f.c.starmaps.party.awaitingLanding,true);assert.ok(f.c.privateNotes.some(n=>/Restore the ship/.test(n.message)));
 f.ship.ship.sicInventory.find(i=>maps.definition(i.type).landing==='hover').disabled=false;
 f.send('planetLand',{...f.c.starmaps.party,hex:'101'},false);const next=f.c.starmaps.partyJourney;travel.tick(f.c,next.clockAt+4000,false);assert.equal(f.c.starmaps.localPositions.pc.surfaceHex,'101');
});


test('regional strip landing persists the exact site, and erased or moved destinations cannot teleport the ship',()=>{
 const f=landingFixture(),s=f.c.starmaps;delete s.partyJourney;delete f.world.hexes['100'].landingStrip;
 f.send('planetRegion',{hex:'100',name:'Runway Region'});f.send('planetPaint',{regionId:'100',edits:[{hex:'82',landingStrip:true}]});
 f.send('planetLand',{...s.party,hex:'100'},false);assert.equal(s.partyJourney.to.regionId,'100');assert.equal(s.partyJourney.to.regionHex,'82');assert.equal(s.partyJourney.total,4);
 const c=JSON.parse(JSON.stringify(f.c)),j=c.starmaps.partyJourney;travel.tick(c,j.clockAt+4000,false);
 assert.equal(c.starmaps.localPositions.pc.regionId,'100');assert.equal(c.starmaps.localPositions.pc.regionHex,'82');assert.equal(c.starmaps.party.regionHex,'82');assert.equal(boarding.atShip(c,c.starships[0]),true);
 const old=s.partyJourney;f.send('planetPaint',{regionId:'100',edits:[{hex:'82',landingStrip:false}]});f.send('planetPaint',{regionId:'100',edits:[{hex:'83',landingStrip:true}]});travel.tick(f.c,old.clockAt+4000,false);assert.equal(s.party.awaitingLanding,true);assert.equal(s.localPositions.pc.surfaceHex,undefined);
});
