'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),migration=require('../planet-grid-migration'),terrain=require('../planet-terrain'),planets=require('../campaign-planets'),galaxy=require('../campaign-starmaps');
test('legacy resize preserves distinct cities, regions, secrets and every linked location exactly once',()=>{
 const world={seed:'old-world',description:'Planet lore',hexes:{'1199':{label:'Old Town',city:true},'5735':{label:'Edge city',gmNotes:'SECRET',attachments:{story:{format:'sa2story',version:1,chapters:[{id:'c',name:'Story',script:'SECRET SCRIPT'}]}}},'5759':{label:'Far Coast',description:'Public port',shop:{id:'shop',name:'Shop'}}},regions:{'5759':{name:'Far region',hexes:{'149':{gmNotes:'REGION SECRET'}}}}};
 const loc={mapId:'map',starId:'star',planetId:'planet',hex:'5759',regionId:'5759',regionHex:'149'},s={maps:[{id:'map',stars:[{id:'star',system:[{id:'planet',kind:'planet',variant:'temperate'}],surfaces:{planet:structuredClone(world)}}]}],party:{...loc},startingSurface:{...loc},navigation:{...loc},surfaceReturnPolicy:{...loc},localPositions:{ship:{...loc,surfaceHex:'5759'}},characterWorldLocations:{pc:{...loc}},travelRequests:[{from:{...loc,hex:'5735',regionId:''},to:{...loc}}],partyJourney:{from:{...loc,hex:'5735',regionId:''},to:{...loc,regionId:''},remaining:7,total:20},shopArrival:{visit:'map/star/planet/5759/5759/149'}};
 const c={starmaps:s};migration.ensure(c);const migrated=s.maps[0].stars[0].surfaces.planet,m=migrated.legacyGrid.mapping;
 assert.equal(migrated.gridVersion,2);assert.equal(migrated.size,'large');assert.equal(s.maps[0].stars[0].system[0].size,'large');
 assert.equal(m['1199'],'1199');assert.notEqual(m['5735'],m['5759']);assert.ok(terrain.validHex(m['5759']));
 assert.equal(migrated.hexes[m['5759']].description,'Public port');assert.equal(migrated.hexes[m['5735']].gmNotes,'SECRET');assert.deepEqual(migrated.regions[m['5759']],world.regions['5759']);
 for(const p of [s.party,s.startingSurface,s.navigation,s.surfaceReturnPolicy,s.localPositions.ship,s.characterWorldLocations.pc,s.travelRequests[0].to,s.partyJourney.to])assert.equal(p.hex,m['5759']);
 assert.equal(s.localPositions.ship.surfaceHex,m['5759']);assert.equal(s.party.regionId,m['5759']);assert.equal(s.party.regionHex,'149');assert.equal(s.travelRequests[0].from.hex,m['5735']);
 assert.equal(s.shopArrival.visit,['map','star','planet',m['5759'],m['5759'],'149'].join('/'));assert.equal(s.partyJourney.remaining,7);
 assert.deepEqual(migrated.legacyGrid.world,world);assert.deepEqual(s.partyJourney.route,terrain.route(m['5735'],m['5759']));
 const snapshot=JSON.stringify(c);migration.ensure(c);assert.equal(JSON.stringify(c),snapshot);
 const live=migration.liveState(s);assert.equal(live.maps[0].stars[0].surfaces.planet.legacyGrid,undefined);assert.ok(migrated.legacyGrid);
 const pc=planets.project(structuredClone(live),false);assert.ok(!JSON.stringify(pc).includes('SECRET'));assert.ok(!JSON.stringify(pc).includes('Shop'));
 const reloaded=JSON.parse(snapshot);migration.ensure(reloaded);assert.equal(JSON.stringify(reloaded),snapshot);
 const imported=planets.normalizeWorld(world,'old-world');assert.equal(imported.size,'large');assert.equal(Object.values(imported.hexes).filter(h=>h.label==='Far Coast').length,1);
});
test('new planets use each size, force initial Moon art only once, and validate all surface commands against size',()=>{
 for(const [size,count]of [['large',4800],['small',1200],['moon',300]]){
  const c={starships:[],characters:[],starmaps:{maps:[{id:'m',stars:[{id:'s',name:'Sun',q:0,r:0}]}],positions:{},journeys:{},receipts:[]}},b={mapId:'m',starId:'s'},auth={gm:true};
  galaxy.command(c,{...b,kind:'system',receipt:require('node:crypto').randomUUID(),objects:[{id:'object-planet',kind:'planet',name:'New planet',q:3,r:0,quantity:1,variant:'temperate',size}]},auth);
  const star=c.starmaps.maps[0].stars[0],planet=star.system.find(p=>p.kind==='planet'),world=planets.surface(star,planet),args={...b,planetId:planet.id};
  assert.equal(planet.size,size);assert.equal(planet.variant,size==='moon'?'moon':'temperate');assert.equal(world.gridVersion,2);assert.equal(terrain.terrain(world.seed,planet.variant,{},false,false,size).length,count);
  if(size==='moon')assert.ok(terrain.generate(world.seed,planet.variant,false,false,size).every(t=>t==='moon'));
  planets.command(c,{...args,kind:'planetHex',hex:String(count-1),label:'Last cell'},auth);
  assert.throws(()=>planets.command(c,{...args,kind:'planetHex',hex:String(count)},auth),/inside/);
  assert.throws(()=>planets.command(c,{...args,kind:'planetRegion',hex:String(count)},auth),/inside/);
  planets.command(c,{...args,kind:'planetType',terrain:'desert'},auth);assert.equal(planet.variant,'desert');assert.equal(planet.size,size);
  galaxy.command(c,{...b,kind:'system',receipt:require('node:crypto').randomUUID(),objects:star.system},auth);assert.equal(star.system.find(p=>p.id===planet.id).variant,'desert');
  const restored=JSON.parse(JSON.stringify(c));migration.ensure(restored);assert.equal(restored.starmaps.maps[0].stars[0].system.find(p=>p.id===planet.id).size,size);
  const loaded=require('../campaign-navigation').normalizeFile({format:'sa2-galaxy',version:1,map:{...c.starmaps.maps[0],lightYearsPerHex:3.26}}),newPlanet=loaded.stars[0].system.find(p=>p.kind==='planet');
  assert.equal(newPlanet.size,size);assert.equal(loaded.stars[0].surfaces[newPlanet.id].hexes[count-1].label,'Last cell');
 }
});
