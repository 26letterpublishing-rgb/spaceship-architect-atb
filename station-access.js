(function(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./ship-map-core') : root.SAShipMap);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAStationAccess = api;
}(typeof window !== 'undefined' ? window : null, function(maps) {
  const online = item => item && !item.disabled && !['offline', 'powered-down', 'destroyed'].includes(item.status) && !(maps.definition(item.type).destroyedOnImpairment&&(item.impaired||item.status==='impaired'||item.impairmentPoints>0));
  const conscious = unit => Boolean(unit && (!unit.defeatedAt||unit.escapedAt) && !unit.oxygenUnconscious && (unit.currentHp == null || !Number.isFinite(Number(unit.currentHp)) || Number(unit.currentHp) > 0));
  function station(room, unit) {
    const loc = unit?.location, ship = room?.starships?.find(s => s.id === loc?.starshipId);
    if (!ship || !conscious(unit) || unit.timedAction?.kind === 'move') return null;
    const cell = maps.buildLayout(ship.ship || ship).footprint.get(Number(loc.square));
    if (!cell || !online(cell.item)) return null;
    if(maps.definition(cell.type).roomStation)return {ship,cell,key:`${ship.id}:${cell.sicId}:${loc.square}:${loc.mesh}`};
    if(!loc.stationed||cell.sicId!==loc.sicId)return null;
    if (!cell.stations.some(p => p.x === cell.column && p.y === cell.row && p.mesh === Number(loc.mesh))) return null;
    return { ship, cell, key: `${ship.id}:${cell.sicId}:${loc.square}:${loc.mesh}` };
  }
  function consoles(room, unit) {
    const seat = station(room, unit);
    if (!seat) return [];
    const ship = seat.ship.ship || seat.ship, inventory = new Map((ship.sicInventory || []).map(i => [i.id, i]));
    const available = (ship.placements || []).flatMap(p => {
      const item = inventory.get(p.sicId), definition = maps.componentDefinition(item);
      if (!online(item) || (!definition.shipControl && !definition.shield && !definition.sensor && !definition.weapon && !definition.lockOn && !definition.utility && !definition.hacking)) return [];
      const remote = seat.cell.sicId !== item.id;
      if (remote && (!maps.definition(seat.cell.type).bridge||definition.localOnly)) return [];
      const blocked=Boolean(seat.ship.hackedSystems?.some(h=>h.bridge||h.sicId===item.id));
      return [{ id: item.id, item, definition, ship: seat.ship, remote, seat, blocked, kind: definition.hacking ? 'hacking' : definition.utility ? 'utility' : definition.lockOn ? 'lock' : definition.weapon ? 'weapon' : definition.sensor ? 'sensor' : definition.shield ? 'shield' : 'pilot' }];
    });
    const grants=room.hackingGrants || (unit.hackingSessions||[]).filter(s=>s.control&&s.connected).map(s=>({...s,unitId:unit.id}));
    if(!seat.ship.hackedSystems?.some(h=>h.bridge))for(const grant of grants.filter(g=>g.unitId===unit.id)){
      const target=room.starships.find(s=>s.id===grant.targetId),captured=(target?.ship?.sicInventory||[]).find(i=>i.id===grant.sicId);
      if(!online(captured)||target.hackedSystems?.some(h=>h.bridge&&h.unitId!==unit.id))continue;
      const items=maps.definition(captured.type).bridge?maps.installedItems(target):[captured];
      for(const item of items){
        if(!online(item)||maps.definition(item.type).utility==='self-destruct'||available.some(a=>a.id===item.id&&a.ship.id===target.id))continue;
        const definition=maps.componentDefinition(item),kind=definition.shipControl?'pilot':definition.hacking?'hacking':definition.weapon?'weapon':definition.lockOn?'lock':definition.shield?'shield':definition.sensor?'sensor':definition.utility?'utility':null;
        if(kind&&!definition.crewRoom&&(!definition.localOnly||definition.surveillance&&!maps.definition(captured.type).bridge))available.push({id:item.id,item,definition,ship:target,remote:true,seat,kind,controlled:true,controlSource:room.starships.find(s=>s.id===grant.sourceId)||seat.ship});
      }
    }
    return available;
  }
  const access = (room, unit, sicId) => consoles(room, unit).find(c => c.id === sicId) || null;
  function adjustInputs(room){
    for(const unit of room.units||[]){
      const pending=unit.delayedAction;
      if(pending&&!pending.localInputBonus&&!pending.weaponDamage){
        const order=pending.sensorOrder||pending.weaponOrder||pending.lockOrder||pending.shipOrder||pending.commandOrder||pending.maintenanceOrder||pending.missileOrder||pending.hackingOrder||pending.transitOrder||pending.probeOrder;
        const seat=order&&access(room,unit,order.sicId||order.systemId);
        if(seat&&!seat.remote&&!seat.controlled&&pending.rate>0){pending.rate/=.9;pending.localInputBonus=true;}
      }

    }
  }
  return { station, consoles, access, online, conscious, adjustInputs };
}));
