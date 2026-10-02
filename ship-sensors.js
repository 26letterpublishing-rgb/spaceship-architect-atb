(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./ship-map-core') : root.SAShipMap,
    node ? require('./station-access') : root.SAStationAccess,
    node ? require('./ship-distances') : root.SAShipDistances,
    node ? require('./delay-rules') : root.SADelayRules,
    node ? require('./ship-cooperation') : root.SAShipCooperation,
    node ? require('./ship-targets') : root.SAShipTargets,
    node ? require('./health-display') : root.SAHealthDisplay);
  if (node) module.exports = api;
  if (root) root.SAShipSensors = api;
}(typeof window !== 'undefined' ? window : null, function(maps, stations, distances, delays, cooperation, targets, health) {
  const copy = value => JSON.parse(JSON.stringify(value));
  function installed(ship) {
    const data = ship.ship || ship, ids = new Set((data.placements || []).map(p => p.sicId));
    const item = (data.sicInventory || []).find(i => ids.has(i.id) && stations.online(i) && maps.definition(i.type).sensor);
    if (!item) return null;
    const definition = maps.definition(item.type);
    return {item,definition,...maps.sensorStats(ship)};
  }
  function inputSettings(ship) {
    const tier = installed(ship)?.definition.tier || 1;
    const factors = { Situation:0, Execution:0, Quality:Math.min(4, Math.ceil(tier / 2)), Performance:0, Efficiency:0, Ingenuity:0 };
    const settings = { base:8, factors };
    return { ...settings, rate:delays.calculate(settings).rate };
  }
  function webMasking(room,observer,target){
    if(!observer)return 0;const a=point(room,observer.id),b=point(room,target.id);if(!a||!b)return 0;
    let bonus=0;
    for(const web of targets.flights(room).filter(m=>m.phase==='web')){
      const within=p=>distances.hexDistance(distances.roundHex(p),distances.roundHex(web.position))<=1;
      if(within(a)||within(b)){bonus=Math.max(bonus,12);continue;}
      const steps=Math.max(1,Math.ceil(distances.hexDistance(a,b)*4));
      for(let n=1;n<steps;n++)if(within({q:a.q+(b.q-a.q)*n/steps,r:a.r+(b.r-a.r)*n/steps})){bonus=Math.max(bonus,6);break;}
    }return bonus;
  }
  function masking(room, ship, observer) {
    const interference=webMasking(room,observer,ship);
    if(ship.ship?.cleanserState?.phase==='charging')return interference;
    if(ship?.isMissile||ship?.isDrone||ship?.isProbe)return ship.defenseScore+interference;
    // A disclosed demo scenario modifier creates an unknown contact without changing real ship rules.
    return interference+(room.showcase && Number.isFinite(ship.sensorScenarioMasking) ? ship.sensorScenarioMasking : maps.masking(ship));
  }
  const rangeAgainst = (room, observer, target) => (installed(observer)?.range || 0) * (masking(room,target,observer) <= 0 ? 2 : 1);
  const scanRangeAgainst=(room,observer,target)=>rangeAgainst(room,observer,target)*1.5;
  const pulseRange=ship=>(installed(ship)?.range||0)*(ship.sensorState?.pulse?.remaining>0?1.5:1);
  const nextEvent=room=>Math.min(Infinity,...(room.starships||[]).map(s=>s.sensorState?.pulse?.remaining>0?s.sensorState.pulse.remaining:Infinity));
  function pulseScan(room,observer){
    const pulse=observer.sensorState?.pulse;if(!(pulse?.remaining>0)||!installed(observer))return 0;let found=0;
    for(const target of targets.all(room)){
      if(target.id===observer.id||target.escapedAt||target.ship.warpState?.phase==='traveling')continue;
      const distance=distances.hexDistance(point(room,observer.id),point(room,target.id)),range=scanRangeAgainst(room,observer,target);
      if(distance<=range&&pulse.total+Math.floor(range-distance+1e-8)>=masking(room,target,observer)){detect(room,observer,target).masking=masking(room,target,observer);found++;}
    }return found;
  }
  function defense(room,ship) {
    return Math.max(masking(room,ship),...(ship.commandSystems?.evasions||[]).filter(e=>e.remaining==null||e.remaining>0).map(e=>e.defense));
  }
  function knowledge(ship) {
    const state = ship.sensorState ||= {};
    state.contacts ||= {}; state.reports ||= []; state.failures ||= {}; state.receipts ||= [];
    state.analyses ||= {};
    // Intelligence survives feed truncation. Also migrate older encounter saves.
    for (const entry of state.reports) if (entry.analysis && entry.targetId) {
      const previous = state.analyses[entry.targetId];
      if (!previous || (entry.at && entry.at > (previous.at || ''))) state.analyses[entry.targetId] = copy(entry);
    }
    return state;
  }
  function analysis(ship, targetId) { return ship ? knowledge(ship).analyses[targetId] || null : null; }
  function point(room, id) { return targets.point(room,id); }
  function approximate(position) {
    // A fixed sector center prevents repeated passive polling from triangulating a moving target.
    return { q:Math.round(position.q / 5) * 5, r:Math.round(position.r / 5) * 5 };
  }
  function sweepState(room, observer) {
    const state = knowledge(observer), position = point(room, observer.id);
    const sweep = state.sweep ||= {elapsed:0, bonus:0, origin:{q:position.q,r:position.r}, serial:0};
    if (distances.hexDistance(position, sweep.origin) > 1e-8) {
      sweep.bonus = 0;
      sweep.origin = {q:position.q,r:position.r};
    }
    return sweep;
  }
  function advance(room, seconds, randomInt) {
    if (!(seconds > 0)) return;
    const pick = randomInt || (limit => Math.floor(Math.random()*limit));
    // Hex offsets guarantee the true object lies inside the displayed ten-unit area.
    const offsets = [];
    for (let q=-10;q<=10;q++) for (let r=-10;r<=10;r++) if (Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=10) offsets.push({q,r});
    for (const observer of room.starships || []) {
      const sweep = sweepState(room,observer), sensor = installed(observer);
      if (!sensor || observer.destroyedAt || observer.escapedAt || observer.ship.warpState?.phase==='traveling') { sweep.elapsed=0; delete knowledge(observer).pulse; continue; }
      const pulse=observer.sensorState?.pulse;if(pulse?.remaining>0){pulseScan(room,observer);pulse.remaining=Math.max(0,pulse.remaining-seconds);if(pulse.remaining<=1e-8)delete observer.sensorState.pulse;}
      sweep.elapsed += seconds;
      while (sweep.elapsed >= 12-1e-8) {
        sweep.elapsed = Math.max(0,sweep.elapsed-12);
        for (const target of targets.all(room)) {
          const state=knowledge(observer), contact=state.contacts[target.id];
          if (target.id===observer.id || target.destroyedAt || target.escapedAt || target.ship.warpState?.phase==='traveling' || contact?.level==='detected' || contact?.level==='last-known' ||
              distances.hexDistance(point(room,observer.id),point(room,target.id))>sensor.range*2) continue;
          if (pick(4) >= Math.min(4,1+sweep.bonus)) continue;
          const offset=offsets[pick(offsets.length)], targetPoint=point(room,target.id);
          if(!contact)report(observer,{unknownDetected:true,targetId:`unknown-${observer.id}-${sweep.serial+1}`,text:'Unknown Object Detected!!'});
          state.contacts[target.id]={id:contact?.passive ? contact.id : `unknown-${observer.id}-${++sweep.serial}`,level:'unknown',title:'Unknown Object',
            position:{q:targetPoint.q+offset.q,r:targetPoint.r+offset.r},uncertainty:10,passive:true};
        }
      }
    }
  }
  const condition=(current,maximum)=>maximum>0?Math.round(Math.max(0,Math.min(maximum,current||0))/maximum*6):0;
  function analyzedShieldConditions(target,layout){
    const actual=new Map((target.ship.sicInventory||[]).map(item=>[item.id,item])),installed=new Set((target.ship.placements||[]).map(p=>p.sicId));
    // Analysis reveals a snapshot of the equipment. Later hidden additions cannot reveal their count.
    const sicInventory=(layout.sicInventory||[]).map(item=>{
      if(!maps.definition(item.type).shield)return item;
      const current=actual.get(item.id);
      return current&&installed.has(item.id)&&maps.definition(current.type).shield?current:{...item,disabled:true};
    });
    return health.shieldLayers({...target,ship:{...layout,sicInventory}}).map(layer=>condition(layer.current,layer.maximum));
  }
  function detect(room, observer, target) {
    const state = knowledge(observer);
    if(state.contacts[target.id]?.level!=='detected')report(observer,{detected:true,shipClass:target.ship.class||'Unknown',nature:target.isMine?'Mine':target.isProbe?'Probe':target.isFloatingBody?'Drifting character':target.isSalvageDrone?'Vulture Drone':target.isDrone?'Repair Drone':target.isMissile?'Missile':'Starship',targetId:target.id,text:`${target.title}${target.ship.class?` Class ${target.ship.class}`:''} ${target.isMine?'Mine':target.isProbe?'Probe':target.isFloatingBody?'Drifting character':target.isSalvageDrone?'Vulture Drone':target.isDrone?'Repair Drone':target.isMissile?'Missile':'Starship'} detected. Affiliation: ${target.ship.affiliation||'Unknown'}`});
    return state.contacts[target.id] = { ...state.contacts[target.id],uncertainty:undefined,id:target.id, level:'detected', title:target.title,
      mapColor:maps.shipColor(target),mapHeading:maps.shipHeading(target),mapPowered:target.navigation?.phase==='powered',cloaked:maps.cloaked(target),position:{...point(room,target.id)},hullCondition:condition(target.currentHullHp,target.maximumHullHp),shieldCondition:condition(target.currentShieldHp,target.maximumShieldHp), size:(target.ship.gridCells || []).length,
      shieldConditions:state.analyses[target.id]?.layout ? analyzedShieldConditions(target,state.analyses[target.id].layout) : undefined,
      faction:target.ship.affiliation || '', nature:target.isMine?'Mine':target.isProbe?'Probe':target.isFloatingBody?'Drifting character':target.isSalvageDrone?'Vulture Drone':target.isDrone?'Repair Drone':target.isMissile?'Missile':'Starship', isProbe:Boolean(target.isProbe),probeTier:target.probeTier,probeInhibitor:target.probeInhibitor,probeThreshold:target.isProbe?target.maximumHullHp:undefined,probeOwnerId:target.isProbe&&target.probeOwnerId===observer.id?observer.id:undefined,isFloatingBody:Boolean(target.isFloatingBody),isSalvageDrone:Boolean(target.isSalvageDrone),isDrone:Boolean(target.isDrone),droneTier:target.droneTier,droneSprite:target.droneSprite,droneThreshold:target.isDrone?target.maximumHullHp:undefined,droneOwnerId:target.isDrone&&target.droneOwnerId===observer.id?observer.id:undefined,isMine:Boolean(target.isMine),mineThreshold:target.mineThreshold,mineArt:target.mineArt,isMissile:Boolean(target.isMissile),uninterceptable:Boolean(target.uninterceptable),isTorpedo:Boolean(target.isTorpedo),missileHeading:target.missileHeading,missileSlot:target.missileSlot,missileSalvoSize:target.missileSalvoSize,missilePhase:target.missilePhase,missileSpeed:target.missileSpeed,missileEndedAt:target.missileEndedAt,destroyedAt:target.destroyedAt, defenseScore:defense(room,target), evasionRemaining:Math.max(0,...(target.commandSystems?.evasions||[]).map(e=>e.remaining??20)) };
  }
  function refresh(room) {
    room.sensorMode ||= (room.starships || []).some(ship => (ship.ship?.sicInventory || []).some(item => maps.definition(item.type).sensor));
    for (const observer of room.starships || []) {
      const state = knowledge(observer), sensor = installed(observer);
      sweepState(room,observer);
      for (const id of Object.keys(state.contacts)) if (!targets.find(room,id)) delete state.contacts[id];
      for (const target of targets.all(room)) {
        if((target.isProbe&&target.probeOwnerId===observer.id)||(target.isDrone&&target.droneOwnerId===observer.id)||(target.isMissile&&target.projectile?.sourceId===observer.id)){detect(room,observer,target);continue;}
        if (target.id === observer.id) continue;
        if(observer.escapedAt||target.escapedAt||observer.ship.warpState?.phase==='traveling'||target.ship.warpState?.phase==='traveling'){delete state.contacts[target.id];continue;}
        if(observer.lockState?.targets?.some(l=>l.sharedFrom&&l.targetId===target.id)){detect(room,observer,target);continue;}
        const sources=[{position:point(room,observer.id),range:state.pulse?.remaining>0?scanRangeAgainst(room,observer,target):rangeAgainst(room,observer,target)},...targets.probes(room).filter(p=>p.ownerId===observer.id&&p.linked&&!(target.isProbe&&target.probeOwnerId===observer.id)).map(p=>({position:p.position,range:(sensor?.range||0)*(masking(room,target,observer)<=0?2:1)}))];
        const nearest=sources.sort((a,b)=>(distances.hexDistance(a.position,point(room,target.id))-a.range)-(distances.hexDistance(b.position,point(room,target.id))-b.range))[0];
        const distance=distances.hexDistance(nearest.position,point(room,target.id)),range=nearest.range,contact=state.contacts[target.id];
        if (contact?.level === 'detected' && !(maps.cloaked(target)&&!contact.cloaked) && sensor && distance <= range) { detect(room,observer,target); continue; }
        if(contact?.level==='last-known'&&sensor&&distance<=range&&!(maps.cloaked(target)&&!contact.cloaked)){detect(room,observer,target);continue;}
        if(contact?.level==='detected'&&(!sensor||distance>range)){state.contacts[target.id]={...contact,level:'last-known',title:'Last Known Location',mapColor:'#ff575f',mapPowered:false,uncertainty:0};continue;}
        if(contact?.level==='last-known'&&(!sensor||distance>range))continue;
        if (contact?.passive && !(maps.cloaked(target)&&!contact.cloaked) && sensor && !target.destroyedAt && distance<=sensor.range*2 && !(distance<=range && masking(room,target,observer)<=10)) continue;
        if (contact) delete state.contacts[target.id];
        if (!sensor || distance > range) continue;
        const mask = masking(room,target,observer);
        if (mask <= 10) detect(room,observer,target);
        else if (mask <= 30) {state.contacts[target.id] = { id:target.id,level:'unknown',title:'Unknown Object',position:approximate(point(room,target.id)),uncertainty:5 };if(!contact)report(observer,{unknownDetected:true,targetId:target.id,text:'Unknown Object Detected!!'});}
      }
    }
  }
  function fusedTotal(values) {
    const counts = new Map(), pool = [];
    for (const value of values) counts.set(value,(counts.get(value)||0)+1);
    for (const [value,count] of counts) {
      for (let i=0;i<Math.floor(count/2);i++) pool.push(value*2);
      if (count%2) pool.push(value);
    }
    return pool.sort((a,b) => b-a).slice(0,2).reduce((sum,n) => sum+n,0);
  }
  function skill(unit) {
    return Math.max(0,Number(unit.sensorSkill ?? (unit.team === 'npc' ? unit.mentalSkill : 0)) || 0);
  }
  function scanBounds(room,unit,order){
    const ship=room.starships.find(s=>s.id===order.shipId),sensor=ship&&installed(ship);
    if(!sensor)return {minimum:0,maximum:0};
    const matching=(ship.commandSystems?.preparations||[]).filter(p=>p.action===order.kind&&p.remaining>0);
    const teams=matching.filter(p=>p.kind==='team'&&p.unitId!==unit.id&&room.units.some(u=>u.id===p.unitId&&!u.defeatedAt));
    const bonus=Math.max(skill(unit),...teams.map(p=>p.skill))+matching.filter(p=>p.kind==='calculation').length*2+(teams.length?teams.length+1:0)+(order.kind==='analysis'?(ship.sensorState?.failures?.[order.targetId]||0):0);
    // Conservative bounds: never roll when neither success nor failure can change.
    const maximum=Math.min(4,(unit.shipAi?4:sensor.dice.length)*(teams.length+1))*(unit.shipAi?6:Math.max(...sensor.dice))+bonus;
    const minimum=Math.min(4,(unit.shipAi?4:sensor.dice.length)*(teams.length+1))+bonus;
    return {minimum,maximum};
  }
  function automaticScan(room,unit,order){
    if(typeof window==='undefined'&&require('./ship-illusions').scanned(room,order).length)return null;
    if(['life','lifeArea'].includes(order?.kind))return outsideHex(room,order)?null:[];
    if(!['area','hex','analysis'].includes(order?.kind))return null;
    const ship=room.starships.find(s=>s.id===order.shipId),sensor=ship&&installed(ship);if(!sensor)return [];
    const {minimum,maximum}=scanBounds(room,unit,order);
    if(order.kind==='analysis'){
      const target=room.starships.find(s=>s.id===order.targetId);
      if(!target)return {success:false};
      const required=defense(room,target);
      return required<=minimum?{success:true}:required>maximum?{success:false}:null;
    }
    const detected=[];
    for (const target of targets.all(room)) {
      if(target.id===ship.id)continue;
      const distance=distances.hexDistance(point(room,ship.id),point(room,target.id)),range=order.kind==='area'?scanRangeAgainst(room,ship,target):rangeAgainst(room,ship,target);
      if(order.hex?distances.hexDistance(order.hex,point(room,target.id))>1:distance>range)continue;
      const difficulty=masking(room,target,ship)+(order.hex?-10+Math.ceil(distances.hexDistance(order.hex,point(room,target.id)))*2+(outsideHex(room,order)?5:0):-Math.floor(range-distance+1e-8));
      if(difficulty<=minimum)detected.push(target);
      else if(difficulty<=maximum)return null;
    }
    return detected;
  }
  function outsideHex(room,order){const ship=room.starships.find(s=>s.id===order?.shipId);return Boolean(ship&&order.hex&&distances.hexDistance(point(room,ship.id),order.hex)>(installed(ship)?.range||0));}
  function scanChecks(room,order){
    if(typeof window==='undefined'&&require('./ship-illusions').scanned(room,order).length)return [];
    const ship=room.starships.find(s=>s.id===order?.shipId);if(!ship)return [];
    if(['life','lifeArea'].includes(order.kind))return outsideHex(room,order)?[{difficulty:15}]:[];
    if(order.kind==='analysis'){const target=targets.find(room,order.targetId);return target?[{targetId:target.id,difficulty:defense(room,target)}]:[];}
    return targets.all(room).filter(t=>t.id!==ship.id&&!t.escapedAt&&t.ship?.warpState?.phase!=='traveling').flatMap(t=>{
      const distance=distances.hexDistance(point(room,ship.id),point(room,t.id)),range=scanRangeAgainst(room,ship,t),offset=order.hex?distances.hexDistance(order.hex,point(room,t.id)):0;
      if(order.hex?offset>1:distance>range)return [];
      return [{targetId:t.id,difficulty:masking(room,t)+(order.hex?-10+Math.ceil(offset)*2+(outsideHex(room,order)?5:0):-Math.floor(range-distance+1e-8))}];
    });
  }
  function timingDifficulty(room,order,total){const checks=scanChecks(room,order),success=checks.filter(c=>total>=c.difficulty);return success.length?Math.max(...success.map(c=>c.difficulty)):checks.length?Math.min(...checks.map(c=>c.difficulty)):null;}
  function queue(room, unit, body) {
    const access = stations.access(room,unit,body.sicId);
    if (!access || access.blocked || access.kind !== 'sensor') return { ok:false,error:'Use Sensors from an available cockpit or bridge.' };
    const state = knowledge(access.ship), receipt = String(body.requestId || '');
    if (!/^[\w-]{8,100}$/.test(receipt)) return {ok:false,error:'Invalid sensor command receipt.'};
    if (state.receipts.includes(receipt)) return {ok:true,duplicate:true};
    if (room.starships.some(ship => ship.auCommands?.some(command => command.unitId === unit.id)))
      return {ok:false,error:'Finish the pending AU command first.'};
    if (room.activeId !== unit.id || unit.delayedAction || unit.delayTimer || unit.timedAction || unit.shieldRestabilizing || unit.consoleHold)
      return {ok:false,error:'Wait for your turn and finish the current action.'};
    if (!['area','hex','analysis','life','lifeArea','share'].includes(body.kind)) return {ok:false,error:'Choose a sensor operation.'};
    const area = String(body.area || '').trim().slice(0,160);
    refresh(room);
    const target = room.starships.find(s => s.id === body.targetId && s.id !== access.ship.id);
    const recipients = body.kind === 'share' ? (Array.isArray(body.targetIds) ? [...new Set(body.targetIds)] : [body.targetId]) : [];
    if (body.kind === 'share' && (!recipients.length || recipients.length > 5 || recipients.some(id => {
      const recipient = room.starships.find(s => s.id === id && s.id !== access.ship.id);
      return !recipient || state.contacts[id]?.level !== 'detected' || distances.hexDistance(point(room,access.ship.id),point(room,id)) > rangeAgainst(room,access.ship,recipient);
    }))) return {ok:false,error:'Choose recipients detected within sensor range.'};
    if (body.kind==='analysis' && (!target || state.contacts[target.id]?.level !== 'detected' ||
      distances.hexDistance(point(room,access.ship.id),point(room,target.id)) > rangeAgainst(room,access.ship,target)))
      return {ok:false,error:'Select a detected ship within sensor range.'};
    if (['hex','life','lifeArea'].includes(body.kind) && (!body.hex || ![body.hex.q,body.hex.r].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000))) return {ok:false,error:'Choose a valid hex.'};

    const settings = inputSettings(access.ship);
    unit.delayedAction = {id:`sensor-${receipt}`,kind:'action',label:({area:'Scan Area',hex:'Scan Hex',analysis:'Systems Analysis',life:'Life Scan',lifeArea:'Life Scan Area',share:'Share Data'})[body.kind],
      rate:settings.rate,remaining:100,total:100,consumeTurn:true,resolving:false,settings,
      sensorOrder:{shipId:access.ship.id,sicId:access.id,station:access.seat.key,kind:body.kind,targetId:target?.id,targetIds:recipients,area,scanOrigin:copy(point(room,access.ship.id)),hex:['hex','life','lifeArea'].includes(body.kind) ? copy(body.hex) : null}};
    state.receipts = [...state.receipts,receipt].slice(-256);
    return {ok:true,ship:access.ship};
  }
  function report(ship, entry) {
    const state = knowledge(ship);
    const complete = {...entry,at:new Date().toISOString()};
    if (complete.analysis && complete.targetId) state.analyses[complete.targetId] = copy(complete);
    state.reports = [complete,...state.reports].slice(0,30);
  }
  function resolveInput(room, unit, rollDie) {
    const order = unit.delayedAction?.sensorOrder;
    const rollController=unit.delayedAction?.rollController;
    if (!order) return;
    unit.delayedAction = null;
    const access = stations.access(room,unit,order.sicId), observer = room.starships.find(s => s.id === order.shipId);
    if (!access || access.blocked || access.ship.id !== order.shipId || access.seat.key !== order.station) {
      if (observer) report(observer,{text:'Sensor input interrupted: operator or system unavailable.'});
      return;
    }
    refresh(room);
    const sensor = installed(observer), state = knowledge(observer), target = room.starships.find(s => s.id === order.targetId);
    if (order.kind==='analysis' && (!target || state.contacts[target.id]?.level !== 'detected' ||
      distances.hexDistance(point(room,observer.id),point(room,target.id)) > rangeAgainst(room,observer,target))) {
      report(observer,{text:'Contact lost before sensor input finished.'}); return;
    }
    if (order.kind === 'share') {
      let delivered = 0;
      for (const id of order.targetIds || [order.targetId]) {
      const recipient = room.starships.find(s => s.id === id && s.id !== observer.id);
      if (!recipient || state.contacts[id]?.level !== 'detected' || distances.hexDistance(point(room,observer.id),point(room,id)) > rangeAgainst(room,observer,recipient)) continue;
      const other = knowledge(recipient);
      for (const [targetId, entry] of Object.entries(state.analyses)) {
        const previous = other.analyses[targetId];
        if (!previous || (entry.at || '') >= (previous.at || '')) other.analyses[targetId] = {...copy(entry),sharedBy:observer.title};
      }
      Object.assign(other.contacts,copy(state.contacts)); delete other.contacts[recipient.id];
      detect(room,recipient,observer);
      other.reports = [...state.reports.map(r => ({...copy(r),sharedBy:observer.title})),...other.reports].slice(0,30);
      delivered++;
      }
      report(observer,{text:`Sensor data transmitted to ${delivered} ship${delivered === 1 ? '' : 's'}.`}); return;
    }
    if (order.kind === 'life' || order.kind === 'lifeArea') {
      if(!order.hex)return;
      if(outsideHex(room,order)){const result=cooperation.roll(room,observer,unit,order.kind,sensor.dice,skill(unit),rollDie,fusedTotal);if(result.total<15){report(observer,{text:'Life Scan failed: difficulty 15. Unit outside of sensor range. Scan results may fail.',total:result.total,values:result.values});return;}}
      const rounded=p=>{let q=Math.round(p.q),r=Math.round(p.r),s=Math.round(-p.q-p.r);const a=Math.abs(q-p.q),b=Math.abs(r-p.r),c=Math.abs(s+p.q+p.r);if(a>b&&a>c)q=-r-s;else if(b>c)r=-q-s;return {q,r};};
      const targets=new Set(room.starships.filter(s=>s.id!==observer.id&&distances.hexDistance(rounded(point(room,s.id)),order.hex)<=1).map(s=>s.id));
      state.lifeScans||={};for(const targetId of targets)state.lifeScans[targetId]={at:new Date().toISOString(),afterAnalysis:Boolean(state.analyses[targetId])};
      const count=room.units.filter(u=>targets.has(u.location?.starshipId)&&!u.shipAi&&String(u.raceId||u.race||'').toLowerCase()!=='android').length;
      report(observer,{text:`Life Scan at ${order.hex.q}, ${order.hex.r}: ${count} lifeform${count===1?'':'s'} detected. Scanning ship excluded.`,lifeScan:true,count,hex:copy(order.hex)});return;
    }
    const automatic=Number.isFinite(rollDie?.submittedScore)?null:automaticScan(room,unit,order);
    const guaranteedMinimum=order.kind==='area'?scanBounds(room,unit,order).minimum:0;
    const {values,total:rolledTotal} = automatic===null ? cooperation.roll(room,observer,unit,order.kind,sensor.dice,skill(unit),rollDie,fusedTotal) : {values:[],total:0};
    const total=rolledTotal+(order.kind==='analysis'?(rollDie.retryBonus??state.failures[target.id]??0):0);
    if (order.kind === 'analysis') {
        const difficulty = defense(room,target);
      const penalty = state.failures[target.id] || 0;
      if (automatic ? !automatic.success : total < difficulty) {
        state.failures[target.id] = penalty+1;
        if(!automatic)state.contacts[target.id].analysisLowerBound=Math.max(state.contacts[target.id].analysisLowerBound||0,total);
        report(observer,{text:`Systems Analysis of ${target.title}: ${automatic?'insufficient sensor resolution':'check unsuccessful'}. Next attempt roll +${penalty+1}.`,...(!automatic?{values,total}:{automatic:true})});
      } else {
        state.failures[target.id] = 0;
        state.contacts[target.id].masking=masking(room,target,observer);
        state.contacts[target.id].analysisDifficulty=difficulty;
        unit.queuedEffects ||= [];
        const reportSeconds=Math.max(1,12-(installed(observer)?.definition.tier||1));
        unit.queuedEffects.push({id:`analysis-${unit.id}-${Date.now()}`,label:'Systems Analysis: processing report',rollController,progress:0,rate:100/(reportSeconds*(access.remote?1:.9)),localInputBonus:true,resolving:false,sensorReport:{shipId:observer.id,targetId:target.id,...(!automatic?{values,total}:{automatic:true})}});
        report(observer,{text:`Systems Analysis of ${target.title}: processing (${reportSeconds} combat seconds).`,...(!automatic?{values,total}:{automatic:true})});
      }
      return;
    }
    let found = 0;
    if (order.kind === 'area') {
      const sweep=sweepState(room,observer);
      if(!order.scanOrigin||distances.hexDistance(order.scanOrigin,point(room,observer.id))<=1e-8)sweep.bonus=Math.min(3,sweep.bonus+1);
      state.pulse={remaining:2,total:automatic===null?total:guaranteedMinimum};
    }
    for (const other of targets.all(room)) {
      if (other.id === observer.id) continue;
      const distance = distances.hexDistance(point(room,observer.id),point(room,other.id)), range = order.kind==='area'?scanRangeAgainst(room,observer,other):rangeAgainst(room,observer,other);
      if (!order.hex && distance > range) continue;
      const offset = order.hex ? distances.hexDistance(order.hex,point(room,other.id)) : 0;
      if(order.hex&&offset>1)continue;
      const difficulty = masking(room,other,observer) + (order.hex ? -10 + Math.ceil(offset)*2+(outsideHex(room,order)?5:0) : 0);
      const proximity = order.hex ? 0 : Math.floor(range-distance+1e-8);
      if (automatic===null ? total+proximity >= difficulty : automatic.some(s=>s.id===other.id)) { detect(room,observer,other).masking=masking(room,other,observer); found++; }
      else if(state.contacts[other.id]){state.contacts[other.id].scanLowerBound=Math.max(state.contacts[other.id].scanLowerBound||0,total);}
    }
    if(typeof window==='undefined')require('./ship-illusions').resolveScan(room,observer,order);
    const objectRefs=order.kind==='area'?(room.spaceObjects||[]).filter(o=>!o.collectedBy&&distances.hexDistance(point(room,observer.id),o)<=pulseRange(observer)+1e-8).map(o=>({id:o.id,label:o.name+(o.destroyedAt?' / Destroyed':'')})):[];
    const summary=found?`${order.kind === 'hex' ? 'Hex' : 'Area'} scan complete: ${found} contact${found===1?'':'s'} detected.`:'No contacts resolved in the scanned area. Unknown markers indicate approximate locations.';
    const scenery=order.kind==='area'?(objectRefs.length?' Objects within sensor range: '+objectRefs.map(o=>o.label).join(', ')+'.':' No map objects within sensor range.'):'';
    report(observer,{text:summary+scenery,objectRefs,...(automatic===null?{values,total}:{automatic:true})});
  }
  function resolveReport(room, unit, effect, screeningDie=()=>Math.floor(Math.random()*6)+1) {
    const order = effect.sensorReport, observer = room.starships.find(s => s.id === order.shipId), target = room.starships.find(s => s.id === order.targetId);
    unit.queuedEffects = unit.queuedEffects.filter(e => e.id !== effect.id);
    if (!observer || !target) return;
    const ids = new Set(target.ship.placements.map(p => p.sicId));
    const layout={zoneColumns:maps.gridColumns(target.ship),zoneRows:maps.gridRows(target.ship),thrusterDirection:target.ship.thrusterDirection??null,gridCells:copy(target.ship.gridCells),placements:copy(target.ship.placements),doorStates:{},sicInventory:target.ship.sicInventory.filter(i=>ids.has(i.id)).map(i=>({id:i.id,type:i.type,rotation:i.rotation,exteriorRotation:i.exteriorRotation,stationLayout:i.stationLayout,disabled:Boolean(i.disabled),status:i.status,impaired:Boolean(i.impaired),impairmentPoints:Number(i.impairmentPoints)||0}))};
    const known=knowledge(observer),previous=known.analyses[target.id],hidden=new Set();
    for(const item of maps.installedItems(target).filter(i=>i.type==='analysis-screening'&&maps.operational(i))){const host=maps.addonHost(target,item);if(!host||!maps.operational(host.item))continue;const value=screeningDie();if(value<=4)hidden.add(host.item.id);}
    const lastKnown=[];layout.screenedRooms=[];
    for(const hostId of hidden){const item=layout.sicInventory.find(i=>i.id===hostId),prior=previous?.layout?.sicInventory?.find(i=>i.id===hostId);if(!item)continue;
      const cells=maps.placementSquares(target.ship,item,target.ship.placements.find(p=>p.sicId===hostId));layout.screenedRooms.push({cells,lastKnown:Boolean(prior),name:prior?maps.definition(prior.type).name:'Unidentified SIC'});
      layout.sicInventory=layout.sicInventory.filter(i=>i.id!==hostId);layout.placements=layout.placements.filter(p=>p.sicId!==hostId);
      if(prior){layout.sicInventory.push(copy(prior));layout.placements.push(...copy(previous.layout.placements.filter(p=>p.sicId===hostId)));lastKnown.push(hostId);}
    }
    const detailed=Boolean(previous&&known.lifeScans?.[target.id]?.afterAnalysis),snapshot=detailed?{
      at:new Date().toISOString(),shipId:target.id,title:target.title,layout:copy(layout),
      hull:{current:target.currentHullHp,maximum:target.maximumHullHp},shield:{current:target.currentShieldHp,maximum:target.maximumShieldHp,layers:health.shieldLayers(target)},
      crew:room.units.filter(u=>u.location?.starshipId===target.id&&!u.shipAi&&String(u.raceId||u.race||'').toLowerCase()!=='android').map(u=>({id:u.id,name:u.characterName,color:u.color,location:copy(u.location),currentHp:u.currentHp,maximumHp:u.maximumHp})),
      stats:{moveSpeed:maps.propulsion(target).moveSpeed,masking:maps.masking(target),sensors:maps.sensorStats(target).range,defense:defense(room,target),au:copy(target.auState||{})},
    }:previous?.snapshot?copy(previous.snapshot):null;
    if(detailed){snapshot.layout.doorStates=copy(target.ship.doorStates||{});snapshot.layout.airlocks=copy(target.ship.airlocks||[]);snapshot.layout.airlockStates=copy(target.ship.airlockStates||{});snapshot.layout.atmosphereState=copy(target.ship.atmosphereState||{});snapshot.layout.breachState=copy(target.ship.breachState||{});
      for(const zone of snapshot.layout.screenedRooms){for(const square of zone.cells)delete snapshot.layout.atmosphereState.cells?.[square];for(const [id,h]of Object.entries(snapshot.layout.breachState.holes||{}))if(zone.cells.includes(h.square))delete snapshot.layout.breachState.holes[id];}
    }
    report(observer,{text:`Systems Analysis: ${target.title}${detailed?' — interior snapshot saved':''}`,targetId:target.id,analysis:true,layout,snapshot,lastKnown,values:order.values,total:order.total,
      hull:{current:target.currentHullHp,maximum:target.maximumHullHp},shield:{current:target.currentShieldHp,maximum:target.maximumShieldHp,layers:health.shieldLayers(target)},
      components:layout.sicInventory.filter(i=>stations.online(i)).map(i=>({type:i.type,name:(maps.definition(i.type).name||i.type)+(lastKnown.includes(i.id)?' (last known, unconfirmed)':'')}))});
  }
  function view(state, observerId) {
    if(observerId&&state.sensorObserverId===observerId)return state;
    const observer = state.starships.find(s => s.id === observerId), data = observer ? knowledge(observer) : null;
    const contacts = data?.contacts || {}, own = observer ? [copy(observer)] : [];
    const publicContact = contact => { const result=copy(contact);if(contact.level!=='detected'||!data?.analyses?.[contact.id]?.layout)delete result.shieldConditions;return result; };
    const positions = (state.shipPositions || []).filter(p => p.id === observerId);
    for (const contact of Object.values(contacts)) {
      // Contacts contain intelligence only, never enemy inventories, layout, movement orders or crew.
      const analysis=contact.level==='detected' && data.analyses[contact.id]?.layout ? data.analyses[contact.id] : null;
      own.push({id:contact.id,title:contact.title,size:contact.size,mapColor:contact.mapColor,mapHeading:contact.mapHeading,mapPowered:contact.mapPowered,isProbe:contact.isProbe,probeTier:contact.probeTier,probeInhibitor:contact.probeInhibitor,probeOwnerId:contact.probeOwnerId,probePosition:contact.isProbe?contact.position:undefined,isFloatingBody:contact.isFloatingBody,isSalvageDrone:contact.isSalvageDrone,isDrone:contact.isDrone,droneTier:contact.droneTier,droneSprite:contact.droneSprite,droneOwnerId:contact.droneOwnerId,dronePosition:contact.isDrone?contact.position:undefined,isMine:contact.isMine,mineThreshold:contact.mineThreshold,mineArt:contact.mineArt,isMissile:contact.isMissile,uninterceptable:contact.uninterceptable,isTorpedo:contact.isTorpedo,missilePosition:contact.isMissile?contact.position:undefined,missileHeading:contact.missileHeading,missileSlot:contact.missileSlot,missileSalvoSize:contact.missileSalvoSize,missilePhase:contact.missilePhase,missileSpeed:contact.missileSpeed,missileEndedAt:contact.missileEndedAt,destroyedAt:contact.destroyedAt,defenseScore:contact.defenseScore,evasionRemaining:contact.evasionRemaining,contactOnly:!analysis,analyzedContact:Boolean(analysis),currentHullHp:contact.isProbe?contact.probeThreshold:contact.isDrone?(contact.droneThreshold||14):contact.isMissile?1:contact.hullCondition,maximumHullHp:contact.isProbe?contact.probeThreshold:contact.isDrone?(contact.droneThreshold||14):contact.isMissile?1:6,currentShieldHp:contact.shieldCondition,maximumShieldHp:6,contactLevel:contact.level,uncertainty:contact.uncertainty,
        isCloaked:contact.level==='detected'&&Boolean(contact.cloaked),
        shieldConditions:analysis?copy(contact.shieldConditions||analysis.shield?.layers?.map(layer=>condition(layer.current,layer.maximum))||[]):undefined,
        ship:analysis?copy(analysis.layout):{gridCells:[],placements:[],sicInventory:[],doorStates:{}},contact:publicContact(contact)});
      positions.push({...contact.position,id:contact.id});
    }
    const units = state.units.filter(u => u.location?.starshipId === observerId || u.vacuum?.sourceShipId === observerId);
    const visibleIds=new Set(units.map(u=>u.id));
    const allocated=new Map();
    for(const ship of own.filter(s=>s.analyzedContact)){
      const p=point(state,ship.id),reading=data.reports.find(r=>r.lifeScan&&r.hex&&distances.hexDistance(r.hex,p)<.01);
      if(!reading)continue;
      ship.lifeScanKnown=true;
      const key=reading.at+JSON.stringify(reading.hex),remaining=Math.max(0,reading.count-(allocated.get(key)||0));
      const crew=state.units.filter(u=>u.location?.starshipId===ship.id&&!u.shipAi&&String(u.raceId||u.race||'').toLowerCase()!=='android').slice(0,remaining);
      allocated.set(key,(allocated.get(key)||0)+crew.length);
      crew.forEach((u,i)=>units.push({id:`anonymous-${ship.id}-${i+1}`,characterName:`Lifeform ${i+1}`,playerName:'Unknown',team:'npc',anonymous:true,atb:u.atb,speed:u.speed,color:u.color,location:{starshipId:ship.id},queuedEffects:[]}));
    }
    const ids = new Set(units.map(u => u.id));
    // The contact dictionary is keyed privately by target ID. Unknown pings must not reveal that association.
    if (own[0] && own[0].id===observerId && own[0].sensorState) own[0].sensorState.contacts=Object.fromEntries(Object.values(contacts).map(c=>[c.id,publicContact(c)]));
    return {...state,starships:own,shipPositions:positions,shipDistances:distances.fromPositions(own,positions),units,
      activeId:visibleIds.has(state.activeId) ? state.activeId : null,hiddenActiveTurn:Boolean(state.activeId&&!visibleIds.has(state.activeId)),
      activeAction:ids.has(state.activeAction?.unitId) ? state.activeAction : null,
      command:ids.has(state.command?.unitId) ? state.command : null,
      delayRequest:ids.has(state.delayRequest?.unitId) ? state.delayRequest : null,
      attackResolution:state.attackResolution && ids.has(state.attackResolution.attackerId) ? state.attackResolution : null,
      itemResolution:state.itemResolution && ids.has(state.itemResolution.healerId) ? state.itemResolution : null,
      vehicles:[],areaEffects:[],lastInterruptedId:ids.has(state.lastInterruptedId)?state.lastInterruptedId:null,
      log:state.log.filter(e => e.starshipId === observerId),sensorObserverId:observerId || null};
  }
  function difficulty(state,shipId,kind,targetId,hex){
    const ship=state.starships.find(s=>s.id===shipId),contact=ship?.sensorState?.contacts?.[targetId];
    let value=null;
    if(typeof window==='undefined'&&require('./ship-illusions').scanned(state,{shipId,kind,targetId,hex}).length)return {value:null,label:'Difficulty unknown'};
    if(kind==='life'||kind==='lifeArea')value=outsideHex(state,{shipId,hex})?15:0;
    else if(kind==='analysis'&&Number.isFinite(contact?.defenseScore))value=contact.defenseScore;
    else if(kind!=='analysis'&&Number.isFinite(contact?.masking)){
      const origin=point(state,shipId),range=(installed(ship)?.range||0)*(kind==='area'?1.5:1)*(contact.masking<=0?2:1);
      value=kind==='hex'&&hex?contact.masking-10+Math.ceil(distances.hexDistance(hex,contact.position))*2+(outsideHex(state,{shipId,hex})?5:0):contact.masking-Math.floor(range-distances.hexDistance(origin,contact.position)+1e-8);
    }
    const lower=kind==='analysis'?contact?.analysisLowerBound:contact?.scanLowerBound;
    return {value,label:Number.isFinite(value)?`Difficulty ${value}`:Number.isFinite(lower)?`Difficulty at least ${lower}`:'Difficulty unknown'};
  }
  return {detect,report,installed,inputSettings,pulseRange,nextEvent,masking,defense,rangeAgainst,refresh,advance,sweepState,fusedTotal,skill,automaticScan,scanChecks,timingDifficulty,outsideHex,queue,resolveInput,resolveReport,view,knowledge,analysis,difficulty};
}));
