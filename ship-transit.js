'use strict';

// Server only. The caller authenticates actors, advances only active ATB/OOC
// seconds (activation and travel), with GM campaign minutes added separately.
const maps = require('./ship-map-core');
const stations = require('./station-access');
const power = require('./ship-power');
const distances = require('./ship-distances');
const shields = require('./ship-shields');
const { randomUUID } = require('node:crypto');
const PARSEC_LY = 3.26;
const ROUND_SECONDS = 12;
const FUEL_PARSECS = Object.freeze({ F:1/3, D:1, C:4, B:12, A:48, S:180 });
const EPS = 1e-9;
const data = ship => ship.ship || ship;
const fail = error => ({ ok:false, error });
const impaired = item => Boolean(item?.impaired || item?.status === 'impaired' || Number(item?.impairmentPoints) > 0);
const alive = ship => ship && !ship.destroyedAt && (ship.currentHullHp == null || Number(ship.currentHullHp) > 0);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const isAI = unit => Boolean(unit?.isAI || unit?.ai || unit?.shipAI || unit?.type === 'ai' || unit?.classId === 'ai');
const inWarp = ship => ['activating','traveling'].includes(data(ship).warpState?.phase);
const activeDestruct = ship => ['approvals','countdown','blastPending'].includes(data(ship).destructState?.phase);
const moving = ship => ['powered','drift'].includes(ship.navigation?.phase) || (ship.navigation?.phase !== 'stopped' && Number(ship.navigation?.speed) > 0);
const installed = (ship, id) => maps.installedItems(ship).find(item => item.id === id);
function drive(ship, sicId) {
  return maps.installedItems(ship).filter(item => stations.online(item) && maps.definition(item.type).warp && (!sicId || item.id === sicId))
    .sort((a,b) => maps.definition(b.type).tier - maps.definition(a.type).tier)[0];
}
function fuelInventory(ship) {
  return Object.fromEntries(Object.keys(FUEL_PARSECS).map(grade => {
    const value = data(ship).warpFuel?.[grade];
    return [grade, Number.isSafeInteger(value) && value >= 0 ? value : 0];
  }));
}

