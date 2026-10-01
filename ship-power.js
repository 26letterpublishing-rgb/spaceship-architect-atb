(function (root, factory) {
  const api = factory(typeof module !== "undefined" && module.exports ? require("./ship-map-core") : root.SAShipMap);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAShipPower = api;
}(typeof window !== "undefined" ? window : null, function (maps) {
  const AU_SPEED_FACTOR = 1;
  const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  function demand(record){
    const ship=record.ship||record,installed=new Set((ship.placements||[]).map(p=>p.sicId));
    let total=0,shields=0;
    for(const item of ship.sicInventory||[]){
      if(!installed.has(item.id)||item.disabled||['disabled','offline','powered-down','destroyed'].includes(item.status))continue;
      const d=maps.definition(item.type);
      total+=nonnegative(d.energyCost??({'life-support':2,'nutritional-supplement':3}[item.type]||0));
      if(d.shield)total+=5*shields++;
    }
    return total;
  }

  function output(record, units = []) {
    const ship = record.ship || record;
    const inventory = new Map((ship.sicInventory || []).map(item => [item.id, item]));
    let en = 0, au = 0;
    const online = new Map();
    for (const placement of ship.placements || []) {
      const item = inventory.get(placement.sicId);
      if (!item || item.disabled || ["disabled", "destroyed", "offline", "powered-down"].includes(item.status)) continue;
      const definition = maps.componentDefinition(item);
      const impaired = item.impaired || item.status === "impaired";
      if (impaired && !definition.impairedAuOnly && !definition.impairmentImmune) continue;
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
      const station = entry.definition.stations?.find(point => entry.placement.cell + point.y * maps.gridColumns(ship) + point.x === Number(loc.square) && point.mesh === Number(loc.mesh));
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

  // A build must power every installed SIC without relying on temporary crew
  // staffing, shutdowns or damage. Combat output still uses live condition.
  function designBudget(record) {
    const ship=record.ship||record;
    const design={...ship,sicInventory:(ship.sicInventory||[]).map(i=>({...i,disabled:false,impaired:false,status:'installed'}))};
    const supply=output(design),required=demand(design);
    return {output:supply.en,demand:required,available:supply.en-required,au:supply.au};
  }

  function constructionError(record) {
    return designBudget(record).available < 0 ? 'Not enough EN. Add power or remove power demand before confirming.' : '';
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
        location: location ? { ...location, starshipId: ['surface','exterior','escape-pod'].includes(location.environment)||location.escapePodId?'':record.id, sicId: placement?.sicId || "" } : null };
    });
  }

  function refresh(room, { reset = false } = {}) {
    for (const record of room.starships || []) {
      const supply=output(record,room.units);
      if(record.ship?.cloakState?.active&&(!maps.cloaked(record)||supply.en<demand(record)))record.ship.cloakState.active=false;
      if(record.ship?.gravityFieldState?.active&&supply.en<demand(record))record.ship.gravityFieldState.active=false;
      const maximum = supply.au;
      const previous = record.auState;
      const current = reset || !previous ? maximum : Math.min(maximum, Math.floor(nonnegative(previous.current)));
      const charging=record.ship.cleanserState?.phase==='charging';
      const recoveryDiverted=Object.values(record.shieldSystems||{}).some(s=>s.addonRecovery?.emergency&&!s.addonRecovery.paused);
      const reserved = (record.auCommands || []).reduce((sum, command) => sum + nonnegative(command.cost), 0);
      record.auState = { current:charging?0:current, maximum, reserved:charging||recoveryDiverted?maximum:reserved, available:charging||recoveryDiverted?0:Math.max(0, current - reserved), rate:charging?0:maximum * AU_SPEED_FACTOR,
        progress: reset || !previous || current >= maximum ? 0 : Math.min(99.999999, nonnegative(previous.progress)) };
    }
  }

  function advance(room, seconds) {
    refresh(room);
    for (const record of room.starships || []) {
      const meter = record.auState;
      const cloak=record.ship.cloakState;let left=nonnegative(seconds);
      const dev=typeof module==='object'?require('./ship-devastation'):window.SADevastation,cycles=new Map();
      const counters=typeof module==='object'?require('./ship-countermeasures'):null,ion=()=>Object.entries(record.ship.fieldState?.systems||{}).filter(([id,d])=>d.enabled&&record.ship.sicInventory.some(i=>i.id===id&&i.type==='ionic-force-displacers')).map(([,d])=>d);
      while(left>1e-9){
        if(dev?.active(record)||ion().length){const key=JSON.stringify([meter.current,meter.progress,cloak,record.ship.devastationState?.systems,ion()]);const before=cycles.get(key);if(before!==undefined){const period=before-left,skip=Math.floor(left/period);if(period>1e-9&&skip>0){left-=skip*period;if(left<1e-9)break;}}else cycles.set(key,left);}
        if(cloak?.active&&!Number.isFinite(cloak.remaining))cloak.remaining=12;
        const step=Math.min(left,cloak?.active?Math.max(0,cloak.remaining):left,dev?.active(record)?dev.next(record):left,...ion().map(d=>Math.max(0,Number(d.remaining)||12)));
        if(meter.rate&&meter.current<meter.maximum){const total=meter.progress+step*meter.rate,earned=Math.floor((total+1e-9)/100);meter.current=Math.min(meter.maximum,meter.current+earned);meter.available=Math.max(0,meter.current-meter.reserved);meter.progress=meter.current>=meter.maximum?0:Math.max(0,total-earned*100);}
        left-=step;
        if(dev?.active(record))dev.advance(room,record,step);
        if(counters)counters.advance({...room,starships:[record]},step);
        if(cloak?.active){cloak.remaining-=step;if(cloak.remaining<=1e-9){if(meter.available<12){cloak.active=false;continue;}meter.current-=12;meter.available=Math.max(0,meter.current-meter.reserved);cloak.remaining=12;}}
      }
    }
  }

  function spend(room, shipId, amount) {
    refresh(room);
    const ship = (room.starships || []).find(record => record.id === shipId);
    if (!ship || ship.ship?.warpState?.phase==='traveling' || !Number.isInteger(amount) || amount < 1 || amount > ship.auState.available) return false;
    ship.auState.current -= amount;
    ship.auState.available = Math.max(0, ship.auState.current - ship.auState.reserved);
    return true;
  }
  return Object.freeze({ AU_SPEED_FACTOR, output, demand, designBudget, constructionError, campaignUnits, refresh, advance, spend });
}));
