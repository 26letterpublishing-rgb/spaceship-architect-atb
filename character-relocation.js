'use strict';
const maps=require('./ship-map-core');
function destinations(c){
 const list=(c.starships||[]).map(s=>({id:'ship/'+s.id,name:s.title,shipId:s.id}));
 list.push({id:'exterior',name:'Exterior',environment:'exterior'});
 for(const map of c.starmaps?.maps||[])for(const star of map.stars||[])for(const planet of (star.system||[]).filter(p=>p.kind==='planet'&&!p.destroyedAt)){
  const base={mapId:map.id,starId:star.id,planetId:planet.id,hex:'615',regionId:'',regionHex:'82'},prefix=[map.id,star.id,planet.id].join('/'),world=star.surfaces?.[planet.id];
  list.push({id:prefix,name:planet.name,...base});
  for(const [hex,h]of Object.entries(world?.hexes||{}))if(h.label)list.push({id:prefix+'/'+hex,name:planet.name+' / '+h.label,...base,hex});
  for(const [hex,region]of Object.entries(world?.regions||{})){
   const sub={...base,hex,regionId:hex};list.push({id:prefix+'/'+hex+'/region',name:planet.name+' / '+region.name,...sub});
   for(const [regionHex,h]of Object.entries(region.hexes||{}))if(h.label)list.push({id:prefix+'/'+hex+'/region/'+regionHex,name:region.name+' / '+h.label,...sub,regionHex});
  }
 }
 return list;
}
function relocate(c,id,destinationId){
 const pc=c.characters.find(p=>p.id===id),npc=c.npcRoster?.find(n=>n.id===id),to=destinations(c).find(d=>d.id===destinationId);
 if(!pc&&!npc||!to)throw Error('Choose a character and a named location.');
 let location;
 const ship=c.starships.find(s=>s.id===to.shipId);
 if(ship){
  const layout=maps.buildLayout(ship.ship),origin=ship.ship.airlocks?.find(a=>layout.hull.has(a.square))?.square??[...layout.hull][0],cols=layout.columns;
  const distance=s=>Math.abs(s%cols-origin%cols)+Math.abs(Math.floor(s/cols)-Math.floor(origin/cols));
  for(const square of [...layout.hull].sort((a,b)=>distance(a)-distance(b))){for(const mesh of [4,3,5,1,7,0,2,6,8]){
   const cell=layout.footprint.get(square);if(cell?.blocked||cell?.stations.some(s=>s.x===cell.column&&s.y===cell.row&&s.mesh===mesh))continue;
   const count=[...Object.entries(ship.characterLocations||{}).filter(([key])=>key!==id).map(([,l])=>l),...(c.npcRoster||[]).filter(n=>n.id!==id).map(n=>n.location)].filter(l=>l&&(!l.starshipId||l.starshipId===ship.id)&&l.square===square&&l.mesh===mesh).length;
   if(count<2){location={environment:'starship',starshipId:ship.id,square,mesh,stationed:false};break;}
  }if(location)break;}
  if(!location)throw Error('Free an interior location near the airlock first.');
 }else location={...to,environment:to.planetId?'surface':'exterior',starshipId:'',square:null,mesh:4,stationed:false};
 c.starmaps||={};c.starmaps.characterWorldLocations||={};
 // A GM relocation detaches only this actor from the shared surface party.
 c.starmaps.characterWorldLocations[id]={...location};
 for(const vessel of c.starships){delete (vessel.characterWalks||{})[id];if(vessel.characterLocations?.[id])vessel.characterLocations[id]=vessel===ship?{...location}:{...location,environment:location.environment==='starship'?'exterior':location.environment,starshipId:'',square:null};}
 if(pc&&ship){ship.crewCharacterIds=[...new Set([...(ship.crewCharacterIds||[]),id])];ship.characterLocations||={};ship.characterLocations[id]=location;}
 if(npc){npc.location=location;if(ship)ship.crewNpcUnitIds=[...new Set([...(ship.crewNpcUnitIds||[]),id])];}
 return location;
}
module.exports={destinations,relocate};