// Source: A-60..66/B-41..46. An impaired cell supplies half its usual range;
// cells are still debited individually, only when their segment actually starts.
// Plan entries are run-length encoded to keep large inventories bounded.
function plan(ship, distanceLY, { sicId, fuelCounts } = {}) {
  if (!ship || !finite(distanceLY) || distanceLY <= 0) return fail('Enter a positive distance in light-years.');
  if(maps.installedItems(ship).filter(i=>maps.definition(i.type).warp).length>1)return fail('Only one Warp Drive may be installed. Move the extra drive to Storage in the build menu.');
  const item = drive(ship, sicId);
  if (!item) return fail('An installed, powered-on warp drive is required.');
  const def = maps.definition(item.type), multiplier = impaired(item) ? 2 : 1;
  if(def.instantWarp){if(fuelInventory(ship).S<2)return fail('EW-FTL requires two Grade S fuel cells.');return {ok:true,instantWarp:true,sicId:item.id,tier:def.tier,impaired:impaired(item),fuelMultiplier:1,secondsPerParsec:0,targetLY:distanceLY,travelSeconds:0,plan:[],counts:{F:0,D:0,C:0,B:0,A:0,S:2},fuelCells:2};}
  if (!(def.warpSecondsPerParsec > 0) || !Array.isArray(def.warpFuelGrades)) return fail('Warp drive configuration is unavailable.');
  const inventory = fuelInventory(ship), grades = Object.keys(FUEL_PARSECS).filter(g => def.warpFuelGrades.includes(g));
  const ranges = Object.fromEntries(grades.map(g => [g, FUEL_PARSECS[g] * PARSEC_LY / multiplier]));
  const counts = Object.fromEntries(Object.keys(FUEL_PARSECS).map(g => [g,0])), entries = [];
  let remaining = distanceLY;
  if(fuelCounts!==undefined){
    if(!fuelCounts||typeof fuelCounts!=='object'||Array.isArray(fuelCounts))return fail('Choose your fuel quantities.');
    for(const [g,n]of Object.entries(fuelCounts))if(!Object.hasOwn(FUEL_PARSECS,g)||!Number.isSafeInteger(n)||n<0||n>inventory[g]||n>0&&!grades.includes(g))return fail('Choose available, compatible fuel cells in whole quantities.');
    // Consume selected smaller cells first. Unused cells stay in storage.
    for(const g of grades){const count=fuelCounts[g]||0;if(count){entries.push({grade:g,count,rangeLY:ranges[g]});counts[g]=count;remaining-=count*ranges[g];}}
    if(remaining>EPS)return fail('The selected fuel does not cover this journey.');
  }
  while (fuelCounts===undefined && remaining > Math.min(EPS, distanceLY * 1e-12)) {
    const available = grades.filter(g => inventory[g] > 0);
    const grade = available.filter(g => ranges[g] <= remaining + EPS).at(-1) || available[0];
    if (!grade) return { ...fail('Insufficient compatible fuel for this journey.'), targetLY:distanceLY, missingLY:remaining };
    const count = Math.min(inventory[grade], Math.max(1, Math.floor((remaining + EPS) / ranges[grade])));
    entries.push({ grade, count, rangeLY:ranges[grade] });
    inventory[grade] -= count; counts[grade] += count; remaining -= count * ranges[grade];
  }
  const travelSeconds = distanceLY / PARSEC_LY * def.warpSecondsPerParsec;
  if (!Number.isFinite(travelSeconds)) return fail('The journey duration is too large.');
  return { ok:true, sicId:item.id, tier:def.tier, impaired:impaired(item), fuelMultiplier:multiplier,
    secondsPerParsec:def.warpSecondsPerParsec, targetLY:distanceLY, travelSeconds,
    plan:entries, counts, fuelCells:Object.values(counts).reduce((a,b) => a+b,0) };
}
function hardware(room, ship, sicId) {
  const item = drive(ship, sicId);
  if (!alive(ship) || !item) return fail('Warp drive is unavailable.');
  const def = maps.definition(item.type);
  if(require('./ship-probes').warpBlocked(room,ship))return fail('Warp Bubble Inhibitor active within 2 Units. Leave its field or deactivate it.');
  if (power.output(ship, room.units || []).en < Math.max(1, Number(def.energyCost) || 0, power.demand(ship))) return fail('Insufficient generated EN to power the warp drive.');
  const thrusters = maps.installedItems(ship).filter(i => stations.online(i) && !impaired(i) && maps.definition(i.type).thruster);
  if (thrusters.length < def.warpThrusters) return fail(`Warp requires ${def.warpThrusters} operational thrusters.`);
  return { ok:true, item, definition:def };
}
function engineerCount(room, ship, sicId) {
  const seats = new Set(), identities = new Set();
  for (const unit of room.units || []) {
    const seat = stations.station(room, unit), key = unit.characterId || unit.id;
    if (!seat || seat.ship.id !== ship.id || seat.cell.sicId !== sicId || identities.has(key) || seats.has(seat.key) || isAI(unit)) continue;
    if (Number(unit.engineeringSkill ?? (unit.team === 'npc' ? unit.mentalSkill : 0)) < 3 || !Number.isFinite(Number(unit.engineeringSkill ?? (unit.team === 'npc' ? unit.mentalSkill : 0)))) continue;
    identities.add(key); seats.add(seat.key);
  }
  return seats.size;
}
function activationSeconds(room, ship, planned) {
  if (planned.instantWarp) return 120;
  const item=drive(ship,planned.sicId);
  return Math.max(1,maps.definition(item.type).warpRounds*planned.fuelMultiplier-engineerCount(room,ship,planned.sicId))*ROUND_SECONDS;
}
function stop(ship) {
  if (ship.navigation) Object.assign(ship.navigation, { phase:'stopped', speed:0, remaining:0 });
}
function endJourney(ship, phase, reason) {
  const state = data(ship).warpState;
  const discardedLY = state.currentFuel?.remainingLY || 0;
  state.phase = phase; state.remaining = 0; state.currentFuel = null;
  state.report = { phase, reason, targetLY:state.targetLY, traveledLY:state.traveledLY, elapsedSeconds:state.elapsedSeconds,
    fuelUsed:{...state.fuelUsed}, discardedLY };
  return { kind:`warp${phase[0].toUpperCase()}${phase.slice(1)}`, shipId:ship.id, id:state.id, report:state.report };
}
function consumeCell(ship) {
  const state = data(ship).warpState;
  while (state.planIndex < state.plan.length && state.planUsed >= state.plan[state.planIndex].count) { state.planIndex++; state.planUsed = 0; }
  const entry = state.plan[state.planIndex];
  if (!entry || fuelInventory(ship)[entry.grade] < 1) return false;
  data(ship).warpFuel[entry.grade]--;
  state.fuelUsed[entry.grade]++; state.planUsed++;
  state.currentFuel = { grade:entry.grade, rangeLY:entry.rangeLY, remainingLY:entry.rangeLY };
  return true;
}
function registered(ship, unit) {
  if (unit.characterId && (ship.crewCharacterIds || data(ship).crewCharacterIds)?.includes(unit.characterId)) return `character:${unit.characterId}`;
  // NPC templates are reusable, not crew identities. Registration names the
  // deployed NPC unit, exactly as crew assignment and maintenance do.
  if (unit.team === 'npc' && (ship.crewNpcUnitIds || data(ship).crewNpcUnitIds)?.includes(unit.id)) return `npc:${unit.id}`;
  return null;
}
function bridgeApproval(room, ship, unit) {
  const seat = stations.station(room, unit);
  return Boolean(registered(ship, unit) && !isAI(unit) && seat?.ship.id === ship.id && maps.definition(seat.cell.type).bridge &&
    !ship.hackedSystems?.some(h => h.bridge || h.sicId === seat.cell.sicId));
}
function destructHardware(room, ship, sicId) {
  const item = installed(ship, sicId), def = item && maps.definition(item.type);
  return Boolean(alive(ship) && stations.online(item) && !impaired(item) &&
    (def.selfDestruct || def.utility === 'self-destruct' || item.type === 'self-destruct') && power.output(ship, room.units || []).en > 15);
}
function blastPending(room, ship) {
  const state = data(ship).destructState;
  const positions = distances.positions(room.starships || [], room.shipPositions || []), origin = positions.find(p => p.id === ship.id);
  state.phase = 'blastPending'; state.remaining = 0;
  state.targetIds = (room.starships || []).filter(s => s.id !== ship.id && alive(s) && data(s).warpState?.phase !== 'traveling' &&
    distances.hexDistance(origin, positions.find(p => p.id === s.id)) <= 2 + EPS).map(s => s.id);
  const hull = Number(ship.maximumHullHp ?? data(ship).maximumHullHp ?? new Set(data(ship).gridCells || []).size);
  state.diceCount = Math.floor(Math.max(0, Number.isFinite(hull) ? hull : 0) / 4);
  state.report = { phase:'blastPending', text:'Awaiting manual blast damage roll.' };
  return { kind:'needsBlastRoll', shipId:ship.id, id:state.id, unitId:state.unitId, diceCount:state.diceCount, die:12, targetIds:[...state.targetIds] };
}
function cancelDestruct(ship, reason) {
  const state = data(ship).destructState;
  state.phase = 'cancelled'; state.remaining = 0; state.report = { phase:'cancelled', reason };
  return { kind:'destructCancelled', shipId:ship.id, id:state.id };
}
function ready(room, unit, outsideCombat) {
  return stations.conscious(unit) && (outsideCombat || room.activeId === unit.id) && !unit.consoleHold &&
    !unit.delayedAction && !unit.delayTimer && !unit.timedAction && !unit.shieldRestabilizing &&
    !(room.starships || []).some(s => s.auCommands?.some(c => c.unitId === unit.id));
}

