const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const maps = require("../ship-map-core");
const power = require("../ship-power");
const { syncUnitCombat } = require("../combat-engine");

function ship(tier = 4, id = "ship") {
  return { id, ship: {
    gridCells: Array.from({ length: tier * tier }, (_, i) => Math.floor(i / tier) * 20 + i % tier),
    placements: [{ sicId: "core", cell: 0 }], sicInventory: [{ id: "core", type: `au-engine-${tier}` }],
  } };
}

test("all six AU SICs match printed ratings, footprints, stations, and supplied art", () => {
  const outputs = [3, 7, 15, 25, 40, 60], stations = [1, 2, 2, 3, 3, 4];
  const prices = [1200, 2800, 6000, 10000, 16000, 24000], thresholds = [8, 11, 16, 20, 27, 33];
  for (let tier = 1; tier <= 6; tier++) {
    const def = maps.definition(`au-engine-${tier}`);
    assert.equal(def.auOutput, outputs[tier - 1]);
    assert.equal(def.output, 0);
    assert.equal(def.width, tier); assert.equal(def.height, tier);
    assert.equal(def.price, prices[tier - 1]); assert.equal(def.threshold, thresholds[tier - 1]);
    assert.equal(def.stations.length, stations[tier - 1]);
    for (const asset of [`au-engine-${tier}-graphic.png`, def.image.split("?")[0]]) {
      assert.ok(fs.statSync(path.join(__dirname, "..", asset)).size > 1000);
    }
    const layout = maps.buildLayout(ship(tier).ship);
    assert.equal(layout.footprint.size, tier * tier);
    assert.equal([...layout.footprint.values()].filter(cell => cell.blocked).length, tier < 3 ? 0 : tier % 2 ? 1 : 4);
    for (const station of def.stations) assert.equal(layout.footprint.get(station.y * 20 + station.x).blocked, false);
    const html = [...layout.hull].map(cell => maps.boundaryMarkup(layout, cell)).join("");
    assert.ok(html.includes("sa-map-wall"));
  }
});

test("25 AU recharges one point in four combat seconds, caps, and preserves fractional progress", () => {
  const room = { starships: [ship()], units: [] };
  power.refresh(room);
  assert.deepEqual(room.starships[0].auState, { current: 25, maximum: 25, rate: 25, progress: 0 });
  assert.ok(power.spend(room, "ship", 3));
  power.advance(room, 3.9);
  assert.equal(room.starships[0].auState.current, 22);
  power.advance(room, .1);
  assert.equal(room.starships[0].auState.current, 23);
  assert.ok(room.starships[0].auState.progress < 1e-8);
  power.advance(room, 1000);
  assert.equal(room.starships[0].auState.current, 25);
  assert.equal(room.starships[0].auState.progress, 0);
  for (const amount of [0, -1, 1.5, 26, NaN]) assert.equal(power.spend(room, "ship", amount), false);
  assert.equal(power.spend(room, "missing", 1), false);
});

test("station bonuses require an actual unique occupied station on an online SIC", () => {
  const record = ship();
  const station = maps.definition("au-engine-4").stations[0];
  const unit = { engineeringSkill: 4, classId: "engineer", intellectDice: [6, 8],
    location: { starshipId: "ship", sicId: "core", square: station.x + station.y * 20, mesh: station.mesh, stationed: true } };
  assert.equal(power.output(record, [unit]).au, 37);
  assert.equal(power.output(record, [unit, structuredClone(unit)]).au, 37);
  assert.equal(power.output(record, [{ ...unit, location: { ...unit.location, mesh: 4 } }]).au, 25);
  assert.equal(power.output(record, [{ ...unit, location: { ...unit.location, starshipId: "enemy" } }]).au, 25);
  assert.equal(power.output(record, [{ ...unit, defeatedAt: 1 }]).au, 25);
  record.ship.sicInventory[0].status = "impaired";
  assert.equal(power.output(record, [unit]).au, 0);
});

test("lower output clamps AU, impairment stops recharge, and repairs do not refill the reserve", () => {
  const record = ship(), room = { starships: [record], units: [] };
  power.refresh(room);
  record.ship.sicInventory[0].type = "au-engine-2";
  power.refresh(room);
  assert.equal(record.auState.current, 7);
  record.ship.sicInventory[0].impaired = true;
  power.advance(room, 1000);
  assert.deepEqual(record.auState, { current: 0, maximum: 0, rate: 0, progress: 0 });
  record.ship.sicInventory[0].impaired = false;
  power.refresh(room);
  assert.equal(record.auState.current, 0);
  power.refresh(room, { reset: true });
  assert.equal(record.auState.current, 7);
});

test("independent ships preserve recharge through serialized snapshots and split ticks", () => {
  const room = { starships: [ship(4, "a"), ship(2, "b")], units: [] };
  power.refresh(room); power.spend(room, "a", 10); power.spend(room, "b", 5);
  for (let i = 0; i < 60; i++) power.advance(room, 1 / 60);
  const restored = JSON.parse(JSON.stringify(room));
  power.advance(restored, 3);
  assert.equal(restored.starships[0].auState.current, 16);
  assert.ok(restored.starships[0].auState.progress < 1e-8);
  assert.equal(restored.starships[1].auState.current, 2);
  assert.ok(Math.abs(restored.starships[1].auState.progress - 28) < 1e-8);
});

test("campaign stations use computed Engineering and resolve SIC identity from the map", () => {
  const record = ship(1);
  record.characterLocations = { pc: { square: 0, mesh: 1, stationed: true } };
  const characters = [{ id: "pc", character: { computed: { skills: { Engineering: 3 } }, identity: { classId: "engineer" }, attributes: { intellect: [1, 2] } } }];
  assert.equal(power.output(record, power.campaignUnits(record, characters)).au, 14);
});

test("NPC station bonuses use their general mental skill when no Engineering override exists", () => {
  const record = ship(1), unit = { team: "npc", mentalSkill: 3 };
  syncUnitCombat(unit, { mentalSkill: 3, location: { starshipId: record.id, sicId: "core", square: 0, mesh: 1, stationed: true } });
  assert.equal(power.output(record, [unit]).au, 6);
});
