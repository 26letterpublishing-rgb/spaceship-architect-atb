(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(...['ship-map-core','station-access','ship-power','ship-distances','delay-rules'].map((name,n)=>node?require('./'+name):[root.SAShipMap,root.SAStationAccess,root.SAShipPower,root.SAShipDistances,root.SADelayRules][n]));
  if(node)module.exports=api;if(root)root.SAShipProbes=api;
}(typeof window!=='undefined'?window:null,function(maps,stations,power,distances,delays){
  const state=ship=>ship.ship.probeState||={probes:{},launchers:{},receipts:[],reports:[]};
  const active=p=>['flying','holding','returning','recovering','approaching','breaching','attached'].includes(p?.phase);
  const orderLabel=kind=>({launch:'Launch',move:'Move',return:'Retract Probe',scan:'Scan',attach:'Attach Bug to Ship',bugOn:'Activate Hacking Bug',bugOff:'Deactivate Hacking Bug',inhibit:'Activate Warp Inhibitor',inhibitOff:'Deactivate Warp Inhibitor'}[kind]||kind);
  const position=(room,id)=>distances.positions(room.starships,room.shipPositions||[]).find(p=>p.id===id);
  const present=s=>s&&!s.destroyedAt&&!s.escapedAt&&(s.currentHullHp==null||s.currentHullHp>0)&&s.ship.warpState?.phase!=='traveling';
  const entries=room=>(room.starships||[]).flatMap(owner=>Object.values(owner.ship.probeState?.probes||{}).map(probe=>({owner,probe,item:owner.ship.sicInventory.find(i=>i.id===probe.sicId)})));
  function linked(room,owner,p){
    const launcher=owner.ship.sicInventory.find(i=>i.id===p.launcherId);
    return active(p)&&present(owner)&&stations.online(owner.ship.sicInventory.find(i=>i.id===p.sicId))&&stations.online(launcher)&&owner.ship.placements.some(a=>a.sicId===launcher.id)&&power.output(owner,room.units||[]).en>=power.demand(owner)&&maps.sensorStats(owner).range>0&&distances.hexDistance(position(room,owner.id),p.position)<=maps.sensorStats(owner).range+1e-7;
  }
  function destinationError(room,owner,destination){
    if(!destination||![destination.q,destination.r].every(v=>Number.isInteger(v)&&Math.abs(v)<=10000))return 'Select a destination hex.';
    const range=maps.sensorStats(owner).range,origin=position(room,owner.id);
    if(!origin||!(range>0)||distances.hexDistance(origin,destination)>range+1e-7)return 'Choose a hex within your ship’s sensor range.';
    return '';
  }
  // Search integer axial rows in the owner's hex disk, minimizing actual flight distance.
  // A fractional ship position may put the nearest legal hex off the direct radial line.
  function nearestInRange(origin,point,range){
    if(!origin||!point||![origin.q,origin.r,point.q,point.r,range].every(Number.isFinite)||range<0)return null;
    let best=null,bestDistance=Infinity,bestSquare=Infinity;
    for(let q=Math.max(-10000,Math.ceil(origin.q-range-1e-7));q<=Math.min(10000,Math.floor(origin.q+range+1e-7));q++){
      const lo=Math.max(-10000,Math.ceil(Math.max(origin.r-range,origin.q+origin.r-range-q)-1e-7));
      const hi=Math.min(10000,Math.floor(Math.min(origin.r+range,origin.q+origin.r+range-q)+1e-7));
      if(lo>hi)continue;
      const middle=point.r-(q-point.q)/2;
      for(const r of new Set([Math.max(lo,Math.min(hi,Math.floor(middle))),Math.max(lo,Math.min(hi,Math.ceil(middle)))])){
        const candidate={q,r},distance=distances.hexDistance(point,candidate),dq=q-point.q,dr=r-point.r,square=dq*dq+dq*dr+dr*dr;
        if(distance<bestDistance-1e-7||(Math.abs(distance-bestDistance)<=1e-7&&square<bestSquare-1e-7)){best=candidate;bestDistance=distance;bestSquare=square;}
      }
    }
    return best;
  }
  function recoverRange(room,owner,p){
    if(!active(p)||!present(owner)||!stations.online(owner.ship.sicInventory.find(i=>i.id===p.sicId)))return false;
    const origin=position(room,owner.id),range=maps.sensorStats(owner).range;
    if(p.phase==='returning'){
      const changed=p.destination?.q!==origin?.q||p.destination?.r!==origin?.r;p.destination={...origin};return changed;
    }
    if(!(range>0)||!origin)return false;
    const inside=distances.hexDistance(origin,p.position)<=range+1e-7;
    if(inside&&(p.phase!=='recovering'||(p.destination&&distances.hexDistance(origin,p.destination)<=range+1e-7)))return false;
    const destination=nearestInRange(origin,p.position,range);if(!destination)return false;
    const changed=p.phase!=='recovering'||p.destination?.q!==destination.q||p.destination?.r!==destination.r;
    if(p.phase!=='recovering')report(owner,p.name+': outside sensor range; returning to the nearest linked hex.');
    p.phase='recovering';p.destination=destination;p.targetId=null;p.bugActive=false;p.breachRemaining=0;p.inhibitor='off';p.inhibitorRemaining=0;
    return changed;
  }
  function maintainRange(room){let changed=false;for(const {owner,probe} of entries(room))if(recoverRange(room,owner,probe))changed=true;return changed;}
  function report(owner,text){const s=state(owner);s.reports=[{text,at:new Date().toISOString()},...s.reports].slice(0,30);}
  const moduleOn=(owner,p,type)=>stations.online(owner.ship.sicInventory.find(i=>i.id===p.sicId))&&maps.attachments(owner,p.sicId,type).some(i=>stations.online(i)&&maps.addonHost(owner,i));
  function bugLink(room,owner,target){return present(target)&&entries(room).some(e=>e.owner.id===owner.id&&e.probe.phase==='attached'&&e.probe.targetId===target.id&&e.probe.bugActive&&moduleOn(owner,e.probe,'hacking-bug')&&linked(room,owner,e.probe));}
  function warpBlocked(room,ship){return entries(room).some(({owner,probe:p})=>active(p)&&p.inhibitor==='active'&&moduleOn(owner,p,'warp-bubble-inhibitor')&&distances.hexDistance(p.position,position(room,ship.id))<=2+1e-7);}
  function payloadError(room,owner,p,kind,targetId,unit){
    if(['move','attach'].includes(kind)&&p.inhibitor&&p.inhibitor!=='off')return 'Deactivate the inhibitor before moving the probe.';
    if(kind==='attach'){
      if(!moduleOn(owner,p,'hacking-bug'))return 'This probe needs a working Hacking Bug.';
      const target=room.starships.find(s=>s.id===targetId&&s.id!==owner.id);
      if(!present(target)||owner.sensorState?.contacts?.[targetId]?.level!=='detected')return 'Choose a detected starship in normal space.';
      if(target.currentShieldHp>0&&!moduleOn(owner,p,'shield-breacher'))return 'Target is shielded. Install a Shield Breacher on this probe.';
    }
    if(kind==='bugOn'){
      if(!moduleOn(owner,p,'hacking-bug')||p.phase!=='attached')return 'Attach a working Hacking Bug to a ship first.';
      if(p.bugActive)return 'Hacking Bug already active.';
      if(unit?.shipAi||unit?.shipAI||unit?.isAI)return 'Ship AI never spends AU. A crew member must activate this bug.';
      if(!(owner.auState?.available>=1))return 'Hacking Bug needs 1 AU now and every 12 active seconds.';
    }
    if(kind==='bugOff'&&!p.bugActive)return 'Hacking Bug is already off.';
    if(kind==='inhibit'){
      if(!moduleOn(owner,p,'warp-bubble-inhibitor'))return 'This probe needs a working Warp Bubble Inhibitor.';
      if(p.phase!=='holding'||p.destination)return 'Move the probe to a stationary position first.';
      if(p.inhibitor&&p.inhibitor!=='off')return 'Inhibitor is already activating or active.';
    }
    if(kind==='inhibitOff'&&(!p.inhibitor||p.inhibitor==='off'))return 'Inhibitor is already off.';
    return '';
  }
  function destroy(owner,p,text){p.phase='destroyed';p.destination=null;p.bugActive=false;p.inhibitor='off';for(const item of owner.ship.sicInventory.filter(i=>i.id===p.sicId||i.attachTo===p.sicId)){item.impaired=true;item.impairmentPoints=Math.max(1,item.impairmentPoints||0);item.status='destroyed';}report(owner,text);}
  function reconcile(room){
    for(const owner of room.starships||[]){
      const items=maps.installedItems(owner).filter(i=>maps.definition(i.type).probe);
      if(!items.length&&!owner.ship.probeState)continue;
      const data=state(owner);data.launchers||={};
      for(const item of items){const d=maps.definition(item.type);const p=data.probes[item.id]||={id:`probe-${owner.id}-${item.id}`,sicId:item.id,launcherId:item.attachTo,ownerId:owner.id,phase:'docked',position:{...position(room,owner.id)}};
        Object.assign(p,{type:item.type,tier:d.tier,name:d.name,speed:d.moveSpeed,masking:d.masking,threshold:maps.effectiveThreshold(owner,item)||d.threshold});
        if(item.status==='destroyed'||item.impaired||item.status==='impaired'||item.impairmentPoints>0){if(p.phase!=='destroyed')destroy(owner,p,p.name+' destroyed by impairment.');}
        p.launcherId=item.attachTo;if(p.phase==='unavailable')p.phase='docked';
        if(p.phase==='docked')p.position={...position(room,owner.id)};
        p.linked=linked(room,owner,p);
        if(!active(p)||!moduleOn(owner,p,'warp-bubble-inhibitor')){p.inhibitor='off';p.inhibitorRemaining=0;}
        if(!p.linked||p.phase!=='attached'||!moduleOn(owner,p,'hacking-bug'))p.bugActive=false;
      }
      for(const p of Object.values(data.probes))if(!items.some(i=>i.id===p.sicId)&&p.phase!=='destroyed'){p.phase='unavailable';p.linked=false;}
      for(const launcher of maps.installedItems(owner).filter(i=>maps.definition(i.type).probeLauncher)){
        const l=data.launchers[launcher.id]||={cooldown:0,impairments:0},points=Number(launcher.impairmentPoints)||(launcher.impaired?1:0);
        for(let n=l.impairments;n<points;n++){const p=Object.values(data.probes).find(p=>p.launcherId===launcher.id&&p.phase==='docked');if(p)destroy(owner,p,'Launcher impairment destroyed '+p.name+'.');}
        l.impairments=points;
      }
    }
  }
  function sources(room,owner){return entries(room).filter(e=>e.owner.id===owner.id&&linked(room,owner,e.probe)).map(e=>({position:e.probe.position,range:maps.sensorStats(owner).range,probe:e.probe}));}
  function inputSettings(unit,tier=1){const skill=Math.floor(Number(unit.engineeringSkill??unit.mentalSkill)||0);return {base:8,factors:{Situation:0,Execution:0,Quality:Math.min(4,tier),Performance:0,Efficiency:0,Ingenuity:skill>=6?4:skill>=5?3:skill>=3?2:skill>=1?1:0}};}
  function validate(room,unit,body,checkTurn=true){
    const a=stations.access(room,unit,body.sicId);if(!a?.definition.probeLauncher||a.blocked)throw Error('Use a working Probe Launcher station or Bridge console.');
    if(!present(a.ship)||power.output(a.ship,room.units).en<power.demand(a.ship))throw Error('Restore ship power and remain in normal space.');
    if(checkTurn&&(room.activeId!==unit.id||unit.consoleHold||unit.delayedAction||unit.timedAction||unit.delayTimer))throw Error('Wait for your turn and finish the pending action.');
    return a;
  }
  function command(room,unit,body,{outsideCombat=false}={}){
    try{
      if(outsideCombat)throw Error('Launch and control probes from the combat starmap. Prepare an encounter to scout.');
      const a=validate(room,unit,body,false);reconcile(room);const data=state(a.ship),receipt=String(body.receipt||''),fingerprint=JSON.stringify([unit.id,body.sicId,body.kind,body.probeId,body.destination,body.targetId]);
      if(!/^[\w-]{8,100}$/.test(receipt))throw Error('A probe command receipt is required.');
      const prior=data.receipts.find(r=>r.id===receipt);if(prior){if(prior.fingerprint!==fingerprint)throw Error('Receipt belongs to another command.');return {ok:true,duplicate:true,ship:a.ship};}
      validate(room,unit,body);const p=Object.values(data.probes).find(p=>p.id===body.probeId&&p.launcherId===a.id);
      if(!p||!['launch','move','return','scan','attach','bugOn','bugOff','inhibit','inhibitOff'].includes(body.kind))throw Error('Choose an available probe and command.');
      if(body.kind==='launch'){if(p.phase!=='docked'||!stations.online(a.ship.ship.sicInventory.find(i=>i.id===p.sicId)))throw Error('Choose an operational docked probe.');if(data.launchers[a.id]?.cooldown>0)throw Error('Launcher is cooling down. One launch per 12 active seconds.');if(!maps.sensorStats(a.ship).range)throw Error('Install operational Sensors before launching.');}
      else if(body.kind==='return'?!active(p):!linked(room,a.ship,p))throw Error('Probe is outside the ship’s sensor link or is unavailable.');
      const error=payloadError(room,a.ship,p,body.kind,body.targetId,unit);if(error)throw Error(error);
      if(['launch','move'].includes(body.kind)){const error=destinationError(room,a.ship,body.destination);if(error)throw Error(error);}
      const settings=inputSettings(unit,p.tier),order={shipId:a.ship.id,sicId:a.id,station:a.seat.key,probeId:p.id,kind:body.kind,destination:body.destination,targetId:body.targetId};
      unit.delayedAction={id:'probe-'+receipt,kind:'action',label:p.name+': '+orderLabel(body.kind),remaining:100,total:100,rate:delays.calculate(settings).rate,settings,consumeTurn:true,resolving:false,probeOrder:order};
      data.receipts=[...data.receipts,{id:receipt,fingerprint}].slice(-256);
      return {ok:true,ship:a.ship,delayed:true,text:p.name+': '+orderLabel(body.kind)+' input started.'};
    }catch(e){return {ok:false,error:e.message};}
  }
  function checks(room,owner,p){
    const sensors=require('./ship-sensors'),targets=require('./ship-targets'),range=maps.sensorStats(owner).range;
    return targets.all(room).filter(t=>t.id!==owner.id&&t.id!==p.id&&!(t.isProbe&&t.probeOwnerId===owner.id)&&!t.destroyedAt&&!t.escapedAt&&t.ship.warpState?.phase!=='traveling').flatMap(t=>{const distance=distances.hexDistance(p.position,targets.point(room,t.id)),limit=range*(sensors.masking(room,t)<=0?2:1);return distance<=limit?[{target:t,difficulty:sensors.masking(room,t)-Math.floor(limit-distance+1e-8)}]:[];});
  }
  function rollSpec(room,unit,order){const owner=room.starships.find(s=>s.id===order.shipId),p=owner&&Object.values(state(owner).probes).find(p=>p.id===order.probeId),values=p?checks(room,owner,p):[],difficulty=values.length?Math.max(...values.map(c=>c.difficulty)):10;return {sides:p?maps.definition(p.type).probeDice:[],bonus:Number(unit.sensorSkill??unit.mentalSkill)||0,skill:'Sensor Systems',difficulty,difficultyLabel:'Probe scan difficulty '+difficulty};}
  function resolveInput(room,unit){
    const pending=unit.delayedAction,order=pending?.probeOrder;if(!order)return;unit.delayedAction=null;
    const owner=room.starships.find(s=>s.id===order.shipId);if(!owner)return;
    try{
      const a=validate(room,unit,{sicId:order.sicId},false),p=Object.values(state(owner).probes).find(p=>p.id===order.probeId);
      if(a.ship.id!==owner.id||a.seat.key!==order.station||!p)throw Error('Probe input interrupted: station or probe unavailable.');
      if(['launch','move'].includes(order.kind)){const error=destinationError(room,owner,order.destination);if(error)throw Error(error);}
      if(order.kind==='launch'){if(p.phase!=='docked'||!stations.online(owner.ship.sicInventory.find(i=>i.id===p.sicId))||!maps.sensorStats(owner).range||state(owner).launchers[a.id].cooldown>0)throw Error('Probe or launcher unavailable.');p.position={...position(room,owner.id)};p.phase='flying';p.destination={...order.destination};state(owner).launchers[a.id].cooldown=12;}
      else{
        if(order.kind==='return'?!active(p):!linked(room,owner,p))throw Error('Probe link lost before input completed.');
        const error=payloadError(room,owner,p,order.kind,order.targetId,unit);if(error)throw Error(error);
        if(order.kind==='inhibit'){p.inhibitor='arming';p.inhibitorRemaining=12;report(owner,p.name+': inhibitor activating in 12 active seconds.');return;}
        if(order.kind==='inhibitOff'){p.inhibitor='off';p.inhibitorRemaining=0;report(owner,p.name+': inhibitor off.');return;}
        if(order.kind==='bugOn'){if(!power.spend(room,owner.id,1))throw Error('No AU available for the Hacking Bug.');p.bugActive=true;p.bugRemaining=12;report(owner,p.name+': Hacking Bug active. 1 AU charged.');return;}
        if(order.kind==='bugOff'){p.bugActive=false;report(owner,p.name+': Hacking Bug off.');return;}
        if(order.kind==='attach'){p.targetId=order.targetId;p.phase='approaching';p.destination={...position(room,p.targetId)};p.bugActive=false;p.breachRemaining=0;report(owner,p.name+': approaching target hull.');return;}
        if(order.kind==='scan'){
          if(!pending.rollConfirmed||!pending.submittedRoll)throw Error('Probe scan requires a confirmed standard dice roll.');
          const sensors=require('./ship-sensors'),total=pending.submittedRoll.score,found=checks(room,owner,p).filter(c=>total>=c.difficulty);
          for(const c of found)sensors.detect(room,owner,c.target).masking=sensors.masking(room,c.target);
          sensors.report(owner,{text:`${p.name} scan: ${found.length} contact(s) detected.`,values:pending.submittedRoll.values,total});
          report(owner,`${p.name} scan: ${found.length} contact(s) detected.`);return;
        }
        p.targetId=null;p.bugActive=false;p.breachRemaining=0;if(order.kind==='return'){p.inhibitor='off';p.inhibitorRemaining=0;}p.phase=order.kind==='return'?'returning':'flying';p.destination=order.kind==='return'?{...position(room,owner.id)}:{...order.destination};
      }
      report(owner,p.name+': '+order.kind+' command completed.');reconcile(room);
    }catch(e){report(owner,e.message);}
  }
  function advance(room,seconds){
    if(!(seconds>0)||room.hardPaused||room.holdPaused)return false;reconcile(room);let changed=maintainRange(room);
    for(const owner of room.starships||[])for(const l of Object.values(owner.ship.probeState?.launchers||{}))if(l.cooldown>0){l.cooldown=Math.max(0,l.cooldown-seconds);changed=true;}
    for(const {owner,probe:p}of entries(room)){
      if(!active(p))continue;
      if(p.inhibitor==='arming'){p.inhibitorRemaining=Math.max(0,p.inhibitorRemaining-seconds);changed=true;if(!p.inhibitorRemaining){p.inhibitor='active';report(owner,p.name+': warp blocked within 2 Units, including allied ships.');}}
      if(['approaching','breaching','attached'].includes(p.phase)){
        const target=room.starships.find(s=>s.id===p.targetId);
        if(!present(target)){p.phase='holding';p.destination=null;p.targetId=null;p.bugActive=false;report(owner,p.name+': target unavailable. Holding position.');changed=true;continue;}
        if(p.phase==='attached'){
          p.position={...position(room,target.id)};changed=true;recoverRange(room,owner,p);
          if(p.bugActive){p.bugRemaining-=seconds;while(p.bugRemaining<=1e-7&&p.bugActive){if(power.spend(room,owner.id,1))p.bugRemaining+=12;else{p.bugActive=false;report(owner,p.name+': Hacking Bug stopped; no AU available.');}}}
          if(p.phase==='attached')continue;
        }
        if(p.phase==='breaching'){
          if(!linked(room,owner,p)||!moduleOn(owner,p,'shield-breacher')||distances.hexDistance(p.position,position(room,target.id))>1e-6){p.phase='approaching';p.breachRemaining=0;p.destination={...position(room,target.id)};}
          else{p.breachRemaining=Math.max(0,p.breachRemaining-seconds);changed=true;if(!p.breachRemaining){p.phase='attached';p.position={...position(room,target.id)};report(owner,p.name+': hull reached. Activate Hacking Bug to begin AU upkeep.');}continue;}
        }
        if(p.phase==='approaching'&&linked(room,owner,p))p.destination={...position(room,target.id)};
      }
      if(!active(p)||!p.destination)continue;
      // Retraction follows the owner even while the direct sensor link is lost.
      if(p.phase==='returning')p.destination={...position(room,owner.id)};
      const distance=distances.hexDistance(p.position,p.destination),step=Math.min(distance,p.speed*seconds/12),ratio=distance?step/distance:1;
      p.position={q:p.position.q+(p.destination.q-p.position.q)*ratio,r:p.position.r+(p.destination.r-p.position.r)*ratio};changed=true;
      if(step>=distance-1e-7){
        if(p.phase==='approaching'){
          const target=room.starships.find(s=>s.id===p.targetId),shielded=target?.currentShieldHp>0;
          const arrived=linked(room,owner,p)&&distances.hexDistance(p.position,position(room,p.targetId))<1e-6;
          p.destination=null;p.phase=arrived?(shielded?(moduleOn(owner,p,'shield-breacher')?'breaching':'holding'):'attached'):'holding';p.breachRemaining=p.phase==='breaching'?24:0;
          report(owner,p.name+(p.phase==='breaching'?': at shield barrier. Waiting one round, then breaching the following round.':p.phase==='attached'?': hull reached. Activate Hacking Bug to begin AU upkeep.':': holding; shield barrier or target link unavailable.'));
        }else{const canDock=p.phase==='returning'&&present(owner)&&distances.hexDistance(p.position,position(room,owner.id))<1e-6;p.phase=canDock?'docked':'holding';p.destination=null;report(owner,p.name+(canDock?' returned to its launcher.':' reached its destination.'));}
      }
    }
    if(maintainRange(room))changed=true;reconcile(room);return changed;
  }
  function hit(room,id,damage){const e=entries(room).find(e=>e.probe.id===id&&active(e.probe));if(!e||damage<e.probe.threshold)return false;destroy(e.owner,e.probe,e.probe.name+' destroyed by enemy fire.');return true;}
  function nextEvent(room){return Math.min(Infinity,...entries(room).filter(e=>active(e.probe)).flatMap(({probe:p})=>[p.inhibitor==='arming'?p.inhibitorRemaining:Infinity,p.phase==='breaching'?p.breachRemaining:Infinity,p.bugActive?p.bugRemaining:Infinity,p.destination?12*distances.hexDistance(p.position,p.destination)/p.speed:Infinity]).filter(n=>n>1e-7));}
  return {destinationError,nearestInRange,maintainRange,state,active,entries,position,linked,reconcile,sources,inputSettings,command,rollSpec,resolveInput,advance,hit,moduleOn,payloadError,bugLink,warpBlocked,nextEvent};
}));
