'use strict';
const terrain=require('./planet-terrain');
const valid=value=>/^\d+$/.test(String(value))&&Number(value)<5760;
// Resize once, retaining the original authored data for saved-file recovery.
// Locations win over plain paint when the old extra columns need a free cell.
function resize(world,variant='temperate',references=[]){
 if(world.gridVersion===2)return {world,mapping:{}};
 const original=structuredClone(world),mapping={},used=new Set(),all=terrain.cells(),hexes=world.hexes||{},regions=world.regions||{};
 const important=new Set([...references,...Object.keys(regions),...Object.keys(hexes).filter(k=>Object.keys(hexes[k]||{}).some(f=>f!=='terrain'))].filter(valid).map(String));
 const keys=[...important,...Object.keys(hexes).filter(k=>!important.has(k)&&valid(k))];
 const preferred=k=>{const {column,row}=terrain.legacyCell(k);return terrain.hexAt(Math.min(119,column),row);};
 // Reserve unchanged positions before placing cells from the removed band.
 for(const k of keys){const p=terrain.legacyCell(k),to=preferred(k);if(p.column<120&&!used.has(to)){mapping[k]=to;used.add(to);}}
 for(const k of keys)if(mapping[k]===undefined){
  const p=terrain.legacyCell(k);let best=null,distance=Infinity;
  for(const cell of all)if(!used.has(cell.key)){const d=Math.abs(cell.column-Math.min(119,p.column))+Math.abs(cell.row-p.row)*2;if(d<distance){best=cell.key;distance=d;}}
  if(best!==null){mapping[k]=best;used.add(best);}
 }
 const oldTerrain=terrain.legacyGenerate(world.seed,variant),nextTerrain=terrain.generate(world.seed,variant);
 const moved={...world,size:'large',gridVersion:2,hexes:{},regions:{},legacyGrid:{version:1,world:original,mapping}};
 for(const [old,to]of Object.entries(mapping)){
  if(hexes[old])moved.hexes[to]=structuredClone(hexes[old]);
  // Keep terrain under authored locations and travelers unchanged as well.
  if(important.has(old)&&!moved.hexes[to]?.terrain&&oldTerrain[old]!==nextTerrain[to])moved.hexes[to]={...moved.hexes[to],terrain:oldTerrain[old]};
  if(regions[old])moved.regions[to]=regions[old];
 }
 return {world:moved,mapping};
}
function ensure(c){
 const s=c.starmaps;if(!s)return;
 for(const map of s.maps||[])for(const star of map.stars||[])for(const planet of (star.system||[]).filter(p=>p.kind==='planet')){
  const world=star.surfaces?.[planet.id];if(world?.gridVersion===2){planet.size=world.size||planet.size||'large';continue;}
  if(!world){planet.size||='large';continue;}
  const matches=p=>p&&p.planetId===planet.id&&(!p.mapId||p.mapId===map.id)&&(!p.starId||p.starId===star.id);
  const locations=[s.party,s.startingSurface,s.navigation,s.surfaceReturnPolicy,...Object.values(s.localPositions||{}),...Object.values(s.characterWorldLocations||{}),s.partyJourney?.from,s.partyJourney?.to,...(s.travelRequests||[]).flatMap(r=>[r.from,r.to])].filter(matches);
  const visit=s.shopArrival?.visit?.split('/');if(visit&&visit[0]===map.id&&visit[1]===star.id&&visit[2]===planet.id)locations.push({planetId:planet.id,hex:visit[3],regionId:visit[4],_visit:true});
  const refs=locations.flatMap(p=>[p.hex,p.surfaceHex,p.regionId]).filter(valid),result=resize(world,planet.variant,refs);
  result.world.legacyGrid.locations=structuredClone(locations);star.surfaces[planet.id]=result.world;planet.size='large';
  for(const p of locations)for(const field of ['hex','surfaceHex','regionId'])if(result.mapping[p[field]]!==undefined)p[field]=result.mapping[p[field]];
  const arrival=locations.find(p=>p._visit);if(arrival){visit[3]=arrival.hex;visit[4]=arrival.regionId;s.shopArrival.visit=visit.join('/');}
  const j=s.partyJourney;if(matches(j?.to))j.route=terrain.route(j.to.regionId?j.from.regionHex:j.from.hex,j.to.regionId?j.to.regionHex:j.to.hex,!!j.to.regionId,'large');
 }
}
// Backups retain recovery data; live views neither serialize nor expose it.
function liveState(s){return {...s,maps:s.maps.map(map=>({...map,stars:map.stars.map(star=>({...star,...(star.surfaces?{surfaces:Object.fromEntries(Object.entries(star.surfaces).map(([id,world])=>{const {legacyGrid,resizeBackup,...live}=world;return [id,live];}))}:{})}))}))};}
const resizeWarning='Some Cities and Regions may be lost when reducing the size of planets';
// Keep a contiguous crop when possible. Otherwise remove only unused rows/columns,
// preserving the order of all occupied coordinates before considering relocation.
function retainedAxis(length,next,occupied){
 const values=[...new Set(occupied)].sort((a,b)=>a-b);
 if(next>=length)return Array.from({length},(_,i)=>i);
 const lo=values[0]??0,hi=values.at(-1)??0;
 if(hi-lo<next){const start=Math.max(0,Math.min(lo,Math.floor((lo+hi-next+1)/2),length-next));return Array.from({length:next},(_,i)=>start+i);}
 const kept=new Set(values.slice(0,next));
 for(let i=0;kept.size<next&&i<length;i++)kept.add(i);
 return [...kept].sort((a,b)=>a-b);
}
function planResize(world,size,variant='temperate',references=[]){
 if(!terrain.sizes[size])throw Error('Choose a planet size.');
 const oldSize=world.size||'large',before=terrain.dimensions(false,oldSize),after=terrain.dimensions(false,size);
 const hexes=world.hexes||{},regions=world.regions||{},important=[...new Set([...references,...Object.keys(regions),...Object.keys(hexes).filter(k=>Object.entries(hexes[k]||{}).some(([f,v])=>f!=='terrain'&&v!==''&&v!==false&&v!=null))].map(String).filter(k=>terrain.validHex(k,false,oldSize)))];
 const cells=important.map(k=>terrain.cell(k,false,oldSize)),columns=retainedAxis(before.width,after.width,cells.map(p=>p.column)),rows=retainedAxis(before.height,after.height,cells.map(p=>p.row));
 const mapping={},used=new Set(),coordinates=k=>{const p=terrain.cell(k,false,oldSize);return {column:columns.indexOf(p.column),row:rows.indexOf(p.row)};};
 let atRisk=false;
 const referenceKeys=new Set(references.map(String).filter(k=>terrain.validHex(k,false,oldSize)));
 // Reserve travelers before landmarks, including travelers outside the retained
 // axes. A completely occupied destination must never leave a dangling location.
 for(const group of [important.filter(k=>referenceKeys.has(k)),important.filter(k=>!referenceKeys.has(k))]){
  for(const k of group){const p=coordinates(k),to=p.column>=0&&p.row>=0?terrain.hexAt(p.column,p.row,false,size):null;if(to!==null&&!used.has(to)){mapping[k]=to;used.add(to);}else atRisk=true;}
  for(const k of group)if(mapping[k]===undefined){
   const p=terrain.cell(k,false,oldSize);let best=null,score=Infinity;
   for(const cell of terrain.cells(false,size))if(!used.has(cell.key)){const d=Math.abs(cell.column-Math.min(p.column,after.width-1))+2*Math.abs(cell.row-Math.min(p.row,after.height-1));if(d<score){score=d;best=cell.key;}}
   // Multiple travelers may share a hex if there are more occupied locations
   // than destination cells. The warning and snapshot cover displaced content.
   if(best===null&&referenceKeys.has(k))best=terrain.hexAt(Math.min(p.column,after.width-1),Math.min(p.row,after.height-1),false,size);
   if(best!==null){mapping[k]=best;used.add(best);}else atRisk=true;
  }
 }
 const {resizeBackup,...snapshot}=world,next={...world,size,gridVersion:2,hexes:{},regions:{},resizeBackup:{world:structuredClone(snapshot),mapping}};
 const oldTerrain=terrain.terrain(world.seed,variant,hexes,false,false,oldSize);
 for(const cell of terrain.cells(false,oldSize)){
  const k=cell.key,p=coordinates(k);let to=mapping[k];
  if(to===undefined&&p.column>=0&&p.row>=0){const candidate=terrain.hexAt(p.column,p.row,false,size);if(!used.has(candidate))to=candidate;}
  if(to===undefined)continue;
  mapping[k]=to;next.hexes[to]={...structuredClone(hexes[k]||{}),terrain:oldTerrain[Number(k)]};if(regions[k])next.regions[to]=structuredClone(regions[k]);
 }
 return {world:next,mapping,atRisk};
}
function changeSize(c,map,star,planet,size,confirmed=false){
 const s=c.starmaps,world=star.surfaces[planet.id];if(size===world.size)return;
 const matches=p=>p&&p.planetId===planet.id&&(!p.mapId||p.mapId===map.id)&&(!p.starId||p.starId===star.id);
 const locations=[s.party,s.startingSurface,s.navigation,s.surfaceReturnPolicy,...Object.values(s.localPositions||{}),...Object.values(s.characterWorldLocations||{}),s.partyJourney?.from,s.partyJourney?.to,...(s.travelRequests||[]).flatMap(r=>[r.from,r.to])].filter(matches);
 const visit=s.shopArrival?.visit?.split('/');if(visit&&visit[0]===map.id&&visit[1]===star.id&&visit[2]===planet.id)locations.push({hex:visit[3],regionId:visit[4],_visit:true});
 const result=planResize(world,size,planet.variant,locations.flatMap(p=>[p.hex,p.surfaceHex,p.regionId]));
 if(result.atRisk&&!confirmed)throw Error(resizeWarning);
 result.world.resizeBackup.locations=structuredClone(locations);
 for(const p of locations)for(const f of ['hex','surfaceHex','regionId'])if(result.mapping[p[f]]!==undefined)p[f]=result.mapping[p[f]];
 const arrival=locations.find(p=>p._visit);if(arrival){visit[3]=arrival.hex;visit[4]=arrival.regionId;s.shopArrival.visit=visit.join('/');}
 star.surfaces[planet.id]=result.world;planet.size=size;
 const j=s.partyJourney;if(matches(j?.to))j.route=terrain.route(j.to.regionId?j.from.regionHex:j.from.hex,j.to.regionId?j.to.regionHex:j.to.hex,!!j.to.regionId,size);
}
module.exports={resize,ensure,liveState,planResize,changeSize,resizeWarning};
