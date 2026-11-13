(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./ship-map-core'):root.SAShipMap,node?require('./ship-distances'):root.SAShipDistances,node?require('./ship-power'):root.SAShipPower);
 if(node)module.exports=api;else root.SAShipGravityCore=api;
})(typeof window==='object'?window:null,function(maps,distances,power){
 'use strict';
 const holes=room=>(room.spaceObjects||[]).filter(o=>o.kind==='black-hole'||o.kind==='sun');
 const immune=maps.gravityFieldActive;
function strength(hole,position){return Math.max(0,hole.intensity-distances.hexDistance(hole,distances.roundHex(position)));}
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
   ship.currentHullHp=0;ship.ship.currentHullHp=0;ship.navigation={...ship.navigation,phase:'stopped',speed:0,remaining:0};delete state.pullCycle;reports.push(ship.title+' was destroyed in '+(fields.some(h=>h.kind==='sun'&&distances.hexDistance(h,p)<1)?'the center of a sun.':'a black hole.'));
  }
 }
 return reports;
}
 return {strength,pullPosition,advance,PULL_PERIOD};
});
