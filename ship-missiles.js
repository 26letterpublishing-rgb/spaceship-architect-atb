const maps=require('./ship-map-core'),stations=require('./station-access'),targets=require('./ship-targets'),ammo=require('./missile-ammunition');
const sensors=require('./ship-sensors'),locks=require('./ship-locks'),power=require('./ship-power'),shields=require('./ship-shields'),distances=require('./ship-distances');
const ROUND=12,EPS=1e-7;
function state(ship){const data=ship.ship.missileState ||= {};data.flights||=[];data.cooldowns||={};data.receipts||=[];return data;}
const pending=room=>targets.flights(room).some(m=>m.phase==='impact');
function reconcile(room){let count=0;for(const m of targets.flights(room)){if(!['impact','flying'].includes(m.phase)||!m.targetId)continue;const target=targets.find(room,m.targetId);if(!target||target.currentHullHp<=0||target.escapedAt||target.ship.warpState?.phase==='traveling'){m.phase='expired';m.endedAt=Date.now();count++;}}return count;}
function report(ship,text,extra={}){const r={id:require('node:crypto').randomUUID(),at:new Date().toISOString(),text,...extra};const s=sensors.knowledge(ship);s.reports=[r,...s.reports].slice(0,40);if(extra.impact){ship.weaponState||={receipts:[],reports:[]};ship.weaponState.reports=[r,...ship.weaponState.reports].slice(0,40);}return r;}
function queue(room,unit,body,input){
  const access=stations.access(room,unit,body.sicId);
  if(!access||access.blocked||!access.definition.missileLauncher||access.item.impaired||access.item.impairmentPoints>0||access.item.status==='impaired')return {ok:false,error:'Use an undamaged Missile Launcher at an accessible station.'};
  const ship=access.ship,data=state(ship),receipt=String(body.requestId||''),kind=ammo.catalog[body.ammunition];
  if(maps.cloaked(ship))return {ok:false,error:'Deactivate Cloaking before firing missiles or flares.'};
  if(['__proto__','constructor','prototype'].includes(access.id))return {ok:false,error:'Invalid launcher identifier.'};
  if(!/^[\w-]{8,100}$/.test(receipt))return {ok:false,error:'Invalid launch receipt.'};
  if(data.receipts.includes(receipt))return {ok:true,duplicate:true,ship};
  if(room.activeId!==unit.id||unit.delayedAction||unit.consoleHold||unit.timedAction||unit.delayTimer||unit.shieldRestabilizing||pending(room))return {ok:false,error:'Wait for your turn and finish the pending action.'};
  if(ship.currentHullHp<=0||ship.escapedAt||ship.ship.warpState?.phase==='traveling'||power.output(ship,room.units).en<1)return {ok:false,error:'The launcher ship or its power supply is unavailable.'};
  if(data.cooldowns[access.id]>EPS||room.units.some(u=>u.delayedAction?.missileOrder?.sicId===access.id&&u.delayedAction.missileOrder.shipId===ship.id))return {ok:false,error:'This launcher may fire only once per 12 active combat seconds.'};
  if(!kind||!(ammo.magazine(ship,access.id)[kind.id]>0))return {ok:false,error:'Load ammunition into this launcher outside combat.'};
  sensors.refresh(room);locks.refresh(room);
  const target=targets.find(room,body.targetId);
  if(!kind.flares&&(!target||target.id===ship.id||target.currentHullHp<=0||target.escapedAt||target.ship.warpState?.phase==='traveling'||!authorizedLock(room,unit,access,target.id)))return {ok:false,error:'Acquire an accessible target Lock-On before launching.'};
  if(!kind.flares&&body.targetSicId&&!locks.hasComponent(authorizedLock(room,unit,access,target.id),body.targetSicId))return {ok:false,error:'Acquire a controlled lock on the selected component first.'};
  let flares;
  if(kind.flares){
    flares=body.flares;
    if(!Array.isArray(flares)||flares.length!==3||flares.some(f=>!['heads','tails'].includes(f.result)||(f.result==='heads'&&(!Number.isInteger(f.direction)||f.direction<0||f.direction>5))||!targets.flights(room).some(m=>m.id===f.targetId&&m.phase==='flying')||(access.controlSource||ship).sensorState?.contacts?.[f.targetId]?.level!=='detected'))return {ok:false,error:'Confirm three coin flips against detected missiles and choose their deflection directions.'};
  }
  data.receipts=[...data.receipts,receipt].slice(-256);
  unit.delayedAction={id:'launch-'+receipt,kind:'action',label:kind.flares?'Deploy Missile Flares':`Launch ${kind.name}`,rate:input.rate,remaining:100,total:100,consumeTurn:true,resolving:false,rollConfirmed:true,settings:input,missileOrder:{shipId:ship.id,sicId:access.id,station:access.seat.key,targetId:target?.id,targetSicId:kind.flares?null:body.targetSicId||null,ammunition:kind.id,flares,captured:Boolean(access.controlled)}};
  return {ok:true,ship};
}
function authorizedLock(room,unit,access,targetId){return require('./ship-weapons').weaponLock(room,unit,access.ship,targetId,access.controlled);}
function resolveInput(room,unit){
  const task=unit.delayedAction,order=task?.missileOrder;if(!order)return;
  unit.delayedAction=null;
  const ship=room.starships.find(s=>s.id===order.shipId),access=stations.access(room,unit,order.sicId),kind=ammo.catalog[order.ammunition],target=targets.find(room,order.targetId);
  if(!ship)return;
  if(maps.cloaked(ship)||!access||access.blocked||access.seat.key!==order.station||access.item.impaired||access.item.impairmentPoints>0||access.item.status==='impaired'||ship.currentHullHp<=0||ship.escapedAt||power.output(ship,room.units).en<1||(!kind.flares&&(!target||target.currentHullHp<=0||target.escapedAt||target.ship.warpState?.phase==='traveling'||!authorizedLock(room,unit,access,target.id)))){
    report(ship,'Missile launch interrupted. The unfired round remains in the magazine.',{operatorId:unit.id});return;
  }
  if(!(ammo.magazine(ship,access.id)[kind.id]>0)){report(ship,'Launch cancelled: no loaded ammunition remains.',{operatorId:unit.id});return;}
  if(order.targetSicId&&!locks.hasComponent(authorizedLock(room,unit,access,target.id),order.targetSicId)){report(ship,'Launch cancelled: selected component lock was lost. The round remains in the magazine.',{operatorId:unit.id});return;}
  ship.ship.missileAmmo[access.id][kind.id]--;
  state(ship).cooldowns[access.id]=ROUND;
  if(kind.flares){
    const directions=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
    ship.ship.missileState.flarePulse={at:Date.now()};
    for(const flip of order.flares){const m=targets.flights(room).find(m=>m.id===flip.targetId&&m.phase==='flying');if(m&&flip.result==='heads'){m.targetId=null;m.direction={q:directions[flip.direction][0],r:directions[flip.direction][1]};m.deflected=true;}}
    report(ship,'Three missile flares deployed. Heads deflects; tails leaves pursuit unchanged.',{operatorId:unit.id});return;
  }
  const origin=targets.point(room,ship.id),destination=targets.point(room,target.id);
  const knownItem=sensors.analysis(access.controlSource||ship,target.id)?.layout?.sicInventory?.find(i=>i.id===order.targetSicId);
  for(let n=0;n<kind.count;n++)state(ship).flights.push({id:task.id+'-'+n,name:kind.name+(kind.count>1?` / ${n+1}`:''),slot:n,salvoSize:kind.count,sourceId:ship.id,targetId:target.id,targetSicId:order.targetSicId,componentName:knownItem?maps.definition(knownItem.type).name:null,unitId:unit.id,characterId:unit.characterId||null,controller:task.rollController||'player',automated:Boolean(task.automated),phase:'flying',position:{q:origin.q,r:origin.r},age:0,acceleration:kind.acceleration,speed:kind.acceleration,masking:kind.masking,dice:kind.dice,heading:heading(origin,destination),launchedAt:Date.now()});
  report(ship,`${kind.name} launched: ${kind.count} inbound projectile${kind.count===1?'':'s'}; pursuing ${target.title}.`,{operatorId:unit.id,missileLaunch:true,targetId:target.id});
}
function heading(a,b){return Math.atan2(1.5*(b.r-a.r),Math.sqrt(3)*((b.q-a.q)+(b.r-a.r)/2))*180/Math.PI;}
function nextEvent(room){
  let time=Infinity;
  for(const m of targets.flights(room).filter(m=>m.phase==='flying')){
    const target=m.targetId&&targets.find(room,m.targetId),p=target&&targets.point(room,target.id);
    if(m.targetId&&(!target||target.currentHullHp<=0||target.escapedAt||target.ship.warpState?.phase==='traveling'))return 0;
    time=Math.min(time,.2,ROUND-(m.age%ROUND));
    if(p)time=Math.min(time,distances.hexDistance(m.position,p)*ROUND/m.speed);
  }
  return time;
}
function advance(room,seconds){
  if(!(seconds>0)||pending(room))return;
  for(const ship of room.starships){const data=state(ship);for(const id of Object.keys(data.cooldowns))data.cooldowns[id]=Math.max(0,data.cooldowns[id]-seconds);data.flights=[...data.flights.filter(m=>['flying','impact'].includes(m.phase)),...data.flights.filter(m=>!['flying','impact'].includes(m.phase)).slice(-128)];}
  for(const m of targets.flights(room).filter(m=>m.phase==='flying')){
    const target=m.targetId&&targets.find(room,m.targetId),p=target&&targets.point(room,target.id);
    if(m.targetId&&(!target||target.currentHullHp<=0||target.escapedAt||target.ship.warpState?.phase==='traveling')){m.phase='expired';m.endedAt=Date.now();continue;}
    const delta=p?{q:p.q-m.position.q,r:p.r-m.position.r}:m.direction||{q:1,r:0},length=Math.max(Math.abs(delta.q),Math.abs(delta.r),Math.abs(delta.q+delta.r)),distance=m.speed*seconds/ROUND;
    m.heading=heading({q:0,r:0},delta);
    if(p&&length<=distance+EPS){m.position={q:p.q,r:p.r};m.phase='impact';m.arrivedAt=Date.now();}
    else if(length>EPS){m.position.q+=delta.q/length*distance;m.position.r+=delta.r/length*distance;}
    m.age+=seconds;m.speed=m.acceleration*Math.min(5,1+Math.floor((m.age+EPS)/ROUND));
    if(m.deflected&&m.age>=600){m.phase='expired';m.endedAt=Date.now();}
  }
}
function resolveDamage(room,id,total,campaign){
  const m=targets.flights(room).find(m=>m.id===id);
  if(!m)return {ok:false,error:'Missile not found.'};
  if(m.phase==='exploded')return {ok:true,duplicate:true};
  if(m.phase!=='impact')return {ok:false,error:'This missile is not awaiting impact damage.'};
  if(!Number.isInteger(total)||total<m.dice||total>m.dice*8)return {ok:false,error:`Confirm the total of the ${m.dice}D8 damage dice.`};
  const target=targets.find(room,m.targetId);
  m.phase='exploded';m.endedAt=Date.now();m.rolled=total;
  if(target?.isMissile||target?.isDrone||target?.isProbe){
    const hit=targets.hit(room,target.id,(target.isDrone||target.isProbe)?total*5:total),owner=room.starships.find(s=>s.id===(target.projectile?.sourceId||target.droneOwnerId||target.probeOwnerId)),source=room.starships.find(s=>s.id===m.sourceId),text=`${m.name}: ${total} rolled. ${hit?'Target destroyed.':'Target survived or is already gone.'}`;
    if(source)report(source,text,{id:'impact-'+m.id,operatorId:m.unitId,impact:true,hit,targetId:target.id,weaponFamily:'missile',damage:hit?1:0});
    if(owner&&owner!==source)report(owner,target.isProbe?'A scouting probe was attacked.':target.isDrone?'The repair drone was attacked.':'A launched missile was intercepted.',{targetId:target.id});
    reconcile(room);return {ok:true};
  }
  let podInjuries=0;
  if(target&&target.currentHullHp>0&&!target.escapedAt){
    shields.refresh(room);const damage=total*(target.currentShieldHp>0?1:5),before={hull:target.currentHullHp,shield:target.currentShieldHp};shields.damage(room,target.id,damage);
    const result={hullDamage:before.hull-target.currentHullHp,shieldDamage:before.shield-target.currentShieldHp};
    const item=target.ship.sicInventory.find(i=>i.id===m.targetSicId),componentHit=Boolean(result.hullDamage&&item&&target.ship.placements.some(p=>p.sicId===item.id));
    result.impairments=0;
    if(componentHit&&stations.online(item)){
      result.impairments=Math.floor(result.hullDamage/Math.max(1,maps.effectiveThreshold(target,item)||1));
      if(result.impairments){const previous=Number(item.impairmentPoints)||(item.impaired?1:0);item.impairmentPoints=Math.min(4,previous+result.impairments);item.impaired=true;if(item.impairmentPoints>=4||maps.definition(item.type).destroyedOnImpairment)item.status='destroyed';if(item.type==='escape-pods')podInjuries=require('./ship-field-utilities').hurtPod(room,target,item,item.impairmentPoints-previous,campaign);}
    }
    const parts=[result.shieldDamage>0?`${result.shieldDamage} shield damage`:null,result.hullDamage>0?`${result.hullDamage} hull damage`:null].filter(Boolean);
    const text=`${m.name}: ${total} rolled; ${parts.join(', ')||'no damage'}.${componentHit?` ${m.componentName||'Targeted SIC'} damaged${result.impairments?`: ${result.impairments} impairment(s)`:''}.`:''}`;
    const id='impact-'+m.id;
    report(target,text,{id,impact:true,hit:true,targetId:target.id,weaponFamily:'missile',damage,...result});
    const source=room.starships.find(s=>s.id===m.sourceId);if(source&&source!==target)report(source,text,{id,operatorId:m.unitId,impact:true,hit:true,targetId:target.id,weaponFamily:'missile',damage,...result});
  }
  // Other arrivals against a now-destroyed target need no meaningless dice.
  for(const other of targets.flights(room))if(other.phase==='impact'&&room.starships.find(s=>s.id===other.targetId)?.currentHullHp<=0){other.phase='expired';other.endedAt=Date.now();}
  return {ok:true,podInjuries};
}
module.exports={ROUND,state,pending,queue,resolveInput,nextEvent,advance,resolveDamage,reconcile};
