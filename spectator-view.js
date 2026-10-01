'use strict';
const sensors=require('./ship-sensors'),maps=require('./ship-map-core'),distances=require('./ship-distances');
function objects(state,observers){return(state.spaceObjects||[]).filter(object=>!object.collectedBy&&observers.some(ship=>{const origin=(state.shipPositions||[]).find(p=>p.id===ship.id);return origin&&distances.hexDistance(origin,object)<=maps.sensorStats(ship).range+1e-8;}));}
function combined(state){
 const observers=state.starships.filter(ship=>ship.controlType==='pc');
 const views=observers.map(ship=>sensors.view(state,ship.id));
 const ships=new Map(),positions=new Map(),units=new Map(),logs=new Map();
 const own=new Set(observers.map(s=>s.id));
 for(const view of views){
  for(const ship of view.starships){const old=ships.get(ship.id),isOwner=ship.id===view.sensorObserverId;if(isOwner||!old||!own.has(ship.id)&&ship.analyzedContact&&!old.analyzedContact)ships.set(ship.id,ship);}
  for(const p of view.shipPositions||[])if(p.id===view.sensorObserverId||!own.has(p.id))positions.set(p.id,p);
  for(const unit of view.units||[])units.set(unit.id,unit);
  for(const entry of view.log||[])logs.set(entry.id,entry);
 }
 return {...state,accessRole:'spectator',sensorObserverId:null,starships:[...ships.values()],shipPositions:[...positions.values()],shipDistances:distances.fromPositions([...ships.values()],[...positions.values()]),units:[...units.values()],log:[...logs.values()],spaceObjects:objects(state,observers),activeId:null,activeAction:null,command:null,delayRequest:null,attackResolution:null,itemResolution:null,vehicles:[],areaEffects:[],crewRoomRolls:[],missileRolls:[]};
}
module.exports={combined,objects};