// Body kinds: warpStart/warpCancel/warpExit/destructApprove/destructCancel.
// Receipts are actor-owned and payload-bound, retained across journey replacement.
// Cancels/exits are free. Start/approval return spent:true for caller turn handling.
function command(room, actor, body = {}, { outsideCombat = false } = {}) {
  const unit = room?.units?.find(u => u.id === actor?.id);
  if (!unit) return fail('An authenticated room actor is required.');
  if (typeof body.requestId !== 'string' || !/^[\w-]{8,100}$/.test(body.requestId)) return fail('Invalid command receipt.');
  if (!['warpStart','warpCancel','warpExit','destructApprove','destructCancel'].includes(body.kind)) return fail('Choose a transit operation.');
  const allowed = body.sicId ? stations.access(room, unit, body.sicId) : null;
  const ship = room.starships?.find(s => s.id === (body.shipId || allowed?.ship.id || unit.location?.starshipId));
  if (!ship) return fail('Ship not found.');
  const fingerprint = JSON.stringify([body.kind, body.sicId ?? null, body.distanceLY ?? null, body.countdownSeconds ?? null]);
  const receipts = data(ship).transitReceipts || [], owner = JSON.stringify([unit.id, unit.characterId || null, unit.templateId || null]);
  const receipt = receipts.find(r => r.id === body.requestId);
  if (receipt) return receipt.owner === owner && receipt.fingerprint === fingerprint ? { ok:true, duplicate:true, spent:false, ship, events:[] } : fail('This receipt belongs to another command or actor.');
  let events = [], spent = false;
  if (body.kind.startsWith('warp')) {
    if (!allowed || allowed.blocked || allowed.ship.id !== ship.id || allowed.definition.utility !== 'warp' || !allowed.definition.warp) return fail('Use an accessible operational warp console.');
    const state = data(ship).warpState;
    if (body.kind === 'warpStart') {
      if (!ready(room, unit, outsideCombat)) return fail('Wait for your turn and finish the current action.');
      if (inWarp(ship) || activeDestruct(ship)) return fail('A transit or self-destruct operation is already pending.');
      if (moving(ship)) return fail('Stop ship movement and inertia before activating warp.');
      const available = hardware(room, ship, body.sicId);
      if (!available.ok) return available;
      const planned = plan(ship, body.distanceLY, { sicId:body.sicId });
      if (!planned.ok) return planned;
      const engineers = engineerCount(room, ship, body.sicId);
      const total = activationSeconds(room, ship, planned);
      let faultRoll=null;
      if(planned.instantWarp){
        if(planned.impaired){const dice=body.diceResults;if(!Array.isArray(dice)||dice.length!==1||!Number.isInteger(dice[0])||dice[0]<1||dice[0]>8)return fail('Roll and confirm the standard D8 for the impaired EW-FTL Drive.');faultRoll=dice[0];}
        power.refresh(room);const all=ship.auState.current;if(!Number.isInteger(all)||all<1||ship.auState.reserved>0||!power.spend(room,ship.id,all))return fail('EW-FTL requires all current AU, at least 1, with no reserved AU or active cloak.');
        data(ship).warpFuel.S-=2;
      }
      const origin = distances.positions(room.starships, room.shipPositions || []).find(p => p.id === ship.id);
      data(ship).warpState = { phase:'activating', id:randomUUID(), unitId:unit.id, owner, sicId:body.sicId, remaining:total, total,
        targetLY:planned.targetLY, traveledLY:0, elapsedSeconds:0, secondsPerParsec:planned.secondsPerParsec, tier:planned.tier,
        instantWarp:Boolean(planned.instantWarp),faultRoll,impaired:planned.impaired, engineers, plan:planned.plan, planIndex:0, planUsed:0, currentFuel:null,
        fuelUsed:Object.fromEntries(Object.keys(FUEL_PARSECS).map(g => [g,0])), origin:{ q:origin.q, r:origin.r }, report:null };
      if(planned.instantWarp){data(ship).warpState.fuelUsed.S=2;const points=Math.max(Number(available.item.impairmentPoints)||0,impaired(available.item)?1:0);if(faultRoll!==null&&faultRoll<=points){ship.currentHullHp=0;data(ship).currentHullHp=0;ship.destroyedAt=new Date().toISOString();events.push(endJourney(ship,'exploded','EW-FTL failure: D8 '+faultRoll+' against '+points+' impairment points.'));}}
      spent = true;
    } else {
      if (body.kind === 'warpCancel' && state?.phase !== 'activating') return fail('No warp activation is pending.');
      if (body.kind === 'warpExit' && state?.phase !== 'traveling') return fail('This ship is not traveling at warp.');
      events.push(endJourney(ship, body.kind === 'warpCancel' ? 'cancelled' : 'exited', 'Cancelled by operator.'));
    }
  } else if (body.kind === 'destructCancel') {
    if (!registered(ship, unit) || !stations.conscious(unit)) return fail('Registered conscious crew may cancel self-destruct.');
    if (!activeDestruct(ship)) return fail('No self-destruct is pending.');
    events.push(cancelDestruct(ship, 'Cancelled by registered crew.'));
  } else {
    if (!bridgeApproval(room, ship, unit)) return fail('Self-destruct requires registered crew physically at their own uncompromised bridge; AI and remote activation are forbidden.');
    if (!ready(room, unit, outsideCombat)) return fail('Wait for your turn and finish the current action.');
    if (inWarp(ship)) return fail('Exit warp before activating self-destruct.');
    const state = data(ship).destructState;
    if (state && ['countdown','blastPending'].includes(state.phase)) return fail('Self-destruct is already activated.');
    const sicId = body.sicId || (state?.phase === 'approvals' ? state.sicId : null);
    if (!destructHardware(room, ship, sicId)) return fail('An operational self-destruct module and generated EN greater than 15 are required.');
    const countdown = body.countdownSeconds ?? (state?.phase === 'approvals' ? state.total : 0);
    if (!finite(countdown) || countdown < 0) return fail('Choose a zero or positive countdown in seconds.');
    const crewId = registered(ship, unit);
    if (state?.phase === 'approvals') {
      if (state.total !== countdown || state.sicId !== sicId) return fail('Both crew must approve the same module and countdown.');
      if (state.approvals.some(a => a.crewId === crewId)) return fail('A second distinct registered crew member must approve.');
      if (!state.approvals.every(a => (room.units || []).some(u => u.id === a.unitId && registered(ship,u) === a.crewId && bridgeApproval(room,ship,u)))) return fail('Both approvers must still be physically at their own bridge.');
      state.approvals.push({ crewId, unitId:unit.id }); state.phase = 'countdown'; state.unitId = unit.id;
      if (countdown === 0) events.push(blastPending(room, ship));
    } else {
      data(ship).destructState = { phase:'approvals', id:randomUUID(), sicId, unitId:unit.id, owner, remaining:countdown, total:countdown,
        approvals:[{ crewId, unitId:unit.id }], targetIds:[], diceCount:null, report:null };
    }
    spent = true;
  }
  data(ship).transitReceipts = [...receipts, { id:body.requestId, owner, fingerprint }];
  return { ok:true, ship, spent, events };
}

