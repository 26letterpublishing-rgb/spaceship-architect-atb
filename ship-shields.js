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
  function recoveryOptions(ship, item) {
    const active = type => maps.attachments(ship, item.id, type).some(a => !a.storage && !a.pendingDisposition && stations.online(a) && !impaired(a) && maps.addonHost(ship,a));
    return {burst:active('burst-shield-reactivator'), emergency:active('emergency-shield-recharger')};
  }
  function prepareRecovery(ship, entry) {
    const s=entry.state, options=recoveryOptions(ship,entry.item);
    if(!s)return;
    if(s.hp>0||s.restabilization||!options.burst&&!options.emergency){s.addonRecovery=null;return;}
    const r=s.addonRecovery ||= {elapsed:0, funded:0, credit:0, auSpent:0};
    Object.assign(r,options,{total:options.emergency?48:120});
    r.paused=!stations.online(entry.item)||impaired(entry.item)||maps.gravityFieldActive(ship)||ship.ship?.warpState?.phase==='traveling'?'Shield unavailable':ship.ship?.cleanserState?.phase==='charging'?'Planetary Cleanser has priority':'';
  }
  // Add-ons recover their own layer. Manual local restabilization retains its
  // existing full-HP result; automatic recovery does not freeze an operator.
  function fundRecovery(ship, entry) {
    const r=entry.state?.addonRecovery, meter=ship.auState;
    if(!r||r.paused||!meter)return;
    const reserved=(ship.auCommands||[]).reduce((n,c)=>n+number(c.cost),0);
    const available=Math.max(0,meter.current-reserved);
    if(r.emergency){
      const used=r.burst?Math.min(available,Math.max(0,2-r.credit)):0;
      r.credit+=used;meter.current-=available;r.auSpent+=available;
    }
    if(r.burst&&r.funded<=EPS){
      if(r.emergency&&r.credit>=2){r.credit-=2;r.funded=12;}
      else if(!r.emergency&&available>=2){meter.current-=2;r.auSpent+=2;r.funded=12;}
    }
    meter.available=r.emergency?0:Math.max(0,meter.current-reserved);
  }
  function totals(ship) {
    const list = entries(ship);
    if (!list.length && !ship.shieldSystems) return;
    ship.maximumShieldHp = list.reduce((n, e) => n + (stations.online(e.item) ? e.definition.shieldHp : 0), 0);
    ship.currentShieldHp = maps.gravityFieldActive(ship)?0:list.reduce((n, e) => n + (stations.online(e.item) ? number(e.state?.hp) : 0), 0);
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
      for(const entry of entries(ship))prepareRecovery(ship,entry);
      ship.auCommands = ship.auCommands.filter(c => {
        const unit = room.units?.find(u => u.id === c.unitId), access = stations.access(room, unit, c.sicId);
        return access && !access.blocked && access.ship.id === ship.id && access.seat.key === c.station && !impaired(access.item);
      });
      totals(ship);
    }
    power.refresh(room);
  }
  function powerAvailable(ship) { if(Object.values(ship.shieldSystems||{}).some(s=>s.addonRecovery?.emergency&&!s.addonRecovery.paused))return 0; return Math.max(0, number(ship.auState?.current) - (ship.auCommands || []).reduce((n, c) => n + number(c.cost), 0)); }
  function command(room, unit, body) {
    refresh(room);
    const access = stations.access(room, unit, String(body.sicId || ''));
    if (!access || access.blocked || access.kind !== 'shield') return { ok: false, error: 'Remain at an available shield station or operational cockpit/bridge.' };
    const { ship, item, definition: d } = access, s = ship.shieldSystems[item.id];

    if(maps.gravityFieldActive(ship))return {ok:false,error:'Deactivate Gravity Absolution Field to restore shield protection.'};
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
      ship.auCommands.push({ unitId: unit.id, sicId: item.id, kind, amount: body.amount, cost, remaining: INPUT_SECONDS*(access.remote?1:.9), station: access.seat.key, requestId });
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
      for(const entry of entries(ship))prepareRecovery(ship,entry);
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
  function damage(room, shipId, amount, options={}) {
    refresh(room);
    const ship = room.starships?.find(s => s.id === shipId);
    if (!ship || !Number.isFinite(amount) || amount < 0) return false;
    const active = maps.gravityFieldActive(ship)?[]:entries(ship).filter(e => stations.online(e.item) && e.state.hp > 0);
    if (!active.length || options.bypassShield) ship.currentHullHp = Math.max(0, number(ship.currentHullHp) - (options.ignoreReduction?amount:maps.hullDamage(ship, amount, options.damageType)));
    else {
      // Each attack reaches one field: lowest current HP, then inventory order on a tie.
      const struck = active.reduce((first, next) => next.state.hp < first.state.hp ? next : first);
      const s = struck.state;
      const reduction = struck.definition.shieldReduction + (s.protectionRemaining > EPS ? s.protection : 0);
      const damage = Math.max(0, amount - reduction) * (impaired(struck.item) ? 2 : 1);
      s.hp = Math.max(0, s.hp - damage);
      if (!s.hp) { s.regeneration = 0; s.protection = 0; s.protectionRemaining = 0; }
      // A burst discards this hit's excess before it can reach another shield or Hull.
    }
    refresh(room); return true;
  }
  function advance(room, seconds) {
    refresh(room);
    if(room.hardPaused||room.holdPaused)return;
    let left = number(seconds);
    // Split at AU recharge, prepaid-work exhaustion and completion boundaries.
    while (left > EPS) {
      let step = left;
      const recovering = [];
      const automatic = [];
      for (const ship of room.starships || []) {
        const au = ship.auState;
        if (au?.rate > 0 && au.current < au.maximum) step = Math.min(step, (100 - au.progress) / au.rate);
        for (const e of entries(ship)) {
          const s = e.state, r = s.restabilization;
          fundRecovery(ship,e);
          if(au?.rate>0&&au.current<au.maximum)step=Math.min(step,(100-au.progress)/au.rate);
          const auto=s.addonRecovery;
          if(auto&&!auto.paused&&(!auto.burst||auto.funded>EPS)){
            step=Math.min(step,Math.max(EPS,auto.total-auto.elapsed),auto.burst?auto.funded:Infinity);
            automatic.push({s,auto,e,ship});
          }
          if (maps.gravityFieldActive(ship) || !r || !stations.online(e.item) || impaired(e.item) || !crew(room, ship.id, e.item.id).length) continue;
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
        if (!maps.gravityFieldActive(ship) && stations.online(item) && s.hp > 0 && !s.restabilization) s.hp = Math.min(d.shieldHp, s.hp + d.shieldRegeneration * step / s.regenerationSeconds);
      }
      for (const { r, s, rate, e, ship } of recovering) {
        const work = Math.min(r.funded, 1 - r.progress, rate * step);
        r.progress += work; r.funded = Math.max(0, r.funded - work);
        if (r.progress >= 1 - EPS) {
          s.hp = e.definition.shieldHp; s.restabilization = null;
          for (const u of crew(room, ship.id, e.item.id)) { u.atb = 0; u.shieldRestabilizing = null; }
        }
      }
      for(const {s,auto,e} of automatic){
        auto.elapsed+=step;if(auto.burst)auto.funded=Math.max(0,auto.funded-step);
        if(auto.elapsed>=auto.total-EPS){s.hp=auto.burst?Math.ceil(e.definition.shieldHp/3):1;s.addonRecovery=null;}
      }
      power.advance(room, step);
      for(const {auto,ship,e,s} of automatic)if(auto.emergency){
        if(s.addonRecovery)fundRecovery(ship,e);
        else {ship.auState.current=0;ship.auState.available=0;ship.auState.progress=0;}
      }
      left -= step;
    }
    refresh(room);
  }
  return { INPUT_SECONDS, PROTECTION_SECONDS, crew, staffing, timing, entries, refresh, command, advanceInputs, advance, damage, powerAvailable };
}));
