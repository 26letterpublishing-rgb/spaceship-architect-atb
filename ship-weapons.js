(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./ship-map-core') : root.SAShipMap,
    node ? require('./station-access') : root.SAStationAccess,
    node ? require('./ship-distances') : root.SAShipDistances,
    node ? require('./delay-rules') : root.SADelayRules,
    node ? require('./ship-power') : root.SAShipPower,
    node ? require('./ship-shields') : root.SAShipShields,
    node ? require('./ship-sensors') : root.SAShipSensors,
    node ? require('./ship-locks') : root.SAShipLocks);
  if (node) module.exports = api;
  if (root) root.SAShipWeapons = api;
}(typeof window !== 'undefined' ? window : null, function(maps, stations, distances, delays, power, shields, sensors, locks) {
  const skill = unit => Math.max(0, Number(unit.weaponSystemsSkill ?? (unit.team === 'npc' ? unit.mentalSkill : 0)) || 0);
  const bars = value => value >= 6 ? 4 : value >= 5 ? 3 : value >= 3 ? 2 : value >= 1 ? 1 : 0;
  function settings(unit) {
    const value = {base:10, factors:{Situation:0, Execution:0, Quality:1, Performance:0, Efficiency:0, Ingenuity:bars(skill(unit))}};
    return {...value, rate:delays.calculate(value).rate};
  }
  const state = ship => ship.weaponState ||= {receipts:[], reports:[]};
  const point = (room,id) => distances.positions(room.starships,room.shipPositions).find(p => p.id === id);
  function rollSpec(room, unit, order) {
    const ship = room.starships.find(s => s.id === order.shipId), target = room.starships.find(s => s.id === order.targetId);
    let sides = (unit.dexterityDice || []).filter(n => [4,6,8,10,12].includes(n));
    if (unit.classId === 'gunner' && unit.intellectDice?.length) sides = [...sides, Math.max(...unit.intellectDice)];
    if (unit.raceId === 'tamalori') sides = [...sides,...sides];
    if (unit.raceId === 'krax-gny-vtek' && unit.maximumHp-unit.currentHp >= 5) sides = sides.slice(0,3);
    const range = ship && target ? distances.hexDistance(point(room,ship.id),point(room,target.id)) : 0;
    const bonus = Number((skill(unit) + (ship ? maps.propulsion(ship).hsm : 0) - range).toFixed(6));
    const known = ship?.sensorState?.contacts?.[target?.id]?.defenseScore;
    return {sides, bonus, skill:'Weapon Systems', attributeKey:'dexterity', difficulty:Number.isFinite(known) ? known : null,
      difficultyLabel:Number.isFinite(known) ? `Must exceed Defense ${known}` : 'Unknown defense', range};
  }
  function queue(room, unit, body) {
    const access = stations.access(room,unit,body.sicId);
    if (!access || access.kind !== 'weapon') return {ok:false,error:'Operate an installed laser from a working cockpit or bridge.'};
    const data = state(access.ship), receipt = String(body.requestId || '');
    if (!/^[\w-]{8,100}$/.test(receipt)) return {ok:false,error:'Invalid firing receipt.'};
    if (data.receipts.includes(receipt)) return {ok:true,duplicate:true};
    if (room.activeId !== unit.id || unit.delayedAction || unit.delayTimer || unit.timedAction || unit.consoleHold || unit.shieldRestabilizing || room.starships.some(s => s.auCommands?.some(c => c.unitId === unit.id))) return {ok:false,error:'Wait for your turn and finish the current action.'};
    sensors.refresh(room);
    const target = room.starships.find(s => s.id === body.targetId && s.id !== access.ship.id);
    if (!target || access.ship.sensorState?.contacts?.[target.id]?.level !== 'detected') return {ok:false,error:'Select a detected starship.'};
    if (access.ship.currentHullHp <= 0 || target.currentHullHp <= 0 || power.output(access.ship,room.units).en < 1) return {ok:false,error:'The ship or its power supply is unavailable.'};
    const sacrifice = Number(body.sacrifice || 0);
    if (!Number.isInteger(sacrifice) || sacrifice < 0 || sacrifice > 3) return {ok:false,error:'Choose zero to three sacrificed damage dice.'};
    const surcharge = data.repeatWindow?.[access.id] > 0 ? access.definition.energyCost : 0;
    if (!power.spend(room,access.ship.id,5-sacrifice+surcharge)) return {ok:false,error:'Not enough Auxiliary power.'};
    data.repeatWindow ||= {};
    data.repeatWindow[access.id] ||= 12;
    const input = settings(unit);
    unit.delayedAction = {id:`laser-${receipt}`,kind:'action',label:'Fire Rapid Laser 1',rate:input.rate,remaining:100,total:100,consumeTurn:true,resolving:false,settings:input,
      weaponOrder:{shipId:access.ship.id,sicId:access.id,station:access.seat.key,targetId:target.id,sacrifice}};
    unit.delayedAction.rollSpec = rollSpec(room,unit,unit.delayedAction.weaponOrder);
    locks.refresh(room);
    if(locks.locked(room,access.ship,target.id)){unit.delayedAction.weaponOrder.locked=true;unit.delayedAction.weaponOrder.targetSicId=locks.state(access.ship).targets.find(t=>t.targetId===target.id)?.sicId;unit.delayedAction.rollConfirmed=true;}
    data.receipts = [...data.receipts,receipt].slice(-256);
    return {ok:true,ship:access.ship};
  }
  function resolveInput(room, unit, attackRoll, damageRoll) {
    const pending = unit.delayedAction, order = pending?.weaponOrder;
    if (!order) return;
    unit.delayedAction = null;
    const ship = room.starships.find(s => s.id === order.shipId), target = room.starships.find(s => s.id === order.targetId);
    if (!ship) return;
    const access = stations.access(room,unit,order.sicId);
    const post = entry => {
      const report = {...entry,id:pending.id,at:new Date().toISOString()};
      state(ship).reports = [report,...state(ship).reports].slice(0,30);
      sensors.knowledge(ship).reports = [{...report},...sensors.knowledge(ship).reports].slice(0,30);
      return report;
    };
    if (!access || access.seat.key !== order.station || !target || ship.currentHullHp <= 0 || target.currentHullHp <= 0 || power.output(ship,room.units).en < 1) {
      post({text:'Laser input interrupted. Committed AU was consumed.'}); return;
    }
    const spec = pending.rollSpec || rollSpec(room,unit,order);
    const total = order.locked ? 0 : Number.isFinite(attackRoll.submittedScore) ? attackRoll.submittedScore : sensors.fusedTotal(spec.sides.map(attackRoll)) + spec.bonus;
    const defense = sensors.defense(room,target);
    locks.refresh(room);
    if(order.locked&&!locks.locked(room,ship,target.id)){post({text:'Shot cancelled: target lock was lost during input. Committed AU was consumed.'});return;}
    const hit = order.locked || total > defense;
    const maximum = access.item.impaired || access.item.status === 'impaired' ? 1 : 4;
    const count = hit ? Math.max(0,Math.min(maximum,order.locked?4:1+Math.min(3,Math.floor((total-defense)/2)))-order.sacrifice) : 0;
    const report = post({text:`Rapid Laser 1: ${hit ? 'HIT' : 'MISSED'} ${target.title}.${hit ? ` ${count?`Roll ${count}D4 damage.`:'No damage dice remain after conserving AU.'}` : ''}`,hit,damage:0,total:order.locked?null:total,defense,targetId:target.id,shot:true,operatorId:unit.id,awaitingDamage:Boolean(count)});
    if(count)unit.delayedAction={id:pending.id+'-damage',kind:'action',label:`Rapid Laser damage: ${count}D4`,remaining:0,total:100,rate:1,resolving:true,awaitingRoll:true,rollBeforeDelay:false,consumeTurn:false,weaponDamage:{...order,count,attackId:pending.id,total:order.locked?null:total,defense},rollSpec:{sides:Array(count).fill(4),bonus:0,skill:'Damage',damage:true,difficulty:null,difficultyLabel:'Add all damage dice. No fusion.'}};
    const incoming = {id:report.id,at:report.at,shot:true,hit,targetId:target.id,text:hit?'Incoming laser hit.':'Incoming laser missed.'};
    state(target).reports = [incoming,...state(target).reports].slice(0,30);
    sensors.knowledge(target).reports = [incoming,...sensors.knowledge(target).reports].slice(0,30);
  }
  function resolveDamage(room,unit,values,manualScore){
    const pending=unit.delayedAction,order=pending?.weaponDamage;if(!order)return;
    const ship=room.starships.find(s=>s.id===order.shipId),target=room.starships.find(s=>s.id===order.targetId);
    if(!ship||!target)return;
    const damage=values.length?values.reduce((a,b)=>a+b,0):manualScore;
    if(!Number.isInteger(damage)||damage<order.count||damage>order.count*4)throw Error('Enter the total of the indicated damage dice.');
    const beforeHull=target.currentHullHp,beforeShield=target.currentShieldHp;
    shields.damage(room,target.id,damage);
    const hullDamage=Math.max(0,beforeHull-target.currentHullHp),shieldDamage=Math.max(0,beforeShield-target.currentShieldHp);
    const lock=locks.state(ship).targets.find(l=>l.targetId===target.id),item=target.ship.sicInventory.find(i=>i.id===order.targetSicId);
    let impairments=0;
    if(hullDamage&&item&&lock?.sicId===item.id&&stations.online(item)){
      impairments=Math.floor(hullDamage/Math.max(1,maps.definition(item.type).threshold||1));
      if(impairments){item.impairmentPoints=Math.min(4,(Number(item.impairmentPoints)||(item.impaired?1:0))+impairments);item.impaired=true;if(item.impairmentPoints>=4)item.status='destroyed';}
    }
    unit.delayedAction=null;
    const entry={id:pending.id,at:new Date().toISOString(),text:`Rapid Laser: ${damage} rolled; ${shieldDamage} shield damage, ${hullDamage} hull damage.${impairments?` ${impairments} component impairment(s).`:''}`,damage,dice:values,hit:true,impact:true,targetId:target.id,operatorId:unit.id,hullDamage,shieldDamage,impairments,total:order.total,defense:order.defense};
    state(ship).reports=[entry,...state(ship).reports].slice(0,30);sensors.knowledge(ship).reports=[entry,...sensors.knowledge(ship).reports].slice(0,40);
    const incoming={id:entry.id,at:entry.at,impact:true,hit:true,targetId:target.id,text:'Incoming weapon damage.',damage};state(target).reports=[incoming,...state(target).reports].slice(0,30);sensors.knowledge(target).reports=[incoming,...sensors.knowledge(target).reports].slice(0,40);
    locks.refresh(room);return entry;
  }
  function advance(room, seconds) {
    for(const ship of room.starships || [])for(const id of Object.keys(ship.weaponState?.repeatWindow || {}))ship.weaponState.repeatWindow[id]=Math.max(0,ship.weaponState.repeatWindow[id]-Math.max(0,seconds));
  }
  return {settings,skill,rollSpec,queue,resolveInput,resolveDamage,advance};
}));