function advance(room, seconds) {
  const events = [];
  if (!finite(seconds) || seconds < 0 || room.hardPaused || room.holdPaused) return events;
  for (const ship of room.starships || []) {
    const state = data(ship).warpState;
    if(!state?.campaignClock && state?.phase==='traveling')events.push(...passTime(ship,seconds/60).events);
    if (!state?.campaignClock && state?.phase === 'activating') {
      const available = hardware(room, ship, state.sicId);
      const position = distances.positions(room.starships, room.shipPositions || []).find(p => p.id === ship.id);
      if (!available.ok || moving(ship) || impaired(available.item) !== state.impaired || distances.hexDistance(position, state.origin) > EPS) {
        events.push(endJourney(ship, 'interrupted', available.error || 'Drive condition or ship position changed during activation.'));
      } else {
        const travelSeconds=Math.max(0,seconds-state.remaining);
        stop(ship); state.remaining = Math.max(0, state.remaining - seconds);
        if (state.remaining <= EPS) {
          state.remaining = 0;
          if(state.instantWarp){state.traveledLY=state.targetLY;events.push({kind:'warpDeparted',shipId:ship.id,id:state.id,unitId:state.unitId});events.push(endJourney(ship,'arrived','EW-FTL destination reached instantly.'));}
          else if (consumeCell(ship)) { state.phase = 'traveling'; events.push({ kind:'warpDeparted', shipId:ship.id, id:state.id, unitId:state.unitId }); if(travelSeconds>0)events.push(...passTime(ship,travelSeconds/60).events); }
          else events.push(endJourney(ship, 'interrupted', 'The first fuel cell is unavailable.'));
        }
      }
    }
    const destruct = data(ship).destructState;
    if (destruct?.phase === 'countdown' || destruct?.phase === 'approvals') {
      if (!destructHardware(room, ship, destruct.sicId)) events.push(cancelDestruct(ship, 'Self-destruct module or power unavailable.'));
      else if (destruct.phase === 'countdown') {
        destruct.remaining = Math.max(0, destruct.remaining - seconds);
        if (destruct.remaining <= EPS) events.push(blastPending(room, ship));
      }
    }
  }
  return events;
}

