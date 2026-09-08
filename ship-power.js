(function (root, factory) {
  const api = factory(typeof module !== "undefined" && module.exports ? require("./ship-map-core") : root.SAShipMap);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAShipPower = api;
}(typeof window !== "undefined" ? window : null, function (maps) {
  const AU_SPEED_FACTOR = 1;
  const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

  function output(record, units = []) {
    const ship = record.ship || record;
    const inventory = new Map((ship.sicInventory || []).map(item => [item.id, item]));
    let en = 0, au = 0;
    const online = new Map();
    for (const placement of ship.placements || []) {
      const item = inventory.get(placement.sicId);
      if (!item || item.disabled || ["destroyed", "offline", "powered-down"].includes(item.status)) continue;
      const definition = maps.componentDefinition(item);
      const impaired = item.impaired || item.status === "impaired";
      if (impaired && !definition.impairedAuOnly) continue;
      en += nonnegative(definition.output);
      if (!impaired) au += nonnegative(definition.auOutput);
      if (!impaired) online.set(placement.sicId, { placement, definition });
    }
    const occupied = new Set();
    for (const unit of units) {
      const loc = unit.location;
      if (unit.defeatedAt || !loc?.stationed || loc.starshipId !== record.id) continue;
      const entry = online.get(loc.sicId);
      if (!entry) continue;
      const station = entry.definition.stations?.find(point => entry.placement.cell + point.y * 20 + point.x === Number(loc.square) && point.mesh === Number(loc.mesh));
      const key = `${loc.square}:${loc.mesh}`;
      if (!station || occupied.has(key)) continue;
      occupied.add(key);
      const skill = nonnegative(unit.engineeringSkill ?? (unit.team === "npc" ? unit.mentalSkill : 0));
      if (entry.definition.stationBonus === "au") au += skill;
      else if (entry.definition.stationBonus === "en") en += skill;
      if (unit.classId === "engineer") au += Math.max(0, ...(unit.intellectDice || []).map(nonnegative));
    }
    return { en, au: Math.floor(au) };
  }

  function campaignUnits(record, characters = []) {
    const layout = maps.buildLayout(record.ship || record);
    return characters.map(entry => {
      const character = entry.character || entry;
      const location = record.characterLocations?.[entry.id];
      const placement = location && layout.footprint.get(Number(location.square));
      const skill = character.skills?.Engineering;
      return { id: entry.id, engineeringSkill: character.computed?.skills?.Engineering ?? (typeof skill === "object" ? nonnegative(skill.tenths) / 10 : skill),
        classId: character.identity?.classId,
        intellectDice: (character.attributes?.intellect || []).filter(value => Number(value) >= 0).map(value => [4, 6, 8, 10, 12][Number(value)] || 0),
        location: location ? { ...location, starshipId: record.id, sicId: placement?.sicId || "" } : null };
    });
  }

  function refresh(room, { reset = false } = {}) {
    for (const record of room.starships || []) {
      const maximum = output(record, room.units).au;
      const previous = record.auState;
      const current = reset || !previous ? maximum : Math.min(maximum, Math.floor(nonnegative(previous.current)));
      record.auState = { current, maximum, rate: maximum * AU_SPEED_FACTOR,
        progress: reset || !previous || current >= maximum ? 0 : Math.min(99.999999, nonnegative(previous.progress)) };
    }
  }

  function advance(room, seconds) {
    refresh(room);
    for (const record of room.starships || []) {
      const meter = record.auState;
      if (!meter.rate || meter.current >= meter.maximum) continue;
      const total = meter.progress + nonnegative(seconds) * meter.rate;
      const earned = Math.floor((total + 1e-9) / 100);
      meter.current = Math.min(meter.maximum, meter.current + earned);
      meter.progress = meter.current >= meter.maximum ? 0 : Math.max(0, total - earned * 100);
    }
  }

  function spend(room, shipId, amount) {
    refresh(room);
    const ship = (room.starships || []).find(record => record.id === shipId);
    if (!ship || !Number.isInteger(amount) || amount < 1 || amount > ship.auState.current) return false;
    ship.auState.current -= amount;
    return true;
  }
  return Object.freeze({ AU_SPEED_FACTOR, output, campaignUnits, refresh, advance, spend });
}));
