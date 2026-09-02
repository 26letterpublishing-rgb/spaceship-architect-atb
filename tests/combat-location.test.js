const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cancelTimedActionForForcedDelay,
  resolvePlayerCombatAction,
  syncUnitCombat,
  tickCombatTimers,
} = require("../combat-engine");

function location(square, mesh) {
  return { environment: "starship", starshipId: "ship-1", square, mesh, sicId: "", stationed: false };
}

function fixture() {
  const source = {
    id: "pc-1",
    characterName: "Pilot",
    atb: 100,
    speed: 4,
    moveSpeed: 2,
    location: location(0, 0),
  };
  const unit = syncUnitCombat({ ...source }, source);
  const room = { units: [unit], vehicles: [], starships: [], activeId: unit.id, activeSource: "pc", threshold: 100, pausedForTurn: true };
  const helpers = {
    id: () => "action-1",
    clearActiveCommand: () => {},
    pushLog: () => {},
    moveToNextTurnOrClock: () => {},
  };
  return { unit, room, helpers };
}

test("extended starship movement is divided into Move Speed segments", () => {
  const { unit, room, helpers } = fixture();
  const route = [location(0, 1), location(0, 2), location(0, 5), location(0, 8), location(1, 6)];
  const result = resolvePlayerCombatAction(room, unit, { kind: "move", route }, helpers);

  assert.equal(result.ok, true);
  assert.equal(unit.timedAction.units, 2);
  assert.equal(unit.timedAction.total, 3);
  assert.equal(unit.travelRoute.length, 3);

  tickCombatTimers(unit, 3);
  assert.equal(unit.location.square, route[1].square);
  assert.equal(unit.location.mesh, route[1].mesh);
  assert.equal(unit.timedAction.units, 2);
  assert.equal(unit.travelRoute.length, 1);

  tickCombatTimers(unit, 3);
  assert.equal(unit.location.square, route[3].square);
  assert.equal(unit.location.mesh, route[3].mesh);
  assert.equal(unit.timedAction.units, 1);
  assert.equal(unit.timedAction.total, 1.5);

  tickCombatTimers(unit, 1.5);
  assert.equal(unit.location.square, route[4].square);
  assert.equal(unit.location.mesh, route[4].mesh);
  assert.equal(unit.timedAction, null);
  assert.equal(unit.travelRoute.length, 0);
});

test("closed ship doors delay movement and station destinations seat the character", () => {
  const { unit, room, helpers } = fixture();
  room.starships = [{ id: "ship-1", ship: { doorStates: { "0:1": "closed" } } }];
  const destination = { ...location(1, 1), sicId: "engine-1", doorKey: "0:1" };
  const result = resolvePlayerCombatAction(room, unit, {
    kind: "move",
    route: [destination],
    stationOnArrival: true,
    stationName: "EN Engine 1",
    stationSlot: 1,
  }, helpers);

  assert.equal(result.ok, true);
  assert.equal(unit.timedAction.total, 2.1);
  assert.equal(unit.timedAction.doorDelay, 0.6);
  tickCombatTimers(unit, 2.1, 1, room);
  assert.equal(unit.location.square, 1);
  assert.equal(unit.location.stationed, true);
  assert.equal(unit.location.stationSlot, 1);
});

test("a forced delay cancels travel at the last completed location", () => {
  const { unit, room, helpers } = fixture();
  const route = [location(0, 1), location(0, 2), location(0, 5), location(0, 8)];
  resolvePlayerCombatAction(room, unit, { kind: "move", route }, helpers);
  tickCombatTimers(unit, 3);

  assert.equal(unit.location.square, route[1].square);
  assert.equal(unit.location.mesh, route[1].mesh);
  assert.equal(cancelTimedActionForForcedDelay(unit), true);
  assert.equal(unit.timedAction, null);
  assert.equal(unit.travelRoute.length, 0);
  assert.equal(unit.atb, 0);
});
