(function(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./ship-map-core') : root.SAShipMap,
    typeof module !== 'undefined' && module.exports ? require('./ship-distances') : root.SAShipDistances,
    typeof module !== 'undefined' && module.exports ? require('./ship-power') : root.SAShipPower);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAShipNavigation = api;
}(typeof window !== 'undefined' ? window : null, function(maps, distances, power) {
  const PERIOD = 12;
  const online = item => item && !item.disabled && !item.impaired && !['offline','powered-down','destroyed','impaired'].includes(item.status);
  function access(room, unit) {
    const ship = (room?.starships || []).find(s => s.id === unit?.location?.starshipId);
    if (!ship || unit.defeatedAt || !unit.location?.stationed || unit.timedAction?.kind === 'move') return null;
    const layout = maps.buildLayout(ship.ship || ship), cell = layout.footprint.get(Number(unit.location.square));
    if (!cell || !online(cell.item) || !maps.definition(cell.type).shipControl || cell.sicId !== unit.location.sicId) return null;
    if (!cell.stations.some(s => s.x === cell.column && s.y === cell.row && s.mesh === Number(unit.location.mesh))) return null;
    const inventory = ship.ship?.sicInventory || [], installed = new Set((ship.ship?.placements || []).map(p => p.sicId));
    const thrusters = inventory.filter(i => installed.has(i.id) && online(i) && maps.definition(i.type).thruster && maps.exteriorPlacement(ship.ship,i.type,ship.ship.placements.find(p=>p.sicId===i.id).cell,i.id));
    return thrusters.length ? { ship, thrusters, speed: maps.propulsion(ship).moveSpeed } : null;
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
    allowed.ship.navigation = { phase:'powered', target:{q:target.q,r:target.r}, direction:{q:(target.q-start.q)/length,r:(target.r-start.r)/length},
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
        position.q += nav.direction.q*nav.speed*elapsed/PERIOD;
        position.r += nav.direction.r*nav.speed*elapsed/PERIOD;
        left -= elapsed; nav.remaining -= elapsed;
        if (Math.abs(position.q)>10000 || Math.abs(position.r)>10000) {
          position.q=Math.max(-10000,Math.min(10000,position.q)); position.r=Math.max(-10000,Math.min(10000,position.r)); nav.phase='stopped';nav.speed=0;nav.remaining=0;break;
        }
        if (nav.remaining <= 1e-9) {
          if (nav.phase==='powered') { position.q=nav.target.q;position.r=nav.target.r; }
          nav.speed=Math.max(0,Math.floor(nav.speed/2)-2);
          nav.phase=nav.speed ? 'drift' : 'stopped'; nav.remaining=nav.speed ? PERIOD : 0;
        }
      }
    }
    room.shipDistances = distances.fromPositions(room.starships || [],room.shipPositions);
  }
  return {PERIOD,access,order,advance};
}));
