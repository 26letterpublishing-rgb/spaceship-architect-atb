// One persistence contract for campaign ships, encounter ships and preparation.
const clone=value=>value===undefined?undefined:structuredClone(value);
const fields=['descentState','illusionState','securityDroidState','remoteState','triangulatorState','airlocks','airlockStates','breachState','relaySignals','breachDroneState','extractionState','salvagedAt','blackHoleGunState','fabricationState','devastationState','cleanserState','atmosphereState','oxygenState','oxygenEnabled','gravityEnabled','cloakState','gravityFieldState','mapColor','mapHeading','warpState','destructState','warpFuel','minerals','transitReceipts','missileState','missileAmmo','missileStorage','crewRoomState','fieldState','droneState','probeState','surveillanceState','doorStates','doorDamage','transporterState','intruderState'];
const runtime=['auState','navigation','shieldSystems','auCommands','shieldReceipts','sensorState','weaponState','lockState','destroyedAt','escapedAt','victoryAt','commandSystems','maintenanceReceipts','currentHullHp','currentShieldHp'];
const condition=['impaired','impairmentPoints','repairDifficulty','disabled','status','bootRemaining','unstable','printed','printedFor','salvaged','salvageSource'];
function apply(target,source,{restoreRuntime=true}={}){
 if(!target?.ship||!source?.ship)return target;
 for(const key of fields)if(key in source.ship)target.ship[key]=clone(source.ship[key]);
 for(const item of target.ship.sicInventory||[]){const old=source.ship.sicInventory?.find(i=>i.id===item.id);if(old)for(const key of condition)if(key in old)item[key]=clone(old[key]);}
 for(const item of source.ship.sicInventory||[])if((item.printed||item.salvaged)&&!target.ship.sicInventory?.some(i=>i.id===item.id))(target.ship.sicInventory||=[]).push(clone(item));
 if(restoreRuntime){const saved=source.ship.encounterState||{};for(const key of runtime){const value=source[key]??saved[key];if(value!==undefined)target[key]=clone(value);}}
 return target;
}
function persist(record,live){
 apply(record,live);record.ship.encounterState=Object.fromEntries(runtime.filter(k=>live[k]!==undefined).map(k=>[k,clone(live[k])]));
 for(const key of ['currentHullHp','currentShieldHp'])if(Number.isFinite(live[key]))record.ship[key]=live[key];
 return record;
}
function locations(ships,units){
 for(const unit of units||[]){if(!unit.characterId)continue;for(const ship of ships)if(ship.characterLocations)delete ship.characterLocations[unit.characterId];
  const ship=ships.find(s=>s.id===unit.location?.starshipId)||ships.find(s=>s.id===unit.vacuum?.sourceShipId)||ships.find(s=>s.crewCharacterIds?.includes(unit.characterId));
  if(ship){ship.characterLocations||={};ship.characterLocations[unit.characterId]=clone(unit.location||{environment:'exterior',starshipId:'',square:null,mesh:4,stationed:false});}
 }
}
module.exports={fields,runtime,condition,apply,persist,locations};
