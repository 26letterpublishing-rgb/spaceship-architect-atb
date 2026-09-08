const test = require("node:test");
const assert = require("node:assert/strict");
const distances = require("../ship-distances");
test("six ships produce fifteen symmetric distances defaulting to 25 Units", () => {
  const ships = Array.from({length:6}, (_, i) => ({id:String(i)}));
  const pairs = distances.pairs(ships);
  assert.equal(pairs.length, 15);
  assert.ok(pairs.every(pair => pair.units === 25));
  const next = distances.update(ships, pairs, [{a:"1",b:"0",units:12.5},{a:"0",b:"2",units:0}]);
  assert.equal(next.find(pair => pair.a === "0" && pair.b === "1").units, 12.5);
  assert.equal(next.filter(pair => pair.units === 25).length, 13);
  for (const units of [-1, Infinity, NaN, "12"]) assert.throws(() => distances.update(ships, pairs, [{a:"0",b:"1",units}]));
  assert.throws(() => distances.update(ships, pairs, [{a:"0",b:"0",units:1}]));
  assert.deepEqual(distances.pairs(ships, JSON.parse(JSON.stringify(next))), next);
});
