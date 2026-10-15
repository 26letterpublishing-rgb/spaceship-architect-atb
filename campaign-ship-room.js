const SHIP_MAP=require('./ship-map-core'),clone=structuredClone,safeCharacterName=r=>r?.character?.identity?.characterName||'Crew';
module.exports=function transitRoom(campaign) {
  const units=campaign.starships.flatMap(ship=>require('./ship-power').campaignUnits(ship,campaign.characters).map(unit=>{
    const record=(campaign.characters||[]).find(c=>c.id===unit.id);
    return {...unit,carryingId:unit.location?.carryingId,carriedBy:unit.location?.carriedBy,characterId:unit.id,characterName:safeCharacterName(record),team:'pc',currentHp:record?.character.health?.current??1};
  }).filter(unit=>unit.location));
  for(const record of campaign.characters||[])if(!units.some(u=>u.characterId===record.id))units.push({id:record.id,characterId:record.id,characterName:safeCharacterName(record),team:'pc',currentHp:record.character.health?.current??1});
  for(const npc of campaign.npcRoster||[])if(!units.some(u=>u.id===npc.id))units.push(clone(npc));
  for(const ship of campaign.starships){ship.maximumHullHp=ship.ship.maximumHullHp??SHIP_MAP.hullHp(ship);ship.currentHullHp=ship.ship.currentHullHp??ship.maximumHullHp;ship.currentShieldHp=ship.ship.currentShieldHp??0;}
  const shipPositions=require('./ship-distances').positions(campaign.starships,campaign.encounter?.shipPositions||[]).map(p=>({...p,...campaign.starships.find(s=>s.id===p.id)?.ship.fieldState?.position,id:p.id}));
  return {starships:campaign.starships,units,shipPositions,spaceObjects:campaign.encounter?.spaceObjects||[],outsideCombat:true,knownContacts:Object.fromEntries((campaign.encounter?.starships||[]).map(s=>[s.id,s.sensorState?.contacts||{}]))};
}
