(function(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./station-access') : root.SAStationAccess,
    typeof module !== 'undefined' && module.exports ? require('./ship-map-core') : root.SAShipMap,
    typeof module !== 'undefined' && module.exports ? require('./ship-power') : root.SAShipPower);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAShipShields = api;
}(typeof window !== 'undefined' ? window : null, function(stations, maps, power) {
  const INPUT_SECONDS = 1.5, PROTECTION_SECONDS = 12, EPS = 1e-8;
  const number = x => Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0;
  const impaired = item => item.impaired || item.status === 'impaired';
  function crew(room, shipId, sicId) {
    const occupied = new Set();
    return (room.units || []).filter(unit => {
      const seat = stations.station(room, unit);
      if (!seat || seat.ship.id !== shipId || seat.cell.sicId !== sicId || occupied.has(seat.key)) return false;
      occupied.add(seat.key); return true;
    });
  }
  function staffing(units) {
    const bars = units.reduce((sum, unit) => {
      const level = Math.floor(number(unit.engineeringSkill ?? (unit.team === 'npc' ? unit.mentalSkill : 0)));
      return sum + (level >= 6 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : level >= 1 ? 1 : 0);
    }, 0);
    return { Ingenuity: Math.min(4, bars), Efficiency: Math.min(4, Math.max(0, bars - 4) / 2), Performance: Math.min(4, Math.max(0, bars - 12) / 4) };
  }
  function timing(seconds, factors) {
    let flat = 0, percent = 0;
    for (const value of Object.values(factors)) {
      const portions = [0, 1, 2, 3].map(i => Math.max(0, Math.min(1, value - i)));
      flat += portions[0] * 2 + portions[1] * 3;
      percent += portions[2] * .16 + portions[3] * .33;
    }
    return 100 / ((100 / seconds + flat) * (1 + percent));
  }
  function entries(ship) {
    const data = ship.ship || ship, installed = new Set((data.placements || []).map(p => p.sicId));
    return (data.sicInventory || []).filter(i => installed.has(i.id) && maps.definition(i.type).shield)
      .map(item => ({ item, definition: maps.componentDefinition(item), state: ship.shieldSystems?.[item.id] }));
  }
  function totals(ship) {
    const list = entries(ship);
    if (!list.length && !ship.shieldSystems) return;
    ship.maximumShieldHp = list.reduce((n, e) => n + (stations.online(e.item) ? e.definition.shieldHp : 0), 0);
    ship.currentShieldHp = list.reduce((n, e) => n + (stations.online(e.item) ? number(e.state?.hp) : 0), 0);
  }
  function refresh(room, { reset = false } = {}) {
    for (const unit of room.units || []) unit.shieldRestabilizing = null;
    for (const ship of room.starships || []) {
      const list = entries(ship);
      if (!list.length && !ship.shieldSystems) continue;
      ship.shieldSystems ||= {};
      ship.auCommands = reset ? [] : ship.auCommands || [];
      const ids = new Set(list.map(e => e.item.id));
      for (const id of Object.keys(ship.shieldSystems)) if (!ids.has(id)) delete ship.shieldSystems[id];
      for (const { item, definition: d } of list) {
        let s = ship.shieldSystems[item.id];
        if (!s || reset) s = ship.shieldSystems[item.id] = { hp: d.shieldHp, regeneration: 0, protection: 0, protectionRemaining: 0, restabilization: null };
        s.hp = Math.min(d.shieldHp, number(s.hp));
        const people = crew(room, ship.id, item.id);
        s.factors = staffing(people);
        s.regenerationSeconds = timing(12, s.factors);
        s.restoreSeconds = timing(d.restabilizeSeconds, s.factors);
        if (s.restabilization) {
          const usable = stations.online(item) && !impaired(item) && people.length > 0;
          s.restabilization.paused = !usable ? people.length ? 'System unavailable' : 'Local operator required' : number(s.restabilization.funded) <= EPS && powerAvailable(ship) < 1 ? 'Waiting for AU' : '';
          for (const unit of people) unit.shieldRestabilizing = { shipId: ship.id, sicId: item.id };
        }
      }
      ship.auCommands = ship.auCommands.filter(c => {
        const unit = room.units?.find(u => u.id === c.unitId), access = stations.access(room, unit, c.sicId);
        return access && access.ship.id === ship.id && access.seat.key === c.station && !impaired(access.item);
      });
      totals(ship);
    }
    power.refresh(room);
  }
  function powerAvailable(ship) { return Math.max(0, number(ship.auState?.current) - (ship.auCommands || []).reduce((n, c) => n + number(c.cost), 0)); }
  function command(room, unit, body) {
    refresh(room);
    const access = stations.access(room, unit, String(body.sicId || ''));
    if (!access || access.kind !== 'shield') return { ok: false, error: 'Remain at this shield or an operational cockpit/bridge.' };
    const { ship, item, definition: d } = access, s = ship.shieldSystems[item.id];
    if (impaired(item)) return { ok: false, error: 'Impaired shields cannot use AU abilities.' };
    const requestId = String(body.requestId || '');
    if (!/^[\w-]{8,100}$/.test(requestId)) return { ok: false, error: 'Invalid shield command receipt.' };
    ship.shieldReceipts ||= [];
    if (ship.shieldReceipts.includes(requestId)) return { ok: true, duplicate: true };
    if (unit.delayedAction?.sensorOrder || unit.delayedAction?.shipOrder) return {ok:false,error:'Finish the current console input first.'};
    if ((room.starships || []).some(r => r.auCommands?.some(c => c.unitId === unit.id))) return { ok: false, error: 'Finish the pending AU command first.' };
    const kind = body.kind;
    if (kind === 'restabilize') {
      if (access.remote) return { ok: false, error: 'Restabilization requires physical presence at the shield.' };
      if (s.hp > 0 || s.restabilization) return { ok: false, error: 'Only a burst shield can begin restabilization.' };
      if (crew(room, ship.id, item.id).some(u => u.delayedAction || u.delayTimer || u.timedAction)) return { ok: false, error: 'Local operators must finish their current actions first.' };
      s.restabilization = { progress: 0, funded: 0, auSpent: 0, paused: '' };
      for (const person of crew(room, ship.id, item.id)) { person.consoleHold = null; person.commandCarrySeconds = null; }
    } else {
      if (!['restore', 'reinforce'].includes(kind)) return { ok: false, error: 'Unknown shield action.' };
      if (!Number.isInteger(body.amount) || body.amount < 1 || body.amount > 100) return { ok: false, error: 'Choose 1 to 100 AU purchases.' };
      if (s.hp <= 0 || s.restabilization) return { ok: false, error: 'Restabilize this shield before using AU boosts.' };
      if (kind === 'restore' && body.amount > Math.ceil(d.shieldHp - s.hp)) return { ok: false, error: 'That purchase exceeds the missing Shield HP.' };
      const cost = body.amount * (kind === 'restore' ? 5 : 3);
      if (cost > powerAvailable(ship)) return { ok: false, error: 'not enough Auxiliary power' };
      ship.auCommands.push({ unitId: unit.id, sicId: item.id, kind, amount: body.amount, cost, remaining: INPUT_SECONDS, station: access.seat.key, requestId });
    }
    ship.shieldReceipts = [...ship.shieldReceipts, requestId].slice(-256);
    refresh(room);
    return { ok: true, ship };
  }
  function advanceInputs(room, seconds) {
    refresh(room);
    if (room.hardPaused || room.holdPaused || !(seconds > 0)) return [];
    const finished = [];
    for (const ship of room.starships || []) for (const c of [...(ship.auCommands || [])]) {
      c.remaining = Math.max(0, c.remaining - seconds);
      if (c.remaining > EPS) continue;
      ship.auCommands = ship.auCommands.filter(other => other !== c);
      const e = entries(ship).find(e => e.item.id === c.sicId), s = e?.state;
      if (!s || s.hp <= 0 || s.restabilization) continue;
      // Removing this reservation permits exactly its reserved AU to be committed.
      if (!power.spend(room, ship.id, c.cost)) continue;
      if (c.kind === 'restore') s.hp = Math.min(e.definition.shieldHp, s.hp + c.amount);
      else { s.protection = (s.protectionRemaining > EPS ? s.protection : 0) + c.amount; if (s.protectionRemaining <= EPS) s.protectionRemaining = PROTECTION_SECONDS; }
      totals(ship); finished.push({ shipId: ship.id, unitId: c.unitId, kind: c.kind });
    }
    refresh(room); return finished;
  }
  function damage(room, shipId, amount) {
    refresh(room);
    const ship = room.starships?.find(s => s.id === shipId);
    if (!ship || !Number.isFinite(amount) || amount < 0) return false;
    const active = entries(ship).filter(e => stations.online(e.item) && e.state.hp > 0);
    if (!active.length) ship.currentHullHp = Math.max(0, number(ship.currentHullHp) - amount);
    else {
      const reduction = active.reduce((n, e) => n + e.definition.shieldReduction + (e.state.protectionRemaining > EPS ? e.state.protection : 0), 0);
      let damage = Math.max(0, amount - reduction) * (active.some(e => impaired(e.item)) ? 2 : 1);
      for (const e of active) { const loss = Math.min(e.state.hp, damage); e.state.hp -= loss; damage -= loss; if (!e.state.hp) { e.state.regeneration = 0; e.state.protection = 0; e.state.protectionRemaining = 0; } }
      // Burst shields discard overflow instead of allowing the same hit to damage hull.
    }
    refresh(room); return true;
  }
  function advance(room, seconds) {
    refresh(room);
    let left = number(seconds);
    // Split at AU recharge, prepaid-work exhaustion and completion boundaries.
    while (left > EPS) {
      let step = left;
      const recovering = [];
      for (const ship of room.starships || []) {
        const au = ship.auState;
        if (au?.rate > 0 && au.current < au.maximum) step = Math.min(step, (100 - au.progress) / au.rate);
        for (const e of entries(ship)) {
          const s = e.state, r = s.restabilization;
          if (!r || !stations.online(e.item) || impaired(e.item) || !crew(room, ship.id, e.item.id).length) continue;
          if (r.funded <= EPS && r.progress < 1 - EPS && power.spend(room, ship.id, 1)) { r.funded = 1 / e.definition.restabilizeAu; r.auSpent++; }
          if (r.funded > EPS) {
            const rate = 1 / s.restoreSeconds;
            step = Math.min(step, r.funded / rate, (1 - r.progress) / rate);
            recovering.push({ r, s, rate, e, ship });
          }
        }
      }
      if (step < EPS) step = Math.min(left, EPS);
      for (const ship of room.starships || []) for (const { item, definition: d, state: s } of entries(ship)) {
        s.protectionRemaining = Math.max(0, number(s.protectionRemaining) - step);
        if (s.protectionRemaining <= EPS) { s.protectionRemaining = 0; s.protection = 0; }
        if (stations.online(item) && s.hp > 0 && !s.restabilization) s.hp = Math.min(d.shieldHp, s.hp + d.shieldRegeneration * step / s.regenerationSeconds);
      }
      for (const { r, s, rate, e, ship } of recovering) {
        const work = Math.min(r.funded, 1 - r.progress, rate * step);
        r.progress += work; r.funded = Math.max(0, r.funded - work);
        if (r.progress >= 1 - EPS) {
          s.hp = e.definition.shieldHp; s.restabilization = null;
          for (const u of crew(room, ship.id, e.item.id)) { u.atb = 0; u.shieldRestabilizing = null; }
        }
      }
      power.advance(room, step); left -= step;
    }
    refresh(room);
  }
  return { INPUT_SECONDS, PROTECTION_SECONDS, crew, staffing, timing, entries, refresh, command, advanceInputs, advance, damage, powerAvailable };
}));
