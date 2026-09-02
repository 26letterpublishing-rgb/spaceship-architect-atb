const test = require("node:test");
const assert = require("node:assert/strict");
const shipMap = require("../ship-map-core.js");

function adjacentFixture() {
  const gridCells = [];
  for (let row = 4; row <= 8; row += 1) for (let column = 4; column <= 11; column += 1) gridCells.push(row * 20 + column);
  return {
    gridCells,
    sicInventory: [
      { id: "engine", type: "en-engine-3" },
      { id: "life", type: "life-support" },
      { id: "nutrition", type: "nutritional-supplement" },
    ],
    placements: [
      { sicId: "engine", cell: 105 },
      { sicId: "life", cell: 108 },
      { sicId: "nutrition", cell: 148 },
    ],
  };
}

test("utility SIC floorplans use their own versioned artwork", () => {
  assert.match(shipMap.definition("life-support").image, /^life-support-floor-plan\.png\?v=/);
  assert.match(shipMap.definition("nutritional-supplement").image, /^nutritional-supplement-floor-plan\.png\?v=/);
  assert.doesNotMatch(shipMap.floorplanStyle("life-support", 1, 1), /hallway/i);
  assert.doesNotMatch(shipMap.floorplanStyle("nutritional-supplement", 0, 0), /hallway/i);
});

test("every exposed Life Support edge resolves to a wall or one shared door", () => {
  const layout = shipMap.buildLayout(adjacentFixture());
  const lifeSquares = [108, 109, 128, 129];
  const perimeterEdges = [];
  for (const square of lifeSquares) for (const side of shipMap.SIDES) {
    const adjacent = square + side.offset;
    if (layout.footprint.get(adjacent)?.sicId === "life") continue;
    perimeterEdges.push(layout.edge(square, adjacent));
  }
  assert.equal(perimeterEdges.length, 8);
  assert.ok(perimeterEdges.every((edge) => edge.kind === "wall" || edge.kind === "door"));
});

test("adjacent SIC pairs receive exactly one doorway apiece", () => {
  const layout = shipMap.buildLayout(adjacentFixture());
  const pairDoors = new Map();
  for (const [square, current] of layout.footprint) for (const side of shipMap.SIDES) {
    const adjacent = square + side.offset;
    const other = layout.footprint.get(adjacent);
    if (!other || other.sicId === current.sicId) continue;
    const edge = layout.edge(square, adjacent);
    if (edge.kind !== "door") continue;
    const pair = [current.sicId, other.sicId].sort().join(":");
    pairDoors.set(pair, (pairDoors.get(pair) || new Set()).add(edge.key));
  }
  assert.deepEqual([...pairDoors.keys()].sort(), ["engine:life", "engine:nutrition", "life:nutrition"]);
  assert.ok([...pairDoors.values()].every((keys) => keys.size === 1));
  assert.equal(layout.connectionDoors.size, 3);
});
