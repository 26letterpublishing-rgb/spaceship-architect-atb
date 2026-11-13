'use strict';
const maps=require('./ship-map-core'),distances=require('./ship-distances'),power=require('./ship-power'),stations=require('./station-access');
const gravity=require('./ship-gravity-core'),{strength,pullPosition,PULL_PERIOD}=gravity;
const holes=room=>(room.spaceObjects||[]).filter(o=>o.kind==='black-hole'||o.kind==='sun');
function shieldInstalled(ship){return maps.installedItems(ship).some(i=>maps.definition(i.type).shield&&maps.operational(i));}
const immune=maps.gravityFieldActive;
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
function advance(room,seconds,before=[],pull=true){
 if(!Number.isFinite(seconds)||seconds<=0)return [];
 const reports=gravity.advance(room,seconds,before,pull),fields=holes(room);
 if(pull){
  for(const {owner,job} of require('./ship-targets').salvagers(room)){if(job.position&&pullPosition(fields,job.position,job,seconds)){const item=owner.ship.sicInventory.find(i=>i.id===job.sicId);if(item){const offline=require('./ship-offline-events'),wasOnline=offline.capture(owner,item);item.impaired=true;item.impairmentPoints=Math.max(1,item.impairmentPoints||0);offline.record(owner,item,wasOnline);}reports.push('Vulture Drone lost in a black hole.');}}
  require('./ship-extraction').advance(room,null,0);
  room.spaceObjects=(room.spaceObjects||[]).filter(object=>['black-hole','sun'].includes(object.kind)||object.gunOrb||!pullPosition(fields,object,object,seconds));
 }
 room.shipDistances=distances.fromPositions(room.starships||[],room.shipPositions);return reports;
}
module.exports={strength,penalty,immune,advance,command,pullPosition,PULL_PERIOD};
