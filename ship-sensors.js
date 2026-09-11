(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./ship-map-core') : root.SAShipMap,
    node ? require('./station-access') : root.SAStationAccess,
    node ? require('./ship-distances') : root.SAShipDistances,
    node ? require('./delay-rules') : root.SADelayRules,
    node ? require('./ship-cooperation') : root.SAShipCooperation);
  if (node) module.exports = api;
  if (root) root.SAShipSensors = api;
}(typeof window !== 'undefined' ? window : null, function(maps, stations, distances, delays, cooperation) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const down = item => item.impaired || item.status === 'impaired';
  function installed(ship) {
    const data = ship.ship || ship, ids = new Set((data.placements || []).map(p => p.sicId));
    const item = (data.sicInventory || []).find(i => ids.has(i.id) && stations.online(i) && maps.definition(i.type).sensor);
    if (!item) return null;
    const definition = maps.definition(item.type);
    return { item, definition, range:down(item) ? definition.impairedRange : definition.range,
      dice:Array(definition.diceCount).fill(down(item) ? definition.impairedDie : definition.die) };
  }
  function inputSettings(ship) {
    const tier = installed(ship)?.definition.tier || 1;
    const factors = { Situation:0, Execution:0, Quality:Math.min(4, Math.ceil(tier / 2)), Performance:0, Efficiency:0, Ingenuity:0 };
    const settings = { base:8, factors };
    return { ...settings, rate:delays.calculate(settings).rate };
  }
  function masking(room, ship) {
    // A disclosed demo scenario modifier creates an unknown contact without changing real ship rules.
    return room.showcase && Number.isFinite(ship.sensorScenarioMasking) ? ship.sensorScenarioMasking : maps.masking(ship);
  }
  const rangeAgainst = (room, observer, target) => (installed(observer)?.range || 0) * (masking(room,target) <= 0 ? 2 : 1);
  function knowledge(ship) { return ship.sensorState ||= { contacts:{}, reports:[], failures:{}, receipts:[] }; }
  function point(room, id) { return distances.positions(room.starships,room.shipPositions).find(p => p.id === id); }
  function approximate(position) {
    // A fixed sector center prevents repeated passive polling from triangulating a moving target.
    return { q:Math.round(position.q / 5) * 5, r:Math.round(position.r / 5) * 5 };
  }
  function detect(room, observer, target) {
    const state = knowledge(observer);
    if(state.contacts[target.id]?.level!=='detected')report(observer,{detected:true,targetId:target.id,text:`${target.title}${target.ship.class?` Class ${target.ship.class}`:''} Starship detected. Affiliation: ${target.ship.affiliation||'Unknown'}`});
    return state.contacts[target.id] = { ...state.contacts[target.id],uncertainty:undefined,id:target.id, level:'detected', title:target.title,
      position:point(room,target.id), size:(target.ship.gridCells || []).length,
      faction:target.ship.affiliation || '', nature:'Starship' };
  }
  function refresh(room) {
    room.sensorMode ||= (room.starships || []).some(ship => (ship.ship?.sicInventory || []).some(item => maps.definition(item.type).sensor));
    for (const observer of room.starships || []) {
      const state = knowledge(observer), sensor = installed(observer);
      for (const id of Object.keys(state.contacts)) if (!room.starships.some(s => s.id === id)) delete state.contacts[id];
      for (const target of room.starships) {
        if (target.id === observer.id) continue;
        const distance = distances.hexDistance(point(room,observer.id),point(room,target.id));
        const range = rangeAgainst(room,observer,target), contact = state.contacts[target.id];
        if (contact?.level === 'detected' && sensor && distance <= range * 2) { detect(room,observer,target); continue; }
        if (contact) delete state.contacts[target.id];
        if (!sensor || distance > range) continue;
        const mask = masking(room,target);
        if (mask <= 10) detect(room,observer,target);
        else if (mask <= 30) state.contacts[target.id] = { id:target.id,level:'unknown',title:'Unknown contact',position:approximate(point(room,target.id)),uncertainty:5 };
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
  function queue(room, unit, body) {
    const access = stations.access(room,unit,body.sicId);
    if (!access || access.kind !== 'sensor') return { ok:false,error:'Use Sensors from an operational cockpit or bridge.' };
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
    if (['hex','life','lifeArea'].includes(body.kind) && (!body.hex || ![body.hex.q,body.hex.r].every(Number.isInteger) ||
      distances.hexDistance(point(room,access.ship.id),body.hex) > installed(access.ship).range)) return {ok:false,error:'Choose a hex within sensor range.'};
    const settings = inputSettings(access.ship);
    unit.delayedAction = {id:`sensor-${receipt}`,kind:'action',label:({area:'Scan Area',hex:'Scan Hex',analysis:'Systems Analysis',life:'Life Scan',lifeArea:'Life Scan Area',share:'Share Data'})[body.kind],
      rate:settings.rate,remaining:100,total:100,consumeTurn:true,resolving:false,settings,
      sensorOrder:{shipId:access.ship.id,sicId:access.id,station:access.seat.key,kind:body.kind,targetId:target?.id,targetIds:recipients,area,hex:['hex','life','lifeArea'].includes(body.kind) ? copy(body.hex) : null}};
    state.receipts = [...state.receipts,receipt].slice(-256);
    return {ok:true,ship:access.ship};
  }
  function report(ship, entry) {
    const state = knowledge(ship);
    state.reports = [{...entry,at:new Date().toISOString()},...state.reports].slice(0,30);
  }
  function resolveInput(room, unit, rollDie) {
    const order = unit.delayedAction?.sensorOrder;
    if (!order) return;
    unit.delayedAction = null;
    const access = stations.access(room,unit,order.sicId), observer = room.starships.find(s => s.id === order.shipId);
    if (!access || access.ship.id !== order.shipId || access.seat.key !== order.station) {
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
      Object.assign(other.contacts,copy(state.contacts)); delete other.contacts[recipient.id];
      detect(room,recipient,observer);
      other.reports = [...state.reports.map(r => ({...copy(r),sharedBy:observer.title})),...other.reports].slice(0,30);
      delivered++;
      }
      report(observer,{text:`Sensor data transmitted to ${delivered} ship${delivered === 1 ? '' : 's'}.`}); return;
    }
    if (order.kind === 'life' || order.kind === 'lifeArea') {
      if(!order.hex||distances.hexDistance(point(room,observer.id),order.hex)>sensor.range){report(observer,{text:'Life Scan cancelled: hex is outside sensor range.'});return;}
      const rounded=p=>{let q=Math.round(p.q),r=Math.round(p.r),s=Math.round(-p.q-p.r);const a=Math.abs(q-p.q),b=Math.abs(r-p.r),c=Math.abs(s+p.q+p.r);if(a>b&&a>c)q=-r-s;else if(b>c)r=-q-s;return {q,r};};
      const targets=new Set(room.starships.filter(s=>s.id!==observer.id&&distances.hexDistance(rounded(point(room,s.id)),order.hex)===0).map(s=>s.id));
      const count=room.units.filter(u=>targets.has(u.location?.starshipId)&&String(u.raceId||u.race||'').toLowerCase()!=='android').length;
      report(observer,{text:`Life Scan at ${order.hex.q}, ${order.hex.r}: ${count} lifeform${count===1?'':'s'} detected. Scanning ship excluded.`,lifeScan:true,count,hex:copy(order.hex)});return;
    }
    const {values,total:rolledTotal} = cooperation.roll(room,observer,unit,order.kind,sensor.dice,skill(unit),rollDie,fusedTotal);
    const total=rolledTotal+(order.kind==='analysis'?(rollDie.retryBonus??state.failures[target.id]??0):0);
    if (order.kind === 'analysis') {
      const difficulty = target.commandSystems?.evasions?.[0]?.defense ?? (Number.isFinite(target.ship.defenseScore) ? target.ship.defenseScore : masking(room,target));
      const penalty = state.failures[target.id] || 0;
      if (total < difficulty) {
        state.failures[target.id] = penalty+1;
        state.contacts[target.id].analysisLowerBound=Math.max(state.contacts[target.id].analysisLowerBound||0,total);
        report(observer,{text:`Systems Analysis of ${target.title} failed. Next attempt roll +${penalty+1}.`,values,total});
      } else {
        state.failures[target.id] = 0;
        state.contacts[target.id].masking=masking(room,target);
        state.contacts[target.id].analysisDifficulty=difficulty;
        unit.queuedEffects ||= [];
        unit.queuedEffects.push({id:`analysis-${unit.id}-${Date.now()}`,label:'Systems Analysis',progress:0,rate:100/12,resolving:false,sensorReport:{shipId:observer.id,targetId:target.id,values,total}});
        report(observer,{text:`Systems Analysis of ${target.title}: processing (12 combat seconds).`,values,total});
      }
      return;
    }
    if (order.kind === 'hex' && distances.hexDistance(point(room,observer.id),order.hex) > sensor.range) {
      report(observer,{text:'Chosen hex moved outside sensor range.'}); return;
    }
    let found = 0;
    for (const other of room.starships) {
      if (other.id === observer.id) continue;
      const distance = distances.hexDistance(point(room,observer.id),point(room,other.id)), range = rangeAgainst(room,observer,other);
      if (distance > range) continue;
      const offset = order.hex ? distances.hexDistance(order.hex,point(room,other.id)) : 0;
      const difficulty = masking(room,other) + (order.hex ? -10 + Math.ceil(offset)*2 : 0);
      const proximity = order.hex ? 0 : Math.floor(range-distance+1e-8);
      if (total+proximity >= difficulty) { detect(room,observer,other).masking=masking(room,other); found++; }
      else if(state.contacts[other.id]){state.contacts[other.id].scanLowerBound=Math.max(state.contacts[other.id].scanLowerBound||0,total);}
    }
    report(observer,{text:`${order.kind === 'hex' ? 'Hex' : 'Area'} scan complete: ${found?`${found} contact${found===1?'':'s'} detected`:'no additional contacts detected'}.`,values,total});
  }
  function resolveReport(room, unit, effect) {
    const order = effect.sensorReport, observer = room.starships.find(s => s.id === order.shipId), target = room.starships.find(s => s.id === order.targetId);
    unit.queuedEffects = unit.queuedEffects.filter(e => e.id !== effect.id);
    if (!observer || !target) return;
    const ids = new Set(target.ship.placements.map(p => p.sicId));
    const layout={gridCells:copy(target.ship.gridCells),placements:copy(target.ship.placements),doorStates:{},sicInventory:target.ship.sicInventory.filter(i=>ids.has(i.id)).map(i=>({id:i.id,type:i.type,rotation:i.rotation,stationLayout:i.stationLayout,disabled:Boolean(i.disabled),status:i.status}))};
    report(observer,{text:`Systems Analysis: ${target.title}`,targetId:target.id,analysis:true,layout,values:order.values,total:order.total,
      hull:{current:target.currentHullHp,maximum:target.maximumHullHp},shield:{current:target.currentShieldHp,maximum:target.maximumShieldHp},
      components:target.ship.sicInventory.filter(i => ids.has(i.id) && stations.online(i)).map(i => ({type:i.type,name:maps.definition(i.type).name || i.type}))});
  }
  function view(state, observerId) {
    if(observerId&&state.sensorObserverId===observerId)return state;
    const observer = state.starships.find(s => s.id === observerId), data = observer?.sensorState;
    const contacts = data?.contacts || {}, own = observer ? [copy(observer)] : [];
    const positions = (state.shipPositions || []).filter(p => p.id === observerId);
    for (const contact of Object.values(contacts)) {
      // Contacts contain intelligence only, never enemy inventories, layout, movement orders or crew.
      const analysis=data.reports.find(r=>r.analysis&&r.targetId===contact.id&&r.layout);
      own.push({id:contact.id,title:contact.title,contactOnly:!analysis,analyzedContact:Boolean(analysis),currentHullHp:analysis?.hull.current,maximumHullHp:analysis?.hull.maximum,currentShieldHp:analysis?.shield.current,maximumShieldHp:analysis?.shield.maximum,contactLevel:contact.level,uncertainty:contact.uncertainty,
        ship:analysis?copy(analysis.layout):{gridCells:[],placements:[],sicInventory:[],doorStates:{}},contact:copy(contact)});
      positions.push({...contact.position,id:contact.id});
    }
    const units = state.units.filter(u => u.location?.starshipId === observerId);
    const visibleIds=new Set(units.map(u=>u.id));
    const allocated=new Map();
    for(const ship of own.filter(s=>s.analyzedContact)){
      const p=point(state,ship.id),reading=data.reports.find(r=>r.lifeScan&&r.hex&&distances.hexDistance(r.hex,p)<.01);
      if(!reading)continue;
      const key=reading.at+JSON.stringify(reading.hex),remaining=Math.max(0,reading.count-(allocated.get(key)||0));
      const crew=state.units.filter(u=>u.location?.starshipId===ship.id&&String(u.raceId||u.race||'').toLowerCase()!=='android').slice(0,remaining);
      allocated.set(key,(allocated.get(key)||0)+crew.length);
      crew.forEach((u,i)=>units.push({id:`anonymous-${ship.id}-${i+1}`,characterName:`Lifeform ${i+1}`,playerName:'Unknown',team:'npc',anonymous:true,atb:u.atb,speed:u.speed,color:u.color,location:{starshipId:ship.id},queuedEffects:[]}));
    }
    const ids = new Set(units.map(u => u.id));
    return {...state,starships:own,shipPositions:positions,shipDistances:distances.fromPositions(own,positions),units,
      activeId:visibleIds.has(state.activeId) ? state.activeId : null,hiddenActiveTurn:Boolean(state.activeId&&!visibleIds.has(state.activeId)),
      activeAction:ids.has(state.activeAction?.unitId) ? state.activeAction : null,
      command:ids.has(state.command?.unitId) ? state.command : null,
      delayRequest:ids.has(state.delayRequest?.unitId) ? state.delayRequest : null,
      attackResolution:state.attackResolution && ids.has(state.attackResolution.attackerId) ? state.attackResolution : null,
      itemResolution:state.itemResolution && ids.has(state.itemResolution.healerId) ? state.itemResolution : null,
      vehicles:[],areaEffects:[],lastInterruptedId:null,
      log:state.log.filter(e => e.starshipId === observerId),sensorObserverId:observerId || null};
  }
  function difficulty(state,shipId,kind,targetId,hex){
    const ship=state.starships.find(s=>s.id===shipId),contact=ship?.sensorState?.contacts?.[targetId];
    let value=null;
    if(kind==='analysis'&&Number.isFinite(contact?.analysisDifficulty))value=contact.analysisDifficulty;
    else if(kind!=='analysis'&&Number.isFinite(contact?.masking)){
      const origin=point(state,shipId),range=(installed(ship)?.range||0)*(contact.masking<=0?2:1);
      value=kind==='hex'&&hex?contact.masking-10+Math.ceil(distances.hexDistance(hex,contact.position))*2:contact.masking-Math.floor(range-distances.hexDistance(origin,contact.position)+1e-8);
    }
    const lower=kind==='analysis'?contact?.analysisLowerBound:contact?.scanLowerBound;
    return {value,label:Number.isFinite(value)?`Difficulty ${value}`:Number.isFinite(lower)?`Difficulty at least ${lower}`:'Difficulty unknown'};
  }
  return {installed,inputSettings,masking,rangeAgainst,refresh,fusedTotal,skill,queue,resolveInput,resolveReport,view,knowledge,difficulty};
}));
