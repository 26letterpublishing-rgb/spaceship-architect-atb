(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SAShipCooperation = api;
}(typeof window !== 'undefined' ? window : null, function() {
  const state = ship => ship.commandSystems ||= { preparations:[], calls:[], receipts:[] };
  function advance(ship, seconds) {
    const data = state(ship);
    data.preparations = data.preparations.filter(p => (p.remaining -= seconds) > 0);
  }
  function roll(room, ship, unit, action, dice, skill, rollDie, fuse) {
    const data = state(ship), matching = data.preparations.filter(p => p.action === action && p.remaining > 0);
    const teams = matching.filter(p => p.kind === 'team' && p.unitId !== unit.id && room.units.some(u => u.id === p.unitId && !u.defeatedAt));
    const calculations = matching.filter(p => p.kind === 'calculation');
    const values = [...dice, ...teams.flatMap(() => dice)].map(rollDie);
    const rating = Math.max(skill, ...teams.map(p => p.skill));
    const bonus = calculations.length * 2 + (teams.length ? teams.length + 1 : 0);
    const consumed = new Set([...teams, ...calculations]);
    data.preparations = data.preparations.filter(p => !consumed.has(p));
    return { values, total:Number.isFinite(rollDie.submittedScore)?rollDie.submittedScore:fuse(values) + rating + bonus, bonus, participants:teams.length + 1 };
  }
  return { state, advance, roll };
}));
