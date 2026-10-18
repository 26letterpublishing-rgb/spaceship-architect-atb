'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),galaxy=require('../campaign-starmaps'),planets=require('../campaign-planets'),terrain=require('../planet-terrain'),maps=require('../ship-map-core');
function fixture(){const ship=require('../showcase-starters')('pc','pc',['nova','orion']),c={showcase:true,starships:[ship],characters:['nova','orion'].map(id=>({id,character:{identity:{characterName:id},attributes:{},health:{current:30}}})),npcRoster:[],privateNotes:[]};galaxy.seedShowcase(c);const map=c.starmaps.maps[0],star=map.stars[0],planet=star.system.find(p=>p.kind==='planet');seat(ship,'nova','bridge-1');return {c,ship,map,star,planet};}
function seat(ship,id,type){const item=ship.ship.sicInventory.find(i=>type.startsWith('bridge')?maps.definition(i.type).bridge:i.type===type),p=ship.ship.placements.find(p=>p.sicId===item.id),st=maps.componentDefinition(item).stations[0];ship.characterLocations[id]={starshipId:ship.id,sicId:item.id,square:p.cell+st.y*maps.gridColumns(ship.ship)+st.x,mesh:st.mesh,stationed:true};}
function send(f,kind,extra={},gm=true,characterId='nova'){return galaxy.command(f.c,{kind,mapId:f.map.id,starId:f.star.id,planetId:f.planet.id,shipId:f.ship.id,receipt:randomUUID(),...extra},{gm,characterId,combatActive:false});}
test('six tiny seeded terrain types: 1200 planet hexes, 150 region hexes, coherent continents',()=>{
 for(const t of terrain.types){const a=terrain.generate('repeatable',t);assert.equal(a.length,1200);assert.deepEqual(a,terrain.generate('repeatable',t));assert.equal(terrain.generate('repeatable',t,true).length,150);if(t!=='temperate')assert.ok(a.every(x=>x===t));}
 const a=terrain.generate('earth','temperate');assert.equal(a.filter(x=>x==='ocean').length,840);
 // Independent random water scatters would have many isolated land cells.
 const lone=a.filter((x,i)=>x==='temperate'&&[i-1,i+1,i-30,i+30].every(n=>a[n]!=='temperate')).length;assert.ok(lone<3);
 assert.notDeepEqual(a,terrain.generate('another earth','temperate'));
});
test('authoring preserves content when changing terrain or planet appearance; PC payload excludes secrets and shops',()=>{
 const f=fixture();send(f,'planetHex',{hex:'310',label:'Bruggle City',description:'Public plaza',gmNotes:'SECRET INFORMANT',city:true,shopFile:{format:'sa2shop',version:1,shop:{id:'secret-shop',name:'Secret Stock'}}});
 send(f,'planetHex',{hex:'310',terrain:'desert'});send(f,'planetType',{terrain:'ice'});send(f,'planetRegion',{hex:'310',name:'City Region'});send(f,'planetHex',{regionId:'310',hex:'82',gmNotes:'SECRET REGIONAL',description:'Town square'});
 const h=f.star.surfaces[f.planet.id].hexes['310'];assert.equal(h.gmNotes,'SECRET INFORMANT');assert.equal(h.terrain,'desert');assert.equal(h.city,true);
 const publicView=galaxy.view(f.c,false);assert.ok(!JSON.stringify(publicView).includes('SECRET'));assert.ok(!JSON.stringify(publicView).includes('Secret Stock'));assert.deepEqual(publicView.maps[0].stars[0].surfaces[f.planet.id].regions['310'],{name:'City Region'});
 assert.throws(()=>send(f,'planetHex',{hex:'0',gmNotes:'evil'},false),/Only the GM/);assert.throws(()=>send(f,'planetHex',{hex:'1200'}),/inside/);
});
test('shipless region start restricts players; GM can relocate out of the region; campaign/module preserves authored start',()=>{
 const f=fixture();send(f,'planetRegion',{hex:'310',name:'First chapter'});send(f,'planetStart',{regionId:'310',hex:'82'});f.c.starships=[];
 assert.equal(f.c.starmaps.party.regionId,'310');const v=galaxy.view(f.c,false);assert.equal(v.maps.length,1);assert.equal(v.maps[0].stars.length,1);assert.equal(v.maps[0].stars[0].system.length,1);assert.ok(v.maps[0].stars[0].surfaces[f.planet.id].regions['310'].hexes);
 assert.throws(()=>send(f,'enterSystem',{},false),/Leave the planet/);
 const copy=JSON.parse(JSON.stringify(f.c));assert.deepEqual(copy.starmaps,f.c.starmaps);
 send(f,'planetMoveParty',{hex:'311'});assert.equal(f.c.starmaps.party.regionId,'');
 const module=require('../adventure-module').create(f.c);assert.equal(module.content.starmaps.party.regionId,'310');assert.equal(module.content.starmaps.party.regionHex,'82');assert.equal(f.c.starmaps.party.hex,'311');
});
test('20-second descent keeps its initiator over reload and pause; only initiator/GM picks landing hex',()=>{
 const f=fixture();send(f,'systemPosition',{phase:'orbit'});send(f,'descend',{},false,'orion');let j=f.c.starmaps.localJourneys.pc;assert.equal(j.total,20);assert.equal(j.ownerId,'orion');
 const now=j.clockAt;galaxy.tick(f.c,now+10000,false);galaxy.tick(f.c,now+60000,true);assert.equal(j.remaining,10);
 f.c=JSON.parse(JSON.stringify(f.c));galaxy.tick(f.c,now+70000,false);assert.equal(f.c.starmaps.party.awaitingLanding,true);assert.equal(f.c.starmaps.party.landingOwnerId,'orion');
 assert.throws(()=>send(f,'planetLand',{hex:'10'},false,'nova'),/began descent/);send(f,'planetLand',{hex:'10'},false,'orion');assert.equal(f.c.starmaps.partyJourney.kind,'landing');galaxy.tick(f.c,f.c.starmaps.partyJourney.clockAt+4000,false);assert.equal(f.c.starmaps.party.hex,'10');assert.equal(f.c.starmaps.party.awaitingLanding,false);
 assert.throws(()=>send(f,'planetLand',{hex:'11'},false,'orion'),/no landing/);
});
test('working newly acquired ship launches from a locked region; broken ship cannot',()=>{
 const f=fixture();send(f,'planetRegion',{hex:'310'});send(f,'planetStart',{regionId:'310',hex:'82'});seat(f.ship,'nova','bridge-1');f.ship.ship.currentHullHp=0;assert.throws(()=>send(f,'leavePlanet',{},false),/power and hull/);assert.ok(f.c.starmaps.party);
 f.ship.ship.currentHullHp=38;send(f,'leavePlanet',{},false);galaxy.advance(f.c,1);assert.equal(f.c.starmaps.party,undefined);assert.equal(f.c.starmaps.navigation.mode,'orbit');assert.equal(f.c.starmaps.navigation.allowed.galaxy,true);
});
test('arrival shops prompt once per visit, remain private, and only activate on GM confirmation',()=>{
 const f=fixture();send(f,'planetHex',{hex:'310',shopFile:{format:'sa2shop',version:1,shop:{id:'shop-1',name:'Landing Market'}}});send(f,'planetMoveParty',{hex:'310'});const arrival=f.c.starmaps.shopArrival;assert.equal(f.c.shops,undefined);send(f,'planetMoveParty',{hex:'310'});assert.equal(f.c.starmaps.shopArrival.id,arrival.id);assert.equal(galaxy.view(f.c,false).shopArrival,undefined);
 send(f,'planetShop',{arrivalId:arrival.id,open:false});assert.equal(f.c.starmaps.shopArrival,undefined);send(f,'planetMoveParty',{hex:'311'});send(f,'planetMoveParty',{hex:'310'});assert.notEqual(f.c.starmaps.shopArrival.id,arrival.id);
 send(f,'planetShop',{arrivalId:f.c.starmaps.shopArrival.id,open:true});assert.equal(f.c.shops.list.find(s=>s.id==='shop-1').active,true);
 const file=require('../adventure-module').create(f.c);assert.equal(file.content.shops.list.find(s=>s.id==='shop-1').active,false);assert.equal(f.c.shops.list.find(s=>s.id==='shop-1').active,true);
});
test('Explore has exactly three stars and six completed planet types, each with an authored region',()=>{
 const f=fixture();assert.equal(f.map.stars.length,3);const all=f.map.stars.flatMap(s=>s.system.filter(p=>p.kind==='planet').map(p=>({p,w:s.surfaces[p.id]})));assert.deepEqual(new Set(all.map(x=>x.p.variant)),new Set(terrain.types));assert.ok(all.every(x=>Object.keys(x.w.regions).length>=1));assert.ok(Buffer.byteLength(JSON.stringify(f.c.starmaps))<20000);
});
test('transporter return reuses safety and occupancy checks; needs a living operator aboard',()=>{
 const f=fixture(),ship=require('../showcase-everything')('pc',['nova','orion']);f.ship=ship;f.c.starships=[ship];seat(ship,'nova','transporter');seat(ship,'orion','bridge-4');const t=ship.ship.sicInventory.find(i=>i.type==='transporter');
 send(f,'systemPosition',{phase:'orbit'});ship.ship.currentShieldHp=0;send(f,'beamDown',{sicId:t.id,passengerIds:['nova'],diceResults:[]},false);galaxy.advance(f.c,.2);assert.equal(f.c.starmaps.party.transport,true);
 const saved=structuredClone(ship.characterLocations.orion);ship.characterLocations.orion={environment:'surface',planetId:f.planet.id,starshipId:''};assert.throws(()=>send(f,'beamAboard',{sicId:t.id,diceResults:[]},false),/remain aboard/);ship.characterLocations.orion={...saved,stationed:false};
 send(f,'beamAboard',{sicId:t.id,diceResults:[]},false);assert.equal(f.c.starmaps.localJourneys.pc.kind,'recall');galaxy.advance(f.c,.2);assert.equal(ship.characterLocations.nova.starshipId,'pc');assert.equal(f.c.starmaps.party,undefined);
});
test('portable Galaxy Maps remap planet identities while keeping terrain, regions and shops',()=>{
 const f=fixture(),file={format:'sa2-galaxy',version:1,map:f.map};send(f,'loadGalaxy',{data:file});const imported=f.c.starmaps.maps[1],p=imported.stars[0].system.find(o=>o.kind==='planet');assert.notEqual(p.id,f.planet.id);
 assert.equal(imported.stars[0].surfaces[p.id].seed,f.star.surfaces[f.planet.id].seed);assert.deepEqual(Object.keys(imported.stars[0].surfaces[p.id].regions),Object.keys(f.star.surfaces[f.planet.id].regions));
 assert.throws(()=>send(f,'planetRegenerate',{regionId:'__proto__'}),/valid region/);assert.equal(Object.prototype.seed,undefined);
});
test('campaign file resumes current location; adventure file restores authored regional start through the real API',async()=>{
 const f=fixture(),{CampaignApi}=require('../campaign-api'),records=new Map(),api=new CampaignApi({store:{get:async k=>structuredClone(records.get(k)||null),create:async c=>{records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]}});
 const call=async(path,body={},method='POST',status=200)=>{let result;await api.handle({method},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,s,v)=>{assert.equal(s,status,JSON.stringify(v));result=v;});return result;};
 const r=await call('v03/create',{name:'Planet adventure'},'POST',201),c=await api.campaign(r.campaign.code);c.starmaps=f.c.starmaps;
 const region=Object.keys(f.star.surfaces[f.planet.id].regions)[0];planets.command(c,{kind:'planetStart',mapId:f.map.id,starId:f.star.id,planetId:f.planet.id,regionId:region,hex:'82'},{gm:true});planets.command(c,{kind:'planetMoveParty',mapId:f.map.id,starId:f.star.id,planetId:f.planet.id,hex:'311'},{gm:true});await api.save(c);
 const backup=await call('backup?code='+c.code+'&token='+r.token,{},'GET');const restored=await call('v03/load',{backup,choice:'replace'});assert.equal(restored.campaign.starmaps.party.hex,'311');assert.equal(restored.campaign.starmaps.party.regionId,'');
 const module=await call('v03/module/export',{code:c.code,token:restored.token}),loaded=await call('v03/load',{backup:module},'POST',201);assert.equal(loaded.campaign.starmaps.party.regionId,region);assert.equal(loaded.campaign.starmaps.party.regionHex,'82');assert.ok(loaded.campaign.starmaps.maps[0].stars[0].surfaces[f.planet.id].regions[region].hexes['82'].shop);
 const joined=await call('v03/join',{code:loaded.campaign.code,name:'New visitor'});assert.equal(joined.campaign.starmaps.navigation.mode,'surface');assert.ok(!JSON.stringify(joined.campaign.starmaps).includes('former survey pilot'));
});

