'use strict';
const maps=require('./ship-map-core'),distances=require('./ship-distances'),power=require('./ship-power'),stations=require('./station-access');
const holes=room=>(room.spaceObjects||[]).filter(o=>o.kind==='black-hole');
function shieldInstalled(ship){return maps.installedItems(ship).some(i=>maps.definition(i.type).shield&&maps.operational(i));}
const immune=maps.gravityFieldActive;
function strength(hole,position){return Math.max(0,hole.intensity-distances.hexDistance(hole,distances.roundHex(position)));}
function penalty(room,ship,position){return immune(ship)?0:Math.max(0,...holes(room).map(h=>strength(h,position)));}
function command(room,unit,body,{outsideCombat=false}={}){
 const access=stations.access(room,unit,String(body.sicId||''));
 if(!access||access.blocked||!access.definition.gravityField)return {ok:false,error:'Operate a Gravity Absolution Field station or Bridge.'};
 const ship=access.ship,state=ship.ship.gravityFieldState||={active:false,receipts:[]};
 if(typeof body.enabled!=='boolean'||!/^[-\w]{8,120}$/.test(body.receipt||''))return {ok:false,error:'Choose a field setting.'};
 state.receipts||=[];
 const prior=state.receipts.find(r=>r.id===body.receipt);if(prior)return prior.enabled===body.enabled?{ok:true,duplicate:true,ship}:{ok:false,error:'Receipt already used.'};
 if(!outsideCombat&&(room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.consoleHold||unit.delayTimer||unit.shieldRestabilizing||unit.pendingShipRolls?.length||room.attackResolution))return {ok:false,error:'Wait for your turn and finish the current action.'};
 if(body.enabled){
  if(immune(ship))return {ok:false,error:'Gravity Absolution Field is already active.'};
  if(access.item.impaired||access.item.impairmentPoints||access.item.status==='impaired')return {ok:false,error:'Repair the Gravity Absolution Field first.'};
  if(!shieldInstalled(ship))return {ok:false,error:'An operational shield system is required.'};
  if(power.output(ship,room.units).en<power.demand(ship))return {ok:false,error:'Insufficient EN to operate the field.'};
  if(!power.spend(room,ship.id,3))return {ok:false,error:'The field requires 3 available AU.'};
  state.sicId=access.item.id;state.remaining=12;
 }
 state.active=body.enabled;state.receipts=[...state.receipts,{id:body.receipt,enabled:body.enabled}].slice(-40);
 return {ok:true,ship,enabled:state.active};
}
// Sample the field once per 5 active seconds. Rendering may interpolate these
// fractional positions, but wall-clock animation never advances the simulation.
const PULL_PERIOD=5;
function pullPosition(fields,position,state,seconds){
 let remaining=seconds;
 if(state.pullCycle&&state.pullCycle.period!==PULL_PERIOD)delete state.pullCycle;
 while(remaining>1e-9){
  if(!state.pullCycle||state.pullCycle.remaining<=1e-9){
   state.pullCycle={period:PULL_PERIOD,remaining:PULL_PERIOD,fields:fields.map(h=>({id:h.id,amount:strength(h,position)})).filter(h=>h.amount>0)};
  }
  const cycle=state.pullCycle,step=Math.min(remaining,cycle.remaining);
  for(const sampled of cycle.fields){
   const hole=fields.find(h=>h.id===sampled.id);if(!hole||!strength(hole,position))continue;
   const distance=distances.hexDistance(hole,position);if(!distance)continue;
   const ratio=Math.min(1,sampled.amount*step/PULL_PERIOD/distance);
   position.q+=(hole.q-position.q)*ratio;position.r+=(hole.r-position.r)*ratio;
   const hex=distances.roundHex(position);
   if(hex.q===hole.q&&hex.r===hole.r){position.q=hole.q;position.r=hole.r;return true;}
  }
  cycle.remaining-=step;remaining-=step;
  if(!fields.some(h=>strength(h,position)>0))state.pullCycle={remaining:0,fields:[]};
 }
 return fields.some(h=>{const p=distances.roundHex(position);return p.q===h.q&&p.r===h.r;});
}
function advance(room,seconds,before=[],pull=true){
 if(!Number.isFinite(seconds)||seconds<=0)return [];
 const reports=[],fields=holes(room);room.shipPositions=distances.positions(room.starships||[],room.shipPositions);
 for(const ship of room.starships||[]){
  const state=ship.ship.gravityFieldState||={active:false,receipts:[]};
  if(state.active&&!immune(ship))state.active=false;
  if(state.active){state.remaining=(Number.isFinite(state.remaining)?state.remaining:12)-seconds;while(state.remaining<=0&&state.active){if(!power.spend(room,ship.id,3)){state.active=false;reports.push(ship.title+': Gravity Absolution Field shut down — insufficient AU.');break;}state.remaining+=12;}}
  if(!pull||ship.currentHullHp<=0||ship.escapedAt||ship.dockedIn||ship.ship.warpState?.phase==='traveling')continue;
  const p=room.shipPositions.find(p=>p.id===ship.id);if(!p)continue;
  if(immune(ship)){delete state.pullCycle;continue;}
  const previous=before.find(x=>x.id===ship.id)||p;
  const steps=Math.max(1,Math.ceil(distances.hexDistance(previous,p)*4));let crossed=false;
  for(let n=0;n<=steps&&!crossed;n++){const hex=distances.roundHex({q:previous.q+(p.q-previous.q)*n/steps,r:previous.r+(p.r-previous.r)*n/steps});crossed=fields.some(h=>hex.q===h.q&&hex.r===h.r);}
  if(crossed||pullPosition(fields,p,state,seconds)){
   ship.currentHullHp=0;ship.ship.currentHullHp=0;ship.navigation={...ship.navigation,phase:'stopped',speed:0,remaining:0};delete state.pullCycle;reports.push(ship.title+' was destroyed in a black hole.');
  }
 }
 if(pull){
  for(const {owner,job} of require('./ship-targets').salvagers(room)){if(job.position&&pullPosition(fields,job.position,job,seconds)){const item=owner.ship.sicInventory.find(i=>i.id===job.sicId);if(item){item.impaired=true;item.impairmentPoints=Math.max(1,item.impairmentPoints||0);}reports.push('Vulture Drone lost in a black hole.');}}
  require('./ship-extraction').advance(room,null,0);
  room.spaceObjects=(room.spaceObjects||[]).filter(object=>object.kind==='black-hole'||object.gunOrb||!pullPosition(fields,object,object,seconds));
 }
 room.shipDistances=distances.fromPositions(room.starships||[],room.shipPositions);return reports;
}
module.exports={strength,penalty,immune,advance,command,pullPosition,PULL_PERIOD};