function passTime(ship, minutes) {
  if (!finite(minutes) || minutes < 0 || !Number.isFinite(minutes * 60)) return fail('Enter nonnegative campaign minutes.');
  const state = data(ship).warpState, events = [];
  if (state?.phase !== 'traveling' || minutes === 0) return { ok:true, ship, events };
  let left = minutes * 60;
  const secondsPerLY = state.secondsPerParsec / PARSEC_LY;
  while (left > 0 && state.phase === 'traveling') {
    if (!state.currentFuel && !consumeCell(ship)) { events.push(endJourney(ship, 'interrupted', 'The next planned fuel cell is unavailable.')); break; }
    const fuel = state.currentFuel;
    const traveled = Math.min(left / secondsPerLY, fuel.remainingLY, Math.max(0, state.targetLY - state.traveledLY));
    const elapsed = traveled * secondsPerLY;
    state.traveledLY += traveled; state.elapsedSeconds += elapsed; fuel.remainingLY = Math.max(0, fuel.remainingLY - traveled); left = Math.max(0, left - elapsed);
    if (state.targetLY - state.traveledLY <= EPS) {
      state.traveledLY = state.targetLY; events.push(endJourney(ship, 'arrived', 'Destination reached.'));
    } else if (fuel.remainingLY <= EPS) {
      state.currentFuel = null;
      // An exact segment boundary does not pre-spend the next cell.
      if (left <= EPS) break;
    } else break;
  }
  return { ok:true, ship, events };
}

