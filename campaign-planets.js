'use strict';
const terrain=require('./planet-terrain'),maps=require('./ship-map-core'),{randomUUID}=require('node:crypto');
const commands=new Set(['planetType','planetPaint','planetHex','planetRegion','planetStart','planetMoveParty','planetLand','planetShop','planetRegenerate']);
const text=(v,max=5000)=>String(v||'').trim().slice(0,max);
const state=c=>require('./campaign-navigation').state(c);
function context(c,b){const s=state(c),map=s.maps.find(m=>m.id===b.mapId),star=map?.stars.find(x=>x.id===b.starId),planet=star?.system?.find(p=>p.id===b.planetId&&p.kind==='planet'&&!p.destroyedAt);if(!planet)throw Error('Choose an intact planet.');return {s,map,star,planet};}
function surface(star,planet){star.surfaces||={};return star.surfaces[planet.id]||={seed:planet.id,hexes:{},regions:{}};}
function normalizeWorld(raw,seed){
 const clean=(source,region=false)=>({seed:text(source?.seed,120)||seed,hexes:Object.fromEntries(Object.entries(source?.hexes||{}).filter(([key])=>terrain.validHex(key,region)).slice(0,region?150:1200).map(([key,h])=>[String(Number(key)),{...(terrain.types.includes(h?.terrain)?{terrain:h.terrain}:{}),label:text(h?.label,80),description:text(h?.description),gmNotes:text(h?.gmNotes),city:!!h?.city,...(h?.attachments?{attachments:require('./planet-attachments').normalize(h.attachments)}:{}),...(h?.shop?{shop:require('./campaign-shops').normalize({...h.shop,active:false})}:{})}]))});
 const world=clean(raw);world.description=text(raw?.description);world.regions={};
 for(const [key,r]of Object.entries(raw?.regions||{}).filter(([k])=>terrain.validHex(k)).slice(0,1200))world.regions[String(Number(key))]={...clean(r,true),name:text(r?.name,80)||'Region',uniform:r?.uniform===true,type:terrain.types.includes(r?.type)?r.type:'temperate'};
 return world;
}
function target(c,b){const ctx=context(c,b),world=surface(ctx.star,ctx.planet);if(b.regionId&&!terrain.validHex(b.regionId))throw Error('Choose a valid region.');const region=b.regionId&&Object.hasOwn(world.regions,b.regionId)&&world.regions[b.regionId];if(b.regionId&&!region)throw Error('This region no longer exists.');return {...ctx,world,region,chart:region||world};}
function hexKey(value,region){if(!terrain.validHex(value,!!region))throw Error('Choose a hex inside this map.');return String(Number(value));}
function place(c,next,{prompt=true}={}){
 const s=state(c),before=s.party;s.visitedPlanets||=[];const visited=[next.mapId,next.starId,next.planetId].join('/');if(!s.visitedPlanets.includes(visited))s.visitedPlanets.push(visited);
 const ctx=target(c,next),chart=ctx.region||ctx.world,key=next.regionId?next.regionHex:next.hex;
 const visit=[next.mapId,next.starId,next.planetId,next.hex,next.regionId||'',next.regionHex||''].join('/');
 const old=before&&[before.mapId,before.starId,before.planetId,before.hex,before.regionId||'',before.regionHex||''].join('/');
 if(visit!==old||before?.awaitingLanding&&!next.awaitingLanding){delete s.shopArrival;const shop=chart.hexes[key]?.shop;if(prompt&&shop)s.shopArrival={id:randomUUID(),visit,shop:structuredClone(shop),label:chart.hexes[key].label||ctx.planet.name};}
 if(next.shipId&&!next.transport&&s.localPositions[next.shipId]){const p=s.localPositions[next.shipId];if(p.surfaceHex===undefined&&!next.awaitingLanding)Object.assign(p,{surfaceHex:next.hex,regionId:next.regionId||'',regionHex:next.regionHex});}
 require('./planet-boarding').reconcile(c,next);s.party={...next};
 s.navigation={mode:'surface',mapId:next.mapId,starId:next.starId,planetId:next.planetId,regionId:next.regionId||'',allowed:{surface:true,orbit:false,system:false,galaxy:false}};
 ctx.star.hidden=false;ctx.planet.hidden=false;for(const p of ctx.star.planets||[])if(p.name===ctx.planet.name)p.hidden=false;
}
function arrival(c,ship,{ownerId,transport=false,passengers=[]}={}){
 const s=state(c),p=s.localPositions[ship.id];if(!p)return;
 const prior=s.party?.planetId===p.planetId?s.party:null;
 s.surfaceReturnPolicy||=structuredClone(s.navigation);
 place(c,{mapId:p.mapId,starId:p.starId,planetId:p.planetId,hex:prior?.hex||'315',regionId:prior?.regionId||'',regionHex:prior?.regionHex||'82',shipId:ship.id,transport,passengers,landingOwnerId:ownerId||'',awaitingLanding:!transport},{prompt:transport});
}
function depart(c,ship){const s=state(c);delete s.party;delete s.shopArrival;s.navigation={...(s.surfaceReturnPolicy||{}),mode:'orbit',mapId:s.localPositions[ship.id].mapId,starId:s.localPositions[ship.id].starId,planetId:s.localPositions[ship.id].planetId,allowed:{surface:true,orbit:true,system:true,galaxy:true}};delete s.surfaceReturnPolicy;}
function canLaunch(c,ship){if(!ship)return false;require('./campaign-starmaps').travelRoom(c);return ship.currentHullHp>0&&!ship.destroyedAt&&maps.propulsion(ship).moveSpeed>0&&maps.capabilities(ship).some(x=>['hover','aerofoil'].includes(x.key)&&x.available)&&ship.ship.sicInventory.some(i=>maps.definition(i.type).landing&&maps.operational(i)&&!i.impaired&&ship.ship.placements.some(p=>p.sicId===i.id))&&require('./ship-power').output(ship,require('./campaign-starmaps').travelRoom(c).units).en>=require('./ship-power').demand(ship);}
function command(c,b,auth){
 if(!commands.has(b.kind))return false;
 const {gm,characterId,combatActive}=auth;
 if(!gm&&b.kind!=='planetLand')throw Error('Only the GM may edit maps or move the party.');
 const {s,star,world,chart,region,planet}=target(c,b);
 if(b.kind==='planetType'){if(b.description!==undefined)surface(star,planet).description=text(b.description);if(!terrain.types.includes(b.terrain))throw Error('Choose a planet type.');if(b.name!==undefined){const old=planet.name;planet.name=text(b.name,80)||'Unnamed Planet';for(const p of star.planets||[])if(p.name===old)p.name=planet.name;}planet.variant=b.terrain;}
 if(b.kind==='planetRegenerate')chart.seed=randomUUID();
 if(b.kind==='planetPaint'){
  if(!Array.isArray(b.edits)||!b.edits.length||b.edits.length>(region?150:1200))throw Error('Choose a valid terrain stroke.');
  const seen=new Set(),edits=b.edits.map(edit=>{const key=hexKey(edit.hex,region);if(seen.has(key))throw Error('A stroke contains duplicate hexes.');seen.add(key);if(edit.city!==undefined){if(typeof edit.city!=='boolean')throw Error('Choose a city brush.');if(edit.expectedCity!==undefined&&!!chart.hexes[key]?.city!==edit.expectedCity)throw Error('This landmark has changed since the stroke.');return {key,city:edit.city};}if(edit.terrain!==''&&!terrain.types.includes(edit.terrain))throw Error('Choose a terrain type.');if(edit.expected!==undefined&&(chart.hexes[key]?.terrain||'')!==edit.expected)throw Error('This terrain has changed since the stroke. Paint it again instead.');return {key,terrain:edit.terrain};});
  for(const edit of edits){const next={...chart.hexes[edit.key]};if(edit.city!==undefined)next.city=edit.city;else if(edit.terrain)next.terrain=edit.terrain;else delete next.terrain;if(Object.keys(next).length)chart.hexes[edit.key]=next;else delete chart.hexes[edit.key];}
 }
 if(b.kind==='planetHex'){
  const key=hexKey(b.hex,region),old=chart.hexes[key]||{},next={...old};
  if(b.terrain!==undefined){if(b.terrain&&!terrain.types.includes(b.terrain))throw Error('Choose a terrain type.');if(b.terrain)next.terrain=b.terrain;else delete next.terrain;}
  for(const prop of ['label','description','gmNotes'])if(b[prop]!==undefined)next[prop]=text(b[prop],prop==='label'?80:5000);
  if(b.city!==undefined)next.city=!!b.city;
  if(b.shopFile){if(b.shopFile.format!=='sa2shop'||b.shopFile.version!==1)throw Error('Choose a Save Shop file.');next.shop=require('./campaign-shops').normalize(b.shopFile.shop);next.shop.active=false;}
  if(b.shopId){const shop=require('./campaign-shops').state(c).list.find(x=>x.id===b.shopId);if(!shop)throw Error('Choose an existing shop.');next.shop=structuredClone(shop);next.shop.active=false;}
  if(b.removeShop)delete next.shop;
  if(b.attachments!==undefined)next.attachments=require('./planet-attachments').normalize(b.attachments);
  chart.hexes[key]=next;
 }
 if(b.kind==='planetRegion'){
  if(region)throw Error('Regions cannot contain further regions.');const key=hexKey(b.hex,false);
  if(!world.regions[key]){if(Object.keys(world.regions).length>=1200)throw Error('This planet already has a region for every hex.');world.regions[key]={name:text(b.name,80)||'New Region',seed:planet.id+'/'+key,type:terrain.terrain(world.seed,planet.variant,world.hexes)[Number(key)],uniform:true,hexes:{}};}
  else if(b.name!==undefined)world.regions[key].name=text(b.name,80)||'Region';
 }
 if(b.kind==='planetStart'||b.kind==='planetMoveParty'){
  if(combatActive)throw Error('End the encounter before relocating the party.');
  const hex=hexKey(region?b.regionId:b.hex,false),regionHex=region?hexKey(b.hex,true):'82';
  delete s.partyJourney;const next={mapId:b.mapId,starId:b.starId,planetId:planet.id,hex,regionId:region?b.regionId:'',regionHex,...(s.party?.planetId===planet.id?{shipId:s.party.shipId,transport:s.party.transport,passengers:s.party.passengers}:{})};
  for(const id of Object.keys(s.localJourneys||{}))if(c.starships.find(x=>x.id===id)?.controlType==='pc')delete s.localJourneys[id];
  if(b.kind==='planetStart'){s.startingSurface=structuredClone(next);delete s.surfaceReturnPolicy;}
  place(c,next);
 }
 if(b.kind==='planetLand'){
  if(combatActive)throw Error('Finish the encounter before selecting a landing site.');
  const p=s.party;if(!p?.awaitingLanding||p.planetId!==planet.id||p.starId!==b.starId||p.mapId!==b.mapId||region)throw Error('There is no landing site to select here.');
  if(!gm&&p.landingOwnerId!==characterId)throw Error('The player who began descent selects the landing hex.');
  const hex=hexKey(b.hex,false);require('./planet-travel').begin(c,{...p,hex,regionId:'',awaitingLanding:false,landingOwnerId:''},{kind:'landing',ownerId:characterId,duration:4});
 }
 if(b.kind==='planetShop'){
  const a=s.shopArrival;if(!a||a.id!==b.arrivalId)throw Error('This arrival prompt has already been handled.');
  if(b.open){const shops=require('./campaign-shops'),shop=structuredClone(a.shop),previous=shops.state(c).list.find(x=>x.id===shop.id),activatedHere=!previous?.active||previous?.planetArrival;shop.active=true;shops.manage(c,{operation:'save',shop});if(activatedHere)shops.state(c).list.find(x=>x.id===shop.id).planetArrival=true;}
  delete s.shopArrival;
 }
 return true;
}
function project(s,gm){
 if(gm)return s;
 delete s.startingSurface;delete s.surfaceReturnPolicy;delete s.shopArrival;
 for(const map of s.maps)for(const star of map.stars){
  const ids=new Set((star.system||[]).filter(p=>p.kind==='planet').map(p=>p.id));
  for(const [id,world]of Object.entries(star.surfaces||{})){
   if(!ids.has(id)){delete star.surfaces[id];continue;}
   const clean=hexes=>Object.fromEntries(Object.entries(hexes||{}).map(([key,h])=>[key,Object.fromEntries(['terrain','label','description','city'].filter(k=>h[k]!==undefined).map(k=>[k,h[k]]))]));
   world.hexes=clean(world.hexes);
   for(const [key,r]of Object.entries(world.regions||{})){
    // Send the active region only; all other regions are small directory entries.
    if(s.party?.planetId===id&&s.party?.regionId===key)r.hexes=clean(r.hexes);
    else world.regions[key]={name:r.name};
   }
  }
 }
 return s;
}
function resetModule(s,ships=[]){
 delete s.party;delete s.partyJourney;delete s.travelRequests;delete s.viewEvent;delete s.visitedPlanets;delete s.shopArrival;delete s.surfaceReturnPolicy;
 if(s.startingSurface){
  s.party=structuredClone(s.startingSurface);s.navigation={mode:'surface',mapId:s.party.mapId,starId:s.party.starId,planetId:s.party.planetId,regionId:s.party.regionId||'',allowed:{surface:true,orbit:false,system:false,galaxy:false}};
  delete s.party.passengers;delete s.party.transport;delete s.party.shipId;
  const star=s.maps.find(m=>m.id===s.party.mapId)?.stars.find(x=>x.id===s.party.starId),planet=star?.system?.find(p=>p.id===s.party.planetId);
  if(planet)for(const ship of ships.filter(x=>x.controlType==='pc')){s.positions[ship.id]={mapId:s.party.mapId,q:star.q,r:star.r};s.localPositions[ship.id]={surfaceHex:s.party.hex,regionId:s.party.regionId||'',regionHex:s.party.regionHex,...(s.localPositions[ship.id]||{}),mapId:s.party.mapId,starId:star.id,planetId:planet.id,q:planet.q,r:planet.r,phase:'surface'};}
 }
}
module.exports={command,context,surface,target,place,arrival,depart,project,resetModule,canLaunch,normalizeWorld};