test('paint is atomic, permission checked, undo preserves authored content and detects later edits',()=>{
 const f=fixture();send(f,'planetHex',{hex:'1199',terrain:'ice',label:'South City',description:'Public',gmNotes:'Secret',city:true});
 const before=structuredClone(f.star.surfaces[f.planet.id].hexes['1199']);
 assert.throws(()=>send(f,'planetPaint',{edits:[{hex:'1199',terrain:'desert'}]},false),/Only the GM/);
 assert.throws(()=>send(f,'planetPaint',{edits:[{hex:'1199',terrain:'desert'},{hex:'1200',terrain:'ice'}]}),/inside/);
 assert.deepEqual(f.star.surfaces[f.planet.id].hexes['1199'],before);
 send(f,'planetPaint',{edits:[{hex:'1199',terrain:'desert',expected:'ice'}]});assert.deepEqual(f.star.surfaces[f.planet.id].hexes['1199'],{...before,terrain:'desert'});
 send(f,'planetPaint',{edits:[{hex:'1199',terrain:'ice',expected:'desert'}]});assert.deepEqual(f.star.surfaces[f.planet.id].hexes['1199'],before);
 assert.throws(()=>send(f,'planetPaint',{edits:[{hex:'1199',terrain:'moon',expected:'desert'}]}),/changed since/);
 const normalized=planets.normalizeWorld(f.star.surfaces[f.planet.id],f.planet.id);assert.equal(normalized.hexes['1199'].label,'South City');
});
test('new regions uniformly inherit the parent terrain override and retain that rule after saving',()=>{
 const f=fixture();send(f,'planetHex',{hex:'1198',terrain:'temperate'});send(f,'planetRegion',{hex:'1198',name:'Green valley'});
 const w=planets.normalizeWorld(f.star.surfaces[f.planet.id],f.planet.id),r=w.regions['1198'];assert.equal(r.uniform,true);assert.equal(r.type,'temperate');
 assert.ok(terrain.terrain(r.seed,r.type,r.hexes,true,r.uniform).every(t=>t==='temperate'));
 assert.equal(terrain.wrapColumn(-1),29);assert.equal(terrain.wrapColumn(30),0);assert.equal(terrain.wrapColumn(61),1);
});
