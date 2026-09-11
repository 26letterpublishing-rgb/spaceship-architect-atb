(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./ship-map-core') : root.SAShipMap,
    node ? require('./station-access') : root.SAStationAccess,
    node ? require('./ship-distances') : root.SAShipDistances,
    node ? require('./delay-rules') : root.SADelayRules,
    node ? require('./ship-power') : root.SAShipPower,
    node ? require('./ship-shields') : root.SAShipShields,
    node ? require('./ship-sensors') : root.SAShipSensors);
  if (node) module.exports = api;
  if (root) root.SAShipWeapons = api;
}(typeof window !== 'undefined' ? window : null, function(maps, stations, distances, delays, power, shields, sensors) {
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
    const bonus = skill(unit) + (ship ? maps.propulsion(ship).hsm : 0) - range;
    const known = ship?.sensorState?.contacts?.[target?.id]?.analysisDifficulty;
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
    const total = Number.isFinite(attackRoll.submittedScore) ? attackRoll.submittedScore : sensors.fusedTotal(spec.sides.map(attackRoll)) + spec.bonus;
    const defense = target.commandSystems?.evasions?.[0]?.defense ?? (Number.isFinite(target.ship.defenseScore) ? target.ship.defenseScore : sensors.masking(room,target));
    const hit = total > defense;
    const maximum = access.item.impaired || access.item.status === 'impaired' ? 1 : 4;
    const count = hit ? Math.max(0,Math.min(maximum,1+Math.min(3,Math.floor((total-defense)/2)))-order.sacrifice) : 0;
    const dice = Array.from({length:count},() => damageRoll(4)), damage = dice.reduce((sum,n) => sum+n,0);
    if (damage) shields.damage(room,target.id,damage);
    if(target.commandSystems?.evasions?.length)target.commandSystems.evasions=[];
    const report = post({text:`Rapid Laser 1: ${hit ? 'HIT' : 'MISSED'} ${target.title}.${hit ? ` ${count}D4: ${damage} damage rolled${count ? '' : ' (power conservation removed all damage dice)'}.` : ''}`,hit,damage,dice,total,targetId:target.id,shot:true});
    const incoming = {id:report.id,at:report.at,shot:true,hit,targetId:target.id,text:hit?'Incoming laser hit.':'Incoming laser missed.'};
    state(target).reports = [incoming,...state(target).reports].slice(0,30);
    sensors.knowledge(target).reports = [incoming,...sensors.knowledge(target).reports].slice(0,30);
  }
  function advance(room, seconds) {
    for(const ship of room.starships || [])for(const id of Object.keys(ship.weaponState?.repeatWindow || {}))ship.weaponState.repeatWindow[id]=Math.max(0,ship.weaponState.repeatWindow[id]-Math.max(0,seconds));
  }
  return {settings,skill,rollSpec,queue,resolveInput,advance};
}));
