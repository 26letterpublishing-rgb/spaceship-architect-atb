(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./ship-map-core') : root.SAShipMap,
    node ? require('./station-access') : root.SAStationAccess,
    node ? require('./ship-distances') : root.SAShipDistances,
    node ? require('./delay-rules') : root.SADelayRules,
    node ? require('./ship-power') : root.SAShipPower,
    node ? require('./ship-shields') : root.SAShipShields,
    node ? require('./ship-sensors') : root.SAShipSensors,
    node ? require('./ship-locks') : root.SAShipLocks,
    node ? require('./ship-targets') : root.SAShipTargets);
  if (node) module.exports = api;
  if (root) root.SAShipWeapons = api;
}(typeof window !== 'undefined' ? window : null, function(maps, stations, distances, delays, power, shields, sensors, locks, targets) {
  const skill = unit => Math.max(0, Number(unit.weaponSystemsSkill ?? (unit.team === 'npc' ? unit.mentalSkill : 0)) || 0);
  const bars = value => value >= 6 ? 4 : value >= 5 ? 3 : value >= 3 ? 2 : value >= 1 ? 1 : 0;
  function settings(unit, tier=1) {
    const value = {base:10, factors:{Situation:0, Execution:0, Quality:Math.min(4,tier), Performance:0, Efficiency:0, Ingenuity:bars(skill(unit))}};
    return {...value, rate:delays.calculate(value).rate};
  }
  const state = ship => ship.weaponState ||= {receipts:[], reports:[]};
  const railCannon = definition => definition.weaponFamily === 'ballistic-rail-cannon';
  const repeater = definition => definition.weaponFamily === 'ballistic-rail-repeater';
  const ballistic = definition => railCannon(definition)||repeater(definition);
  const shotName=order=>(order.weaponName||'Rapid Laser')+(order.burst?` (shot ${order.burst.shot}/${order.burst.total})`:'');
  function reflector(room,ship){
    if(!ship||ship.isMissile||power.output(ship,room.units).en<power.demand(ship))return null;
    return maps.installedItems(ship).filter(i=>i.type==='ripple-reflector'&&stations.online(i)&&ship.ship.fieldState?.systems?.[i.id]?.enabled!==false).sort((a,b)=>Number(Boolean(a.impaired||a.impairmentPoints))-Number(Boolean(b.impaired||b.impairmentPoints)))[0]||null;
  }
  const ironAmmo = ship => Number.isSafeInteger(ship.ship?.minerals?.Iron) && ship.ship.minerals.Iron > 0 ? ship.ship.minerals.Iron : 0;
  function shieldProtected(room, target) {
    shields.refresh(room);
    return target.currentShieldHp > 0;
  }
  const point = (room,id) => targets.point(room,id);
  function weaponLock(room,unit,ship,targetId,captured=false){
    if(!locks.locked(room,ship,targetId))return null;
    return controlledLocks(unit,ship,targetId,captured);
  }
  function controlledLocks(unit,ship,targetId,captured=false){
    const matching=locks.state(ship).targets.filter(l=>l.targetId===targetId&&(!l.controllerUnitId||l.controllerUnitId===unit.id)&&(!captured||ship.hackedSystems?.some(h=>(h.bridge||h.sicId===l.systemId)&&h.unitId===unit.id)));
    return matching.length?{...matching[0],sicIds:[...new Set(matching.flatMap(l=>locks.components(l)))]}:undefined;
  }
  function profile(definition, item, range, options={}) {
    const family=definition.weaponFamily||'rapid-laser', impaired=Boolean(item.impaired||item.status==='impaired');
    const boosts=Number(options.boosts||0),sacrifice=Number(options.sacrifice||0);
    const loss=definition.rangeStep?Math.floor(Math.max(0,range)/definition.rangeStep):0;
    if(definition.ionDisruptor)return {family,impaired:impaired||item.impairmentPoints>0,count:impaired||item.impairmentPoints>0?0:5,dieSides:10,bonus:0,cost:20,loss:0,boostAllowed:false};
    if(definition.devastation)return {family,impaired:impaired||item.impairmentPoints>0,count:impaired||item.impairmentPoints>0?0:10,dieSides:definition.damageDie,bonus:0,cost:0,loss:0,boostAllowed:false};
    if(repeater(definition))return {family,impaired:impaired||item.impairmentPoints>0,count:1,dieSides:impaired||item.impairmentPoints>0?6:10,bonus:0,cost:0,loss:0,boostAllowed:false};
    if(railCannon(definition)){
      const points=Math.max(0,Math.floor(Number(item.impairmentPoints)||0),impaired?1:0);
      return {family,impaired:points>0,count:Math.max(0,6-2*points),bonus:0,cost:0,loss:0,boostAllowed:false};
    }
    const count=family==='rapid-laser'?Math.max(0,(impaired?1:4)-sacrifice):family==='beam-laser'?(impaired?0:definition.damageCount)+boosts:family==='ripple-cannon'?Math.max(0,definition.damageCount+(impaired?0:boosts)-loss):Math.max(0,definition.damageCount-(impaired?1:0));
    return {family,impaired,count,bonus:family==='beam-laser'&&!impaired?definition.damageBonus||0:0,cost:family==='rapid-laser'?5-sacrifice:(definition.fireAu||0)+boosts*(definition.boostAu||0),loss,boostAllowed:Boolean(definition.boostAu)&&!(family==='ripple-cannon'&&impaired)};
  }
  function rollSpec(room, unit, order) {
    const ship = room.starships.find(s => s.id === order.shipId), target = targets.find(room,order.targetId);
    let sides = (unit.dexterityDice || []).filter(n => [4,6,8,10,12].includes(n));
    if (unit.classId === 'gunner' && unit.intellectDice?.length) sides = [...sides, Math.max(...unit.intellectDice)];
    if (unit.raceId === 'tamalori') sides = [...sides,...sides];
    if (unit.raceId === 'krax-gny-vtek' && unit.maximumHp-unit.currentHp >= 5) sides = sides.slice(0,3);
    const range = ship && target ? distances.hexDistance(point(room,ship.id),point(room,target.id)) : 0;
    const item=ship?.ship?.sicInventory?.find(i=>i.id===order.sicId),definition=maps.definition(item?.type);
    const rangeModifier=definition.rangeDefensePerUnit?0:definition.rangeStep?Math.floor(range/definition.rangeStep):-range;
    const bonus = Number((skill(unit) + (ship ? maps.propulsion(ship).hsm : 0) + rangeModifier).toFixed(6));
    // Projected contacts deliberately omit their live layout. Use their disclosed
    // Defense rather than recomputing Masking from an empty or analyzed snapshot.
    const targetDefense = target && (target.contactOnly || target.analyzedContact) && Number.isFinite(target.defenseScore) ? target.defenseScore : target ? sensors.defense(room,target) : null;
    const known = Number.isFinite(targetDefense) ? targetDefense+range*(definition.rangeDefensePerUnit||0) : null;
    return {sides, bonus, skill:'Weapon Systems', attributeKey:'dexterity', difficulty:Number.isFinite(known) ? known : null,
      difficultyLabel:Number.isFinite(known) ? `Meet or exceed Defense ${known}` : 'Unknown defense', range};
  }
  function queue(room, unit, body) {
    const access = stations.access(room,unit,body.sicId);
    if (!access || access.blocked || access.kind !== 'weapon') return {ok:false,error:'Operate this weapon from an available station or working cockpit or bridge.'};
    if(access.definition.missileLauncher)return require('./ship-missiles').queue(room,unit,body,settings(unit,access.definition.tier));
    const devastation=access.definition.devastation?require('./ship-devastation'):null;
    if(maps.cloaked(access.ship))return {ok:false,error:'Deactivate Cloaking before firing weapons.'};
    const data = state(access.ship), receipt = String(body.requestId || '');
    if (!/^[\w-]{8,100}$/.test(receipt)) return {ok:false,error:'Invalid firing receipt.'};
    if (data.receipts.includes(receipt)) return {ok:true,duplicate:true};
    if(access.definition.ionDisruptor&&access.ship.ship.fieldState?.systems?.[access.id]?.cooldown>0)return {ok:false,error:'Ion Disruptor cooling down: '+Math.ceil(access.ship.ship.fieldState.systems[access.id].cooldown)+' active seconds remaining.'};
    if(devastation){const why=devastation.reason(room,access.ship,access.item);if(why)return {ok:false,error:why};}
    if (room.activeId !== unit.id || unit.delayedAction || unit.delayTimer || unit.timedAction || unit.consoleHold || unit.shieldRestabilizing || room.starships.some(s => s.auCommands?.some(c => c.unitId === unit.id))) return {ok:false,error:'Wait for your turn and finish the current action.'};
    sensors.refresh(room);
    const target = targets.all(room).find(s => s.id === body.targetId && s.id !== access.ship.id);
    if (!target || (target.id!==access.controlSource?.id&&(access.controlSource||access.ship).sensorState?.contacts?.[target.id]?.level !== 'detected')) return {ok:false,error:'Select a detected starship other than the weapon\'s own ship.'};
    if(access.ship.escapedAt||target.escapedAt||access.ship.ship.warpState?.phase==='traveling'||target.ship.warpState?.phase==='traveling')return {ok:false,error:'A ship in warp is outside the battlefield.'};
    const rail=ballistic(access.definition),manualOnly=rail||access.definition.manualOnly;
    if (access.ship.currentHullHp <= 0 || target.currentHullHp <= 0 || (!rail&&power.output(access.ship,room.units).en < 1)) return {ok:false,error:'The ship or its power supply is unavailable.'};
    const sacrifice = Number(body.sacrifice || 0);
    if (!Number.isInteger(sacrifice) || sacrifice < 0 || sacrifice > 3) return {ok:false,error:'Choose zero to three sacrificed damage dice.'};
    const boosts=Number(body.boosts||0),range=distances.hexDistance(point(room,access.ship.id),point(room,target.id));
    const shot=profile(access.definition,access.item,range,{sacrifice,boosts});
    if(shot.count>100)return {ok:false,error:'Choose at most 100 damage dice per shot.'};
    if(!Number.isInteger(boosts)||boosts<0||boosts>100||(boosts&&!shot.boostAllowed)||(sacrifice&&shot.family!=='rapid-laser'))return {ok:false,error:'This weapon cannot use that AU option.'};
    locks.refresh(room);
    const selectedLock=weaponLock(room,unit,access.ship,target.id,access.controlled&&!access.remotePilot);
    if(body.targetSicId&&!locks.hasComponent(selectedLock,body.targetSicId))return {ok:false,error:'Acquire a controlled lock on the selected component first.'};
    if(access.definition.requiresLock&&!weaponLock(room,unit,access.ship,target.id,access.controlled&&!access.remotePilot))return {ok:false,error:'Beam Lasers require a target lock you control. A captured weapon also needs its Lock-On SIC captured.'};
    if(!shot.count&&shot.family!=='rapid-laser')return {ok:false,error:'No damage dice remain at this range and power setting.'};
    if(rail&&!ironAmmo(access.ship))return {ok:false,error:access.definition.name+' requires 1 Iron per shot.'};
    const surcharge = !access.definition.devastation&&!access.definition.ionDisruptor&&!rail&&data.repeatWindow?.[access.id] > 0 ? access.definition.energyCost : 0;
    if(unit.shipAi&&shot.cost+surcharge>0)return {ok:false,error:'Ship AI never spends AU.'};
    if (shot.cost+surcharge>0&&!power.spend(room,access.ship.id,shot.cost+surcharge)) return {ok:false,error:'Not enough Auxiliary power.'};
    const burst=repeater(access.definition)?{id:`laser-${receipt}`,shot:1,total:Math.min(access.definition.burstShots||4,ironAmmo(access.ship))}:null;
    if(rail)access.ship.ship.minerals.Iron-=1;
    data.repeatWindow ||= {};
    if(access.definition.ionDisruptor)require('./ship-field-utilities').system(access.ship,access.id).cooldown=24;else data.repeatWindow[access.id] ||= 12;
    const input = settings(unit,access.definition.tier);
    unit.delayedAction = {id:`laser-${receipt}`,kind:'action',label:`Fire ${access.definition.name}${burst?` (shot 1/${burst.total})`:''}`,rate:input.rate,remaining:100,total:100,consumeTurn:true,resolving:false,settings:input,
      weaponOrder:{shipId:access.ship.id,sicId:access.id,targetSicId:body.targetSicId||null,station:access.seat.key,targetId:target.id,sacrifice,boosts,range,captured:Boolean(access.controlled&&!access.remotePilot),weaponFamily:shot.family,manualOnly:Boolean(manualOnly),noShieldDamage:Boolean(rail||access.definition.noShieldDamage),dieSides:shot.dieSides||access.definition.damageDie||4,weaponName:access.definition.name,...(burst?{burst}:{}),damageType:access.definition.damageType||(['rapid-laser','beam-laser'].includes(shot.family)?'laser':rail?'ballistic':undefined)}};
    unit.delayedAction.rollSpec = rollSpec(room,unit,unit.delayedAction.weaponOrder);
    locks.refresh(room);
    const lock=weaponLock(room,unit,access.ship,target.id,access.controlled&&!access.remotePilot);
    if(lock&&!manualOnly){unit.delayedAction.weaponOrder.locked=true;unit.delayedAction.weaponOrder.targetSicId=body.targetSicId||null;unit.delayedAction.rollConfirmed=true;}
    data.receipts = [...data.receipts,receipt].slice(-256);
    return {ok:true,ship:access.ship};
  }
  function continueBurst(room,unit,pending,order){
    if(!order.burst||order.burst.shot>=order.burst.total)return;
    const ship=room.starships.find(s=>s.id===order.shipId),target=targets.find(room,order.targetId),access=stations.access(room,unit,order.sicId);
    if(!ship||!target||target.currentHullHp<=0||target.escapedAt||target.ship.warpState?.phase==='traveling'||!access||access.blocked||access.seat.key!==order.station||ship.currentHullHp<=0||ship.escapedAt||ship.ship.warpState?.phase==='traveling'||maps.cloaked(ship)||!ironAmmo(ship))return;
    const next={...order,burst:{...order.burst,shot:order.burst.shot+1},range:distances.hexDistance(point(room,ship.id),point(room,target.id))};
    ship.ship.minerals.Iron-=1;
    // One turn and one Fast input. The remaining shots still require their own normal manual rolls.
    unit.delayedAction={id:`${next.burst.id}-shot-${next.burst.shot}`,kind:'action',label:`Fire ${shotName(next)}`,remaining:0,total:100,rate:1,resolving:true,awaitingRoll:true,rollBeforeDelay:false,consumeTurn:false,rollController:pending.rollController,automated:pending.automated,weaponOrder:next,rollSpec:rollSpec(room,unit,next)};
  }
  function resolveInput(room, unit, attackRoll, damageRoll) {
    const pending = unit.delayedAction, order = pending?.weaponOrder;
    if (!order) return;
    unit.delayedAction = null;
    const ship = room.starships.find(s => s.id === order.shipId), target = targets.find(room,order.targetId);
    if (!ship) return;
    const access = stations.access(room,unit,order.sicId);
    const post = entry => {
      const report = {...entry,weaponFamily:order.weaponFamily,id:pending.id,at:new Date().toISOString()};
      state(ship).reports = [report,...state(ship).reports].slice(0,30);
      sensors.knowledge(ship).reports = [{...report},...sensors.knowledge(ship).reports].slice(0,30);
      return report;
    };
    const rail=ballistic(order),locked=order.locked&&!order.manualOnly&&!access?.definition.manualOnly&&!rail;
    if (!access || access.blocked || access.seat.key !== order.station || !target || ship.escapedAt || target.escapedAt || ship.ship.warpState?.phase==='traveling' || target.ship.warpState?.phase==='traveling' || ship.currentHullHp <= 0 || target.currentHullHp <= 0 || (!rail&&power.output(ship,room.units).en < 1)) {
      post({text:rail?'Rail cannon input interrupted. Committed Iron was consumed.':'Laser input interrupted. Committed AU was consumed.'}); return;
    }
    if(access.definition.devastation){const dev=require('./ship-devastation'),why=dev.reason(room,ship,access.item);if(why){post({text:'Devastation shot cancelled: '+why});return;}}
    const spec = pending.rollSpec || rollSpec(room,unit,order);
    const total = locked ? 0 : Number.isFinite(attackRoll.submittedScore) ? attackRoll.submittedScore : sensors.fusedTotal(spec.sides.map(attackRoll)) + spec.bonus;
    const defense = sensors.defense(room,target)+(order.range??spec.range)*(access.definition.rangeDefensePerUnit||0);
    locks.refresh(room);
    if(locked&&!weaponLock(room,unit,ship,target.id,order.captured)){post({text:'Shot cancelled: controlled target lock was lost during input. Committed AU was consumed.'});return;}
    if(access.definition.devastation)require('./ship-devastation').fire(ship,access.id);
    require('./ship-relays').fired(room,ship,target,order.sicId);
    const hit = locked || total >= defense;
    const maximum = access.item.impaired || access.item.status === 'impaired' ? 1 : 4;
    const reflection=hit&&access.definition.weaponFamily==='ripple-cannon'?reflector(room,target):null;
    const shot=profile(access.definition,access.item,(order.range??spec.range)*(reflection?2:1),order);
    if(reflection)order.reflection={sicId:reflection.id,impaired:Boolean(reflection.impaired||reflection.status==='impaired'||reflection.impairmentPoints>0)};
    const noShieldDamage=Boolean(rail||order.noShieldDamage||access.definition.noShieldDamage);
    const blockedByShields=hit&&noShieldDamage&&shieldProtected(room,target);
    const count = !hit||blockedByShields?0:shot.family==='rapid-laser'?Math.max(0,Math.min(maximum,locked?4:1+Math.min(3,Math.floor((total-defense)/2)))-order.sacrifice):shot.count;
    const dieSides=shot.dieSides||order.dieSides||4;
    const report = post({text:`${shotName(order)}: ${reflection?'REFLECTED':hit ? 'HIT' : 'MISSED'} ${target.title}.${reflection?' Return trip uses twice the distance.':''}${hit ? ` ${blockedByShields?'No effect: shields protect the hull; this weapon cannot damage shields.':count?`Roll ${count}D${dieSides} damage.`:rail?'No damage dice remain.':'No damage dice remain after conserving AU.'}` : ''}`,hit,damage:0,blockedByShields,total:locked?null:total,defense,targetId:target.id,shot:true,operatorId:unit.id,awaitingDamage:Boolean(count)});
    if(count)unit.delayedAction={id:pending.id+'-damage',kind:'action',rollController:pending.rollController,automated:pending.automated,label:`${shotName(order)} damage: ${count}D${dieSides}${shot.bonus?` + ${shot.bonus}`:''}`,remaining:0,total:100,rate:1,resolving:true,awaitingRoll:true,rollBeforeDelay:false,consumeTurn:false,weaponDamage:{...order,dieSides,count,damageBonus:shot.bonus,noShieldDamage,shieldPiercing:Boolean(access.definition.shieldPiercing),ignoreReduction:Boolean(access.definition.ignoreReduction),extraImpairment:access.definition.ionDisruptor?1:0,attackId:pending.id,total:locked?null:total,defense},rollSpec:{sides:Array(count).fill(dieSides),bonus:shot.bonus,skill:'Damage',damage:true,difficulty:null,difficultyLabel:'Add all damage dice and the displayed bonus. No fusion.'}};
    const incoming = {id:report.id,at:report.at,shot:true,hit,targetId:target.id,text:blockedByShields?'Incoming weapon hit: no effect on shields or hull.':rail?(hit?'Incoming rail cannon hit.':'Incoming rail cannon missed.'):(hit?'Incoming laser hit.':'Incoming laser missed.')};
    state(target).reports = [incoming,...state(target).reports].slice(0,30);
    sensors.knowledge(target).reports = [incoming,...sensors.knowledge(target).reports].slice(0,30);
    if(!count)continueBurst(room,unit,pending,order);
  }
  function resolveDamage(room,unit,values,manualScore,campaign){
    const pending=unit.delayedAction,order=pending?.weaponDamage;if(!order)return;
    const ship=room.starships.find(s=>s.id===order.shipId),target=targets.find(room,order.targetId);
    if(!ship||!target||target.currentHullHp<=0||target.escapedAt){unit.delayedAction=null;return;}
    const bonus=order.damageBonus||0,damage=values.length?values.reduce((a,b)=>a+b,0)+bonus:manualScore;
    if(!Number.isInteger(damage)||damage<order.count+bonus||damage>order.count*(order.dieSides||4)+bonus)throw Error('Enter the total of the indicated damage dice and bonus.');
    // Shields may have recovered while the operator was confirming damage.
    const blockedByShields=(order.noShieldDamage||ballistic(order))&&shieldProtected(room,target);
    const beforeHull=target.currentHullHp,beforeShield=target.currentShieldHp||0,sourceHull=ship.currentHullHp,sourceShield=ship.currentShieldHp||0;
    const ionBlocked=['ion-pulse-cannon','ion-disruptor'].includes(order.weaponFamily)&&require('./ship-countermeasures').ionProtected(room,target);
    if(ionBlocked){}else if(order.reflection){if(order.reflection.impaired)shields.damage(room,target.id,damage,{damageType:order.damageType});shields.damage(room,ship.id,damage,{damageType:order.damageType});}else if(!blockedByShields){if(target.isMissile||target.isDrone||target.isProbe){if(targets.hit(room,target.id,damage))target.currentHullHp=0;}else shields.damage(room,target.id,damage,{bypassShield:order.shieldPiercing,ignoreReduction:order.ignoreReduction,damageType:order.damageType});}
    const hullDamage=Math.max(0,beforeHull-target.currentHullHp),shieldDamage=Math.max(0,beforeShield-(target.currentShieldHp||0));
    const lock=controlledLocks(unit,ship,target.id,order.captured),item=target.ship.sicInventory.find(i=>i.id===order.targetSicId);
    let impairments=0,podInjuries=0;
    if(hullDamage&&item&&!order.reflection&&locks.hasComponent(lock,item.id)&&stations.online(item)){
      impairments=Math.floor(hullDamage/Math.max(1,maps.effectiveThreshold(target,item)||1))+(order.extraImpairment||0);
      if(impairments){const previous=Number(item.impairmentPoints)||(item.impaired?1:0);item.impairmentPoints=Math.min(4,previous+impairments);item.impaired=true;if(item.impairmentPoints>=4||maps.definition(item.type).destroyedOnImpairment)item.status='destroyed';if(item.type==='escape-pods')podInjuries=require('./ship-field-utilities').hurtPod(room,target,item,item.impairmentPoints-previous,campaign);}
    }
    const componentHit=Boolean(hullDamage&&item&&locks.hasComponent(lock,item.id)&&!order.reflection),knownItem=sensors.analysis(ship,target.id)?.layout?.sicInventory?.find(i=>i.id===item?.id),componentName=componentHit&&knownItem?maps.definition(knownItem.type).name:null;
    unit.delayedAction=null;
    const entry={id:pending.id,at:new Date().toISOString(),weaponFamily:order.weaponFamily,text:`${shotName(order)}: ${order.reflection?'REFLECTED; ':''}${damage} rolled; ${ionBlocked?'Ionic Force Displacers nullified the hit. ':''}${shieldDamage} shield damage, ${hullDamage} hull damage.${componentHit?` ${componentName||'Targeted SIC'} damaged${impairments?`: ${impairments} impairment(s)`: ''}.`:''}${order.reflection?` Attacker took ${sourceHull-ship.currentHullHp} hull and ${sourceShield-(ship.currentShieldHp||0)} shield damage.`:''}`,damage,dice:values,hit:true,impact:hullDamage+shieldDamage>0,targetId:target.id,operatorId:unit.id,hullDamage,shieldDamage,impairments,total:order.total,defense:order.defense};
    state(ship).reports=[entry,...state(ship).reports].slice(0,30);sensors.knowledge(ship).reports=[entry,...sensors.knowledge(ship).reports].slice(0,40);
    const incoming={id:entry.id,at:entry.at,impact:hullDamage+shieldDamage>0,hit:true,targetId:target.id,text:order.reflection?'Incoming Ripple reflected.':componentHit?`Incoming weapon damage to ${maps.definition(item.type).name}: ${hullDamage} Hull damage${impairments?`, ${impairments} impairment(s)`:''}.`:'Incoming weapon damage.',damage:hullDamage+shieldDamage};state(target).reports=[incoming,...state(target).reports].slice(0,30);sensors.knowledge(target).reports=[incoming,...sensors.knowledge(target).reports].slice(0,40);
    if(order.reflection){const bounce={...entry,id:entry.id+'-reflection',targetId:ship.id,damage,reflection:true,impact:true,text:'Ripple reflected back to the attacker.',hullDamage:Math.max(0,sourceHull-ship.currentHullHp),shieldDamage:Math.max(0,sourceShield-(ship.currentShieldHp||0))};state(ship).reports=[bounce,...state(ship).reports].slice(0,30);sensors.knowledge(ship).reports=[bounce,...sensors.knowledge(ship).reports].slice(0,40);}
    entry.podInjuries=podInjuries;locks.refresh(room);continueBurst(room,unit,pending,order);return entry;
  }
  function advance(room, seconds) {
    for(const ship of room.starships || [])for(const id of Object.keys(ship.weaponState?.repeatWindow || {}))ship.weaponState.repeatWindow[id]=Math.max(0,ship.weaponState.repeatWindow[id]-Math.max(0,seconds));
  }
  function cancelUnavailableDamage(room){
    let count=0;
    for(const unit of room.units||[]){const pending=unit.delayedAction,order=pending?.weaponDamage;if(!order)continue;
      const target=targets.find(room,order.targetId);if(target&&target.currentHullHp>0&&!target.escapedAt)continue;
      unit.delayedAction=null;count++;
      const ship=room.starships.find(s=>s.id===order.shipId);if(ship){const entry={id:pending.id+'-cancelled',at:new Date().toISOString(),operatorId:unit.id,text:'Damage cancelled: the target is already destroyed or has left the battlefield.'};state(ship).reports=[entry,...state(ship).reports].slice(0,30);sensors.knowledge(ship).reports=[entry,...sensors.knowledge(ship).reports].slice(0,40);}
    }
    return count;
  }
  return {settings,skill,profile,rollSpec,queue,resolveInput,resolveDamage,advance,weaponLock,ironAmmo,cancelUnavailableDamage};
}));
