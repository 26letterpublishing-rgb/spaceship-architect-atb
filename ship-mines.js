// Mines use the existing authoritative ammunition and manual impact-dice pipeline.
const maps=require('./ship-map-core'),hexes=require('./ship-distances'),ammo=require('./missile-ammunition');
const active=room=>(room.starships||[]).flatMap(s=>s.ship?.missileState?.flights||[]).filter(m=>['mine','web'].includes(m.phase));
const same=(a,b)=>{a=hexes.roundHex(a);b=hexes.roundHex(b);return a.q===b.q&&a.r===b.r;};
function count(room,p){return active(room).filter(m=>same(m.position,p)).length;}
function detonate(room,m,target){
 if(m.phase!=='mine')return false;
 m.phase='exploded';m.endedAt=Date.now();
 const owner=room.starships.find(s=>s.id===m.sourceId);if(!owner)return true;
 const victims=target?[target]:room.starships.filter(s=>s.id!==m.sourceId&&s.currentHullHp>0&&!s.escapedAt&&!s.dockedIn&&same(require('./ship-targets').point(room,s.id),m.position));
 for(const ship of victims)owner.ship.missileState.flights.push({...m,id:m.id+'-impact-'+ship.id,phase:'impact',targetId:ship.id,isMine:true,endedAt:undefined});
 return true;
}
function hit(room,id,damage){const mine=active(room).find(m=>m.id===id);return Boolean(mine&&!mine.web&&damage>=mine.threshold&&detonate(room,mine));}
function deploy(room,ship,unit,task,kind){
 const p=hexes.roundHex(require('./ship-targets').point(room,ship.id));if(count(room,p)>=3)return false;
 const order=task.missileOrder;
 if(order.seeker&&!(ammo.storage(ship)['magnetic-seeker']>0))return false;
 if(order.seeker)ship.ship.missileStorage['magnetic-seeker']--;
 ship.ship.missileAmmo[order.sicId][kind.id]--;
 ship.ship.missileState.cooldowns[order.sicId]=12;
 ship.ship.missileState.flights.push({id:task.id+'-mine',name:kind.name,isMine:true,ammunition:kind.id,sourceId:ship.id,unitId:unit.id,characterId:unit.characterId||null,controller:task.rollController||'player',phase:'mine',position:p,age:0,masking:kind.masking,threshold:kind.threshold,dice:kind.dice,web:Boolean(kind.web),seeker:Boolean(order.seeker),launchId:order.sicId});return true;
}
function advance(room,seconds,before=[]){
 if(!(seconds>0))return;
 const targets=require('./ship-targets'),gravity=require('./ship-black-holes'),fields=(room.spaceObjects||[]).filter(o=>o.kind==='black-hole');
 for(const m of active(room)){
  m.age+=seconds;
  const originalPosition={...m.position};
  if(gravity.pullPosition(fields,m.position,m,seconds)){m.phase='expired';m.endedAt=Date.now();continue;}
  if(!same(originalPosition,m.position)&&count(room,m.position)>3)m.position=originalPosition;
  if(m.web){if(m.age>=132){m.phase='expired';m.endedAt=Date.now();}else if(m.age>=12)m.phase='web';continue;}
  const candidates=room.starships.filter(s=>s.id!==m.sourceId&&s.currentHullHp>0&&!s.escapedAt&&!s.dockedIn&&s.ship.warpState?.phase!=='traveling');
  if(m.seeker){const closest=candidates.map(s=>({s,p:targets.point(room,s.id)})).filter(o=>hexes.hexDistance(o.p,m.position)<=5).sort((a,b)=>hexes.hexDistance(a.p,m.position)-hexes.hexDistance(b.p,m.position))[0];if(closest){const length=hexes.hexDistance(closest.p,m.position),ratio=length?Math.min(1,2*seconds/12/length):0,next={q:m.position.q+(closest.p.q-m.position.q)*ratio,r:m.position.r+(closest.p.r-m.position.r)*ratio};if(same(next,m.position)||count(room,next)<3)m.position=next;}}
  for(const s of candidates){const p=targets.point(room,s.id),a=before.find(x=>x.id===s.id)||p,steps=Math.max(1,Math.ceil(hexes.hexDistance(a,p)*4));let crossed=false;
   for(let n=0;n<=steps&&!crossed;n++)crossed=same(m.position,{q:a.q+(p.q-a.q)*n/steps,r:a.r+(p.r-a.r)*n/steps});
   if(crossed){detonate(room,m,s);break;}
  }
 }
}
module.exports={active,count,deploy,advance,hit,detonate};
