const { createHash } = require("node:crypto");
const distances = require("./ship-distances");
const shipMap = require("./ship-map-core");

function deployUnits(units, ships) {
  const occupied = new Map();
  const layouts = new Map(ships.map(ship => [ship.id, shipMap.buildLayout(ship.ship)]));
  return units.map(source => {
    const unit = structuredClone(source);
    const layout = layouts.get(unit.location?.starshipId);
    if (!layout) return unit;
    const isStation = (square, mesh) => {
      const footprint = layout.footprint.get(square);
      return footprint?.stations.some(station => station.x === footprint.column && station.y === footprint.row && station.mesh === mesh);
    };
    const available = (square, mesh) => !layout.footprint.get(square)?.blocked && !isStation(square, mesh)
      && (occupied.get(`${unit.location.starshipId}:${square}:${mesh}`) || 0) < 2;
    let { square, mesh } = unit.location;
    if (unit.location.stationed) {
      const key = `${unit.location.starshipId}:${square}:${mesh}`;
      if (!isStation(square, mesh) || occupied.has(key)) throw new Error("Choose an unoccupied station for each stationed character.");
      occupied.set(key, 1);
      unit.location.sicId = layout.footprint.get(square).sicId;
      return unit;
    }
    if (!available(square, mesh)) {
      const free = [...layout.hull].flatMap(cell => Array.from({ length: 9 }, (_, index) => ({ square: cell, mesh: index }))).find(point => available(point.square, point.mesh));
      if (!free) throw new Error("There is not enough unoccupied floor space for this crew.");
      ({ square, mesh } = free);
    }
    unit.location = { ...unit.location, square, mesh, stationed: false, sicId: "" };
    const key = `${unit.location.starshipId}:${square}:${mesh}`;
    occupied.set(key, (occupied.get(key) || 0) + 1);
    return unit;
  });
}

function preparationFingerprint({ mode, starships, units, shipDistances = [] }) {
  return createHash("sha256").update(JSON.stringify({ mode, starships, units, shipDistances })).digest("hex");
}

function validatePreparation(body, campaign, normalizeShips) {
  if (!/^[\w-]{8,100}$/.test(body.preparationId || "")) throw new Error("A preparation request ID is required.");
  const { mode, starships, units, shipDistances = [] } = body;
  if (!["surface", "starship"].includes(mode)) throw new Error("Choose surface or starship combat.");
  if (!Array.isArray(starships) || starships.length > 6 || new Set(starships.map(ship => ship?.id)).size !== starships.length) throw new Error("Choose up to six different starships.");
  if ((mode === "starship") !== Boolean(starships.length)) throw new Error("Starship combat needs ships; surface combat cannot include ships.");
  if (starships.some(ship => !campaign.starships.some(record => record.id === ship?.id))) throw new Error("Every selected ship must be linked to this campaign.");
  if (!Array.isArray(units) || !units.length || units.length > 200) throw new Error("Choose between one and 200 combatants.");
  const normalized = normalizeShips(starships);
  if (normalized.length !== starships.length) throw new Error("Invalid starship selection.");
  const seen = new Set();
  for (const unit of units) {
    if (!unit || !["pc", "npc"].includes(unit.team)) throw new Error("Invalid combatant type.");
    if (unit.team === "pc" && !campaign.characters.some(record => record.id === unit.characterId && record.approved !== false)) throw new Error("Every PC must be approved in this campaign.");
    if (unit.team === "npc" && unit.npcRosterId && !campaign.npcRoster?.some(record => record.id === unit.npcRosterId && record.team === "npc")) throw new Error("That NPC is no longer in the campaign roster.");
    if (unit.team === "npc" && unit.characterId) throw new Error("An NPC cannot use a PC identity.");
    const identity = unit.team === "pc" ? `pc:${unit.characterId}` : unit.npcRosterId ? `npc:${unit.npcRosterId}` : unit.preparationUnitId;
    if (!identity || seen.has(identity)) throw new Error("Choose each combatant only once.");
    seen.add(identity);
    if (mode === "starship") {
      const ship = normalized.find(record => record.id === unit.location?.starshipId);
      if (!ship?.ship.gridCells.includes(unit.location?.square) || !Number.isInteger(unit.location?.mesh) || unit.location.mesh < 0 || unit.location.mesh > 8) throw new Error("Every combatant must begin on a valid square aboard a selected ship.");
    } else if (unit.location?.starshipId || unit.location?.stationed) throw new Error("Surface combatants cannot begin aboard a starship.");
  }
  const pairs = distances.update(normalized, [], shipDistances);
  if (shipDistances.length !== pairs.length) throw new Error("Set a distance for every pair of ships.");
  return { starships: normalized, shipDistances: pairs, units: deployUnits(units, normalized),
    fingerprint: preparationFingerprint(body) };
}

module.exports = { validatePreparation, preparationFingerprint };
