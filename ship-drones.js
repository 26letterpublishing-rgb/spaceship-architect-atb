'use strict';
const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power'),distances=require('./ship-distances'),delays=require('./delay-rules');
const {randomUUID,randomInt}=require('node:crypto');
const alive=s=>s&&!s.destroyedAt&&!s.escapedAt&&s.currentHullHp>0&&s.ship.warpState?.phase!=='traveling';
const position=(room,id)=>distances.positions(room.starships,room.shipPositions||[]).find(p=>p.id===id);
const sameHex=(room,a,b)=>{const x=position(room,a),y=position(room,b);return Boolean(x&&y&&Math.max(Math.abs(x.q-y.q),Math.abs(x.r-y.r),Math.abs(x.q+x.r-y.q-y.r))<1e-6);};
const settings=delays.repairDroneSettings;
const state=s=>s.ship.droneState||={drones:{},reports:[],receipts:[]};
function entries(room){return room.starships.flatMap(owner=>Object.values(owner.ship.droneState?.drones||{}).map(drone=>({owner,drone,item:owner.ship.sicInventory.find(i=>i.id===drone.sicId)})));}
function dock(d){d.phase='docked';d.targetId=d.ownerId;d.progress=0;}
function reconcile(room){
 for(const owner of room.starships){
  const installed=maps.installedItems(owner).filter(i=>maps.definition(i.type).repairDrone);
  if(!installed.length&&!owner.ship.droneState)continue;
  const data=state(owner),ids=new Set(installed.map(i=>i.id));
  for(const [id,d] of Object.entries(data.drones))if(!ids.has(id))delete data.drones[id];
  for(const item of installed){
   const d=data.drones[item.id]||={id:'drone-'+randomUUID(),sicId:item.id,ownerId:owner.id,targetId:owner.id,phase:'docked',progress:0,cycle:0};
   const def=maps.definition(item.type);d.tier=def.tier;d.die=def.repairDie;d.masking=def.masking;d.threshold=def.threshold;d.sprite=def.droneSprite;
   const spec=settings(def.tier);d.rate=delays.calculate(spec).rate;d.settings=spec;
   if(item.impaired||item.status==='impaired'||item.impairmentPoints>0||item.status==='destroyed'){item.status='destroyed';d.phase='destroyed';continue;}
   if(!alive(owner)||!stations.online(item)||power.output(owner,room.units).en<power.demand(owner)){dock(d);continue;}
   let target=room.starships.find(s=>s.id===d.targetId);
   if(d.targetId!==owner.id&&(!alive(target)||!sameHex(room,owner.id,d.targetId))){dock(d);target=owner;}
   if(d.phase==='repairing'&&target?.currentHullHp>=target?.maximumHullHp){d.phase='returning';d.progress=0;}
   if(d.phase==='docked'&&owner.currentHullHp<owner.maximumHullHp){d.phase='repairing';d.targetId=owner.id;d.progress=0;}
  }
 }
}
function nextEvent(room){reconcile(room);return Math.min(Infinity,...entries(room).map(({drone:d})=>d.phase==='repairing'?(100-d.progress)/d.rate:d.phase==='returning'?Math.max(0,1.5-d.progress):Infinity));}
function advance(room,seconds,roll=sides=>randomInt(1,sides+1)){
 reconcile(room);let changed=false;
 for(const {owner,drone:d} of entries(room)){
  if(d.phase==='returning'){d.progress+=seconds;if(d.progress>=1.5){dock(d);changed=true;}continue;}
  if(d.phase!=='repairing')continue;
  const target=room.starships.find(s=>s.id===d.targetId);if(!alive(target))continue;
  d.progress+=Math.max(0,seconds)*d.rate;
  while(d.progress>=100-1e-7&&d.phase==='repairing'){
   d.progress=Math.max(0,d.progress-100);d.cycle++;
   const result=roll(d.die);if(!Number.isInteger(result)||result<1||result>d.die)throw Error('Repair Drone requires a D'+d.die+' result.');
   const healed=Math.min(result,Math.max(0,target.maximumHullHp-target.currentHullHp));target.currentHullHp+=healed;target.ship.currentHullHp=target.currentHullHp;
   const report={id:`${d.id}:${d.cycle}`,at:new Date().toISOString(),title:target.title,droneId:d.id,targetId:target.id,die:d.die,tier:d.tier,roll:result,healed};
   state(owner).reports=[report,...state(owner).reports].slice(0,20);changed=true;
   if(target.currentHullHp>=target.maximumHullHp){d.phase='returning';d.progress=0;}
  }
 }
 return changed;
}
function command(room,unit,body){
 const access=stations.access(room,unit,body.sicId),fail=error=>({ok:false,error});
 if(!access||access.blocked||!access.definition.repairDrone)return fail('Operate an available Repair Drone from its ship’s bridge.');
 const owner=access.ship;reconcile(room);const data=state(owner),d=data.drones[body.sicId];
 if(!d||d.phase==='destroyed')return fail('The repair drone is unavailable.');
 const receipt=String(body.receipt||'');if(receipt.length<8||receipt.length>100)return fail('Missing repair command receipt.');
 if(data.receipts.includes(receipt))return {ok:true,duplicate:true,ship:owner};
 if(room.activeId!==unit.id||unit.consoleHold||unit.delayedAction||unit.timedAction||unit.delayTimer)return fail('Use an available ATB turn to order the drone.');
 const target=room.starships.find(s=>s.id===body.targetId);
 if(!alive(owner)||!alive(target)||target.id===owner.id||!sameHex(room,owner.id,target.id))return fail('Choose another ship on the same hex.');
 if(owner.sensorState?.contacts?.[target.id]?.level!=='detected')return fail('Detect the other ship before sending the drone.');
 if(target.currentHullHp>=target.maximumHullHp)return fail('That ship already has full Hull.');
 if(power.output(owner,room.units).en<power.demand(owner))return fail('The drone bay needs power.');
 d.phase='repairing';d.targetId=target.id;d.progress=0;
 data.receipts=[...data.receipts,receipt].slice(-100);
 return {ok:true,ship:owner,text:`Repair Drone dispatched to ${target.title}.`};
}
function hit(room,id,damage){
 const entry=entries(room).find(e=>e.drone.id===id&&['repairing','returning'].includes(e.drone.phase));
 if(!entry||damage<maps.definition(entry.item.type).threshold)return false;
 entry.drone.phase='destroyed';entry.item.impaired=true;entry.item.impairmentPoints=Math.max(1,entry.item.impairmentPoints||0);entry.item.status='destroyed';return true;
}
function repairTargets(room,owner){
 if(!alive(owner)||power.output(owner,room.units).en<power.demand(owner)||!maps.installedItems(owner).some(i=>maps.definition(i.type).repairDrone&&stations.online(i)&&!i.impaired&&!(i.impairmentPoints>0)&&i.status!=='impaired'))return [];
 return room.starships.filter(t=>t.id!==owner.id&&alive(t)&&t.currentHullHp<t.maximumHullHp&&sameHex(room,owner.id,t.id)&&owner.sensorState?.contacts?.[t.id]?.level==='detected').map(t=>({id:t.id,title:t.title}));
}
module.exports={state,settings,entries,position,sameHex,reconcile,nextEvent,advance,command,hit,repairTargets};
