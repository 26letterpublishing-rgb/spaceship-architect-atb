// Autonomous interior robots. Travel follows the same mesh and door timing as PCs.
const maps=require('./ship-map-core');
const {randomUUID}=require('node:crypto');
const SPEED=7,STEP_SECONDS=3/SPEED,DICE=[6,8,10,12];
const state=ship=>ship.ship.breachDroneState||={drones:{}};
const holes=ship=>Object.values(ship.ship.breachState?.holes||{}).filter(h=>!h.sealed).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
const usable=item=>item&&maps.operational(item)&&!item.impaired&&!item.impairmentPoints&&item.status!=='impaired';
function entries(room){return (room.starships||[]).flatMap(ship=>Object.values(ship.ship.breachDroneState?.drones||{}).map(drone=>({ship,drone})));}
function clearRoll(room,d){for(const u of room.units||[])u.pendingShipRolls=(u.pendingShipRolls||[]).filter(r=>r.breachDroneRoll?.droneId!==d.id);}
function reconcile(room){
 for(const ship of room.starships||[]){
  const installed=maps.installedItems(ship).filter(i=>i.type==='hull-breach-repair-drone');
  if(!installed.length&&!ship.ship.breachDroneState)continue;
  const data=state(ship),queue=holes(ship);
  for(const item of installed)if(usable(item)&&!data.drones[item.id]){const p=ship.ship.placements.find(p=>p.sicId===item.id);data.drones[item.id]={id:randomUUID(),sicId:item.id,phase:'docked',location:{square:p.cell,mesh:4},die:6,remaining:12};}
  for(const [key,d]of Object.entries(data.drones)){
   const host=installed.find(i=>i.id===key),target=queue.find(h=>h.id===d.hazardId);
   if(d.hazardId&&!target){clearRoll(room,d);d.hazardId=null;d.segment=null;d.route=null;d.phase='idle';}
   if(!queue.length){clearRoll(room,d);if(!usable(host)){delete data.drones[key];continue;}
    if(d.phase==='docked')continue;
    const p=ship.ship.placements.find(p=>p.sicId===key);d.destination={square:p.cell,mesh:4};d.phase='returning';d.hazardId=null;
   }else if(!d.hazardId){if(d.phase==='docked'&&!usable(host))continue;d.hazardId=queue[0].id;d.destination={square:queue[0].square,mesh:4};d.die=6;d.remaining=12;d.route=null;d.segment=null;d.phase='moving';}
   if(d.phase==='awaiting-roll')enqueue(room,ship,d);
  }
 }
}
function enqueue(room,ship,d){
 const existing=(room.units||[]).find(u=>u.pendingShipRolls?.some(r=>r.breachDroneRoll?.droneId===d.id));if(existing)return;
 const unit=(room.units||[]).find(u=>u.location?.starshipId===ship.id&&u.currentHp>0)||(room.units||[]).find(u=>u.currentHp>0)||(room.units||[])[0];
 if(!unit)return;
 (unit.pendingShipRolls||=[]).push({id:randomUUID(),label:'Hull Breach Repair Drone',rollController:'gm',breachDroneRoll:{shipId:ship.id,droneId:d.id},rollSpec:{attributeKey:'dexterity',attributeLabel:'Repair Drone',skill:'Engineering',sides:[d.die],bonus:0,difficulty:5,difficultyLabel:'5 or higher seals the breach',exertionAvailable:0}});
}
function nextSegment(ship,d){
 const layout=maps.buildLayout(ship.ship);
 if(!d.route)d.route=maps.meshRoute(layout,d.location,d.destination);
 if(!d.route)return false; // A disconnected compartment must be made accessible; never cut through a wall.
 if(!d.route.length){d.segment=null;d.phase=d.phase==='returning'?'docked':'repairing';return false;}
 const to=d.route[0];if(!maps.meshStepAllowed(layout,d.location,to)){d.route=null;return false;}
 const edge=layout.edge(d.location.square,to.square),door=edge.kind==='door'&&ship.ship.doorStates?.[edge.key]!=='open';
 d.segment={from:{...d.location},to:{...to},elapsed:0,duration:STEP_SECONDS+(door?.6:0),doorKey:door?edge.key:null};return true;
}
function advance(room,seconds){
 if(!Number.isFinite(seconds)||seconds<0)return;reconcile(room);
 for(const {ship,drone:d}of entries(room)){
  let left=seconds;
  while(left>1e-8){
   if(d.phase==='moving'||d.phase==='returning'){
    if(!d.segment&&!nextSegment(ship,d)){if(d.phase==='repairing')continue;break;}
    const s=d.segment,step=Math.min(left,s.duration-s.elapsed);s.elapsed+=step;left-=step;
    if(s.elapsed>=s.duration-1e-8){if(s.doorKey)(ship.ship.doorStates||={})[s.doorKey]='open';d.location={...s.to};d.route.shift();d.segment=null;if(!d.route.length)d.phase=d.phase==='returning'?'docked':'repairing';}
   }else if(d.phase==='repairing'){
    const step=Math.min(left,d.remaining);d.remaining-=step;left-=step;
    if(d.remaining<=1e-8){d.remaining=0;d.phase='awaiting-roll';enqueue(room,ship,d);break;}
   }else break;
  }
 }
}
function nextEvent(room){
 reconcile(room);return Math.min(Infinity,...entries(room).map(({ship,drone:d})=>{
  if(d.phase==='repairing')return d.remaining;if(d.phase!=='moving')return Infinity;
  if(!d.segment&&!nextSegment(ship,d))return d.phase==='repairing'?d.remaining:Infinity;
  let seconds=d.segment.duration-d.segment.elapsed,from=d.segment.to;const opened=new Set([d.segment.doorKey]),layout=maps.buildLayout(ship.ship);
  for(const to of d.route.slice(1)){const edge=layout.edge(from.square,to.square);seconds+=STEP_SECONDS;if(edge.kind==='door'&&!opened.has(edge.key)&&ship.ship.doorStates?.[edge.key]!=='open'){seconds+=.6;opened.add(edge.key);}from=to;}
  return seconds+d.remaining;
 }));
}
function resolve(room,order,values){
 const ship=room.starships.find(s=>s.id===order.shipId),d=ship&&Object.values(state(ship).drones).find(d=>d.id===order.droneId);
 if(!d||d.phase!=='awaiting-roll')throw Error('This drone repair roll is no longer pending.');
 if(values.length!==1||!Number.isInteger(values[0])||values[0]<1||values[0]>d.die)throw Error('Roll the requested repair die.');
 const h=holes(ship).find(h=>h.id===d.hazardId);clearRoll(room,d);
 if(!h){reconcile(room);return 'Hull Breach Repair Drone: opening already sealed.';}
 const die=d.die,success=values[0]>=5;
 if(success){h.sealed=true;d.phase='idle';d.hazardId=null;d.route=null;d.segment=null;}else{d.die=DICE[Math.min(DICE.length-1,DICE.indexOf(d.die)+1)];d.remaining=12;d.phase='repairing';}
 const text=`${ship.title}: Hull Breach Repair Drone rolled ${values[0]} on D${die}. ${success?'Breach sealed.':`Next attempt: D${d.die} in 12 active seconds.`}`;
 (ship.sensorState||={}).reports||=[];ship.sensorState.reports.unshift({at:new Date().toISOString(),text,values,total:values[0]});reconcile(room);return text;
}
module.exports={SPEED,STEP_SECONDS,state,holes,entries,reconcile,advance,nextEvent,resolve};
