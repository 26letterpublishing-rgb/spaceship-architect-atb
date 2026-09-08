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
  return { key, pairs, update };
}));
