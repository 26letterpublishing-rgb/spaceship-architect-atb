(function(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./ship-map-core') : root.SAShipMap,
    typeof module !== 'undefined' && module.exports ? require('./ship-distances') : root.SAShipDistances,
    typeof module !== 'undefined' && module.exports ? require('./ship-power') : root.SAShipPower,
    typeof module !== 'undefined' && module.exports ? require('./delay-rules') : root.SADelayRules);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAShipNavigation = api;
}(typeof window !== 'undefined' ? window : null, function(maps, distances, power, delays) {
  const PERIOD = 12;
  const online = item => item && !item.disabled && !item.impaired && !['offline','powered-down','destroyed','impaired'].includes(item.status);
  function station(room, unit) {
    const ship = (room?.starships || []).find(s => s.id === unit?.location?.starshipId);
    if (!ship || unit.defeatedAt || !unit.location?.stationed || unit.timedAction?.kind === 'move') return null;
    const layout = maps.buildLayout(ship.ship || ship), cell = layout.footprint.get(Number(unit.location.square));
    if (!cell || !maps.definition(cell.type).shipControl || cell.sicId !== unit.location.sicId) return null;
    if (!cell.stations.some(s => s.x === cell.column && s.y === cell.row && s.mesh === Number(unit.location.mesh))) return null;
    return {ship,cell};
  }
  function access(room, unit) {
    const seated=station(room,unit);
    if(!seated || !online(seated.cell.item))return null;
    const {ship}=seated;
    if(power.output(ship,room.units).en<=0)return null;
    const inventory = ship.ship?.sicInventory || [], installed = new Set((ship.ship?.placements || []).map(p => p.sicId));
    const thrusters = inventory.filter(i => installed.has(i.id) && online(i) && maps.definition(i.type).thruster && maps.exteriorPlacement(ship.ship,i.type,ship.ship.placements.find(p=>p.sicId===i.id).cell,i.id));
    return thrusters.length ? { ship, thrusters, speed: maps.propulsion(ship).moveSpeed } : null;
  }
  function inputSettings(room,unit){
    const tiers=(access(room,unit)?.thrusters||[]).map(t=>maps.definition(t.type).auBoost).sort((a,b)=>b-a).slice(0,2);
    const quality=tiers.length?Math.ceil(tiers.reduce((a,b)=>a+b,0)/tiers.length):0;
    const skill=Math.floor(Math.max(0,Number(unit?.pilotSkill ?? (unit?.team==='npc'?unit.mentalSkill:0))||0));
    const ingenuity=skill>=6?4:skill>=5?3:skill>=3?2:skill>=1?1:0;
    const settings={base:14,factors:{Quality:Math.min(4,quality),Performance:4,Efficiency:0,Situation:0,Ingenuity:ingenuity,Execution:0}};
    return {...settings,quality,rate:delays.calculate(settings).rate};
  }
  function queue(room,unit,body){
    if(unit.delayedAction || unit.delayTimer || unit.timedAction)return {ok:false,error:'Finish the current action first.'};
    // Validate without spending AU or replacing the route already in flight.
    const copy=JSON.parse(JSON.stringify(room)), pilot=copy.units.find(u=>u.id===unit.id);
    const result=order(copy,pilot,body);
    if(!result.ok)return result;
    const settings=inputSettings(room,unit);
    unit.delayedAction={id:`pilot-${unit.id}-${Date.now()}`,kind:'action',label:'Input ship movement',settings,rate:settings.rate,remaining:100,total:100,consumeTurn:true,resolving:false,
      shipOrder:{shipId:result.ship.id,sicId:unit.location.sicId,target:{...body.destination},baseSpeed:result.ship.navigation.baseSpeed,boosts:result.ship.navigation.boosts}};
    return {ok:true,ship:result.ship};
  }
  function resolveInput(room,unit){
    const pending=unit.delayedAction?.shipOrder;
    if(!pending)return {ok:false,error:'No pilot input pending.'};
    const seated=station(room,unit);
    unit.delayedAction=null;
    if(!seated || seated.ship.id!==pending.shipId || seated.cell.sicId!==pending.sicId || !online(seated.cell.item))return {ok:false,error:'Pilot input interrupted.'};
    const ship=seated.ship;
    const boosts=pending.boosts.filter(b=>(ship.ship.placements||[]).some(p=>p.sicId===b.id)&&online(ship.ship.sicInventory.find(i=>i.id===b.id)));
    const cost=boosts.reduce((n,b)=>n+b.cost,0),speed=pending.baseSpeed+boosts.reduce((n,b)=>n+b.speed,0);
    const start=distances.positions(room.starships,room.shipPositions).find(p=>p.id===ship.id),length=distances.hexDistance(start,pending.target);
    if(length<1e-6 || speed<=0)return {ok:false,error:'Ship is already at the destination or cannot move.'};
    if(cost&&!power.spend(room,ship.id,cost))return {ok:false,error:'Insufficient AU when pilot input finished; previous route retained.'};
    ship.navigation={phase:'powered',traveled:0,target:pending.target,direction:{q:(pending.target.q-start.q)/length,r:(pending.target.r-start.r)/length},baseSpeed:pending.baseSpeed,boosts,speed,remaining:PERIOD*length/speed,pilotId:unit.id};
    return {ok:true,ship,cost};
  }
  function order(room, unit, body) {
    const allowed = access(room, unit);
    if (!allowed) return {ok:false,error:'Remain at an operational cockpit station on a ship with operational thrusters.'};
    const target = body.destination;
    if (!target || ![target.q,target.r].every(n => Number.isInteger(n) && Math.abs(n) <= 10000)) return {ok:false,error:'Choose a destination hex.'};
    const ids = body.boostIds || [];
    if (!Array.isArray(ids) || ids.length > 4 || new Set(ids).size !== ids.length) return {ok:false,error:'Choose each thruster boost only once.'};
    const boosts = [];
    for (const id of ids) {
      const item = allowed.thrusters.find(t => t.id === id);
      if (!item) return {ok:false,error:'A selected thruster boost is no longer available.'};
      const d = maps.definition(item.type); boosts.push({id, speed:d.auBoost, cost:d.auCost});
    }
    const start = distances.positions(room.starships, room.shipPositions).find(p => p.id === allowed.ship.id);
    const length = distances.hexDistance(start, target), speed = allowed.speed + boosts.reduce((n,b)=>n+b.speed,0);
    if (length < 1e-6 || speed <= 0) return {ok:false,error:'Choose a different hex and a positive Move Speed.'};
    const cost = boosts.reduce((n,b)=>n+b.cost,0);
    if (cost && !power.spend(room,allowed.ship.id,cost)) return {ok:false,error:'Not enough AU for the selected boosts.'};
    allowed.ship.navigation = { phase:'powered', traveled:0, target:{q:target.q,r:target.r}, direction:{q:(target.q-start.q)/length,r:(target.r-start.r)/length},
      baseSpeed:allowed.speed, boosts, speed, remaining:PERIOD*length/speed, pilotId:unit.id };
    return {ok:true,ship:allowed.ship,cost};
  }
  function advance(room, seconds) {
    if (!(seconds > 0) || !Number.isFinite(seconds)) return;
    room.shipPositions = distances.positions(room.starships || [], room.shipPositions);
    for (const ship of room.starships || []) {
      const nav = ship.navigation, position = room.shipPositions.find(p=>p.id===ship.id);
      if (!nav || !position || !['powered','drift'].includes(nav.phase)) continue;
      if (nav.phase === 'powered') {
        // Losing a paid boost cannot undo distance already traveled or change the frozen base order.
        nav.boosts = (nav.boosts || []).filter(b=>(ship.ship.placements || []).some(p=>p.sicId===b.id) && online((ship.ship.sicInventory || []).find(i=>i.id===b.id)));
        nav.speed = nav.baseSpeed + nav.boosts.reduce((n,b)=>n+b.speed,0);
        nav.remaining = nav.speed > 0 ? PERIOD*distances.hexDistance(position,nav.target)/nav.speed : 0;
      }
      let left = seconds;
      for (let step=0;left>1e-9 && step<64 && nav.phase !== 'stopped';step++) {
        if (!(nav.speed > 0)) { nav.phase='stopped'; nav.remaining=0; break; }
        const elapsed = Math.min(left,Math.max(0,nav.remaining));
        if (nav.phase === 'powered') nav.traveled = (Number(nav.traveled) || 0) + nav.speed*elapsed/PERIOD;
        position.q += nav.direction.q*nav.speed*elapsed/PERIOD;
        position.r += nav.direction.r*nav.speed*elapsed/PERIOD;
        left -= elapsed; nav.remaining -= elapsed;
        if (Math.abs(position.q)>10000 || Math.abs(position.r)>10000) {
          position.q=Math.max(-10000,Math.min(10000,position.q)); position.r=Math.max(-10000,Math.min(10000,position.r)); nav.phase='stopped';nav.speed=0;nav.remaining=0;break;
        }
        if (nav.remaining <= 1e-9) {
          if (nav.phase==='powered') { position.q=nav.target.q;position.r=nav.target.r; }
          nav.speed=Math.max(0,Math.floor((nav.phase==='powered' ? nav.traveled : nav.speed)/2 + 1e-9)-2);
          nav.phase=nav.speed ? 'drift' : 'stopped'; nav.remaining=nav.speed ? PERIOD : 0;
        }
      }
    }
    room.shipDistances = distances.fromPositions(room.starships || [],room.shipPositions);
  }
  return {PERIOD,station,access,inputSettings,queue,resolveInput,order,advance};
}));
