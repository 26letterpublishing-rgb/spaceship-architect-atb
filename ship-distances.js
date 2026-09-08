(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAShipDistances = api;
}(typeof window !== "undefined" ? window : null, function() {
  const key = (a, b) => JSON.stringify([a, b].sort());
  function pairs(ships, saved = []) {
    const values = new Map(saved.map(pair => [key(pair.a, pair.b), pair.units]));
    return ships.flatMap((ship, index) => ships.slice(index + 1).map(other => {
      const value = values.get(key(ship.id, other.id));
      return { a: ship.id, b: other.id, units: Number.isFinite(value) && value >= 0 ? value : 25 };
    }));
  }
  function update(ships, saved, changes) {
    if (!Array.isArray(changes) || changes.length > 15) throw new Error("Choose valid ship distances.");
    const result = pairs(ships, saved);
    const seen = new Set();
    for (const change of changes) {
      const pairKey = key(change.a, change.b);
      const pair = result.find(pair => key(pair.a, pair.b) === pairKey);
      if (!pair || seen.has(pairKey) || typeof change.units !== "number" || !Number.isFinite(change.units) || change.units < 0) throw new Error("Distances must be nonnegative numbers between two selected ships.");
      seen.add(pairKey); pair.units = change.units;
    }
    return result;
  }
  function positions(ships, saved = []) {
    const defaults = [[0,0],[25,0],[0,25],[25,25],[-25,25],[-25,0]];
    return ships.map((ship,index) => {
      const point = saved.find(point => point.id === ship.id);
      const valid = point && [point.q,point.r].every(n => Number.isInteger(n) && Math.abs(n) <= 10000);
      return { id: ship.id, q: valid ? point.q : defaults[index % 6][0], r: valid ? point.r : defaults[index % 6][1] };
    });
  }
  function validatePositions(ships, saved) {
    if (!Array.isArray(saved) || saved.length !== ships.length || new Set(saved.map(p => p?.id)).size !== ships.length || saved.some(p => !ships.some(ship => ship.id === p?.id) || ![p.q,p.r].every(n => Number.isInteger(n) && Math.abs(n) <= 10000))) throw new Error("Place every ship on a valid hex (coordinates -10000 to 10000).");
    return positions(ships,saved);
  }
  function hexDistance(a,b) { return Math.max(Math.abs(a.q-b.q), Math.abs(a.r-b.r), Math.abs(a.q+a.r-b.q-b.r)); }
  function fromPositions(ships, saved) {
    const points = positions(ships,saved);
    return ships.flatMap((ship,i) => ships.slice(i+1).map((other,j) => ({ a:ship.id,b:other.id,units:hexDistance(points[i],points[i+j+1]) })));
  }
  return { key, pairs, update, positions, validatePositions, hexDistance, fromPositions };
}));
