'use strict';
// Fictional elapsed time, never wall-clock waiting, completes ancestral crafting.
function advance(campaign, minutes) {
 if (!Number.isFinite(minutes) || minutes <= 0) return;
 for (const note of campaign.privateNotes || []) {
  if (note.kind !== 'angiluros-craft-request' || note.requestStatus !== 'crafting') continue;
  note.remainingMinutes = Math.max(0, note.remainingMinutes - minutes);
  note.message = `${note.characterName} is crafting ${note.requestedWeaponName}: ${Number(note.remainingMinutes.toFixed(2))} fictional minutes remaining.`;
  if (note.remainingMinutes <= 1e-7) {
   note.remainingMinutes = 0; note.requestStatus = 'pending'; note.readAt = null;
   note.message = `${note.characterName} finished crafting ${note.requestedWeaponName}. GM approval is required to add it to storage.`;
  }
 }
}
function grant(character, note) {
 character.storedWeapons ||= [];
 if ([...(character.weapons || []), ...character.storedWeapons].some(w => w.craftRequestId === note.id)) return;
 character.storedWeapons.push({id:'crafted-'+note.id,weaponId:note.requestedWeaponId,held:false,acquisitionMode:'crafted',craftRequestId:note.id});
}
// Preserve deliveries that an older in-flight PC save has not seen yet.
function preserveUnseen(previous, next, seen = []) {
 const known = new Set(Array.isArray(seen) ? seen : []);
 const present = new Set([...(next.weapons || []), ...(next.storedWeapons || [])].map(w => w.craftRequestId));
 for (const weapon of [...(previous.weapons || []), ...(previous.storedWeapons || [])]) {
  if (!weapon.craftRequestId || known.has(weapon.craftRequestId) || present.has(weapon.craftRequestId)) continue;
  (next.storedWeapons ||= []).push({...weapon,held:false}); present.add(weapon.craftRequestId);
 }
}
module.exports = {advance,grant,preserveUnseen};
