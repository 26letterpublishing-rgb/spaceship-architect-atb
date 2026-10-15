import './weapon-catalog.js';
export const WEAPONS=globalThis.SAWeaponCatalog;
export const WEAPONS_BY_ID=new Map(WEAPONS.map(w=>[w.id,w]));
export function weaponById(id){return WEAPONS_BY_ID.get(String(id||''))||null;}
