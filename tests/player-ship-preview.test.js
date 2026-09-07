const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

test("player destination selection updates in place and cannot change during submission", () => {
  const source = fs.readFileSync(path.join(__dirname, "../character.js"), "utf8");
  const start = source.indexOf("function previewPlayerShipDestination(");
  const end = source.indexOf("function setPlayerShipDoorVisual(", start);
  let refreshes = 0;
  const context = vm.createContext({
    starshipMoveDraft: { starshipId: "ship", start: 189, startMesh: 4 },
    playerShipPath: () => [190],
    playerShipStationAt: () => null,
    refreshPlayerShipPreview: () => { refreshes += 1; },
    renderPlayerStarships: () => { throw new Error("Replacing map buttons loses pointer clicks"); },
  });
  vm.runInContext(source.slice(start, end), context);
  context.previewPlayerShipDestination({ id: "ship" }, "pc", 190, 0, true);
  assert.equal(context.starshipMoveDraft.locked, true);
  assert.equal(context.starshipMoveDraft.destinationMesh, 0);
  assert.equal(refreshes, 1);
  context.starshipMoveDraft.submitting = true;
  context.previewPlayerShipDestination({ id: "ship" }, "pc", 191, 4, true);
  assert.equal(context.starshipMoveDraft.destination, 190);
  assert.equal(refreshes, 1);
});
