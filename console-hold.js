// Hold affects initiative only, never a launched ship order or the room clock.
function stationKey(unit) {
  const location = unit?.location;
  return location?.stationed && location.starshipId && location.sicId
    ? `${location.starshipId}:${location.sicId}:${location.square}:${location.mesh}` : null;
}

function reconcile(unit) {
  if (unit.consoleHold && (unit.defeatedAt || unit.delayedAction || unit.delayTimer || unit.timedAction || stationKey(unit) !== unit.consoleHold.station)) {
    unit.commandCarrySeconds = unit.consoleHold.commandRemaining;
    unit.consoleHold = null;
  }
}

function resolve(room, unit, kind, helpers) {
  if (!unit || unit.defeatedAt) return {ok:false,error:'That character is unavailable.'};
  if (kind === 'resumeConsole') {
    if (!unit.consoleHold) return {ok:false,error:'This character is not holding.'};
    unit.commandCarrySeconds = unit.consoleHold.commandRemaining;
    unit.consoleHold = null;
    helpers.pushLog(room, `${unit.characterName} resumed initiative.`);
    return {ok:true};
  }
  if (unit.consoleHold || !stationKey(unit) || room.activeId !== unit.id || unit.delayedAction || unit.delayTimer || unit.timedAction || room.delayRequest || room.activeAction || room.attackResolution || room.itemResolution) {
    return {ok:false,error:'Hold is available on your turn at a console, after unfinished actions resolve.'};
  }
  const remaining = room.commandTotal > 0
    ? room.commandExpired ? 0 : (room.hardPaused || room.holdPaused) && room.commandHeldRemaining != null
      ? room.commandHeldRemaining : room.commandDeadline ? Math.max(0,(room.commandDeadline-Date.now())/1000) : 0
    : null;
  unit.consoleHold = {station:stationKey(unit),commandRemaining:remaining};
  unit.atb = room.threshold * .99;
  const source = room.activeSource;
  room.activeId = null;
  room.pausedForTurn = false;
  helpers.clearActiveCommand(room);
  helpers.pushLog(room, `${unit.characterName} is holding at 99%.`);
  helpers.moveToNextTurnOrClock(room, source);
  return {ok:true};
}

module.exports = {resolve,reconcile};
