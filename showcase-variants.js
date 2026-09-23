// Additional saved Explore designs; the two original ships remain unchanged.
const maps=require('./ship-map-core'),make=require('./showcase-ships'),power=require('./ship-power');
module.exports=function variants(){
 const result=[];
 for(const side of ['pc','gm'])for(const [key,label,types]of [
  ['ai','Ship AI, Repair Drone 5',['ship-ai']],
  ['crew','VR Training, Medbay, Library, Cameras',['vr-training-room','medbay','library','surv-camera']],
  ['warp','Warp Drive 2, Fuel',['warp-drive-2']],
  ['sensors','Sensors, Antenna 4, Cameras',['antenna-4','surv-camera']],
  ['probes','Probe Launcher, Probes 1-5, Probe Attachments, Hacking',['probe-launcher','hacking-module-1']]
 ]){
  const names={ai:['Clockwork Guardian','Iron Warden'],crew:['Hearthlight','Sanctuary'],warp:['Farstrider','Starbound Courier'],sensors:['Farwatch','Silent Listener'],probes:['Pathseeker','Ghost Surveyor']};
  const id=`showcase-${side}-${key}`,ship=make(id,`${names[key][side==='pc'?0:1]} — ${label}`,side,[],146,[]);
  if(key==='ai')ship.ship.sicInventory.find(i=>i.type==='repair-drone-1').type='repair-drone-5';
  if(key==='crew'||key==='sensors'||key==='probes'){
   const removed=new Set(ship.ship.sicInventory.filter(i=>maps.definition(i.type).weapon||i.type.startsWith('darkveil')).map(i=>i.id));
   ship.ship.sicInventory=ship.ship.sicInventory.filter(i=>!removed.has(i.id));ship.ship.placements=ship.ship.placements.filter(p=>!removed.has(p.sicId));ship.ship.missileAmmo={};
  }
  if(key==='crew')ship.ship.gridCells.push(...maps.rectangleCells(ship.ship,142,4,10));
  for(const type of types){
   const def=maps.definition(type),item={id:id+'-'+type,type,status:'installed',stationLayout:'corners-v1'},layout=maps.buildLayout(ship.ship);let cell;
   if(def.bridgeAddon)cell=ship.ship.placements.find(p=>maps.definition(ship.ship.sicInventory.find(i=>i.id===p.sicId)?.type).bridge).cell;
   else if(def.exterior){for(let n=0;n<400;n++)if(maps.exteriorPlacement(ship.ship,type,n,item.id)){cell=n;break;}}
   else cell=ship.ship.gridCells.find(n=>{const cells=maps.rectangleCells(ship.ship,n,def.width,def.height);return cells.length===def.width*def.height&&cells.every(c=>ship.ship.gridCells.includes(c)&&!layout.footprint.get(c)?.sicId)&&(!def.edge||maps.componentAtEdge(ship.ship,n,item));});
   if(cell==null)throw Error('No legal place for '+type+' in '+id);
   ship.ship.sicInventory.push(item);ship.ship.placements.push({sicId:item.id,cell});
  }
  if(key==='probes'){const launcher=ship.ship.sicInventory.find(i=>maps.definition(i.type).probeLauncher),cell=ship.ship.placements.find(p=>p.sicId===launcher.id).cell;for(let tier=1;tier<=5;tier++){const item={id:id+'-probe-'+tier,type:'probe-'+tier,attachTo:launcher.id,status:'installed',storage:tier===2};ship.ship.sicInventory.push(item);if(!item.storage)ship.ship.placements.push({sicId:item.id,cell});}for(const type of ['shield-breacher','hacking-bug','warp-bubble-inhibitor']){const item={id:id+'-'+type,type,attachTo:id+'-probe-5',status:'installed'};ship.ship.sicInventory.push(item);ship.ship.placements.push({sicId:item.id,cell});}}
  ship.ship.warpFuel=key==='warp'?{F:6,D:3}:{};ship.ship.groupCredits=25000;
  const error=maps.exteriorError(ship.ship)||power.constructionError(ship);if(error)throw Error(ship.title+': '+error);
  result.push(ship);
 }
 result.push(require('./showcase-cleanser')());
 return result;
};
