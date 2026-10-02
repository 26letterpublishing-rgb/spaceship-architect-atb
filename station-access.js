(function(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./ship-map-core') : root.SAShipMap);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAStationAccess = api;
}(typeof window !== 'undefined' ? window : null, function(maps) {
  const online = item => item && !item.disabled && !['offline', 'powered-down', 'destroyed'].includes(item.status) && !(maps.definition(item.type).destroyedOnImpairment&&(item.impaired||item.status==='impaired'||item.impairmentPoints>0));
  const conscious = unit => Boolean(unit && (!unit.defeatedAt||unit.escapedAt) && !unit.oxygenUnconscious && (unit.currentHp == null || !Number.isFinite(Number(unit.currentHp)) || Number(unit.currentHp) > 0));
  const stationLayouts = new WeakMap();
  function stationCell(ship, square) {
    const key=JSON.stringify([ship.zoneColumns,ship.zoneRows,ship.gridCells,ship.placements,ship.sicInventory,ship.thrusterDirection]);
    let cached=stationLayouts.get(ship);
    if(cached?.key!==key){cached={key,layout:maps.buildLayout(ship)};stationLayouts.set(ship,cached);}
    const cell=cached.layout.footprint.get(Number(square));
    // Equal replacement inventories must still expose the current mutable item.
    return cell?{...cell,item:(ship.sicInventory||[]).find(i=>i.id===cell.sicId)}:null;
  }
  function physicalStation(room, unit) {
    const loc = unit?.location, ship = room?.starships?.find(s => s.id === loc?.starshipId);
    if (!ship || !conscious(unit) || unit.timedAction?.kind === 'move') return null;
    const cell = stationCell(ship.ship || ship,loc.square);
    if (!cell || (!online(cell.item) && typeof window === 'undefined') || cell.item?.status==='destroyed') return null;
    if(maps.definition(cell.type).roomStation)return {ship,cell,key:`${ship.id}:${cell.sicId}:${loc.square}:${loc.mesh}`};
    if(!loc.stationed||cell.sicId!==loc.sicId)return null;
    if (!cell.stations.some(p => p.x === cell.column && p.y === cell.row && p.mesh === Number(loc.mesh))) return null;
    return { ship, cell, key: `${ship.id}:${cell.sicId}:${loc.square}:${loc.mesh}` };
  }
  function remotes(room,unit){
    if(!conscious(unit)||unit.timedAction?.kind==='move')return [];
    const physical=physicalStation(room,unit),identity=unit.characterId||unit.id,out=[];
    for(const home of (room?.starships||[]).filter(s=>s.ship?.sicInventory?.some(i=>i.type==='remote-controller')))for(const item of maps.installedItems(home).filter(i=>maps.definition(i.type).remoteController&&online(i))){
      const powered=ship=>maps.installedItems(ship).some(i=>online(i)&&Number(maps.definition(i.type).output)>0);if(!powered(home))continue;
      const state=home.ship.remoteState?.controllers?.[item.id]||{},carried=state.holder===identity,local=physical?.ship.id===home.id&&physical.cell.sicId===item.id;
      if(!carried&&!local)continue;
      const origin=(room.shipPositions||[]).find(p=>p.id===unit.location?.starshipId);
      const links=(room.starships||[]).filter(target=>{
        if(target.currentHullHp<=0||target.escapedAt||!powered(target))return false;
        const receiver=maps.installedItems(target).find(i=>maps.definition(i.type).remoteReceiver&&online(i)&&maps.addonHost(target,i));
        const hacked=carried&&receiver&&(room.hackingGrants||unit.hackingSessions||[]).some(g=>(g.unitId===unit.id||g.control&&g.connected)&&g.targetId===target.id&&g.sicId===receiver.id);
        if(target.id!==home.id&&(!receiver||!state.links?.includes(target.id)&&!hacked))return false;
        const point=(room.shipPositions||[]).find(p=>p.id===target.id),same=target.id===unit.location?.starshipId;
        return same||Boolean(origin&&point&&Math.max(Math.abs(point.q-origin.q),Math.abs(point.r-origin.r),Math.abs(point.q+point.r-origin.q-origin.r))<=10);
      });out.push({home,item,state,carried,links});
    }return out;
  }
  function station(room,unit){
    const physical=physicalStation(room,unit);if(physical)return physical;
    const remote=remotes(room,unit).find(r=>r.carried);if(!remote)return null;
    const layout=maps.buildLayout(remote.home.ship),cell=[...layout.footprint.values()].find(c=>c.sicId===remote.item.id);if(!cell)return null;
    return {ship:remote.home,cell,key:`portable:${unit.id}:${remote.item.id}`,portable:true};
  }
  function consoles(room, unit) {
    const seat = station(room, unit);
    if (!seat) return [];
    const ship = seat.ship.ship || seat.ship, inventory = new Map((ship.sicInventory || []).map(i => [i.id, i]));
    const available = (ship.placements || []).flatMap(p => {
      const item = inventory.get(p.sicId), definition = maps.componentDefinition(item);
      if ((!online(item) && typeof window === 'undefined') || item?.status==='destroyed' || (!definition.shipControl && !definition.shield && !definition.sensor && !definition.weapon && !definition.lockOn && !definition.utility && !definition.hacking)) return [];
      const remote = seat.cell.sicId !== item.id;
      if (remote && (!maps.definition(seat.cell.type).bridge||definition.localOnly)) return [];
      const offline=!online(item);
      const blocked=offline||Boolean(seat.ship.hackedSystems?.some(h=>h.bridge||h.sicId===item.id&&!definition.remoteReceiver));
      return [{ id: item.id, item, definition, ship: seat.ship, remote, seat, blocked, offline, kind: definition.hacking ? 'hacking' : definition.utility ? 'utility' : definition.lockOn ? 'lock' : definition.weapon ? 'weapon' : definition.sensor ? 'sensor' : definition.shield ? 'shield' : 'pilot' }];
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
    for(const remote of remotes(room,unit)){
      if(!available.some(a=>a.id===remote.item.id))available.push({id:remote.item.id,item:remote.item,definition:maps.definition(remote.item.type),ship:remote.home,seat,remote:false,kind:'utility'});
      const target=remote.links.find(s=>s.id===remote.state.selected?.[unit.characterId||unit.id]);if(!target)continue;
      if(!maps.installedItems(target).some(i=>maps.definition(i.type).bridge&&online(i)))continue;
      for(const item of maps.installedItems(target)){
        const definition=maps.componentDefinition(item);if(!online(item)||definition.localOnly||definition.remoteController||definition.remoteReceiver||available.some(a=>a.id===item.id))continue;
        const kind=definition.shipControl?'pilot':definition.hacking?'hacking':definition.weapon?'weapon':definition.lockOn?'lock':definition.shield?'shield':definition.sensor?'sensor':definition.utility?'utility':null;
        if(kind)available.push({id:item.id,item,definition,ship:target,remote:true,controlled:true,remotePilot:true,controlSource:target,seat,kind});
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
  return { physicalStation, remotes, station, consoles, access, online, conscious, adjustInputs };
}));
