(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./ship-map-core'):root.SAShipMap,node?require('./station-access'):root.SAStationAccess,node?require('./ship-sensors'):root.SAShipSensors,node?require('./ship-distances'):root.SAShipDistances,node?require('./delay-rules'):root.SADelayRules,node?require('./ship-power'):root.SAShipPower);
  if(node)module.exports=api;if(root)root.SAShipLocks=api;
}(typeof window!=='undefined'?window:null,function(maps,stations,sensors,distances,delays,power){
  const state=ship=>ship.lockState ||= {targets:[],failures:{},receipts:[],reports:[]};
  const points=item=>Number(item.impairmentPoints)||(item.impaired||item.status==='impaired'?1:0);
  function installed(ship){return (ship.ship.placements||[]).map(p=>ship.ship.sicInventory.find(i=>i.id===p.sicId)).find(i=>stations.online(i)&&maps.definition(i.type).lockOn);}
  const position=(room,id)=>distances.positions(room.starships,room.shipPositions).find(p=>p.id===id);
  const inRange=(room,ship,target)=>Boolean(sensors.installed(ship)&&distances.hexDistance(position(room,ship.id),position(room,target.id))<=sensors.rangeAgainst(room,ship,target));
  function report(ship,text,extra={}){const r={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,at:new Date().toISOString(),text,...extra};state(ship).reports=[r,...state(ship).reports].slice(0,40);sensors.knowledge(ship).reports=[r,...sensors.knowledge(ship).reports].slice(0,40);return r;}
  function drop(ship,targetId,reason){const data=state(ship);if(!data.targets.some(t=>t.targetId===targetId))return;data.targets=data.targets.filter(t=>t.targetId!==targetId);delete data.failures[targetId];delete data.failures['sic:'+targetId];report(ship,`Lock lost: ${reason}.`,{lockLost:true,targetId});}
  function refresh(room,seconds=0){
    for(const ship of room.starships||[]){
      const data=state(ship),item=installed(ship),impairment=points(item||{});
      const lost=!item||ship.currentHullHp<=0||impairment>(data.impairment||0);
      for(const lock of [...data.targets]){
        const target=room.starships.find(s=>s.id===lock.targetId);
        if(lost||!target||target.currentHullHp<=0||!inRange(room,ship,target)){drop(ship,lock.targetId,!item?'system offline':lost?'system impaired or ship destroyed':'target destroyed or outside sensor range');continue;}
        const component=target.ship.sicInventory.find(i=>i.id===lock.sicId);
        if(lock.sicId&&(target.currentShieldHp>0||!stations.online(component))){lock.sicId=null;report(ship,'Component lock lost; ship lock remains.',{targetId:target.id});}
      }
      data.impairment=impairment;
      // One target is free; a second consumes prepaid 12-second blocks.
      if(data.targets.length>1){const extra=data.targets[1];extra.remaining-=Math.max(0,seconds);while(extra.remaining<=0){if(!power.spend(room,ship.id,4)){drop(ship,extra.targetId,'not enough Auxiliary power to maintain second target');break;}extra.remaining+=12;}}
    }
  }
  function locked(room,ship,targetId){const target=room.starships.find(s=>s.id===targetId);return Boolean(installed(ship)&&target&&inRange(room,ship,target)&&state(ship).targets.some(t=>t.targetId===targetId));}
  const skill=(unit,kind)=>Math.max(0,Number(kind==='break'?unit.pilotSkill:kind==='sic'?unit.sensorSkill:unit.weaponSystemsSkill) || Number(unit.team==='npc'?unit.mentalSkill:0)||0);
  const bars=n=>n>=6?4:n>=5?3:n>=3?2:n>=1?1:0;
  function settings(unit,kind){const value={base:10,factors:{Situation:0,Execution:0,Quality:1,Performance:0,Efficiency:0,Ingenuity:bars(skill(unit,kind))}};return {...value,rate:delays.calculate(value).rate};}
  function rollSpec(room,unit,order){
    const ship=room.starships.find(s=>s.id===order.shipId),target=room.starships.find(s=>s.id===order.targetId),item=installed(ship);
    const p=maps.propulsion(ship),sides=order.kind==='break'?Array(p.evadeCount).fill(p.evadeDie):[points(item||{})?2:4,points(item||{})?2:4];
    const retryBonus=order.kind==='break'?0:state(ship).failures[(order.kind==='sic'?'sic:':'')+order.targetId]||0;
    const difficulty=order.kind==='break'?13:sensors.defense(room,target);
    return {sides,bonus:skill(unit,order.kind)+retryBonus,retryBonus:0,skill:order.kind==='break'?'Pilot/Helm':order.kind==='sic'?'Sensor Systems':'Weapon Systems',difficulty,difficultyLabel:`Meet or exceed ${difficulty}${retryBonus?`; retry +${retryBonus} included`:''}`,attributeKey:'intellect'};
  }
  function queue(room,unit,body){
    const seat=stations.station(room,unit),ship=seat?.ship;
    if(!ship||!maps.definition(seat.cell.type).bridge)return {ok:false,error:'Move to a working cockpit or bridge first.'};
    const data=state(ship),receipt=String(body.requestId||'');if(!/^[\w-]{8,100}$/.test(receipt))return {ok:false,error:'Invalid request.'};
    if(data.receipts.includes(receipt))return {ok:true,duplicate:true};
    if(unit.delayedAction||unit.delayTimer||unit.timedAction||unit.shieldRestabilizing||ship.auCommands?.some(c=>c.unitId===unit.id))return {ok:false,error:'Finish the current action first.'};
    if(body.kind==='release'){drop(ship,body.targetId,'released by operator');data.receipts=[...data.receipts,receipt].slice(-256);return {ok:true,ship,free:true};}
    if(room.activeId!==unit.id||unit.consoleHold)return {ok:false,error:'Wait for your turn and finish the current action.'};
    refresh(room);sensors.refresh(room);
    const target=room.starships.find(s=>s.id===body.targetId&&s.id!==ship.id),kind=body.kind;
    if(!['lock','sic','break'].includes(kind)||!target||target.currentHullHp<=0||ship.currentHullHp<=0)return {ok:false,error:'Choose an available target.'};
    if(kind==='break'){
      if(sensors.masking(room,ship)<=0)return {ok:false,error:'Masking is zero or below. Escape enemy sensor range to break this lock.'};
      if(!maps.propulsion(ship).evadeCount||!state(target).targets.some(l=>l.targetId===ship.id))return {ok:false,error:'No incoming lock to break, or no working thrusters.'};
    }else{
      if(!installed(ship))return {ok:false,error:'Install and power a Lock-On System.'};
      if(ship.sensorState.contacts[target.id]?.level!=='detected'||!inRange(room,ship,target))return {ok:false,error:'Detect the target and move within sensor range.'};
      const lock=data.targets.find(t=>t.targetId===target.id);
      if(kind==='lock'&&(lock||data.targets.length>=2))return {ok:false,error:lock?'Already locked onto this ship.':'System 1 supports two targets. Release one first.'};
      if(kind==='sic'){
        const analysis=sensors.knowledge(ship).reports.some(r=>r.analysis&&r.targetId===target.id&&r.layout),item=target.ship.sicInventory.find(i=>i.id===body.targetSicId);
        if(!lock||!analysis||target.currentShieldHp>0||!stations.online(item)||!target.ship.placements.some(p=>p.sicId===item.id))return {ok:false,error:'Analyze and lock onto the ship, lower its shields, then select an online installed component.'};
      }
      if(kind==='lock'&&data.targets.length===1&&!power.spend(room,ship.id,4))return {ok:false,error:'Not enough Auxiliary power: second target needs 4 AU per 12 seconds.'};
    }
    const input=settings(unit,kind),order={shipId:ship.id,targetId:target.id,kind,targetSicId:body.targetSicId,station:seat.key,secondTargetPaid:kind==='lock'&&data.targets.length===1};
    unit.delayedAction={id:`lock-${receipt}`,kind:'action',label:kind==='break'?'Break Lock-On':kind==='sic'?'Lock Component':'Lock-On',rate:input.rate,remaining:100,total:100,consumeTurn:true,resolving:false,settings:input,lockOrder:order,rollSpec:rollSpec(room,unit,order)};
    data.receipts=[...data.receipts,receipt].slice(-256);return {ok:true,ship};
  }
  function resolve(room,unit,roll){
    const pending=unit.delayedAction,order=pending?.lockOrder;if(!order)return;unit.delayedAction=null;
    const ship=room.starships.find(s=>s.id===order.shipId),target=room.starships.find(s=>s.id===order.targetId);if(!ship)return;
    refresh(room);
    if(!target||stations.station(room,unit)?.key!==order.station||ship.currentHullHp<=0||target.currentHullHp<=0)return report(ship,'Lock input interrupted.');
    if(order.kind!=='break'&&(!installed(ship)||!inRange(room,ship,target)))return report(ship,'Lock input interrupted: system or target unavailable.');
    if(order.kind==='break'&&sensors.masking(room,ship)<=0)return report(ship,'Break Lock-On failed: Masking is zero or below.');
    const spec=pending.rollSpec,total=Number.isFinite(roll.submittedScore)?roll.submittedScore:sensors.fusedTotal(spec.sides.map(roll))+spec.bonus,difficulty=order.kind==='break'?13:sensors.defense(room,target),success=total>=difficulty,data=state(ship);
    if(order.kind==='break'){if(success)drop(target,ship.id,`${ship.title} broke the lock`);}
    else if(success){
      if(order.kind==='sic'){const lock=data.targets.find(l=>l.targetId===target.id),item=target.ship.sicInventory.find(i=>i.id===order.targetSicId);if(!lock||target.currentShieldHp>0||!stations.online(item))return report(ship,'Component lock cancelled: shields or component state changed.');lock.sicId=order.targetSicId;}
      else {
        if(data.targets.some(l=>l.targetId===target.id)||data.targets.length>=2)return report(ship,'Target capacity changed; lock not added.');
        if(data.targets.length===1&&!order.secondTargetPaid&&!power.spend(room,ship.id,4))return report(ship,'Lock cancelled: second target requires 4 AU.');
        data.targets.push({targetId:target.id,remaining:12,sicId:null});report(target,'ENEMY LOCK-ON: hostile targeting acquired.',{incomingLock:true,attackerId:ship.id});
      }
    }else {const key=(order.kind==='sic'?'sic:':'')+target.id;data.failures[key]=(data.failures[key]||0)+1;}
    return report(ship,`${pending.label}: ${success?'SUCCESS':'FAILED'} (${Number(total.toFixed(2))} vs ${difficulty}).`,{lockResult:true,success,targetId:target.id,total,difficulty});
  }
  return {state,installed,locked,refresh,queue,resolve,rollSpec,settings,drop};
}));