// Infinity means there is no ticking transit event. blastPending is handled by
// the caller's global manual-roll pause, not repeatedly emitted at time zero.
function nextEvent(room) {
  if (room.hardPaused || room.holdPaused) return Infinity;
  let remaining = Infinity;
  for (const ship of room.starships || []) {
    const warp = data(ship).warpState, destruct = data(ship).destructState;
    if (!warp?.campaignClock && warp?.phase === 'activating') remaining = Math.min(remaining, Math.max(0, warp.remaining));
    if (destruct?.phase === 'countdown') remaining = Math.min(remaining, Math.max(0, destruct.remaining));
  }
  return remaining;
}

// The caller must match its manual prompt's id to destructState.id before calling.
// Cancelled prompts cannot resolve; settled blasts are idempotent even after JSON restart.
function resolveBlast(room, shipId, total) {
  const ship = room.starships?.find(s => s.id === shipId), state = ship && data(ship).destructState;
  if (state?.phase === 'exploded') return { ok:true, duplicate:true, ship, events:[] };
  if (state?.phase !== 'blastPending') return fail('No manual blast roll is pending.');
  if (!Number.isSafeInteger(total) || total < state.diceCount || total > state.diceCount * 12) return fail('Enter a valid total for the pending D12 pool.');
  for (const id of state.targetIds) if (room.starships.some(s => s.id === id)) shields.damage(room, id, total);
  ship.currentHullHp = 0; stop(ship);
  state.phase = 'exploded'; state.report = { phase:'exploded', total, diceCount:state.diceCount, targetIds:[...state.targetIds] };
  return { ok:true, ship, events:[{ kind:'destructExploded', shipId, id:state.id, targetIds:[...state.targetIds], total }] };
}

module.exports = { PARSEC_LY, ROUND_SECONDS, FUEL_PARSECS, plan, hardware, activationSeconds, command, advance, nextEvent, passTime, resolveBlast };
