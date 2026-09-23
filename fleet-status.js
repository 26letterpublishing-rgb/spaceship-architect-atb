// Only recipient-owned information belongs in the campaign-wide notice stream.
function project(room,session){
 const gm=session?.role==='gm',id=session?.role==='character'?session.characterId:null;
 if(!room||(!gm&&!id))return {lockedShips:[],repairs:[],drones:[],damagedSystems:[]};
 const own=new Set((room.units||[]).filter(u=>u.characterId===id).map(u=>u.location?.starshipId));
 if(id)for(const s of room.starships||[])if(s.crewCharacterIds?.includes(id))own.add(s.id);
 const ships=(room.starships||[]).filter(s=>gm||own.has(s.id));
 return {lockedShips:ships.filter(s=>!room.encounterEndedAt&&room.starships.some(other=>other.id!==s.id&&(other.lockState?.targets||[]).some(l=>l.targetId===s.id))).map(s=>({id:s.id,title:s.title})),
 intrusions:ships.filter(s=>gm||s.crewCharacterIds?.includes(id)||(room.units||[]).some(u=>u.characterId===id&&u.location?.starshipId===s.id&&!require('./ship-surveillance').hostile(room,s,u))).flatMap(s=>s.ship.surveillanceState?.reports||[]),
 activity:(room.log||[]).filter(e=>gm||own.has(e.starshipId)).slice(-12).map(e=>({id:e.id,at:e.timestamp,text:require('./health-display').logText(e.text,gm)})),
 detections:ships.flatMap(s=>(s.sensorState?.reports||[]).filter(r=>r.unknownDetected||(r.detected&&r.nature==='Starship')).map(r=>({id:`${s.id}:${r.at}:${r.targetId}`,at:r.at,text:r.unknownDetected?'Unknown Object Detected!!':`Class ${r.shipClass||'Unknown'} Starship Detected!`}))),
 damagedSystems:ships.flatMap(s=>require('./ship-map-core').installedItems(s).filter(i=>i.impaired||i.impairmentPoints>0||['impaired','destroyed'].includes(i.status)).map(i=>({shipId:s.id,shipTitle:s.title,sicId:i.id,name:require('./ship-map-core').definition(i.type).name,status:i.status==='destroyed'?'destroyed':'impaired'}))),
 repairs:ships.flatMap(s=>s.ship.droneState?.reports||[]),
 drones:ships.map(s=>({id:s.id,state:s.ship.droneState||null}))};
}
module.exports={project};
