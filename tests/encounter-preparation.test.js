const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePreparation } = require("../encounter-preparation");
const { CampaignApi } = require("../campaign-api");
const { details } = require("../crew-overview");
const health = require("../health-display");

const ship = { id: "ship-a", title: "Wayfinder", ship: { gridCells: [0], placements: [], sicInventory: [] } };
const campaign = { starships: [ship], characters: [{ id: "pc-a", approved: true }], npcRoster: [] };
const setup = { preparationId: "test-prepare-001", mode: "starship", starships: [ship], shipDistances: [], units: [{ team: "pc", characterId: "pc-a", location: { starshipId: ship.id, square: 0, mesh: 4 } }] };
const validate = body => validatePreparation(body, campaign, ships => structuredClone(ships));

test("preparation validates a whole roster without changing its input", () => {
  const before = structuredClone(setup);
  assert.equal(validate(setup).units.length, 1);
  assert.deepEqual(setup, before);
  for (const invalid of [
    { units: [] }, { units: [...setup.units, ...setup.units] }, { mode: "surface" },
    { starships: [] }, { starships: [ship, ship] }, { shipDistances: [{ a: "ship-a", b: "unknown", units: 3 }] },
    { units: [{ ...setup.units[0], characterId: "not-approved" }] },
    { units: [{ ...setup.units[0], location: { starshipId: "unknown", square: 0, mesh: 4 } }] },
    { units: [{ team: "npc", npcRosterId: "not-in-roster", location: setup.units[0].location }] },
  ]) assert.throws(() => validate({ ...setup, ...invalid }));
});

test("preparation distributes overlapping starts and never overfills a square", () => {
  const units = Array.from({ length: 18 }, (_, index) => ({ team: "npc", preparationUnitId: `npc-${index}`, location: setup.units[0].location }));
  const result = validate({ ...setup, units });
  const counts = new Map();
  for (const unit of result.units) counts.set(unit.location.mesh, (counts.get(unit.location.mesh) || 0) + 1);
  assert.equal(counts.size, 9);
  assert.ok([...counts.values()].every(count => count === 2));
  assert.throws(() => validate({ ...setup, units: [...units, { ...units[0], preparationUnitId: "overflow" }] }), /floor space/);
});

test("failed durable encounter saves leave the cached battle intact and can retry", async () => {
  let fail = true;
  let stored;
  const api = new CampaignApi({ store: { save: async value => { if (fail) throw new Error("storage offline"); stored = structuredClone(value); } } });
  const record = { code: "TEST", revision: 1, encounter: { units: [{ id: "old" }] }, npcRoster: [] };
  api.campaignCache.set("TEST", record);
  const next = { preparations: [{ id: "saved-retry-key", fingerprint: "fingerprint" }], units: [{ id: "new", team: "npc" }] };
  await assert.rejects(api.saveEncounter("TEST", next), /storage offline/);
  assert.equal(record.encounter.units[0].id, "old");
  assert.deepEqual(record.npcRoster, []);
  fail = false;
  await api.saveEncounter("TEST", next);
  assert.deepEqual(stored.encounter.preparations, next.preparations);
  assert.equal(record.encounter.units[0].id, "new");
});

test("preparation accepts an occupied station only once", () => {
  const engine = { ...ship, ship: { ...ship.ship, placements: [{ sicId: "engine", cell: 0 }], sicInventory: [{ id: "engine", type: "en-engine-1" }] } };
  const stationUnit = { team: "npc", preparationUnitId: "station-one", location: { starshipId: ship.id, square: 0, mesh: 1, stationed: true } };
  const prepare = units => validatePreparation({ ...setup, starships: [engine], units }, campaign, ships => structuredClone(ships));
  assert.equal(prepare([stationUnit]).units[0].location.sicId, "engine");
  assert.throws(() => prepare([stationUnit, { ...stationUnit, preparationUnitId: "station-two" }]), /unoccupied station/);
});

test("crew overview distinguishes membership from actual location and station", () => {
  const ships = [{ ...ship, crewCharacterIds: ["pc-a"] }, { id: "ship-b", title: "Red Horizon", ship: { sicInventory: [{ id: "engine", type: "en-engine-1" }] } }];
  const result = details("pc-a", false, ships, [{ characterId: "pc-a", location: { starshipId: "ship-b", square: 3, mesh: 0, sicId: "engine", stationed: true } }]);
  assert.equal(result.assigned, "Wayfinder");
  assert.match(result.location, /Red Horizon/);
  assert.match(result.station, /EN ENGINE 1/);
  assert.match(details("pc-a", false, [{ ...ships[0], characterLocations: { "pc-a": { square: 0, mesh: 0 } } }]).location, /Wayfinder/);
});

test("player health indicators and log totals hide exact numbers while GM retains them", () => {
  assert.doesNotMatch(health.track("hull", 17, 31), /17|31/);
  assert.match(health.track("hull", 17, 31, true), /17\/31/);
  assert.deepEqual(health.segments(0, 31), ["empty", "empty", "empty"]);
  const log = "Thug took 4 HP damage; HP 17/31.";
  assert.doesNotMatch(health.logText(log, false), /17|31/);
  assert.equal(health.logText(log, true), log);
  assert.doesNotMatch(health.logText("GM set Thug to 17/31 HP.", false), /17|31/);
});
