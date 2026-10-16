'use strict';
// Modules contain authored starting content, never the room's access or delivery history.
const copy = value => structuredClone(value);
const pick = (source, keys) => Object.fromEntries(keys.filter(k => source[k] !== undefined).map(k => [k, copy(source[k])]));
function cleanShip(record, characterIds) {
  const result=pick(record,['id','title','controlType','ship','crewCharacterIds','crewNpcUnitIds','characterLocations','constructionCost']);
  result.crewCharacterIds=(result.crewCharacterIds||[]).filter(id=>characterIds.has(id));
  result.characterLocations=Object.fromEntries(Object.entries(result.characterLocations||{}).filter(([id])=>characterIds.has(id)));
  const ship=result.ship||{};
  for(const key of ['campaignLink','access','sensorState','weaponState','lockState','navigation','warpState','remoteState','transporterState','destructState','cleanserState','intruderState','surveillanceState','fieldState','diagnostics','maintenanceReports','resourceReceipts','characterWalks','boardingTransfers','airlockDocking','encounterState','transitReceipts','descentState','extractionState','blackHoleGunState','fabricationState','devastationState','atmosphereState','oxygenState','cloakState','gravityFieldState','probeState','droneState','relaySignals','breachDroneState','missileState'])delete ship[key];
  if(ship.confirmed)ship.confirmed=cleanShip({ship:ship.confirmed},characterIds).ship;
  if(ship.crewRoomState){ship.crewRoomState={rooms:Object.fromEntries(Object.entries(ship.crewRoomState.rooms||{}).map(([id,room])=>[id,pick(room,['notes','name','automationMode','enabled'])])),receipts:[],down:{}};}
  return result;
}
function create(campaign, options={}) {
  const title=String(options.title||campaign.name||'Adventure').trim().slice(0,120);
  if(!title)throw Error('Enter an adventure title.');
  const content=pick(campaign,['script','scriptChapters','conditionalActions','npcTemplates','npcRoster','libraryEntries','shops','starmaps','spaceObjects','shipCredits','settings']);
  content.characters=options.includeCharacters?(campaign.characters||[]).map(r=>{
    const character=copy(r.character);for(const k of ['access','campaignLink','localInbox','pendingRoll','pendingRewards','statistics','history','inbox'])delete character[k];
    if(character.identity)character.identity.playerName='';
    return {id:r.id,character,pcCode:'',approved:true};
  }):[];
  const ids=new Set(content.characters.map(r=>r.id));
  content.starships=(campaign.starships||[]).map(s=>cleanShip(s,ids));
  content.npcRoster=(content.npcRoster||[]).map(n=>pick(n,['id','templateId','rosterId','characterName','name','raceId','raceType','iconVariant','iconRace','allyNpc','color','speed','moveSpeed','maximumHp','currentHp','physicalAttribute','mentalAttribute','physicalSkill','mentalSkill','weapons','heldWeaponId','items','location']));
  content.libraryEntries=(content.libraryEntries||[]).map(e=>pick(e,['id','title','text']));
  if(content.starmaps)for(const k of ['journeys','localJourneys','receipts'])content.starmaps[k]=k==='receipts'?[]:{};
  if(content.shops)content.shops.receipts=[];

  if(options.includePreparation&&campaign.preparationDraft){
    content.preparationDraft=copy(campaign.preparationDraft);
    content.preparationDraft.characters=(content.preparationDraft.characters||[]).filter(id=>ids.has(id));
    content.preparationDraft.locations=(content.preparationDraft.locations||[]).filter(([id])=>ids.has(id));
  }
  return {format:'spaceship-architect-adventure',version:1,metadata:{title,author:String(options.author||'').slice(0,120),version:String(options.version||'1.0').slice(0,40),instructions:String(options.instructions||'').slice(0,12000)},content};
}
function read(file) {
  if(file?.format!=='spaceship-architect-adventure'||file.version!==1||!file.content||!Array.isArray(file.content.starships)||!Array.isArray(file.content.characters))throw Error('Choose a supported Adventure Module file.');
  // Reapply the export boundary to imported files as well.
  const safe=create({...file.content,name:file.metadata?.title},{...file.metadata,includeCharacters:true,includePreparation:true});
  return safe;
}
module.exports={create,read};
