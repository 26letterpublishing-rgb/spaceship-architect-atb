'use strict';
const maps=require('./ship-map-core'),terrain=require('./planet-terrain');
function atShip(c,ship,party=c.starmaps?.party){
 const p=c.starmaps?.localPositions?.[ship?.id];
 return !!(party&&!party.transport&&!party.awaitingLanding&&p?.phase==='surface'&&p.mapId===party.mapId&&p.starId===party.starId&&p.planetId===party.planetId&&String(p.surfaceHex)===String(party.hex)&&(p.regionId||'')===(party.regionId||'')&&(!p.regionId||String(p.regionHex)===String(party.regionHex)));
}
function terrainAt(c,ship){
 const p=c.starmaps?.localPositions?.[ship.id];if(p?.phase!=='surface')return null;
 const star=c.starmaps.maps.find(m=>m.id===p.mapId)?.stars.find(s=>s.id===p.starId),planet=star?.system?.find(o=>o.id===p.planetId),world=star?.surfaces?.[p.planetId];if(!planet)return null;
 const region=p.regionId&&world?.regions?.[p.regionId],chart=region||world,key=region?p.regionHex:p.surfaceHex;
 return terrain.terrain(chart?.seed||planet.id,region?region.type:planet.variant,chart?.hexes,!!region,region?.uniform)[Number(key)]||planet.variant;
}
function reconcile(c,party){
 if(!party||party.transport||party.awaitingLanding)return;
 const ids=(c.characters||[]).map(r=>r.id);
 // Ships acquired during a surface-start adventure arrive with the party.
 for(const vessel of c.starships.filter(s=>s.controlType==='pc'))if(!c.starmaps.localPositions?.[vessel.id]){const star=c.starmaps.maps.find(m=>m.id===party.mapId)?.stars.find(s=>s.id===party.starId),planet=star?.system?.find(p=>p.id===party.planetId);if(planet){c.starmaps.localPositions||={};c.starmaps.localPositions[vessel.id]={mapId:party.mapId,starId:party.starId,planetId:party.planetId,q:planet.q,r:planet.r,phase:'surface',surfaceHex:party.hex,regionId:party.regionId||'',regionHex:party.regionHex};}}
 const ship=c.starships.find(s=>s.controlType==='pc'&&atShip(c,s,party));
 const arrivals=[];
 if(ship){
  const layout=maps.buildLayout(ship.ship),airlock=ship.ship.airlocks?.find(a=>layout.hull.has(a.square)),origin=airlock?.square??[...layout.hull][0],columns=maps.gridColumns(ship.ship);
  const distance=s=>Math.abs(s%columns-origin%columns)+Math.abs(Math.floor(s/columns)-Math.floor(origin/columns));
  const squares=[...layout.hull].filter(s=>!layout.footprint.get(s)?.blocked).sort((a,b)=>distance(a)-distance(b)||a-b);
  for(const id of ids){
   const old=ship.characterLocations?.[id];if(old&&old.environment!=='surface'&&old.square!=null)continue;
   let destination;
   for(const square of squares){const cell=layout.footprint.get(square);for(const mesh of [4,3,5,1,7,0,2,6,8]){
    if(cell?.stations.some(s=>s.x===cell.column&&s.y===cell.row&&s.mesh===mesh))continue;
    const busy=Object.entries(ship.characterLocations||{}).filter(([other,l])=>other!==id&&l.environment!=='surface'&&l.square===square&&l.mesh===mesh).length+(c.npcRoster||[]).filter(n=>n.location?.starshipId===ship.id&&n.location.square===square&&n.location.mesh===mesh).length+arrivals.filter(a=>a.location.square===square&&a.location.mesh===mesh).length;
    if(busy<2){destination={environment:'starship',starshipId:ship.id,square,mesh,stationed:false,stationSlot:null};break;}
   }if(destination)break;}
   if(!destination)throw Error('There is not enough free interior space for the party to board. Free space near the airlock first.');
   arrivals.push({id,location:destination});
  }
 }
 for(const s of c.starships){s.characterLocations||={};for(const id of ids){
  if(s===ship)continue;
  if(s.crewCharacterIds?.includes(id)||s.characterLocations[id]){s.characterLocations[id]={environment:'surface',planetId:party.planetId,starshipId:'',square:null,mesh:4,stationed:false};delete (s.characterWalks||{})[id];}
 }}
 if(ship){for(const a of arrivals){ship.characterLocations[a.id]=a.location;delete (ship.characterWalks||{})[a.id];}ship.crewCharacterIds=[...new Set([...(ship.crewCharacterIds||[]),...ids])];party.shipId=ship.id;}
}
function startExplore(c){
 const map=c.starmaps.maps[0],star=map.stars[0],planet=star.system.find(p=>p.kind==='planet'),world=star.surfaces[planet.id],ship=c.starships.find(s=>s.controlType==='pc');if(!ship)return;
 const hex=String(Object.keys(world.regions)[0]),row=Math.floor(Number(hex)/30),column=Number(hex)%30,shipHex=String(row*30+(column<=24?column+5:column-5));
 world.hexes[shipHex]={terrain:'temperate',label:'Starship Landing Field',description:'Your working starship is parked here. Return together to board at its airlock.'};
 c.starmaps.localPositions||={};c.starmaps.localPositions[ship.id]={mapId:map.id,starId:star.id,planetId:planet.id,q:planet.q,r:planet.r,phase:'surface',surfaceHex:shipHex};
 require('./campaign-planets').place(c,{mapId:map.id,starId:star.id,planetId:planet.id,hex,regionId:'',regionHex:'82',shipId:ship.id,transport:false});
}
module.exports={atShip,terrainAt,reconcile,startExplore};
