(function(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./ship-map-core') : root.SAShipMap);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAStationAccess = api;
}(typeof window !== 'undefined' ? window : null, function(maps) {
  const online = item => item && !item.disabled && !['offline', 'powered-down', 'destroyed'].includes(item.status);
  function station(room, unit) {
    const loc = unit?.location, ship = room?.starships?.find(s => s.id === loc?.starshipId);
    if (!ship || unit.defeatedAt || !loc.stationed || unit.timedAction?.kind === 'move') return null;
    const cell = maps.buildLayout(ship.ship || ship).footprint.get(Number(loc.square));
    if (!cell || cell.sicId !== loc.sicId || !online(cell.item)) return null;
    if (!cell.stations.some(p => p.x === cell.column && p.y === cell.row && p.mesh === Number(loc.mesh))) return null;
    return { ship, cell, key: `${ship.id}:${cell.sicId}:${loc.square}:${loc.mesh}` };
  }
  function consoles(room, unit) {
    const seat = station(room, unit);
    if (!seat) return [];
    const ship = seat.ship.ship || seat.ship, inventory = new Map((ship.sicInventory || []).map(i => [i.id, i]));
    return (ship.placements || []).flatMap(p => {
      const item = inventory.get(p.sicId), definition = maps.componentDefinition(item);
      if (!online(item) || (!definition.shipControl && !definition.shield)) return [];
      const remote = seat.cell.sicId !== item.id;
      if (remote && !maps.definition(seat.cell.type).bridge) return [];
      return [{ id: item.id, item, definition, ship: seat.ship, remote, seat, kind: definition.shield ? 'shield' : 'pilot' }];
    });
  }
  const access = (room, unit, sicId) => consoles(room, unit).find(c => c.id === sicId) || null;
  return { station, consoles, access, online };
}));
