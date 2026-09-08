const UNIT_MINUTES = Object.freeze({ minutes: 1, hours: 60, days: 1440, weeks: 10080 });
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function durationMinutes(amount, unit) {
  const minutes = Number(amount) * UNIT_MINUTES[unit];
  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isInteger(minutes) || minutes > 5256000) {
    throw new Error("Enter a positive duration of whole minutes, up to ten years.");
  }
  return minutes;
}

function rechargeItems(character) {
  const names = [];
  for (const item of Array.isArray(character.items) ? character.items : []) {
    if (!["jet-pack", "power-shields", "mobile-zero-point-energy"].includes(item.catalogId)) continue;
    if (item.chargesMax !== null && item.chargesMax !== undefined) item.charges = item.chargesMax;
    if (item.catalogId === "mobile-zero-point-energy") item.chargeState = "Full";
    names.push(item.name || item.catalogId);
  }
  return names;
}

function dailyHealing(character) {
  const boxes = (character.attributes?.health || []).reduce((sum, value) => sum + (Number.isInteger(value) && value >= 0 && value <= 4 ? value + 1 : 0), 0);
  const skill = character.skills?.["Athletics/Endurance"];
  const athletics = character.computed?.skills?.["Athletics/Endurance"] ?? (typeof skill === "object" ? finite(skill?.tenths) / 10 : finite(skill));
  return boxes + Math.max(0, finite(athletics));
}

function passCharacterTime(character, minutes) {
  const elapsed = Math.max(0, finite(character.health?.recoveryMinutes)) + minutes;
  const days = Math.floor(elapsed / 1440);
  const maximum = Math.max(0, finite(character.computed?.maximumHp ?? character.health?.current));
  character.health ||= { current: maximum, permanentBonus: 0 };
  const before = finite(character.health.current ?? maximum);
  const after = Math.min(maximum, before + days * dailyHealing(character));
  character.health.current = Math.round(after * 1000) / 1000;
  character.health.recoveryMinutes = elapsed % 1440;
  return { days, healed: Math.max(0, character.health.current - before), recharged: rechargeItems(character) };
}

module.exports = { durationMinutes, rechargeItems, dailyHealing, passCharacterTime };
